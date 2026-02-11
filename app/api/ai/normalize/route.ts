import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Define the schema for the AI output
const transactionSchema = z.object({
  meta_info: z.object({
    banco: z.string(),
    tipo_cuenta: z.enum(['credit', 'debit']),
    resumen: z.object({
      saldo_actual: z.number(),
      total_abonos: z.number(),
      total_cargos: z.number(),
    })
  }),
  transacciones: z.array(z.object({
    fecha: z.string(),
    descripcion: z.string(),
    valor: z.number(),
    saldo: z.number().optional(),
    ignored: z.boolean(),
  }))
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: transactionSchema,
      prompt: `Actúa como un experto en análisis financiero y procesamiento de datos. Tu tarea es extraer transacciones de un extracto bancario en texto crudo y convertirlas a un JSON estandarizado.

INSTRUCCIONES DE FECHA:
1. Detecta el AÑO del extracto para completar las fechas.
2. Todas las fechas en el array 'transacciones' deben estar en formato ISO: YYYY-MM-DD.

REGLAS DE TRANSACCIÓN:
1. Identifica fecha, descripción y valor.
2. CARGOS son NEGATIVOS, ABONOS son POSITIVOS.
3. Ignora pagos a tarjeta o transferencias internas.

TEXTO DEL EXTRACTO A ANALIZAR:
${text}`,
    });

    return NextResponse.json(object);

  } catch (error: any) {
    console.error('Error in AI Normalization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
