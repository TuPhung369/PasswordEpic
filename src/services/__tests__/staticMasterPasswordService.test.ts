import {
  generateStaticMasterPassword,
  getStaticMasterPasswordInfo,
  verifyStaticMasterPassword,
  clearStaticMasterPasswordCache,
  resetStaticMasterPassword,
  getEffectiveMasterPassword,
  clearStaticMasterPasswordData,
  STATIC_MP_KEYS,
} from '../staticMasterPasswordService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Firebase
jest.mock('../firebase', () => ({
  getCurrentUser: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock CryptoService
jest.mock('../cryptoService', () => ({
  deriveKeyFromPassword: jest.fn(),
  generateSalt: jest.fn(),
  CRYPTO_CONSTANTS: {
    PBKDF2_ITERATIONS: 10000,
  },
}));

// Import mocked modules after jest.mock declarations
import * as firebase from '../firebase';
import * as cryptoService from '../cryptoService';

describe('staticMasterPasswordService', () => {
  // Mock user
  const mockUser = {
    uid: 'test-user-123',
    email: 'test@example.com',
  };

  const mockFixedSalt = 'fixed-salt-1234567890';
  const mockDerivedKey = 'derived-key-abcdef1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mocks
    (firebase.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (cryptoService.generateSalt as jest.Mock).mockReturnValue(mockFixedSalt);
    (cryptoService.deriveKeyFromPassword as jest.Mock).mockReturnValue(
      mockDerivedKey,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clear the service cache
    clearStaticMasterPasswordCache();
  });

  // =========================================================================
  // Test Suite 1: Basic Functionality
  // =========================================================================
  describe('Basic Functionality', () => {
    it('should export required functions', () => {
      expect(typeof generateStaticMasterPassword).toBe('function');
      expect(typeof getStaticMasterPasswordInfo).toBe('function');
      expect(typeof verifyStaticMasterPassword).toBe('function');
      expect(typeof clearStaticMasterPasswordCache).toBe('function');
      expect(typeof resetStaticMasterPassword).toBe('function');
      expect(typeof getEffectiveMasterPassword).toBe('function');
      expect(typeof clearStaticMasterPasswordData).toBe('function');
    });

    it('should export storage keys', () => {
      expect(STATIC_MP_KEYS).toHaveProperty('FIXED_SALT');
      expect(STATIC_MP_KEYS).toHaveProperty('USER_UUID');
      expect(STATIC_MP_KEYS.FIXED_SALT).toBe('static_mp_fixed_salt');
      expect(STATIC_MP_KEYS.USER_UUID).toBe('static_mp_user_uuid');
    });
  });

  // =========================================================================
  // Test Suite 2: Generate Static Master Password - Success Cases
  // =========================================================================
  describe('generateStaticMasterPassword - Success Cases', () => {
    it('should generate static master password successfully', async () => {
      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBeDefined();
      expect(result.derivedKey).toBe(mockDerivedKey);
      expect(result.userId).toBe('test-user-123');
      expect(result.error).toBeUndefined();
    });

    it('should create password from UID::email::salt', async () => {
      const result = await generateStaticMasterPassword();

      expect(result.password).toContain('test-user-123');
      expect(result.password).toContain('test@example.com');
      expect(result.password).toContain('fixed-salt-12345');
      expect(result.password).toMatch(/::.*::/);
    });

    it('should generate fixed salt on first call', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await generateStaticMasterPassword();

      expect(cryptoService.generateSalt).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.FIXED_SALT,
        mockFixedSalt,
      );
    });

    it('should use existing fixed salt on subsequent calls', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);

      await generateStaticMasterPassword();

      expect(cryptoService.generateSalt).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.USER_UUID,
        mockUser.uid,
      );
    });

    it('should store user UUID', async () => {
      await generateStaticMasterPassword();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.USER_UUID,
        mockUser.uid,
      );
    });

    it('should derive key with correct parameters', async () => {
      const result = await generateStaticMasterPassword();

      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalledWith(
        expect.stringContaining('test-user-123'),
        mockFixedSalt,
        cryptoService.CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
      );
    });
  });

  // =========================================================================
  // Test Suite 3: Generate Static Master Password - Error Cases
  // =========================================================================
  describe('generateStaticMasterPassword - Error Cases', () => {
    it('should fail when user not authenticated', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
      expect(result.password).toBeUndefined();
    });

    it('should fail when user UID is invalid', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: null,
        email: 'test@example.com',
      });

      await expect(generateStaticMasterPassword()).rejects.toThrow(
        'Invalid user UID',
      );
    });

    it('should fail when user UID is not a string', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: 12345,
        email: 'test@example.com',
      });

      await expect(generateStaticMasterPassword()).rejects.toThrow(
        'Invalid user UID',
      );
    });

    it('should fail when fixed salt is invalid', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (cryptoService.generateSalt as jest.Mock).mockReturnValue(null);

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid fixed salt');
    });

    it('should fail when key derivation returns invalid result', async () => {
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockReturnValue(null);

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('derive cryptographic key');
    });

    it('should fail when AsyncStorage throws error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });

    it('should fail with custom error message', async () => {
      const customError = new Error('Custom storage failure');
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(customError);

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom storage failure');
    });
  });

  // =========================================================================
  // Test Suite 4: Cache Functionality
  // =========================================================================
  describe('Cache Functionality', () => {
    it('should return cached password on subsequent calls', async () => {
      const result1 = await generateStaticMasterPassword();
      (cryptoService.generateSalt as jest.Mock).mockClear();
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const result2 = await generateStaticMasterPassword();

      expect(result1.password).toBe(result2.password);
      expect(result1.derivedKey).toBe(result2.derivedKey);
      expect(cryptoService.generateSalt).not.toHaveBeenCalled();
      expect(cryptoService.deriveKeyFromPassword).not.toHaveBeenCalled();
    });

    it('should use cache if valid (within TTL)', async () => {
      await generateStaticMasterPassword();
      (AsyncStorage.getItem as jest.Mock).mockClear();
      (AsyncStorage.setItem as jest.Mock).mockClear();
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      // Advance time by 30 minutes (within 60 minute TTL)
      jest.advanceTimersByTime(30 * 60 * 1000);

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(cryptoService.deriveKeyFromPassword).not.toHaveBeenCalled();
    });

    it('should invalidate cache after TTL expires', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);

      const result1 = await generateStaticMasterPassword();
      (AsyncStorage.getItem as jest.Mock).mockClear();
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      // Advance time past TTL (60 minutes)
      jest.advanceTimersByTime(61 * 60 * 1000);

      const result2 = await generateStaticMasterPassword();

      expect(result2.success).toBe(true);
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalled();
    });

    it('should invalidate cache when user changes', async () => {
      const result1 = await generateStaticMasterPassword();

      // Change user
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: 'different-user-456',
        email: 'different@example.com',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const result2 = await generateStaticMasterPassword();

      expect(result1.userId).not.toBe(result2.userId);
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalled();
    });

    it('should clear cache on clearStaticMasterPasswordCache()', async () => {
      await generateStaticMasterPassword();

      await clearStaticMasterPasswordCache();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalled();
    });

    it('should handle invalid cache gracefully', async () => {
      // First call to populate cache
      const result1 = await generateStaticMasterPassword();
      expect(result1.success).toBe(true);

      // Second call should use cache without deriving again
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();
      const result2 = await generateStaticMasterPassword();

      expect(result2.success).toBe(true);
      expect(result2.password).toBe(result1.password);
      expect(cryptoService.deriveKeyFromPassword).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Test Suite 5: In-Flight Request Deduplication
  // =========================================================================
  describe('In-Flight Request Deduplication', () => {
    it('should deduplicate concurrent requests', async () => {
      let callCount = 0;
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockImplementation(
        () => {
          callCount++;
          return mockDerivedKey;
        },
      );

      // Issue multiple concurrent requests
      const promises = [
        generateStaticMasterPassword(),
        generateStaticMasterPassword(),
        generateStaticMasterPassword(),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Key derivation should only be called once
      expect(callCount).toBe(1);
    });

    it('should handle concurrent requests with same result', async () => {
      const promises = [
        generateStaticMasterPassword(),
        generateStaticMasterPassword(),
      ];

      const [result1, result2] = await Promise.all(promises);

      expect(result1.password).toBe(result2.password);
      expect(result1.derivedKey).toBe(result2.derivedKey);
    });

    it('should handle concurrent requests that fail together', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const promises = [
        generateStaticMasterPassword(),
        generateStaticMasterPassword(),
      ];

      const [result1, result2] = await Promise.all(promises);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1.error).toBe(result2.error);
    });

    it('should clear in-flight request after completion', async () => {
      const result1 = await generateStaticMasterPassword();
      expect(result1.success).toBe(true);

      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      // Should not use in-flight request
      const result2 = await generateStaticMasterPassword();

      // Cache should be used, not in-flight request
      expect(cryptoService.deriveKeyFromPassword).not.toHaveBeenCalled();
    });

    it('should clear in-flight request on error', async () => {
      // Make all AsyncStorage calls throw error
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await generateStaticMasterPassword();
      expect(result.success).toBe(false);

      // Reset to allow successful call
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const result2 = await generateStaticMasterPassword();
      expect(result2.success).toBe(true);
    });
  });

  // =========================================================================
  // Test Suite 6: Get Static Master Password Info
  // =========================================================================
  describe('getStaticMasterPasswordInfo', () => {
    it('should return success with info when authenticated', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === STATIC_MP_KEYS.FIXED_SALT)
          return Promise.resolve(mockFixedSalt);
        if (key === STATIC_MP_KEYS.USER_UUID)
          return Promise.resolve(mockUser.uid);
        return Promise.resolve(null);
      });

      const result = await getStaticMasterPasswordInfo();

      expect(result.success).toBe(true);
      expect(result.info).toBeDefined();
      expect(result.info?.hasFixedSalt).toBe(true);
      expect(result.info?.userUuidMatch).toBe(true);
      expect(result.info?.userId).toBe(mockUser.uid);
    });

    it('should report false when fixed salt missing', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() =>
        Promise.resolve(null),
      );

      const result = await getStaticMasterPasswordInfo();

      expect(result.success).toBe(true);
      expect(result.info?.hasFixedSalt).toBe(false);
    });

    it('should report false when UUID mismatch', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(mockFixedSalt)
        .mockResolvedValueOnce('different-uid');

      const result = await getStaticMasterPasswordInfo();

      expect(result.success).toBe(true);
      expect(result.info?.userUuidMatch).toBe(false);
    });

    it('should report cache validity', async () => {
      await generateStaticMasterPassword();

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(mockFixedSalt)
        .mockResolvedValueOnce(mockUser.uid);

      const result = await getStaticMasterPasswordInfo();

      expect(result.info?.cacheValid).toBe(true);
    });

    it('should fail when user not authenticated', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await getStaticMasterPasswordInfo();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await getStaticMasterPasswordInfo();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  // =========================================================================
  // Test Suite 7: Verify Static Master Password
  // =========================================================================
  describe('verifyStaticMasterPassword', () => {
    it('should verify when password is valid', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === STATIC_MP_KEYS.FIXED_SALT)
          return Promise.resolve(mockFixedSalt);
        if (key === STATIC_MP_KEYS.USER_UUID)
          return Promise.resolve(mockUser.uid);
        return Promise.resolve(null);
      });

      const result = await verifyStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockUser.uid);
    });

    it('should return false when salt missing', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser.uid);

      const result = await verifyStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('should return false when UUID mismatch', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(mockFixedSalt)
        .mockResolvedValueOnce('different-uid');

      const result = await verifyStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('should return false when salt is empty string', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(mockUser.uid);

      const result = await verifyStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('should fail when user not authenticated', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await verifyStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await verifyStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  // =========================================================================
  // Test Suite 8: Clear Operations
  // =========================================================================
  describe('Clear Operations', () => {
    it('clearStaticMasterPasswordCache should clear in-memory cache', async () => {
      await generateStaticMasterPassword();

      await clearStaticMasterPasswordCache();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const result = await generateStaticMasterPassword();

      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalled();
    });

    it('clearStaticMasterPasswordData should remove stored data', async () => {
      await clearStaticMasterPasswordData();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.FIXED_SALT,
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.USER_UUID,
      );
    });

    it('clearStaticMasterPasswordData should handle storage errors', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      // Should not throw
      await expect(clearStaticMasterPasswordData()).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Test Suite 9: Reset Static Master Password
  // =========================================================================
  describe('resetStaticMasterPassword', () => {
    it('should reset successfully', async () => {
      const result = await resetStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should remove stored salt and UUID', async () => {
      await resetStaticMasterPassword();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.FIXED_SALT,
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.USER_UUID,
      );
    });

    it('should clear cache after reset', async () => {
      await generateStaticMasterPassword();

      await resetStaticMasterPassword();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await resetStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });

    it('should return error message on failure', async () => {
      const customError = new Error('Custom reset error');
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(customError);

      const result = await resetStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom reset error');
    });
  });

  // =========================================================================
  // Test Suite 10: Get Effective Master Password
  // =========================================================================
  describe('getEffectiveMasterPassword', () => {
    it('should return generated static master password', async () => {
      const result = await getEffectiveMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBeDefined();
      expect(result.derivedKey).toBe(mockDerivedKey);
    });

    it('should be wrapper for generateStaticMasterPassword', async () => {
      const result1 = await generateStaticMasterPassword();
      const result2 = await getEffectiveMasterPassword();

      expect(result1.password).toBe(result2.password);
    });

    it('should handle errors from generateStaticMasterPassword', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await getEffectiveMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // =========================================================================
  // Test Suite 11: Email Handling
  // =========================================================================
  describe('Email Handling', () => {
    it('should use email in password generation', async () => {
      const result = await generateStaticMasterPassword();

      expect(result.password).toContain('test@example.com');
    });

    it('should use anonymous when email missing', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: mockUser.uid,
        email: null,
      });

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toContain('anonymous');
    });

    it('should use anonymous when email is empty', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: mockUser.uid,
        email: '',
      });

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toContain('anonymous');
    });
  });

  // =========================================================================
  // Test Suite 12: Salt Handling
  // =========================================================================
  describe('Salt Handling', () => {
    it('should use first 16 chars of salt in password', async () => {
      const longSalt = 'abcdefghijklmnopqrstuvwxyz0123456789';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(longSalt);

      const result = await generateStaticMasterPassword();

      expect(result.password).toContain('abcdefghijklmnop');
    });

    it('should generate new salt if none exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await generateStaticMasterPassword();

      expect(cryptoService.generateSalt).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.FIXED_SALT,
        mockFixedSalt,
      );
    });

    it('should use same salt on subsequent calls', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockFixedSalt);

      const result1 = await generateStaticMasterPassword();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);

      const result2 = await generateStaticMasterPassword();

      // Both should use same salt
      expect(result1.password).toBe(result2.password);
    });
  });

  // =========================================================================
  // Test Suite 13: Edge Cases
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle very long UID', async () => {
      const longUid = 'a'.repeat(500);
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: longUid,
        email: mockUser.email,
      });

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toContain(longUid);
    });

    it('should handle special characters in email', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: mockUser.uid,
        email: 'test+special@example.co.uk',
      });

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toContain('test+special@example.co.uk');
    });

    it('should handle Unicode characters', async () => {
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: 'user-中文-🔐',
        email: 'test@例え.jp',
      });

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBeDefined();
    });

    it('should handle empty string in AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('');

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(true);
    });

    it('should handle multiple rapid calls', async () => {
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      const promises = Array(10)
        .fill(null)
        .map(() => generateStaticMasterPassword());

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should only derive once due to in-flight deduplication
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalledTimes(1);
    });

    it('should maintain cache consistency across operations', async () => {
      const result1 = await generateStaticMasterPassword();

      await getStaticMasterPasswordInfo();
      await verifyStaticMasterPassword();

      const result2 = await generateStaticMasterPassword();

      expect(result1.password).toBe(result2.password);
    });

    it('should handle error without stack trace', async () => {
      const errorWithoutStack = new Error('Generic error');
      errorWithoutStack.stack = undefined;
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(errorWithoutStack);

      const result = await generateStaticMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Generic error');
    });
  });

  // =========================================================================
  // Test Suite 14: Concurrent Operations
  // =========================================================================
  describe('Concurrent Operations', () => {
    it('should handle concurrent generate and clear', async () => {
      const generatePromise = generateStaticMasterPassword();
      const clearPromise = clearStaticMasterPasswordCache();

      const [generateResult] = await Promise.all([
        generatePromise,
        clearPromise,
      ]);

      expect(generateResult.success).toBe(true);
    });

    it('should handle concurrent generate and reset', async () => {
      const generatePromise = generateStaticMasterPassword();
      const resetPromise = resetStaticMasterPassword();

      const [generateResult, resetResult] = await Promise.all([
        generatePromise,
        resetPromise,
      ]);

      expect(generateResult.success).toBe(true);
      expect(resetResult.success).toBe(true);
    });

    it('should handle concurrent verify and info', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(mockFixedSalt)
        .mockResolvedValueOnce(mockUser.uid)
        .mockResolvedValueOnce(mockFixedSalt)
        .mockResolvedValueOnce(mockUser.uid);

      const promises = [
        verifyStaticMasterPassword(),
        getStaticMasterPasswordInfo(),
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // Test Suite 15: Storage Key Constants
  // =========================================================================
  describe('Storage Key Constants', () => {
    it('should have consistent storage keys', () => {
      expect(STATIC_MP_KEYS.FIXED_SALT).toBe('static_mp_fixed_salt');
      expect(STATIC_MP_KEYS.USER_UUID).toBe('static_mp_user_uuid');
    });

    it('should use keys in AsyncStorage operations', async () => {
      await resetStaticMasterPassword();

      const removeItemCalls = (AsyncStorage.removeItem as jest.Mock).mock.calls;
      const keys = removeItemCalls.map((call: any[]) => call[0]);

      expect(keys).toContain(STATIC_MP_KEYS.FIXED_SALT);
      expect(keys).toContain(STATIC_MP_KEYS.USER_UUID);
    });
  });

  // =========================================================================
  // Test Suite 16: Deterministic Password Generation
  // =========================================================================
  describe('Deterministic Password Generation', () => {
    it('should generate same password for same inputs', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);

      const result1 = await generateStaticMasterPassword();

      clearStaticMasterPasswordCache();

      const result2 = await generateStaticMasterPassword();

      expect(result1.password).toBe(result2.password);
    });

    it('should generate different passwords for different users', async () => {
      const result1 = await generateStaticMasterPassword();

      clearStaticMasterPasswordCache();

      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: 'different-user',
        email: 'different@example.com',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);

      const result2 = await generateStaticMasterPassword();

      expect(result1.password).not.toBe(result2.password);
    });

    it('should generate different passwords for different salts', async () => {
      const result1 = await generateStaticMasterPassword();

      clearStaticMasterPasswordCache();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('different-salt');

      const result2 = await generateStaticMasterPassword();

      expect(result1.password).not.toBe(result2.password);
    });
  });

  // =========================================================================
  // Test Suite 17: Integration Workflow
  // =========================================================================
  describe('Integration Workflow', () => {
    it('should complete full workflow: generate, verify, clear', async () => {
      // Step 1: Generate
      let result = await generateStaticMasterPassword();
      expect(result.success).toBe(true);

      // Step 2: Verify
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === STATIC_MP_KEYS.FIXED_SALT)
          return Promise.resolve(mockFixedSalt);
        if (key === STATIC_MP_KEYS.USER_UUID)
          return Promise.resolve(mockUser.uid);
        return Promise.resolve(null);
      });

      const verifyResult = await verifyStaticMasterPassword();
      expect(verifyResult.valid).toBe(true);

      // Step 3: Clear cache
      await clearStaticMasterPasswordCache();

      // Step 4: Should regenerate (not use cache)
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);

      result = await generateStaticMasterPassword();
      expect(result.success).toBe(true);
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalled();
    });

    it('should complete full workflow: generate, info, reset', async () => {
      // Step 1: Generate
      const generateResult = await generateStaticMasterPassword();
      expect(generateResult.success).toBe(true);

      // Step 2: Get info
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(mockFixedSalt)
        .mockResolvedValueOnce(mockUser.uid);

      const infoResult = await getStaticMasterPasswordInfo();
      expect(infoResult.success).toBe(true);

      // Step 3: Reset
      const resetResult = await resetStaticMasterPassword();
      expect(resetResult.success).toBe(true);

      // Step 4: Verify reset cleared data
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.FIXED_SALT,
      );
    });

    it('should handle user logout scenario', async () => {
      // Step 1: User logs in and generates password
      const generateResult = await generateStaticMasterPassword();
      expect(generateResult.success).toBe(true);

      // Step 2: User logs out - clear all data
      await clearStaticMasterPasswordData();

      // Step 3: Verify storage was cleared
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.FIXED_SALT,
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STATIC_MP_KEYS.USER_UUID,
      );
    });

    it('should handle scenario: generate, cache hit, logout, login', async () => {
      // User 1: Generate and cache
      let result = await generateStaticMasterPassword();
      expect(result.success).toBe(true);

      // Cache hit
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();
      result = await generateStaticMasterPassword();
      expect(cryptoService.deriveKeyFromPassword).not.toHaveBeenCalled();

      // Logout
      await clearStaticMasterPasswordData();

      // Different user login
      (firebase.getCurrentUser as jest.Mock).mockReturnValue({
        uid: 'new-user-789',
        email: 'new@example.com',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockFixedSalt);
      (cryptoService.deriveKeyFromPassword as jest.Mock).mockClear();

      result = await generateStaticMasterPassword();
      expect(result.success).toBe(true);
      expect(result.userId).toBe('new-user-789');
    });
  });
});
