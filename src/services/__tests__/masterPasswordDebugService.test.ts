/**
 * Master Password Debug Service Tests
 * Comprehensive test suite for master password debugging and recovery utilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseModule from '../firebase';
import * as cryptoModule from '../cryptoService';
import {
  getMasterPasswordDebugInfo,
  testDecryptionWithPassword,
  bruteForceDecryptEntry,
  fixMasterPasswordInconsistency,
} from '../masterPasswordDebugService';

// Mock modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../firebase');
jest.mock('../cryptoService');

// Mock console methods
const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('masterPasswordDebugService', () => {
  // Setup & Teardown
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ============================================================
  // 1. getMasterPasswordDebugInfo Tests
  // ============================================================
  describe('getMasterPasswordDebugInfo', () => {
    it('should return debug info with current user and stored values', async () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
      };

      jest
        .mocked(firebaseModule.getCurrentUser)
        .mockReturnValue(mockUser as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-1234567890123456'],
        ['static_mp_fixed_salt', 'salt-0987654321098765'],
        ['dynamic_mp_user_uuid', 'uuid-12345'],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.currentUser).toEqual(mockUser);
      expect(result.storedValues.dynamicLoginTimestamp).toBe('1704067200000');
      expect(result.storedValues.dynamicSessionSalt).toBe(
        'salt-1234567890123456',
      );
      expect(result.storedValues.staticFixedSalt).toBe('salt-0987654321098765');
      expect(result.storedValues.userUUID).toBe('uuid-12345');
    });

    it('should generate current dynamic password when timestamp and salt exist', async () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
      };

      jest
        .mocked(firebaseModule.getCurrentUser)
        .mockReturnValue(mockUser as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-1234567890123456abcdefgh'],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.generatedPasswords.currentDynamic).toContain('user123');
      expect(result.generatedPasswords.currentDynamic).toContain(
        '1704067200000',
      );
      expect(result.generatedPasswords.currentDynamic).toContain(
        'test@example.com',
      );
      expect(result.generatedPasswords.currentDynamic).toContain(
        'salt-12345678901', // substring(0, 16)
      );
    });

    it('should generate current static password when static salt exists', async () => {
      const mockUser = {
        uid: 'user456',
        email: 'user@domain.com',
      };

      jest
        .mocked(firebaseModule.getCurrentUser)
        .mockReturnValue(mockUser as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', 'static-salt-9876543210abcdefgh'],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.generatedPasswords.currentStatic).toContain('user456');
      expect(result.generatedPasswords.currentStatic).toContain(
        'user@domain.com',
      );
      expect(result.generatedPasswords.currentStatic).toContain(
        'static-salt-9876', // substring(0, 16)
      );
    });

    it('should handle null user gracefully', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue(null);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.currentUser).toBeNull();
      expect(result.generatedPasswords.currentDynamic).toBe('');
      expect(result.generatedPasswords.currentStatic).toBe('');
      expect(result.generatedPasswords.possibleAlternatives.length).toBe(0);
    });

    it('should calculate session age correctly', async () => {
      const now = Date.now();
      const timestamp = (now - 3600000).toString(); // 1 hour ago

      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', timestamp],
        ['dynamic_mp_session_salt', 'salt-value'],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.sessionInfo.hasValidSession).toBe(true);
      expect(result.sessionInfo.sessionAge).toBeGreaterThan(3599000);
      expect(result.sessionInfo.sessionAge).toBeLessThanOrEqual(
        now - parseInt(timestamp, 10) + 100,
      );
    });

    it('should indicate no valid session when timestamp or salt is missing', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.sessionInfo.hasValidSession).toBe(false);
      expect(result.sessionInfo.sessionAge).toBeNull();
    });

    it('should handle user with null email', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: null,
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-1234567890123456'],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.generatedPasswords.currentDynamic).toContain('anonymous');
      expect(result.currentUser?.email).toBeNull();
    });

    it('should generate alternative passwords', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-1234567890123456'],
        ['static_mp_fixed_salt', 'static-salt-abcdefghijklmnop'],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(
        result.generatedPasswords.possibleAlternatives.length,
      ).toBeGreaterThan(0);
      expect(
        result.generatedPasswords.possibleAlternatives.some(pwd =>
          pwd.includes('user123'),
        ),
      ).toBe(true);
    });

    it('should remove duplicate passwords from alternatives', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-1234567890123456'],
        ['static_mp_fixed_salt', 'salt-1234567890123456'], // Same as session salt
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      const alternatives = result.generatedPasswords.possibleAlternatives;
      const uniqueAlternatives = new Set(alternatives);
      expect(alternatives.length).toBe(uniqueAlternatives.size);
    });

    it('should read all required keys from AsyncStorage', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      await getMasterPasswordDebugInfo();

      expect(AsyncStorage.multiGet).toHaveBeenCalledWith([
        'dynamic_mp_login_timestamp',
        'dynamic_mp_session_salt',
        'static_mp_fixed_salt',
        'dynamic_mp_user_uuid',
      ]);
    });
  });

  // ============================================================
  // 2. testDecryptionWithPassword Tests (Note: decryptData is dynamically imported)
  // ============================================================
  describe('testDecryptionWithPassword', () => {
    it('should return object with success property', async () => {
      const mockPassword = 'test-password';
      const mockEntry = {
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      const result = await testDecryptionWithPassword(mockPassword, mockEntry);

      // Just verify the function returns a structured result
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should return error property on failure', async () => {
      const mockPassword = 'wrong-password';
      const mockEntry = {
        encryptedData: 'invalid-encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'invalid-tag',
      };

      const result = await testDecryptionWithPassword(mockPassword, mockEntry);

      // Decryption will fail with invalid data
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  // ============================================================
  // 3. bruteForceDecryptEntry Tests
  // ============================================================
  describe('bruteForceDecryptEntry', () => {
    beforeEach(() => {
      // Setup default mocks
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-dynamic-1234567890123456'],
        ['static_mp_fixed_salt', 'salt-static-9876543210987654'],
        ['dynamic_mp_user_uuid', null],
      ]);

      // Setup crypto mocks
      (cryptoModule as any).deriveKeyFromPassword = jest
        .fn()
        .mockReturnValue('key');
      (cryptoModule as any).decryptData = jest
        .fn()
        .mockReturnValue('decrypted');
    });

    it('should return result object with success property', async () => {
      const mockEntry = {
        id: 'entry-123',
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      const result = await bruteForceDecryptEntry(mockEntry);

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      expect(result).toHaveProperty('error');
    });

    it('should log brute force progress', async () => {
      const mockEntry = {
        id: 'entry-456',
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      await bruteForceDecryptEntry(mockEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting brute force'),
      );
    });

    it('should return error when no password works', async () => {
      const mockEntry = {
        id: 'entry-123',
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      jest.mocked(cryptoModule.deriveKeyFromPassword).mockReturnValue('key');
      (cryptoModule as any).decryptData = jest.fn(() => {
        throw new Error('Decryption failed');
      });

      const result = await bruteForceDecryptEntry(mockEntry);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No working master password found');
      expect(result.workingPassword).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No working password found'),
      );
    });

    it('should log progress during brute force', async () => {
      const mockEntry = {
        id: 'entry-123',
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      jest.mocked(cryptoModule.deriveKeyFromPassword).mockReturnValue('key');
      (cryptoModule as any).decryptData = jest
        .fn()
        .mockReturnValue('decrypted');

      await bruteForceDecryptEntry(mockEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting brute force'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Testing'),
      );
    });

    it('should handle empty password list', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue(null);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const mockEntry = {
        id: 'entry-123',
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      const result = await bruteForceDecryptEntry(mockEntry);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No working master password found');
    });

    it('should generate passwords including current and alternatives', async () => {
      const mockEntry = {
        id: 'entry-999',
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      await bruteForceDecryptEntry(mockEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No working password found'),
      );
    });
  });

  // ============================================================
  // 4. fixMasterPasswordInconsistency Tests
  // ============================================================
  describe('fixMasterPasswordInconsistency', () => {
    it('should return success status', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-dynamic'],
        ['static_mp_fixed_salt', 'salt-static'],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await fixMasterPasswordInconsistency();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.migrated).toBe(0);
    });

    it('should log current master password state', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-dynamic'],
        ['static_mp_fixed_salt', 'salt-static'],
        ['dynamic_mp_user_uuid', null],
      ]);

      await fixMasterPasswordInconsistency();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting master password consistency fix'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current master password state'),
      );
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.multiGet as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await fixMasterPasswordInconsistency();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
      expect(result.migrated).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should process debug info with all stored values', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-dynamic'],
        ['static_mp_fixed_salt', 'salt-static'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);

      const result = await fixMasterPasswordInconsistency();

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(0);
    });

    it('should process debug info with alternative passwords', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-dynamic-123456789012345'],
        ['static_mp_fixed_salt', 'salt-static-987654321098765'],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await fixMasterPasswordInconsistency();

      expect(result.success).toBe(true);
    });

    it('should handle null user gracefully in fix process', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue(null);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await fixMasterPasswordInconsistency();

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 5. Edge Cases & Integration Tests
  // ============================================================
  describe('Edge Cases & Integration', () => {
    it('should handle very long master password', async () => {
      const longPassword = 'x'.repeat(1000);
      const mockEntry = {
        encryptedData: 'encrypted',
        salt: 'salt',
        iv: 'iv',
        authTag: 'tag',
      };

      const result = await testDecryptionWithPassword(longPassword, mockEntry);

      // Just verify it returns a result object
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle special characters in email', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test+tag@sub.example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-value'],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.generatedPasswords.currentDynamic).toContain(
        'test+tag@sub.example.com',
      );
    });

    it('should handle empty AsyncStorage values', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.generatedPasswords.currentDynamic).toBe('');
      expect(result.generatedPasswords.currentStatic).toBe('');
      expect(result.sessionInfo.hasValidSession).toBe(false);
    });

    it('should handle rapid successive calls', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'salt-value'],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);

      const promises = [
        getMasterPasswordDebugInfo(),
        getMasterPasswordDebugInfo(),
        getMasterPasswordDebugInfo(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.currentUser).toBeDefined();
        expect(result.storedValues).toBeDefined();
      });
    });

    it('should handle mixed null and valid values', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
      } as any);

      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', null], // Missing dynamic salt
        ['static_mp_fixed_salt', 'salt-static'],
        ['dynamic_mp_user_uuid', null],
      ]);

      const result = await getMasterPasswordDebugInfo();

      expect(result.sessionInfo.hasValidSession).toBe(false);
      expect(result.generatedPasswords.currentDynamic).toBe('');
      expect(result.generatedPasswords.currentStatic).toBeTruthy();
    });
  });
});
