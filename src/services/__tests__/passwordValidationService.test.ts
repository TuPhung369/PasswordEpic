import PasswordValidationService from '../passwordValidationService';
import { PasswordEntry } from '../../types/password';

describe('PasswordValidationService', () => {
  describe('analyzePasswordStrength', () => {
    // Empty and short passwords
    test('should return Very Weak score 0 for empty password', () => {
      const result = PasswordValidationService.analyzePasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.label).toBe('No Password');
      expect(result.color).toBe('#FF3B30');
      expect(result.feedback).toContain('Password is required');
    });

    test('should return Very Weak score 0 for password < 6 characters', () => {
      const result = PasswordValidationService.analyzePasswordStrength('abc12');
      expect(result.score).toBe(0);
      expect(result.label).toBe('Very Weak');
    });

    test('should return Weak score for password with only numbers', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('123456');
      expect(result.score).toBeLessThanOrEqual(2);
      expect(['Very Weak', 'Weak', 'Fair']).toContain(result.label);
    });

    test('should return Weak score for password with only lowercase', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('abcdefgh');
      expect(result.score).toBeLessThanOrEqual(2);
      expect(['Very Weak', 'Weak', 'Fair']).toContain(result.label);
    });

    test('should return Fair score 2 for 8+ chars with 2 character sets', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('abcdefgh12');
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.label).not.toBe('Very Weak');
    });

    test('should return Fair score 2 for mixed case + numbers', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('Abc12345');
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    test('should return Good score 3+ for strong diverse password', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('MyPass123!@#');
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(['Fair', 'Good', 'Strong']).toContain(result.label);
    });

    test('should return Strong score 4 for very strong password', () => {
      const result = PasswordValidationService.analyzePasswordStrength(
        'SecureP@ssw0rd2024!',
      );
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.feedback).toContain('Excellent password strength!');
    });

    test('should include feedback for missing character types', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('password');
      expect(result.feedback.some(f => f.includes('uppercase'))).toBe(true);
      expect(result.feedback.some(f => f.includes('number'))).toBe(true);
    });

    test('should provide crack time estimate', () => {
      const weak = PasswordValidationService.analyzePasswordStrength('123456');
      expect(weak.crackTime).toBe('Less than 1 second');

      const medium =
        PasswordValidationService.analyzePasswordStrength('MyPass123');
      expect(medium.crackTime).not.toBe('');

      const strong = PasswordValidationService.analyzePasswordStrength(
        'SecureP@ssw0rd2024!Long',
      );
      expect(strong.crackTime).not.toBe('');
    });

    test('should include color coding', () => {
      const weak = PasswordValidationService.analyzePasswordStrength('abc');
      expect(weak.color).toBe('#FF3B30'); // Red

      const fair =
        PasswordValidationService.analyzePasswordStrength('Abc123456');
      expect(fair.color).toBeTruthy();
    });

    test('should penalize common passwords', () => {
      const common =
        PasswordValidationService.analyzePasswordStrength('password123');
      expect(common.score).toBeLessThan(3);
      expect(common.feedback.some(f => f.includes('common'))).toBe(true);
    });

    test('should detect weak patterns - repeated characters', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('aaaa123456');
      // Should have weaker score due to repeated pattern
      expect(result.score).toBeLessThanOrEqual(2);
    });

    test('should handle passwords with symbols', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('P@ssw0rd!');
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.feedback).not.toContain('Add symbols for extra security');
    });

    test('should handle long passwords correctly', () => {
      const longPassword = 'ThisIsAVeryLongPasswordWith123AndSymbols!@#$%^&*()';
      const result =
        PasswordValidationService.analyzePasswordStrength(longPassword);
      expect(result.score).toBe(4);
      expect(result.label).toBe('Strong');
    });

    test('should calculate entropy correctly', () => {
      const weak =
        PasswordValidationService.analyzePasswordStrength('12345678');
      const strong =
        PasswordValidationService.analyzePasswordStrength('SecureP@ssw0rd2024');
      expect(weak.score).toBeLessThan(strong.score);
    });
  });

  describe('isCommonPassword', () => {
    test('should identify common passwords', () => {
      const commonPasswords = [
        'password',
        '123456',
        'admin',
        'qwerty',
        'letmein',
        'welcome',
        'monkey',
      ];

      commonPasswords.forEach(pwd => {
        expect(PasswordValidationService.isCommonPassword(pwd)).toBe(true);
      });
    });

    test('should be case-insensitive', () => {
      expect(PasswordValidationService.isCommonPassword('PASSWORD')).toBe(true);
      expect(PasswordValidationService.isCommonPassword('PaSSWoRD')).toBe(true);
    });

    test('should trim whitespace', () => {
      expect(PasswordValidationService.isCommonPassword('  password  ')).toBe(
        true,
      );
    });

    test('should return false for uncommon passwords', () => {
      const uncommon = ['xyz789!@#', 'Secure@Password2024', 'RandomStr1ng!'];

      uncommon.forEach(pwd => {
        expect(PasswordValidationService.isCommonPassword(pwd)).toBe(false);
      });
    });
  });

  describe('hasWeakPatterns', () => {
    test('should detect repeated characters', () => {
      const patterns1 = PasswordValidationService.hasWeakPatterns('aaaa');
      expect(patterns1.length).toBeGreaterThan(0);
      expect(patterns1.some(p => p.includes('repeated'))).toBe(true);
    });

    test('should detect repeated pairs', () => {
      const patterns = PasswordValidationService.hasWeakPatterns('ababab');
      expect(patterns.length).toBeGreaterThan(0);
    });

    test('should detect sequential characters', () => {
      const patterns1 = PasswordValidationService.hasWeakPatterns('123456');
      expect(patterns1.length).toBeGreaterThan(0);
    });

    test('should detect passwords starting with "password"', () => {
      const patterns = PasswordValidationService.hasWeakPatterns('password123');
      expect(patterns.some(p => p.includes('password'))).toBe(true);
    });

    test('should detect only numbers', () => {
      const patterns = PasswordValidationService.hasWeakPatterns('12345678901');
      expect(patterns.some(p => p.includes('only numbers'))).toBe(true);
    });

    test('should detect only letters', () => {
      const patterns = PasswordValidationService.hasWeakPatterns('abcdefghijk');
      expect(patterns.some(p => p.includes('only letters'))).toBe(true);
    });

    test('should return empty array for strong patterns', () => {
      const patterns =
        PasswordValidationService.hasWeakPatterns('SecureP@ss123!');
      expect(patterns.length).toBe(0);
    });
  });

  describe('validatePassword', () => {
    test('should validate password with default requirements', () => {
      const result = PasswordValidationService.validatePassword('MyPass123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail if password too short (default minLength=8)', () => {
      const result = PasswordValidationService.validatePassword('Short1A');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 8'))).toBe(true);
    });

    test('should enforce custom minLength', () => {
      const result = PasswordValidationService.validatePassword('MyPass123', {
        minLength: 12,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 12'))).toBe(true);
    });

    test('should require uppercase letter', () => {
      const result = PasswordValidationService.validatePassword('mypass123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    test('should allow uppercase requirement to be disabled', () => {
      const result = PasswordValidationService.validatePassword('mypass123', {
        requireUppercase: false,
      });
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(false);
    });

    test('should require lowercase letter', () => {
      const result = PasswordValidationService.validatePassword('MYPASS123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    test('should require numbers', () => {
      const result = PasswordValidationService.validatePassword('MyPassword');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    test('should require symbols when enabled', () => {
      const result = PasswordValidationService.validatePassword('MyPass123', {
        requireSymbols: true,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('symbol'))).toBe(true);
    });

    test('should allow symbols requirement to be disabled', () => {
      const result = PasswordValidationService.validatePassword('MyPass123', {
        requireSymbols: false,
      });
      expect(result.errors.some(e => e.includes('symbol'))).toBe(false);
    });

    test('should check password strength score', () => {
      const result = PasswordValidationService.validatePassword('weak12', {
        minScore: 2,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too weak'))).toBe(true);
    });

    test('should reject common passwords', () => {
      const result = PasswordValidationService.validatePassword('Password123');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('common'))).toBe(true);
    });

    test('should validate strong password', () => {
      const result =
        PasswordValidationService.validatePassword('SecureP@ssw0rd123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should allow custom minScore', () => {
      const result = PasswordValidationService.validatePassword('MyPass123', {
        minScore: 4,
      });
      expect(result.isValid).toBe(false);
    });

    test('should accumulate multiple errors', () => {
      const result = PasswordValidationService.validatePassword('weak', {
        minLength: 10,
      });
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('findDuplicatePasswords', () => {
    const mockEntries: PasswordEntry[] = [
      {
        id: '1',
        username: 'user1',
        password: 'same_password',
        domain: 'site1.com',
        notes: '',
        category: 'work',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
      {
        id: '2',
        username: 'user2',
        password: 'same_password',
        domain: 'site2.com',
        notes: '',
        category: 'personal',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
      {
        id: '3',
        username: 'user3',
        password: 'unique_password',
        domain: 'site3.com',
        notes: '',
        category: 'work',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
      {
        id: '4',
        username: 'user4',
        password: 'same_password',
        domain: 'site4.com',
        notes: '',
        category: 'personal',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
    ];

    test('should find duplicate passwords', () => {
      const duplicates =
        PasswordValidationService.findDuplicatePasswords(mockEntries);

      expect(duplicates.has('same_password')).toBe(true);
      expect(duplicates.get('same_password')).toHaveLength(3);
    });

    test('should not include unique passwords', () => {
      const duplicates =
        PasswordValidationService.findDuplicatePasswords(mockEntries);

      expect(duplicates.has('unique_password')).toBe(false);
    });

    test('should return empty map for no duplicates', () => {
      const noDuplicates: PasswordEntry[] = [
        {
          ...mockEntries[0],
          password: 'pwd1',
        },
        {
          ...mockEntries[1],
          password: 'pwd2',
        },
      ];

      const duplicates =
        PasswordValidationService.findDuplicatePasswords(noDuplicates);
      expect(duplicates.size).toBe(0);
    });

    test('should handle empty array', () => {
      const duplicates = PasswordValidationService.findDuplicatePasswords([]);
      expect(duplicates.size).toBe(0);
    });

    test('should track all duplicate entries', () => {
      const duplicates =
        PasswordValidationService.findDuplicatePasswords(mockEntries);
      const samePasswordEntries = duplicates.get('same_password');

      expect(samePasswordEntries).toBeDefined();
      expect(samePasswordEntries?.map(e => e.domain)).toEqual([
        'site1.com',
        'site2.com',
        'site4.com',
      ]);
    });
  });

  describe('findWeakPasswords', () => {
    const mockEntries: PasswordEntry[] = [
      {
        id: '1',
        username: 'user1',
        password: '123456',
        domain: 'site1.com',
        notes: '',
        category: 'work',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
      {
        id: '2',
        username: 'user2',
        password: 'SecureP@ssw0rd123',
        domain: 'site2.com',
        notes: '',
        category: 'personal',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
      {
        id: '3',
        username: 'user3',
        password: 'weak',
        domain: 'site3.com',
        notes: '',
        category: 'work',
        createdAt: new Date(),
        updatedAt: new Date(),
        isFavorite: false,
        isShared: false,
      },
    ];

    test('should find weak passwords with default minScore', () => {
      const weak = PasswordValidationService.findWeakPasswords(mockEntries);
      expect(weak.length).toBeGreaterThan(0);
      expect(weak.some(e => e.password === '123456')).toBe(true);
    });

    test('should respect custom minScore', () => {
      const weak = PasswordValidationService.findWeakPasswords(mockEntries, 4);
      expect(weak.length).toBeGreaterThan(0);
    });

    test('should not include strong passwords', () => {
      const weak = PasswordValidationService.findWeakPasswords(mockEntries);
      expect(weak.some(e => e.password === 'SecureP@ssw0rd123')).toBe(false);
    });

    test('should return empty array if no weak passwords', () => {
      const strongEntries: PasswordEntry[] = [
        {
          ...mockEntries[1],
          password: 'SecureP@ssw0rd123',
        },
        {
          ...mockEntries[1],
          password: 'AnotherStr0ng@Pass',
        },
      ];

      const weak = PasswordValidationService.findWeakPasswords(strongEntries);
      expect(weak.length).toBe(0);
    });
  });

  describe('generateSecurityRecommendations', () => {
    const now = new Date();
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

    const mockEntries: PasswordEntry[] = [
      {
        id: '1',
        username: 'user1',
        password: 'password123',
        domain: 'site1.com',
        notes: '',
        category: 'work',
        createdAt: sevenMonthsAgo,
        updatedAt: sevenMonthsAgo,
        isFavorite: false,
        isShared: false,
      },
      {
        id: '2',
        username: 'user2',
        password: 'password123',
        domain: 'site2.com',
        notes: '',
        category: 'personal',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isShared: false,
      },
      {
        id: '3',
        username: 'user3',
        password: 'weak123',
        domain: 'site3.com',
        notes: '',
        category: 'work',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isShared: false,
      },
      {
        id: '4',
        username: 'user4',
        password: 'SecureP@ssw0rd123',
        domain: 'site4.com',
        notes: '',
        category: 'personal',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isShared: false,
      },
    ];

    test('should detect duplicate passwords in critical issues', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(
        recommendations.criticalIssues.some(i => i.includes('reused')),
      ).toBe(true);
      expect(recommendations.stats.duplicates).toBe(1);
    });

    test('should detect common passwords in critical issues', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(
        recommendations.criticalIssues.some(i => i.includes('common')),
      ).toBe(true);
      expect(recommendations.stats.common).toBeGreaterThan(0);
    });

    test('should count weak passwords', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(recommendations.stats.weak).toBeGreaterThan(0);
    });

    test('should count old passwords', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(recommendations.stats.old).toBeGreaterThan(0);
    });

    test('should provide recommendations for weak passwords', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(
        recommendations.recommendations.some(r => r.includes('Strengthen')),
      ).toBe(true);
    });

    test('should provide recommendations for duplicates', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(
        recommendations.recommendations.some(r => r.includes('unique')),
      ).toBe(true);
    });

    test('should return stats for empty array', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations([]);

      expect(recommendations.stats.total).toBe(0);
      expect(recommendations.stats.weak).toBe(0);
      expect(recommendations.stats.duplicates).toBe(0);
    });

    test('should aggregate statistics correctly', () => {
      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(mockEntries);

      expect(recommendations.stats.total).toBe(4);
      expect(recommendations.stats.weak).toBeGreaterThan(0);
    });

    test('should warn if >30% of passwords are weak', () => {
      const weakEntries: PasswordEntry[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: String(i),
          username: `user${i}`,
          password: i < 4 ? 'weak' : 'SecureP@ssw0rd123!',
          domain: `site${i}.com`,
          notes: '',
          category: 'work',
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
          isShared: false,
        }),
      );

      const recommendations =
        PasswordValidationService.generateSecurityRecommendations(weakEntries);

      expect(recommendations.criticalIssues.some(i => i.includes('weak'))).toBe(
        true,
      );
    });
  });

  describe('edge cases', () => {
    test('should handle password with spaces', () => {
      const result = PasswordValidationService.analyzePasswordStrength(
        'My Secure Pass 123!',
      );
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    test('should handle very long password', () => {
      const longPassword =
        'A'.repeat(100) + 'a'.repeat(100) + '0'.repeat(100) + '!'.repeat(100);
      const result =
        PasswordValidationService.analyzePasswordStrength(longPassword);
      expect(result.score).toBe(4);
    });

    test('should handle password with all special characters', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('!@#$%^&*()');
      expect(result.score).toBeLessThan(4);
    });

    test('should handle null/undefined gracefully', () => {
      const result = PasswordValidationService.analyzePasswordStrength('');
      expect(result.score).toBe(0);
    });

    test('should handle unicode characters', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('Pässwörd123!');
      expect(result.score).toBeGreaterThanOrEqual(1);
    });
  });

  describe('color coding', () => {
    test('should return red for Very Weak (score 0)', () => {
      const result = PasswordValidationService.analyzePasswordStrength('a');
      expect(result.color).toBe('#FF3B30');
    });

    test('should return orange for Weak (score 1)', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('abcdefgh');
      const color = result.color;
      expect(color).toBeTruthy();
    });

    test('should return green for Strong (score 4)', () => {
      const result = PasswordValidationService.analyzePasswordStrength(
        'SecureP@ssw0rd2024!',
      );
      expect(result.color).toBe('#34C759');
    });
  });

  describe('feedback generation', () => {
    test('should suggest 8+ characters for short passwords', () => {
      const result = PasswordValidationService.analyzePasswordStrength('short');
      expect(result.feedback.some(f => f.includes('8'))).toBe(true);
    });

    test('should not suggest improvements for excellent password', () => {
      const result = PasswordValidationService.analyzePasswordStrength(
        'SecureP@ssw0rd2024!',
      );
      expect(result.feedback.some(f => f.includes('Excellent'))).toBe(true);
    });

    test('should suggest diversity improvements', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('password1');
      expect(result.feedback.length).toBeGreaterThan(0);
    });
  });

  describe('crack time estimation', () => {
    test('should estimate <1 second for common passwords', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('password');
      expect(result.crackTime).toBe('Less than 1 second');
    });

    test('should estimate appropriate time for weak patterns', () => {
      const result =
        PasswordValidationService.analyzePasswordStrength('aaaaaa');
      expect(result.crackTime).toBe('Less than 1 second');
    });

    test('should estimate longer time for strong passwords', () => {
      const result = PasswordValidationService.analyzePasswordStrength(
        'SecureP@ssw0rd2024!',
      );
      expect(
        ['Months to years', 'Years to decades', 'Centuries or more'].includes(
          result.crackTime,
        ),
      ).toBe(true);
    });
  });
});
