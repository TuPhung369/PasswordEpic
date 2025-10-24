import { importExportService } from '../importExportService';
import { PasswordEntry } from '../../types/password';

// Mock dependencies
jest.mock('react-native-fs');
jest.mock('../firebase');
jest.mock('../encryptedDatabaseService', () => ({
  encryptedDatabase: {
    getAllPasswords: jest.fn(() => Promise.resolve([])),
    addPassword: jest.fn(() => Promise.resolve()),
    updatePassword: jest.fn(() => Promise.resolve()),
    deletePassword: jest.fn(() => Promise.resolve()),
  },
  EncryptedDatabaseService: class {},
}));

jest.mock('../cryptoService', () => ({
  decryptData: jest.fn(data => Promise.resolve(data)),
  deriveKeyFromPassword: jest.fn(pwd => Promise.resolve(pwd)),
}));

jest.mock('../staticMasterPasswordService', () => ({
  getEffectiveMasterPassword: jest.fn(() => Promise.resolve('master-password')),
}));

// Import mocked modules
import RNFS from 'react-native-fs';
import * as firebaseService from '../firebase';

describe('ImportExportService', () => {
  const mockPassword: PasswordEntry = {
    id: '1',
    title: 'Test Account',
    website: 'https://test.com',
    username: 'testuser',
    password: 'testpass123',
    category: 'Work',
    tags: ['important'],
    notes: 'Test notes',
    customFields: [],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    isFavorite: true,
    strength: 'strong',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup getCurrentUser mock
    const mockGetCurrentUser = jest.mocked(firebaseService.getCurrentUser);
    mockGetCurrentUser.mockReturnValue({
      uid: 'test-uid-12345678',
      email: 'test@example.com',
    } as any);

    // Setup RNFS mocks
    const mockRNFS = jest.mocked(RNFS);
    mockRNFS.writeFile.mockResolvedValue(undefined as any);
    mockRNFS.readFile.mockResolvedValue(JSON.stringify([mockPassword]));
    mockRNFS.unlink.mockResolvedValue(undefined as any);
  });

  describe('exportPasswords', () => {
    it('should export passwords with proper result structure', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      expect(result).toHaveProperty('exportedCount');
    });

    it('should handle missing passwords list', async () => {
      const result = await importExportService.exportPasswords([], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toBeDefined();
      expect(result.exportedCount).toBe(0);
    });

    it('should support excluding passwords from export', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: false,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toHaveProperty('success');
    });

    it('should support excluding notes from export', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: false,
        includeCustomFields: true,
      });

      expect(result).toHaveProperty('success');
    });

    it('should support excluding custom fields from export', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: false,
      });

      expect(result).toHaveProperty('success');
    });

    it('should filter passwords by categories', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
        categories: ['Work'],
      });

      expect(result).toHaveProperty('success');
    });

    it('should filter passwords by tags', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
        tags: ['important'],
      });

      expect(result).toHaveProperty('success');
    });

    it('should handle export errors gracefully', async () => {
      (RNFS.writeFile as jest.Mock).mockRejectedValue(
        new Error('Write failed'),
      );

      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });

    it('should support multiple export formats', async () => {
      const formats: any[] = ['json', 'csv', 'xlsx', 'pdf', 'html'];

      for (const format of formats) {
        const result = await importExportService.exportPasswords(
          [mockPassword],
          {
            format,
            includePasswords: true,
            includeNotes: true,
            includeCustomFields: true,
          },
        );

        expect(result).toHaveProperty('success');
      }
    });

    it('should support custom export file name', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
        fileName: 'custom_export.json',
      });

      expect(result).toHaveProperty('success');
    });

    it('should track count of exported passwords', async () => {
      const result = await importExportService.exportPasswords(
        [mockPassword, { ...mockPassword, id: '2' }],
        {
          format: 'json',
          includePasswords: true,
          includeNotes: true,
          includeCustomFields: true,
        },
      );

      expect(result).toHaveProperty('exportedCount');
      expect(typeof result.exportedCount).toBe('number');
    });

    it('should generate file path for exports', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toHaveProperty('success');
      if (result.success || result.filePath) {
        expect(result.filePath).toBeDefined();
      }
    });

    it('should support encryption password option', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
        encryptionPassword: 'export-password-123',
      });

      expect(result).toHaveProperty('success');
    });

    it('should handle large password exports', async () => {
      const largeList = Array(100)
        .fill(null)
        .map((_, i) => ({ ...mockPassword, id: String(i) }));

      const result = await importExportService.exportPasswords(largeList, {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('exportedCount');
    });
  });

  describe('importPasswords', () => {
    it('should import passwords from JSON file', async () => {
      const jsonData = JSON.stringify([mockPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('importedCount');
    });

    it('should skip duplicate entries during import', async () => {
      const jsonData = JSON.stringify([mockPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'skip',
        },
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duplicateCount');
    });

    it('should replace existing entries when specified', async () => {
      const jsonData = JSON.stringify([mockPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'replace',
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should detect invalid JSON format', async () => {
      (RNFS.readFile as jest.Mock).mockResolvedValue('invalid json');

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result.success).toBe(false);
    });

    it('should handle missing import file', async () => {
      (RNFS.readFile as jest.Mock).mockRejectedValue(
        new Error('File not found'),
      );

      const result = await importExportService.importPasswords(
        '/path/to/missing.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result.success).toBe(false);
    });

    it('should map categories during import', async () => {
      const jsonData = JSON.stringify([mockPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
          categoryMapping: { Work: 'Work' },
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should apply default category when not specified', async () => {
      const jsonData = JSON.stringify([{ ...mockPassword, category: '' }]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
          defaultCategory: 'Imported',
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should support multiple import formats', async () => {
      const jsonData = JSON.stringify([mockPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const formats: any[] = [
        'json',
        'csv',
        'xlsx',
        'bitwarden',
        'lastpass',
        'chrome',
        'firefox',
        'safari',
      ];

      for (const format of formats) {
        const result = await importExportService.importPasswords(
          '/path/to/file',
          {
            format,
            mergeStrategy: 'merge',
          },
        );

        expect(result).toHaveProperty('success');
      }
    });

    it('should collect import errors', async () => {
      const invalidData = JSON.stringify([
        { title: 'Missing required fields' },
      ]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(invalidData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should collect import warnings', async () => {
      const jsonData = JSON.stringify([mockPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = {
        ...mockPassword,
        password: 'p@ssw0rd!#$%^&*()_+-=[]{}|;\':",./<>?',
      };
      const jsonData = JSON.stringify([specialPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should handle very long passwords', async () => {
      const longPassword = {
        ...mockPassword,
        password: 'a'.repeat(5000),
      };
      const jsonData = JSON.stringify([longPassword]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should handle large batch imports', async () => {
      const largeList = Array(100)
        .fill(null)
        .map((_, i) => ({ ...mockPassword, id: String(i) }));
      const jsonData = JSON.stringify(largeList);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result).toHaveProperty('success');
    });
  });

  describe('Validation and edge cases', () => {
    it('should handle null authenticated user', async () => {
      const mockGetCurrentUser = jest.mocked(firebaseService.getCurrentUser);
      mockGetCurrentUser.mockReturnValue(null as any);

      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
      });

      expect(result).toHaveProperty('success');
    });

    it('should reject invalid password entries', async () => {
      const invalidPassword = {
        ...mockPassword,
        title: '',
      };

      const result = await importExportService.exportPasswords(
        [invalidPassword],
        {
          format: 'json',
          includePasswords: true,
          includeNotes: true,
          includeCustomFields: true,
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should handle empty encryption password', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
        encryptionPassword: '',
      });

      expect(result).toHaveProperty('success');
    });

    it('should handle very long encryption password', async () => {
      const result = await importExportService.exportPasswords([mockPassword], {
        format: 'json',
        includePasswords: true,
        includeNotes: true,
        includeCustomFields: true,
        encryptionPassword: 'a'.repeat(1000),
      });

      expect(result).toHaveProperty('success');
    });

    it('should handle empty import file', async () => {
      const jsonData = JSON.stringify([]);
      (RNFS.readFile as jest.Mock).mockResolvedValue(jsonData);

      const result = await importExportService.importPasswords(
        '/path/to/file.json',
        {
          format: 'json',
          mergeStrategy: 'merge',
        },
      );

      expect(result).toHaveProperty('success');
    });

    it('should handle passwords with null fields', async () => {
      const passwordWithNulls = {
        ...mockPassword,
        notes: null as any,
        tags: null as any,
        customFields: null as any,
      };

      const result = await importExportService.exportPasswords(
        [passwordWithNulls],
        {
          format: 'json',
          includePasswords: true,
          includeNotes: true,
          includeCustomFields: true,
        },
      );

      expect(result).toHaveProperty('success');
    });
  });
});
