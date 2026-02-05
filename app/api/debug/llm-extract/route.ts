import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ProcessorService } from '@/app/api/process/services/processor.service';
import { getTempDir, getPythonPath, getScriptPath, getRootDirTemp } from '@/app/api/process/lib/utils';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Schema for structured CSV output
const transactionSchema = z.object({
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
    total_transactions: z.number().describe("Número total de transacciones encontradas")
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
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
  duration?: number;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendStep = (step: StepStatus) => {
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

        // Step 4: Send to LLM
        startStep('llm', 'Analizando con Gemini...');
        const prompt = `
Eres un experto en extracción de datos financieros.
Tu misión: Analizar el texto de un extracto bancario y extraer TODAS las transacciones en un formato estructurado.

REGLAS CRÍTICAS:
1. **FECHA:** Extrae la fecha y conviértela a formato YYYY-MM-DD. Si el año no está explícito, infiere del contexto.
2. **DESCRIPCIÓN:** Captura la descripción completa de cada transacción sin truncar.
3. **VALOR:** 
   - Para tarjetas de CRÉDITO: Las compras son NEGATIVAS, los pagos/abonos son POSITIVOS.
   - Para cuentas de DÉBITO: Los retiros son NEGATIVOS, los depósitos son POSITIVOS.
4. **IGNORA:** Saldos, totales, encabezados, y cualquier línea que no sea una transacción.
5. **MONEDA:** Identifica y remueve símbolos de moneda ($, COP, USD, etc.) del valor.
6. **FORMATO NÚMEROS:** Convierte valores como "1.234,56" o "1,234.56" a números decimales correctos.

IMPORTANTE: Extrae TODAS las transacciones que encuentres, no solo una muestra.

--- TEXTO DEL EXTRACTO ---
${text.substring(0, 30000)}
--- FIN DEL TEXTO ---
`;

        let object;
        let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        try {
          const result = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: transactionSchema,
            prompt: prompt,
            temperature: 0.1,
          });
          object = result.object;
          // Extract usage info from result
          const u = result.usage as any;
          if (u) {
            usage = {
              promptTokens: u.promptTokens ?? u.inputTokens ?? 0,
              completionTokens: u.completionTokens ?? u.outputTokens ?? 0,
              totalTokens: u.totalTokens ?? 0
            };
          }
          completeStep('llm', `IA encontró ${object.transactions.length} transacciones (${usage.totalTokens} tokens)`);
        } catch (err: any) {
          errorStep('llm', `Error de IA: ${err.message}`);
          controller.close();
          return;
        }

        // Step 5: Generate CSV
        startStep('csv', 'Generando CSV...');
        let csvContent = "Fecha,Descripcion,Valor\n";
        for (const tx of object.transactions) {
          const escapedDesc = tx.descripcion.includes(',')
            ? `"${tx.descripcion.replace(/"/g, '""')}"`
            : tx.descripcion;
          csvContent += `${tx.fecha},${escapedDesc},${tx.valor}\n`;
        }

        const csvDir = path.join(process.cwd(), 'temp', 'csv');
        await fs.promises.mkdir(csvDir, { recursive: true });
        const csvPath = path.join(csvDir, `llm_extracted_${Date.now()}.csv`);
        await fs.promises.writeFile(csvPath, '\uFEFF' + csvContent, 'utf8');
        completeStep('csv', 'CSV guardado correctamente');

        // Calculate costs (Gemini 2.5 Flash pricing: $0.15/1M input, $0.60/1M output)
        const inputCost = (usage.promptTokens / 1_000_000) * 0.15;
        const outputCost = (usage.completionTokens / 1_000_000) * 0.60;
        const totalCost = inputCost + outputCost;

        // Final result
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          step: 'complete',
          status: 'done',
          result: {
            success: true,
            metadata: object.metadata,
            transactions: object.transactions,
            csv: csvContent,
            csvPath: csvPath,
            transactionCount: object.transactions.length,
            usage: {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              inputCost: inputCost,
              outputCost: outputCost,
              totalCost: totalCost
            }
          }
        })}\n\n`));

      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          step: 'error',
          status: 'error',
          message: error.message
        })}\n\n`));
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
