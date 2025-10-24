import {
  recalculatePasswordStrengths,
  needsStrengthRecalculation,
} from '../passwordStrengthMigration';
import { PasswordEntry } from '../../types/password';
import * as passwordValidationModule from '../../services/passwordValidationService';

jest.mock('../../services/passwordValidationService');

describe('Password Strength Migration Utility', () => {
  const mockPasswordStrength = {
    score: 4,
    label: 'Very Strong',
    color: '#34C759',
    feedback: ['Excellent password'],
    crackTime: '1000 years',
  };

  const mockWeakPasswordStrength = {
    score: 1,
    label: 'Weak',
    color: '#FF3B30',
    feedback: ['Too short'],
    crackTime: 'Instant',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recalculatePasswordStrengths', () => {
    it('should recalculate strength for passwords with Unknown label', () => {
      (
        passwordValidationModule.PasswordValidationService
          .analyzePasswordStrength as jest.Mock
      ).mockReturnValue(mockPasswordStrength);

      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'MySecurePassword123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 0,
              label: 'Unknown',
              color: '#CCCCCC',
              feedback: [],
              crackTime: 'Unknown',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 50,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0].auditData?.passwordStrength.label).toBe(
        'Very Strong',
      );
      expect(recalculated[0].auditData?.passwordStrength.score).toBe(4);
    });

    it('should recalculate strength for passwords with score 0', () => {
      (
        passwordValidationModule.PasswordValidationService
          .analyzePasswordStrength as jest.Mock
      ).mockReturnValue(mockPasswordStrength);

      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'MySecurePassword123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 0,
              label: 'Very Weak',
              color: '#FF3B30',
              feedback: [],
              crackTime: 'Instant',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'change_password',
            securityScore: 20,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0].auditData?.passwordStrength.score).toBe(4);
    });

    it('should not recalculate already calculated strength', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'MySecurePassword123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 3,
              label: 'Strong',
              color: '#34C759',
              feedback: ['Good password'],
              crackTime: '100 years',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 85,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0].auditData?.passwordStrength.label).toBe('Strong');
      expect(recalculated[0].auditData?.passwordStrength.score).toBe(3);
    });

    it('should not recalculate without auditData', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'MySecurePassword123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0]).toEqual(entries[0]);
    });

    it('should not recalculate without password', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: '',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 0,
              label: 'Unknown',
              color: '#CCCCCC',
              feedback: [],
              crackTime: 'Unknown',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'change_password',
            securityScore: 0,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0].auditData?.passwordStrength.label).toBe('Unknown');
    });

    it('should handle empty password array', () => {
      const entries: PasswordEntry[] = [];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated).toHaveLength(0);
    });

    it('should handle multiple entries with mixed states', () => {
      (
        passwordValidationModule.PasswordValidationService
          .analyzePasswordStrength as jest.Mock
      ).mockReturnValue(mockPasswordStrength);

      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'MySecurePassword123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 0,
              label: 'Unknown',
              color: '#CCCCCC',
              feedback: [],
              crackTime: 'Unknown',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 50,
          },
        },
        {
          id: '2',
          title: 'GitHub',
          username: 'developer',
          password: 'CodePassword456!',
          website: 'github.com',
          category: 'Developer',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 3,
              label: 'Strong',
              color: '#34C759',
              feedback: ['Good password'],
              crackTime: '100 years',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'none',
            securityScore: 85,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated).toHaveLength(2);
      expect(recalculated[0].auditData?.passwordStrength.score).toBe(4);
      expect(recalculated[1].auditData?.passwordStrength.score).toBe(3);
    });

    it('should preserve other audit data during recalculation', () => {
      (
        passwordValidationModule.PasswordValidationService
          .analyzePasswordStrength as jest.Mock
      ).mockReturnValue(mockPasswordStrength);

      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: 'MySecurePassword123!',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 0,
              label: 'Unknown',
              color: '#CCCCCC',
              feedback: [],
              crackTime: 'Unknown',
            },
            duplicateCount: 2,
            compromisedCount: 1,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'enable_2fa',
            securityScore: 50,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0].auditData?.duplicateCount).toBe(2);
      expect(recalculated[0].auditData?.compromisedCount).toBe(1);
      expect(recalculated[0].auditData?.recommendedAction).toBe('enable_2fa');
    });

    it('should handle whitespace-only passwords', () => {
      const entries: PasswordEntry[] = [
        {
          id: '1',
          title: 'Gmail',
          username: 'user@gmail.com',
          password: '   ',
          website: 'gmail.com',
          category: 'Email',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          auditData: {
            passwordStrength: {
              score: 0,
              label: 'Unknown',
              color: '#CCCCCC',
              feedback: [],
              crackTime: 'Unknown',
            },
            duplicateCount: 0,
            compromisedCount: 0,
            lastPasswordChange: new Date('2024-01-01'),
            recommendedAction: 'change_password',
            securityScore: 0,
          },
        },
      ];

      const recalculated = recalculatePasswordStrengths(entries);

      expect(recalculated[0].auditData?.passwordStrength.label).toBe('Unknown');
    });
  });

  describe('needsStrengthRecalculation', () => {
    it('should return true for Unknown strength label', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'MySecurePassword123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        auditData: {
          passwordStrength: {
            score: 0,
            label: 'Unknown',
            color: '#CCCCCC',
            feedback: [],
            crackTime: 'Unknown',
          },
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'none',
          securityScore: 50,
        },
      };

      expect(needsStrengthRecalculation(entry)).toBe(true);
    });

    it('should return true for score 0', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'MySecurePassword123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        auditData: {
          passwordStrength: {
            score: 0,
            label: 'Very Weak',
            color: '#FF3B30',
            feedback: [],
            crackTime: 'Instant',
          },
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'change_password',
          securityScore: 20,
        },
      };

      expect(needsStrengthRecalculation(entry)).toBe(true);
    });

    it('should return false for calculated strength', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'MySecurePassword123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        auditData: {
          passwordStrength: {
            score: 3,
            label: 'Strong',
            color: '#34C759',
            feedback: ['Good password'],
            crackTime: '100 years',
          },
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'none',
          securityScore: 85,
        },
      };

      expect(needsStrengthRecalculation(entry)).toBe(false);
    });

    it('should return false without auditData', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'MySecurePassword123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      expect(needsStrengthRecalculation(entry)).toBe(false);
    });

    it('should return false without password', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: '',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        auditData: {
          passwordStrength: {
            score: 0,
            label: 'Unknown',
            color: '#CCCCCC',
            feedback: [],
            crackTime: 'Unknown',
          },
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'change_password',
          securityScore: 0,
        },
      };

      expect(needsStrengthRecalculation(entry)).toBe(false);
    });

    it('should return false for whitespace-only password', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: '   ',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        auditData: {
          passwordStrength: {
            score: 0,
            label: 'Unknown',
            color: '#CCCCCC',
            feedback: [],
            crackTime: 'Unknown',
          },
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'change_password',
          securityScore: 0,
        },
      };

      expect(needsStrengthRecalculation(entry)).toBe(false);
    });

    it('should return false without passwordStrength', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'MySecurePassword123!',
        website: 'gmail.com',
        category: 'Email',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        auditData: {
          duplicateCount: 0,
          compromisedCount: 0,
          lastPasswordChange: new Date('2024-01-01'),
          recommendedAction: 'none',
          securityScore: 85,
        },
      };

      expect(needsStrengthRecalculation(entry)).toBe(false);
    });
  });
});
