import path from 'path';
import { JsonStorageService } from './json-storage.service';

const RULES_BASE_DIR = path.join(process.cwd(), 'custom-data', 'rules');

export interface RuleEntry {
  isIgnored?: boolean;
  isPositive?: boolean;
  isEdited?: boolean;
  lastUpdated: string;
}

export interface RuleCollection {
  byDescription: Record<string, RuleEntry>;
  byId: Record<string, RuleEntry>;
}

export interface CategoryRule {
  title: string;
  categoryId: string;
  categoryName: string;
  lastUpdated: string;
}

export class RuleService {
  private static IGNORE_RULES_PATH = path.join(RULES_BASE_DIR, 'ignore-rules.json');
  private static FLIP_RULES_PATH = path.join(RULES_BASE_DIR, 'flip-rules.json');
  private static CATEGORY_RULES_PATH = path.join(RULES_BASE_DIR, 'category-rules.json');

  private static DEFAULT_COLLECTION: RuleCollection = { byDescription: {}, byId: {} };

  // --- Ignore Rules ---
  static async getIgnoreRules(): Promise<RuleCollection> {
    return JsonStorageService.read<RuleCollection>(this.IGNORE_RULES_PATH, this.DEFAULT_COLLECTION);
  }

  static async updateIgnoreRule(params: {
    description?: string;
    transactionId?: string;
    isIgnored: boolean;
    applyGlobally?: boolean;
  }) {
    const { description, transactionId, isIgnored, applyGlobally } = params;
    const timestamp = new Date().toISOString();

    return JsonStorageService.update<RuleCollection>(
      this.IGNORE_RULES_PATH,
      (rules) => {
        if (applyGlobally && description) {
          rules.byDescription[description] = { isIgnored, lastUpdated: timestamp };
          if (transactionId) delete rules.byId[transactionId];
        } else if (transactionId) {
          rules.byId[transactionId] = { isIgnored, lastUpdated: timestamp };
          if (description) delete rules.byDescription[description];
        }
        return rules;
      },
      this.DEFAULT_COLLECTION
    );
  }

  // --- Flip Rules ---
  static async getFlipRules(): Promise<RuleCollection> {
    return JsonStorageService.read<RuleCollection>(this.FLIP_RULES_PATH, this.DEFAULT_COLLECTION);
  }

  static async updateFlipRule(params: {
    description?: string;
    transactionId?: string;
    isPositive: boolean;
    isEdited?: boolean;
    applyGlobally?: boolean;
  }) {
    const { description, transactionId, isPositive, isEdited, applyGlobally } = params;
    const timestamp = new Date().toISOString();

    return JsonStorageService.update<RuleCollection>(
      this.FLIP_RULES_PATH,
      (rules) => {
        if (applyGlobally && description) {
          rules.byDescription[description] = { isPositive, isEdited, lastUpdated: timestamp };
          if (transactionId) delete rules.byId[transactionId];
        } else if (transactionId) {
          rules.byId[transactionId] = { isPositive, isEdited, lastUpdated: timestamp };
          if (description) delete rules.byDescription[description];
        }
        return rules;
      },
      this.DEFAULT_COLLECTION
    );
  }

  // --- Category Rules ---
  static async getCategoryRules(): Promise<Record<string, CategoryRule>> {
    return JsonStorageService.read<Record<string, CategoryRule>>(this.CATEGORY_RULES_PATH, {});
  }

  static async updateCategoryRule(params: {
    originalDescription: string;
    description: string;
    categoryId: string;
    categoryName: string;
  }) {
    const { originalDescription, description, categoryId, categoryName } = params;

    return JsonStorageService.update<Record<string, CategoryRule>>(
      this.CATEGORY_RULES_PATH,
      (rules) => {
        rules[originalDescription] = {
          title: description,
          categoryId,
          categoryName,
          lastUpdated: new Date().toISOString()
        };
        return rules;
      },
      {}
    );
  }
}
