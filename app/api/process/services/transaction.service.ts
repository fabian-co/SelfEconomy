import fs from 'fs';
import path from 'path';

export class TransactionService {
  static async saveProcessedData(data: any, filePath: string, outputName?: string) {
    const fileName = outputName || path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${fileName}.json`);

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(data, null, 2));

    // Delete source file
    const sourcePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), 'app', 'api', 'extracto', filePath);
    try { await fs.promises.unlink(sourcePath); } catch (e) { }

    return outputPath;
  }

  static calculateTotals(data: any, paymentKeywords: string[]) {
    const isBancolombia = data.meta_info.banco === 'Bancolombia';
    let totalAbonos = 0;
    let totalCargos = 0;

    data.transacciones = data.transacciones.map((t: any) => {
      const isIgnored = (paymentKeywords || []).some((k: string) =>
        t.descripcion.toLowerCase().includes(k.toLowerCase())
      );

      if (isBancolombia) {
        if (!isIgnored) {
          if (t.valor > 0) totalAbonos += t.valor;
          else totalCargos += Math.abs(t.valor);
        }
        return { ...t, ignored: isIgnored };
      } else {
        const absVal = Math.abs(t.valor);
        const newVal = isIgnored ? absVal : -absVal;
        if (!isIgnored) {
          if (newVal > 0) totalAbonos += newVal;
          else totalCargos += Math.abs(newVal);
        }
        return { ...t, valor: newVal, ignored: isIgnored };
      }
    });

    data.meta_info.resumen.total_abonos = totalAbonos;
    data.meta_info.resumen.total_cargos = totalCargos;

    if (isBancolombia) {
      const saldoAnterior = data.meta_info.resumen.saldo_anterior || 0;
      data.meta_info.resumen.saldo_actual = saldoAnterior + totalAbonos - totalCargos;
    } else {
      data.meta_info.resumen.saldo_actual = totalAbonos - totalCargos;
    }

    return data;
  }

  static async recalculateAndSave(filePath: string, outputName: string, paymentKeywords: string[]) {
    const fileName = outputName || path.basename(filePath, path.extname(filePath));
    const jsonPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${fileName}.json`);

    const content = await fs.promises.readFile(jsonPath, 'utf-8');
    let data = JSON.parse(content);

    const isBancolombia = data.meta_info.banco === 'Bancolombia';
    if (isBancolombia) data.meta_info.ignore_keywords = paymentKeywords;
    else data.meta_info.payment_keywords = paymentKeywords;

    data = this.calculateTotals(data, paymentKeywords);

    await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2));
    return data;
  }
}
