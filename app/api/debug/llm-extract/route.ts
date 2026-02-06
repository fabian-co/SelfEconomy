import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ProcessorService } from '@/app/api/process/services/processor.service';
import { getTempDir, getPythonPath, getScriptPath, getRootDirTemp } from '@/app/api/process/lib/utils';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Schema for structured CSV output (per page)
const pageTransactionSchema = z.object({
  transactions: z.array(z.object({
    fecha: z.string().describe("Fecha de la transacción en formato YYYY-MM-DD"),
    descripcion: z.string().describe("Descripción completa de la transacción"),
    valor: z.number().describe("Monto de la transacción (negativo para gastos, positivo para ingresos)")
  })),
  metadata: z.object({
    entity: z.string().describe("Nombre del banco o entidad financiera"),
    account_type: z.enum(['credit', 'debit']).describe("Tipo de cuenta"),
    currency: z.string().describe("Moneda (COP, USD, etc.)"),
    period: z.string().optional().describe("Período del extracto si es detectable"),
    total_transactions: z.number().describe("Número total de transacciones encontradas en esta página")
  })
});

async function removePasswordFromPdf(inputPath: string, password: string): Promise<string> {
  const pythonCmd = getPythonPath();
  const scriptPath = getScriptPath('remove_pdf_password.py');
  const tempDir = path.join(getRootDirTemp(), 'unprotected');
  await fs.promises.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `unprotected_${Date.now()}.pdf`);

  return new Promise((resolve, reject) => {
    const args = ['--input', inputPath, '--output', outputPath, '--password', password];
    const proc = spawn(pythonCmd, [scriptPath, ...args]);
    let stderr = '';

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 10) {
        reject(new Error('PASSWORD_REQUIRED'));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr || `Python script exited with code ${code}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

interface StepStatus {
  step: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  message?: string;
  duration?: number;
  currentPage?: number;
  totalPages?: number;
  progress?: number; // 0-100
}

// Split text into pages using the "--- PÁGINA X ---" marker
function splitTextIntoPages(text: string): string[] {
  // Split by the page marker pattern
  const pageMarkerRegex = /---\s*PÁGINA\s*\d+\s*---/gi;
  const parts = text.split(pageMarkerRegex);

  // Filter out empty parts and return
  return parts.filter(p => p.trim().length > 100); // Only pages with meaningful content
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  let isCancelled = false;

  // Handle abort signal from client
  request.signal.addEventListener('abort', () => {
    isCancelled = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const sendStep = (step: StepStatus) => {
        if (isCancelled && step.status !== 'cancelled') return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
      };

      const steps: { [key: string]: { start: number } } = {};

      const startStep = (name: string, message: string) => {
        steps[name] = { start: Date.now() };
        sendStep({ step: name, status: 'running', message });
      };

      const completeStep = (name: string, message: string) => {
        const duration = Date.now() - (steps[name]?.start || Date.now());
        sendStep({ step: name, status: 'done', message, duration });
      };

      const errorStep = (name: string, message: string) => {
        const duration = Date.now() - (steps[name]?.start || Date.now());
        sendStep({ step: name, status: 'error', message, duration });
      };

      const sendPageProgress = (currentPage: number, totalPages: number, message: string) => {
        const progress = Math.round((currentPage / totalPages) * 100);
        sendStep({
          step: 'page_processing',
          status: 'running',
          currentPage,
          totalPages,
          progress,
          message
        });
      };

      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const password = formData.get('password') as string | null;

        if (!file) {
          errorStep('upload', 'No file provided');
          controller.close();
          return;
        }

        // Step 1: Upload
        startStep('upload', 'Guardando archivo...');
        const tempDir = getTempDir();
        await fs.promises.mkdir(tempDir, { recursive: true });
        const uploadPath = path.join(tempDir, `llm_${file.name}`);
        const bytes = await file.arrayBuffer();
        await fs.promises.writeFile(uploadPath, Buffer.from(bytes));
        completeStep('upload', `Archivo guardado: ${file.name}`);

        if (isCancelled) {
          sendStep({ step: 'cancelled', status: 'cancelled', message: 'Proceso cancelado por el usuario' });
          controller.close();
          return;
        }

        let pdfPathToProcess = uploadPath;

        // Step 2: Remove password (if needed)
        if (password) {
          startStep('password', 'Quitando protección del PDF...');
          try {
            pdfPathToProcess = await removePasswordFromPdf(uploadPath, password);
            completeStep('password', 'Protección eliminada correctamente');
          } catch (err: any) {
            errorStep('password', `Error: ${err.message}`);
            controller.close();
            return;
          }
        } else {
          sendStep({ step: 'password', status: 'done', message: 'Sin contraseña (omitido)' });
        }

        if (isCancelled) {
          sendStep({ step: 'cancelled', status: 'cancelled', message: 'Proceso cancelado por el usuario' });
          controller.close();
          return;
        }

        // Step 3: Extract text
        startStep('extract', 'Extrayendo texto del PDF...');
        let text: string;
        try {
          const result = await ProcessorService.extractText(
            pdfPathToProcess,
            pdfPathToProcess === uploadPath ? password || undefined : undefined,
            `llm_${Date.now()}`
          );
          text = result.text;
          completeStep('extract', `Texto extraído: ${text.length.toLocaleString()} caracteres`);
        } catch (err: any) {
          errorStep('extract', `Error: ${err.message}`);
          controller.close();
          return;
        }

        if (isCancelled) {
          sendStep({ step: 'cancelled', status: 'cancelled', message: 'Proceso cancelado por el usuario' });
          controller.close();
          return;
        }

        // Step 4: Split text into pages
        startStep('split', 'Dividiendo documento en páginas...');
        const pages = splitTextIntoPages(text);
        const totalPages = pages.length;

        if (totalPages === 0) {
          // Fallback: treat entire text as single page
          pages.push(text);
        }

        completeStep('split', `Documento dividido en ${pages.length} página(s)`);

        // Step 5: Process each page with LLM
        startStep('llm', 'Iniciando análisis con IA...');

        const allTransactions: Array<{ fecha: string; descripcion: string; valor: number }> = [];
        let finalMetadata: any = null;
        let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        const prompt = (pageText: string, pageNum: number) => `
Eres un experto en extracción de datos financieros.
Tu misión: Analizar el texto de LA PÁGINA ${pageNum} de un extracto bancario y extraer TODAS las transacciones en un formato estructurado.

REGLAS CRÍTICAS:
1. **FECHA:** Extrae la fecha y conviértela a formato YYYY-MM-DD. Si el año no está explícito, infiere del contexto.
2. **DESCRIPCIÓN:** Captura la descripción completa de cada transacción sin truncar.
3. **VALOR:** 
   - Para tarjetas de CRÉDITO: Las compras son NEGATIVAS, los pagos/abonos son POSITIVOS.
   - Para cuentas de DÉBITO: Los retiros son NEGATIVOS, los depósitos son POSITIVOS.
4. **IGNORA:** Saldos, totales, encabezados, y cualquier línea que no sea una transacción.
5. **MONEDA:** Identifica y remueve símbolos de moneda ($, COP, USD, etc.) del valor.
6. **FORMATO NÚMEROS:** Convierte valores como "1.234,56" o "1,234.56" a números decimales correctos.

IMPORTANTE: Extrae TODAS las transacciones que encuentres en esta página, no solo una muestra.
Si no hay transacciones en esta página (solo encabezados, resúmenes, etc.), devuelve un array vacío.

--- TEXTO DE LA PÁGINA ${pageNum} ---
${pageText.substring(0, 25000)}
--- FIN DEL TEXTO ---
`;

        for (let i = 0; i < pages.length; i++) {
          // Check for cancellation before each page
          if (isCancelled) {
            sendStep({ step: 'cancelled', status: 'cancelled', message: `Cancelado en página ${i + 1} de ${pages.length}` });
            controller.close();
            return;
          }

          const pageNum = i + 1;
          sendPageProgress(pageNum, pages.length, `Procesando página ${pageNum} de ${pages.length}...`);

          try {
            const result = await generateObject({
              model: google('gemini-2.5-flash'),
              schema: pageTransactionSchema,
              prompt: prompt(pages[i], pageNum),
              temperature: 0.1,
            });

            const pageTransactions = result.object.transactions;
            allTransactions.push(...pageTransactions);

            // Keep metadata from first page that has transactions
            if (!finalMetadata && pageTransactions.length > 0) {
              finalMetadata = result.object.metadata;
            }

            // Accumulate usage
            const u = result.usage as any;
            if (u) {
              totalUsage.promptTokens += u.promptTokens ?? u.inputTokens ?? 0;
              totalUsage.completionTokens += u.completionTokens ?? u.outputTokens ?? 0;
              totalUsage.totalTokens += u.totalTokens ?? 0;
            }

            // Update progress with transaction count
            sendPageProgress(pageNum, pages.length, `Página ${pageNum}: ${pageTransactions.length} transacciones encontradas`);

          } catch (err: any) {
            // Log error but continue with other pages
            console.error(`Error processing page ${pageNum}:`, err);
            sendPageProgress(pageNum, pages.length, `Página ${pageNum}: Error - ${err.message}`);
          }
        }

        completeStep('llm', `IA procesó ${pages.length} páginas, ${allTransactions.length} transacciones totales (${totalUsage.totalTokens} tokens)`);

        if (isCancelled) {
          sendStep({ step: 'cancelled', status: 'cancelled', message: 'Proceso cancelado por el usuario' });
          controller.close();
          return;
        }

        // Step 6: Generate merged CSV
        startStep('csv', 'Generando CSV consolidado...');
        let csvContent = "Fecha,Descripcion,Valor\n";
        for (const tx of allTransactions) {
          const escapedDesc = tx.descripcion.includes(',')
            ? `"${tx.descripcion.replace(/"/g, '""')}"`
            : tx.descripcion;
          csvContent += `${tx.fecha},${escapedDesc},${tx.valor}\n`;
        }

        const csvDir = path.join(process.cwd(), 'temp', 'csv');
        await fs.promises.mkdir(csvDir, { recursive: true });
        const csvPath = path.join(csvDir, `llm_extracted_${Date.now()}.csv`);
        await fs.promises.writeFile(csvPath, '\uFEFF' + csvContent, 'utf8');
        completeStep('csv', `CSV guardado con ${allTransactions.length} transacciones`);

        // Calculate costs (Gemini 2.5 Flash pricing: $0.15/1M input, $0.60/1M output)
        const inputCost = (totalUsage.promptTokens / 1_000_000) * 0.15;
        const outputCost = (totalUsage.completionTokens / 1_000_000) * 0.60;
        const totalCost = inputCost + outputCost;

        // Final result
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          step: 'complete',
          status: 'done',
          result: {
            success: true,
            metadata: finalMetadata || {
              entity: 'Desconocido',
              account_type: 'debit',
              currency: 'COP',
              total_transactions: allTransactions.length
            },
            transactions: allTransactions,
            csv: csvContent,
            csvPath: csvPath,
            transactionCount: allTransactions.length,
            pagesProcessed: pages.length,
            usage: {
              promptTokens: totalUsage.promptTokens,
              completionTokens: totalUsage.completionTokens,
              totalTokens: totalUsage.totalTokens,
              inputCost: inputCost,
              outputCost: outputCost,
              totalCost: totalCost
            }
          }
        })}\n\n`));

      } catch (error: any) {
        if (isCancelled) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: 'cancelled',
            status: 'cancelled',
            message: 'Proceso cancelado por el usuario'
          })}\n\n`));
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: 'error',
            status: 'error',
            message: error.message
          })}\n\n`));
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
