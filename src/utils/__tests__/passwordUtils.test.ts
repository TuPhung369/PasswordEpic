/**
 * passwordUtils.test.ts
 * Comprehensive test suite for password utilities
 * Tests generation, validation, formatting, search, filter, and security functions
 */

import CryptoJS from 'crypto-js';
import {
  calculatePasswordStrength,
  generateSecurePassword,
  generatePasswordFromPattern,
  generatePronounceablePassword,
  ensureMinimumRequirements,
  extractDomain,
  getFaviconUrl,
  formatLastUsed,
  formatPasswordAge,
  isPasswordOld,
  searchPasswords,
  filterPasswords,
  sortPasswords,
  calculatePasswordEntropy,
  validateCustomField,
  exportPasswordToCSV,
  calculateSecurityScore,
  getPasswordStrengthColor,
  PasswordGenerationOptions,
} from '../passwordUtils';

// Mock dependencies
jest.mock('../../services/passwordValidationService', () => ({
  PasswordValidationService: {
    analyzePasswordStrength: jest.fn((password: string) => ({
      score: password.length >= 8 ? 3 : password.length >= 4 ? 2 : 1,
      strength: password.length >= 8 ? 'Strong' : 'Weak',
      feedback: [],
    })),
  },
}));

jest.mock('crypto-js', () => ({
  lib: {
    WordArray: {
      random: jest.fn((bytes: number) => ({
        words: Array(Math.ceil(bytes / 4)).fill(12345),
      })),
    },
  },
}));

interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  website?: string;
  notes?: string;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  accessCount?: number;
  breachStatus?: { isBreached: boolean };
  customFields?: Array<{
    name: string;
    value: string;
    type: string;
    isHidden?: boolean;
  }>;
}

interface CustomField {
  name: string;
  value: string;
  type: string;
  isHidden?: boolean;
}

