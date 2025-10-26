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
import { getMasterPasswordFromBiometric } from '../services/secureStorageService';
import { getEffectiveMasterPassword } from '../services/staticMasterPasswordService';
import { sessionCache } from '../utils/sessionCache';
import { autofillService } from '../services/autofillService';

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

  // Cache master password to avoid repeated biometric calls
  const [cachedMasterPassword, setCachedMasterPassword] = useState<
    string | null
  >(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);
  const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  // Helper function to get master password when needed
  const getMasterPassword = useCallback(async (): Promise<string> => {
    console.log('🔐 getMasterPassword: Starting authentication process...');
    const authStartTime = Date.now();

    // First priority: provided master password (backwards compatibility)
    if (masterPassword) {
      console.log(
        '✅ getMasterPassword: Using provided master password (compatibility mode)',
      );
      return masterPassword;
    }

    // Second priority: check session cache (fastest - in-memory)
    const sessionPassword = sessionCache.get<string>('dynamicMasterPassword');
    if (sessionPassword) {
      console.log('⚡ getMasterPassword: Using session cache (ultra-fast)');
      return sessionPassword;
    }

    // Third priority: check local cache (5-minute timeout)
    const now = Date.now();
    if (cachedMasterPassword && now - cacheTimestamp < CACHE_TIMEOUT) {
      const remainingTime = Math.round(
        (CACHE_TIMEOUT - (now - cacheTimestamp)) / 1000,
      );
      console.log(
        `🎯 getMasterPassword: Using cached password (${remainingTime}s remaining)`,
      );

      // Also cache in session for ultra-fast access
      sessionCache.set(
        'dynamicMasterPassword',
        cachedMasterPassword,
        2 * 60 * 1000,
      ); // 2 minutes
      return cachedMasterPassword;
    }

    // New approach: Use static master password (UUID + email + fixed salt)
    console.log('🔐 [Static] Generating static master password...');
    const staticStart = Date.now();

    try {
      const staticResult = await getEffectiveMasterPassword();
      const staticDuration = Date.now() - staticStart;

      if (staticResult.success && staticResult.password) {
        // Cache the static password in both caches
        setCachedMasterPassword(staticResult.password);
        setCacheTimestamp(now);

        // Also cache in session for ultra-fast access (30 minutes for static)
        sessionCache.set(
          'staticMasterPassword',
          staticResult.password,
          30 * 60 * 1000,
        );

        const totalDuration = Date.now() - authStartTime;
        console.log(
          `✅ [Static] Static master password generated in ${staticDuration}ms (total: ${totalDuration}ms)`,
        );
        return staticResult.password;
      } else {
        console.log(
          `❌ [Static] Static password failed after ${staticDuration}ms: ${staticResult.error}`,
        );
      }
    } catch (staticError) {
      const staticDuration = Date.now() - staticStart;
      console.error(
        `💥 [Static] Static password error after ${staticDuration}ms:`,
        staticError,
      );
    }

    // Fallback: Try biometric authentication (for migration compatibility)
    console.log('🔐 [Fallback] Trying biometric authentication...');
    const biometricStart = Date.now();

    try {
      const result = await getMasterPasswordFromBiometric();
      const biometricDuration = Date.now() - biometricStart;

      if (result.success && result.password) {
        // Cache the password in both caches
        setCachedMasterPassword(result.password);
        setCacheTimestamp(now);

        // Also cache in session for ultra-fast access (2 minutes)
        sessionCache.set(
          'dynamicMasterPassword',
          result.password,
          2 * 60 * 1000,
        );

        const totalDuration = Date.now() - authStartTime;
        console.log(
          `✅ [Fallback] Biometric master password cached after ${biometricDuration}ms (total: ${totalDuration}ms)`,
        );
        return result.password;
      } else {
        console.log(
          `❌ [Fallback] Biometric failed after ${biometricDuration}ms: ${result.error}`,
        );
      }
    } catch (biometricError) {
      const biometricDuration = Date.now() - biometricStart;
      console.error(
        `💥 [Fallback] Biometric error after ${biometricDuration}ms:`,
        biometricError,
      );
    }

    // If all methods fail, throw error
    throw new Error(
      'Master password required - please authenticate or sign in with Google',
    );
  }, [masterPassword, cachedMasterPassword, cacheTimestamp, CACHE_TIMEOUT]);

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

      // Prepare autofill credentials for Android autofill service
      try {
        await autofillService.prepareCredentialsForAutofill(
          passwords,
          masterPassword,
        );
        console.log('✅ Autofill credentials prepared on initial load');
      } catch (autofillError) {
        console.warn('Failed to prepare autofill credentials:', autofillError);
        // Don't throw - autofill is a secondary feature
      }
    } catch (loadError) {
      console.error('Failed to load initial data:', loadError);
    }
  }, [dispatch, masterPassword, passwords]);

  // Create new password entry
  const createPassword = useCallback(
    async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const createPasswordStart = Date.now();
      console.log('🏁 createPassword: Starting password creation...');

      const masterPasswordStart = Date.now();
      const currentMasterPassword = await getMasterPassword();
      const masterPasswordDuration = Date.now() - masterPasswordStart;

      const newEntry: PasswordEntry = {
        ...entry,
        id: `pwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
        frequencyScore: 0,
      };

      try {
        // Save password (most important operation)
        const saveStart = Date.now();
        await dispatch(
          savePassword({
            entry: newEntry,
            masterPassword: currentMasterPassword,
          }),
        ).unwrap();
        const saveDuration = Date.now() - saveStart;

        // Run secondary operations in parallel (non-blocking)
        const backgroundStart = Date.now();
        Promise.all([
          // Update category stats in background
          newEntry.category
            ? CategoryService.updateCategoryEntryCount(newEntry.category, 1)
            : Promise.resolve(),
          // Add to sync queue in background
          SyncService.addPendingOperation('create', newEntry.id, newEntry),
          // Update autofill cache with all current passwords
          (async () => {
            try {
              // Get current passwords from store
              const allPasswords = [...passwords, newEntry];
              await autofillService.prepareCredentialsForAutofill(
                allPasswords,
                currentMasterPassword,
              );
              console.log('✅ Autofill credentials updated');
            } catch (autofillError) {
              console.warn('Failed to update autofill cache:', autofillError);
              // Don't throw - autofill is a secondary feature
            }
          })(),
        ]).catch(bgError => {
          console.warn('Background operations failed:', bgError);
          // Don't throw - these are non-critical
        });
        const backgroundDuration = Date.now() - backgroundStart;

        // Log performance breakdown
        const totalDuration = Date.now() - createPasswordStart;
        console.log(
          `✅ createPassword: Password created successfully in ${totalDuration}ms`,
        );
        console.log(`   - Get Master Password: ${masterPasswordDuration}ms`);
        console.log(`   - Redux Save: ${saveDuration}ms`);
        console.log(`   - Background Tasks: ${backgroundDuration}ms`);

        return newEntry;
      } catch (createError) {
        const totalDuration = Date.now() - createPasswordStart;
        console.error(
          `❌ createPassword: Failed after ${totalDuration}ms:`,
          createError,
        );
        throw createError;
      }
    },
    [dispatch, getMasterPassword],
  );

  // Update existing password entry
  const updatePassword = useCallback(
    async (id: string, updatedData: Partial<PasswordEntry>) => {
      try {
        const currentMasterPassword = await getMasterPassword();

        const existingPassword = passwords.find(p => p.id === id);
        if (!existingPassword) {
          throw new Error('Password not found');
        }

        const updatedEntry: PasswordEntry = {
          ...existingPassword,
          ...updatedData,
          updatedAt: new Date(),
        };

        // Use the savePassword thunk which handles encryption and storage
        await dispatch(
          savePassword({
            entry: updatedEntry,
            masterPassword: currentMasterPassword,
          }),
        ).unwrap();

        // Update autofill cache with all passwords including the updated one
        try {
          const updatedPasswordsList = passwords.map(p =>
            p.id === id ? updatedEntry : p,
          );
          await autofillService.prepareCredentialsForAutofill(
            updatedPasswordsList,
            currentMasterPassword,
          );
          console.log('✅ Autofill credentials updated');
        } catch (autofillError) {
          console.warn('Failed to update autofill cache:', autofillError);
          // Don't throw - autofill is a secondary feature
        }

        return updatedEntry;
      } catch (updateError) {
        console.error('Failed to update password:', updateError);
        throw updateError;
      }
    },
    [dispatch, getMasterPassword, passwords],
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

        // Update autofill cache with remaining passwords
        try {
          const currentMasterPassword = await getMasterPassword();
          const remainingPasswords = passwords.filter(p => p.id !== id);
          await autofillService.prepareCredentialsForAutofill(
            remainingPasswords,
            currentMasterPassword,
          );
          console.log('✅ Autofill credentials updated after delete');
        } catch (autofillError) {
          console.warn(
            'Failed to update autofill cache after delete:',
            autofillError,
          );
          // Don't throw - autofill is a secondary feature
        }

        return true;
      } catch (deleteError) {
        console.error('Failed to delete password:', deleteError);
        throw deleteError;
      }
    },
    [dispatch, passwords, getMasterPassword],
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
