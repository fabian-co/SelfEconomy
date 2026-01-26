import fs from 'fs';
import path from 'path';

export class JsonStorageService {
  /**
   * Reads a JSON file and returns its content.
   * Returns a default value if the file doesn't exist or is invalid.
   */
  static async read<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      console.error(`Error reading JSON file at ${filePath}:`, error);
      return defaultValue;
    }
  }

  /**
   * Writes data to a JSON file.
   * Creates the directory if it doesn't exist.
   */
  static async write<T>(filePath: string, data: T): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing JSON file at ${filePath}:`, error);
      throw new Error(`Failed to write to ${filePath}`);
    }
  }

  /**
   * Atomic update of a JSON file.
   */
  static async update<T>(filePath: string, updater: (current: T) => T, defaultValue: T): Promise<T> {
    const current = await this.read<T>(filePath, defaultValue);
    const updated = updater(current);
    await this.write(filePath, updated);
    return updated;
  }
}
