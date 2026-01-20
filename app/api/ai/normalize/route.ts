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
  })),
  template_config: z.object({
    entity: z.string(),
    account_type: z.enum(['credit', 'debit']),
    signature_keywords: z.array(z.string()).describe("3 o 4 palabras únicas y constantes del extracto"),
    transaction_regex: z.string().describe("Regex con grupos de captura para fecha, descripción y monto"),
    group_mapping: z.object({
      date: z.number().describe("Índice del grupo para fecha"),
      description: z.number().describe("Índice del grupo para descripción"),
      value: z.number().describe("Índice del grupo para monto (valor)")
    }),
    date_format: z.string().describe("Formato de fecha capturado (ej: DD MMM o DD/MM)"),
    decimal_separator: z.enum(['.', ',']).optional().default(','),
    thousand_separator: z.enum(['.', ',']).optional().default('.'),
    rules: z.object({
      default_negative: z.boolean().describe("true si la mayoría son gastos (ej: TC)"),
      positive_patterns: z.array(z.string()).describe("Regex para descripciones que son ingresos/abonos"),
      ignore_patterns: z.array(z.string()).describe("Regex para descripciones que deben ignorarse")
    }).optional()
  }).optional()
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

INSTRUCCIONES DE FECHA:
1. Detecta el AÑO del extracto.
2. Formato ISO: YYYY-MM-DD.

REGLAS DE TRANSACCIÓN:
1. Identifica fecha, descripción y valor.
2. CARGOS son NEGATIVOS, ABONOS son POSITIVOS.
3. Ignora pagos a tarjeta o transferencias internas.

GENERACIÓN DE TEMPLATE (OBLIGATORIO PARA ESCALABILIDAD):
- Tu objetivo es detectar el PATRÓN de este extracto para procesarlo sin IA en el futuro.
- Crea un "regex" que capture la línea de transacción completa con 3 grupos: fecha, descripción y valor.
- Define "rules":
  - "default_negative": true si la mayoría de transacciones son gastos que no tienen signo menos en el texto (ej: compras en Tarjeta de Crédito).
  - "positive_patterns": Lista de regex para descripciones que SI son ingresos/abonos (ej: ["PAGO", "ABONO", "GRACIAS POR TU PAGO"]).
  - "ignore_patterns": Lista de regex para descripciones que deben ignorarse (ej: ["PAGO A TU TARJETA", "INTERESES"]).
- decimal_separator: "." o "," según el extracto.
- thousand_separator: "." o "," o "" según el extracto.
- Identifica 3 o 4 palabras clave constantes (keywords) únicas del banco.

TEXTO DEL EXTRACTO:
${text}`,
    });

    return NextResponse.json(object);

  } catch (error: any) {
    console.error('Error in AI Normalization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
