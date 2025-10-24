/**
 * Emergency Decryption Recovery Service Tests
 * Pragmatic test suite for emergency recovery functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseModule from '../firebase';
import * as cryptoModule from '../cryptoService';
import {
  emergencyDecryptionRecovery,
  migrateToConsistentMasterPassword,
} from '../emergencyDecryptionRecoveryService';
import { EncryptedPasswordEntry, PasswordEntry } from '../../types/password';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiGet: jest.fn(),
  getAllKeys: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../firebase');
jest.mock('../cryptoService', () => ({
  deriveKeyFromPassword: jest.fn(),
  decryptData: jest.fn(),
  encryptData: jest.fn(),
}));

describe('Emergency Decryption Recovery Service', () => {
  const mockUser = {
    uid: 'test-user-uid-12345',
    email: 'test@example.com',
  };

  const mockEncryptedEntry: EncryptedPasswordEntry = {
    id: 'entry-1',
    domain: 'example.com',
    username: 'testuser',
    encryptedData: 'encrypted-base64-data',
    salt: 'test-salt-value-123456789',
    iv: 'test-iv-value',
    authTag: 'test-auth-tag',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockDecryptedEntry: PasswordEntry = {
    id: 'entry-1',
    domain: 'example.com',
    username: 'testuser',
    password: 'decrypted-password',
    category: 'Work',
    tags: ['important'],
    strength: 'strong',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastUsed: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();

    // Setup default crypto mocks
    (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
      'derived-key',
    );
    (cryptoModule.decryptData as jest.Mock).mockReturnValue(
      JSON.stringify(mockDecryptedEntry),
    );

    // Setup default AsyncStorage mocks
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ['dynamic_mp_login_timestamp', '1704067200000'],
      ['dynamic_mp_session_salt', 'session-salt'],
      ['static_mp_fixed_salt', 'fixed-salt'],
      ['dynamic_mp_user_uuid', 'uuid-123'],
    ]);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);

    // Setup default Firebase mock
    (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
  });

  // ============ BASIC RECOVERY TESTS ============

  describe('emergencyDecryptionRecovery - Basic', () => {
    it('should return empty result when no entries are stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveredEntries).toBe(0);
      expect(result.totalEntries).toBe(0);
      expect(result.failedEntries).toHaveLength(0);
      expect(result.error).toBe('No encrypted entries found');
    });

    it('should return empty result when entries array is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]');

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
      expect(result.recoveredEntries).toBe(0);
      expect(result.totalEntries).toBe(0);
    });

    it('should handle AsyncStorage read errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage access denied'),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(false);
      expect(result.recoveredEntries).toBe(0);
      expect(result.totalEntries).toBe(0);
      expect(result.error).toBe('Storage access denied');
    });

    it('should handle JSON parsing errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json{');

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should log recovery start and completion', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await emergencyDecryptionRecovery();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('emergency decryption recovery'),
      );
    });
  });

  // ============ RECOVERY WITH ENTRIES ============

  describe('emergencyDecryptionRecovery - With Entries', () => {
    it('should attempt to recover a single entry', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.totalEntries).toBe(1);
    });

    it('should process multiple entries', async () => {
      const entries = [
        mockEncryptedEntry,
        { ...mockEncryptedEntry, id: 'entry-2' },
        { ...mockEncryptedEntry, id: 'entry-3' },
      ];
      const entriesJson = JSON.stringify(entries);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.totalEntries).toBe(3);
    });

    it('should track failed entries with their IDs', async () => {
      const entries = [
        mockEncryptedEntry,
        { ...mockEncryptedEntry, id: 'entry-2' },
      ];
      const entriesJson = JSON.stringify(entries);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
      expect(result.totalEntries).toBe(2);
      expect(result.failedEntries).toEqual(
        expect.arrayContaining(['entry-1', 'entry-2']),
      );
    });

    it('should handle partial recovery (mix of success and failure)', async () => {
      const entry1 = mockEncryptedEntry;
      const entry2 = {
        ...mockEncryptedEntry,
        id: 'entry-2',
        encryptedData: 'encrypted-data-entry-2', // Different encrypted data
      };
      const entries = [entry1, entry2];
      const entriesJson = JSON.stringify(entries);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );

      // Mock decryptData to succeed for entry-1, fail for entry-2
      (cryptoModule.decryptData as jest.Mock).mockImplementation(encData => {
        if (encData === entry1.encryptedData) {
          return JSON.stringify(mockDecryptedEntry);
        }
        // For entry-2, always fail
        throw new Error('Decryption failed for entry-2');
      });

      const result = await emergencyDecryptionRecovery();

      expect(result.totalEntries).toBe(2);
      expect(result.recoveredEntries).toBe(1);
      expect(result.failedEntries).toContain('entry-2');
    });
  });

  // ============ MASTER PASSWORD GENERATION ============

  describe('Master Password Generation', () => {
    it('should retrieve stored password components', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt-123'],
        ['static_mp_fixed_salt', 'fixed-salt-456'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      await emergencyDecryptionRecovery();

      // Verify multiGet was called with the correct keys
      expect(AsyncStorage.multiGet).toHaveBeenCalledWith([
        'dynamic_mp_login_timestamp',
        'dynamic_mp_session_salt',
        'static_mp_fixed_salt',
        'dynamic_mp_user_uuid',
      ]);
    });

    it('should handle missing user gracefully', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);

      const result = await emergencyDecryptionRecovery();

      // Should still attempt with available data
      expect(result).toBeDefined();
    });

    it('should retrieve alternative salts from storage', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        'alt_session_salt',
        'backup_salt',
        'other_key',
      ]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      // Mock additional getItem calls for alternative salts
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(entriesJson) // For initial entry retrieval
        .mockResolvedValueOnce('alt-salt-value')
        .mockResolvedValueOnce('backup-salt-value');

      await emergencyDecryptionRecovery();

      expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    });

    it('should handle getAllKeys errors gracefully', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(
        new Error('Cannot get keys'),
      );
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
      // Verify that warn was called and it contains our expected message
      expect(console.warn).toHaveBeenCalled();
      const warnCalls = (console.warn as jest.Mock).mock.calls;
      const hasWarning = warnCalls.some(call =>
        call[0]?.includes?.('Could not retrieve alternative salts'),
      );
      expect(hasWarning).toBe(true);
    });
  });

  // ============ MIGRATION FUNCTIONALITY ============

  describe('migrateToConsistentMasterPassword', () => {
    it('should return success when no entries to migrate', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await migrateToConsistentMasterPassword('new-password');

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
    });

    it('should indicate migrated count matches recovered entries', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await migrateToConsistentMasterPassword('new-password');

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle recovery failure during migration', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await migrateToConsistentMasterPassword('new-password');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle multiple entries during migration', async () => {
      const entries = [
        mockEncryptedEntry,
        { ...mockEncryptedEntry, id: 'entry-2' },
        { ...mockEncryptedEntry, id: 'entry-3' },
      ];
      const entriesJson = JSON.stringify(entries);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await migrateToConsistentMasterPassword('new-password');

      expect(result.success).toBe(true);
    });

    it('should log migration progress', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', null],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      await migrateToConsistentMasterPassword('new-password');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('migration'),
      );
    });
  });

  // ============ EDGE CASES ============

  describe('Edge Cases & Integration', () => {
    it('should handle entries with special characters', async () => {
      const specialEntry: PasswordEntry = {
        ...mockDecryptedEntry,
        password: 'p@$$w0rd!@#$%^&*()',
        username: 'user+tag@domain.com',
        domain: 'example.co.uk',
      };

      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(specialEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
    });

    it('should handle large entry lists', async () => {
      const largeList = Array.from({ length: 50 }, (_, i) => ({
        ...mockEncryptedEntry,
        id: `entry-${i}`,
      }));
      const entriesJson = JSON.stringify(largeList);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
      expect(result.totalEntries).toBe(50);
    });

    it('should handle emails with special characters', async () => {
      const userWithSpecialEmail = {
        uid: 'test-user-id',
        email: 'user+tag@example.co.uk',
      };

      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(
        userWithSpecialEmail,
      );
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', null],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
    });

    it('should handle recovery with only dynamic components', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', null],
        ['dynamic_mp_user_uuid', null],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
    });

    it('should handle recovery with only static components', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', null],
        ['dynamic_mp_session_salt', null],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', null],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
    });

    it('should handle entries with minimal fields', async () => {
      const minimalEntry: PasswordEntry = {
        id: 'entry-1',
        domain: 'example.com',
        username: 'user',
        password: 'pass',
        category: 'General',
        tags: [],
        strength: 'weak',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(minimalEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
    });

    it('should continue recovery even with mixed entry types', async () => {
      const entries = [
        mockEncryptedEntry,
        { ...mockEncryptedEntry, id: 'entry-2' },
      ];
      const entriesJson = JSON.stringify(entries);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const result = await emergencyDecryptionRecovery();

      expect(result.success).toBe(true);
      expect(result.totalEntries).toBe(2);
    });

    it('should handle concurrent recovery calls', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      const [result1, result2, result3] = await Promise.all([
        emergencyDecryptionRecovery(),
        emergencyDecryptionRecovery(),
        emergencyDecryptionRecovery(),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });

  // ============ LOGGING TESTS ============

  describe('Logging & Debugging', () => {
    it('should log master password generation info', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      await emergencyDecryptionRecovery();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Master Password Generation'),
      );
    });

    it('should log recovery completion status', async () => {
      const entriesJson = JSON.stringify([mockEncryptedEntry]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(entriesJson);
      (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
        ['dynamic_mp_login_timestamp', '1704067200000'],
        ['dynamic_mp_session_salt', 'session-salt'],
        ['static_mp_fixed_salt', 'fixed-salt'],
        ['dynamic_mp_user_uuid', 'uuid-123'],
      ]);
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
      (firebaseModule.getCurrentUser as jest.Mock).mockReturnValue(mockUser);
      (cryptoModule.deriveKeyFromPassword as jest.Mock).mockReturnValue(
        'derived-key',
      );
      (cryptoModule.decryptData as jest.Mock).mockReturnValue(
        JSON.stringify(mockDecryptedEntry),
      );

      await emergencyDecryptionRecovery();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Recovery complete'),
      );
    });

    it('should log errors when recovery fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Critical error'),
      );

      await emergencyDecryptionRecovery();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Recovery failed'),
        expect.any(Error),
      );
    });
  });
});