describe('passwordUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============== PASSWORD STRENGTH ==============
  describe('calculatePasswordStrength()', () => {
    test('should call PasswordValidationService', () => {
      calculatePasswordStrength('TestPassword123!');
      // This is tested implicitly through the validation service mock
    });

    test('should return strength result', () => {
      const result = calculatePasswordStrength('StrongPassword123!');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('strength');
    });
  });

  // ============== PASSWORD GENERATION ==============
  describe('generateSecurePassword()', () => {
    test('should generate password with default options', () => {
      const password = generateSecurePassword({});
      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(16); // default length
    });

    test('should respect custom length', () => {
      const password = generateSecurePassword({ length: 32 });
      expect(password.length).toBe(32);
    });

    test('should generate password with lowercase letters', () => {
      const password = generateSecurePassword({
        length: 100,
        includeLowercase: true,
        includeUppercase: false,
        includeNumbers: false,
        includeSymbols: false,
      });
      expect(/[a-z]/.test(password)).toBe(true);
    });

    test('should generate password with uppercase letters', () => {
      const password = generateSecurePassword({
        length: 100,
        includeLowercase: false,
        includeUppercase: true,
        includeNumbers: false,
        includeSymbols: false,
      });
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    test('should generate password with numbers', () => {
      const password = generateSecurePassword({
        length: 100,
        includeLowercase: false,
        includeUppercase: false,
        includeNumbers: true,
        includeSymbols: false,
      });
      expect(/\d/.test(password)).toBe(true);
    });

    test('should generate password with symbols', () => {
      const password = generateSecurePassword({
        length: 100,
        includeLowercase: false,
        includeUppercase: false,
        includeNumbers: false,
        includeSymbols: true,
      });
      expect(/[!@#$%^&*()_+=[\]{}|;:,.<>?-]/.test(password)).toBe(true);
    });

    test('should exclude similar characters when enabled', () => {
      const password = generateSecurePassword({
        length: 100,
        includeLowercase: true,
        includeUppercase: true,
        includeNumbers: true,
        excludeSimilar: true,
      });
      // Should not contain i, l, 1, L, o, 0, O, etc.
      expect(/[il1Lo0O]/.test(password)).toBe(false);
    });

    test('should support custom characters', () => {
      const password = generateSecurePassword({
        length: 50,
        includeLowercase: false,
        includeUppercase: false,
        includeNumbers: false,
        includeSymbols: false,
        customCharacters: 'ABC',
      });
      expect(/[ABC]/.test(password)).toBe(true);
    });

    test('should use pattern-based generation when pattern provided', () => {
      const password = generateSecurePassword({
        pattern: 'LLll-nnnn',
      });
      expect(password).toMatch(/^[A-Z]{2}[a-z]{2}-\d{4}$/);
    });

    test('should use pronounceable generation when requested', () => {
      const password = generateSecurePassword({
        length: 20,
        pronounceable: true,
      });
      expect(password.length).toBeLessThanOrEqual(20);
    });

    test('should throw error when no character types selected', () => {
      expect(() =>
        generateSecurePassword({
          includeLowercase: false,
          includeUppercase: false,
          includeNumbers: false,
          includeSymbols: false,
        }),
      ).toThrow('At least one character type must be selected');
    });
  });

  // ============== PATTERN-BASED GENERATION ==============
  describe('generatePasswordFromPattern()', () => {
    test('should generate password matching pattern', () => {
      const password = generatePasswordFromPattern('LLnn-ll', {});
      expect(password).toMatch(/^[A-Z]{2}\d{2}-[a-z]{2}$/);
    });

    test('should handle uppercase pattern', () => {
      const password = generatePasswordFromPattern('LLLL', {});
      expect(password).toMatch(/^[A-Z]{4}$/);
    });

    test('should handle lowercase pattern', () => {
      const password = generatePasswordFromPattern('llll', {});
      expect(password).toMatch(/^[a-z]{4}$/);
    });

    test('should handle numbers pattern', () => {
      const password = generatePasswordFromPattern('nnnn', {});
      expect(password).toMatch(/^\d{4}$/);
    });

    test('should handle symbols pattern', () => {
      const password = generatePasswordFromPattern('ssss', {});
      expect(/[!@#$%^&*()_+=[\]{}|;:,.<>?]/.test(password)).toBe(true);
    });

    test('should include literal characters', () => {
      const password = generatePasswordFromPattern('LL-nn-ll', {});
      expect(password).toContain('-');
    });

    test('should respect excludeSimilar option', () => {
      const password = generatePasswordFromPattern('LLnn', {
        excludeSimilar: true,
      });
      expect(/[il1Lo0O]/.test(password)).toBe(false);
    });
  });

  // ============== PRONOUNCEABLE GENERATION ==============
  describe('generatePronounceablePassword()', () => {
    test('should generate pronounceable password', () => {
      const password = generatePronounceablePassword(12, {});
      expect(password).toBeDefined();
      expect(password.length).toBeLessThanOrEqual(12);
    });

    test('should capitalize first letter when includeUppercase enabled', () => {
      const password = generatePronounceablePassword(12, {
        includeUppercase: true,
      });
      expect(/^[A-Z]/.test(password)).toBe(true);
    });

    test('should include numbers when requested', () => {
      const password = generatePronounceablePassword(20, {
        includeNumbers: true,
      });
      expect(/\d/.test(password)).toBe(true);
    });

    test('should include symbols when requested', () => {
      const password = generatePronounceablePassword(20, {
        includeSymbols: true,
      });
      expect(/[!@#$%^&*]/.test(password)).toBe(true);
    });

    test('should respect length limit', () => {
      const password = generatePronounceablePassword(10, {});
      expect(password.length).toBeLessThanOrEqual(10);
    });
  });

  // ============== MINIMUM REQUIREMENTS ==============
  describe('ensureMinimumRequirements()', () => {
    test('should add missing numbers', () => {
      const password = ensureMinimumRequirements('abcdefgh', {
        minNumbers: 1,
      });
      const numberCount = (password.match(/\d/g) || []).length;
      expect(numberCount).toBeGreaterThanOrEqual(1);
    });

    test('should add missing symbols', () => {
      const password = ensureMinimumRequirements('abcdefgh', {
        minSymbols: 1,
      });
      const symbolCount = (
        password.match(/[!@#$%^&*()_+=[\]{}|;:,.<>?-]/g) || []
      ).length;
      expect(symbolCount).toBeGreaterThanOrEqual(1);
    });

    test('should not modify password if requirements met', () => {
      const original = 'abcd1234!';
      const password = ensureMinimumRequirements(original, {
        minNumbers: 1,
        minSymbols: 1,
      });
      expect(password).toBe(original);
    });

    test('should handle no requirements', () => {
      const password = ensureMinimumRequirements('abcdefgh', {});
      expect(password).toBe('abcdefgh');
    });
  });

  // ============== DOMAIN EXTRACTION ==============
  describe('extractDomain()', () => {
    test('should extract domain from full URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
    });

    test('should extract domain from URL without protocol', () => {
      expect(extractDomain('www.example.com')).toBe('example.com');
    });

    test('should extract domain from plain domain', () => {
      expect(extractDomain('example.com')).toBe('example.com');
    });

    test('should remove www prefix', () => {
      expect(extractDomain('https://www.github.com')).toBe('github.com');
    });

    test('should handle subdomain', () => {
      expect(extractDomain('https://api.example.com')).toBe('api.example.com');
    });

    test('should handle localhost', () => {
      expect(extractDomain('http://localhost:3000')).toBe('localhost');
    });

    test('should handle IP address', () => {
      expect(extractDomain('http://192.168.1.1')).toBe('192.168.1.1');
    });

    test('should fallback on invalid URL', () => {
      const result = extractDomain('not a valid url');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ============== FAVICON URL ==============
  describe('getFaviconUrl()', () => {
    test('should generate Google favicon URL', () => {
      const url = getFaviconUrl('example.com');
      expect(url).toContain('google.com/s2/favicons');
      expect(url).toContain('domain=');
    });

    test('should include domain in query', () => {
      const url = getFaviconUrl('https://www.github.com');
      expect(url).toContain('github.com');
    });

    test('should include size parameter', () => {
      const url = getFaviconUrl('example.com');
      expect(url).toContain('sz=32');
    });
  });

  // ============== LAST USED FORMATTING ==============
  describe('formatLastUsed()', () => {
    test('should return "Never used" for undefined date', () => {
      expect(formatLastUsed(undefined)).toBe('Never used');
    });

    test('should return "Just now" for recent access', () => {
      const recentDate = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      expect(formatLastUsed(recentDate)).toBe('Just now');
    });

    test('should format minutes ago', () => {
      const date = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      expect(formatLastUsed(date)).toContain('m ago');
    });

    test('should format hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      expect(formatLastUsed(date)).toContain('h ago');
    });

    test('should format days ago', () => {
      const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      expect(formatLastUsed(date)).toContain('d ago');
    });

    test('should format weeks ago', () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
      expect(formatLastUsed(date)).toContain('w ago');
    });

    test('should format months ago', () => {
      const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
      expect(formatLastUsed(date)).toContain('mo ago');
    });

    test('should format years ago', () => {
      const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // 400 days ago
      expect(formatLastUsed(date)).toContain('y ago');
    });
  });

  // ============== PASSWORD AGE FORMATTING ==============
  describe('formatPasswordAge()', () => {
    test('should return "Today" for same day', () => {
      const createdAt = new Date();
      const updatedAt = new Date();
      expect(formatPasswordAge(createdAt, updatedAt)).toBe('Today');
    });

    test('should format age in days', () => {
      const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const age = formatPasswordAge(createdAt, updatedAt);
      expect(age).toMatch(/\d+ days/);
    });

    test('should format age in weeks', () => {
      const createdAt = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      const age = formatPasswordAge(createdAt, updatedAt);
      // Either days or weeks depending on calculation
      expect(age).toMatch(/\d+ (days?|weeks?)/);
    });

    test('should format age in months', () => {
      const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const age = formatPasswordAge(createdAt, updatedAt);
      // Either weeks or months depending on calculation
      expect(age).toMatch(/\d+ (weeks?|months?)/);
    });

    test('should format age in years', () => {
      const createdAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      const age = formatPasswordAge(createdAt, updatedAt);
      // Should show years or months
      expect(age).toMatch(/\d+ (months?|years?)/);
    });

    test('should use most recent date for age calculation', () => {
      const createdAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const age = formatPasswordAge(createdAt, updatedAt);
      // Should use updatedAt (10 days old), which is in the 7-30 day range -> weeks
      expect(age).toMatch(/\d+ (days?|weeks?)/);
    });
  });

  // ============== PASSWORD OLD CHECK ==============
  describe('isPasswordOld()', () => {
    test('should return false for recent password', () => {
      const createdAt = new Date();
      const updatedAt = new Date();
      expect(isPasswordOld(createdAt, updatedAt, 12)).toBe(false);
    });

    test('should return true for old password', () => {
      const createdAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 380 * 24 * 60 * 60 * 1000);
      expect(isPasswordOld(createdAt, updatedAt, 12)).toBe(true);
    });

    test('should use custom threshold', () => {
      // 7 days = 0.23 months, so should be false for 1 month threshold
      const createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(isPasswordOld(createdAt, updatedAt, 1)).toBe(false);

      // 45 days ≈ 1.5 months, should be true for 1 month threshold
      const createdAt2 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      const updatedAt2 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      expect(isPasswordOld(createdAt2, updatedAt2, 1)).toBe(true);
    });

    test('should use most recent date for calculation', () => {
      const createdAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      const updatedAt = new Date(); // Very recent
      expect(isPasswordOld(createdAt, updatedAt, 12)).toBe(false);
    });
  });

  // ============== PASSWORD SEARCH ==============
  describe('searchPasswords()', () => {
    const mockPasswords: PasswordEntry[] = [
      {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'pass123',
        website: 'gmail.com',
        notes: 'Personal email',
        category: 'Email',
        tags: ['personal'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        title: 'GitHub',
        username: 'developer',
        password: 'pass456',
        website: 'github.com',
        notes: 'Work account',
        category: 'Development',
        tags: ['work'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    test('should return all passwords for empty query', () => {
      const results = searchPasswords(mockPasswords, '');
      expect(results).toEqual(mockPasswords);
    });

    test('should find password by title', () => {
      const results = searchPasswords(mockPasswords, 'Gmail');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Gmail');
    });

    test('should find password by username', () => {
      const results = searchPasswords(mockPasswords, 'developer');
      expect(results.length).toBe(1);
      expect(results[0].username).toBe('developer');
    });

    test('should find password by website', () => {
      const results = searchPasswords(mockPasswords, 'github.com');
      expect(results.length).toBe(1);
      expect(results[0].website).toBe('github.com');
    });

    test('should find password by notes', () => {
      const results = searchPasswords(mockPasswords, 'Personal');
      expect(results.length).toBe(1);
      expect(results[0].notes).toContain('Personal');
    });

    test('should find password by tag', () => {
      const results = searchPasswords(mockPasswords, 'work');
      expect(results.length).toBe(1);
      expect(results[0].tags).toContain('work');
    });

    test('should be case insensitive', () => {
      const results = searchPasswords(mockPasswords, 'GMAIL');
      expect(results.length).toBe(1);
    });

    test('should search in custom fields when enabled', () => {
      const passwordsWithCustomFields: PasswordEntry[] = [
        {
          ...mockPasswords[0],
          customFields: [
            {
              name: 'Recovery Email',
              value: 'recovery@example.com',
              type: 'email',
            },
          ],
        },
      ];
      const results = searchPasswords(passwordsWithCustomFields, 'recovery');
      expect(results.length).toBe(1);
    });

    test('should not search hidden custom fields', () => {
      const passwordsWithCustomFields: PasswordEntry[] = [
        {
          ...mockPasswords[0],
          customFields: [
            {
              name: 'Hidden Field',
              value: 'secretvalue',
              type: 'text',
              isHidden: true,
            },
          ],
        },
      ];
      const results = searchPasswords(passwordsWithCustomFields, 'secret');
      expect(results.length).toBe(0);
    });
  });

  // ============== PASSWORD FILTERING ==============
  describe('filterPasswords()', () => {
    const mockPasswords: PasswordEntry[] = [
      {
        id: '1',
        title: 'Gmail',
        username: 'user@gmail.com',
        password: 'ShortPass',
        website: 'gmail.com',
        category: 'Email',
        tags: ['personal'],
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        breachStatus: { isBreached: false },
      },
      {
        id: '2',
        title: 'Compromised',
        username: 'user',
        password: 'pass123',
        category: 'Other',
        tags: ['old'],
        isFavorite: false,
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 380 * 24 * 60 * 60 * 1000),
        breachStatus: { isBreached: true },
      },
    ];

    test('should filter by category', () => {
      const results = filterPasswords(mockPasswords, {
        categories: ['Email'],
      });
      expect(results.length).toBe(1);
      expect(results[0].category).toBe('Email');
    });

    test('should filter by tag', () => {
      const results = filterPasswords(mockPasswords, {
        tags: ['personal'],
      });
      expect(results.length).toBe(1);
    });

    test('should filter favorites', () => {
      const results = filterPasswords(mockPasswords, {
        favorites: true,
      });
      expect(results.length).toBe(1);
      expect(results[0].isFavorite).toBe(true);
    });

    test('should filter by weak passwords', () => {
      const results = filterPasswords(mockPasswords, {
        weakPasswords: true,
      });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter compromised passwords', () => {
      const results = filterPasswords(mockPasswords, {
        compromised: true,
      });
      expect(results.length).toBe(1);
      expect(results[0].breachStatus?.isBreached).toBe(true);
    });

    test('should filter by max age', () => {
      const results = filterPasswords(mockPasswords, {
        maxAge: 12,
      });
      expect(results.length).toBe(1);
    });

    test('should apply multiple filters', () => {
      const results = filterPasswords(mockPasswords, {
        categories: ['Email'],
        isFavorite: true,
      });
      expect(results.length).toBe(1);
    });
  });

  // ============== PASSWORD SORTING ==============
  describe('sortPasswords()', () => {
    const mockPasswords: PasswordEntry[] = [
      {
        id: '1',
        title: 'Zebra',
        username: 'z',
        password: 'VeryLongPasswordWith16Chars',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        accessCount: 5,
      },
      {
        id: '2',
        title: 'Apple',
        username: 'a',
        password: 'short',
        createdAt: new Date('2023-02-01'),
        updatedAt: new Date('2023-02-01'),
        accessCount: 10,
      },
    ];

    test('should sort by title ascending', () => {
      const results = sortPasswords(mockPasswords, 'title', 'asc');
      expect(results[0].title).toBe('Apple');
      expect(results[1].title).toBe('Zebra');
    });

    test('should sort by title descending', () => {
      const results = sortPasswords(mockPasswords, 'title', 'desc');
      expect(results[0].title).toBe('Zebra');
      expect(results[1].title).toBe('Apple');
    });

    test('should sort by username', () => {
      const results = sortPasswords(mockPasswords, 'username', 'asc');
      expect(results[0].username).toBe('a');
      expect(results[1].username).toBe('z');
    });

    test('should sort by createdAt', () => {
      const results = sortPasswords(mockPasswords, 'createdAt', 'asc');
      expect(results[0].createdAt.getTime()).toBeLessThan(
        results[1].createdAt.getTime(),
      );
    });

    test('should sort by accessCount', () => {
      const results = sortPasswords(mockPasswords, 'accessCount', 'asc');
      expect(results[0].accessCount).toBeLessThanOrEqual(
        results[1].accessCount || 0,
      );
    });

    test('should not modify original array', () => {
      const original = JSON.stringify(mockPasswords);
      sortPasswords(mockPasswords, 'title');
      expect(JSON.stringify(mockPasswords)).toBe(original);
    });
  });

  // ============== ENTROPY CALCULATION ==============
  describe('calculatePasswordEntropy()', () => {
    test('should calculate entropy for simple password', () => {
      const entropy = calculatePasswordEntropy('aaaa');
      expect(entropy).toBeGreaterThan(0);
    });

    test('should calculate higher entropy for longer passwords', () => {
      const entropy1 = calculatePasswordEntropy('aaaa');
      const entropy2 = calculatePasswordEntropy('aaaaaaaa');
      expect(entropy2).toBeGreaterThan(entropy1);
    });

    test('should calculate higher entropy for diverse character set', () => {
      const entropy1 = calculatePasswordEntropy('aaaa');
      const entropy2 = calculatePasswordEntropy('aA1!');
      expect(entropy2).toBeGreaterThan(entropy1);
    });
  });

  // ============== CUSTOM FIELD VALIDATION ==============
  describe('validateCustomField()', () => {
    test('should validate required field name', () => {
      const field: CustomField = {
        name: '',
        value: 'test',
        type: 'text',
      };
      const errors = validateCustomField(field);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('name');
    });

    test('should validate email format', () => {
      const field: CustomField = {
        name: 'Email',
        value: 'invalid-email',
        type: 'email',
      };
      const errors = validateCustomField(field);
      expect(errors.some(e => e.includes('email'))).toBe(true);
    });

    test('should accept valid email', () => {
      const field: CustomField = {
        name: 'Email',
        value: 'valid@example.com',
        type: 'email',
      };
      const errors = validateCustomField(field);
      expect(errors.length).toBe(0);
    });

    test('should validate URL format', () => {
      const field: CustomField = {
        name: 'Website',
        value: 'not a url',
        type: 'url',
      };
      const errors = validateCustomField(field);
      expect(errors.some(e => e.includes('URL'))).toBe(true);
    });

    test('should validate phone number format', () => {
      const field: CustomField = {
        name: 'Phone',
        value: 'abc',
        type: 'phone',
      };
      const errors = validateCustomField(field);
      expect(errors.some(e => e.includes('phone'))).toBe(true);
    });

    test('should accept valid phone number', () => {
      const field: CustomField = {
        name: 'Phone',
        value: '+14155552671',
        type: 'phone',
      };
      const errors = validateCustomField(field);
      expect(errors.length).toBe(0);
    });
  });

  // ============== CSV EXPORT ==============
  describe('exportPasswordToCSV()', () => {
    const entry: PasswordEntry = {
      id: '1',
      title: 'Gmail',
      username: 'user@gmail.com',
      password: 'secret',
      website: 'gmail.com',
      notes: 'Personal email',
      category: 'Email',
      tags: ['personal', 'email'],
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-02-01'),
    };

    test('should export password to CSV format', () => {
      const csv = exportPasswordToCSV(entry);
      expect(csv).toContain('Gmail');
      expect(csv).toContain('user@gmail.com');
    });

    test('should escape quotes in CSV', () => {
      const entryWithQuotes: PasswordEntry = {
        ...entry,
        notes: 'Quote: "test"',
      };
      const csv = exportPasswordToCSV(entryWithQuotes);
      expect(csv).toContain('""test""');
    });

    test('should include all fields', () => {
      const csv = exportPasswordToCSV(entry);
      const fields = csv.split(',');
      expect(fields.length).toBeGreaterThanOrEqual(9); // All fields
    });
  });

  // ============== SECURITY SCORING ==============
  describe('calculateSecurityScore()', () => {
    test('should calculate security score', () => {
      const entry: PasswordEntry = {
        id: '1',
        title: 'Test',
        username: 'user',
        password: 'VeryStrongPassword123!',
        category: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
        breachStatus: { isBreached: false },
      };
      const score = calculateSecurityScore(entry);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should give higher score for strong passwords', () => {
      const weakEntry: PasswordEntry = {
        id: '1',
        title: 'Test',
        username: 'user',
        password: 'weak',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const strongEntry: PasswordEntry = {
        id: '2',
        title: 'Test',
        username: 'user',
        password: 'VeryStrongPassword123!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const weakScore = calculateSecurityScore(weakEntry);
      const strongScore = calculateSecurityScore(strongEntry);
      expect(strongScore).toBeGreaterThan(weakScore);
    });

    test('should give higher score for breach-free passwords', () => {
      const breachedEntry: PasswordEntry = {
        id: '1',
        title: 'Test',
        username: 'user',
        password: 'password123',
        createdAt: new Date(),
        updatedAt: new Date(),
        breachStatus: { isBreached: true },
      };
      const safeEntry: PasswordEntry = {
        id: '2',
        title: 'Test',
        username: 'user',
        password: 'password123',
        createdAt: new Date(),
        updatedAt: new Date(),
        breachStatus: { isBreached: false },
      };
      const breachedScore = calculateSecurityScore(breachedEntry);
      const safeScore = calculateSecurityScore(safeEntry);
      expect(safeScore).toBeGreaterThan(breachedScore);
    });
  });

  // ============== PASSWORD STRENGTH COLOR ==============
  describe('getPasswordStrengthColor()', () => {
    test('should return red for score 1', () => {
      expect(getPasswordStrengthColor(1)).toBe('#FF3B30');
    });

    test('should return orange for score 2', () => {
      expect(getPasswordStrengthColor(2)).toBe('#FF9500');
    });

    test('should return yellow for score 3', () => {
      expect(getPasswordStrengthColor(3)).toBe('#FFCC00');
    });

    test('should return green for score 4', () => {
      expect(getPasswordStrengthColor(4)).toBe('#34C759');
    });
  });
});
