import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { filePath, password, action, paymentKeywords } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    // Absolute path to the source file
    // The filePath received is relative to app/api/extracto
    const sourcePath = path.join(process.cwd(), 'app', 'api', 'extracto', filePath);

    // Detect bank and account type based on path
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/');

    // Structure: [bank]/[accountType]/filename.ext
    const bank = pathParts[0];
    const accountType = pathParts[1] || 'debit';

    let scriptName = 'bancolombia.py';
    if (bank === 'nu') {
      scriptName = 'nu.py';
    } else if (bank === 'bancolombia') {
      scriptName = 'bancolombia.py';
    }

    // Script path
    const scriptPath = path.join(process.cwd(), 'app', 'api', 'py', scriptName);
    const pythonPath = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');

    // Dynamic output name based on input filename
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${fileName}.json`);

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
