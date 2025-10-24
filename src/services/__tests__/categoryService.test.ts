import { CategoryService, type CategoryStats } from '../categoryService';
import type {
  PasswordCategoryExtended,
  PasswordEntry,
} from '../../types/password';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiSet: jest.fn(),
  multiGet: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock default categories
jest.mock('../../constants/categories', () => ({
  DEFAULT_CATEGORIES: [
    {
      id: 'email',
      name: 'Email',
      icon: 'mail',
      color: '#FF5722',
      sortOrder: 1,
      isCustom: false,
      entryCount: 0,
      children: [],
    },
    {
      id: 'social',
      name: 'Social Media',
      icon: 'people',
      color: '#2196F3',
      sortOrder: 2,
      isCustom: false,
      entryCount: 0,
      children: [],
    },
    {
      id: 'banking',
      name: 'Banking',
      icon: 'account-balance',
      color: '#4CAF50',
      sortOrder: 3,
      isCustom: false,
      entryCount: 0,
      children: [],
    },
  ],
}));

describe('CategoryService', () => {
  const mockAsyncStorage = require('@react-native-async-storage/async-storage');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    (CategoryService as any).categories = [];
    (CategoryService as any).statsCache = new Map();
    (CategoryService as any).initialized = false;
  });

  // ==================== Initialization ====================
  describe('initialize', () => {
    it('should initialize service on first call', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await CategoryService.initialize();

      const categories = await CategoryService.getAllCategories();
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should not reinitialize if already initialized', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await CategoryService.initialize();
      mockAsyncStorage.getItem.mockClear();

      await CategoryService.initialize();

      // Should not call getItem if already initialized
      expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('should load from storage if available', async () => {
      const savedCategories = [
        {
          id: 'custom-1',
          name: 'Custom Category',
          icon: 'star',
          color: '#FF00FF',
          isCustom: true,
          sortOrder: 10,
        },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(savedCategories),
      );

      await CategoryService.initialize();

      const categories = await CategoryService.getAllCategories();
      expect(categories).toContainEqual(
        expect.objectContaining({ id: 'custom-1' }),
      );
    });

    it('should fallback to defaults on load error', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Load failed'));

      await CategoryService.initialize();

      const categories = await CategoryService.getAllCategories();
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  // ==================== Get Categories ====================
  describe('getAllCategories', () => {
    it('should return all categories', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const categories = await CategoryService.getAllCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should return categories sorted by sortOrder', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const categories = await CategoryService.getAllCategories();

      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].sortOrder).toBeGreaterThanOrEqual(
          categories[i - 1].sortOrder,
        );
      }
    });

    it('should include default categories', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const categories = await CategoryService.getAllCategories();
      const categoryIds = categories.map(c => c.id);

      expect(categoryIds).toContain('email');
      expect(categoryIds).toContain('social');
      expect(categoryIds).toContain('banking');
    });
  });

  describe('getCategoryById', () => {
    it('should return category by ID', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const category = await CategoryService.getCategoryById('email');

      expect(category).not.toBeNull();
      expect(category?.id).toBe('email');
    });

    it('should return null for non-existent category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const category = await CategoryService.getCategoryById('non-existent');

      expect(category).toBeNull();
    });
  });

  // ==================== Create Category ====================
  describe('createCategory', () => {
    it('should create new custom category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Work',
        'briefcase',
        '#9C27B0',
      );

      expect(category.name).toBe('Work');
      expect(category.icon).toBe('briefcase');
      expect(category.color).toBe('#9C27B0');
      expect(category.isCustom).toBe(true);
    });

    it('should generate unique ID', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category1 = await CategoryService.createCategory(
        'Cat1',
        'icon1',
        '#111111',
      );
      const category2 = await CategoryService.createCategory(
        'Cat2',
        'icon2',
        '#222222',
      );

      expect(category1.id).not.toBe(category2.id);
      expect(category1.id).toMatch(/^custom_/);
    });

    it('should throw error for empty name', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(
        CategoryService.createCategory('', 'icon', '#111111'),
      ).rejects.toThrow('Category name is required');
    });

    it('should throw error for duplicate name', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await CategoryService.createCategory('Shopping', 'cart', '#123456');

      await expect(
        CategoryService.createCategory('Shopping', 'cart', '#123456'),
      ).rejects.toThrow('Category name already exists');
    });

    it('should handle case-insensitive duplicate check', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await CategoryService.createCategory('Games', 'game', '#654321');

      await expect(
        CategoryService.createCategory('GAMES', 'game', '#654321'),
      ).rejects.toThrow('Category name already exists');
    });

    it('should trim whitespace from name', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        '  Travel  ',
        'plane',
        '#FF6B6B',
      );

      expect(category.name).toBe('Travel');
    });

    it('should include description if provided', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Work',
        'briefcase',
        '#9C27B0',
        'Work-related accounts',
      );

      expect(category.description).toBe('Work-related accounts');
    });

    it('should add to parent children if parentId provided', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const parent = await CategoryService.createCategory(
        'Parent',
        'folder',
        '#111111',
      );

      const child = await CategoryService.createCategory(
        'Child',
        'folder-open',
        '#222222',
        undefined,
        parent.id,
      );

      expect(child.parentId).toBe(parent.id);
      const updatedParent = await CategoryService.getCategoryById(parent.id);
      expect(updatedParent?.children).toContainEqual(
        expect.objectContaining({ id: child.id }),
      );
    });
  });

  // ==================== Update Category ====================
  describe('updateCategory', () => {
    it('should update category name', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Old Name',
        'icon',
        '#111111',
      );

      const updated = await CategoryService.updateCategory(category.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
    });

    it('should throw error for non-existent category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(
        CategoryService.updateCategory('non-existent', { name: 'New' }),
      ).rejects.toThrow('Category not found');
    });

    it('should prevent modifying default categories', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(
        CategoryService.updateCategory('email', { name: 'New Email' }),
      ).rejects.toThrow('Cannot modify core properties of default categories');
    });

    it('should check name uniqueness on update', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const cat1 = await CategoryService.createCategory('Cat1', 'i1', '#111');
      await CategoryService.createCategory('Cat2', 'i2', '#222');

      await expect(
        CategoryService.updateCategory(cat1.id, { name: 'Cat2' }),
      ).rejects.toThrow('Category name already exists');
    });

    it('should allow updating to same name', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Work',
        'briefcase',
        '#111111',
      );

      const updated = await CategoryService.updateCategory(category.id, {
        name: 'Work',
      });

      expect(updated.name).toBe('Work');
    });

    it('should update color and icon', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Category',
        'old-icon',
        '#111111',
      );

      const updated = await CategoryService.updateCategory(category.id, {
        color: '#FF0000',
        icon: 'new-icon',
      });

      expect(updated.color).toBe('#FF0000');
      expect(updated.icon).toBe('new-icon');
    });
  });

  // ==================== Delete Category ====================
  describe('deleteCategory', () => {
    it('should delete custom category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'ToDelete',
        'trash',
        '#FF0000',
      );

      await CategoryService.deleteCategory(category.id);

      const deleted = await CategoryService.getCategoryById(category.id);
      expect(deleted).toBeNull();
    });

    it('should throw error for non-existent category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(
        CategoryService.deleteCategory('non-existent'),
      ).rejects.toThrow('Category not found');
    });

    it('should prevent deleting default categories', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await expect(CategoryService.deleteCategory('email')).rejects.toThrow(
        'Cannot delete default categories',
      );
    });

    it('should throw error when deleting category with entries without target', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'HasEntries',
        'icon',
        '#111111',
      );

      // Manually update entry count
      await CategoryService.updateCategoryEntryCount(category.id, 5);

      await expect(CategoryService.deleteCategory(category.id)).rejects.toThrow(
        'Cannot delete category with entries',
      );
    });

    it('should delete category with entries if moveEntriesTo provided', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'HasEntries',
        'icon',
        '#111111',
      );
      await CategoryService.updateCategoryEntryCount(category.id, 5);

      await CategoryService.deleteCategory(category.id, 'email');

      const deleted = await CategoryService.getCategoryById(category.id);
      expect(deleted).toBeNull();
    });

    it('should remove from parent children if child category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const parent = await CategoryService.createCategory(
        'Parent',
        'folder',
        '#111111',
      );
      const child = await CategoryService.createCategory(
        'Child',
        'folder-open',
        '#222222',
        undefined,
        parent.id,
      );

      await CategoryService.deleteCategory(child.id);

      const updatedParent = await CategoryService.getCategoryById(parent.id);
      expect(
        updatedParent?.children?.find(c => c.id === child.id),
      ).toBeUndefined();
    });
  });

  // ==================== Reset to Defaults ====================
  describe('resetToDefaultCategories', () => {
    it('should reset categories to default', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      // Add custom category
      await CategoryService.createCategory('Custom', 'star', '#FF00FF');

      await CategoryService.resetToDefaultCategories();

      const categories = await CategoryService.getAllCategories();
      const customCat = categories.find(c => c.id === 'custom');

      expect(customCat).toBeUndefined();
      expect(categories).toContainEqual(
        expect.objectContaining({ id: 'email' }),
      );
    });

    it('should clear stats cache on reset', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await CategoryService.createCategory('Custom', 'icon', '#111111');
      await CategoryService.updateCategoryUsage('custom');

      await CategoryService.resetToDefaultCategories();

      const stats =
        (await CategoryService.getCategoryStats()) as CategoryStats[];
      expect(stats.length).toBe(0);
    });
  });

  // ==================== Category Usage ====================
  describe('updateCategoryUsage', () => {
    it('should update usage statistics', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Usage Test',
        'icon',
        '#111111',
      );

      await CategoryService.updateCategoryUsage(category.id, 'view');

      const stats = (await CategoryService.getCategoryStats(
        category.id,
      )) as CategoryStats;
      expect(stats.totalUsage).toBe(1);
    });

    it('should update lastUsed timestamp', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Time Test',
        'icon',
        '#111111',
      );
      const before = new Date();

      await CategoryService.updateCategoryUsage(category.id);

      const after = new Date();
      const updated = await CategoryService.getCategoryById(category.id);

      expect(updated?.lastUsed?.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(updated?.lastUsed?.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should calculate average usage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Avg Usage',
        'icon',
        '#111111',
      );

      await CategoryService.updateCategoryEntryCount(category.id, 5);
      await CategoryService.updateCategoryUsage(category.id);
      await CategoryService.updateCategoryUsage(category.id);
      await CategoryService.updateCategoryUsage(category.id);

      const stats = (await CategoryService.getCategoryStats(
        category.id,
      )) as CategoryStats;

      expect(stats.averageUsage).toBe(3 / 5); // 3 usages / 5 entries
    });
  });

  // ==================== Entry Count Management ====================
  describe('updateCategoryEntryCount', () => {
    it('should increase entry count', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Count Test',
        'icon',
        '#111111',
      );

      await CategoryService.updateCategoryEntryCount(category.id, 3);

      const updated = await CategoryService.getCategoryById(category.id);
      expect(updated?.entryCount).toBe(3);
    });

    it('should decrease entry count', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Decrease Test',
        'icon',
        '#111111',
      );

      await CategoryService.updateCategoryEntryCount(category.id, 5);
      await CategoryService.updateCategoryEntryCount(category.id, -2);

      const updated = await CategoryService.getCategoryById(category.id);
      expect(updated?.entryCount).toBe(3);
    });

    it('should not go below zero', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Min Test',
        'icon',
        '#111111',
      );

      await CategoryService.updateCategoryEntryCount(category.id, 2);
      await CategoryService.updateCategoryEntryCount(category.id, -5);

      const updated = await CategoryService.getCategoryById(category.id);
      expect(updated?.entryCount).toBe(0);
    });
  });

  // ==================== Category Statistics ====================
  describe('getCategoryStats', () => {
    it('should return stats for specific category', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const category = await CategoryService.createCategory(
        'Stats Test',
        'icon',
        '#111111',
      );

      const stats = (await CategoryService.getCategoryStats(
        category.id,
      )) as CategoryStats;

      expect(stats.categoryId).toBe(category.id);
      expect(stats.entryCount).toBeDefined();
      expect(stats.totalUsage).toBeDefined();
    });

    it('should return all stats when no ID provided', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const stats =
        (await CategoryService.getCategoryStats()) as CategoryStats[];

      expect(Array.isArray(stats)).toBe(true);
    });
  });

  // ==================== Search Categories ====================
  describe('searchCategories', () => {
    it('should search by name', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await CategoryService.createCategory('Work', 'briefcase', '#111111');
      await CategoryService.createCategory('Shopping', 'cart', '#222222');

      const results = await CategoryService.searchCategories('work');

      expect(results).toContainEqual(expect.objectContaining({ name: 'Work' }));
      expect(results.find(c => c.name === 'Shopping')).toBeUndefined();
    });

    it('should search case-insensitively', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await CategoryService.createCategory('Games', 'game', '#111111');

      const results = await CategoryService.searchCategories('GAMES');

      expect(results).toContainEqual(
        expect.objectContaining({ name: 'Games' }),
      );
    });

    it('should search by description', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await CategoryService.createCategory(
        'Finance',
        'money',
        '#111111',
        'Banking and investment accounts',
      );

      const results = await CategoryService.searchCategories('banking');

      expect(results).toContainEqual(
        expect.objectContaining({ name: 'Finance' }),
      );
    });

    it('should return all categories for empty query', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const results = await CategoryService.searchCategories('');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ==================== Sync Statistics ====================
  describe('syncCategoryStats', () => {
    it('should sync entry counts from password entries', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user',
          password: 'pass',
          category: 'email',
        },
        {
          id: '2',
          title: 'Facebook',
          username: 'user',
          password: 'pass',
          category: 'social',
        },
        {
          id: '3',
          title: 'Gmail2',
          username: 'user',
          password: 'pass',
          category: 'email',
        },
      ];

      await CategoryService.syncCategoryStats(entries);

      const emailStats = (await CategoryService.getCategoryStats(
        'email',
      )) as CategoryStats;
      const socialStats = (await CategoryService.getCategoryStats(
        'social',
      )) as CategoryStats;

      expect(emailStats.entryCount).toBe(2);
      expect(socialStats.entryCount).toBe(1);
    });
  });
});
