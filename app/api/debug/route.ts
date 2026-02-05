import { NextRequest, NextResponse } from 'next/server';
import { ProcessorService } from '@/app/api/process/services/processor.service';
import { getTempDir, getPythonPath, getScriptPath, getRootDirTemp } from '@/app/api/process/lib/utils';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

async function extractCsvFromPdf(filePath: string, password?: string): Promise<{ csv: string; csvPath: string }> {
  const pythonCmd = getPythonPath();
  const scriptPath = getScriptPath('extract_csv.py');
  const tempDir = path.join(getRootDirTemp(), 'csv');
  await fs.promises.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `debug_${Date.now()}.csv`);

  return new Promise((resolve, reject) => {
    const args = ['--input', filePath, '--output', outputPath];
    if (password) args.push('--password', password);

    const proc = spawn(pythonCmd, [scriptPath, ...args]);
    let stderr = '';

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', async (code) => {
      if (code === 10) {
        reject(new Error('PASSWORD_REQUIRED'));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr || `Python script exited with code ${code}`));
        return;
      }

      try {
        const csv = await fs.promises.readFile(outputPath, 'utf-8');
        resolve({ csv, csvPath: outputPath });
      } catch (err: any) {
        reject(new Error(`Failed to read CSV output: ${err.message}`));
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const step = formData.get('step') as string;
    const password = formData.get('password') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Save uploaded file to temp
    const tempDir = getTempDir();
    await fs.promises.mkdir(tempDir, { recursive: true });

    const uploadPath = path.join(tempDir, `debug_${file.name}`);
    const bytes = await file.arrayBuffer();
    await fs.promises.writeFile(uploadPath, Buffer.from(bytes));

    const result: any = {
      step,
      uploadPath,
      fileName: file.name,
      fileSize: file.size
    };

    if (step === 'extract_text') {
      const startTime = Date.now();
      try {
        const { text, tempTxtPath } = await ProcessorService.extractText(uploadPath, password || undefined, `debug_${Date.now()}`);
        result.success = true;
        result.text = text;
        result.textPath = tempTxtPath;
        result.textLength = text.length;
        result.lineCount = text.split('\n').length;
        result.duration = Date.now() - startTime;
      } catch (err: any) {
        result.success = false;
        result.error = err.message;
        result.duration = Date.now() - startTime;
      }
    }

    if (step === 'extract_csv') {
      const startTime = Date.now();
      try {
        const { csv, csvPath } = await extractCsvFromPdf(uploadPath, password || undefined);
        result.success = true;
        result.csv = csv;
        result.csvPath = csvPath;
        result.csvLength = csv.length;
        result.rowCount = csv.split('\n').filter((line: string) => line.trim()).length;
        result.duration = Date.now() - startTime;
      } catch (err: any) {
        result.success = false;
        result.error = err.message;
        result.duration = Date.now() - startTime;
      }
    }

    if (step === 'extract_both') {
      const startTime = Date.now();
      try {
        // Extract text
        const { text } = await ProcessorService.extractText(uploadPath, password || undefined, `debug_${Date.now()}`);
        result.text = text;
        result.textLength = text.length;
        result.lineCount = text.split('\n').length;

        // Extract CSV
        const { csv, csvPath } = await extractCsvFromPdf(uploadPath, password || undefined);
        result.csv = csv;
        result.csvPath = csvPath;
        result.csvLength = csv.length;
        result.rowCount = csv.split('\n').filter((line: string) => line.trim()).length;

        result.success = true;
        result.duration = Date.now() - startTime;
      } catch (err: any) {
        result.success = false;
        result.error = err.message;
        result.duration = Date.now() - startTime;
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Debug API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
