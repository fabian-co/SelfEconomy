import { google } from '@ai-sdk/google';
import { generateText, tool } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { text, feedback, previousTemplate, currentTransactions } = await req.json();

    if (!text || !feedback) {
      return NextResponse.json({ error: 'Missing text or feedback' }, { status: 400 });
    }

    const { text: aiResponse, toolCalls } = await generateText({
      model: google('gemini-2.5-flash'),
      system: `Eres un experto en procesamiento de extractos bancarios. 
Tu objetivo es realizar cambios QUIRÚRGICOS en la configuración del template basado en el feedback del usuario.

REGLAS DE ORO:
1. No cambies el REGEX de extracción a menos que sea absolutamente necesario (si faltan transacciones enteras o se mezclan columnas).
2. Si el usuario reporta un error en UNA transacción específica (ej: "el valor de Railway está mal", "cambia la fecha de X"), usa 'edit_transaction'.
3. Si el usuario pide eliminar transacciones específicas que ya están en la lista, usa 'delete_transaction'.
4. Si el usuario pide ignorar transacciones futuras o tipos de transacciones (ej: Comisiones), usa 'add_ignore_rule'.
5. Si el usuario pide cambiar el signo de una transacción (ej: Abonos que aparecen como cargos), usa 'add_flip_rule'.
6. Si el usuario reporta ruido masivo en el texto raw, usa 'physical_cleanup'.
7. EVITA REGENERAR TODO. Se quirúrgico.

CONTEXTO:
- Template actual: ${JSON.stringify(previousTemplate, null, 2)}
- Últimas transacciones extraídas: ${JSON.stringify(currentTransactions?.slice(0, 10), null, 2)}
`,
      prompt: `Feedback del usuario: "${feedback}"

Texto del extracto (muestra):
${text.substring(0, 4000)}`,
      tools: {
        add_ignore_rule: (tool as any)({
          description: 'Agrega un patrón (regex simple o palabra) a la lista de ignorados.',
          parameters: z.object({
            pattern: z.string().describe('El patrón de descripción a ignorar (ej: "Comisión por cambio")'),
          }) as any,
        }),
        add_flip_rule: (tool as any)({
          description: 'Agrega un patrón para invertir el signo de la transacción (de negativo a positivo).',
          parameters: z.object({
            pattern: z.string().describe('El patrón de descripción a invertir (ej: "Abono", "Pago")'),
          }) as any,
        }),
        update_extraction_regex: (tool as any)({
          description: 'Actualiza el regex principal de extracción. Solo úsalo si el actual no captura nada o captura mal las columnas.',
          parameters: z.object({
            new_regex: z.string().describe('El nuevo regex con grupos de captura para fecha, descripción y valor.'),
            date_format: z.string().optional().describe('Nuevo formato de fecha si cambió.'),
          }) as any,
        }),
        physical_cleanup: (tool as any)({
          description: 'Aplica una limpieza de IA al texto raw si hay demasiado ruido que confunde al procesador.',
          parameters: z.object({
            instruction: z.string().describe('Instrucción específica para la limpieza del texto raw.'),
          }) as any,
        }),
        edit_transaction: (tool as any)({
          description: 'Edita una transacción específica que ya fue extraída pero tiene errores en sus campos.',
          parameters: z.object({
            tx_id: z.string().describe('El ID de la transacción a editar.'),
            updates: z.object({
              fecha: z.string().optional(),
              descripcion: z.string().optional(),
              valor: z.number().optional(),
            }),
            motive: z.string().describe('Razón del cambio (ej: "Monto incorrecto según usuario")'),
          }) as any,
        }),
        delete_transaction: (tool as any)({
          description: 'Elimina una transacción específica de la lista sugerida.',
          parameters: z.object({
            tx_id: z.string().describe('El ID de la transacción a eliminar.'),
            motive: z.string().describe('Razón de la eliminación.'),
          }) as any,
        }),
      },
    });

    console.log('[AI Refine] Full toolCalls:', JSON.stringify(toolCalls, null, 2));

    return NextResponse.json({
      message: aiResponse,
      toolCalls: toolCalls?.map(tc => {
        // The AI SDK may have args directly on the toolCall or under different property names
        const args = (tc as any).args || (tc as any).parameters || (tc as any).input || {};
        console.log(`[AI Refine] Tool: ${tc.toolName}, Args:`, args);
        return {
          toolName: tc.toolName,
          args
        };
      }) || []
    });

  } catch (error: any) {
    console.error('Error in AI Refine Assistant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
