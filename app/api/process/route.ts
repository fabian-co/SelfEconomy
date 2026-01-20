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

    // Action: AI Extract (New AI flow)
    if (action === 'ai_extract') {
      const tempTxtPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'temp', `${path.basename(filePath)}.txt`);
      await fs.promises.mkdir(path.dirname(tempTxtPath), { recursive: true });

      let extractCmd = `"${pythonPath}" "${extractScriptPath}" --input "${sourcePath}" --output "${tempTxtPath}"`;
      if (password) extractCmd += ` --password "${password}"`;

      try {
        await execAsync(extractCmd);
        const textContent = await fs.promises.readFile(tempTxtPath, 'utf-8');
        // Optionally delete temp file
        await fs.promises.unlink(tempTxtPath);

        return NextResponse.json({
          success: true,
          text: textContent
        });
      } catch (err: any) {
        return NextResponse.json({ error: `Error extrayendo texto: ${err.message}` }, { status: 500 });
      }
    }

    // Action: Save JSON (New AI flow)
    if (action === 'save_json') {
      const jsonFileName = outputName || path.basename(filePath, path.extname(filePath));
      const jsonPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${jsonFileName}.json`);

      await fs.promises.mkdir(path.dirname(jsonPath), { recursive: true });
      await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2));

      // Delete source file
      try { await fs.promises.unlink(sourcePath); } catch (e) { }

      return NextResponse.json({ success: true, message: 'Archivo guardado correctamente' });
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
