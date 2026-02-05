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
1. **COLUMNAS:** Solo nos interesan 3 datos: **fecha**, **descripcion** y **valor**.
   - 🚨 **IMPORTANTE:** Si existe una columna llamada "saldo" (o balance/acumulado), debés **IGNORARLA COMPLETAMENTE**.
2. **ANCLAJE:**
   - 🚫 **PROHIBIDO:** Usar \`^\` y \`$\` a menos que estés absolutamente seguro de capturar la línea ENTERA. Los extractos suelen tener ruido invisible al inicio/final.
   - ✅ **RECOMENDACIÓN:** Usa anclas de contenido como el signo de moneda ($) o el patrón de fecha.
3. **DESCRIPCIONES Y VALORES MÚLTIPLES:**
   - 🚨 **CASO CRÍTICO:** Si una línea tiene varios montos con $ (ej: "Railway $3.333,84 $360,05 $76.678"), identifica cuál es el "Valor" real (usualmente el primero después de la descripción).
   - 🚫 **PROHIBIDO:** Usar patterns que consuman todo hasta el final de la línea o que usen Lookahead codicioso si hay varios $.
   - ✅ **ESTRATEGIA:** Usa \`((?:(?!\\s+\\$).)+?)\` para la descripción y asegúrate de capturar el primer monto inmediatamente después, dejando el resto sin capturar.
4. **ESPACIOS:** Usa siempre \`\\s+\` o \`\\s{2,}\` para saltar entre columnas.
5. **LÓGICA DE SIGNOS:**
   - Tarjetas de CRÉDITO = Compras son negativas por defecto. Abonos/Pagos son positivos.

💡 TIP DE EXTRACCIÓN: 
Usa la sección [ESTRUCTURA_TABULAR_CON_DESCRIPCIONES_COMPLETAS]. 
- **SEPARADOR:** Los datos están separados por 5 o más espacios (\`\\s{5,}\`).

VALIDACIÓN:
En el campo 'validation', demuestra que tu regex funciona extrayendo 3 líneas del texto de abajo, asegurándote de capturar solo fecha, descripción y valor, ignorando el saldo.
`;

    // --- INYECCIÓN DE FEEDBACK (Lógica de Iteración) ---
    if (feedback && previousTemplate) {
      prompt += `
\n🚨 ALERTA: MODO DE CORRECCIÓN (FEEDBACK DE USUARIO) 🚨
El usuario ha rechazado el template anterior.
REGEX FALLIDO: "${previousTemplate.transaction_regex}"

FEEDBACK DEL USUARIO: "${feedback}"

INSTRUCCIONES PARA LA CORRECCIÓN:
1. AJUSTA el regex para que no corte las descripciones. Si un usuario reporta que faltan datos, es probable que tu delimitador ($ o espacios) esté mal posicionado.
2. REVISA la lógica de signos. Si el extracto es de crédito, verifica que las compras se resten y los pagos se sumen.
3. Si el usuario pide "quitar" algo, puedes agregarlo a 'ignore_patterns' en lugar de intentar borrarlo físicamente del archivo, a menos que sea ruido masivo.
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
      model: google('gemini-2.5-flash'), // Este modelo es excelente para esto
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