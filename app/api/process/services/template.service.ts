import fs from 'fs';
import path from 'path';
import { getTemplatesDir, getTempTemplatesDir, normalizeText } from '../lib/utils';

export class TemplateService {
  static async getAllTemplates() {
    const dir = getTemplatesDir();
    if (!fs.existsSync(dir)) return [];

    const files = await fs.promises.readdir(dir);
    const templates = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async f => {
        const content = await fs.promises.readFile(path.join(dir, f), 'utf-8');
        return JSON.parse(content);
      })
    );
    return templates;
  }

  static async clearTempTemplates() {
    const tempDir = getTempTemplatesDir();
    if (fs.existsSync(tempDir)) {
      const files = await fs.promises.readdir(tempDir);
      for (const f of files) {
        try {
          await fs.promises.unlink(path.join(tempDir, f));
        } catch (e) {
          console.warn(`Could not delete temp template file: ${f}`, e);
        }
      }
    }
  }

  static async saveTemplate(templateConfig: any, fileExtension: string) {
    const dir = getTemplatesDir();
    const entityKey = templateConfig.entity.toLowerCase().replace(/\s+/g, '_');
    const accKey = templateConfig.account_type.toLowerCase();
    const fileType = templateConfig.file_types?.[0] || fileExtension || 'generic';
    const finalFileName = `${entityKey}_${accKey}_${fileType}.json`;
    const templatePath = path.join(dir, finalFileName);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(templatePath, JSON.stringify({
      ...templateConfig,
      fileName: finalFileName
    }, null, 2));

    await this.clearTempTemplates();
    return finalFileName;
  }

  static async saveTempTemplate(template: any, fileExt: string) {
    const tempDir = getTempTemplatesDir();
    await fs.promises.mkdir(tempDir, { recursive: true });

    const entityKey = template.entity.toLowerCase().replace(/\s+/g, '_');
    const accKey = template.account_type.toLowerCase();
    const finalFileName = `${entityKey}_${accKey}_${fileExt}.json`;
    const tempTemplatePath = path.join(tempDir, finalFileName);

    await fs.promises.writeFile(tempTemplatePath, JSON.stringify(template, null, 2));
    return tempTemplatePath;
  }

  static async matchExistingTemplate(normalizedContent: string, fileExt: string) {
    const dir = getTemplatesDir();
    if (!fs.existsSync(dir)) return null;

    const files = await fs.promises.readdir(dir);
    for (const f of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await fs.promises.readFile(path.join(dir, f), 'utf-8');
        const tmp = JSON.parse(content);

        if (tmp.file_types && !tmp.file_types.includes(fileExt)) continue;
        if (!tmp.signature_keywords || tmp.signature_keywords.length === 0) continue;

        const matchedKeywords = tmp.signature_keywords.filter((k: string) =>
          normalizedContent.includes(normalizeText(k))
        );

        const matchesCount = matchedKeywords.length;
        const matchPercentage = (matchesCount / tmp.signature_keywords.length) * 100;

        if (matchPercentage >= 75 || (tmp.signature_keywords.length <= 3 && matchesCount >= 2)) {
          return { ...tmp, fileName: f };
        }
      } catch (err) {
        console.error(`[TemplateService] Error matching ${f}:`, err);
      }
    }
    return null;
  }
}
