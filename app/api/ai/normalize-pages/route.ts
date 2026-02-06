import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import path from 'path';
import { TemplateService } from '../../process/services/template.service';
import { TransactionService } from '../../process/services/transaction.service';

// Schema for page transactions
const pageTransactionSchema = z.object({
  transactions: z.array(z.object({
    fecha: z.string().describe("Fecha de la transacción en formato YYYY-MM-DD"),
    descripcion: z.string().describe("Descripción completa de la transacción"),
    valor: z.number().describe("Monto de la transacción (negativo para gastos, positivo para ingresos)"),
    ignored: z.boolean().default(false)
  })),
  metadata: z.object({
    entity: z.string().describe("Nombre del banco o entidad financiera"),
    account_type: z.enum(['credit', 'debit']).describe("Tipo de cuenta"),
    currency: z.string().describe("Moneda (COP, USD, etc.)"),
  })
});

// Split text into pages using the "--- PÁGINA X ---" marker
function splitTextIntoPages(text: string): string[] {
  const pageMarkerRegex = /---\s*PÁGINA\s*\d+\s*---/gi;
  const parts = text.split(pageMarkerRegex);
  return parts.filter(p => p.trim().length > 100);
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  let isCancelled = false;

  request.signal.addEventListener('abort', () => {
    isCancelled = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        if (isCancelled && data.step !== 'cancelled') return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { text, sessionId, filePath, outputName } = await request.json();

        if (!text) {
          send({ step: 'error', message: 'No text provided' });
          controller.close();
          return;
        }

        // Split text into pages
        send({ step: 'split', status: 'running', message: 'Dividiendo documento en páginas...' });
        const pages = splitTextIntoPages(text);
        const totalPages = pages.length || 1;

        if (pages.length === 0) {
          pages.push(text);
        }

        send({ step: 'split', status: 'done', message: `Documento dividido en ${pages.length} página(s)` });

        // Process each page
        const allTransactions: Array<{ fecha: string; descripcion: string; valor: number; ignored: boolean }> = [];
        let finalMetadata: any = null;
        let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        const prompt = (pageText: string, pageNum: number) => `
Eres un experto en extracción de datos financieros.
Tu misión: Analizar el texto de LA PÁGINA ${pageNum} de un extracto bancario y extraer TODAS las transacciones.

REGLAS:
1. **FECHA:** Formato YYYY-MM-DD. Si el año no está explícito, infiere del contexto.
2. **DESCRIPCIÓN:** Captura completa sin truncar.
3. **VALOR:** 
   - Tarjetas de CRÉDITO: Compras NEGATIVAS, pagos/abonos POSITIVOS.
   - Cuentas de DÉBITO: Retiros NEGATIVOS, depósitos POSITIVOS.
4. **IGNORA:** Saldos, totales, encabezados.
5. **MONEDA:** Remueve símbolos ($, COP, USD).
6. **FORMATO:** Convierte "1.234,56" o "1,234.56" a números decimales.

Si no hay transacciones en esta página, devuelve un array vacío.

--- TEXTO DE LA PÁGINA ${pageNum} ---
${pageText.substring(0, 25000)}
--- FIN ---
`;

        for (let i = 0; i < pages.length; i++) {
          if (isCancelled) {
            send({ step: 'cancelled', message: `Cancelado en página ${i + 1} de ${pages.length}` });
            controller.close();
            return;
          }

          const pageNum = i + 1;
          const progress = Math.round((pageNum / totalPages) * 100);

          send({
            step: 'page',
            status: 'running',
            currentPage: pageNum,
            totalPages,
            progress,
            message: `Procesando página ${pageNum} de ${totalPages}...`
          });

          try {
            const result = await generateObject({
              model: google('gemini-2.5-flash'),
              schema: pageTransactionSchema,
              prompt: prompt(pages[i], pageNum),
              temperature: 0.1,
            });

            const pageTx = result.object.transactions;
            allTransactions.push(...pageTx);

            if (!finalMetadata && pageTx.length > 0) {
              finalMetadata = result.object.metadata;
            }

            const u = result.usage as any;
            if (u) {
              totalUsage.promptTokens += u.promptTokens ?? u.inputTokens ?? 0;
              totalUsage.completionTokens += u.completionTokens ?? u.outputTokens ?? 0;
              totalUsage.totalTokens += u.totalTokens ?? 0;
            }

            send({
              step: 'page',
              status: 'done',
              currentPage: pageNum,
              totalPages,
              progress,
              message: `Página ${pageNum}: ${pageTx.length} transacciones`,
              transactionsFound: pageTx.length
            });

          } catch (err: any) {
            console.error(`Error page ${pageNum}:`, err);
            send({
              step: 'page',
              status: 'error',
              currentPage: pageNum,
              totalPages,
              progress,
              message: `Error en página ${pageNum}: ${err.message}`
            });
          }
        }

        if (isCancelled) {
          send({ step: 'cancelled', message: 'Proceso cancelado' });
          controller.close();
          return;
        }

        // Calculate totals
        let totalAbonos = 0;
        let totalCargos = 0;
        for (const tx of allTransactions) {
          if (tx.valor > 0) totalAbonos += tx.valor;
          else totalCargos += Math.abs(tx.valor);
        }

        // Build final result
        const finalResult: any = {
          meta_info: {
            banco: finalMetadata?.entity || 'Desconocido',
            tipo_cuenta: finalMetadata?.account_type || 'debit',
            resumen: {
              saldo_actual: 0,
              total_abonos: totalAbonos,
              total_cargos: totalCargos
            }
          },
          transacciones: allTransactions,
          pagesProcessed: pages.length,
          usage: totalUsage
        };

        // Save versioned files if sessionId provided
        let version = 1;
        if (sessionId) {
          const fileExt = filePath ? path.extname(filePath).toLowerCase().replace('.', '') : 'pdf';

          // Create a simple template config
          const templateConfig = {
            entity: finalMetadata?.entity || 'AI Extracted',
            account_type: finalMetadata?.account_type || 'debit',
            signature_keywords: ['AI-extracted'],
            file_types: [fileExt],
            extraction_method: 'llm_page_by_page'
          };

          const versionedResult = await TemplateService.saveTempTemplateVersioned(templateConfig, fileExt, sessionId);
          version = versionedResult.version;

          finalResult.template_config = {
            ...templateConfig,
            fileName: path.basename(versionedResult.path)
          };
          finalResult.version = version;

          await TransactionService.saveTempProcessedDataVersioned(finalResult, sessionId, version);
        }

        // Send complete result
        send({
          step: 'complete',
          status: 'done',
          result: finalResult
        });

      } catch (error: any) {
        if (isCancelled) {
          send({ step: 'cancelled', message: 'Proceso cancelado' });
        } else {
          send({ step: 'error', message: error.message });
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
