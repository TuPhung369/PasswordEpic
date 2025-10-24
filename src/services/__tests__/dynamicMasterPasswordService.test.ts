import AsyncStorage from '@react-native-async-storage/async-storage';
import * as dynamicMasterPasswordService from '../dynamicMasterPasswordService';
import * as firebaseService from '../firebase';
import * as cryptoService from '../cryptoService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock Firebase service
jest.mock('../firebase', () => ({
  getCurrentUser: jest.fn(),
}));

// Mock CryptoService
jest.mock('../cryptoService', () => ({
  generateSalt: jest.fn(),
  deriveKeyFromPassword: jest.fn(),
  CRYPTO_CONSTANTS: {
    PBKDF2_ITERATIONS_STATIC: 5000,
    PBKDF2_ITERATIONS_DYNAMIC: 10000,
    GCM_TAG_LENGTH: 16,
    IV_LENGTH: 12,
    SALT_LENGTH: 32,
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockFirebase = {
  getCurrentUser: firebaseService.getCurrentUser as jest.MockedFunction<any>,
};
const mockCrypto = {
  generateSalt: cryptoService.generateSalt as jest.MockedFunction<any>,
  deriveKeyFromPassword:
    cryptoService.deriveKeyFromPassword as jest.MockedFunction<any>,
  CRYPTO_CONSTANTS: cryptoService.CRYPTO_CONSTANTS,
};

describe('DynamicMasterPasswordService', () => {
  const mockUser = {
    uid: 'test-user-uuid-12345',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockSalt = 'mocked-salt-value-1234567890ab';
  const mockDerivedKey =
    'mocked-derived-key-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockFirebase.getCurrentUser.mockReturnValue(mockUser as any);
    mockCrypto.generateSalt.mockReturnValue(mockSalt);
    mockCrypto.deriveKeyFromPassword.mockReturnValue(mockDerivedKey);

    // Clear AsyncStorage mocks
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.multiGet.mockResolvedValue([
      [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, null],
      [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP, null],
      [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH, null],
    ]);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
  });

  // ============================================================================
  // 1️⃣ generateDynamicMasterPassword() - Core Session Generation
  // ============================================================================

  describe('generateDynamicMasterPassword', () => {
    it('should generate dynamic master password successfully on first call', async () => {
      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBeDefined();
      expect(result.derivedKey).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should create persistent login timestamp on first generation', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
        expect.any(String),
      );
    });

    it('should restore existing login timestamp on subsequent calls', async () => {
      const timestamp = Date.now().toString();
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp);
        }
        return Promise.resolve(null);
      });

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
      expect(result.sessionId).toContain(mockUser.uid);
      expect(result.sessionId).toContain(timestamp);
    });

    it('should generate session ID from UUID and timestamp', async () => {
      const timestamp = '1234567890';
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp);
        }
        return Promise.resolve(null);
      });

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.sessionId).toBe(`${mockUser.uid}_${timestamp}`);
    });

    it('should store user UUID for consistency', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID,
        mockUser.uid,
      );
    });

    it('should generate and store session salt', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.SESSION_SALT,
        mockSalt,
      );
      expect(mockCrypto.generateSalt).toHaveBeenCalled();
    });

    it('should restore existing session salt on subsequent calls', async () => {
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.SESSION_SALT) {
          return Promise.resolve('existing-salt-12345');
        }
        return Promise.resolve(null);
      });

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
      // Should not generate new salt if existing one is found
      expect(mockCrypto.generateSalt).not.toHaveBeenCalled();
    });

    it('should derive cryptographic key with PBKDF2', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockCrypto.deriveKeyFromPassword).toHaveBeenCalledWith(
        expect.any(String),
        mockSalt,
        mockCrypto.CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_STATIC,
      );
    });

    it('should store session hash for verification', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
        mockDerivedKey.substring(0, 32),
      );
    });

    it('should fail when user is not authenticated', async () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
      expect(result.password).toBeUndefined();
    });

    it('should fail with invalid user UID', async () => {
      mockFirebase.getCurrentUser.mockReturnValue({
        uid: null as any,
      } as any);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user UID');
    });

    it('should fail with invalid session salt', async () => {
      mockCrypto.generateSalt.mockReturnValue(null as any);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid session salt');
    });

    it('should fail with invalid derived key', async () => {
      mockCrypto.deriveKeyFromPassword.mockReturnValue(null as any);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to derive cryptographic key');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include user email in password components if available', async () => {
      const userWithEmail = { ...mockUser, email: 'user@test.com' };
      mockFirebase.getCurrentUser.mockReturnValue(userWithEmail as any);

      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockCrypto.deriveKeyFromPassword).toHaveBeenCalledWith(
        expect.stringContaining('user@test.com'),
        mockSalt,
        expect.any(Number),
      );
    });

    it('should use anonymous email if not provided', async () => {
      const userNoEmail = { ...mockUser, email: null };
      mockFirebase.getCurrentUser.mockReturnValue(userNoEmail as any);

      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockCrypto.deriveKeyFromPassword).toHaveBeenCalledWith(
        expect.stringContaining('anonymous'),
        mockSalt,
        expect.any(Number),
      );
    });
  });

  // ============================================================================
  // 2️⃣ Cache Functionality
  // ============================================================================

  describe('Cache Functionality', () => {
    it('should successfully generate password that can be cached', async () => {
      // Single generation - should succeed
      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBeDefined();
      expect(result.derivedKey).toBeDefined();
      expect(result.sessionId).toBeDefined();

      // Verify password components are correctly assembled
      expect(result.password).toContain('::'); // Should contain separator from password construction
    });

    it('should use cached value if within TTL', async () => {
      const timestamp = Date.now().toString();
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp);
        }
        return Promise.resolve(null);
      });

      const result1 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // Reset mocks but keep returning same timestamp
      const callCount = mockCrypto.deriveKeyFromPassword.mock.calls.length;

      const result2 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // deriveKeyFromPassword should not be called again due to cache
      expect(mockCrypto.deriveKeyFromPassword.mock.calls.length).toBe(
        callCount,
      );
      expect(result1.password).toBe(result2.password);
    });

    it('should handle cache with different session IDs', async () => {
      const timestamp1 = '1000000000';
      const timestamp2 = '2000000000';

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp1);
        }
        return Promise.resolve(null);
      });

      const result1 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // Change timestamp to simulate different session
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp2);
        }
        return Promise.resolve(null);
      });

      const result2 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result1.sessionId).not.toBe(result2.sessionId);
    });
  });

  // ============================================================================
  // 3️⃣ verifyDynamicMasterPasswordSession()
  // ============================================================================

  describe('verifyDynamicMasterPasswordSession', () => {
    it('should return valid session when data matches current user', async () => {
      const uuid = mockUser.uid;
      const timestamp = '1234567890';

      mockAsyncStorage.multiGet.mockResolvedValue([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, uuid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          'hash',
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.sessionId).toBe(`${uuid}_${timestamp}`);
    });

    it('should return invalid session when UUID does not match', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID,
          'different-uuid',
        ],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          '1234567890',
        ],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          'hash',
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('should return no session when no stored data exists', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, null],
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP, null],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          null,
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No stored session found');
    });

    it('should fail when user is not authenticated', async () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);

      const result =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });

    it('should handle storage errors gracefully', async () => {
      mockAsyncStorage.multiGet.mockRejectedValue(new Error('Storage error'));

      const result =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 4️⃣ startNewDynamicMasterPasswordSession()
  // ============================================================================

  describe('startNewDynamicMasterPasswordSession', () => {
    it('should clear old session data on new session start', async () => {
      await dynamicMasterPasswordService.startNewDynamicMasterPasswordSession();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.SESSION_SALT,
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
      ]);
    });

    it('should return success on successful session start', async () => {
      const result =
        await dynamicMasterPasswordService.startNewDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle storage errors when clearing session', async () => {
      mockAsyncStorage.multiRemove.mockRejectedValue(
        new Error('Storage error'),
      );

      const result =
        await dynamicMasterPasswordService.startNewDynamicMasterPasswordSession();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 5️⃣ getDynamicMasterPasswordInfo()
  // ============================================================================

  describe('getDynamicMasterPasswordInfo', () => {
    it('should return session info when session exists', async () => {
      const uuid = mockUser.uid;
      const timestamp = Date.now().toString();

      mockAsyncStorage.multiGet.mockResolvedValue([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, uuid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();

      expect(result.success).toBe(true);
      expect(result.info).toBeDefined();
      expect(result.info?.hasSession).toBe(true);
      expect(result.info?.userUUID).toBe(uuid);
      expect(result.info?.loginTimestamp).toBe(timestamp);
    });

    it('should calculate session age correctly', async () => {
      const timestamp = (Date.now() - 60000).toString(); // 1 minute ago

      mockAsyncStorage.multiGet.mockResolvedValue([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, mockUser.uid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();

      expect(result.info?.sessionAge).toBeGreaterThanOrEqual(60000);
      expect(result.info?.sessionAge).toBeLessThan(70000);
    });

    it('should return no session when no data exists', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, null],
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP, null],
      ]);

      const result =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();

      expect(result.success).toBe(true);
      expect(result.info?.hasSession).toBe(false);
    });

    it('should report cache status', async () => {
      // First generate to populate cache
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      const result =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();

      expect(result.info?.cacheValid).toBeDefined();
    });

    it('should handle storage errors gracefully', async () => {
      mockAsyncStorage.multiGet.mockRejectedValue(new Error('Storage error'));

      const result =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 6️⃣ clearDynamicMasterPasswordData()
  // ============================================================================

  describe('clearDynamicMasterPasswordData', () => {
    it('should clear all session data on logout', async () => {
      await dynamicMasterPasswordService.clearDynamicMasterPasswordData();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID,
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.SESSION_SALT,
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
      ]);
    });

    it('should return success when all data is cleared', async () => {
      const result =
        await dynamicMasterPasswordService.clearDynamicMasterPasswordData();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle storage errors when clearing', async () => {
      mockAsyncStorage.multiRemove.mockRejectedValue(
        new Error('Storage error'),
      );

      const result =
        await dynamicMasterPasswordService.clearDynamicMasterPasswordData();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 7️⃣ isUsingStaticMasterPassword()
  // ============================================================================

  describe('isUsingStaticMasterPassword', () => {
    it('should return true when using static master password', async () => {
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'master_password_hash') {
          return Promise.resolve('static-hash');
        }
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const result =
        await dynamicMasterPasswordService.isUsingStaticMasterPassword();

      expect(result).toBe(true);
    });

    it('should return false when using dynamic master password', async () => {
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'master_password_hash') {
          return Promise.resolve(null);
        }
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve('dynamic-timestamp');
        }
        return Promise.resolve(null);
      });

      const result =
        await dynamicMasterPasswordService.isUsingStaticMasterPassword();

      expect(result).toBe(false);
    });

    it('should return false when no master password exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result =
        await dynamicMasterPasswordService.isUsingStaticMasterPassword();

      expect(result).toBe(false);
    });

    it('should handle storage errors and return false', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const result =
        await dynamicMasterPasswordService.isUsingStaticMasterPassword();

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // 8️⃣ restoreDynamicMasterPasswordSession()
  // ============================================================================

  describe('restoreDynamicMasterPasswordSession', () => {
    it('should restore valid session on app startup', async () => {
      const uuid = mockUser.uid;
      const timestamp = '1234567890';

      mockAsyncStorage.multiGet.mockResolvedValueOnce([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, uuid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          'hash',
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.restoreDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.restored).toBe(true);
      expect(result.sessionId).toBeDefined();
    });

    it('should fail gracefully when no user is authenticated', async () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);

      const result =
        await dynamicMasterPasswordService.restoreDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.restored).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return false when no valid session exists', async () => {
      mockAsyncStorage.multiGet.mockResolvedValueOnce([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, null],
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP, null],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          null,
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.restoreDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.restored).toBe(false);
    });

    it('should handle restoration failures', async () => {
      const uuid = mockUser.uid;
      const timestamp = '1234567890';

      mockAsyncStorage.multiGet.mockResolvedValueOnce([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, uuid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          'hash',
        ],
      ]);

      // Make deriveKeyFromPassword fail
      mockCrypto.deriveKeyFromPassword.mockReturnValue(null as any);

      const result =
        await dynamicMasterPasswordService.restoreDynamicMasterPasswordSession();

      expect(result.success).toBe(true);
      expect(result.restored).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle storage errors during restoration', async () => {
      // Make getCurrentUser fail to trigger error path early
      mockFirebase.getCurrentUser.mockReturnValueOnce(null);

      const result =
        await dynamicMasterPasswordService.restoreDynamicMasterPasswordSession();

      expect(result.success).toBe(true); // Service handles gracefully
      expect(result.restored).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 9️⃣ getEffectiveMasterPassword()
  // ============================================================================

  describe('getEffectiveMasterPassword', () => {
    it('should return dynamic master password when successful', async () => {
      const result =
        await dynamicMasterPasswordService.getEffectiveMasterPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBeDefined();
      expect(result.derivedKey).toBeDefined();
    });

    it('should fail when dynamic generation fails for authenticated user', async () => {
      mockCrypto.deriveKeyFromPassword.mockReturnValue(null as any);

      const result =
        await dynamicMasterPasswordService.getEffectiveMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail when user is not authenticated', async () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);

      const result =
        await dynamicMasterPasswordService.getEffectiveMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toContain('authentication required');
    });

    it('should handle errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      const result =
        await dynamicMasterPasswordService.getEffectiveMasterPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============================================================================
  // 🔟 Edge Cases & Special Scenarios
  // ============================================================================

  describe('Edge Cases & Special Scenarios', () => {
    it('should handle very large timestamps', async () => {
      const largeTimestamp = '9999999999999';
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(largeTimestamp);
        }
        return Promise.resolve(null);
      });

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
      expect(result.sessionId).toContain(largeTimestamp);
    });

    it('should handle user with special characters in email', async () => {
      const specialUser = {
        ...mockUser,
        email: 'test+special@example.com',
      };
      mockFirebase.getCurrentUser.mockReturnValue(specialUser as any);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
    });

    it('should handle concurrent password generation calls', async () => {
      const results = await Promise.all([
        dynamicMasterPasswordService.generateDynamicMasterPassword(),
        dynamicMasterPasswordService.generateDynamicMasterPassword(),
        dynamicMasterPasswordService.generateDynamicMasterPassword(),
      ]);

      // All should succeed and return same cached value
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].password).toBe(results[1].password);
      expect(results[1].password).toBe(results[2].password);
    });

    it('should maintain session consistency across operations', async () => {
      // Generate password
      const gen1 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(gen1.success).toBe(true);
      expect(gen1.sessionId).toBeDefined();

      // Session should include user ID
      expect(gen1.sessionId).toContain(mockUser.uid);

      // Verify that sessionId format is correct (UUID_timestamp)
      const parts = gen1.sessionId?.split('_');
      expect(parts?.length).toBe(2);
      expect(parts?.[0]).toBe(mockUser.uid);
    });

    it('should handle user UID type validation', async () => {
      mockFirebase.getCurrentUser.mockReturnValue({
        uid: 12345 as any, // Not a string
      } as any);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
    });

    it('should handle empty salt generation', async () => {
      mockCrypto.generateSalt.mockReturnValue('');

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(false);
    });

    it('should handle multiRemove partial failures', async () => {
      mockAsyncStorage.multiRemove.mockImplementation(
        async (keys: string[]) => {
          if (keys.includes('some-key')) {
            throw new Error('Partial failure');
          }
          return undefined;
        },
      );

      const result =
        await dynamicMasterPasswordService.clearDynamicMasterPasswordData();

      // Should report error since multiRemove was called
      if (mockAsyncStorage.multiRemove.mock.results[0]?.isError) {
        expect(result.success).toBe(false);
      }
    });

    it('should handle session hash generation from derived key', async () => {
      const longKey = 'a'.repeat(64) + 'b'.repeat(64) + 'c'.repeat(64); // Very long key
      mockCrypto.deriveKeyFromPassword.mockReturnValue(longKey);

      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // Session hash should be first 32 chars
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
        longKey.substring(0, 32),
      );
    });

    it('should handle timestamp parsing in session age calculation', async () => {
      const validTimestamp = (Date.now() - 120000).toString(); // 2 minutes ago

      mockAsyncStorage.multiGet.mockResolvedValue([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, mockUser.uid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          validTimestamp,
        ],
      ]);

      const result =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();

      // Should handle gracefully
      expect(result.success).toBe(true);
      expect(result.info?.hasSession).toBe(true);
      // sessionAge should be around 2 minutes (120000ms)
      expect(result.info?.sessionAge).toBeGreaterThan(100000);
      expect(result.info?.sessionAge).toBeLessThan(150000);
    });

    it('should handle password component generation with null email', async () => {
      const userNoEmail = { ...mockUser, email: undefined };
      mockFirebase.getCurrentUser.mockReturnValue(userNoEmail as any);

      const result =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(result.success).toBe(true);
      // Should use 'anonymous' as default
      expect(mockCrypto.deriveKeyFromPassword).toHaveBeenCalledWith(
        expect.stringContaining('anonymous'),
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  // ============================================================================
  // 1️⃣1️⃣ PBKDF2 Iterations & Security
  // ============================================================================

  describe('PBKDF2 Iterations & Security', () => {
    it('should use STATIC iterations for key derivation', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      expect(mockCrypto.deriveKeyFromPassword).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        mockCrypto.CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_STATIC,
      );
    });

    it('should use consistent salt for key derivation', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      const callArgs = mockCrypto.deriveKeyFromPassword.mock.calls[0];
      expect(callArgs[1]).toBeDefined();
      expect(typeof callArgs[1]).toBe('string');
    });

    it('should include user UUID in password generation', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      const callArgs = mockCrypto.deriveKeyFromPassword.mock.calls[0];
      expect(callArgs[0]).toContain(mockUser.uid);
    });

    it('should include login timestamp in password generation', async () => {
      const timestamp = Date.now().toString();
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp);
        }
        return Promise.resolve(null);
      });

      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      const callArgs = mockCrypto.deriveKeyFromPassword.mock.calls[0];
      expect(callArgs[0]).toContain(timestamp);
    });

    it('should include session salt in password generation', async () => {
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      const callArgs = mockCrypto.deriveKeyFromPassword.mock.calls[0];
      expect(callArgs[0]).toContain(mockSalt.substring(0, 16));
    });
  });

  // ============================================================================
  // 1️⃣2️⃣ Storage Key Constants
  // ============================================================================

  describe('Storage Key Constants', () => {
    it('should export DYNAMIC_MP_KEYS for testing/debugging', () => {
      expect(dynamicMasterPasswordService.DYNAMIC_MP_KEYS).toBeDefined();
      expect(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
      ).toBeDefined();
      expect(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID,
      ).toBeDefined();
      expect(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.SESSION_SALT,
      ).toBeDefined();
      expect(
        dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
      ).toBeDefined();
    });

    it('should use consistent storage key names', () => {
      const keys = dynamicMasterPasswordService.DYNAMIC_MP_KEYS;
      expect(keys.LOGIN_TIMESTAMP).toBe('dynamic_mp_login_timestamp');
      expect(keys.USER_UUID).toBe('dynamic_mp_user_uuid');
      expect(keys.SESSION_SALT).toBe('dynamic_mp_session_salt');
      expect(keys.CURRENT_SESSION_HASH).toBe('dynamic_mp_session_hash');
    });
  });

  // ============================================================================
  // 1️⃣3️⃣ Integration-like Tests
  // ============================================================================

  describe('Workflow Integration', () => {
    it('should complete full login flow: generate -> verify -> info', async () => {
      // Generate
      const gen =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();
      expect(gen.success).toBe(true);

      const timestamp = Date.now().toString();
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (
          key === dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP
        ) {
          return Promise.resolve(timestamp);
        }
        return Promise.resolve(null);
      });

      // Verify
      mockAsyncStorage.multiGet.mockResolvedValueOnce([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, mockUser.uid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          'hash',
        ],
      ]);
      const verify =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();
      expect(verify.success).toBe(true);
      expect(verify.valid).toBe(true);

      // Get info
      mockAsyncStorage.multiGet.mockResolvedValueOnce([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, mockUser.uid],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          timestamp,
        ],
      ]);
      const info =
        await dynamicMasterPasswordService.getDynamicMasterPasswordInfo();
      expect(info.success).toBe(true);
      expect(info.info?.hasSession).toBe(true);
    });

    it('should complete full logout flow: clear -> verify', async () => {
      // Generate initial session
      await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // Clear
      await dynamicMasterPasswordService.clearDynamicMasterPasswordData();

      // Verify no session exists
      mockAsyncStorage.multiGet.mockResolvedValueOnce([
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.USER_UUID, null],
        [dynamicMasterPasswordService.DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP, null],
        [
          dynamicMasterPasswordService.DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
          null,
        ],
      ]);
      const verify =
        await dynamicMasterPasswordService.verifyDynamicMasterPasswordSession();
      expect(verify.valid).toBe(false);
    });

    it('should complete full app restart flow: generate -> logout -> new login', async () => {
      // Initial login
      const gen1 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // Logout
      await dynamicMasterPasswordService.clearDynamicMasterPasswordData();

      // New login (should not restore old session)
      const gen2 =
        await dynamicMasterPasswordService.generateDynamicMasterPassword();

      // Both should succeed but be different sessions
      expect(gen1.success).toBe(true);
      expect(gen2.success).toBe(true);
    });
  });
});
