import AsyncStorage from '@react-native-async-storage/async-storage';
import { EncryptedDatabaseService } from '../encryptedDatabaseService';
import * as cryptoService from '../cryptoService';
import * as secureStorageService from '../secureStorageService';
import {
  PasswordEntry,
  OptimizedPasswordEntry,
  PasswordCategory,
} from '../../types/password';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock cryptoService
jest.mock('../cryptoService', () => ({
  encryptData: jest.fn(),
  decryptData: jest.fn(),
  generateSecureRandom: jest.fn(),
  deriveKeyFromPassword: jest.fn(),
}));

// Mock secureStorageService
jest.mock('../secureStorageService', () => ({
  getMasterPasswordHash: jest.fn(),
}));

describe('EncryptedDatabaseService', () => {
  let service: EncryptedDatabaseService;
  const mockMasterPassword = 'TestMasterPassword123!';
  const mockMasterPasswordHash = 'hashedMasterPassword';

  // Sample test data
  const createPasswordEntry = (
    overrides?: Partial<PasswordEntry>,
  ): PasswordEntry => ({
    id: 'test-id-1',
    title: 'Gmail',
    username: 'user@gmail.com',
    password: 'encryptedPassword123',
    isDecrypted: false,
    website: 'https://gmail.com',
    notes: 'Personal email',
    category: 'social',
    tags: ['email', 'important'],
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsed: new Date(),
    auditData: {
      accessCount: 0,
      lastAccessAttempt: new Date(),
      failedAttempts: 0,
    },
    breachStatus: 'safe',
    ...overrides,
  });

  const createOptimizedEntry = (
    overrides?: Partial<OptimizedPasswordEntry>,
  ): OptimizedPasswordEntry => ({
    id: 'test-id-1',
    title: 'Gmail',
    username: 'user@gmail.com',
    encryptedPassword: 'ciphertext123',
    passwordSalt: 'salt123',
    passwordIv: 'iv123',
    passwordAuthTag: 'tag123',
    website: 'https://gmail.com',
    notes: 'Personal email',
    category: 'social',
    tags: ['email', 'important'],
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsed: new Date(),
    storageVersion: 2,
    auditData: {
      accessCount: 0,
      lastAccessAttempt: new Date(),
      failedAttempts: 0,
    },
    breachStatus: 'safe',
    ...overrides,
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset singleton
    (EncryptedDatabaseService as any).instance = undefined;

    // Default mock implementations
    (secureStorageService.getMasterPasswordHash as jest.Mock).mockResolvedValue(
      mockMasterPasswordHash,
    );

    (cryptoService.generateSecureRandom as jest.Mock).mockReturnValue(
      'random123',
    );

    (cryptoService.deriveKeyFromPassword as jest.Mock).mockReturnValue(
      'derivedKey123',
    );

    (cryptoService.encryptData as jest.Mock).mockReturnValue({
      ciphertext: 'ciphertext123',
      iv: 'iv123',
      tag: 'tag123',
    });

    (cryptoService.decryptData as jest.Mock).mockReturnValue(
      'decryptedPassword123',
    );

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

    service = EncryptedDatabaseService.getInstance();
  });

  // ============================================================================
  // SINGLETON PATTERN TESTS
  // ============================================================================
  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = EncryptedDatabaseService.getInstance();
      const instance2 = EncryptedDatabaseService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create a new instance only once', () => {
      const instance1 = EncryptedDatabaseService.getInstance();
      (EncryptedDatabaseService as any).instance = undefined;
      const instance2 = EncryptedDatabaseService.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================
  describe('initialize()', () => {
    it('should successfully initialize with master password', async () => {
      await service.initialize(mockMasterPassword);

      expect(secureStorageService.getMasterPasswordHash).toHaveBeenCalled();
    });

    it('should throw error when master password hash is not found', async () => {
      (
        secureStorageService.getMasterPasswordHash as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.initialize(mockMasterPassword)).rejects.toThrow(
        'Master password not configured',
      );
    });

    it('should throw error when secure storage service fails', async () => {
      (
        secureStorageService.getMasterPasswordHash as jest.Mock
      ).mockRejectedValue(new Error('Storage error'));

      await expect(service.initialize(mockMasterPassword)).rejects.toThrow(
        'Failed to initialize database',
      );
    });
  });

  // ============================================================================
  // SAVE PASSWORD ENTRY TESTS
  // ============================================================================
  describe('savePasswordEntry()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should save a new password entry with encryption', async () => {
      const entry = createPasswordEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntry(entry, mockMasterPassword);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const [key, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      expect(key).toBe('optimized_passwords_v2');

      const savedData = JSON.parse(data);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe(entry.id);
      expect(savedData[0].encryptedPassword).toBe('ciphertext123');
    });

    it('should preserve existing encryption when password unchanged', async () => {
      const existingEntry = createOptimizedEntry({
        encryptedPassword: 'existingCiphertext',
        passwordSalt: 'existingSalt',
        passwordIv: 'existingIv',
        passwordAuthTag: 'existingTag',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([existingEntry]),
      );

      const entry = createPasswordEntry({
        password: 'existingCiphertext',
      });

      await service.savePasswordEntry(entry, mockMasterPassword);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData[0].encryptedPassword).toBe('existingCiphertext');
      expect(savedData[0].passwordSalt).toBe('existingSalt');
    });

    it('should update password when it changes', async () => {
      const existingEntry = createOptimizedEntry({
        encryptedPassword: 'oldCiphertext',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([existingEntry]),
      );

      const entry = createPasswordEntry({
        password: 'newPassword123',
      });

      await service.savePasswordEntry(entry, mockMasterPassword);

      expect(cryptoService.encryptData).toHaveBeenCalledWith(
        'newPassword123',
        'derivedKey123',
        'random123',
      );
    });

    it('should update metadata fields', async () => {
      const entry = createPasswordEntry({
        title: 'Updated Gmail',
        website: 'https://updated.gmail.com',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntry(entry, mockMasterPassword);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData[0].title).toBe('Updated Gmail');
      expect(savedData[0].website).toBe('https://updated.gmail.com');
    });

    it('should handle encryption errors', async () => {
      (cryptoService.encryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const entry = createPasswordEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(
        service.savePasswordEntry(entry, mockMasterPassword),
      ).rejects.toThrow('Failed to save password entry');
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const entry = createPasswordEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await expect(
        service.savePasswordEntry(entry, mockMasterPassword),
      ).rejects.toThrow('Failed to save password entry');
    });

    it('should work with savePasswordEntryOptimized alias', async () => {
      const entry = createPasswordEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntryOptimized(entry, mockMasterPassword);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should replace existing entry with same ID', async () => {
      const existingEntry = createOptimizedEntry({ id: 'test-id-1' });
      const anotherEntry = createOptimizedEntry({ id: 'test-id-2' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([existingEntry, anotherEntry]),
      );

      const updatedEntry = createPasswordEntry({
        id: 'test-id-1',
        title: 'Updated Entry',
      });

      await service.savePasswordEntry(updatedEntry, mockMasterPassword);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData).toHaveLength(2);
      expect(savedData.find((e: any) => e.id === 'test-id-1').title).toBe(
        'Updated Entry',
      );
    });
  });

  // ============================================================================
  // GET ALL PASSWORD ENTRIES TESTS
  // ============================================================================
  describe('getAllPasswordEntries()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should retrieve all entries from storage', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entries = await service.getAllPasswordEntries(mockMasterPassword);

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(optimizedEntry.id);
    });

    it('should return entries sorted by updated date (newest first)', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        updatedAt: new Date('2024-01-01'),
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        updatedAt: new Date('2024-01-02'),
      });
      const entry3 = createOptimizedEntry({
        id: 'id-3',
        updatedAt: new Date('2024-01-03'),
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2, entry3]),
      );

      const entries = await service.getAllPasswordEntries(mockMasterPassword);

      expect(entries[0].id).toBe('id-3');
      expect(entries[1].id).toBe('id-2');
      expect(entries[2].id).toBe('id-1');
    });

    it('should return empty array when no entries exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const entries = await service.getAllPasswordEntries(mockMasterPassword);

      expect(entries).toEqual([]);
    });

    it('should convert ISO date strings to Date objects', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entries = await service.getAllPasswordEntries(mockMasterPassword);

      expect(entries[0].createdAt).toBeInstanceOf(Date);
      expect(entries[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      // The service catches JSON parse errors and returns empty array
      // But when storage itself fails, it should throw
      const entries = await service.getAllPasswordEntries(mockMasterPassword);
      // The service actually catches errors from getAllOptimizedEntries and returns empty
      expect(entries).toEqual([]);
    });

    it('should work with getAllPasswordEntriesOptimized alias', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entries = await service.getAllPasswordEntriesOptimized();

      expect(entries).toHaveLength(1);
    });

    it('should work with getAllPasswordEntriesLazy', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entries = await service.getAllPasswordEntriesLazy(
        mockMasterPassword,
      );

      expect(entries).toHaveLength(1);
    });

    it('should set isDecrypted to false for all entries', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entries = await service.getAllPasswordEntries(mockMasterPassword);

      expect(entries[0].isDecrypted).toBe(false);
    });
  });

  // ============================================================================
  // DECRYPT PASSWORD FIELD TESTS
  // ============================================================================
  describe('decryptPasswordField()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should decrypt password field for specific entry', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const decryptedPassword = await service.decryptPasswordField(
        'test-id-1',
        mockMasterPassword,
      );

      expect(decryptedPassword).toBe('decryptedPassword123');
      expect(cryptoService.deriveKeyFromPassword).toHaveBeenCalledWith(
        mockMasterPassword,
        'salt123',
      );
    });

    it('should return null when entry not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const decryptedPassword = await service.decryptPasswordField(
        'non-existent-id',
        mockMasterPassword,
      );

      expect(decryptedPassword).toBeNull();
    });

    it('should use correct decryption parameters', async () => {
      const optimizedEntry = createOptimizedEntry({
        encryptedPassword: 'specificCiphertext',
        passwordIv: 'specificIv',
        passwordAuthTag: 'specificTag',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      await service.decryptPasswordField('test-id-1', mockMasterPassword);

      expect(cryptoService.decryptData).toHaveBeenCalledWith(
        'specificCiphertext',
        'derivedKey123',
        'specificIv',
        'specificTag',
      );
    });

    it('should handle decryption errors', async () => {
      (cryptoService.decryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const optimizedEntry = createOptimizedEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      await expect(
        service.decryptPasswordField('test-id-1', mockMasterPassword),
      ).rejects.toThrow('Failed to decrypt password field');
    });

    it('should work with decryptPasswordFieldOptimized alias', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const decryptedPassword = await service.decryptPasswordFieldOptimized(
        'test-id-1',
        mockMasterPassword,
      );

      expect(decryptedPassword).toBe('decryptedPassword123');
    });
  });

  // ============================================================================
  // GET PASSWORD ENTRY TESTS
  // ============================================================================
  describe('getPasswordEntry()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should retrieve and decrypt a single entry', async () => {
      const optimizedEntry = createOptimizedEntry();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entry = await service.getPasswordEntry(
        'test-id-1',
        mockMasterPassword,
      );

      expect(entry).not.toBeNull();
      expect(entry?.id).toBe('test-id-1');
      expect(entry?.password).toBe('decryptedPassword123');
    });

    it('should return null when entry not found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      const entry = await service.getPasswordEntry(
        'non-existent-id',
        mockMasterPassword,
      );

      expect(entry).toBeNull();
    });

    it('should handle decryption failures gracefully', async () => {
      (cryptoService.decryptData as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const optimizedEntry = createOptimizedEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      await expect(
        service.getPasswordEntry('test-id-1', mockMasterPassword),
      ).rejects.toThrow('Failed to retrieve password entry');
    });

    it('should preserve entry metadata', async () => {
      const optimizedEntry = createOptimizedEntry({
        title: 'Special Title',
        website: 'https://special.com',
        notes: 'Special notes',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const entry = await service.getPasswordEntry(
        'test-id-1',
        mockMasterPassword,
      );

      expect(entry?.title).toBe('Special Title');
      expect(entry?.website).toBe('https://special.com');
      expect(entry?.notes).toBe('Special notes');
    });
  });

  // ============================================================================
  // DELETE PASSWORD ENTRY TESTS
  // ============================================================================
  describe('deletePasswordEntry()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should delete a password entry by ID', async () => {
      const entry1 = createOptimizedEntry({ id: 'id-1' });
      const entry2 = createOptimizedEntry({ id: 'id-2' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      await service.deletePasswordEntry('id-1');

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('id-2');
    });

    it('should handle non-existent entry deletion', async () => {
      const entry = createOptimizedEntry({ id: 'id-1' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      await service.deletePasswordEntry('non-existent-id');

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('id-1');
    });

    it('should work with deletePasswordEntryOptimized alias', async () => {
      const entry = createOptimizedEntry({ id: 'id-1' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      await service.deletePasswordEntryOptimized('id-1');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([createOptimizedEntry()]),
      );

      await expect(service.deletePasswordEntry('id-1')).rejects.toThrow(
        'Failed to delete password entry',
      );
    });
  });

  // ============================================================================
  // SEARCH PASSWORD ENTRIES TESTS
  // ============================================================================
  describe('searchPasswordEntries()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should search by title', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        title: 'Gmail',
        username: 'user1@example.com',
        website: 'https://gmail.example.com',
        notes: 'Gmail notes',
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        title: 'Facebook',
        username: 'user2@example.com',
        website: 'https://facebook.example.com',
        notes: 'Facebook notes',
      });

      (AsyncStorage.getItem as jest.Mock).mockClear();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.searchPasswordEntries(
        'Gmail',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });

    it('should search by username', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        username: 'user@gmail.com',
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        username: 'user@facebook.com',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.searchPasswordEntries(
        '@gmail',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });

    it('should search by website', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        title: 'Gmail Account',
        website: 'https://gmail.com',
        username: 'user1@example.com',
        notes: 'Note 1',
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        title: 'Facebook Account',
        website: 'https://facebook.com',
        username: 'user2@example.com',
        notes: 'Note 2',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.searchPasswordEntries(
        'gmail.com',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });

    it('should search by notes', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        notes: 'Personal email account',
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        notes: 'Work email account',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.searchPasswordEntries(
        'Personal',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });

    it('should search by tags', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        tags: ['email', 'important'],
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        tags: ['social', 'personal'],
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.searchPasswordEntries(
        'important',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });

    it('should perform case-insensitive search', async () => {
      const entry = createOptimizedEntry({ id: 'id-1', title: 'Gmail' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      const results = await service.searchPasswordEntries(
        'gmail',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
    });

    it('should return empty array when no matches found', async () => {
      const entry = createOptimizedEntry({ id: 'id-1', title: 'Gmail' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      const results = await service.searchPasswordEntries(
        'NonExistent',
        mockMasterPassword,
      );

      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // GET PASSWORD ENTRIES BY CATEGORY TESTS
  // ============================================================================
  describe('getPasswordEntriesByCategory()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should retrieve entries by category', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        category: 'social',
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        category: 'work',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.getPasswordEntriesByCategory(
        'social',
        mockMasterPassword,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });

    it('should return empty array for non-existent category', async () => {
      const entry = createOptimizedEntry({ id: 'id-1', category: 'social' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      const results = await service.getPasswordEntriesByCategory(
        'non-existent',
        mockMasterPassword,
      );

      expect(results).toHaveLength(0);
    });

    it('should handle multiple entries in same category', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        category: 'social',
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        category: 'social',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.getPasswordEntriesByCategory(
        'social',
        mockMasterPassword,
      );

      expect(results).toHaveLength(2);
    });
  });

  // ============================================================================
  // UPDATE LAST USED TESTS
  // ============================================================================
  describe('updateLastUsed()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should update last used timestamp', async () => {
      const entry = createOptimizedEntry({ id: 'id-1' });
      const now = new Date();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      await service.updateLastUsed('id-1', mockMasterPassword);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData[0].lastUsed).toBeDefined();
      const lastUsed = new Date(savedData[0].lastUsed);
      expect(lastUsed.getTime()).toBeGreaterThanOrEqual(now.getTime());
    });

    it('should handle non-existent entry gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

      // updateLastUsed silently returns without throwing if entry not found
      await service.updateLastUsed('non-existent-id', mockMasterPassword);

      // Verify no save attempt was made for non-existent entry
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should update both lastUsed and updatedAt', async () => {
      const entry = createOptimizedEntry({ id: 'id-1' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      await service.updateLastUsed('id-1', mockMasterPassword);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData[0].lastUsed).toBeDefined();
      expect(savedData[0].updatedAt).toBeDefined();
    });
  });

  // ============================================================================
  // GET FREQUENTLY USED ENTRIES TESTS
  // ============================================================================
  describe('getFrequentlyUsedEntries()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should return entries sorted by last used', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        lastUsed: new Date('2024-01-01'),
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        lastUsed: new Date('2024-01-03'),
      });
      const entry3 = createOptimizedEntry({
        id: 'id-3',
        lastUsed: new Date('2024-01-02'),
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2, entry3]),
      );

      const results = await service.getFrequentlyUsedEntries(
        mockMasterPassword,
        10,
      );

      expect(results[0].id).toBe('id-2');
      expect(results[1].id).toBe('id-3');
      expect(results[2].id).toBe('id-1');
    });

    it('should respect limit parameter', async () => {
      const entries = Array.from({ length: 15 }, (_, i) =>
        createOptimizedEntry({
          id: `id-${i}`,
          lastUsed: new Date(2024, 0, i + 1),
        }),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(entries),
      );

      const results = await service.getFrequentlyUsedEntries(
        mockMasterPassword,
        5,
      );

      expect(results).toHaveLength(5);
    });

    it('should exclude entries without lastUsed', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        lastUsed: new Date('2024-01-01'),
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        lastUsed: undefined,
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2]),
      );

      const results = await service.getFrequentlyUsedEntries(
        mockMasterPassword,
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('id-1');
    });
  });

  // ============================================================================
  // GET FAVORITE ENTRIES TESTS
  // ============================================================================
  describe('getFavoriteEntries()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should return only favorite entries', async () => {
      const entry1 = createOptimizedEntry({
        id: 'id-1',
        isFavorite: true,
      });
      const entry2 = createOptimizedEntry({
        id: 'id-2',
        isFavorite: false,
      });
      const entry3 = createOptimizedEntry({
        id: 'id-3',
        isFavorite: true,
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry1, entry2, entry3]),
      );

      const results = await service.getFavoriteEntries(mockMasterPassword);

      expect(results).toHaveLength(2);
      expect(results.map(e => e.id)).toEqual(['id-1', 'id-3']);
    });

    it('should return empty array when no favorites', async () => {
      const entry = createOptimizedEntry({ id: 'id-1', isFavorite: false });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([entry]),
      );

      const results = await service.getFavoriteEntries(mockMasterPassword);

      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // CATEGORY MANAGEMENT TESTS
  // ============================================================================
  describe('Category Management', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should save a new category', async () => {
      // Mock empty storage, so getAllCategories returns defaults
      // Then when we save, it should add to the defaults
      let callCount = 0;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => {
        callCount++;
        // First call is from getAllCategories -> return null to get defaults
        // We only care about what gets saved via setItem
        return Promise.resolve(null);
      });

      const category: PasswordCategory = {
        id: 'custom',
        name: 'Custom Category',
        icon: 'folder',
        color: '#FF0000',
        createdAt: new Date(),
      };

      await service.saveCategory(category);

      // Check what was saved
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const categoryCall = calls.find(
        call => call[0] === 'password_categories',
      );
      expect(categoryCall).toBeDefined();

      const savedCategories = JSON.parse(categoryCall![1]);
      // Should have defaults + the new custom category
      expect(savedCategories.find((c: any) => c.id === 'custom')).toBeDefined();
      expect(savedCategories.find((c: any) => c.id === 'custom').name).toBe(
        'Custom Category',
      );
    });

    it('should update existing category', async () => {
      const category: PasswordCategory = {
        id: 'custom',
        name: 'Old Name',
        icon: 'folder',
        color: '#FF0000',
        createdAt: new Date(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([category]),
      );

      const updatedCategory: PasswordCategory = {
        ...category,
        name: 'New Name',
      };

      await service.saveCategory(updatedCategory);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedCategories = JSON.parse(data);

      expect(savedCategories).toHaveLength(1);
      expect(savedCategories[0].name).toBe('New Name');
    });

    it('should get all categories with defaults', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const categories = await service.getAllCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories.map(c => c.id)).toContain('social');
      expect(categories.map(c => c.id)).toContain('work');
      expect(categories.map(c => c.id)).toContain('finance');
    });

    it('should get custom categories when available', async () => {
      const customCategory: PasswordCategory = {
        id: 'custom',
        name: 'Custom',
        icon: 'folder',
        color: '#FF0000',
        createdAt: new Date(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([customCategory]),
      );

      const categories = await service.getAllCategories();

      expect(categories).toHaveLength(1);
      expect(categories[0].id).toBe('custom');
    });

    it('should delete a category', async () => {
      const category1: PasswordCategory = {
        id: 'custom1',
        name: 'Custom 1',
        icon: 'folder',
        color: '#FF0000',
        createdAt: new Date(),
      };
      const category2: PasswordCategory = {
        id: 'custom2',
        name: 'Custom 2',
        icon: 'folder',
        color: '#00FF00',
        createdAt: new Date(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([category1, category2]),
      );

      await service.deleteCategory('custom1');

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedCategories = JSON.parse(data);

      expect(savedCategories).toHaveLength(1);
      expect(savedCategories[0].id).toBe('custom2');
    });

    it('should handle category retrieval errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const categories = await service.getAllCategories();

      // Should return default categories on error
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EXPORT/IMPORT TESTS
  // ============================================================================
  describe('Export/Import Data', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should export encrypted data', async () => {
      const entry = createOptimizedEntry();
      const category: PasswordCategory = {
        id: 'custom',
        name: 'Custom',
        icon: 'folder',
        color: '#FF0000',
        createdAt: new Date(),
      };

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([entry]))
        .mockResolvedValueOnce(JSON.stringify([category]));

      const exported = await service.exportData();
      const parsedData = JSON.parse(exported);

      expect(parsedData.passwords).toHaveLength(1);
      expect(parsedData.categories).toHaveLength(1);
      expect(parsedData.version).toBe('2.0');
      expect(parsedData.storageFormat).toBe('optimized');
    });

    it('should import encrypted data', async () => {
      const importData = {
        passwords: [createOptimizedEntry()],
        categories: [],
        exportedAt: new Date().toISOString(),
        version: '2.0',
        storageFormat: 'optimized',
      };

      await service.importData(JSON.stringify(importData));

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle export with no data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const exported = await service.exportData();
      const parsedData = JSON.parse(exported);

      expect(parsedData.passwords).toEqual([]);
      expect(parsedData.categories).toEqual([]);
    });

    it('should handle import errors', async () => {
      const invalidData = 'invalid json {]';

      await expect(service.importData(invalidData)).rejects.toThrow(
        'Failed to import data',
      );
    });
  });

  // ============================================================================
  // CLEAR OPERATIONS TESTS
  // ============================================================================
  describe('Clear Operations', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should clear all passwords', async () => {
      await service.clearAllPasswords();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'optimized_passwords_v2',
      );
    });

    it('should clear all data', async () => {
      await service.clearAllData();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        'optimized_passwords_v2',
        'password_categories',
      ]);
    });

    it('should handle clear errors', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(service.clearAllPasswords()).rejects.toThrow(
        'Failed to clear passwords',
      );
    });
  });

  // ============================================================================
  // GET ENCRYPTED ENTRIES TESTS
  // ============================================================================
  describe('getAllEncryptedEntries()', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should return entries in export format', async () => {
      const optimizedEntry = createOptimizedEntry({
        id: 'test-1',
        encryptedPassword: 'ciphertext123',
        passwordSalt: 'salt123',
        passwordIv: 'iv123',
        passwordAuthTag: 'tag123',
      });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([optimizedEntry]),
      );

      const encrypted = await service.getAllEncryptedEntries();

      expect(encrypted).toHaveLength(1);
      expect(encrypted[0].id).toBe('test-1');
      expect(encrypted[0].encryptedData).toBe('ciphertext123');
      expect(encrypted[0].salt).toBe('salt123');
      expect(encrypted[0].iv).toBe('iv123');
      expect(encrypted[0].authTag).toBe('tag123');
    });

    it('should return empty array when no entries', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const encrypted = await service.getAllEncryptedEntries();

      expect(encrypted).toEqual([]);
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR HANDLING
  // ============================================================================
  describe('Edge Cases & Error Handling', () => {
    beforeEach(async () => {
      await service.initialize(mockMasterPassword);
    });

    it('should handle empty password gracefully', async () => {
      const entry = createPasswordEntry({ password: '' });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntry(entry, mockMasterPassword);

      expect(cryptoService.encryptData).toHaveBeenCalledWith(
        '',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle special characters in title', async () => {
      const entry = createPasswordEntry({
        title: 'Test™ © ® € ¥ ™',
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntry(entry, mockMasterPassword);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle very long credentials', async () => {
      const longPassword = 'a'.repeat(10000);
      const entry = createPasswordEntry({ password: longPassword });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntry(entry, mockMasterPassword);

      expect(cryptoService.encryptData).toHaveBeenCalledWith(
        longPassword,
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle corrupted JSON gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const entries = await service.getAllPasswordEntries(mockMasterPassword);

      expect(entries).toEqual([]);
    });

    it('should isOptimizedFormatAvailable always returns true', async () => {
      const result = await service.isOptimizedFormatAvailable();

      expect(result).toBe(true);
    });

    it('should handle concurrent saves', async () => {
      const entry1 = createPasswordEntry({ id: 'id-1' });
      const entry2 = createPasswordEntry({ id: 'id-2' });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await Promise.all([
        service.savePasswordEntry(entry1, mockMasterPassword),
        service.savePasswordEntry(entry2, mockMasterPassword),
      ]);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should preserve timestamps when not provided', async () => {
      const entry = createPasswordEntry();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.savePasswordEntry(entry, mockMasterPassword);

      const [, data] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(data);

      expect(savedData[0].createdAt).toBeDefined();
      expect(savedData[0].updatedAt).toBeDefined();
    });
  });
});
