import { google } from '@ai-sdk/google';
import { generateObject, generateText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;

const categorizeSchema = z.object({
  groups: z.array(z.object({
    groupName: z.string().describe("Nombre descriptivo del grupo de transacciones (ej: 'Uber', 'Pagos de Netflix')"),
    transactionIds: z.array(z.string()).describe("IDs de las transacciones que pertenecen a este grupo"),
    suggestedCategory: z.string().describe("Nombre de la categoría sugerida. Debe coincidir con una existente si es posible."),
    suggestedCategoryId: z.string().optional().describe("ID de la categoría existente, si se encontró coincidencia."),
    confidence: z.number().describe("Nivel de confianza de 0 a 1"),
    reason: z.string().describe("Breve explicación de por qué se agruparon y categorizaron así"),
    isNewCategory: z.boolean().describe("True si la categoría sugerida NO existe en la lista proporcionada")
  }))
});

export async function POST(req: Request) {
  try {
    const { transactions, categories } = await req.json();

    console.log('[AI Categorize] Request received. Txs:', transactions?.length, 'Categories:', categories?.length);

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      console.log('[AI Categorize] No transactions provided.');
      return NextResponse.json({ groups: [] });
    }

    // Format transaction list for prompt
    const txPrompt = transactions.map((t: any) =>
      `- ID: ${t.id} | Desc: "${t.originalDescription || t.descripcion}" | Valor: ${t.valor}`
    ).join('\n');

    const catPrompt = categories.map((c: any) => `- ${c.name}`).join('\n');

    const systemPrompt = `Eres un experto en finanzas personales. Tu tarea es agrupar transacciones bancarias y asignarles una categoría.
    
    INSTRUCCIONES:
    1. Agrupa las transacciones que sean del mismo comercio o tipo de gasto.
    2. Para cada grupo, asigna una categoría de la lista proporcionada.
    3. Si absolutamente NINGUNA categoría encaja, sugiere una nueva (isNewCategory: true).
    4. Responde ÚNICAMENTE con un JSON válido que siga este estricto formato:
    
    {
      "groups": [
        {
          "groupName": "Descripción del grupo (ej: Uber)",
          "transactionIds": ["id1", "id2"],
          "suggestedCategory": "Transporte",
          "confidence": 0.9,
          "reason": "Patrón 'Uber' detectado",
          "isNewCategory": false
        }
      ]
    }`;

    console.log('[AI Categorize] Sending prompt to AI...');

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt: `Categorías Existentes:\n${catPrompt}\n\nTransacciones a clasificar:\n${txPrompt}`,
    });

    console.log('[AI Categorize] AI Response received:', text.substring(0, 100) + '...');

    // Clean markdown code blocks if present
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      console.error('[AI Categorize] JSON Parse Error:', e);
      console.error('[AI Categorize] Raw text:', text);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Error in AI categorize:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
