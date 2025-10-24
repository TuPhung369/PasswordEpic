import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storeMasterPassword,
  verifyMasterPassword,
  getMasterPasswordFromBiometric,
  isBiometricEnabled,
  isBiometricAvailable,
  storeEncryptedData,
  getEncryptedData,
  removeEncryptedData,
  storeUserSettings,
  getUserSettings,
  clearAllStoredData,
  isMasterPasswordSet,
  storeBiometricStatus,
  _resetBiometricCache,
  type UserSettings,
} from '../secureStorageService';

// Use mocks from jest.setup.js and override specific functions
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockKeychain = Keychain as jest.Mocked<typeof Keychain>;

// Mock crypto service
jest.mock('../cryptoService', () => ({
  generateSalt: jest.fn(() => 'mock_salt'),
  hashPassword: jest.fn(
    (password: string, salt: string) => `hash_${password}_${salt}`,
  ),
  verifyPassword: jest.fn(
    (password: string, hash: string, salt: string) =>
      hash === `hash_${password}_${salt}`,
  ),
}));

describe('SecureStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetBiometricCache();
  });

  // ==================== Master Password Storage ====================
  describe('storeMasterPassword', () => {
    it('should store master password with salt', async () => {
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);

      const result = await storeMasterPassword('testPassword123');

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.multiSet).toHaveBeenCalled();
    });

    it('should store hash and salt separately', async () => {
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);

      await storeMasterPassword('password');

      const multiSetCall = mockAsyncStorage.multiSet.mock.calls[0][0];
      expect(multiSetCall).toHaveLength(3); // hash, salt, timestamp
    });

    it('should store password in keychain when biometric enabled', async () => {
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storeMasterPassword('password', true);

      expect(mockKeychain.setInternetCredentials).toHaveBeenCalled();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'biometric_enabled',
        'true',
      );
    });

    it('should not store in keychain when biometric disabled', async () => {
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storeMasterPassword('password', false);

      expect(mockKeychain.setInternetCredentials).not.toHaveBeenCalled();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'biometric_enabled',
        'false',
      );
    });

    it('should handle storage errors', async () => {
      mockAsyncStorage.multiSet.mockRejectedValue(new Error('Storage error'));

      const result = await storeMasterPassword('password');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });

    it('should default to biometric enabled', async () => {
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storeMasterPassword('password');

      expect(mockKeychain.setInternetCredentials).toHaveBeenCalled();
    });
  });

  // ==================== Master Password Verification ====================
  describe('verifyMasterPassword', () => {
    it('should verify correct password', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        ['hash', 'hash_testPass_mock_salt'],
        ['salt', 'mock_salt'],
      ]);

      const result = await verifyMasterPassword('testPass');

      expect(result.success).toBe(true);
    });

    it('should reject incorrect password', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        ['hash', 'hash_correctPass_mock_salt'],
        ['salt', 'mock_salt'],
      ]);

      const result = await verifyMasterPassword('wrongPass');

      expect(result.success).toBe(false);
    });

    it('should return error if no password set', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        ['hash', null],
        ['salt', null],
      ]);

      const result = await verifyMasterPassword('password');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Master password not set');
    });

    it('should update last verified timestamp', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        ['hash', 'hash_pass_mock_salt'],
        ['salt', 'mock_salt'],
      ]);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await verifyMasterPassword('pass');

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle verification errors', async () => {
      mockAsyncStorage.multiGet.mockRejectedValue(new Error('DB error'));

      const result = await verifyMasterPassword('password');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==================== Biometric Authentication ====================
  describe('getMasterPasswordFromBiometric', () => {
    it('should retrieve password from biometric', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue('FaceID');
      mockKeychain.getInternetCredentials.mockResolvedValue({
        password: 'retrievedPassword',
      });

      const result = await getMasterPasswordFromBiometric();

      expect(result.success).toBe(true);
      expect(result.password).toBe('retrievedPassword');
    });

    it('should fail if biometric not enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      const result = await getMasterPasswordFromBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('should fail if biometric not available', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue(null);

      const result = await getMasterPasswordFromBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should fail if no credentials found', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue('TouchID');
      mockKeychain.getInternetCredentials.mockResolvedValue(null);

      const result = await getMasterPasswordFromBiometric();

      expect(result.success).toBe(false);
    });

    it('should cache biometric support check', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue('FaceID');
      mockKeychain.getInternetCredentials.mockResolvedValue({
        password: 'pass',
      });

      // First call
      await getMasterPasswordFromBiometric();
      mockKeychain.getSupportedBiometryType.mockClear();

      // Second call - should use cache
      await getMasterPasswordFromBiometric();

      // getSupportedBiometryType should not be called second time (cached)
      expect(mockKeychain.getSupportedBiometryType).not.toHaveBeenCalled();
    });

    it('should handle biometric cancellation', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue('FaceID');
      mockKeychain.getInternetCredentials.mockRejectedValue(
        new Error('UserCancel'),
      );

      const result = await getMasterPasswordFromBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle timeout during biometric auth', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue('FaceID');
      mockKeychain.getInternetCredentials.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ password: 'pass' }), 20000),
          ),
      );

      const result = await getMasterPasswordFromBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 20000);
  });

  // ==================== Biometric Status ====================
  describe('isBiometricEnabled', () => {
    it('should return true if enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');

      const result = await isBiometricEnabled();

      expect(result).toBe(true);
    });

    it('should return false if disabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should return false if not set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Error'));

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });
  });

  describe('isBiometricAvailable', () => {
    it('should return available when biometry supported', async () => {
      mockKeychain.getSupportedBiometryType.mockResolvedValue('FaceID');

      const result = await isBiometricAvailable();

      expect(result.available).toBe(true);
      expect(result.biometryType).toBe('FaceID');
    });

    it('should return unavailable when not supported', async () => {
      mockKeychain.getSupportedBiometryType.mockResolvedValue(null);

      const result = await isBiometricAvailable();

      expect(result.available).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockKeychain.getSupportedBiometryType.mockRejectedValue(
        new Error('Error'),
      );

      const result = await isBiometricAvailable();

      expect(result.available).toBe(false);
    });
  });

  // ==================== Encrypted Data Storage ====================
  describe('storeEncryptedData', () => {
    it('should store encrypted data', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const result = await storeEncryptedData('key1', { data: 'secret' });

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should JSON stringify data', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storeEncryptedData('key1', { foo: 'bar' });

      const call = mockAsyncStorage.setItem.mock.calls[0];
      expect(call[0]).toBe('key1');
      expect(JSON.parse(call[1])).toEqual({ foo: 'bar' });
    });

    it('should handle storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Write error'));

      const result = await storeEncryptedData('key1', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Write error');
    });
  });

  describe('getEncryptedData', () => {
    it('should retrieve encrypted data', async () => {
      const data = { secret: 'value' };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(data));

      const result = await getEncryptedData('key1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should return error if no data found', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getEncryptedData('key1');

      expect(result.success).toBe(false);
    });

    it('should handle JSON parse errors', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json');

      const result = await getEncryptedData('key1');

      expect(result.success).toBe(false);
    });

    it('should handle retrieval errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

      const result = await getEncryptedData('key1');

      expect(result.success).toBe(false);
    });
  });

  describe('removeEncryptedData', () => {
    it('should remove data', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue(undefined);

      const result = await removeEncryptedData('key1');

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('key1');
    });

    it('should handle removal errors', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Remove error'));

      const result = await removeEncryptedData('key1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Remove error');
    });
  });

  // ==================== User Settings ====================
  describe('storeUserSettings', () => {
    it('should store user settings', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      const settings: UserSettings = {
        theme: 'dark',
        autoLockTimeout: 5,
        biometricEnabled: true,
        screenProtectionEnabled: true,
        autoBackupEnabled: false,
      };

      const result = await storeUserSettings(settings);

      expect(result.success).toBe(true);
    });
  });

  describe('getUserSettings', () => {
    it('should retrieve user settings', async () => {
      const settings: UserSettings = {
        theme: 'dark',
        autoLockTimeout: 10,
        biometricEnabled: false,
        screenProtectionEnabled: true,
        autoBackupEnabled: true,
        lastBackupDate: Date.now(),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(settings));

      const result = await getUserSettings();

      expect(result.success).toBe(true);
      expect(result.settings).toEqual(settings);
    });

    it('should return default settings if none exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getUserSettings();

      expect(result.success).toBe(true);
      expect(result.settings?.theme).toBe('dark');
      expect(result.settings?.autoLockTimeout).toBe(5);
    });

    it('should return defaults with correct structure', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getUserSettings();

      const settings = result.settings;
      expect(settings?.theme).toBeDefined();
      expect(settings?.autoLockTimeout).toBeDefined();
      expect(settings?.biometricEnabled).toBeDefined();
      expect(settings?.screenProtectionEnabled).toBeDefined();
      expect(settings?.autoBackupEnabled).toBeDefined();
    });
  });

  // ==================== Clear All Data ====================
  describe('clearAllStoredData', () => {
    it('should clear all stored data', async () => {
      mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
      mockKeychain.resetInternetCredentials.mockResolvedValue(undefined);

      const result = await clearAllStoredData();

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalled();
      expect(mockKeychain.resetInternetCredentials).toHaveBeenCalled();
    });

    it('should continue if keychain clear fails', async () => {
      mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
      mockKeychain.resetInternetCredentials.mockRejectedValue(
        new Error('Keychain error'),
      );

      const result = await clearAllStoredData();

      expect(result.success).toBe(true);
    });

    it('should handle AsyncStorage errors', async () => {
      mockAsyncStorage.multiRemove.mockRejectedValue(new Error('Clear error'));

      const result = await clearAllStoredData();

      expect(result.success).toBe(false);
    });
  });

  // ==================== Master Password Status ====================
  describe('isMasterPasswordSet', () => {
    it('should return true if password set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('hash_value');

      const result = await isMasterPasswordSet();

      expect(result).toBe(true);
    });

    it('should return false if password not set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await isMasterPasswordSet();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Error'));

      const result = await isMasterPasswordSet();

      expect(result).toBe(false);
    });
  });

  // ==================== Biometric Status Management ====================
  describe('storeBiometricStatus', () => {
    it('should store enabled status', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storeBiometricStatus(true);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'biometric_enabled',
        'true',
      );
    });

    it('should store disabled status', async () => {
      mockAsyncStorage.setItem.mockResolvedValue(undefined);

      await storeBiometricStatus(false);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'biometric_enabled',
        'false',
      );
    });

    it('should handle storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Error'));

      // Should not throw
      await expect(storeBiometricStatus(true)).resolves.toBeUndefined();
    });
  });

  // ==================== Complex Scenarios ====================
  describe('Complex Scenarios', () => {
    it('should complete full authentication flow', async () => {
      // Store password
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);

      const storeResult = await storeMasterPassword('myPassword123', true);
      expect(storeResult.success).toBe(true);

      // Verify password
      mockAsyncStorage.multiGet.mockResolvedValue([
        ['hash', 'hash_myPassword123_mock_salt'],
        ['salt', 'mock_salt'],
      ]);

      const verifyResult = await verifyMasterPassword('myPassword123');
      expect(verifyResult.success).toBe(true);
    });

    it('should handle biometric fallback', async () => {
      // Try biometric but fall back to manual entry
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockKeychain.getSupportedBiometryType.mockResolvedValue('FaceID');
      mockKeychain.getInternetCredentials.mockRejectedValue(
        new Error('UserFallback'),
      );

      const biometricResult = await getMasterPasswordFromBiometric();
      expect(biometricResult.success).toBe(false);
      expect(biometricResult.error).toContain('chose to enter password');
    });

    it('should preserve data when toggling biometric', async () => {
      // Store with biometric
      mockAsyncStorage.multiSet.mockResolvedValue(undefined);
      mockAsyncStorage.setItem.mockResolvedValue(undefined);
      mockKeychain.setInternetCredentials.mockResolvedValue(undefined);

      await storeMasterPassword('password', true);

      // Data should still be retrievable
      const data = { secret: 'value' };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(data));

      const result = await getEncryptedData('key');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });
  });
});
