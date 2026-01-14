import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }

    // Absolute path to the source file
    // The filePath received is relative to app/api/extracto
    const sourcePath = path.join(process.cwd(), 'app', 'api', 'extracto', filePath);

    // Detect bank based on path
    let scriptName = 'bancolombia.py';
    let outputSubDir = 'bancolombia/process';

    if (filePath.toLowerCase().includes('/nu/') || filePath.toLowerCase().includes('\\nu\\')) {
      scriptName = 'nu.py';
      outputSubDir = 'nu/process';
    }

    // Script path
    const scriptPath = path.join(process.cwd(), 'app', 'api', 'py', scriptName);

    // Dynamic output name based on input filename
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'processed', `${fileName}.json`);

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Execute the python script
    // Note: for NuBank (nu.py), it might need a password. 
    // For now we assume the user might have provided it or we'll add a way to pass it.
    let command = `python "${scriptPath}" --input "${sourcePath}" --output "${outputPath}"`;

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
