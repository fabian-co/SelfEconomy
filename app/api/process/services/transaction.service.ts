import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getProcessedDir, getTempProcessedDir, getTempPreprocessedDir, getTempDir, getRootDirTemp } from '../lib/utils';

export class TransactionService {
  static async saveProcessedData(data: any, filePath: string, outputName?: string) {
    const processedDir = getProcessedDir();

    // Get bank name from data or use 'other'
    const bankName = data.meta_info?.banco || 'other';
    // Normalize helper: simplified alphanumeric lowercased
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNormalized = normalize(bankName);

    let targetFolderName = bankName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Check for existing matching folder
    try {
      const entries = await fs.promises.readdir(processedDir, { withFileTypes: true });
      const existingFolders = entries.filter(e => e.isDirectory()).map(e => e.name);

      const match = existingFolders.find(folder => normalize(folder) === targetNormalized);
      if (match) {
        targetFolderName = match;
      }
    } catch (e) {
      // If error reading directory, proceed with default targetFolderName
    }

    // Create bank subfolder
    const bankFolder = path.join(processedDir, targetFolderName);
    await fs.promises.mkdir(bankFolder, { recursive: true });

    // Get next numbered filename
    const numberedName = await this.getNextNumberedName(bankFolder, targetFolderName);
    const outputPath = path.join(bankFolder, `${numberedName}.json`);

    // Add UUID to each transaction if not already present
    if (data.transacciones) {
      data.transacciones = data.transacciones.map((tx: any) => ({
        ...tx,
        id: tx.id || randomUUID()
      }));
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));

    // Clear temp files after confirmed save
    await this.clearTempProcessedData();

    // Delete source file
    const sourcePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), 'app', 'api', 'extracto', filePath);
    try { await fs.promises.unlink(sourcePath); } catch (e) { }

    return outputPath;
  }

  static async getNextNumberedName(bankFolder: string, baseName: string): Promise<string> {
    try {
      const files = await fs.promises.readdir(bankFolder);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return `${baseName}-01`;
      }

      // Find highest number
      let maxNum = 0;
      for (const f of jsonFiles) {
        const match = f.match(/-(\d+)\.json$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const nextNum = maxNum + 1;
      return `${baseName}-${String(nextNum).padStart(2, '0')}`;
    } catch (e) {
      return `${baseName}-01`;
    }
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

  static async updateTransactionSign(params: {
    transactionId: string;
    isPositive: boolean;
    applyGlobally?: boolean;
    bankName: string;
    description?: string;
  }) {
    const { transactionId, isPositive, applyGlobally, bankName, description } = params;
    const processedDir = getProcessedDir();

    // Normalize bank folder name to find the correct directory
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNormalized = normalize(bankName);

    let targetFolder = path.join(processedDir); // Default to root if not found (legacy)
    let isBankFolder = false;

    try {
      const entries = await fs.promises.readdir(processedDir, { withFileTypes: true });
      const bankDir = entries.find(e => e.isDirectory() && normalize(e.name) === targetNormalized);
      if (bankDir) {
        targetFolder = path.join(processedDir, bankDir.name);
        isBankFolder = true;
      }
    } catch (e) {
      console.warn("Could not read processed directory", e);
    }

    // Helper to process a single file
    const processFileCtx = async (filePath: string) => {
      let modified = false;
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      let updatedCount = 0;

      if (data.transacciones) {
        data.transacciones = data.transacciones.map((tx: any, index: number) => {
          // Generate an ID if missing (legacy support)
          const currentId = tx.id || `${tx.fecha}-${tx.descripcion}-${tx.valor}-${index}`;

          let match = false;
          if (applyGlobally && description) {
            // Check if description matches (allowing for some fuzzy logic if needed, but strict for now or includes)
            // The user asked for "same description".
            match = tx.descripcion === description || tx.originalDescription === description;
          } else {
            match = currentId === transactionId;
          }

          if (match) {
            const currentVal = Math.abs(tx.valor);
            const newVal = isPositive ? currentVal : -currentVal;

            if (tx.valor !== newVal) {
              modified = true;
              updatedCount++;
              return {
                ...tx,
                valor: newVal,
                id: currentId,
                isMarkedPositive: isPositive,
                isPositiveGlobal: applyGlobally && description ? true : (tx.isPositiveGlobal || false)
              };
            }
          }
          return { ...tx, id: currentId };
        });
      }

      if (modified) {
        // Recalculate totals for this file
        // We reuse logic from calculateTotals but we need to ensure we don't double-apply ignore logic if it was already applied
        // But calculateTotals is safe to re-run
        const paymentKeywords = data.meta_info?.payment_keywords || data.meta_info?.ignore_keywords || [];
        const recalculated = this.calculateTotals(data, paymentKeywords);
        await fs.promises.writeFile(filePath, JSON.stringify(recalculated, null, 2));
      }
      return updatedCount;
    };

    let totalUpdated = 0;

    if (isBankFolder) {
      // It's a folder, read all JSONs
      const files = await fs.promises.readdir(targetFolder);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        totalUpdated += await processFileCtx(path.join(targetFolder, file));
      }
    } else {
      // It might be in the root if not found in a subfolder, OR we need to search the root too?
      // For now, assume if bankName was provided and found, we only search there.
      // If bankName didn't resolve to a folder, maybe it's a legacy file in the root?
      // Let's search the root for files that might match or just all files if applyGlobally is true?
      // Safer to just search where we expect it.

      // Fallback: search all files in processedDir (root) that are JSON
      const files = await fs.promises.readdir(processedDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && fs.statSync(path.join(processedDir, f)).isFile());

      for (const file of jsonFiles) {
        const content = await fs.promises.readFile(path.join(processedDir, file), 'utf-8');
        const data = JSON.parse(content);
        // Only process if bank matches
        if (normalize(data.meta_info?.banco || '') === targetNormalized) {
          totalUpdated += await processFileCtx(path.join(processedDir, file));
        }
      }
    }

    return { totalUpdated };
  }
}
