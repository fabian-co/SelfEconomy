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

REQUISITO ADICIONAL: Debes identificar el nombre del BANCO y el TIPO DE CUENTA (credit/debit) basándote en el contenido del texto.

TEXTO DEL EXTRACTO:
${text}

REGLAS CRÍTICAS:
1. Identifica la fecha, descripción y valor de cada transacción.
2. Asegúrate de que los valores sean numéricos.
3. Los CARGOS/COMPRAS deben ser NEGATIVOS. Los ABONOS/PAGOS deben ser POSITIVOS.
4. Marca como "ignored: true" aquellas transacciones que sean "PAGOS A TU TARJETA" o transferencias entre cuentas propias para evitar duplicidad en gastos.
5. Si detectas que el extracto es de Tarjeta de Crédito, el pago mensual de la tarjeta es un ingreso (positivo) pero debe ser ignorado.
6. Limpia las descripciones de códigos innecesarios o asteriscos si es posible.`,
    });

    return NextResponse.json(object);

  } catch (error: any) {
    console.error('Error in AI Normalization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
