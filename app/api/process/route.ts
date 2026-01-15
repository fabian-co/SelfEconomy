import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { filePath, password, action, paymentKeywords, outputName } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    // Absolute path to the source file
    // The filePath received can be relative to app/api/extracto (new uploads)
    // or absolute (re-processing from stored source_file_path)
    const sourcePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), 'app', 'api', 'extracto', filePath);

    // Detect bank and account type based on path
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

    let bank = 'other';
    let accountType = 'debit';

    if (normalizedPath.includes('/nu/')) {
      bank = 'nu';
    } else if (normalizedPath.includes('/bancolombia/')) {
      bank = 'bancolombia';
    }

    if (normalizedPath.includes('/credit/')) {
      accountType = 'credit';
    }

    let scriptName = 'bancolombia.py';
    if (bank === 'nu') {
      scriptName = 'nu.py';
    } else if (bank === 'bancolombia') {
      scriptName = 'bancolombia.py';
    }

    // Script path
    const scriptPath = path.join(process.cwd(), 'app', 'api', 'py', scriptName);
    const pythonPath = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');

    // Recalculate JSON directly if source PDF is missing or requested
    if (action === 'recalculate_json') {
      const jsonFileName = outputName || path.basename(filePath, path.extname(filePath));
      const jsonPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${jsonFileName}.json`);

      try {
        const content = await fs.promises.readFile(jsonPath, 'utf-8');
        const data = JSON.parse(content);

        // Update keywords
        data.meta_info.payment_keywords = paymentKeywords || [];

        // Recalculate transactions and totals
        let totalAbonos = 0;
        let totalCargos = 0;

        data.transacciones = data.transacciones.map((t: any) => {
          const isPayment = (paymentKeywords || []).some((k: string) =>
            t.descripcion.toLowerCase().includes(k.toLowerCase())
          );

          // Force absolute value and then apply sign
          const absVal = Math.abs(t.valor);
          const newVal = isPayment ? absVal : -absVal;

          if (newVal > 0) totalAbonos += newVal;
          else totalCargos += Math.abs(newVal);

          return { ...t, valor: newVal };
        });

        data.meta_info.resumen.total_abonos = totalAbonos;
        data.meta_info.resumen.total_cargos = totalCargos;
        data.meta_info.resumen.saldo_actual = totalAbonos - totalCargos;

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

    if (action === 'analyze' && scriptName === 'nu.py') {
      command += ' --analyze';
    }

    if (paymentKeywords && Array.isArray(paymentKeywords) && paymentKeywords.length > 0) {
      // Escape keywords for command line
      const keywordsStr = paymentKeywords.map((k: string) => `"${k}"`).join(' ');
      command += ` --payment-keywords ${keywordsStr}`;
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
