import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { feedback, textSample } = await req.json();

    const prompt = `
Eres un experto en procesamiento de texto con Python.
Tu tarea es generar un script de Python que limpie un archivo de texto según las instrucciones del usuario.

INSTRUCCIONES DEL USUARIO: "${feedback}"

FORMATO DEL ARCHIVO:
El archivo tiene secciones como [ESTRUCTURA_TABULAR...] y [TEXTO_RAW...].
Debes procesar TODO el archivo, pero enfócate en cumplir lo que el usuario pide. Generalmente querrán eliminar líneas que contienen ciertos patrones o frases.

REQUISITOS DEL SCRIPT:
1. El script lee de un archivo 'input.txt' y escribe en 'output.txt'.
2. Usa solo librerías estándar (re, sys, os).
3. Debe ser robusto: si una línea no coincide con el criterio de eliminación, debe conservarse EXACTAMENTE igual (con sus espacios).
4. El script debe ser una solución completa y ejecutable.
5. No incluyas explicaciones, solo el código Python.

EJEMPLO DE ESTRUCTURA DEL SCRIPT:
\`\`\`python
import re
import sys

def clean():
    try:
        with open('input.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        cleaned_lines = []
        for line in lines:
            # Lógica de filtrado basada en la instrucción: "${feedback}"
            if not re.search(r'...', line, re.I):
                cleaned_lines.append(line)
        
        with open('output.txt', 'w', encoding='utf-8') as f:
            f.writelines(cleaned_lines)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    clean()
\`\`\`

TEXTO DE MUESTRA (Primeros 2000 caracteres):
${textSample.substring(0, 2000)}
`;

    const { text: pythonCode } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: prompt,
    });

    // Extract code block if AI included backticks
    const cleanCode = pythonCode.replace(/```python|```/g, '').trim();

    return NextResponse.json({ pythonCode: cleanCode });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
