import AsyncStorage from '@react-native-async-storage/async-storage';
import { PasswordCategoryExtended, PasswordEntry } from '../types/password';
import { DEFAULT_CATEGORIES } from '../constants/categories';

const CATEGORIES_STORAGE_KEY = 'passwordepic_categories';
const CATEGORY_STATS_STORAGE_KEY = 'passwordepic_category_stats';

export interface CategoryStats {
  categoryId: string;
  entryCount: number;
  lastUsed?: Date;
  totalUsage: number;
  averageUsage: number;
}

export interface CategoryUsageData {
  categoryId: string;
  entryId: string;
  timestamp: Date;
  action: 'view' | 'edit' | 'create' | 'delete';
}

export class CategoryService {
  private static categories: PasswordCategoryExtended[] = [];
  private static statsCache: Map<string, CategoryStats> = new Map();
  private static initialized = false;

  /**
   * Initialize the category service with default categories
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadCategories();
      await this.loadCategoryStats();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize CategoryService:', error);
      // Fallback to default categories
      this.categories = this.createDefaultCategories();
      await this.saveCategories();
      this.initialized = true;
    }
  }

  /**
   * Get all categories with current stats
   */
  public static async getAllCategories(): Promise<PasswordCategoryExtended[]> {
    await this.initialize();
    return [...this.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get category by ID
   */
  public static async getCategoryById(
    id: string,
  ): Promise<PasswordCategoryExtended | null> {
    await this.initialize();
    return this.categories.find(cat => cat.id === id) || null;
  }

  /**
   * Create a new custom category
   */
  public static async createCategory(
    name: string,
    icon: string,
    color: string,
    description?: string,
    parentId?: string,
  ): Promise<PasswordCategoryExtended> {
    await this.initialize();

    // Validate inputs
    if (!name.trim()) {
      throw new Error('Category name is required');
    }

    if (
      this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new Error('Category name already exists');
    }

    // Generate unique ID
    const id = `custom_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const newCategory: PasswordCategoryExtended = {
      id,
      name: name.trim(),
      icon,
      color,
      description: description?.trim(),
      parentId,
      children: [],
      entryCount: 0,
      isCustom: true,
      sortOrder: this.getNextSortOrder(),
      createdAt: new Date(),
    };

    // Add to parent's children if parentId is provided
    if (parentId) {
      const parent = this.categories.find(cat => cat.id === parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(newCategory);
      }
    }

    this.categories.push(newCategory);
    await this.saveCategories();

    return newCategory;
  }

  /**
   * Update an existing category
   */
  public static async updateCategory(
    id: string,
    updates: Partial<
      Pick<
        PasswordCategoryExtended,
        'name' | 'icon' | 'color' | 'description' | 'sortOrder'
      >
    >,
  ): Promise<PasswordCategoryExtended> {
    await this.initialize();

    const categoryIndex = this.categories.findIndex(cat => cat.id === id);
    if (categoryIndex === -1) {
      throw new Error('Category not found');
    }

    const category = this.categories[categoryIndex];

    // Prevent updating default categories' core properties
    if (!category.isCustom && (updates.name || updates.icon)) {
      throw new Error('Cannot modify core properties of default categories');
    }

    // Validate name uniqueness if changing name
    if (updates.name && updates.name !== category.name) {
      if (
        this.categories.some(
          cat =>
            cat.id !== id &&
            cat.name.toLowerCase() === updates.name!.toLowerCase(),
        )
      ) {
        throw new Error('Category name already exists');
      }
    }

    // Apply updates
    this.categories[categoryIndex] = {
      ...category,
      ...updates,
      name: updates.name?.trim() || category.name,
      description: updates.description?.trim() || category.description,
    };

    await this.saveCategories();
    return this.categories[categoryIndex];
  }

  /**
   * Delete a custom category
   */
  public static async deleteCategory(
    id: string,
    moveEntriesTo?: string,
  ): Promise<void> {
    await this.initialize();

    const category = this.categories.find(cat => cat.id === id);
    if (!category) {
      throw new Error('Category not found');
    }

    if (!category.isCustom) {
      throw new Error('Cannot delete default categories');
    }

    if (category.entryCount > 0 && !moveEntriesTo) {
      throw new Error(
        'Cannot delete category with entries. Please move entries first or specify a target category.',
      );
    }

    // Remove from parent's children if it's a child category
    if (category.parentId) {
      const parent = this.categories.find(cat => cat.id === category.parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter(child => child.id !== id);
      }
    }

    // Remove from categories list
    this.categories = this.categories.filter(cat => cat.id !== id);

    // Clean up stats
    this.statsCache.delete(id);

    await this.saveCategories();
    await this.saveCategoryStats();
  }

  /**
   * Update category usage statistics
   */
  public static async updateCategoryUsage(
    categoryId: string,
    _action: CategoryUsageData['action'] = 'view',
  ): Promise<void> {
    await this.initialize();

    const category = this.categories.find(cat => cat.id === categoryId);
    if (!category) return;

    // Update last used
    category.lastUsed = new Date();

    // Update stats
    let stats = this.statsCache.get(categoryId);
    if (!stats) {
      stats = {
        categoryId,
        entryCount: category.entryCount,
        totalUsage: 0,
        averageUsage: 0,
      };
    }

    stats.totalUsage++;
    stats.lastUsed = new Date();
    stats.averageUsage = stats.totalUsage / Math.max(1, stats.entryCount);

    this.statsCache.set(categoryId, stats);

    await this.saveCategories();
    await this.saveCategoryStats();
  }

  /**
   * Update entry count for a category
   */
  public static async updateCategoryEntryCount(
    categoryId: string,
    delta: number,
  ): Promise<void> {
    await this.initialize();

    const category = this.categories.find(cat => cat.id === categoryId);
    if (!category) return;

    category.entryCount = Math.max(0, category.entryCount + delta);

    // Update stats
    let stats = this.statsCache.get(categoryId);
    if (!stats) {
      stats = {
        categoryId,
        entryCount: category.entryCount,
        totalUsage: 0,
        averageUsage: 0,
      };
    }

    stats.entryCount = category.entryCount;
    if (stats.entryCount > 0) {
      stats.averageUsage = stats.totalUsage / stats.entryCount;
    }

    this.statsCache.set(categoryId, stats);

    await this.saveCategories();
    await this.saveCategoryStats();
  }

  /**
   * Get category statistics
   */
  public static async getCategoryStats(
    categoryId?: string,
  ): Promise<CategoryStats | CategoryStats[]> {
    await this.initialize();

    if (categoryId) {
      return (
        this.statsCache.get(categoryId) || {
          categoryId,
          entryCount: 0,
          totalUsage: 0,
          averageUsage: 0,
        }
      );
    }

    return Array.from(this.statsCache.values());
  }

  /**
   * Get categories with entry counts from password entries
   */
  public static async syncCategoryStats(
    entries: PasswordEntry[],
  ): Promise<void> {
    await this.initialize();

    // Reset all counts
    this.categories.forEach(cat => {
      cat.entryCount = 0;
    });

    // Count entries per category
    const categoryCounts = new Map<string, number>();
    entries.forEach(entry => {
      if (entry.category) {
        categoryCounts.set(
          entry.category,
          (categoryCounts.get(entry.category) || 0) + 1,
        );
      }
    });

    // Update category entry counts
    categoryCounts.forEach((count, categoryId) => {
      const category = this.categories.find(cat => cat.id === categoryId);
      if (category) {
        category.entryCount = count;
      }

      // Update stats cache
      let stats = this.statsCache.get(categoryId);
      if (!stats) {
        stats = {
          categoryId,
          entryCount: count,
          totalUsage: 0,
          averageUsage: 0,
        };
      }
      stats.entryCount = count;
      this.statsCache.set(categoryId, stats);
    });

    await this.saveCategories();
    await this.saveCategoryStats();
  }

  /**
   * Search categories by name
   */
  public static async searchCategories(
    query: string,
  ): Promise<PasswordCategoryExtended[]> {
    await this.initialize();

    if (!query.trim()) {
      return this.getAllCategories();
    }

    const lowercaseQuery = query.toLowerCase().trim();
    return this.categories.filter(
      category =>
        category.name.toLowerCase().includes(lowercaseQuery) ||
        (category.description &&
          category.description.toLowerCase().includes(lowercaseQuery)),
    );
  }

  /**
   * Get most used categories
   */
  public static async getMostUsedCategories(
    limit: number = 5,
  ): Promise<PasswordCategoryExtended[]> {
    await this.initialize();

    return [...this.categories]
      .filter(cat => cat.entryCount > 0)
      .sort((a, b) => b.entryCount - a.entryCount)
      .slice(0, limit);
  }

  /**
   * Get recently used categories
   */
  public static async getRecentlyUsedCategories(
    limit: number = 5,
  ): Promise<PasswordCategoryExtended[]> {
    await this.initialize();

    return [...this.categories]
      .filter(cat => cat.lastUsed)
      .sort(
        (a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0),
      )
      .slice(0, limit);
  }

  /**
   * Merge two categories
   */
  public static async mergeCategories(
    sourceId: string,
    targetId: string,
  ): Promise<void> {
    await this.initialize();

    const sourceCategory = this.categories.find(cat => cat.id === sourceId);
    const targetCategory = this.categories.find(cat => cat.id === targetId);

    if (!sourceCategory || !targetCategory) {
      throw new Error('One or both categories not found');
    }

    if (!sourceCategory.isCustom) {
      throw new Error('Cannot merge default categories');
    }

    // Update target category entry count
    targetCategory.entryCount += sourceCategory.entryCount;

    // Merge stats
    const sourceStats = this.statsCache.get(sourceId);
    const targetStats = this.statsCache.get(targetId) || {
      categoryId: targetId,
      entryCount: targetCategory.entryCount,
      totalUsage: 0,
      averageUsage: 0,
    };

    if (sourceStats) {
      targetStats.totalUsage += sourceStats.totalUsage;
      targetStats.entryCount = targetCategory.entryCount;
      targetStats.averageUsage =
        targetStats.totalUsage / Math.max(1, targetStats.entryCount);
      targetStats.lastUsed =
        sourceStats.lastUsed && targetStats.lastUsed
          ? new Date(
              Math.max(
                sourceStats.lastUsed.getTime(),
                targetStats.lastUsed.getTime(),
              ),
            )
          : sourceStats.lastUsed || targetStats.lastUsed;
    }

    this.statsCache.set(targetId, targetStats);

    // Remove source category
    await this.deleteCategory(sourceId);
  }

  // Private helper methods
  private static createDefaultCategories(): PasswordCategoryExtended[] {
    const now = new Date();
    return DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      createdAt: now,
      entryCount: 0,
    }));
  }

  private static getNextSortOrder(): number {
    return Math.max(...this.categories.map(cat => cat.sortOrder), 0) + 1;
  }

  private static async loadCategories(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        this.categories = parsed.map((cat: any) => ({
          ...cat,
          createdAt: new Date(cat.createdAt),
          lastUsed: cat.lastUsed ? new Date(cat.lastUsed) : undefined,
        }));
      } else {
        this.categories = this.createDefaultCategories();
        await this.saveCategories();
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.categories = this.createDefaultCategories();
    }
  }

  private static async saveCategories(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CATEGORIES_STORAGE_KEY,
        JSON.stringify(this.categories),
      );
    } catch (error) {
      console.error('Failed to save categories:', error);
    }
  }

  private static async loadCategoryStats(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(CATEGORY_STATS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.statsCache = new Map(
          parsed.map((stat: any) => [
            stat.categoryId,
            {
              ...stat,
              lastUsed: stat.lastUsed ? new Date(stat.lastUsed) : undefined,
            },
          ]),
        );
      }
    } catch (error) {
      console.error('Failed to load category stats:', error);
    }
  }

  private static async saveCategoryStats(): Promise<void> {
    try {
      const stats = Array.from(this.statsCache.values());
      await AsyncStorage.setItem(
        CATEGORY_STATS_STORAGE_KEY,
        JSON.stringify(stats),
      );
    } catch (error) {
      console.error('Failed to save category stats:', error);
    }
  }

  /**
   * Clear all data (for testing/reset purposes)
   */
  public static async clearAllData(): Promise<void> {
    this.categories = [];
    this.statsCache.clear();
    this.initialized = false;

    try {
      await AsyncStorage.removeItem(CATEGORIES_STORAGE_KEY);
      await AsyncStorage.removeItem(CATEGORY_STATS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear category data:', error);
    }
  }
}

export default CategoryService;
