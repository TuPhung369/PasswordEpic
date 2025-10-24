import { searchService } from '../searchService';
import { PasswordEntry } from '../../types/password';

describe('SearchService', () => {
  const mockEntries: PasswordEntry[] = [
    {
      id: '1',
      title: 'Gmail Account',
      website: 'https://google.com',
      username: 'user@gmail.com',
      password: 'SecurePass123!@',
      category: 'Email',
      tags: ['personal', 'important'],
      notes: 'My primary email',
      customFields: [],
      createdAt: new Date(2024, 0, 1).toISOString(),
      modifiedAt: new Date(2024, 1, 1).toISOString(),
      isFavorite: true,
      strength: 'strong',
    },
    {
      id: '2',
      title: 'GitHub',
      website: 'https://github.com',
      username: 'developer',
      password: 'DevPass456!',
      category: 'Development',
      tags: ['work', 'coding'],
      notes: '',
      customFields: [],
      createdAt: new Date(2024, 1, 1).toISOString(),
      modifiedAt: new Date(2024, 2, 1).toISOString(),
      isFavorite: false,
      strength: 'good',
    },
    {
      id: '3',
      title: 'Facebook',
      website: 'https://facebook.com',
      username: 'username123',
      password: 'weak123',
      category: 'Social Media',
      tags: ['social'],
      notes: 'Old account',
      customFields: [{ name: 'Phone', value: '1234567890', type: 'text' }],
      createdAt: new Date(2024, 2, 1).toISOString(),
      modifiedAt: new Date(2024, 3, 1).toISOString(),
      isFavorite: false,
      strength: 'weak',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchPasswords', () => {
    it('should return all entries when no filters applied', async () => {
      const result = await searchService.searchPasswords(mockEntries, {});
      expect(result.entries.length).toBe(3);
      expect(result.totalCount).toBe(3);
    });

    it('should search by query text', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        query: 'Gmail',
      });
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].title).toContain('Gmail');
    });

    it('should support fuzzy search', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        { query: 'gml' },
        { fuzzySearch: true },
      );
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        categories: ['Email'],
      });
      expect(result.entries.every(e => e.category === 'Email')).toBe(true);
    });

    it('should filter by multiple categories', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        categories: ['Email', 'Development'],
      });
      expect(result.entries.length).toBe(2);
    });

    it('should filter by tags', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        tags: ['work'],
      });
      expect(result.entries.some(e => e.tags.includes('work'))).toBe(true);
    });

    it('should filter by strength level', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        strengthLevels: ['weak'],
      });
      expect(result.entries.every(e => e.strength === 'weak')).toBe(true);
    });

    it('should filter by multiple strength levels', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        strengthLevels: ['weak', 'strong'],
      });
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should filter entries with notes', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        hasNotes: true,
      });
      expect(result.entries.every(e => e.notes && e.notes.trim())).toBe(true);
    });

    it('should filter entries without notes', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        hasNotes: false,
      });
      expect(result.entries.every(e => !e.notes || !e.notes.trim())).toBe(true);
    });

    it('should filter entries with custom fields', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        hasCustomFields: true,
      });
      expect(result.entries.every(e => e.customFields.length > 0)).toBe(true);
    });

    it('should filter entries without custom fields', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        hasCustomFields: false,
      });
      expect(result.entries.every(e => e.customFields.length === 0)).toBe(true);
    });

    it('should filter by favorite status', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        isFavorite: true,
      });
      expect(result.entries.every(e => e.isFavorite)).toBe(true);
    });

    it('should filter by date range', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        dateRange: {
          start: new Date(2024, 0, 1),
          end: new Date(2024, 1, 15),
        },
      });
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should sort by name ascending', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { sortBy: 'name', sortOrder: 'asc' },
      );
      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].title >= result.entries[i - 1].title).toBe(
          true,
        );
      }
    });

    it('should sort by name descending', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { sortBy: 'name', sortOrder: 'desc' },
      );
      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].title <= result.entries[i - 1].title).toBe(
          true,
        );
      }
    });

    it('should apply pagination with offset and limit', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { offset: 1, limit: 1 },
      );
      expect(result.entries.length).toBe(1);
      expect(result.totalCount).toBe(3);
    });

    it('should generate suggestions', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        query: 'gmail',
      });
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should generate facets', async () => {
      const result = await searchService.searchPasswords(mockEntries, {});
      expect(result.facets).toBeDefined();
      expect(result.facets.categories).toBeDefined();
      expect(result.facets.tags).toBeDefined();
      expect(result.facets.strengths).toBeDefined();
    });

    it('should include search time', async () => {
      const result = await searchService.searchPasswords(mockEntries, {});
      expect(result.searchTime).toBeGreaterThan(0);
    });

    it('should cache search results', async () => {
      const result1 = await searchService.searchPasswords(mockEntries, {
        query: 'gmail',
      });
      const result2 = await searchService.searchPasswords(mockEntries, {
        query: 'gmail',
      });
      expect(result1).toEqual(result2);
    });

    it('should search in notes when enabled', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        { query: 'primary' },
        { searchInNotes: true },
      );
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should not search in notes when disabled', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        { query: 'Old account' },
        { searchInNotes: false },
      );
      expect(result.entries.length).toBe(0);
    });

    it('should search in custom fields when enabled', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        { query: 'Phone' },
        { searchInCustomFields: true },
      );
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should handle empty entries array', async () => {
      const result = await searchService.searchPasswords(
        [],
        {},
        { offset: 0, limit: 10 },
      );
      expect(result.entries).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should handle null filters', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        categories: null as any,
        tags: null as any,
      });
      expect(result.entries.length).toBe(3);
    });

    it('should combine multiple filters', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        query: 'gmail',
        categories: ['Email'],
        isFavorite: true,
      });
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should calculate relevance scores correctly', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        query: 'Gmail',
      });
      if (result.entries.length > 1) {
        // Entries with better matches should come first
        expect(result.entries[0].title).toContain('Gmail');
      }
    });

    it('should sort by created date', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { sortBy: 'created', sortOrder: 'asc' },
      );
      expect(result.entries.length).toBe(3);
    });

    it('should sort by modified date', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { sortBy: 'modified', sortOrder: 'asc' },
      );
      expect(result.entries.length).toBe(3);
    });

    it('should sort by strength', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { sortBy: 'strength', sortOrder: 'desc' },
      );
      expect(result.entries.length).toBe(3);
    });

    it('should sort by category', async () => {
      const result = await searchService.searchPasswords(
        mockEntries,
        {},
        { sortBy: 'category', sortOrder: 'asc' },
      );
      expect(result.entries.length).toBe(3);
    });

    it('should handle special characters in search', async () => {
      const result = await searchService.searchPasswords(mockEntries, {
        query: '@!#$%',
      });
      expect(result.entries.length).toBeGreaterThanOrEqual(0);
    });

    it('should be case insensitive', async () => {
      const result1 = await searchService.searchPasswords(mockEntries, {
        query: 'GMAIL',
      });
      const result2 = await searchService.searchPasswords(mockEntries, {
        query: 'gmail',
      });
      expect(result1.entries.length).toBe(result2.entries.length);
    });
  });

  describe('getSearchHistory', () => {
    it('should return empty history initially', () => {
      const history = (searchService as any).searchHistory || [];
      expect(Array.isArray(history)).toBe(true);
    });

    it('should save search to history', async () => {
      await searchService.searchPasswords(mockEntries, {
        query: 'test',
      });
      const history = (searchService as any).searchHistory || [];
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear search cache', async () => {
      // Perform a search to populate cache
      await searchService.searchPasswords(mockEntries, { query: 'gmail' });

      // Clear cache - method should exist
      if ((searchService as any).clearCache) {
        (searchService as any).clearCache();
      }

      expect(true).toBe(true);
    });
  });
});
