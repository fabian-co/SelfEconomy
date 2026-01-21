import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    let { filePath, password, action, paymentKeywords, outputName, bank, accountType, data } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    // Absolute path to the source file
    const sourcePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), 'app', 'api', 'extracto', filePath);

    // Detect bank and account type based on path if not provided
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

    if (!bank) {
      bank = 'other';
      if (normalizedPath.includes('nu')) {
        bank = 'nu';
      } else if (normalizedPath.includes('bancolombia')) {
        bank = 'bancolombia';
      }
    }

    if (!accountType) {
      accountType = 'debit';
      if (normalizedPath.includes('credit')) {
        accountType = 'credit';
      }
    }

    let scriptName = 'bancolombia.py';
    if (bank === 'nu') {
      scriptName = 'nu.py';
    } else if (bank === 'bancolombia') {
      scriptName = 'bancolombia.py';
    }

    // Script path
    const scriptPath = path.join(process.cwd(), 'app', 'api', 'py', scriptName);
    const extractScriptPath = path.join(process.cwd(), 'app', 'api', 'py', 'extract_text.py');
    const pythonPath = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');

    const templatesDir = path.join(process.cwd(), 'custom-data', 'templates');

    // Action: Get Templates
    if (action === 'get_templates') {
      if (!fs.existsSync(templatesDir)) return NextResponse.json({ templates: [] });
      const files = await fs.promises.readdir(templatesDir);
      const templates = await Promise.all(
        files.filter(f => f.endsWith('.json')).map(async f => {
          const content = await fs.promises.readFile(path.join(templatesDir, f), 'utf-8');
          return JSON.parse(content);
        })
      );
      return NextResponse.json({ templates });
    }

    // Action: Use Template
    if (action === 'use_template') {
      const templateFileName = `${bank}_${accountType}`.toLowerCase().replace(/\s+/g, '_') + '.json';
      const templatePath = path.join(templatesDir, templateFileName);

      if (!fs.existsSync(templatePath)) {
        return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
      }

      // We need the text content first
      const tempTxtPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'temp', `${path.basename(filePath)}.txt`);
      await fs.promises.mkdir(path.dirname(tempTxtPath), { recursive: true });

      let extractCmd = `"${pythonPath}" "${extractScriptPath}" --input "${sourcePath}" --output "${tempTxtPath}"`;
      if (password) extractCmd += ` --password "${password}"`;

      try {
        await execAsync(extractCmd);
        const processorScriptPath = path.join(process.cwd(), 'app', 'api', 'py', 'template_processor.py');
        const processCmd = `"${pythonPath}" "${processorScriptPath}" --text "${tempTxtPath}" --template "${templatePath}"`;

        const { stdout } = await execAsync(processCmd);
        await fs.promises.unlink(tempTxtPath);

        const result = JSON.parse(stdout);
        if (result.error) throw new Error(result.error);

        return NextResponse.json(result);
      } catch (err: any) {
        return NextResponse.json({ error: `Error procesando con template: ${err.message}` }, { status: 500 });
      }
    }

    // Action: AI Extract (New AI flow)
    if (action === 'ai_extract') {
      const tempTxtPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'temp', `${path.basename(filePath)}.txt`);
      await fs.promises.mkdir(path.dirname(tempTxtPath), { recursive: true });

      let extractCmd = `"${pythonPath}" "${extractScriptPath}" --input "${sourcePath}" --output "${tempTxtPath}"`;
      if (password) extractCmd += ` --password "${password}"`;

      try {
        await execAsync(extractCmd);
        const textContent = await fs.promises.readFile(tempTxtPath, 'utf-8');
        // Deleting temp file
        await fs.promises.unlink(tempTxtPath);

        const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
        const normalizedContent = normalize(textContent);

        // EXTRA: Check if a template MATCHES based on signature_keywords
        let matchedTemplate = null;
        if (fs.existsSync(templatesDir)) {
          const files = await fs.promises.readdir(templatesDir);
          console.log(`[Templates] Buscando en ${templatesDir}... (${files.length} archivos)`);

          for (const f of files.filter(f => f.endsWith('.json'))) {
            try {
              const content = await fs.promises.readFile(path.join(templatesDir, f), 'utf-8');
              const tmp = JSON.parse(content);

              if (!tmp.signature_keywords || tmp.signature_keywords.length === 0) continue;

              const matchedKeywords = tmp.signature_keywords.filter((k: string) =>
                normalizedContent.includes(normalize(k))
              );

              const matchesCount = matchedKeywords.length;
              const matchPercentage = (matchesCount / tmp.signature_keywords.length) * 100;

              console.log(`[Templates] ${f}: ${matchesCount}/${tmp.signature_keywords.length} keywords encontradas (${matchPercentage.toFixed(1)}%)`);
              if (matchesCount < tmp.signature_keywords.length) {
                const missing = tmp.signature_keywords.filter((k: string) => !normalizedContent.includes(normalize(k)));
                console.log(`[Templates] Faltan: ${missing.join(", ")}`);
              }

              // Umbral de 75% o al menos 2 si son pocas
              if (matchPercentage >= 75 || (tmp.signature_keywords.length <= 3 && matchesCount >= 2)) {
                matchedTemplate = { ...tmp, fileName: f };
                console.log(`[Templates] ¡MATCH!: Usando ${f}`);
                break;
              }
            } catch (err) {
              console.error(`[Templates] Error procesando ${f}:`, err);
            }
          }
        }

        return NextResponse.json({
          success: true,
          text: textContent,
          matchedTemplate
        });
      } catch (err: any) {
        // Log for debugging
        console.log('[DEBUG] Extract error:', { code: err.code, stderr: err.stderr, stdout: err.stdout, message: err.message });

        // Exit code 10 means password required (defined in extract_text.py)
        if (err.code === 10) {
          return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 401 });
        }

        // Check stderr for PASSWORD_REQUIRED (printed by Python script)
        if (err.stderr && err.stderr.includes("PASSWORD_REQUIRED")) {
          return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 401 });
        }

        // Check stdout as fallback
        if (err.stdout && err.stdout.includes("PASSWORD_REQUIRED")) {
          return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 401 });
        }

        return NextResponse.json({ error: `Error extrayendo texto: ${err.message}` }, { status: 500 });
      }
    }

    // Action: Save JSON (New AI flow) + Save Template
    if (action === 'save_json') {
      const jsonFileName = outputName || path.basename(filePath, path.extname(filePath));
      const jsonPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${jsonFileName}.json`);

      await fs.promises.mkdir(path.dirname(jsonPath), { recursive: true });
      await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2));

      // Save Template if present in metadata/data
      const templateConfig = data.template_config;
      if (templateConfig) {
        const entityKey = templateConfig.entity.toLowerCase().replace(/\s+/g, '_');
        const accKey = templateConfig.account_type.toLowerCase();
        const templatePath = path.join(templatesDir, `${entityKey}_${accKey}.json`);

        await fs.promises.mkdir(templatesDir, { recursive: true });
        await fs.promises.writeFile(templatePath, JSON.stringify(templateConfig, null, 2));
      }

      // Delete source file
      try { await fs.promises.unlink(sourcePath); } catch (e) { }

      return NextResponse.json({ success: true, message: 'Archivo guardado y template actualizado' });
    }

    // Recalculate JSON directly if source PDF/CSV is missing or requested
    if (action === 'recalculate_json') {
      const jsonFileName = outputName || path.basename(filePath, path.extname(filePath));
      const jsonPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${jsonFileName}.json`);

      try {
        const content = await fs.promises.readFile(jsonPath, 'utf-8');
        const data = JSON.parse(content);
        const isBancolombia = data.meta_info.banco === 'Bancolombia';

        // Update keywords
        if (isBancolombia) {
          data.meta_info.ignore_keywords = paymentKeywords || [];
        } else {
          data.meta_info.payment_keywords = paymentKeywords || [];
        }

        // Recalculate transactions and totals
        let totalAbonos = 0;
        let totalCargos = 0;

        // Filter out ignored transactions for Bancolombia FIRST
        if (isBancolombia) {
          const ignoreList = paymentKeywords || [];

          data.transacciones = data.transacciones.map((t: any) => {
            const isIgnored = ignoreList.some((k: string) =>
              t.descripcion.toLowerCase().includes(k.toLowerCase())
            );
            return { ...t, ignored: isIgnored };
          });
        }

        data.transacciones = data.transacciones.map((t: any) => {
          // NuBank Logic
          if (!isBancolombia) {
            const isIgnored = (paymentKeywords || []).some((k: string) =>
              t.descripcion.toLowerCase().includes(k.toLowerCase())
            );
            const absVal = Math.abs(t.valor);
            const newVal = isIgnored ? absVal : -absVal;

            if (!isIgnored) {
              if (newVal > 0) totalAbonos += newVal;
              else totalCargos += Math.abs(newVal);
            }

            return { ...t, valor: newVal, ignored: isIgnored };
          } else {
            // Bancolombia Logic
            // Only sum if NOT ignored
            if (!t.ignored) {
              if (t.valor > 0) totalAbonos += t.valor;
              else totalCargos += Math.abs(t.valor);
            }
            return t;
          }
        });

        data.meta_info.resumen.total_abonos = totalAbonos;
        data.meta_info.resumen.total_cargos = totalCargos;

        // Recalculate saldo_actual
        if (isBancolombia) {
          const saldoAnterior = data.meta_info.resumen.saldo_anterior || 0;
          data.meta_info.resumen.saldo_actual = saldoAnterior + totalAbonos - totalCargos;
        } else {
          data.meta_info.resumen.saldo_actual = totalAbonos - totalCargos;
        }

        await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2));
        return NextResponse.json({ success: true, message: 'JSON recalculado correctamente' });
      } catch (err: any) {
        return NextResponse.json({ error: `Error al recalcular JSON: ${err.message}` }, { status: 500 });
      }
    }

    // Dynamic output name based on input filename
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${outputName || fileName}.json`);

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Execute the python script
    let command = `"${pythonPath}" "${scriptPath}" --input "${sourcePath}" --output "${outputPath}" --account-type "${accountType}"`;

    if (password && scriptName === 'nu.py') {
      command += ` --password "${password}"`;
    }

    if (action === 'analyze' && (scriptName === 'nu.py' || scriptName === 'bancolombia.py')) {
      command += ' --analyze';
    }

    if (paymentKeywords && Array.isArray(paymentKeywords) && paymentKeywords.length > 0) {
      // Escape keywords for command line
      const keywordsStr = paymentKeywords.map((k: string) => `"${k}"`).join(' ');

      if (bank === 'nu') {
        command += ` --payment-keywords ${keywordsStr}`;
      } else if (bank === 'bancolombia') {
        command += ` --ignore-keywords ${keywordsStr}`;
      }
    }

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout.includes('Éxito') && !stdout.includes('Measure-Command')) {
      // Note: PowerShell sometimes outputs to stderr even on success or for warnings. 
      // Stricter check might be needed. The python script prints "Éxito" on success.
      // However, json output for analyze might not print "Exito" if we dump json to file.
      // Wait, the analyze mode also writes to --output file? 
      // Yes, looking at nu.py, it dumps result to args.output.

      if (!stdout.includes('Éxito') && action !== 'analyze') {
        console.error("Python Error:", stderr);
        return NextResponse.json({ error: 'Processing failed', details: stderr }, { status: 500 });
      }
    }

    // For analyze action, read the output file content and return it
    if (action === 'analyze') {
      try {
        const analyzeContent = await fs.promises.readFile(outputPath, 'utf-8');
        return NextResponse.json({
          success: true,
          data: JSON.parse(analyzeContent)
        });
      } catch (err) {
        return NextResponse.json({ error: 'Failed to read analysis result', details: err }, { status: 500 });
      }
    }

    // Delete source file after successful processing
    if (action === 'process' || !action) {
      try {
        await fs.promises.unlink(sourcePath);
      } catch (err) {
        console.warn(`Could not delete source file: ${sourcePath}`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: stdout.trim(),
      outputPath: `processed/${fileName}.json`
    });

  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json({
      error: 'Failed to execute processing',
      details: error.message
    }, { status: 500 });
  }
}
