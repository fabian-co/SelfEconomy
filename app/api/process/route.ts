import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSourcePath, normalizeText, getTempPreprocessedDir } from './lib/utils';
import { TemplateService } from './services/template.service';
import { ProcessorService } from './services/processor.service';
import { TransactionService } from './services/transaction.service';
import { CleanupService } from './services/cleanup.service';
import { TemplateEditorService } from './services/template-editor.service';
import { TransactionEditorService } from './services/transaction-editor.service';

export async function POST(request: Request) {
  try {
    let body = await request.json();
    let {
      filePath, password, action, paymentKeywords,
      outputName, bank, accountType, data, templateFileName,
      feedbackMessage, previousTemplate, sessionId, bankName
    } = body;

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

    if (action === 'delete_template') {
      const { templateFileName } = body;
      await TemplateService.deleteTemplate(templateFileName);
      return NextResponse.json({ success: true, message: 'Template eliminado' });
    }

    if (action === 'rename_template') {
      const { templateFileName, newEntityName } = body;
      const newFileName = await TemplateService.renameTemplate(templateFileName, newEntityName);
      return NextResponse.json({ success: true, message: 'Template renombrado', newFileName });
    }

    if (action === 'update_template' && sessionId) {
      const { version, newRegex, tempTxtPath } = body;
      const result = await TemplateEditorService.updateRegex(sessionId, version, newRegex, tempTxtPath);
      return NextResponse.json(result);
    }

    if (action === 'update_transaction' && sessionId) {
      const { version, txId, updates } = body;
      await TransactionEditorService.updateTransaction(sessionId, version, txId, updates);
      return NextResponse.json({ success: true });
    }

    if (action === 'revert_version' && sessionId) {
      const { targetVersion } = body;
      console.log('[Revert] Request:', sessionId, targetVersion);
      const processedData = await TransactionService.getTempProcessedDataByVersion(sessionId, targetVersion);
      console.log('[Revert] Found data:', !!processedData);
      if (!processedData) {
        return NextResponse.json({ error: `Versión ${targetVersion} no encontrada` }, { status: 404 });
      }
      return NextResponse.json({ ...processedData.data, version: targetVersion });
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    const sourcePath = getSourcePath(filePath);
    const fileExt = path.extname(filePath).toLowerCase().replace('.', '');

    // -- Actions that don't require file content (skip decryption) --
    if (action === 'save_json') {
      await TransactionService.saveProcessedData(data, filePath, outputName);
      // Template logic disabled - save AI response directly
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

    // -- Action: AI Process with Template --
    if (action === 'ai_process_with_template' || action === 'ai_feedback') {
      try {
        let { text, tempTxtPath } = await ProcessorService.extractText(currentProcessPath, password, sessionId);
        const normalizedContent = normalizeText(text);

        let template;

        let cleanup_performed = false;
        if (action === 'ai_feedback') {
          // Read current temp JSON and template if exists to provide context to AI
          let currentTransactions = [];
          let templateToRefine = previousTemplate;
          let currentVersion = 1;

          if (sessionId) {
            const [latestTemplate, latestProcessed] = await Promise.all([
              TemplateService.getLatestTempTemplate(sessionId),
              TransactionService.getLatestTempProcessedData(sessionId)
            ]);

            if (latestTemplate) {
              templateToRefine = latestTemplate.template;
              currentVersion = latestTemplate.version;
              console.log(`[AI Feedback] Using latest template version: ${currentVersion}`);
            }
            if (latestProcessed) {
              currentTransactions = latestProcessed.data.transacciones || [];
            }
          }

          console.log('[AI Feedback] Refining state with surgical assistant...');

          const aiRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/refine-assistant`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              feedback: feedbackMessage,
              previousTemplate: templateToRefine,
              currentTransactions: currentTransactions.slice(0, 50) // Increased for better context
            }),
          });

          if (!aiRes.ok) throw new Error('Error en el asistente de refinamiento');
          const { toolCalls } = await aiRes.json();

          let activeTemplate = templateToRefine;
          let activeVersion = currentVersion;

          // Apply surgical tools
          for (const tc of (toolCalls || [])) {
            console.log(`[AI Feedback] Applying tool: ${tc.toolName}`, tc.args);

            // Skip if no args (AI might have issues)
            if (!tc.args) {
              console.warn(`[AI Feedback] Skipping ${tc.toolName} - no args provided`);
              continue;
            }

            if (tc.toolName === 'add_ignore_rule' && sessionId && tc.args.pattern) {
              const res = await TemplateEditorService.addIgnorePattern(sessionId, activeVersion, tc.args.pattern);
              activeTemplate = res.template;
              activeVersion = res.version;
            } else if (tc.toolName === 'add_flip_rule' && sessionId && tc.args.pattern) {
              const res = await TemplateEditorService.addPositivePattern(sessionId, activeVersion, tc.args.pattern);
              activeTemplate = res.template;
              activeVersion = res.version;
            } else if (tc.toolName === 'update_extraction_regex' && sessionId && tc.args.new_regex) {
              const res = await TemplateEditorService.updateRegex(sessionId, activeVersion, tc.args.new_regex, tempTxtPath);
              activeTemplate = res.template_config;
              activeVersion = res.version;
            } else if (tc.toolName === 'physical_cleanup' && tc.args.instruction) {
              await CleanupService.applyCleanup(tempTxtPath, tc.args.instruction);
              cleanup_performed = true;
            } else if (tc.toolName === 'edit_transaction' && sessionId && tc.args.tx_id) {
              await TransactionEditorService.updateTransaction(sessionId, activeVersion, tc.args.tx_id, tc.args.updates);
              activeVersion++;
            } else if (tc.toolName === 'delete_transaction' && sessionId && tc.args.tx_id) {
              await TransactionEditorService.updateTransaction(sessionId, activeVersion, tc.args.tx_id, null);
              activeVersion++;
            }
          }

          template = activeTemplate;
          // Update text if cleanup was performed
          if (cleanup_performed) {
            text = await fs.promises.readFile(tempTxtPath, 'utf-8');
          }

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

        // Use versioned methods if sessionId is provided
        let version = 1;
        let tempTemplatePath;

        if (sessionId) {
          const versionedResult = await TemplateService.saveTempTemplateVersioned(template, fileExt, sessionId);
          tempTemplatePath = versionedResult.path;
          version = versionedResult.version;
          console.log(`[Versioned] Saved template v${version} for session ${sessionId}`);
        } else {
          tempTemplatePath = await TemplateService.saveTempTemplate(template, fileExt);
        }

        console.log(`[Processor] Processing with template: ${tempTemplatePath}`);
        const result = await ProcessorService.processWithTemplate(tempTxtPath, tempTemplatePath);

        // Merge updated template into result so frontend state is synced
        const finalResult = {
          ...result,
          template_config: {
            ...template,
            fileName: path.basename(tempTemplatePath)
          },
          version,
          cleanup_performed
        };

        // Save versioned or regular temp JSON
        if (sessionId) {
          await TransactionService.saveTempProcessedDataVersioned(finalResult, sessionId, version);
        } else {
          await TransactionService.saveTempProcessedData(finalResult, filePath, outputName);
        }

        // Note: We no longer delete tempTxtPath here. It will be cleaned up by clearTempProcessedData on form close.
        return NextResponse.json(finalResult);

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

      const { text, tempTxtPath } = await ProcessorService.extractText(sourcePath, password, sessionId);
      const result = await ProcessorService.processWithTemplate(tempTxtPath, templatePath);

      const templateContent = JSON.parse(await fs.promises.readFile(templatePath, 'utf-8'));

      if (sessionId) {
        // Save versioned template (v1)
        const versionedTemplate = await TemplateService.saveTempTemplateVersioned(templateContent, fileExt, sessionId);
        const version = versionedTemplate.version;

        const finalResult = {
          ...result,
          template_config: {
            ...templateContent,
            fileName: path.basename(versionedTemplate.path)
          },
          version
        };

        // Save versioned processed JSON (v1)
        await TransactionService.saveTempProcessedDataVersioned(finalResult, sessionId, version);
        return NextResponse.json(finalResult);
      }

      return NextResponse.json(result);
    }

    // -- Action: AI Extract (Legacy check for match) --
    if (action === 'ai_extract') {
      const { text, tempTxtPath } = await ProcessorService.extractText(sourcePath, password, sessionId);
      const matchedTemplate = await TemplateService.matchExistingTemplate(normalizeText(text), fileExt);
      return NextResponse.json({ success: true, text, matchedTemplate });
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
