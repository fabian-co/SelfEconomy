import path from 'path';
import { JsonStorageService } from './json-storage.service';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export class CategoryService {
  private static DEFAULT_PATH = path.join(process.cwd(), 'constants', 'categories.json');
  private static CUSTOM_PATH = path.join(process.cwd(), 'custom-data', 'categories', 'custom-categories.json');

  static async getAllCategories(): Promise<Category[]> {
    const defaults = await JsonStorageService.read<Category[]>(this.DEFAULT_PATH, []);
    const customs = await JsonStorageService.read<Category[]>(this.CUSTOM_PATH, []);
    return [...defaults, ...customs];
  }

  static async addCustomCategory(category: Partial<Category>): Promise<Category> {
    if (!category.name) throw new Error('Category name is required');

    const id = category.id || category.name.toLowerCase().replace(/\s+/g, '_');
    const newCategory: Category = {
      id,
      name: category.name,
      icon: category.icon || 'Tag',
      color: category.color || '#3f3f46',
    };

    await JsonStorageService.update<Category[]>(
      this.CUSTOM_PATH,
      (categories) => {
        categories.push(newCategory);
        return categories;
      },
      []
    );

    return newCategory;
  }

  static async updateCustomCategory(updated: Partial<Category>): Promise<Category> {
    if (!updated.id) throw new Error('Category ID is required');

    let result: Category | undefined;

    await JsonStorageService.update<Category[]>(
      this.CUSTOM_PATH,
      (categories) => {
        const index = categories.findIndex(c => c.id === updated.id);
        if (index === -1) throw new Error('Category not found in custom categories');

        categories[index] = { ...categories[index], ...updated } as Category;
        result = categories[index];
        return categories;
      },
      []
    );

    return result!;
  }

  static async deleteCustomCategory(id: string): Promise<void> {
    await JsonStorageService.update<Category[]>(
      this.CUSTOM_PATH,
      (categories) => {
        const filtered = categories.filter(c => c.id !== id);
        if (filtered.length === categories.length) throw new Error('Category not found');
        return filtered;
      },
      []
    );
  }
}
