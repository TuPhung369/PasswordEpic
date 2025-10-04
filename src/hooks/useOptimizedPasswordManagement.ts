// Optimized Password Management Hook - Eliminate redundant getMasterPassword calls
import { useState, useCallback } from 'react';
import { useAppDispatch } from './redux';
import { getEffectiveMasterPassword } from '../services/dynamicMasterPasswordService';
import { PasswordEntry } from '../types/password';
import { savePassword } from '../store/slices/passwordsSlice';

// Global master password cache for the hook
let globalMasterPasswordCache: {
  password: string;
  derivedKey: string;
  timestamp: number;
  sessionId: string;
} | null = null;

const GLOBAL_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useOptimizedPasswordManagement = (masterPassword?: string) => {
  const dispatch = useAppDispatch();

  // Initialize master password once per hook instance
  const [initializedMasterPassword, setInitializedMasterPassword] = useState<
    string | null
  >(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Get or initialize master password ONCE
  const initializeMasterPassword = useCallback(async (): Promise<string> => {
    console.log('🔐 [Optimized] Initializing master password...');

    // Return cached if available and fresh
    if (
      globalMasterPasswordCache &&
      Date.now() - globalMasterPasswordCache.timestamp < GLOBAL_CACHE_TTL
    ) {
      console.log('⚡ [Optimized] Using global cache');
      return globalMasterPasswordCache.password;
    }

    // Return already initialized password
    if (initializedMasterPassword) {
      console.log('✅ [Optimized] Using initialized password');
      return initializedMasterPassword;
    }

    // Generate new master password
    setIsInitializing(true);
    try {
      const startTime = Date.now();

      if (masterPassword) {
        console.log('✅ [Optimized] Using provided password');
        setInitializedMasterPassword(masterPassword);
        return masterPassword;
      }

      const dynamicResult = await getEffectiveMasterPassword();
      const duration = Date.now() - startTime;

      if (dynamicResult.success && dynamicResult.password) {
        // Cache globally for all hook instances
        globalMasterPasswordCache = {
          password: dynamicResult.password,
          derivedKey: dynamicResult.derivedKey || '',
          timestamp: Date.now(),
          sessionId: dynamicResult.sessionId || '',
        };

        setInitializedMasterPassword(dynamicResult.password);
        console.log(
          `✅ [Optimized] Master password initialized in ${duration}ms`,
        );
        return dynamicResult.password;
      } else {
        throw new Error(dynamicResult.error || 'Failed to get master password');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [masterPassword, initializedMasterPassword]);

  // Create password without redundant getMasterPassword calls
  const optimizedCreatePassword = useCallback(
    async (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const createPasswordStart = Date.now();
      console.log('🚀 [Optimized] Starting optimized password creation...');

      // Get master password ONCE (cached after first call)
      const masterPasswordStart = Date.now();
      const currentMasterPassword = await initializeMasterPassword();
      const masterPasswordDuration = Date.now() - masterPasswordStart;

      const newEntry = {
        ...entry,
        id: `pwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 0,
        frequencyScore: 0,
      };

      try {
        // Save password with pre-initialized master password
        const saveStart = Date.now();
        await dispatch(
          savePassword({
            entry: newEntry,
            masterPassword: currentMasterPassword,
          }),
        ).unwrap();
        const saveDuration = Date.now() - saveStart;

        const totalDuration = Date.now() - createPasswordStart;
        console.log(`✅ [Optimized] Password created in ${totalDuration}ms`);
        console.log(
          `   - Master Password: ${masterPasswordDuration}ms (${
            masterPasswordDuration < 50 ? 'CACHED ⚡' : 'GENERATED 🔐'
          })`,
        );
        console.log(`   - Redux Save: ${saveDuration}ms`);

        return newEntry;
      } catch (error) {
        console.error('❌ [Optimized] Password creation failed:', error);
        throw error;
      }
    },
    [dispatch, initializeMasterPassword],
  );

  // Batch operations with single master password fetch
  const optimizedBatchCreatePasswords = useCallback(
    async (
      entries: Array<Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>>,
    ) => {
      console.log(
        `🚀 [Optimized] Starting batch creation of ${entries.length} passwords...`,
      );
      const batchStart = Date.now();

      // Get master password ONCE for entire batch
      const masterPasswordStart = Date.now();
      const currentMasterPassword = await initializeMasterPassword();
      const masterPasswordDuration = Date.now() - masterPasswordStart;

      const results = [];
      const saveStart = Date.now();

      for (const entry of entries) {
        const newEntry = {
          ...entry,
          id: `pwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          accessCount: 0,
          frequencyScore: 0,
        };

        // All entries use the same master password (no redundant fetches)
        await dispatch(
          savePassword({
            entry: newEntry,
            masterPassword: currentMasterPassword,
          }),
        ).unwrap();

        results.push(newEntry);
      }

      const saveDuration = Date.now() - saveStart;
      const totalDuration = Date.now() - batchStart;

      console.log(
        `✅ [Optimized] Batch created ${entries.length} passwords in ${totalDuration}ms`,
      );
      console.log(
        `   - Master Password: ${masterPasswordDuration}ms (once for entire batch)`,
      );
      console.log(`   - Batch Save: ${saveDuration}ms`);
      console.log(
        `   - Average per password: ${Math.round(
          totalDuration / entries.length,
        )}ms`,
      );

      return results;
    },
    [dispatch, initializeMasterPassword],
  );

  return {
    optimizedCreatePassword,
    optimizedBatchCreatePasswords,
    isInitializing,
    // ... other methods
  };
};

// Export cache clear function for logout
export const clearOptimizedPasswordCache = () => {
  globalMasterPasswordCache = null;
  console.log('🗑️ [Optimized] Global master password cache cleared');
};
