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

    // Target output path
    const outputPath = path.join(process.cwd(), 'app', 'api', 'extracto', 'bancolombia', 'process', 'extracto_procesado.json');

    // Script path
    const scriptPath = path.join(process.cwd(), 'app', 'api', 'py', 'bancolombia.py');

    // Ensure output directory exists
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Execute the python script
    // Using 'python' or 'python3' depending on environment, usually 'python' on Windows
    const command = `python "${scriptPath}" --input "${sourcePath}" --output "${outputPath}"`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stdout.includes('Éxito')) {
      console.error("Python Error:", stderr);
      return NextResponse.json({ error: 'Processing failed', details: stderr }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: stdout.trim(),
      outputPath: 'bancolombia/process/extracto_procesado.json'
    });

  } catch (error: any) {
    console.error("Execution Error:", error);
    return NextResponse.json({
      error: 'Failed to execute processing',
      details: error.message
    }, { status: 500 });
  }
}
