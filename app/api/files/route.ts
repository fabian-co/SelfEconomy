import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'Extracto');

async function getFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? getFilesRecursively(res) : res;
  }));
  return Array.prototype.concat(...files);
}

export async function GET() {
  try {
    // Ensure directory exists
    try {
      await fs.access(DATA_DIR);
    } catch {
      return NextResponse.json([]); // Return empty if dir doesn't exist
    }

    const allFiles = await getFilesRecursively(DATA_DIR);
    const jsonFiles = allFiles.filter(file => file.endsWith('.json'));

    const fileStats = await Promise.all(jsonFiles.map(async (filePath) => {
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

    if (!newName.endsWith('.json')) {
      return NextResponse.json({ error: 'File must be a JSON file' }, { status: 400 });
    }

    const oldPath = path.join(DATA_DIR, oldName);
    const newPath = path.join(DATA_DIR, newName);

    // Verify paths are within DATA_DIR to prevent directory traversal?
    // For now, allow renaming within the structure.

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
