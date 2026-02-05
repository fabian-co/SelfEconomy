import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 });
    }

    // Open file with default application (Excel for CSV on Windows)
    const command = process.platform === 'win32'
      ? `start "" "${filePath}"`
      : process.platform === 'darwin'
        ? `open "${filePath}"`
        : `xdg-open "${filePath}"`;

    exec(command, (error) => {
      if (error) {
        console.error('Error opening file:', error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Open File Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
