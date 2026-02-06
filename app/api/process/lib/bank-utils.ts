import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'app', 'api', 'extracto');

export async function getExistingBanks(): Promise<string[]> {
  const processedDir = path.join(DATA_DIR, 'processed');

  try {
    await fs.promises.access(processedDir);
  } catch {
    return [];
  }

  try {
    const entries = await fs.promises.readdir(processedDir, { withFileTypes: true });
    // Filter directories and Format directory names to human readable bank names
    // e.g. "nu_financiera" -> "Nu Financiera"
    const banks = entries
      .filter(e => e.isDirectory())
      .map(e => e.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    return banks;
  } catch (error) {
    console.error("Error reading existing banks:", error);
    return [];
  }
}
