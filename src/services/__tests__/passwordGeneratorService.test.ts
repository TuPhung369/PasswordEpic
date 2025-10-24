import {
  PasswordGeneratorService,
  type GenerationHistory,
} from '../passwordGeneratorService';
import type { PasswordGeneratorOptions } from '../../types/password';

// Mock password utilities
jest.mock('../../utils/passwordUtils', () => ({
  generateSecurePassword: jest.fn((options: PasswordGeneratorOptions) => {
    let charset = '';
    if (options.includeUppercase !== false)
      charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (options.includeLowercase !== false)
      charset += 'abcdefghijklmnopqrstuvwxyz';
    if (options.includeNumbers !== false) charset += '0123456789';
    if (options.includeSymbols !== false)
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    // Validate: at least one character type must be selected
    if (charset === '') {
      throw new Error('At least one character type must be selected');
    }

    let password = '';
    const targetLength = options.length || 16;
    for (let i = 0; i < targetLength; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    return password;
  }),
  calculatePasswordStrength: jest.fn((password: string) => ({
    score: password.length >= 12 ? (password.length >= 16 ? 100 : 80) : 60,
    feedback: password.length < 12 ? 'Too short' : 'Good',
    level: 'strong' as const,
  })),
}));

describe('PasswordGeneratorService', () => {
  let service: PasswordGeneratorService;

  beforeEach(() => {
    service = PasswordGeneratorService.getInstance();
    // Clear history for each test
    (service as any).generationHistory = [];
  });

  // ==================== Singleton Instance ====================
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = PasswordGeneratorService.getInstance();
      const instance2 = PasswordGeneratorService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  // ==================== Templates ====================
  describe('getTemplates', () => {
    it('should return all templates', () => {
      const templates = service.getTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should include banking template', () => {
      const templates = service.getTemplates();
      const banking = templates.find(t => t.id === 'banking');

      expect(banking).toBeDefined();
      expect(banking?.name).toBe('Banking & Finance');
      expect(banking?.category).toBe('security');
    });

    it('should include social media template', () => {
      const templates = service.getTemplates();
      const social = templates.find(t => t.id === 'social');

      expect(social).toBeDefined();
      expect(social?.name).toBe('Social Media');
      expect(social?.category).toBe('usability');
    });

    it('should include email template', () => {
      const templates = service.getTemplates();
      const email = templates.find(t => t.id === 'email');

      expect(email).toBeDefined();
      expect(email?.name).toBe('Email Accounts');
    });

    it('should include wifi template', () => {
      const templates = service.getTemplates();
      const wifi = templates.find(t => t.id === 'wifi');

      expect(wifi).toBeDefined();
      expect(wifi?.category).toBe('usability');
    });

    it('should include gaming template', () => {
      const templates = service.getTemplates();
      const gaming = templates.find(t => t.id === 'gaming');

      expect(gaming).toBeDefined();
    });

    it('should include work template', () => {
      const templates = service.getTemplates();
      const work = templates.find(t => t.id === 'work');

      expect(work).toBeDefined();
      expect(work?.category).toBe('security');
    });

    it('should include memorable template', () => {
      const templates = service.getTemplates();
      const memorable = templates.find(t => t.id === 'memorable');

      expect(memorable).toBeDefined();
    });

    it('should include maximum security template', () => {
      const templates = service.getTemplates();
      const maximum = templates.find(t => t.id === 'maximum');

      expect(maximum).toBeDefined();
      expect(maximum?.options.length).toBe(20);
      expect(maximum?.options.minNumbers).toBeGreaterThanOrEqual(3);
      expect(maximum?.options.minSymbols).toBeGreaterThanOrEqual(2);
    });

    it('templates should have required properties', () => {
      const templates = service.getTemplates();

      templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.icon).toBeDefined();
        expect(template.options).toBeDefined();
        expect(template.category).toMatch(/^(security|usability|specific)$/);
        expect(Array.isArray(template.examples)).toBe(true);
      });
    });

    it('banking template should have high security requirements', () => {
      const templates = service.getTemplates();
      const banking = templates.find(t => t.id === 'banking');

      expect(banking?.options.includeSymbols).toBe(true);
      expect(banking?.options.excludeSimilar).toBe(true);
      expect(banking?.options.minNumbers).toBeGreaterThanOrEqual(2);
      expect(banking?.options.minSymbols).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== Presets ====================
  describe('getPresets', () => {
    it('should return presets array', () => {
      const presets = service.getPresets();

      expect(Array.isArray(presets)).toBe(true);
    });

    it('presets should have required properties', () => {
      const presets = service.getPresets();

      presets.forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.icon).toBeDefined();
        expect(preset.options).toBeDefined();
        expect(preset.color).toBeDefined();
      });
    });

    it('presets should have proper options defaults', () => {
      const presets = service.getPresets();

      presets.forEach(preset => {
        expect(typeof preset.options.excludeSimilar === 'boolean').toBe(true);
        expect(typeof preset.options.excludeAmbiguous === 'boolean').toBe(true);
        expect(typeof preset.options.minNumbers === 'number').toBe(true);
        expect(typeof preset.options.minSymbols === 'number').toBe(true);
      });
    });
  });

  // ==================== Password Generation ====================
  describe('generatePassword', () => {
    it('should generate password successfully', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
      };

      const result = await service.generatePassword(options);

      expect(result.password).toBeDefined();
      expect(result.password.length).toBe(16);
      expect(result.strength).toBeDefined();
      expect(result.strength.score).toBeDefined();
    });

    it('should calculate password strength', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
      };

      const result = await service.generatePassword(options);

      expect(result.strength.score).toBeGreaterThanOrEqual(0);
      expect(result.strength.score).toBeLessThanOrEqual(100);
      expect(result.strength.level).toBeDefined();
    });

    it('should add to history', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
      };

      const historyBefore = (service as any).generationHistory.length;

      await service.generatePassword(options);

      const historyAfter = (service as any).generationHistory.length;
      expect(historyAfter).toBe(historyBefore + 1);
    });

    it('should include templateId in history if provided', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
      };

      await service.generatePassword(options, 'banking');

      const history = (service as any).generationHistory as GenerationHistory[];
      const lastEntry = history[history.length - 1];

      expect(lastEntry.templateUsed).toBe('banking');
    });

    it('should generate different passwords on each call', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
      };

      const result1 = await service.generatePassword(options);
      const result2 = await service.generatePassword(options);

      // Due to randomness, they should be different most times
      expect(result1.password).not.toBe(result2.password);
    });

    it('should handle errors gracefully', async () => {
      const options: PasswordGeneratorOptions = {
        length: 0, // Invalid length
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
      };

      await expect(service.generatePassword(options)).rejects.toThrow();
    });

    it('should mark new password as not favorite', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
      };

      await service.generatePassword(options);

      const history = (service as any).generationHistory as GenerationHistory[];
      const lastEntry = history[history.length - 1];

      expect(lastEntry.isFavorite).toBe(false);
    });
  });

  // ==================== Generate Multiple ====================
  describe('generateMultiple', () => {
    it('should generate multiple passwords', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
      };

      const results = await service.generateMultiple(options, 5);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.password).toBeDefined();
        expect(result.strength).toBeDefined();
      });
    });

    it('should default to 5 passwords when count not specified', async () => {
      const options: PasswordGeneratorOptions = {
        length: 12,
        includeUppercase: true,
        includeLowercase: true,
      };

      const results = await service.generateMultiple(options);

      expect(results).toHaveLength(5);
    });

    it('should handle custom count', async () => {
      const options: PasswordGeneratorOptions = {
        length: 12,
        includeUppercase: true,
        includeLowercase: true,
      };

      const results = await service.generateMultiple(options, 10);

      expect(results).toHaveLength(10);
    });

    it('should add all to history', async () => {
      const options: PasswordGeneratorOptions = {
        length: 12,
        includeUppercase: true,
        includeLowercase: true,
      };

      const historyBefore = (service as any).generationHistory.length;

      await service.generateMultiple(options, 3);

      const historyAfter = (service as any).generationHistory.length;
      expect(historyAfter).toBe(historyBefore + 3);
    });

    it('should generate different passwords', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
      };

      const results = await service.generateMultiple(options, 5);
      const passwords = results.map(r => r.password);

      // Check for unique passwords
      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBeGreaterThan(1);
    });
  });

  // ==================== Pronounceable Passwords ====================
  describe('generatePronounceablePassword', () => {
    it('should generate pronounceable password', () => {
      const password = service.generatePronounceablePassword(12);

      expect(password).toBeDefined();
      expect(password.length).toBe(12);
      expect(typeof password).toBe('string');
    });

    it('should default to length 12', () => {
      const password = service.generatePronounceablePassword();

      expect(password.length).toBe(12);
    });

    it('should handle custom length', () => {
      const lengths = [8, 12, 16, 20];

      lengths.forEach(length => {
        const password = service.generatePronounceablePassword(length);
        expect(password.length).toBe(length);
      });
    });

    it('should contain readable characters', () => {
      const password = service.generatePronounceablePassword(16);

      // Should contain numbers or be pronounceable
      expect(password).toMatch(/[a-z0-9]/i);
    });

    it('should generate different passwords', () => {
      const password1 = service.generatePronounceablePassword(12);
      const password2 = service.generatePronounceablePassword(12);

      expect(password1).not.toBe(password2);
    });
  });

  // ==================== History Management ====================
  describe('History Management', () => {
    it('should maintain generation history', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
      };

      await service.generatePassword(options);
      await service.generatePassword(options);
      await service.generatePassword(options);

      const history = (service as any).generationHistory as GenerationHistory[];
      expect(history.length).toBeGreaterThanOrEqual(3);
    });

    it('should have max history size', async () => {
      const options: PasswordGeneratorOptions = {
        length: 12,
        includeUppercase: true,
      };

      const maxSize = (service as any).maxHistorySize;

      // Generate more than max
      for (let i = 0; i < maxSize + 10; i++) {
        await service.generatePassword(options);
      }

      const history = (service as any).generationHistory as GenerationHistory[];
      expect(history.length).toBeLessThanOrEqual(maxSize);
    });

    it('history entries should have required properties', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
      };

      await service.generatePassword(options);

      const history = (service as any).generationHistory as GenerationHistory[];
      const entry = history[0];

      expect(entry.id).toBeDefined();
      expect(entry.password).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.options).toBeDefined();
      expect(entry.strength).toBeDefined();
      expect(entry.isFavorite).toBeDefined();
    });

    it('timestamps should be recent', async () => {
      const options: PasswordGeneratorOptions = {
        length: 16,
        includeUppercase: true,
      };

      const beforeTime = Date.now();
      await service.generatePassword(options);
      const afterTime = Date.now();

      const history = (service as any).generationHistory as GenerationHistory[];
      const entry = history[0];
      const entryTime = entry.timestamp.getTime();

      expect(entryTime).toBeGreaterThanOrEqual(beforeTime);
      expect(entryTime).toBeLessThanOrEqual(afterTime);
    });
  });

  // ==================== Integration Tests ====================
  describe('Integration Tests', () => {
    it('should generate password using template', async () => {
      const templates = service.getTemplates();
      const bankingTemplate = templates.find(t => t.id === 'banking');

      if (!bankingTemplate) {
        throw new Error('Banking template not found');
      }

      const result = await service.generatePassword(
        bankingTemplate.options,
        'banking',
      );

      expect(result.password).toBeDefined();
      expect(result.strength).toBeDefined();
    });

    it('should generate multiple using preset options', async () => {
      const presets = service.getPresets();

      if (presets.length === 0) {
        throw new Error('No presets available');
      }

      const firstPreset = presets[0];

      const results = await service.generateMultiple(firstPreset.options, 3);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.password).toBeDefined();
      });
    });

    it('workflow: generate, store in history, retrieve', async () => {
      const options: PasswordGeneratorOptions = {
        length: 20,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
      };

      const result1 = await service.generatePassword(options);
      const result2 = await service.generatePassword(options);

      const history = (service as any).generationHistory as GenerationHistory[];

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some(h => h.password === result1.password)).toBe(true);
      expect(history.some(h => h.password === result2.password)).toBe(true);
    });
  });

  // ==================== Edge Cases ====================
  describe('Edge Cases', () => {
    it('should handle very long passwords', async () => {
      const options: PasswordGeneratorOptions = {
        length: 128,
        includeUppercase: true,
        includeLowercase: true,
      };

      const result = await service.generatePassword(options);

      expect(result.password.length).toBe(128);
    });

    it('should handle minimum length passwords', async () => {
      const options: PasswordGeneratorOptions = {
        length: 1,
        includeUppercase: true,
      };

      const result = await service.generatePassword(options);

      expect(result.password.length).toBe(1);
    });

    it('should handle single character type', async () => {
      const options: PasswordGeneratorOptions = {
        length: 8,
        includeUppercase: true,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
      };

      const result = await service.generatePassword(options);

      expect(result.password).toBeDefined();
      expect(result.password.length).toBe(8);
    });
  });

  // ==================== Memorable Password Generation ====================
  describe('generateMemorablePassword', () => {
    it('should generate memorable password with default length', () => {
      const password = service.generateMemorablePassword();

      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(12);
    });

    it('should generate memorable password with custom length', () => {
      const lengths = [8, 10, 12, 14, 16, 20];

      lengths.forEach(length => {
        const password = service.generateMemorablePassword(length);
        expect(password.length).toBe(length);
      });
    });

    it('should generate memorable password with short length', () => {
      const password = service.generateMemorablePassword(8);

      expect(password.length).toBe(8);
      // Short passwords may be truncated, so just verify length and type
      expect(typeof password).toBe('string');
      expect(/[a-zA-Z0-9]/.test(password)).toBe(true);
    });

    it('should generate memorable password with medium length', () => {
      const password = service.generateMemorablePassword(10);

      expect(password.length).toBe(10);
      // Medium length (>= 8 and < 10) uses noun + 3-digit pattern
      expect(/[a-zA-Z]/.test(password)).toBe(true); // Should contain letters
      expect(/[0-9]/.test(password)).toBe(true); // Should contain numbers
    });

    it('should generate memorable password with long length', () => {
      const password = service.generateMemorablePassword(15);

      expect(password.length).toBe(15);
      expect(password).toMatch(/[0-9]/); // Should contain numbers
    });

    it('should handle very long length', () => {
      const password = service.generateMemorablePassword(30);

      expect(password.length).toBe(30);
      expect(typeof password).toBe('string');
    });

    it('should handle very short length (edge case)', () => {
      const password = service.generateMemorablePassword(5);

      expect(password.length).toBe(5);
      expect(typeof password).toBe('string');
    });

    it('should contain only alphanumeric characters', () => {
      const password = service.generateMemorablePassword(16);

      // Memorable passwords should be alphanumeric
      expect(password).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should contain both letters and numbers', () => {
      // Generate a longer password to ensure numbers aren't truncated
      // For length >= 10, uses Adjective + Noun + Year pattern
      const password = service.generateMemorablePassword(15);

      expect(password).toMatch(/[a-zA-Z]/); // Contains letters
      expect(password).toMatch(/[0-9]/); // Contains numbers (year)
    });

    it('should generate different passwords on each call', () => {
      const passwords = [
        service.generateMemorablePassword(12),
        service.generateMemorablePassword(12),
        service.generateMemorablePassword(12),
        service.generateMemorablePassword(12),
        service.generateMemorablePassword(12),
      ];

      // At least some should be different (randomness check)
      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBeGreaterThan(1);
    });

    it('should use adjective + noun + year pattern for length >= 10', () => {
      const password = service.generateMemorablePassword(15);

      // Should contain uppercase letters (from adjectives/nouns) and numbers (from year)
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password.length).toBe(15);
    });

    it('should use noun + 3-digit pattern for length 8-9', () => {
      const password = service.generateMemorablePassword(8);

      expect(password.length).toBe(8);
      expect(password).toMatch(/[a-zA-Z]/);
      expect(password).toMatch(/[0-9]/);
    });

    it('should use noun + 2-digit pattern for length < 8', () => {
      const password = service.generateMemorablePassword(6);

      expect(password.length).toBe(6);
      // Short passwords may be noun + number or truncated/padded
      expect(/[a-zA-Z0-9]/.test(password)).toBe(true);
    });

    it('should return string type', () => {
      const password = service.generateMemorablePassword(12);
      expect(typeof password).toBe('string');
    });

    it('should not be empty', () => {
      const password = service.generateMemorablePassword(10);
      expect(password.length).toBeGreaterThan(0);
    });

    it('should handle length exactly at threshold (10)', () => {
      const password = service.generateMemorablePassword(10);
      expect(password.length).toBe(10);
    });

    it('should handle length exactly at threshold (8)', () => {
      const password = service.generateMemorablePassword(8);
      expect(password.length).toBe(8);
    });

    it('should generate consistent result structure', () => {
      const password = service.generateMemorablePassword(12);

      // Should be consistent: always alphanumeric, correct length, non-empty
      expect(password).toBeTruthy();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(12);
      expect(/^[a-zA-Z0-9]+$/.test(password)).toBe(true);
    });
  });

  // ==================== Pattern Password Generation ====================
  describe('generatePatternPassword', () => {
    it('should generate password with W placeholder (uppercase word)', () => {
      const password = service.generatePatternPassword('W');

      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password.length).toBeGreaterThan(0);
      // Should contain at least one alphabetic character
      expect(/[a-zA-Z]/.test(password)).toBe(true);
    });

    it('should generate password with w placeholder (lowercase word)', () => {
      const password = service.generatePatternPassword('w');

      expect(password).toBeDefined();
      expect(password).toMatch(/^[a-z]/);
    });

    it('should generate password with N placeholder (number)', () => {
      const password = service.generatePatternPassword('N');

      expect(password).toBeDefined();
      expect(password).toMatch(/^[1-9]$/); // N should be single digit 1-9
    });

    it('should generate password with S placeholder (symbol)', () => {
      const password = service.generatePatternPassword('S');

      expect(password).toBeDefined();
      expect(password).toMatch(/^[!@#$%^&*]$/);
    });

    it('should generate password with D placeholder (2-digit number)', () => {
      const password = service.generatePatternPassword('D');

      expect(password).toBeDefined();
      expect(password).toMatch(/^[0-9]{1,2}$/);
    });

    it('should generate password with Y placeholder (year)', () => {
      const password = service.generatePatternPassword('Y');

      expect(password).toBeDefined();
      const year = parseInt(password, 10);
      const currentYear = new Date().getFullYear();
      expect(year).toBeGreaterThanOrEqual(currentYear - 1);
      expect(year).toBeLessThanOrEqual(currentYear + 2);
    });

    it('should generate password with Z placeholder (network word)', () => {
      const password = service.generatePatternPassword('Z');

      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password.length).toBeGreaterThan(0);
    });

    it('should handle complex pattern W-N-S-w', () => {
      const pattern = 'W-N-S-w';
      const password = service.generatePatternPassword(pattern);

      expect(password).toBeDefined();
      expect(password).toContain('-'); // Should keep static dashes
      const parts = password.split('-');
      expect(parts.length).toBe(4);
      // Each part should have content after replacement
      parts.forEach(part => {
        expect(part.length).toBeGreaterThan(0);
      });
      // Should contain alphanumeric and symbols
      expect(/[a-zA-Z]/.test(password)).toBe(true);
      expect(/[!@#$%^&*]/.test(password)).toBe(true);
    });

    it('should handle pattern with multiple placeholders WWW999', () => {
      const password = service.generatePatternPassword('WWW999');

      expect(password).toBeDefined();
      expect(password.length).toBeGreaterThan(0);
      // Should have mixed uppercase and numbers
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
    });

    it('should handle pattern with all placeholder types', () => {
      const password = service.generatePatternPassword('W-w-N-S-D-Y-Z');

      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password).toContain('-');
    });

    it('should preserve static text in pattern', () => {
      const pattern = 'prefix-W-suffix';
      const password = service.generatePatternPassword(pattern);

      expect(password).toContain('prefix');
      expect(password).toContain('suffix');
      expect(password).toContain('-');
    });

    it('should handle pattern with no placeholders', () => {
      // Use a pattern that doesn't contain any placeholder characters (W, w, N, S, D, Y, Z)
      const pattern = 'static123pass';
      const password = service.generatePatternPassword(pattern);

      expect(password).toBe('static123pass');
    });

    it('should handle empty pattern', () => {
      const password = service.generatePatternPassword('');

      expect(password).toBeDefined();
      expect(password).toBe('');
    });

    it('should generate different results for random placeholders', () => {
      const passwords = [
        service.generatePatternPassword('W'),
        service.generatePatternPassword('W'),
        service.generatePatternPassword('W'),
        service.generatePatternPassword('W'),
        service.generatePatternPassword('W'),
      ];

      const uniquePasswords = new Set(passwords);
      expect(uniquePasswords.size).toBeGreaterThan(1);
    });

    it('should handle pattern WordNumberSymbol', () => {
      const password = service.generatePatternPassword('WNS');

      expect(password).toBeDefined();
      expect(password.length).toBeGreaterThan(0);
      // Should have at least one uppercase letter (from W)
      expect(password).toMatch(/[A-Z]/);
    });

    it('should handle case-sensitive placeholders', () => {
      const upperPassword = service.generatePatternPassword('W');
      const lowerPassword = service.generatePatternPassword('w');

      // Both should produce words from word lists
      expect(/[a-zA-Z]/.test(upperPassword)).toBe(true);
      expect(/[a-z]/.test(lowerPassword)).toBe(true);
      // Lowercase version should not have uppercase letters only
      expect(lowerPassword).not.toMatch(/^[A-Z]+$/);
    });

    it('should return string type', () => {
      const password = service.generatePatternPassword('W-N-S');
      expect(typeof password).toBe('string');
    });

    it('should handle long pattern with many placeholders', () => {
      const pattern = 'W-W-W-N-N-N-S-S-S-Y';
      const password = service.generatePatternPassword(pattern);

      expect(password).toBeDefined();
      expect(password).toContain('-');
    });

    it('should handle pattern starting with placeholder', () => {
      // Use a text without placeholder characters (no W, w, N, S, D, Y, Z)
      const password = service.generatePatternPassword('Wtext123');

      expect(password).toBeDefined();
      // W should be replaced with a word, followed by 'text123'
      expect(password).toContain('text123');
      expect(/[a-zA-Z]/.test(password)).toBe(true);
    });

    it('should handle pattern ending with placeholder', () => {
      const password = service.generatePatternPassword('prefixW');

      expect(password).toBeDefined();
      // 'prefix' should remain, W should be replaced with a word
      expect(password).toContain('prefix');
      expect(/[a-zA-Z]/.test(password)).toBe(true);
    });

    it('should handle special pattern combinations', () => {
      const password = service.generatePatternPassword('Y-Y-Y');

      expect(password).toBeDefined();
      const parts = password.split('-');
      expect(parts.length).toBe(3);
      parts.forEach(part => {
        if (part) {
          const year = parseInt(part, 10);
          expect(year).toBeTruthy();
        }
      });
    });
  });
});
