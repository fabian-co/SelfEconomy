import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ----------------------------------------------------------------------
// 1. DEFINICIÓN DEL SCHEMA (Tu estructura original)
// ----------------------------------------------------------------------
const templateSchema = z.object({
  entity: z.string().describe("Nombre del banco o entidad financiera"),
  account_type: z.enum(['credit', 'debit']).describe("Tipo de cuenta"),
  file_types: z.array(z.string()).describe("Lista de tipos de archivo compatibles"),
  signature_keywords: z.array(z.string()).describe("3-5 palabras/frases únicas que identifican este extracto"),

  // El corazón del problema: El Regex
  transaction_regex: z.string().describe("Regex con grupos de captura. IMPORTANTE: Usar anclas fuertes como signos de moneda ($) o formatos de fecha."),

  group_mapping: z.object({
    date: z.number().describe("Índice del grupo para fecha (1-based)"),
    description: z.number().describe("Índice del grupo para descripción (1-based)"),
    value: z.number().describe("Índice del grupo para monto (1-based)")
  }),

  date_format: z.string().describe("Formato de fecha (ej: DD MMM YYYY)"),
  year_hint: z.number().optional().describe("Año del extracto si se puede detectar"),
  decimal_separator: z.enum(['.', ',']).default(','),
  thousand_separator: z.enum(['.', ',']).default('.'),

  rules: z.object({
    default_negative: z.boolean().describe("true si los gastos NO tienen signo menos"),
    positive_patterns: z.array(z.string()).describe("Regex para identificar ingresos/pagos"),
    ignore_patterns: z.array(z.string()).describe("Regex para líneas a ignorar (saldos, totales)")
  }),

  // Esta validación es la "alucinación" de la IA, útil para contexto, 
  // pero no confiaremos ciegamente en ella.
  validation: z.array(z.object({
    raw_line: z.string(),
    parsed: z.object({
      date: z.string(),
      description: z.string(),
      value: z.number()
    })
  })).describe("3 ejemplos extraídos mentalmente por la IA")
});

// ----------------------------------------------------------------------
// 2. FUNCIÓN DE PRUEBA REAL (El "Juez" imparcial)
// ----------------------------------------------------------------------
// Esta función ejecuta el regex generado contra el texto REAL de inmediato.
// Si esto falla, el usuario lo verá en el preview.
function testRegexOnText(text: string, regexStr: string, mapping: any) {
  try {
    // Creamos el regex. 'g' para global, 'm' para multilínea.
    const regex = new RegExp(regexStr, 'gm');
    const matches = [...text.matchAll(regex)];

    // Devolvemos las primeras 10 transacciones encontradas para que el usuario valide
    return matches.slice(0, 10).map(m => ({
      full_match: m[0].trim(),
      // Mapeamos los grupos según lo que dijo la IA (1, 2, 3...)
      extracted_date: m[mapping.date]?.trim(),
      extracted_description: m[mapping.description]?.trim(),
      extracted_value: m[mapping.value]?.trim(),
    }));
  } catch (error) {
    console.error("Error probando regex:", error);
    return []; // Retorna vacío si el regex es inválido sintácticamente
  }
}

// ----------------------------------------------------------------------
// 3. EL HANDLER PRINCIPAL
// ----------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const { text, fileExtension, feedback, previousTemplate } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // --- CONSTRUCCIÓN DEL PROMPT ---
    let prompt = `
Eres un Ingeniero de Datos Senior experto en 'Regex' para Fintech.
Tu misión: Analizar el texto de un extracto bancario y generar un JSON de configuración perfecto para extraer transacciones.

INPUT DEL SISTEMA:
- Extensión archivo: ${fileExtension || 'texto'}
- Longitud muestra: ${text.length} caracteres

PRINCIPIOS CRÍTICOS DE DISEÑO (NO LOS ROMPAS):
1. **ANCLAJE:** No uses regex débiles como '.*'. Usa anclas. Ejemplo: Si el monto siempre tiene '$', usa '\\$' en el regex.
2. **DESCRIPCIONES:** Las descripciones de compras CONTIENEN NÚMEROS (ej: "Uber 360", "Calle 13"). 
   - 🚫 PROHIBIDO USAR: '[^\\d]+' (esto rompe la descripción al primer número).
   - ✅ MEJOR USAR: '((?:(?!\\$).)+?)' (Lookahead: toma todo hasta ver el signo de moneda) o '(.*?)' (Non-greedy).
3. **ESPACIOS:** Usa siempre '\\s+' en lugar de un espacio simple ' ', ya que los PDFs a veces tienen espacios múltiples invisibles.
4. **FECHAS:** Si la fecha está al principio de la línea, usa la estructura exacta (ej: '\\d{2}\\s[A-Z]{3}').

VALIDACIÓN:
En el campo 'validation', demuestra que tu regex funciona extrayendo 3 líneas del texto de abajo.
`;

    // --- INYECCIÓN DE FEEDBACK (Lógica de Iteración) ---
    if (feedback && previousTemplate) {
      prompt += `
\n🚨 ALERTA: MODO DE CORRECCIÓN (FEEDBACK DE USUARIO) 🚨
El usuario ha rechazado el template anterior.
REGEX FALLIDO: "${previousTemplate.transaction_regex}"

FEEDBACK DEL USUARIO: "${feedback}"

INSTRUCCIONES PARA LA CORRECCIÓN:
1. NO reinicies el regex desde cero si ya capturaba bien algunas partes. Ajusta SOLO lo que falló.
2. Si el usuario dice que faltan datos, haz el regex un poco más permisivo en los espacios.
3. Si el usuario dice que la descripción se corta, revisa si usaste '[^\\d]' y cámbialo por un patrón que acepte todo hasta el monto.
4. Analiza el "Texto del Extracto" abajo para encontrar el caso específico que menciona el usuario.
`;
    }

    // Agregamos el texto al final para que sea lo último en el contexto
    prompt += `
\n--- TEXTO DEL EXTRACTO (MUESTRA RAW) ---
${text.substring(0, 4000)} 
--- FIN DEL TEXTO ---
`;

    // --- LLAMADA A LA IA ---
    const { object } = await generateObject({
      model: google('gemini-2.0-flash'), // Este modelo es excelente para esto
      schema: templateSchema,
      prompt: prompt,
      temperature: 0.2, // Temperatura baja para ser más preciso y menos "creativo" con el código
    });

    // --- VERIFICACIÓN REAL (IR A LA FIJA) ---
    // Ejecutamos el regex generado contra el texto real aquí mismo en el servidor
    const livePreview = testRegexOnText(
      text,
      object.transaction_regex,
      object.group_mapping
    );

    // Retornamos ambas cosas: El plan (template) y la realidad (preview)
    return NextResponse.json({
      template: object,
      preview: livePreview
    });

  } catch (error: any) {
    console.error('Error in AI Template Generation:', error);
    // Manejo seguro de errores para no tumbar la app
    return NextResponse.json(
      { error: error.message || 'Error generando el template' },
      { status: 500 }
    );
  }
}