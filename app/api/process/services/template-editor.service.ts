import fs from 'fs';
import path from 'path';
import { ProcessorService } from './processor.service';
import { getRootDirTempTemplates } from '../lib/utils';

export class TemplateEditorService {
  /**
   * Actualiza el regex de un template guardado en temp y devuelve el resultado de procesar con el nuevo regex.
   */
  static async updateRegex(sessionId: string, version: number, newRegex: string, filePath: string): Promise<any> {
    const tempDir = getRootDirTempTemplates();
    const files = await fs.promises.readdir(tempDir);
    const fileName = files.find(f => f.startsWith(sessionId) && f.includes(`_v${version}.json`));

    if (!fileName) throw new Error('Template original no encontrado');

    const templatePath = path.join(tempDir, fileName);
    const template = JSON.parse(await fs.promises.readFile(templatePath, 'utf-8'));

    // Actualizar regex
    template.transaction_regex = newRegex;

    // Guardar nueva versión
    const nextVersion = version + 1;
    const newFileName = fileName.replace(`_v${version}`, `_v${nextVersion}`);
    const newPath = path.join(tempDir, newFileName);

    await fs.promises.writeFile(newPath, JSON.stringify({ ...template, version: nextVersion }, null, 2));

    // Probar inmediatamente
    const result = await ProcessorService.processWithTemplate(filePath, newPath);

    return {
      ...result,
      template_config: {
        ...template,
        fileName: newFileName
      },
      version: nextVersion
    };
  }

  /**
   * Agrega un patrón de ignora al template.
   */
  static async addIgnorePattern(sessionId: string, version: number, pattern: string): Promise<any> {
    const tempDir = getRootDirTempTemplates();
    const files = await fs.promises.readdir(tempDir);
    const fileName = files.find(f => f.startsWith(sessionId) && f.includes(`_v${version}.json`));

    if (!fileName) throw new Error('Template original no encontrado');

    const templatePath = path.join(tempDir, fileName);
    const template = JSON.parse(await fs.promises.readFile(templatePath, 'utf-8'));

    if (!template.rules) template.rules = {};
    if (!template.rules.ignore_patterns) template.rules.ignore_patterns = [];

    if (!template.rules.ignore_patterns.includes(pattern)) {
      template.rules.ignore_patterns.push(pattern);
    }

    // Guardar nueva versión
    const nextVersion = version + 1;
    const newFileName = fileName.replace(`_v${version}`, `_v${nextVersion}`);
    const newPath = path.join(tempDir, newFileName);

    await fs.promises.writeFile(newPath, JSON.stringify({ ...template, version: nextVersion }, null, 2));

    return { template, version: nextVersion, path: newPath };
  }

  /**
   * Agrega un patrón de signo positivo al template.
   */
  static async addPositivePattern(sessionId: string, version: number, pattern: string): Promise<any> {
    const tempDir = getRootDirTempTemplates();
    const files = await fs.promises.readdir(tempDir);
    const fileName = files.find(f => f.startsWith(sessionId) && f.includes(`_v${version}.json`));

    if (!fileName) throw new Error('Template original no encontrado');

    const templatePath = path.join(tempDir, fileName);
    const template = JSON.parse(await fs.promises.readFile(templatePath, 'utf-8'));

    if (!template.rules) template.rules = {};
    if (!template.rules.positive_patterns) template.rules.positive_patterns = [];

    if (!template.rules.positive_patterns.includes(pattern)) {
      template.rules.positive_patterns.push(pattern);
    }

    // Guardar nueva versión
    const nextVersion = version + 1;
    const newFileName = fileName.replace(`_v${version}`, `_v${nextVersion}`);
    const newPath = path.join(tempDir, newFileName);

    await fs.promises.writeFile(newPath, JSON.stringify({ ...template, version: nextVersion }, null, 2));

    return { template, version: nextVersion, path: newPath };
  }
}
