import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSourcePath, normalizeText, getTempPreprocessedDir } from './lib/utils';
import { ProcessorService } from './services/processor.service';
import { TransactionService } from './services/transaction.service';
import { TransactionEditorService } from './services/transaction-editor.service';

export async function POST(request: Request) {
  try {
    let body = await request.json();
    let {
      filePath, password, action, paymentKeywords,
      outputName, bank, accountType, data,
      sessionId, bankName
    } = body;

    if (action === 'update_transaction' && sessionId) {
      const { version, txId, updates } = body;
      await TransactionEditorService.updateTransaction(sessionId, version, txId, updates);
      return NextResponse.json({ success: true });
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    const sourcePath = getSourcePath(filePath);
    const fileExt = path.extname(filePath).toLowerCase().replace('.', '');

    // -- Actions that don't require file content (skip decryption) --
    if (action === 'save_json') {
      await TransactionService.saveProcessedData(data, filePath, outputName);
      return NextResponse.json({ success: true, message: 'Datos guardados' });
    }

    if (action === 'recalculate_json') {
      await TransactionService.recalculateAndSave(filePath, outputName, paymentKeywords, bankName);
      return NextResponse.json({ success: true, message: 'JSON recalculado' });
    }

    // -- Pre-processing for PDF (only for actions that need file content) --
    let currentProcessPath = sourcePath;
    if (fileExt === 'pdf') {
      const tempPdfPath = path.join(getTempPreprocessedDir(), `${path.basename(filePath)}`);
      try {
        currentProcessPath = await ProcessorService.decryptPdf(sourcePath, tempPdfPath, password);
      } catch (err: any) {
        if (err.message === 'PASSWORD_REQUIRED') return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 401 });
        throw err;
      }
    }

    // -- Action: AI Extract (Now only extracts text) --
    if (action === 'ai_extract') {
      try {
        const { text } = await ProcessorService.extractText(sourcePath, password, sessionId);
        return NextResponse.json({ success: true, text });
      } catch (err: any) {
        if (err.message === 'PASSWORD_REQUIRED') return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 401 });
        throw err;
      }
    }

    // -- Default / Legacy Actions (Analyze, Process) --
    const bankId = bank || (filePath.toLowerCase().includes('nu') ? 'nu' : 'bancolombia');
    const accId = accountType || (filePath.toLowerCase().includes('credit') ? 'credit' : 'debit');
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${outputName || fileName}.json`);

    await ProcessorService.runLegacyScript(bankId, accId, currentProcessPath, outputPath, { password, analyze: action === 'analyze', paymentKeywords });

    if (action === 'analyze') {
      const analyzeContent = await fs.promises.readFile(outputPath, 'utf-8');
      return NextResponse.json({ success: true, data: JSON.parse(analyzeContent) });
    }

    return NextResponse.json({ success: true, message: 'Procesado correctamente' });

  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
