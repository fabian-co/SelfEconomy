import fs from 'fs';
import path from 'path';
import { getProcessedDir, getTempProcessedDir, getTempPreprocessedDir, getTempDir, getRootDirTemp } from '../lib/utils';

export class TransactionService {
  static async saveProcessedData(data: any, filePath: string, outputName?: string) {
    const fileName = outputName || path.basename(filePath, path.extname(filePath));
    const processedDir = getProcessedDir();
    const outputPath = path.join(processedDir, `${fileName}.json`);

    await fs.promises.mkdir(processedDir, { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));

    // Clear temp files after confirmed save
    await this.clearTempProcessedData();

    // Delete source file
    const sourcePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), 'app', 'api', 'extracto', filePath);
    try { await fs.promises.unlink(sourcePath); } catch (e) { }

    return outputPath;
  }

  static async saveTempProcessedData(data: any, filePath: string, outputName?: string) {
    const fileName = outputName || path.basename(filePath, path.extname(filePath));
    const tempDir = getTempProcessedDir();
    const outputPath = path.join(tempDir, `${fileName}.json`);

    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));

    return outputPath;
  }

  // --- VERSIONED METHODS ---

  static async saveTempProcessedDataVersioned(data: any, sessionId: string, version: number): Promise<string> {
    const tempDir = getTempProcessedDir();
    await fs.promises.mkdir(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `${sessionId}_v${version}.json`);
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify({ ...data, version }, null, 2));

    return outputPath;
  }

  static async getLatestTempProcessedData(sessionId: string): Promise<{ data: any; version: number; path: string } | null> {
    const tempDir = getTempProcessedDir();
    if (!fs.existsSync(tempDir)) return null;

    const files = await fs.promises.readdir(tempDir);
    const sessionFiles = files.filter(f => f.startsWith(sessionId) && f.includes('_v'));

    if (sessionFiles.length === 0) return null;

    // Find highest version
    let maxVersion = 0;
    let latestFile = '';
    for (const f of sessionFiles) {
      const match = f.match(/_v(\d+)\.json$/);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v > maxVersion) {
          maxVersion = v;
          latestFile = f;
        }
      }
    }

    if (!latestFile) return null;

    const fullPath = path.join(tempDir, latestFile);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return { data: JSON.parse(content), version: maxVersion, path: fullPath };
  }

  static async getTempProcessedDataByVersion(sessionId: string, version: number): Promise<{ data: any; version: number; path: string } | null> {
    const tempDir = getTempProcessedDir();
    const fileName = `${sessionId}_v${version}.json`;
    const fullPath = path.join(tempDir, fileName);

    if (!fs.existsSync(fullPath)) return null;

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return { data: JSON.parse(content), version, path: fullPath };
  }

  static async clearTempProcessedData() {
    const rootTempDir = getRootDirTemp();

    if (fs.existsSync(rootTempDir)) {
      const deleteRecursive = async (dirPath: string) => {
        const files = await fs.promises.readdir(dirPath);
        for (const f of files) {
          const fullPath = path.join(dirPath, f);
          const stats = await fs.promises.stat(fullPath);
          if (stats.isDirectory()) {
            await deleteRecursive(fullPath);
            try {
              await fs.promises.rmdir(fullPath);
            } catch (e) {
              console.warn(`Could not delete temp directory: ${fullPath}`, e);
            }
          } else {
            try {
              await fs.promises.unlink(fullPath);
            } catch (e) {
              console.warn(`Could not delete temp file: ${fullPath}`, e);
            }
          }
        }
      };

      await deleteRecursive(rootTempDir);
      console.log('[Cleanup] Root temp directory cleared');
    }
  }

  static calculateTotals(data: any, paymentKeywords: string[]) {
    let totalAbonos = 0;
    let totalCargos = 0;

    data.transacciones = data.transacciones.map((t: any) => {
      const isIgnored = (paymentKeywords || []).some((k: string) =>
        t.descripcion.toLowerCase().includes(k.toLowerCase())
      );

      // Calculate totals based on original value signs (don't mutate values)
      if (!isIgnored) {
        if (t.valor > 0) totalAbonos += t.valor;
        else totalCargos += Math.abs(t.valor);
      }

      return { ...t, ignored: isIgnored };
    });

    data.meta_info.resumen.total_abonos = totalAbonos;
    data.meta_info.resumen.total_cargos = totalCargos;
    data.meta_info.resumen.saldo_actual = totalAbonos - totalCargos;

    return data;
  }

  static async recalculateAndSave(filePath: string, outputName: string, paymentKeywords: string[], newBankName?: string) {
    const fileName = outputName || path.basename(filePath, path.extname(filePath));
    const jsonPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${fileName}.json`);

    const content = await fs.promises.readFile(jsonPath, 'utf-8');
    let data = JSON.parse(content);

    // Update bank name if provided
    if (newBankName) {
      data.meta_info.banco = newBankName;
    }

    const isBancolombia = data.meta_info.banco === 'Bancolombia';
    if (isBancolombia) data.meta_info.ignore_keywords = paymentKeywords;
    else data.meta_info.payment_keywords = paymentKeywords;

    data = this.calculateTotals(data, paymentKeywords);

    await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2));
    return data;
  }
}
