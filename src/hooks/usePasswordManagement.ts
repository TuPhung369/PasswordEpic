import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { RootState } from '../store';
import {
  loadPasswords,
  savePassword,
  removePassword,
  searchPasswords,
  loadCategories,
  loadFavorites,
  loadFrequentlyUsed,
  setSearchQuery,
  setSelectedCategory,
  clearError,
} from '../store/slices/passwordsSlice';
import {
  PasswordEntry,
  SearchFilters,
  SortOptions,
  BulkOperation,
} from '../types/password';
import {
  searchPasswords as utilSearchPasswords,
  filterPasswords,
  sortPasswords,
} from '../utils/passwordUtils';
// import { encryptedDatabase } from '../services/encryptedDatabaseService'; // Will be used in future implementations
import CategoryService from '../services/categoryService';
import SyncService from '../services/syncService';

export const usePasswordManagement = (masterPassword?: string) => {
  const dispatch = useAppDispatch();
  const {
    passwords,
    categories,
    favorites,
    frequentlyUsed,
    isLoading,
    error,
    searchQuery,
    selectedCategory,
  } = useAppSelector((state: RootState) => state.passwords);

  // Local state for advanced filtering and sorting
  const [localFilters, setLocalFilters] = useState<SearchFilters>({
    query: '',
    categories: [],
    tags: [],
    favorites: false,
    weakPasswords: false,
    duplicates: false,
    compromised: false,
  });

  const [sortOptions, setSortOptions] = useState<SortOptions>({
    field: 'title',
    direction: 'asc',
  });

  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Computed filtered and sorted passwords
  const filteredPasswords = useCallback(() => {
    let result = passwords;

    // Apply search query
    if (searchQuery || localFilters.query) {
      const query = localFilters.query || searchQuery;
      result = utilSearchPasswords(result, query);
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Apply advanced filters
    result = filterPasswords(result, localFilters);

    // Apply sorting
    result = sortPasswords(result, sortOptions.field, sortOptions.direction);

    return result;
  }, [passwords, searchQuery, localFilters, selectedCategory, sortOptions]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    if (!masterPassword) return;

    try {
      await Promise.all([
        dispatch(loadPasswords(masterPassword)).unwrap(),
        dispatch(loadCategories()).unwrap(),
        dispatch(loadFavorites(masterPassword)).unwrap(),
        dispatch(loadFrequentlyUsed(masterPassword)).unwrap(),
      ]);

      // Sync category stats
      await CategoryService.syncCategoryStats(passwords);
    } catch (loadError) {
      console.error('Failed to load initial data:', loadError);
    }
  }, [dispatch, masterPassword, passwords]);

  // Create new password entry
  const createPassword = useCallback(
    async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!masterPassword) throw new Error('Master password required');

      const newEntry: PasswordEntry = {
        ...entry,
        id: `pwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
        frequencyScore: 0,
      };

      try {
        await dispatch(
          savePassword({ entry: newEntry, masterPassword }),
        ).unwrap();

        // Update category stats
        if (newEntry.category) {
          await CategoryService.updateCategoryEntryCount(newEntry.category, 1);
        }

        // Add to sync queue
        await SyncService.addPendingOperation('create', newEntry.id, newEntry);

        return newEntry;
      } catch (createError) {
        console.error('Failed to create password:', createError);
        throw createError;
      }
    },
    [dispatch, masterPassword],
  );

  // Update existing password entry
  const updatePassword = useCallback(
    async (id: string, updates: Partial<PasswordEntry>) => {
      if (!masterPassword) throw new Error('Master password required');

      const existingEntry = passwords.find(p => p.id === id);
      if (!existingEntry) throw new Error('Password entry not found');

      const updatedEntry: PasswordEntry = {
        ...existingEntry,
        ...updates,
        updatedAt: new Date(),
      };

      try {
        await dispatch(
          savePassword({ entry: updatedEntry, masterPassword }),
        ).unwrap();

        // Update category stats if category changed
        if (existingEntry.category !== updatedEntry.category) {
          if (existingEntry.category) {
            await CategoryService.updateCategoryEntryCount(
              existingEntry.category,
              -1,
            );
          }
          if (updatedEntry.category) {
            await CategoryService.updateCategoryEntryCount(
              updatedEntry.category,
              1,
            );
          }
        }

        // Add to sync queue
        await SyncService.addPendingOperation('update', id, updatedEntry);

        return updatedEntry;
      } catch (updateError) {
        console.error('Failed to update password:', updateError);
        throw updateError;
      }
    },
    [dispatch, masterPassword, passwords],
  );

  // Delete password entry
  const deletePassword = useCallback(
    async (id: string) => {
      const existingEntry = passwords.find(p => p.id === id);

      try {
        await dispatch(removePassword(id)).unwrap();

        // Update category stats
        if (existingEntry?.category) {
          await CategoryService.updateCategoryEntryCount(
            existingEntry.category,
            -1,
          );
        }

        // Add to sync queue
        await SyncService.addPendingOperation('delete', id);

        return true;
      } catch (deleteError) {
        console.error('Failed to delete password:', deleteError);
        throw deleteError;
      }
    },
    [dispatch, passwords],
  );

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (id: string) => {
      const entry = passwords.find(p => p.id === id);
      if (!entry) return false;

      return updatePassword(id, { isFavorite: !entry.isFavorite });
    },
    [passwords, updatePassword],
  );

  // Update last used timestamp
  const markAsUsed = useCallback(
    async (id: string) => {
      const entry = passwords.find(p => p.id === id);
      if (!entry) return false;

      const now = new Date();
      const newAccessCount = (entry.accessCount || 0) + 1;

      return updatePassword(id, {
        lastUsed: now,
        accessCount: newAccessCount,
        frequencyScore: calculateFrequencyScore(
          newAccessCount,
          entry.createdAt,
          now,
        ),
      });
    },
    [passwords, updatePassword],
  );

  // Bulk operations
  const performBulkOperation = useCallback(
    async (operation: BulkOperation) => {
      if (!masterPassword) throw new Error('Master password required');

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const entryId of operation.entryIds) {
        try {
          switch (operation.type) {
            case 'delete':
              await deletePassword(entryId);
              break;
            case 'move':
              if (operation.targetCategory) {
                await updatePassword(entryId, {
                  category: operation.targetCategory,
                });
              }
              break;
            case 'update':
              if (operation.updateData) {
                await updatePassword(entryId, operation.updateData);
              }
              break;
            case 'export':
              // Export functionality would be implemented here
              break;
          }
          results.successful++;
        } catch (bulkError) {
          results.failed++;
          results.errors.push(
            `Failed to ${operation.type} entry ${entryId}: ${bulkError}`,
          );
        }
      }

      // Clear bulk selection after operation
      setBulkSelection(new Set());

      return results;
    },
    [masterPassword, deletePassword, updatePassword],
  );

  // Search functionality
  const performSearch = useCallback(
    async (query: string) => {
      if (!masterPassword) return;

      dispatch(setSearchQuery(query));

      if (query.trim()) {
        try {
          await dispatch(searchPasswords({ query, masterPassword })).unwrap();
        } catch (searchError) {
          console.error('Search failed:', searchError);
        }
      } else {
        // If query is empty, reload all passwords
        await dispatch(loadPasswords(masterPassword)).unwrap();
      }
    },
    [dispatch, masterPassword],
  );

  // Filter by category
  const filterByCategory = useCallback(
    (categoryId: string) => {
      dispatch(setSelectedCategory(categoryId));
    },
    [dispatch],
  );

  // Advanced filtering
  const applyFilters = useCallback((filters: Partial<SearchFilters>) => {
    setLocalFilters(prev => ({ ...prev, ...filters }));
  }, []);

  // Sorting
  const applySorting = useCallback(
    (field: SortOptions['field'], direction?: SortOptions['direction']) => {
      setSortOptions(prev => ({
        field,
        direction:
          direction ||
          (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'),
      }));
    },
    [],
  );

  // Bulk selection management
  const toggleBulkSelection = useCallback((entryId: string) => {
    setBulkSelection(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(entryId)) {
        newSelection.delete(entryId);
      } else {
        newSelection.add(entryId);
      }
      return newSelection;
    });
  }, []);

  const selectAll = useCallback(() => {
    setBulkSelection(new Set(filteredPasswords().map(p => p.id)));
  }, [filteredPasswords]);

  const clearSelection = useCallback(() => {
    setBulkSelection(new Set());
  }, []);

  // Refresh data
  const refresh = useCallback(async () => {
    if (!masterPassword) return;

    setIsRefreshing(true);
    try {
      await loadInitialData();

      // Try to sync if online
      const syncStatus = SyncService.getSyncStatus();
      if (syncStatus.isOnline && syncStatus.pendingOperations > 0) {
        await SyncService.performSync(masterPassword);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [masterPassword, loadInitialData]);

  // Clear any errors
  const clearErrors = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Get password statistics
  const getStatistics = useCallback(() => {
    const allPasswords = passwords;
    const filtered = filteredPasswords();

    return {
      total: allPasswords.length,
      filtered: filtered.length,
      favorites: allPasswords.filter(p => p.isFavorite).length,
      categories: categories.length,
      weakPasswords: allPasswords.filter(_p => {
        // Would use password strength calculation here
        return false; // Placeholder
      }).length,
      recentlyUsed: allPasswords.filter(p => {
        if (!p.lastUsed) return false;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return p.lastUsed > weekAgo;
      }).length,
    };
  }, [passwords, categories, filteredPasswords]);

  // Initialize data on mount
  useEffect(() => {
    if (masterPassword) {
      loadInitialData();
    }
  }, [masterPassword, loadInitialData]);

  return {
    // State
    passwords: filteredPasswords(),
    allPasswords: passwords,
    categories,
    favorites,
    frequentlyUsed,
    isLoading: isLoading || isRefreshing,
    error,
    searchQuery,
    selectedCategory,
    localFilters,
    sortOptions,
    bulkSelection,
    statistics: getStatistics(),

    // Actions
    createPassword,
    updatePassword,
    deletePassword,
    toggleFavorite,
    markAsUsed,
    performBulkOperation,
    performSearch,
    filterByCategory,
    applyFilters,
    applySorting,
    toggleBulkSelection,
    selectAll,
    clearSelection,
    refresh,
    clearErrors,
  };
};

// Helper function to calculate frequency score
const calculateFrequencyScore = (
  accessCount: number,
  createdAt: Date,
  lastUsed: Date,
): number => {
  const daysSinceCreated = Math.max(
    1,
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysSinceLastUsed =
    (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);

  // Calculate usage frequency (uses per day)
  const usageFrequency = accessCount / daysSinceCreated;

  // Apply recency factor (more recent usage = higher score)
  const recencyFactor = Math.max(0.1, 1 - daysSinceLastUsed / 30); // Decrease over 30 days

  // Normalize to 0-100 scale
  const score = Math.min(100, usageFrequency * recencyFactor * 100);

  return Math.round(score);
};

export default usePasswordManagement;
