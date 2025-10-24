import { PasswordEntry } from '../types/password';

export interface SearchFilters {
  query: string;
  categories: string[];
  tags: string[];
  strengthLevels: ('weak' | 'fair' | 'good' | 'strong')[];
  hasNotes: boolean | null;
  hasCustomFields: boolean | null;
  isCompromised: boolean | null;
  isFavorite: boolean | null;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  lastUsedRange: {
    start: Date | null;
    end: Date | null;
  };
}

export interface SearchOptions {
  sortBy:
    | 'name'
    | 'category'
    | 'created'
    | 'modified'
    | 'lastUsed'
    | 'strength';
  sortOrder: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  fuzzySearch: boolean;
  searchInNotes: boolean;
  searchInCustomFields: boolean;
}

export interface SearchResult {
  entries: PasswordEntry[];
  totalCount: number;
  searchTime: number;
  suggestions: string[];
  facets: {
    categories: { name: string; count: number }[];
    tags: { name: string; count: number }[];
    strengths: { level: string; count: number }[];
  };
}

export interface SearchHistory {
  id: string;
  query: string;
  filters: Partial<SearchFilters>;
  timestamp: Date;
  resultCount: number;
}

class SearchService {
  private searchHistory: SearchHistory[] = [];
  private popularSearches: { query: string; count: number }[] = [];
  private searchCache = new Map<
    string,
    { result: SearchResult; timestamp: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Main search function
  async searchPasswords(
    entries: PasswordEntry[],
    filters: Partial<SearchFilters>,
    options: Partial<SearchOptions> = {},
  ): Promise<SearchResult> {
    const startTime = performance.now();

    const cacheKey = this.generateCacheKey(filters, options);
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    const searchOptions: SearchOptions = {
      sortBy: 'name',
      sortOrder: 'asc',
      fuzzySearch: true,
      searchInNotes: true,
      searchInCustomFields: true,
      ...options,
    };

    let filteredEntries = [...entries];

    // Apply text search
    if (filters.query && filters.query.trim()) {
      filteredEntries = this.applyTextSearch(
        filteredEntries,
        filters.query,
        searchOptions,
      );
    }

    // Apply category filters
    if (filters.categories && filters.categories.length > 0) {
      filteredEntries = filteredEntries.filter(entry =>
        filters.categories!.includes(entry.category),
      );
    }

    // Apply tag filters
    if (filters.tags && filters.tags.length > 0) {
      filteredEntries = filteredEntries.filter(entry =>
        entry.tags.some(tag => filters.tags!.includes(tag)),
      );
    }

    // Apply strength filters
    if (filters.strengthLevels && filters.strengthLevels.length > 0) {
      filteredEntries = filteredEntries.filter(entry => {
        const strength = this.calculatePasswordStrength(entry.password);
        return filters.strengthLevels!.includes(strength);
      });
    }

    // Apply boolean filters
    if (filters.hasNotes != null) {
      filteredEntries = filteredEntries.filter(entry =>
        filters.hasNotes ? entry.notes && entry.notes.trim() : !entry.notes,
      );
    }

    if (filters.hasCustomFields != null) {
      filteredEntries = filteredEntries.filter(entry =>
        filters.hasCustomFields
          ? entry.customFields.length > 0
          : entry.customFields.length === 0,
      );
    }

    if (filters.isCompromised != null) {
      filteredEntries = filteredEntries.filter(
        entry => (entry as any).isCompromised === filters.isCompromised,
      );
    }

    if (filters.isFavorite != null) {
      filteredEntries = filteredEntries.filter(
        entry => entry.isFavorite === filters.isFavorite,
      );
    }

    // Apply date range filters
    if (filters.dateRange?.start || filters.dateRange?.end) {
      filteredEntries = filteredEntries.filter(entry => {
        const createdDate = new Date(entry.createdAt);
        if (filters.dateRange!.start && createdDate < filters.dateRange!.start)
          return false;
        if (filters.dateRange!.end && createdDate > filters.dateRange!.end)
          return false;
        return true;
      });
    }

    if (filters.lastUsedRange?.start || filters.lastUsedRange?.end) {
      filteredEntries = filteredEntries.filter(entry => {
        if (!entry.lastUsed) return false;
        const lastUsedDate = new Date(entry.lastUsed);
        if (
          filters.lastUsedRange!.start &&
          lastUsedDate < filters.lastUsedRange!.start
        )
          return false;
        if (
          filters.lastUsedRange!.end &&
          lastUsedDate > filters.lastUsedRange!.end
        )
          return false;
        return true;
      });
    }

    // Sort results
    filteredEntries = this.sortEntries(filteredEntries, searchOptions);

    // Apply pagination
    const totalCount = filteredEntries.length;
    if (searchOptions.offset || searchOptions.limit) {
      const start = searchOptions.offset || 0;
      const end = searchOptions.limit ? start + searchOptions.limit : undefined;
      filteredEntries = filteredEntries.slice(start, end);
    }

    // Generate suggestions and facets
    const suggestions = this.generateSuggestions(filters.query || '', entries);
    const facets = this.generateFacets(entries);

    const searchTime = performance.now() - startTime;

    const result: SearchResult = {
      entries: filteredEntries,
      totalCount,
      searchTime,
      suggestions,
      facets,
    };

    // Cache result
    this.searchCache.set(cacheKey, { result, timestamp: Date.now() });

    // Save to search history
    if (filters.query && filters.query.trim()) {
      this.saveSearchHistory(filters.query, filters, totalCount);
    }

    return result;
  }

  // Text search with fuzzy matching
  private applyTextSearch(
    entries: PasswordEntry[],
    query: string,
    options: SearchOptions,
  ): PasswordEntry[] {
    const normalizedQuery = query.toLowerCase().trim();
    const queryTerms = normalizedQuery.split(/\s+/);

    return entries
      .filter(entry => {
        const searchableText = this.getSearchableText(entry, options);

        if (options.fuzzySearch) {
          return queryTerms.every(term =>
            searchableText.some(text => this.fuzzyMatch(text, term)),
          );
        } else {
          return queryTerms.every(term =>
            searchableText.some(text => text.includes(term)),
          );
        }
      })
      .sort((a, b) => {
        // Sort by relevance score
        const scoreA = this.calculateRelevanceScore(
          a,
          normalizedQuery,
          options,
        );
        const scoreB = this.calculateRelevanceScore(
          b,
          normalizedQuery,
          options,
        );
        return scoreB - scoreA;
      });
  }

  // Get searchable text from entry
  private getSearchableText(
    entry: PasswordEntry,
    options: SearchOptions,
  ): string[] {
    const texts = [
      entry.title.toLowerCase(),
      entry.username.toLowerCase(),
      entry.website.toLowerCase(),
      entry.category.toLowerCase(),
      ...entry.tags.map(tag => tag.toLowerCase()),
    ];

    if (options.searchInNotes && entry.notes) {
      texts.push(entry.notes.toLowerCase());
    }

    if (options.searchInCustomFields) {
      entry.customFields.forEach(field => {
        texts.push(field.name.toLowerCase());
        if (field.type !== 'password') {
          texts.push(field.value.toLowerCase());
        }
      });
    }

    return texts;
  }

  // Fuzzy string matching
  private fuzzyMatch(text: string, pattern: string): boolean {
    const textLen = text.length;
    const patternLen = pattern.length;

    if (patternLen === 0) return true;
    if (textLen === 0) return false;

    // Simple fuzzy matching algorithm
    let textIndex = 0;
    let patternIndex = 0;

    while (textIndex < textLen && patternIndex < patternLen) {
      if (text[textIndex] === pattern[patternIndex]) {
        patternIndex++;
      }
      textIndex++;
    }

    return patternIndex === patternLen;
  }

  // Calculate relevance score for search results
  private calculateRelevanceScore(
    entry: PasswordEntry,
    query: string,
    options: SearchOptions,
  ): number {
    let score = 0;

    // Exact matches get higher scores
    if (entry.title.toLowerCase().includes(query)) score += 10;
    if (entry.website.toLowerCase().includes(query)) score += 8;
    if (entry.username.toLowerCase().includes(query)) score += 6;
    if (entry.category.toLowerCase().includes(query)) score += 4;

    // Tag matches
    entry.tags.forEach(tag => {
      if (tag.toLowerCase().includes(query)) score += 3;
    });

    // Notes and custom fields (if enabled)
    if (options.searchInNotes && entry.notes?.toLowerCase().includes(query)) {
      score += 2;
    }

    if (options.searchInCustomFields) {
      entry.customFields.forEach(field => {
        if (field.name.toLowerCase().includes(query)) score += 2;
        if (
          field.type !== 'password' &&
          field.value.toLowerCase().includes(query)
        ) {
          score += 1;
        }
      });
    }

    // Boost favorites
    if (entry.isFavorite) score += 5;

    // Recently used entries get slight boost
    if (entry.lastUsed) {
      const daysSinceUsed =
        (Date.now() - new Date(entry.lastUsed).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceUsed < 7) score += 2;
    }

    return score;
  }

  // Calculate password strength
  private calculatePasswordStrength(
    password: string,
  ): 'weak' | 'fair' | 'good' | 'strong' {
    let score = 0;

    // Length
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character types
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Complexity patterns
    if (!/(.)\1{2,}/.test(password)) score += 1; // No repeated characters
    if (
      !/012|123|234|345|456|567|678|789|890|abc|bcd|cde/.test(
        password.toLowerCase(),
      )
    )
      score += 1;

    if (score <= 3) return 'weak';
    if (score <= 5) return 'fair';
    if (score <= 7) return 'good';
    return 'strong';
  }

  // Sort entries based on criteria
  private sortEntries(
    entries: PasswordEntry[],
    options: SearchOptions,
  ): PasswordEntry[] {
    return entries.sort((a, b) => {
      let comparison = 0;

      switch (options.sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison =
            a.category.localeCompare(b.category) ||
            a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'modified':
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'lastUsed':
          const aLastUsed = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bLastUsed = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          comparison = aLastUsed - bLastUsed;
          break;
        case 'strength':
          const strengthOrder = { weak: 0, fair: 1, good: 2, strong: 3 };
          const aStrength =
            strengthOrder[this.calculatePasswordStrength(a.password)];
          const bStrength =
            strengthOrder[this.calculatePasswordStrength(b.password)];
          comparison = aStrength - bStrength;
          break;
        default:
          comparison = a.title.localeCompare(b.title);
      }

      return options.sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // Generate search suggestions
  private generateSuggestions(
    query: string,
    entries: PasswordEntry[],
  ): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const normalizedQuery = query.toLowerCase();

    // Add suggestions from entry names
    entries.forEach(entry => {
      if (entry.title.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(entry.title);
      }
      if (entry.website.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(entry.website);
      }
      entry.tags.forEach(tag => {
        if (tag.toLowerCase().includes(normalizedQuery)) {
          suggestions.add(tag);
        }
      });
    });

    // Add popular searches
    this.popularSearches
      .filter(search => search.query.toLowerCase().includes(normalizedQuery))
      .forEach(search => suggestions.add(search.query));

    return Array.from(suggestions).slice(0, 5);
  }

  // Generate faceted search data
  private generateFacets(entries: PasswordEntry[]) {
    const categories = new Map<string, number>();
    const tags = new Map<string, number>();
    const strengths = new Map<string, number>();

    entries.forEach(entry => {
      // Count categories
      categories.set(entry.category, (categories.get(entry.category) || 0) + 1);

      // Count tags
      entry.tags.forEach(tag => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });

      // Count strengths
      const strength = this.calculatePasswordStrength(entry.password);
      strengths.set(strength, (strengths.get(strength) || 0) + 1);
    });

    return {
      categories: Array.from(categories.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(tags.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      strengths: Array.from(strengths.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // Generate cache key
  private generateCacheKey(
    filters: Partial<SearchFilters>,
    options: Partial<SearchOptions>,
  ): string {
    return JSON.stringify({ filters, options });
  }

  // Save search to history
  private saveSearchHistory(
    query: string,
    filters: Partial<SearchFilters>,
    resultCount: number,
  ): void {
    const historyItem: SearchHistory = {
      id: Date.now().toString(),
      query,
      filters,
      timestamp: new Date(),
      resultCount,
    };

    this.searchHistory.unshift(historyItem);
    this.searchHistory = this.searchHistory.slice(0, 50); // Keep last 50 searches

    // Update popular searches
    const existingPopular = this.popularSearches.find(p => p.query === query);
    if (existingPopular) {
      existingPopular.count++;
    } else {
      this.popularSearches.push({ query, count: 1 });
    }

    this.popularSearches.sort((a, b) => b.count - a.count);
    this.popularSearches = this.popularSearches.slice(0, 20);
  }

  // Get search history
  getSearchHistory(): SearchHistory[] {
    return [...this.searchHistory];
  }

  // Get popular searches
  getPopularSearches(): { query: string; count: number }[] {
    return [...this.popularSearches];
  }

  // Clear search history
  clearSearchHistory(): void {
    this.searchHistory = [];
    this.popularSearches = [];
  }

  // Clear search cache
  clearCache(): void {
    this.searchCache.clear();
  }

  // Get saved searches (for quick access)
  getSavedSearches(): Array<{
    name: string;
    filters: SearchFilters;
    options: SearchOptions;
  }> {
    // This would typically be stored in persistent storage
    return [
      {
        name: 'Weak Passwords',
        filters: {
          query: '',
          categories: [],
          tags: [],
          strengthLevels: ['weak'],
          hasNotes: null,
          hasCustomFields: null,
          isCompromised: null,
          isFavorite: null,
          dateRange: { start: null, end: null },
          lastUsedRange: { start: null, end: null },
        },
        options: {
          sortBy: 'strength',
          sortOrder: 'asc',
          fuzzySearch: true,
          searchInNotes: true,
          searchInCustomFields: true,
        },
      },
      {
        name: 'Compromised Accounts',
        filters: {
          query: '',
          categories: [],
          tags: [],
          strengthLevels: [],
          hasNotes: null,
          hasCustomFields: null,
          isCompromised: true,
          isFavorite: null,
          dateRange: { start: null, end: null },
          lastUsedRange: { start: null, end: null },
        },
        options: {
          sortBy: 'modified',
          sortOrder: 'desc',
          fuzzySearch: true,
          searchInNotes: true,
          searchInCustomFields: true,
        },
      },
      {
        name: 'Recently Used',
        filters: {
          query: '',
          categories: [],
          tags: [],
          strengthLevels: [],
          hasNotes: null,
          hasCustomFields: null,
          isCompromised: null,
          isFavorite: null,
          dateRange: { start: null, end: null },
          lastUsedRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            end: null,
          },
        },
        options: {
          sortBy: 'lastUsed',
          sortOrder: 'desc',
          fuzzySearch: true,
          searchInNotes: true,
          searchInCustomFields: true,
        },
      },
    ];
  }
}

export { SearchService };
export const searchService = new SearchService();
export default searchService;
