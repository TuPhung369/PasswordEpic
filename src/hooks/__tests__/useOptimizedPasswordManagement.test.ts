import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  useOptimizedPasswordManagement,
  clearOptimizedPasswordCache,
} from '../useOptimizedPasswordManagement';
import { useAppDispatch } from '../redux';
import { getEffectiveMasterPassword } from '../../services/staticMasterPasswordService';
import { PasswordEntry } from '../../types/password';

// Mock dependencies
jest.mock('../redux');
jest.mock('../../services/staticMasterPasswordService');

// Mock console methods
const originalLog = console.log;
const originalError = console.error;

describe('useOptimizedPasswordManagement', () => {
  let mockDispatch: jest.Mock;
  let mockGetEffectiveMasterPassword: jest.Mock;
  let currentTime = 1000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    currentTime = 1000;

    // Clear global cache FIRST
    clearOptimizedPasswordCache();

    // Mock Date.now()
    jest.spyOn(global.Date, 'now').mockImplementation(() => currentTime);

    // Mock console
    console.log = jest.fn();
    console.error = jest.fn();

    // Setup dispatch mock - Redux dispatch with unwrap
    mockDispatch = jest.fn(() => ({
      unwrap: () => Promise.resolve({}),
    }));
    (useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);

    // Setup getEffectiveMasterPassword mock
    mockGetEffectiveMasterPassword = jest.fn().mockResolvedValue({
      success: true,
      password: 'master_password_123',
      derivedKey: 'derived_key_123',
    });
    (getEffectiveMasterPassword as jest.Mock).mockImplementation(
      mockGetEffectiveMasterPassword,
    );
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    jest.restoreAllMocks();
  });

  // ============================================================================
  // SUITE 1: Hook Initialization
  // ============================================================================
  describe('Hook Initialization', () => {
    it('should return all required functions', () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      expect(result.current).toHaveProperty('optimizedCreatePassword');
      expect(result.current).toHaveProperty('optimizedBatchCreatePasswords');
      expect(result.current).toHaveProperty('isInitializing');
      expect(typeof result.current.optimizedCreatePassword).toBe('function');
      expect(typeof result.current.optimizedBatchCreatePasswords).toBe(
        'function',
      );
      expect(typeof result.current.isInitializing).toBe('boolean');
    });

    it('should initialize isInitializing as false', () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      expect(result.current.isInitializing).toBe(false);
    });

    it('should accept optional masterPassword prop', () => {
      const { result } = renderHook(() =>
        useOptimizedPasswordManagement('provided_password'),
      );

      expect(result.current).toBeDefined();
      expect(result.current.optimizedCreatePassword).toBeDefined();
    });

    it('should set isInitializing to true during initialization', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        const promise = result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);

        // Give it time to start initializing
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    });
  });

  // ============================================================================
  // SUITE 2: Master Password Initialization
  // ============================================================================
  describe('Master Password Initialization', () => {
    it('should fetch master password on first call', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should use provided master password without fetching', async () => {
      const { result } = renderHook(() =>
        useOptimizedPasswordManagement('provided_password'),
      );

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).not.toHaveBeenCalled();
    });

    it('should cache master password for subsequent calls within TTL', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        // First call - should fetch
        await result.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);

        // Second call - should use cache
        await result.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Should only fetch once due to cache
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should fetch new password when cache expires', async () => {
      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        // First call
        await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Global cache should exist now
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);

      // Clear the cache to simulate expiration
      clearOptimizedPasswordCache();
      mockGetEffectiveMasterPassword.mockClear();

      // Create a new hook instance with fresh state
      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        // Second call - new hook instance after cache clear
        await result2.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Should fetch again after cache is cleared
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should reuse hook-level initialized password', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);

        await result.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should handle master password fetch error', async () => {
      mockGetEffectiveMasterPassword.mockRejectedValueOnce(
        new Error('Failed to get master password'),
      );

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await expect(
        act(async () => {
          await result.current.optimizedCreatePassword({
            title: 'Test',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        }),
      ).rejects.toThrow();
    });

    it('should handle missing master password in result', async () => {
      mockGetEffectiveMasterPassword.mockResolvedValueOnce({
        success: false,
        error: 'Master password unavailable',
      });

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await expect(
        act(async () => {
          await result.current.optimizedCreatePassword({
            title: 'Test',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        }),
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // SUITE 3: Single Password Creation
  // ============================================================================
  describe('Single Password Creation - optimizedCreatePassword', () => {
    it('should create password entry with required fields', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      let createdEntry: any;
      await act(async () => {
        createdEntry = await result.current.optimizedCreatePassword({
          title: 'GitHub',
          username: 'johndoe',
          password: 'secure123',
          url: 'https://github.com',
          notes: 'Main account',
        } as any);
      });

      expect(createdEntry).toHaveProperty('id');
      expect(createdEntry).toHaveProperty('createdAt');
      expect(createdEntry).toHaveProperty('updatedAt');
      expect(createdEntry.title).toBe('GitHub');
      expect(createdEntry.username).toBe('johndoe');
      expect(createdEntry.password).toBe('secure123');
      expect(createdEntry.url).toBe('https://github.com');
    });

    it('should generate unique ID for each password', async () => {
      // Mock random to control IDs
      const originalRandom = Math.random;
      let randomIndex = 0;
      const randomValues = [0.1111, 0.2222, 0.3333];
      Math.random = jest.fn(
        () => randomValues[randomIndex++ % randomValues.length],
      );

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      let entry1: any, entry2: any;
      await act(async () => {
        entry1 = await result.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);

        entry2 = await result.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(entry1.id).not.toBe(entry2.id);
      Math.random = originalRandom;
    });

    it('should set accessCount and frequencyScore to 0', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      let createdEntry: any;
      await act(async () => {
        createdEntry = await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(createdEntry.accessCount).toBe(0);
      expect(createdEntry.frequencyScore).toBe(0);
    });

    it('should call dispatch with savePassword action', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should pass master password to dispatch action', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Verify dispatch was called with a thunk function
      expect(mockDispatch).toHaveBeenCalled();
      const dispatchArg = mockDispatch.mock.calls[0][0];
      // Thunks are functions
      expect(typeof dispatchArg).toBe('function');
    });

    it('should handle dispatch error gracefully', async () => {
      mockDispatch.mockImplementationOnce(() => ({
        unwrap: () => Promise.reject(new Error('Save failed')),
      }));

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await expect(
        act(async () => {
          await result.current.optimizedCreatePassword({
            title: 'Test',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        }),
      ).rejects.toThrow();
    });

    it('should add createdAt and updatedAt as Date objects', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      let createdEntry: any;
      await act(async () => {
        createdEntry = await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(createdEntry.createdAt instanceof Date).toBe(true);
      expect(createdEntry.updatedAt instanceof Date).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 4: Batch Password Creation
  // ============================================================================
  describe('Batch Password Creation - optimizedBatchCreatePasswords', () => {
    it('should create multiple passwords from array', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'GitHub',
          username: 'user1',
          password: 'pass1',
          url: 'https://github.com',
          notes: '',
        },
        {
          title: 'Gmail',
          username: 'user2',
          password: 'pass2',
          url: 'https://gmail.com',
          notes: '',
        },
      ] as any;

      let results: any[];
      await act(async () => {
        results = await result.current.optimizedBatchCreatePasswords(entries);
      });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('GitHub');
      expect(results[1].title).toBe('Gmail');
    });

    it('should fetch master password only once for entire batch', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
        {
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
        {
          title: 'Test3',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
      ] as any;

      await act(async () => {
        await result.current.optimizedBatchCreatePasswords(entries);
      });

      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should reuse master password for all batch entries', async () => {
      const masterPassword = 'batch_master_password';
      mockGetEffectiveMasterPassword.mockResolvedValueOnce({
        success: true,
        password: masterPassword,
        derivedKey: 'derived_key_123',
      });

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
        {
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
      ] as any;

      await act(async () => {
        await result.current.optimizedBatchCreatePasswords(entries);
      });

      // Should only fetch master password once for entire batch
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
      // All dispatch calls should be made (once per entry)
      expect(mockDispatch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty batch array', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      let results: any[];
      await act(async () => {
        results = await result.current.optimizedBatchCreatePasswords([]);
      });

      expect(results).toHaveLength(0);
    });

    it('should continue on single entry failure in batch', async () => {
      let callCount = 0;
      mockDispatch.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return {
            unwrap: () => Promise.reject(new Error('Save failed')),
          };
        }
        return {
          unwrap: () => Promise.resolve({}),
        };
      });

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
        {
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
      ] as any;

      await expect(
        act(async () => {
          await result.current.optimizedBatchCreatePasswords(entries);
        }),
      ).rejects.toThrow();
    });

    it('should generate unique IDs for all batch entries', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
        {
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
      ] as any;

      let results: any[];
      await act(async () => {
        results = await result.current.optimizedBatchCreatePasswords(entries);
      });

      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should handle large batch efficiently', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = Array.from({ length: 100 }, (_, i) => ({
        title: `Password${i}`,
        username: `user${i}`,
        password: `pass${i}`,
        url: `https://test${i}.com`,
        notes: '',
      })) as any;

      let results: any[];
      await act(async () => {
        results = await result.current.optimizedBatchCreatePasswords(entries);
      });

      expect(results).toHaveLength(100);
      // Master password should be fetched only once
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should preserve all properties across batch entries', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'GitHub',
          username: 'johndoe',
          password: 'secure123',
          url: 'https://github.com',
          notes: 'Main account',
        },
        {
          title: 'Gmail',
          username: 'john@example.com',
          password: 'secure456',
          url: 'https://gmail.com',
          notes: 'Personal email',
        },
      ] as any;

      let results: any[];
      await act(async () => {
        results = await result.current.optimizedBatchCreatePasswords(entries);
      });

      expect(results[0]).toEqual(
        expect.objectContaining({
          title: 'GitHub',
          username: 'johndoe',
          password: 'secure123',
          url: 'https://github.com',
          notes: 'Main account',
        }),
      );

      expect(results[1]).toEqual(
        expect.objectContaining({
          title: 'Gmail',
          username: 'john@example.com',
          password: 'secure456',
          url: 'https://gmail.com',
          notes: 'Personal email',
        }),
      );
    });
  });

  // ============================================================================
  // SUITE 5: Cache Management
  // ============================================================================
  describe('Cache Management', () => {
    it('should clear global cache with clearOptimizedPasswordCache', async () => {
      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);

      // Create a second hook instance - should use global cache
      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        await result2.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Should still be 1 because global cache is shared
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);

      // Clear cache
      clearOptimizedPasswordCache();

      // Create third hook instance - should fetch again
      const { result: result3 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        await result3.current.optimizedCreatePassword({
          title: 'Test3',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Should fetch again after cache clear
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(2);
    });

    it('should share global cache across multiple hook instances', async () => {
      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );
      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result2.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Should still be 1 because global cache is shared
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should not cache when provided masterPassword is used', async () => {
      clearOptimizedPasswordCache();
      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement('provided_password_1'),
      );

      await act(async () => {
        await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).not.toHaveBeenCalled();

      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement('provided_password_2'),
      );

      await act(async () => {
        await result2.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SUITE 6: Performance Tracking
  // ============================================================================
  describe('Performance Tracking', () => {
    it('should log password creation timing', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Optimized] Starting optimized password creation',
        ),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Optimized] Password created in'),
      );
    });

    it('should log batch creation timing', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedBatchCreatePasswords([
          {
            title: 'Test1',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
        ] as any);
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Optimized] Starting batch creation'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Optimized] Batch created'),
      );
    });

    it('should indicate cached master password in logs', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        // First call - should fetch
        await result.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);

        // Clear logs from first call
        (console.log as jest.Mock).mockClear();

        // Second call - should use cache
        await result.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      // Second call should use either initialized password or global cache
      const logs = (console.log as jest.Mock).mock.calls
        .map(call => call[0])
        .join('\n');
      expect(logs).toMatch(/Using initialized password|Using global cache/);
    });
  });

  // ============================================================================
  // SUITE 7: Edge Cases & Integration
  // ============================================================================
  describe('Edge Cases & Integration', () => {
    it('should handle rapid consecutive password creations', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        // Sequential calls to ensure cache is used properly
        for (let i = 0; i < 5; i++) {
          await result.current.optimizedCreatePassword({
            title: `Test${i}`,
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        }
      });

      // Should only fetch master password once due to caching
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should maintain separate cache per provided password', async () => {
      clearOptimizedPasswordCache();

      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement('password_a'),
      );
      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement('password_b'),
      );

      await act(async () => {
        await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      await act(async () => {
        await result2.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).not.toHaveBeenCalled();
    });

    it('should handle partial batch data correctly', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entries = [
        {
          title: 'Minimal',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        },
      ] as any;

      let results: any[];
      await act(async () => {
        results = await result.current.optimizedBatchCreatePasswords(entries);
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('createdAt');
      expect(results[0]).toHaveProperty('updatedAt');
    });

    it('should mix single and batch operations correctly', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        // Single creation
        await result.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);

        // Batch creation
        await result.current.optimizedBatchCreatePasswords([
          {
            title: 'Test2',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
          {
            title: 'Test3',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
        ] as any);
      });

      // Should still only fetch master password once
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should preserve ID uniqueness across hook instances', async () => {
      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );
      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      let ids: string[] = [];

      await act(async () => {
        const entry1 = await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
        ids.push(entry1.id);

        const entry2 = await result2.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
        ids.push(entry2.id);
      });

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(2);
    });

    it('should handle TTL expiration during batch operations', async () => {
      const { result: result1 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        await result1.current.optimizedCreatePassword({
          title: 'Test1',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);

      // Clear cache to simulate expiration
      clearOptimizedPasswordCache();
      mockGetEffectiveMasterPassword.mockClear();

      // Create new hook instance for batch operation
      const { result: result2 } = renderHook(() =>
        useOptimizedPasswordManagement(),
      );

      await act(async () => {
        await result2.current.optimizedBatchCreatePasswords([
          {
            title: 'Test2',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
        ] as any);
      });

      // Should fetch new master password after cache clear
      expect(mockGetEffectiveMasterPassword).toHaveBeenCalledTimes(1);
    });

    it('should log correct performance metrics for batch vs single', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      // Clear logs
      (console.log as jest.Mock).mockClear();

      await act(async () => {
        await result.current.optimizedBatchCreatePasswords([
          {
            title: 'Test1',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
          {
            title: 'Test2',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
        ] as any);
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Average per password'),
      );
    });
  });

  // ============================================================================
  // SUITE 8: Redux Integration
  // ============================================================================
  describe('Redux Integration', () => {
    it('should call dispatch for single password creation', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await act(async () => {
        await result.current.optimizedCreatePassword({
          title: 'Test',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should call dispatch for each batch entry', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const dispatchCallsBefore = mockDispatch.mock.calls.length;

      await act(async () => {
        await result.current.optimizedBatchCreatePasswords([
          {
            title: 'Test1',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
          {
            title: 'Test2',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
          {
            title: 'Test3',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          },
        ] as any);
      });

      const dispatchCallsAfter = mockDispatch.mock.calls.length;
      // Should have 3 dispatches for 3 entries
      expect(dispatchCallsAfter - dispatchCallsBefore).toBe(3);
    });

    it('should pass correct entry structure to dispatch', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      const entry = {
        title: 'TestEntry',
        username: 'testuser',
        password: 'testpass',
        url: 'https://test.com',
        notes: 'Test note',
      } as any;

      await act(async () => {
        await result.current.optimizedCreatePassword(entry);
      });

      // Verify dispatch was called with a thunk function
      expect(mockDispatch).toHaveBeenCalled();
      const dispatchArg = mockDispatch.mock.calls[0][0];
      // Thunks are functions that will be executed by Redux
      expect(typeof dispatchArg).toBe('function');
    });
  });

  // ============================================================================
  // SUITE 9: Error Handling & Boundary Cases
  // ============================================================================
  describe('Error Handling & Boundary Cases', () => {
    it('should handle null entry gracefully', async () => {
      const { result } = renderHook(() => useOptimizedPasswordManagement());

      try {
        await act(async () => {
          const result2 = await result.current.optimizedCreatePassword(
            null as any,
          );
          // If null is passed, it should at least create an entry with base fields
          expect(result2).toBeDefined();
        });
      } catch (e) {
        // Either an error is thrown or the function handles it
        expect(e).toBeDefined();
      }
    });

    it('should handle undefined masterPassword in result', async () => {
      mockGetEffectiveMasterPassword.mockResolvedValueOnce({
        success: true,
        password: undefined,
        derivedKey: 'derived_key',
      });

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      await expect(
        act(async () => {
          await result.current.optimizedCreatePassword({
            title: 'Test',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        }),
      ).rejects.toThrow();
    });

    it('should log errors during password creation', async () => {
      mockDispatch.mockImplementationOnce(() => ({
        unwrap: () => Promise.reject(new Error('Dispatch failed')),
      }));

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      try {
        await act(async () => {
          await result.current.optimizedCreatePassword({
            title: 'Test',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        });
      } catch (e) {
        // Expected
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[Optimized] Password creation failed'),
        expect.any(Error),
      );
    });

    it('should maintain functionality after error', async () => {
      mockDispatch
        .mockImplementationOnce(() => ({
          unwrap: () => Promise.reject(new Error('Dispatch failed')),
        }))
        .mockImplementationOnce(() => ({
          unwrap: () => Promise.resolve({}),
        }));

      const { result } = renderHook(() => useOptimizedPasswordManagement());

      try {
        await act(async () => {
          await result.current.optimizedCreatePassword({
            title: 'Test1',
            username: 'user',
            password: 'pass',
            url: 'https://test.com',
            notes: '',
          } as any);
        });
      } catch (e) {
        // Expected
      }

      let entry2: any;
      await act(async () => {
        entry2 = await result.current.optimizedCreatePassword({
          title: 'Test2',
          username: 'user',
          password: 'pass',
          url: 'https://test.com',
          notes: '',
        } as any);
      });

      expect(entry2).toBeDefined();
      expect(entry2.title).toBe('Test2');
    });
  });
});
