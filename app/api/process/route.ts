import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSourcePath, normalizeText } from './lib/utils';
import { TemplateService } from './services/template.service';
import { ProcessorService } from './services/processor.service';
import { TransactionService } from './services/transaction.service';

export async function POST(request: Request) {
  try {
    let {
      filePath, password, action, paymentKeywords,
      outputName, bank, accountType, data, templateFileName
    } = await request.json();

    // -- Actions without filePath requirement --
    if (action === 'get_templates') {
      const templates = await TemplateService.getAllTemplates();
      return NextResponse.json({ templates });
    }

    if (action === 'clear_temp') {
      await TemplateService.clearTempTemplates();
      await TransactionService.clearTempProcessedData();
      return NextResponse.json({ success: true, message: 'Carpetas temp limpiadas' });
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    const sourcePath = getSourcePath(filePath);
    const fileExt = path.extname(filePath).toLowerCase().replace('.', '');

    // -- Action: AI Process with Template --
    if (action === 'ai_process_with_template' || action === 'ai_feedback') {
      try {
        const { text, tempTxtPath } = await ProcessorService.extractText(sourcePath, password);
        const normalizedContent = normalizeText(text);

        let template;

        if (action === 'ai_feedback') {
          const { feedbackMessage, previousTemplate } = await request.json();
          console.log('[AI Feedback] Refining template with user message...');
          const aiRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/generate-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              fileExtension: fileExt,
              feedback: feedbackMessage,
              previousTemplate
            }),
          });

          if (!aiRes.ok) throw new Error('Error refinando template con IA');
          const aiResult = await aiRes.json();
          template = aiResult.template;
        } else {
          template = await TemplateService.matchExistingTemplate(normalizedContent, fileExt);

          if (!template) {
            console.log('[AI Template] No match. Generating with AI...');
            const aiRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/generate-template`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, fileExtension: fileExt }),
            });

            if (!aiRes.ok) throw new Error('Error generando template con IA');
            const aiResult = await aiRes.json();
            template = aiResult.template;
          }
        }

        const tempTemplatePath = await TemplateService.saveTempTemplate(template, fileExt);
        const result = await ProcessorService.processWithTemplate(tempTxtPath, tempTemplatePath);

        // Save temporary JSON
        await TransactionService.saveTempProcessedData(result, filePath, outputName);

        await fs.promises.unlink(tempTxtPath);
        return NextResponse.json(result);

      } catch (err: any) {
        if (err.message === 'PASSWORD_REQUIRED') return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 401 });
        throw err;
      }
    }

    // -- Action: Use Template --
    if (action === 'use_template') {
      const templatesDir = path.join(process.cwd(), 'custom-data', 'templates');
      const templatePath = templateFileName
        ? path.join(templatesDir, templateFileName)
        : path.join(templatesDir, `${bank}_${accountType}_${fileExt}.json`);

      if (!fs.existsSync(templatePath)) return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });

      const { text, tempTxtPath } = await ProcessorService.extractText(sourcePath, password);
      const result = await ProcessorService.processWithTemplate(tempTxtPath, templatePath);
      await fs.promises.unlink(tempTxtPath);
      return NextResponse.json(result);
    }

    // -- Action: AI Extract (Legacy check for match) --
    if (action === 'ai_extract') {
      const { text, tempTxtPath } = await ProcessorService.extractText(sourcePath, password);
      await fs.promises.unlink(tempTxtPath);
      const matchedTemplate = await TemplateService.matchExistingTemplate(normalizeText(text), fileExt);
      return NextResponse.json({ success: true, text, matchedTemplate });
    }

    // -- Action: Save JSON & Template --
    if (action === 'save_json') {
      await TransactionService.saveProcessedData(data, filePath, outputName);
      if (data.template_config) {
        await TemplateService.saveTemplate(data.template_config, fileExt);
      }
      return NextResponse.json({ success: true, message: 'Datos y template guardados' });
    }

    // -- Action: Recalculate JSON --
    if (action === 'recalculate_json') {
      await TransactionService.recalculateAndSave(filePath, outputName, paymentKeywords);
      return NextResponse.json({ success: true, message: 'JSON recalculado' });
    }

    // -- Default / Legacy Actions (Analyze, Process) --
    const bankId = bank || (filePath.toLowerCase().includes('nu') ? 'nu' : 'bancolombia');
    const accId = accountType || (filePath.toLowerCase().includes('credit') ? 'credit' : 'debit');
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${outputName || fileName}.json`);

    await ProcessorService.runLegacyScript(bankId, accId, sourcePath, outputPath, { password, analyze: action === 'analyze', paymentKeywords });

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
