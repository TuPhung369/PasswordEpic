import {
  migratePasswordEntry,
  migratePasswordEntries,
  needsMigration,
  getMigrationStats,
} from '../passwordMigration';
import { PasswordEntry } from '../../types/password';
import * as passwordValidationModule from '../../services/passwordValidationService';

jest.mock('../../services/passwordValidationService');

describe('Password Migration Utility', () => {
  const mockPasswordStrength = {
    score: 3,
    label: 'Strong',
    color: '#34C759',
    feedback: ['Good password'],
    crackTime: '100 years',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (
      passwordValidationModule.PasswordValidationService
        .analyzePasswordStrength as jest.Mock
    ).mockReturnValue(mockPasswordStrength);
  });

  describe('migratePasswordEntry', () => {
    it('should migrate password entry without passwordHistory', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.passwordHistory).toBeDefined();
      expect(Array.isArray(migrated.passwordHistory)).toBe(true);
      expect(migrated.auditData).toBeDefined();
      expect(migrated.breachStatus).toBeDefined();
    });

    it('should preserve existing data during migration', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.id).toBe(entry.id);
      expect(migrated.title).toBe(entry.title);
      expect(migrated.username).toBe(entry.username);
      expect(migrated.password).toBe(entry.password);
    });

    it('should not remigrate already migrated entry', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        passwordHistory: [],
        auditData: {
          passwordStrength: mockPasswordStrength,
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'none',
          securityScore: 85,
        },
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated).toEqual(entry);
    });

    it('should set default breach status', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.breachStatus?.isBreached).toBe(false);
      expect(migrated.breachStatus?.breachCount).toBe(0);
      expect(migrated.breachStatus?.severity).toBe('low');
    });

    it('should calculate security score based on entry data', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        notes: 'My primary email',
        tags: ['important'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.auditData?.securityScore).toBeGreaterThan(0);
      expect(migrated.auditData?.securityScore).toBeLessThanOrEqual(100);
    });

    it('should handle entry without password', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: '',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.auditData?.passwordStrength.score).toBe(0);
    });

    it('should set recommended action based on security score', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user',
        password: '123', // Weak password
        website: '',
        category: '',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      (
        passwordValidationModule.PasswordValidationService
          .analyzePasswordStrength as jest.Mock
      ).mockReturnValue({
        score: 1,
        label: 'Weak',
        color: '#FF3B30',
        feedback: ['Too weak'],
        crackTime: 'Instant',
      });

      const migrated = migratePasswordEntry(entry);

      expect([
        'change_password',
        'enable_2fa',
        'update_info',
        'none',
      ]).toContain(migrated.auditData?.recommendedAction);
    });
  });

  describe('migratePasswordEntries', () => {
    it('should migrate multiple entries', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user1@gmail.com',
          password: 'SecurePass123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'GitHub',
          username: 'developer',
          password: 'CodePass456!',
          website: 'github.com',
          category: 'Developer',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const migrated = migratePasswordEntries(entries);

      expect(migrated).toHaveLength(2);
      expect(migrated[0].auditData).toBeDefined();
      expect(migrated[1].auditData).toBeDefined();
    });

    it('should handle empty array', () => {
      const entries: PasswordEntry[] = [];

      const migrated = migratePasswordEntries(entries);

      expect(migrated).toHaveLength(0);
    });

    it('should handle mixed migrated and non-migrated entries', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'SecurePass123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'GitHub',
          username: 'developer',
          password: 'CodePass456!',
          website: 'github.com',
          category: 'Developer',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          passwordHistory: [],
          auditData: {
            passwordStrength: mockPasswordStrength,
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 85,
          },
        },
      ];

      const migrated = migratePasswordEntries(entries);

      expect(migrated).toHaveLength(2);
      expect(migrated[0].auditData).toBeDefined();
      expect(migrated[1].auditData).toBeDefined();
    });
  });

  describe('needsMigration', () => {
    it('should return true for entry without passwordHistory', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      expect(needsMigration(entry)).toBe(true);
    });

    it('should return true for entry without auditData', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        passwordHistory: [],
      };

      expect(needsMigration(entry)).toBe(true);
    });

    it('should return false for fully migrated entry', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        passwordHistory: [],
        auditData: {
          passwordStrength: mockPasswordStrength,
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'none',
          securityScore: 85,
        },
      };

      expect(needsMigration(entry)).toBe(false);
    });
  });

  describe('getMigrationStats', () => {
    it('should calculate correct migration statistics', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'SecurePass123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'GitHub',
          username: 'developer',
          password: 'CodePass456!',
          website: 'github.com',
          category: 'Developer',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          passwordHistory: [],
          auditData: {
            passwordStrength: mockPasswordStrength,
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 85,
          },
        },
      ];

      const stats = getMigrationStats(entries);

      expect(stats.total).toBe(2);
      expect(stats.needsMigration).toBe(1);
      expect(stats.alreadyMigrated).toBe(1);
      expect(stats.migrationProgress).toBe(50);
    });

    it('should return 100% progress when all migrated', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'SecurePass123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          passwordHistory: [],
          auditData: {
            passwordStrength: mockPasswordStrength,
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 85,
          },
        },
      ];

      const stats = getMigrationStats(entries);

      expect(stats.migrationProgress).toBe(100);
    });

    it('should return 100% progress for empty array', () => {
      const stats = getMigrationStats([]);

      expect(stats.total).toBe(0);
      expect(stats.needsMigration).toBe(0);
      expect(stats.alreadyMigrated).toBe(0);
      expect(stats.migrationProgress).toBe(100);
    });

    it('should return 0% progress when none migrated', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'SecurePass123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'GitHub',
          username: 'developer',
          password: 'CodePass456!',
          website: 'github.com',
          category: 'Developer',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const stats = getMigrationStats(entries);

      expect(stats.migrationProgress).toBe(0);
    });
  });

  describe('Security Score Calculation', () => {
    it('should award points for recent updates', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago

      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: recentDate,
        updatedAt: recentDate,
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.auditData?.securityScore).toBeGreaterThan(50);
    });

    it('should deduct points for old passwords', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000); // 400 days ago

      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: oldDate,
        updatedAt: oldDate,
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.auditData?.securityScore).toBeLessThan(80);
    });

    it('should award points for complete data', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'SecurePass123!',
        website: 'gmail.com',
        category: 'Email',
        notes: 'Primary email account',
        tags: ['important', 'personal'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const migrated = migratePasswordEntry(entry);

      expect(migrated.auditData?.securityScore).toBeGreaterThan(60);
    });
  });
});
