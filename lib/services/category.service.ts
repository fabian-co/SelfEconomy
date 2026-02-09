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

    // Create a map of categories by ID, where customs override defaults
    const categoryMap = new Map<string, Category>();

    // Add defaults first
    defaults.forEach(cat => categoryMap.set(cat.id, cat));

    // Add customs, overriding any defaults with same ID
    customs.forEach(cat => categoryMap.set(cat.id, cat));

    return Array.from(categoryMap.values());
  }

  static async addCustomCategory(category: Partial<Category>): Promise<Category> {
    if (!category.name) throw new AppError('Category name is required', 400);

    const id = category.id || category.name.toLowerCase().trim().replace(/\s+/g, '_');

    // Check for existing ID in both defaults and customs
    const allCategories = await this.getAllCategories();
    if (allCategories.some(c => c.id === id)) {
      throw new AppError(`Category with ID '${id}' already exists`, 409);
    }

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
    const allCategories = await this.getAllCategories();
    const existingCategory = allCategories.find(c => c.id === updated.id);

    if (!existingCategory) {
      throw new AppError('Category not found', 404);
    }

    // Merge existing with updates
    const newCategoryState: Category = {
      ...existingCategory,
      ...updated
    } as Category;

    await JsonStorageService.update<Category[]>(
      this.CUSTOM_PATH,
      (categories) => {
        const index = categories.findIndex(c => c.id === updated.id);

        if (index !== -1) {
          // Update existing custom category
          categories[index] = newCategoryState;
        } else {
          // Create new custom category (shadowing a default)
          categories.push(newCategoryState);
        }

        result = newCategoryState;
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
