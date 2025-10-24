/**
 * clearAllData.test.ts
 * Comprehensive test suite for data clearing utilities
 * Tests encrypted data clearing and complete AsyncStorage wipe
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllEncryptedData, clearAllAsyncStorage } from '../clearAllData';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiRemove: jest.fn(),
  clear: jest.fn(),
}));

describe('clearAllData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('clearAllEncryptedData()', () => {
    const expectedKeys = [
      'optimized_passwords_v2',
      'password_categories',
      'dynamic_mp_login_timestamp',
      'dynamic_mp_user_uuid',
      'dynamic_mp_session_salt',
      'dynamic_mp_session_hash',
      'static_mp_fixed_salt',
      'static_mp_user_uuid',
      'session_config',
      'session_last_activity',
      'master_password_hash',
      'master_password_salt',
    ];

    test('should successfully clear encrypted data', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should call AsyncStorage.multiRemove with correct keys', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      await clearAllEncryptedData();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(expectedKeys);
    });

    test('should return all cleared keys in response', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toEqual(expectedKeys);
      expect(result.clearedKeys.length).toBe(12);
    });

    test('should clear all password-related keys', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toContain('optimized_passwords_v2');
      expect(result.clearedKeys).toContain('password_categories');
    });

    test('should clear dynamic master password data', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toContain('dynamic_mp_login_timestamp');
      expect(result.clearedKeys).toContain('dynamic_mp_user_uuid');
      expect(result.clearedKeys).toContain('dynamic_mp_session_salt');
      expect(result.clearedKeys).toContain('dynamic_mp_session_hash');
    });

    test('should clear static master password data', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toContain('static_mp_fixed_salt');
      expect(result.clearedKeys).toContain('static_mp_user_uuid');
    });

    test('should clear session data', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toContain('session_config');
      expect(result.clearedKeys).toContain('session_last_activity');
    });

    test('should handle AsyncStorage error gracefully', async () => {
      const errorMessage = 'Storage error';
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await clearAllEncryptedData();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.clearedKeys).toEqual([]);
    });

    test('should return empty clearedKeys on error', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(
        new Error('Error'),
      );

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toHaveLength(0);
    });

    test('should handle error without message', async () => {
      const error = new Error();
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(error);

      const result = await clearAllEncryptedData();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to clear data');
    });

    test('should log clearing message on success', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      await clearAllEncryptedData();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting to clear'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cleared successfully'),
      );
    });

    test('should log error on failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const errorMessage = 'Storage failed';
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      await clearAllEncryptedData();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear data'),
        expect.any(Error),
      );
    });

    test('should be called multiple times independently', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result1 = await clearAllEncryptedData();
      const result2 = await clearAllEncryptedData();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(AsyncStorage.multiRemove).toHaveBeenCalledTimes(2);
    });

    test('should include master password hash and salt in cleared keys', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result.clearedKeys).toContain('master_password_hash');
      expect(result.clearedKeys).toContain('master_password_salt');
    });

    test('should return consistent key order', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result1 = await clearAllEncryptedData();
      const result2 = await clearAllEncryptedData();

      expect(result1.clearedKeys).toEqual(result2.clearedKeys);
    });
  });

  describe('clearAllAsyncStorage()', () => {
    test('should successfully clear all AsyncStorage', async () => {
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllAsyncStorage();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should call AsyncStorage.clear()', async () => {
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      await clearAllAsyncStorage();

      expect(AsyncStorage.clear).toHaveBeenCalled();
    });

    test('should handle AsyncStorage error gracefully', async () => {
      const errorMessage = 'Clear failed';
      (AsyncStorage.clear as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await clearAllAsyncStorage();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    test('should handle error without message', async () => {
      (AsyncStorage.clear as jest.Mock).mockRejectedValue(new Error());

      const result = await clearAllAsyncStorage();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to clear AsyncStorage');
    });

    test('should log clearing message on success', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const consoleWarnSpy = jest.spyOn(console, 'warn');

      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      await clearAllAsyncStorage();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clearing ALL AsyncStorage'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cleared'),
      );
    });

    test('should log error on failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      (AsyncStorage.clear as jest.Mock).mockRejectedValue(new Error('Error'));

      await clearAllAsyncStorage();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear AsyncStorage'),
        expect.any(Error),
      );
    });

    test('should be called multiple times independently', async () => {
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      const result1 = await clearAllAsyncStorage();
      const result2 = await clearAllAsyncStorage();

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(AsyncStorage.clear).toHaveBeenCalledTimes(2);
    });

    test('should use warn for initial clear message', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn');
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      await clearAllAsyncStorage();

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Integration: Clearing order', () => {
    test('should clear encrypted data before full wipe if both are called', async () => {
      const callOrder: string[] = [];

      (AsyncStorage.multiRemove as jest.Mock).mockImplementation(() => {
        callOrder.push('multiRemove');
        return Promise.resolve();
      });

      (AsyncStorage.clear as jest.Mock).mockImplementation(() => {
        callOrder.push('clear');
        return Promise.resolve();
      });

      await clearAllEncryptedData();
      await clearAllAsyncStorage();

      expect(callOrder).toEqual(['multiRemove', 'clear']);
    });
  });

  describe('Edge cases', () => {
    test('clearAllEncryptedData should handle empty error message', async () => {
      const error: any = new Error();
      error.message = '';

      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(error);

      const result = await clearAllEncryptedData();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to clear data');
    });

    test('clearAllAsyncStorage should handle empty error message', async () => {
      const error: any = new Error();
      error.message = '';

      (AsyncStorage.clear as jest.Mock).mockRejectedValue(error);

      const result = await clearAllAsyncStorage();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to clear AsyncStorage');
    });

    test('clearAllEncryptedData should handle non-Error objects', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue('String error');

      const result = await clearAllEncryptedData();

      expect(result.success).toBe(false);
    });

    test('clearAllAsyncStorage should handle non-Error objects', async () => {
      (AsyncStorage.clear as jest.Mock).mockRejectedValue('String error');

      const result = await clearAllAsyncStorage();

      expect(result.success).toBe(false);
    });
  });

  describe('Response types', () => {
    test('clearAllEncryptedData returns correct response structure on success', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllEncryptedData();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('clearedKeys');
      expect(result).not.toHaveProperty('error');
    });

    test('clearAllEncryptedData returns error property on failure', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(
        new Error('Failed'),
      );

      const result = await clearAllEncryptedData();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('clearedKeys');
    });

    test('clearAllAsyncStorage returns correct response structure on success', async () => {
      (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);

      const result = await clearAllAsyncStorage();

      expect(result).toHaveProperty('success');
      expect(result).not.toHaveProperty('clearedKeys');
    });

    test('clearAllAsyncStorage returns error property on failure', async () => {
      (AsyncStorage.clear as jest.Mock).mockRejectedValue(new Error('Failed'));

      const result = await clearAllAsyncStorage();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
    });
  });
});
