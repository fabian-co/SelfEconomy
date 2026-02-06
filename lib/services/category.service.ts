import path from 'path';
import { JsonStorageService } from './json-storage.service';
import { AppError } from '../exceptions/api-error';

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
    if (!category.name) throw new AppError('Category name is required', 400);

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
    if (!updated.id) throw new AppError('Category ID is required', 400);

    let result: Category | undefined;

    await JsonStorageService.update<Category[]>(
      this.CUSTOM_PATH,
      (categories) => {
        const index = categories.findIndex(c => c.id === updated.id);
        if (index === -1) throw new AppError('Category not found in custom categories', 404);

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
        if (filtered.length === categories.length) throw new AppError('Category not found', 404);
        return filtered;
      },
      []
    );
  }
}
