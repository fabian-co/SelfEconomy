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
    })
  }).optional()
});

export async function POST(req: Request) {
  try {
    const { text, bank, accountType } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: transactionSchema,
      prompt: `Actúa como un experto en análisis financiero y procesamiento de datos. Tu tarea es extraer transacciones de un extracto bancario en texto crudo y convertirlas a un JSON estandarizado, incluyendo un template para procesar futuros archivos similares sin IA.

INSTRUCCIONES DE FECHA:
1. Detecta el AÑO del extracto para completar las fechas.
2. Todas las fechas en el array 'transacciones' deben estar en formato ISO: YYYY-MM-DD.

REGLAS DE TRANSACCIÓN:
1. Identifica fecha, descripción y valor.
2. CARGOS son NEGATIVOS, ABONOS son POSITIVOS.
3. Ignora pagos a tarjeta o transferencias internas.

DISEÑO DEL TEMPLATE (OBLIGATORIO Y CRÍTICO):
Crea una configuración que permita a un script de Python (usando re.finditer) extraer las mismas transacciones.
- signature_keywords: 3-5 frases o palabras únicas que aparecen SIEMPRE en este banco/extracto (ej: "NIT 890.903.938-8", "Estado de Cuenta Tarjeta").
- transaction_regex: Un regex que capture cada línea de transacción completa. DEBE tener exactamente 3 grupos de captura: (fecha), (descripción), (monto).
- group_mapping: { date: 1, description: 2, value: 3 } (índices de los grupos en tu regex).
- rules (OBLIGATORIO):
  - "default_negative": true si los gastos en el texto NO tienen signo menos (típico en extractos de TC). ¡MUY IMPORTANTE PARA TARJETAS DE CRÉDITO!
  - "positive_patterns": Regex para descripciones que son abonos/ingresos (ej: ["PAGO", "ABONO", "GRACIAS POR TU PAGO"]).
  - "ignore_patterns": Regex para líneas que deben saltarse (ej: "SU PAGO", "TRANSFERENCIA ENTRE MIS CUENTAS").

EJEMPLO DE TEMPLATE FUNCIONAL:
{
  "entity": "Bancolombia",
  "account_type": "debit",
  "signature_keywords": ["BANCOLOMBIA S.A.", "ESTADO DE CUENTA AHORROS"],
  "transaction_regex": "(\\d{2}/\\d{2})\\s+(.*?)\\s+(-?[\\d\\.,]+)",
  "group_mapping": { "date": 1, "description": 2, "value": 3 },
  "date_format": "MM/DD",
  "decimal_separator": ",",
  "thousand_separator": ".",
  "rules": {
    "default_negative": false,
    "positive_patterns": ["CONSIGNACION", "TRANSFERENCIA RECIBIDA"],
    "ignore_patterns": ["SALDO ANTERIOR"]
  }
}

TEXTO DEL EXTRACTO A ANALIZAR:
${text}`,
    });

    return NextResponse.json(object);

  } catch (error: any) {
    console.error('Error in AI Normalization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
