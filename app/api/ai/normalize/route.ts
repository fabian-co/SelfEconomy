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
    const { text, bank, accountType } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: transactionSchema,
      prompt: `Actúa como un experto en análisis financiero. Tu tarea es extraer transacciones de un extracto bancario en texto crudo y convertirlas a un JSON estandarizado.

INSTRUCCIONES DE FECHA (MUY IMPORTANTE):
1. Detecta el AÑO del extracto (suele estar en el encabezado).
2. Asegúrate de que TODAS las transacciones tengan una fecha en formato ISO: YYYY-MM-DD.
3. Si el extracto solo dice "Oct 15", y el año del extracto es 2023, la fecha debe ser "2023-10-15".

REQUISITO DE METADATOS:
- Debes identificar el nombre del BANCO y el TIPO DE CUENTA (credit/debit) basándote en el contenido del texto.

TEXTO DEL EXTRACTO:
${text}

REGLAS CRÍTICAS DE TRANSACCIÓN:
1. Identifica la fecha, descripción y valor de cada transacción.
2. Asegúrate de que los valores sean numéricos.
3. Los CARGOS/COMPRAS deben ser NEGATIVOS. Los ABONOS/PAGOS deben ser POSITIVOS (excepto si son devoluciones).
4. Marca como "ignored: true" aquellas transacciones que sean "PAGOS A TU TARJETA" o transferencias entre cuentas propias.
5. Limpia las descripciones de códigos innecesarios.`,
    });

    return NextResponse.json(object);

  } catch (error: any) {
    console.error('Error in AI Normalization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
