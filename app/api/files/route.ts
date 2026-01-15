import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'app', 'api', 'extracto');

async function getFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? getFilesRecursively(res) : res;
  }));
  return Array.prototype.concat(...files);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    // If name is provided, return file content
    if (name) {
      const filePath = path.join(DATA_DIR, name);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return NextResponse.json({ content });
      } catch (err) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
    }

    // Ensure directory exists
    try {
      await fs.access(DATA_DIR);
    } catch {
      return NextResponse.json([]); // Return empty if dir doesn't exist
    }

    const allFiles = await getFilesRecursively(DATA_DIR);
    const targetExtensions = ['.json', '.csv', '.xlsx', '.pdf'];
    const filteredFiles = allFiles.filter(file =>
      targetExtensions.some(ext => file.toLowerCase().endsWith(ext))
    );

    const fileStats = await Promise.all(filteredFiles.map(async (filePath) => {
      const stats = await fs.stat(filePath);
      // Return relative path from DATA_DIR
      const relativePath = path.relative(DATA_DIR, filePath).split(path.sep).join('/');
      return {
        name: relativePath,
        size: stats.size,
        updatedAt: stats.mtime
      };
    }));

    return NextResponse.json(fileStats);
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { oldName, newName } = await request.json();

    if (!oldName || !newName) {
      return NextResponse.json({ error: 'Missing filenames' }, { status: 400 });
    }

    const oldPath = path.join(DATA_DIR, oldName);
    const newPath = path.join(DATA_DIR, newName);

    await fs.rename(oldPath, newPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error renaming file:", error);
    return NextResponse.json({ error: 'Failed to rename file' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }

    const filePath = path.join(DATA_DIR, name);
    await fs.unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bank = formData.get('bank') as string || 'other';
    const accountType = formData.get('accountType') as string || 'default';
    const extractName = formData.get('extractName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name;
    const extension = path.extname(originalName).toLowerCase();

    if (extension !== '.csv' && extension !== '.xlsx' && extension !== '.pdf') {
      return NextResponse.json({ error: 'Only .csv, .xlsx and .pdf files are allowed' }, { status: 400 });
    }

    // Use extractName if provided, otherwise originalName
    const finalFileName = extractName ? `${extractName}${extension}` : originalName;

    // Organize by bank and accountType
    const uploadDir = path.join(DATA_DIR, bank.toLowerCase(), accountType.toLowerCase());
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, finalFileName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      name: finalFileName,
      path: path.relative(DATA_DIR, filePath).split(path.sep).join('/')
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

