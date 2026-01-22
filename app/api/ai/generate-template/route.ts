import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for template generation only (no transactions)
const templateSchema = z.object({
  entity: z.string().describe("Nombre del banco o entidad financiera"),
  account_type: z.enum(['credit', 'debit']).describe("Tipo de cuenta"),
  file_types: z.array(z.string()).describe("Lista de tipos de archivo compatibles (ej: ['pdf', 'csv', 'xlsx'])"),
  signature_keywords: z.array(z.string()).describe("3-5 palabras/frases únicas que identifican este tipo de extracto"),
  transaction_regex: z.string().describe("Regex con grupos de captura para fecha, descripción y monto"),
  group_mapping: z.object({
    date: z.number().describe("Índice del grupo para fecha (1-based)"),
    description: z.number().describe("Índice del grupo para descripción (1-based)"),
    value: z.number().describe("Índice del grupo para monto (1-based)")
  }),
  date_format: z.string().describe("Formato de fecha en el extracto (ej: DD MMM YYYY, DD/MM/YYYY)"),
  year_hint: z.number().optional().describe("Año del extracto si se puede detectar"),
  decimal_separator: z.enum(['.', ',']).default(','),
  thousand_separator: z.enum(['.', ',']).default('.'),
  rules: z.object({
    default_negative: z.boolean().describe("true si los montos son gastos por defecto (típico en TC)"),
    positive_patterns: z.array(z.string()).describe("Regex para descripciones que son ingresos/abonos")
  })
});

export async function POST(req: Request) {
  try {
    const { text, fileExtension } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: templateSchema,
      prompt: `Eres un experto en expresiones regulares y análisis de extractos bancarios. Analiza este extracto y genera un template de configuración para extraer transacciones con regex.

DETECCIÓN DE FORMATO Y COMPATIBILIDAD:
1. El archivo original tiene la extensión: ${fileExtension || 'desconocida'}
2. Evalúa si el formato del extracto es específico para esta extensión o si el mismo "look & feel" podría estar en otros formatos.
3. En 'file_types', incluye los formatos compatibles. Si es PDF, usualmente solo es 'pdf' a menos que el texto parezca un volcado de CSV. Si es CSV o XLSX, pon el formato correspondiente.

DETECCIÓN DE FORMATO NUMÉRICO (MUY IMPORTANTE):
- Analiza los números en el extracto para determinar los separadores:
- Si ves números como "1,234.56" → thousand_separator="," y decimal_separator="."
- Si ves números como "1.234,56" → thousand_separator="." y decimal_separator=","
- Si ves números como "1234.56" sin separador de miles → decimal_separator="."
- EXAMINA los montos reales en el extracto antes de decidir

REGLAS CRÍTICAS PARA EL REGEX:
1. Usa ^ y $ para anclar a inicio/fin de línea cuando las transacciones están en líneas separadas. Para CSV/XLSX, el texto proporcionado es una representación CSV.
2. El regex DEBE tener exactamente 3 grupos de captura: (fecha), (descripción), (monto)
3. Si hay una columna de saldo después del monto, inclúyela en el regex pero NO la captures
4. Usa .*? para descripciones (non-greedy)
5. Para montos, captura: (-?[\\d.,]+) - incluye puntos y comas
6. NO HARDCODEES el año en el regex - usa grupos opcionales (?:\\s\\d{4})? para años
7. Usa negative lookahead (?!...) para descripciones complejas que pueden contener espacios

REGLAS PARA ENTITY:
- Usa el nombre COMPLETO del banco (ej: "Bancolombia", "Nu Financiera", "Davivienda")

EJEMPLO DE TEMPLATE PARA BANCOLOMBIA (PDF):
{
  "entity": "Bancolombia",
  "account_type": "debit",
  "file_types": ["pdf"],
  "signature_keywords": ["SUCURSAL TULUA", "NÚMERO 91211257666", "SUCURSAL VIRTUAL PERSONAS"],
  "transaction_regex": "^(\\\\d{1,2}/\\\\d{1,2})\\\\s+(.*?)\\\\s+(-?[\\\\d.,]+)\\\\s+[\\\\d.,]+$",
  "group_mapping": { "date": 1, "description": 2, "value": 3 },
  "date_format": "D/M",
  "year_hint": 2025,
  "decimal_separator": ".",
  "thousand_separator": ",",
  "rules": {
    "default_negative": false,
    "positive_patterns": ["ABONO", "CONSIG", "TRANSFERENCIA DESDE", "PAGO DE NOMI", "PAGO DE PROV", "DEV CUOTA"]
  }
}

EJEMPLO DE TEMPLATE PARA CSV:
{
  "entity": "Entidad Generica",
  "account_type": "debit",
  "file_types": ["csv", "xlsx"],
  "signature_keywords": ["Columna1", "Columna2", "Concepto"],
  "transaction_regex": "^(\\\\d{4}-\\\\d{2}-\\\\d{2}),(.*?),(.*?)$",
  "group_mapping": { "date": 1, "description": 2, "value": 3 },
  "date_format": "YYYY-MM-DD",
  "decimal_separator": ".",
  "thousand_separator": ",",
  "rules": {
     "default_negative": false,
     "positive_patterns": []
  }
}

TEXTO DEL EXTRACTO:
${text}`,
    });

    return NextResponse.json({ template: object });

  } catch (error: any) {
    console.error('Error in AI Template Generation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
