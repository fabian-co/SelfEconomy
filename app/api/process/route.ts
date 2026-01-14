import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { filePath, password } = await request.json();

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

    // Check if filename has a date or similar that might be the password? 
    // Or just generic.

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout.includes('Éxito')) {
      console.error("Python Error:", stderr);
      return NextResponse.json({ error: 'Processing failed', details: stderr }, { status: 500 });
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
