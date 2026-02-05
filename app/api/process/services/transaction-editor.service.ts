import fs from 'fs';
import path from 'path';
import { getRootDirTempProcessed } from '../lib/utils';
import { TransactionService } from './transaction.service';

export class TransactionEditorService {
  /**
   * Modifica o elimina una transacción específica dentro de un archivo procesado de sesión.
   */
  static async updateTransaction(sessionId: string, version: number, txId: string, updates: any | null): Promise<string> {
    const tempDir = getRootDirTempProcessed();
    const fileName = `${sessionId}_v${version}.json`;
    const fullPath = path.join(tempDir, fileName);

    if (!fs.existsSync(fullPath)) throw new Error('Archivo procesado no encontrado');

    const data = JSON.parse(await fs.promises.readFile(fullPath, 'utf-8'));

    if (updates === null) {
      // Eliminar
      data.transacciones = data.transacciones.filter((t: any) => t.id !== txId);
    } else {
      // Actualizar
      data.transacciones = data.transacciones.map((t: any) =>
        t.id === txId ? { ...t, ...updates } : t
      );
    }

    // Guardar nueva versión
    const nextVersion = version + 1;
    return await TransactionService.saveTempProcessedDataVersioned(data, sessionId, nextVersion);
  }
}
