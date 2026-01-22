import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for template generation only (no transactions)
const templateSchema = z.object({
  entity: z.string().describe("Nombre del banco o entidad financiera"),
  account_type: z.enum(['credit', 'debit']).describe("Tipo de cuenta"),
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
    positive_patterns: z.array(z.string()).describe("Regex para descripciones que son ingresos/abonos"),
    ignore_patterns: z.array(z.string()).describe("Regex para descripciones que deben ignorarse (pagos a TC, transferencias internas)")
  })
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: templateSchema,
      prompt: `Eres un experto en expresiones regulares y análisis de extractos bancarios. Analiza este extracto y genera un template de configuración para extraer transacciones con regex.

DETECCIÓN DE FORMATO NUMÉRICO (MUY IMPORTANTE):
Analiza los números en el extracto para determinar los separadores:
- Si ves números como "1,234.56" → thousand_separator="," y decimal_separator="."
- Si ves números como "1.234,56" → thousand_separator="." y decimal_separator=","
- Si ves números como "1234.56" sin separador de miles → decimal_separator="."
- EXAMINA los montos reales en el extracto antes de decidir

REGLAS CRÍTICAS PARA EL REGEX:
1. Usa ^ y $ para anclar a inicio/fin de línea cuando las transacciones están en líneas separadas
2. El regex DEBE tener exactamente 3 grupos de captura: (fecha), (descripción), (monto)
3. Si hay una columna de saldo después del monto, inclúyela en el regex pero NO la captures
4. Usa .*? para descripciones (non-greedy)
5. Para montos, captura: (-?[\\d.,]+) - incluye puntos y comas

REGLAS PARA ENTITY:
- Usa el nombre COMPLETO del banco (ej: "Bancolombia", "Nu Financiera", "Davivienda")
- NO uses nombres genéricos como "Banco"

EJEMPLO DE TEMPLATE PARA BANCOLOMBIA (CUENTAS DE AHORRO):
{
  "entity": "Bancolombia",
  "account_type": "debit",
  "signature_keywords": ["SUCURSAL TULUA", "NÚMERO 91211257666", "SUCURSAL VIRTUAL PERSONAS"],
  "transaction_regex": "^(\\\\d{1,2}/\\\\d{1,2})\\\\s+(.*?)\\\\s+(-?[\\\\d.,]+)\\\\s+[\\\\d.,]+$",
  "group_mapping": { "date": 1, "description": 2, "value": 3 },
  "date_format": "D/M",
  "year_hint": 2025,
  "decimal_separator": ".",
  "thousand_separator": ",",
  "rules": {
    "default_negative": false,
    "positive_patterns": ["ABONO", "CONSIG", "TRANSFERENCIA DESDE", "PAGO DE NOMI", "PAGO DE PROV", "DEV CUOTA"],
    "ignore_patterns": ["TRANSFERENCIA CTA SUC VIRTUAL", "TRASLADO A FONDO", "PAGO PSE"]
  }
}

EJEMPLO PARA TARJETA DE CRÉDITO (Nu Financiera):
{
  "entity": "Nu Financiera", 
  "account_type": "credit",
  "signature_keywords": ["NIT 901.658.107-2", "Nu Financiera", "Periodo facturado"],
  "transaction_regex": "(\\\\d{2}\\\\s[A-Z]{3}(?:\\\\s\\\\d{4})?)\\\\s+((?:(?!\\\\$|\\\\d{2}\\\\s[A-Z]{3}).)+?)\\\\s+\\\\$([\\\\d.,]+)",
  "group_mapping": { "date": 1, "description": 2, "value": 3 },
  "date_format": "DD MMM YYYY",
  "year_hint": 2024,
  "decimal_separator": ",",
  "thousand_separator": ".",
  "rules": {
    "default_negative": true,
    "positive_patterns": ["Devolución", "Gracias por tu pago"],
    "ignore_patterns": ["Gracias por tu pago", "A capital", "A intereses"]
  }
}

INSTRUCCIONES FINALES:
1. Identifica el banco/entidad financiera por su nombre completo
2. Detecta el formato de las transacciones analizando varias líneas
3. Crea un regex que capture TODAS las transacciones del extracto
4. signature_keywords: Usa NITs, nombres de sucursal, números de cuenta - cosas ÚNICAS
5. Detecta el año del extracto para year_hint
6. Para tarjetas de crédito, default_negative=true
7. DETECTA los separadores analizando los números en el extracto (no asumas un formato)

TEXTO DEL EXTRACTO:
${text}`,
    });

    return NextResponse.json({ template: object });

  } catch (error: any) {
    console.error('Error in AI Template Generation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
