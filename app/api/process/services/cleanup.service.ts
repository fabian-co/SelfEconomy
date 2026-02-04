import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPythonPath } from '../lib/utils';

const execAsync = promisify(exec);

export class CleanupService {
  /**
   * Determina si el mensaje del usuario indica una intención de eliminar o filtrar contenido.
   */
  static shouldCleanup(message: string): boolean {
    const keywords = [
      'elimina', 'borra', 'quita', 'omite', 'ignora', 'limpia',
      'remove', 'delete', 'clear', 'exclude', 'sin las lineas',
      'no quiero las', 'no incluyas'
    ];
    const msg = message.toLowerCase();
    return keywords.some(k => msg.includes(k));
  }

  /**
   * Aplica la limpieza al archivo TXT usando IA.
   */
  static async applyCleanup(txtPath: string, instruction: string) {
    console.log(`[CleanupService] Planning cleanup for: ${instruction}`);

    // 1. Obtener muestra del texto
    const textSample = await fs.promises.readFile(txtPath, 'utf-8');

    // 2. Llamar a la IA para generar el script
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/clean-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: instruction, textSample: textSample.substring(0, 5000) }),
    });

    if (!response.ok) throw new Error('Error al generar el script de limpieza con IA');
    const { pythonCode } = await response.json();

    // 3. Guardar script temporal
    const tempScriptPath = path.join(path.dirname(txtPath), `cleaner_${Date.now()}.py`);
    const inputPath = txtPath;
    const outputPath = path.join(path.dirname(txtPath), `cleaned_${path.basename(txtPath)}`);

    // Modificamos el código para que apunte a las rutas absolutas reales
    const finalCode = pythonCode
      .replace("'input.txt'", `r'${inputPath}'`)
      .replace("'output.txt'", `r'${outputPath}'`);

    await fs.promises.writeFile(tempScriptPath, finalCode, 'utf-8');

    // 4. Ejecutar script
    try {
      console.log(`[CleanupService] Executing cleaner script: ${tempScriptPath}`);
      await execAsync(`"${getPythonPath()}" "${tempScriptPath}"`);

      // 5. Reemplazar original con el limpio
      if (fs.existsSync(outputPath)) {
        await fs.promises.copyFile(outputPath, txtPath);
        await fs.promises.unlink(outputPath);
      }
    } catch (err: any) {
      console.error('[CleanupService] Error executing cleanup script:', err);
      throw new Error(`Error ejecutando limpieza: ${err.message}`);
    } finally {
      // Limpiar script temporal
      if (fs.existsSync(tempScriptPath)) {
        await fs.promises.unlink(tempScriptPath);
      }
    }
  }
}
