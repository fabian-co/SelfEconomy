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
    default_negative: z.boolean().describe("true si la mayoría son gastos y NO tienen signo menos (típico en extractos de TC). false si los gastos ya vienen con signo negativo."),
    positive_patterns: z.array(z.string()).describe("Regex para descripciones que son ingresos/abonos"),
    ignore_patterns: z.array(z.string()).describe("Regex para descripciones que deben ignorarse (ej: saldos, totales, encabezados de tabla)")
  }),
  validation: z.array(z.object({
    raw_line: z.string().describe("La línea original del extracto"),
    parsed: z.object({
      date: z.string(),
      description: z.string(),
      value: z.number().describe("El valor numérico final después de aplicar default_negative")
    })
  })).describe("3 ejemplos extraídos del texto usando el regex configurado para validar su precisión")
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
3. En 'file_types', incluye los formatos compatibles.

DETECCIÓN DE FORMATO NUMÉRICO:
- Analiza si los números usan "." o "," para decimales y miles.

REGLAS CRÍTICAS PARA EL REGEX Y SIGNOS:
1. El regex DEBE capturar exactamente 3 grupos: (fecha), (descripción), (monto).
2. 'default_negative': Es TRUE si el extracto muestra los gastos (compras) como números positivos (sin signo menos) y los ingresos (abonos) con signo o palabras clave. Esto es común en Tarjetas de Crédito.
3. 'ignore_patterns': Identifica líneas que el regex podría capturar pero que no son transacciones (ej: "SALDO TOTAL", "PAGO MÍNIMO", "TOTAL CARGOS").

VALIDACIÓN (OBLIGATORIO):
En la sección 'validation', debes incluir 3 ejemplos reales del texto que acabas de analizar.
- 'raw_line': La línea completa tal cual aparece en el texto.
- 'parsed': Muestra cómo quedaría la transacción después de aplicar tu regex y la lógica de 'default_negative'.

EJEMPLO DE SALIDA ESPERADA:
{
  "entity": "Banco X",
  "account_type": "credit",
  "file_types": ["pdf"],
  "signature_keywords": ["ESTADO DE CUENTA", "TARJETA CERRADA"],
  "transaction_regex": "(\\\\d{2} [A-Z]{3})\\\\s+(.*?)\\\\s+(-?[\\\\d.,]+)",
  "group_mapping": { "date": 1, "description": 2, "value": 3 },
  "date_format": "DD MMM",
  "rules": {
    "default_negative": true,
    "positive_patterns": ["PAGO", "CREDI", "ABONO"],
    "ignore_patterns": ["SALDO ANTERIOR", "TOTAL PAGO"]
  },
  "validation": [
    {
      "raw_line": "15 ENE COMPRA AMAZON 150.00",
      "parsed": { "date": "15 ENE", "description": "COMPRA AMAZON", "value": -150.00 }
    }
  ]
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
