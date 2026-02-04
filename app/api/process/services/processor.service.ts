import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getPythonPath, getScriptPath, getTempDir } from '../lib/utils';

const execAsync = promisify(exec);

export class ProcessorService {
  static async extractText(sourcePath: string, password?: string, sessionId?: string) {
    const prefix = sessionId ? `session_${sessionId}_` : '';
    const tempTxtPath = path.join(getTempDir(), `${prefix}${path.basename(sourcePath)}.txt`);
    await fs.promises.mkdir(path.dirname(tempTxtPath), { recursive: true });

    let cmd = `"${getPythonPath()}" "${getScriptPath('extract_text.py')}" --input "${sourcePath}" --output "${tempTxtPath}"`;
    if (password) cmd += ` --password "${password}"`;

    try {
      await execAsync(cmd);
      const text = await fs.promises.readFile(tempTxtPath, 'utf-8');
      return { text, tempTxtPath };
    } catch (err: any) {
      if (err.code === 10 || (err.stderr && err.stderr.includes("PASSWORD_REQUIRED"))) {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw err;
    }
  }

  static async processWithTemplate(textPath: string, templatePath: string) {
    const cmd = `"${getPythonPath()}" "${getScriptPath('template_processor.py')}" --text "${textPath}" --template "${templatePath}"`;
    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout);
    if (result.error) throw new Error(result.error);
    return result;
  }

  static async runLegacyScript(bank: string, accountType: string, sourcePath: string, outputPath: string, options: { password?: string, analyze?: boolean, paymentKeywords?: string[] }) {
    let scriptName = bank === 'nu' ? 'nu.py' : 'bancolombia.py';
    let cmd = `"${getPythonPath()}" "${getScriptPath(scriptName)}" --input "${sourcePath}" --output "${outputPath}" --account-type "${accountType}"`;

    if (options.password && bank === 'nu') cmd += ` --password "${options.password}"`;
    if (options.analyze) cmd += ' --analyze';

    if (options.paymentKeywords && options.paymentKeywords.length > 0) {
      const keywordsStr = options.paymentKeywords.map(k => `"${k}"`).join(' ');
      cmd += bank === 'nu' ? ` --payment-keywords ${keywordsStr}` : ` --ignore-keywords ${keywordsStr}`;
    }

    const { stdout, stderr } = await execAsync(cmd);

    if (stderr && !stdout.includes('Éxito') && !stdout.includes('Measure-Command')) {
      if (!stdout.includes('Éxito') && !options.analyze) {
        throw new Error(stderr);
      }
    }
    return stdout;
  }

  static async decryptPdf(sourcePath: string, outputPath: string, password?: string) {
    let cmd = `"${getPythonPath()}" "${getScriptPath('decrypt_pdf.py')}" --input "${sourcePath}" --output "${outputPath}"`;
    if (password) cmd += ` --password "${password}"`;

    try {
      await execAsync(cmd);
      return outputPath;
    } catch (err: any) {
      if (err.code === 10 || (err.stderr && err.stderr.includes("PASSWORD_REQUIRED"))) {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw err;
    }
  }
}
