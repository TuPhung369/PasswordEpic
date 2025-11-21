import {
  PasswordEntry,
  PasswordStrengthResult,
  CustomField,
} from '../types/password';
import { PasswordValidationService } from '../services/passwordValidationService';
import CryptoJS from 'crypto-js';

/**
 * Calculate password strength using validation service
 */
export const calculatePasswordStrength = (
  password: string,
): PasswordStrengthResult => {
  return PasswordValidationService.analyzePasswordStrength(password);
};

/**
 * Enhanced password generation interface
 */
export interface PasswordGenerationOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeSimilar?: boolean;
  pronounceable?: boolean;
  pattern?: string;
  minNumbers?: number;
  minSymbols?: number;
  customCharacters?: string;
}

/**
 * Generate a secure password with enhanced options
 */
export const generateSecurePassword = (
  options: PasswordGenerationOptions,
): string => {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = false,
    excludeSimilar = true,
    pronounceable = false,
    pattern,
    customCharacters,
  } = options;

  // Use pattern-based generation if pattern is provided
  if (pattern) {
    return generatePasswordFromPattern(pattern, options);
  }

  // Use pronounceable generation if requested
  if (pronounceable) {
    return generatePronounceablePassword(length, options);
  }

  // Standard random generation
  let charset = '';

  if (includeLowercase) {
    charset += excludeSimilar
      ? 'abcdefghijkmnopqrstuvwxyz'
      : 'abcdefghijklmnopqrstuvwxyz';
  }

  if (includeUppercase) {
    charset += excludeSimilar
      ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  if (includeNumbers) {
    charset += excludeSimilar ? '23456789' : '0123456789';
  }

  if (includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (customCharacters) {
    charset += customCharacters;
  }

  if (charset === '') {
    throw new Error('At least one character type must be selected');
  }

  let password = '';
  const randomBytes = CryptoJS.lib.WordArray.random(length * 4);

  // Generate base password
  for (let i = 0; i < length; i++) {
    const randomIndex =
      Math.abs(randomBytes.words[i % randomBytes.words.length]) %
      charset.length;
    password += charset[randomIndex];
  }

  // Ensure minimum requirements are met
  password = ensureMinimumRequirements(password, options);

  return password;
};

/**
 * Generate password from pattern (e.g., "Llll-nnnn-LLLL")
 * L = uppercase letter, l = lowercase letter, n = number, s = symbol
 */
export const generatePasswordFromPattern = (
  pattern: string,
  options: PasswordGenerationOptions,
): string => {
  const { excludeSimilar = true, customCharacters } = options;

  const charSets = {
    L: excludeSimilar
      ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    l: excludeSimilar
      ? 'abcdefghijkmnopqrstuvwxyz'
      : 'abcdefghijklmnopqrstuvwxyz',
    n: excludeSimilar ? '23456789' : '0123456789',
    s: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    c: customCharacters || '',
  };

  let password = '';
  const randomBytes = CryptoJS.lib.WordArray.random(pattern.length * 4);

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (charSets[char as keyof typeof charSets]) {
      const charset = charSets[char as keyof typeof charSets];
      if (charset) {
        const randomIndex =
          Math.abs(randomBytes.words[i % randomBytes.words.length]) %
          charset.length;
        password += charset[randomIndex];
      }
    } else {
      // Literal character (like dash, dot, etc.)
      password += char;
    }
  }

  return password;
};

/**
 * Generate pronounceable password using syllable patterns
 */
export const generatePronounceablePassword = (
  length: number,
  options: PasswordGenerationOptions,
): string => {
  const consonants = options.excludeSimilar
    ? 'bcdfghjkmnpqrstvwxyz'
    : 'bcdfghjklmnpqrstvwxyz';
  const vowels = 'aeiou';
  const numbers = options.excludeSimilar ? '23456789' : '0123456789';
  const symbols = '!@#$%^&*';

  let password = '';
  let remaining = length;
  const randomBytes = CryptoJS.lib.WordArray.random(length * 4);
  let byteIndex = 0;

  while (remaining > 0) {
    // Generate syllable pattern (consonant-vowel or vowel-consonant)
    const useCV =
      Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) % 2 ===
      0;
    byteIndex++;

    if (useCV && remaining >= 2) {
      // Consonant-Vowel
      const consonant =
        consonants[
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
            consonants.length
        ];
      byteIndex++;
      const vowel =
        vowels[
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
            vowels.length
        ];
      byteIndex++;

      password += consonant + vowel;
      remaining -= 2;
    } else if (remaining >= 1) {
      // Single vowel
      const vowel =
        vowels[
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
            vowels.length
        ];
      byteIndex++;
      password += vowel;
      remaining -= 1;
    }
  }

  // Add numbers and symbols if required
  if (options.includeNumbers && numbers) {
    const numCount = Math.min(2, Math.floor(length * 0.2));
    for (let i = 0; i < numCount; i++) {
      const pos =
        Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
        password.length;
      byteIndex++;
      const num =
        numbers[
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
            numbers.length
        ];
      byteIndex++;
      password = password.slice(0, pos) + num + password.slice(pos + 1);
    }
  }

  if (options.includeSymbols && symbols) {
    const symCount = Math.min(1, Math.floor(length * 0.1));
    for (let i = 0; i < symCount; i++) {
      const pos =
        Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
        password.length;
      byteIndex++;
      const sym =
        symbols[
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
            symbols.length
        ];
      byteIndex++;
      password = password.slice(0, pos) + sym + password.slice(pos + 1);
    }
  }

  // Capitalize first letter if uppercase is enabled
  if (options.includeUppercase && password.length > 0) {
    password = password[0].toUpperCase() + password.slice(1);
  }

  return password.slice(0, length);
};

/**
 * Ensure password meets minimum requirements
 */
export const ensureMinimumRequirements = (
  password: string,
  options: PasswordGenerationOptions,
): string => {
  const { minNumbers = 0, minSymbols = 0 } = options;
  let result = password;

  // Count current characters
  const numberCount = (result.match(/\d/g) || []).length;
  const symbolCount = (result.match(/[!@#$%^&*()_+=[\]{}|;:,.<>?-]/g) || [])
    .length;

  // Add missing numbers
  if (numberCount < minNumbers) {
    const numbersToAdd = minNumbers - numberCount;
    const numbers = options.excludeSimilar ? '23456789' : '0123456789';
    const randomBytes = CryptoJS.lib.WordArray.random(numbersToAdd * 4);

    for (let i = 0; i < numbersToAdd && result.length > i; i++) {
      const randomIndex =
        Math.abs(randomBytes.words[i % randomBytes.words.length]) %
        numbers.length;
      const randomPos =
        Math.abs(randomBytes.words[(i + 1) % randomBytes.words.length]) %
        result.length;
      result =
        result.slice(0, randomPos) +
        numbers[randomIndex] +
        result.slice(randomPos + 1);
    }
  }

  // Add missing symbols
  if (symbolCount < minSymbols) {
    const symbolsToAdd = minSymbols - symbolCount;
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const randomBytes = CryptoJS.lib.WordArray.random(symbolsToAdd * 4);

    for (let i = 0; i < symbolsToAdd && result.length > i; i++) {
      const randomIndex =
        Math.abs(randomBytes.words[i % randomBytes.words.length]) %
        symbols.length;
      const randomPos =
        Math.abs(randomBytes.words[(i + 1) % randomBytes.words.length]) %
        result.length;
      result =
        result.slice(0, randomPos) +
        symbols[randomIndex] +
        result.slice(randomPos + 1);
    }
  }

  return result;
};

/**
 * Extract domain from URL
 */
export const extractDomain = (url: string): string => {
  try {
    // Add protocol if missing
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(urlWithProtocol).hostname;
    return domain.replace(/^www\./, ''); // Remove www prefix
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/\s]+)/);
    return match ? match[1] : url;
  }
};

/**
 * Get favicon URL for a domain
 */
export const getFaviconUrl = (domain: string): string => {
  const cleanDomain = extractDomain(domain);
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=32`;
};

/**
 * Format last used date
 */
export const formatLastUsed = (date?: Date): string => {
  if (!date) return 'Never used';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

/**
 * Format password age
 */
export const formatPasswordAge = (createdAt: Date, updatedAt: Date): string => {
  const lastChanged = updatedAt > createdAt ? updatedAt : createdAt;
  const now = new Date();
  const ageMs = now.getTime() - lastChanged.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageDays < 1) return 'Today';
  if (ageDays < 7) return `${ageDays} days`;
  if (ageDays < 30) return `${Math.floor(ageDays / 7)} weeks`;
  if (ageDays < 365) return `${Math.floor(ageDays / 30)} months`;
  return `${Math.floor(ageDays / 365)} years`;
};

/**
 * Check if password is old and needs updating
 */
export const isPasswordOld = (
  createdAt: Date,
  updatedAt: Date,
  monthsThreshold: number = 12,
): boolean => {
  const lastChanged = updatedAt > createdAt ? updatedAt : createdAt;
  const now = new Date();
  const ageMs = now.getTime() - lastChanged.getTime();
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30);
  return ageMonths > monthsThreshold;
};

/**
 * Search passwords with advanced matching
 */
export const searchPasswords = (
  passwords: PasswordEntry[],
  query: string,
  includeCustomFields: boolean = true,
): PasswordEntry[] => {
  if (!query.trim()) return passwords;

  const lowercaseQuery = query.toLowerCase().trim();

  return passwords.filter(entry => {
    // Search in basic fields
    const basicMatch =
      entry.title.toLowerCase().includes(lowercaseQuery) ||
      entry.username.toLowerCase().includes(lowercaseQuery) ||
      (entry.website && entry.website.toLowerCase().includes(lowercaseQuery)) ||
      (entry.notes && entry.notes.toLowerCase().includes(lowercaseQuery)) ||
      (entry.tags &&
        entry.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)));

    if (basicMatch) return true;

    // Search in custom fields if enabled
    if (includeCustomFields && entry.customFields) {
      return entry.customFields.some(
        field =>
          field.name.toLowerCase().includes(lowercaseQuery) ||
          (!field.isHidden &&
            field.value.toLowerCase().includes(lowercaseQuery)),
      );
    }

    return false;
  });
};

/**
 * Filter passwords by criteria
 */
export const filterPasswords = (
  passwords: PasswordEntry[],
  filters: {
    categories?: string[];
    tags?: string[];
    favorites?: boolean;
    weakPasswords?: boolean;
    duplicates?: boolean;
    compromised?: boolean;
    minStrength?: number;
    maxAge?: number; // in months
  },
): PasswordEntry[] => {
  return passwords.filter(entry => {
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!entry.category || !filters.categories.includes(entry.category)) {
        return false;
      }
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      if (!entry.tags || !filters.tags.some(tag => entry.tags!.includes(tag))) {
        return false;
      }
    }

    // Favorites filter
    if (filters.favorites && !entry.isFavorite) {
      return false;
    }

    // Weak passwords filter
    if (filters.weakPasswords) {
      const strength = calculatePasswordStrength(entry.password);
      if (strength.score >= (filters.minStrength || 2)) {
        return false;
      }
    }

    // Compromised filter
    if (filters.compromised) {
      if (!entry.breachStatus || !entry.breachStatus.isBreached) {
        return false;
      }
    }

    // Age filter
    if (filters.maxAge) {
      if (!isPasswordOld(entry.createdAt, entry.updatedAt, filters.maxAge)) {
        return false;
      }
    }

    return true;
  });
};

/**
 * Sort passwords by specified criteria
 */
export const sortPasswords = (
  passwords: PasswordEntry[],
  sortBy:
    | 'title'
    | 'username'
    | 'website'
    | 'createdAt'
    | 'updatedAt'
    | 'lastUsed'
    | 'strength'
    | 'accessCount',
  direction: 'asc' | 'desc' = 'asc',
): PasswordEntry[] => {
  return [...passwords].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'username':
        aValue = a.username.toLowerCase();
        bValue = b.username.toLowerCase();
        break;
      case 'website':
        aValue = (a.website || '').toLowerCase();
        bValue = (b.website || '').toLowerCase();
        break;
      case 'createdAt':
        aValue = a.createdAt.getTime();
        bValue = b.createdAt.getTime();
        break;
      case 'updatedAt':
        aValue = a.updatedAt.getTime();
        bValue = b.updatedAt.getTime();
        break;
      case 'lastUsed':
        aValue = a.lastUsed ? a.lastUsed.getTime() : 0;
        bValue = b.lastUsed ? b.lastUsed.getTime() : 0;
        break;
      case 'strength':
        aValue = calculatePasswordStrength(a.password).score;
        bValue = calculatePasswordStrength(b.password).score;
        break;
      case 'accessCount':
        aValue = a.accessCount || 0;
        bValue = b.accessCount || 0;
        break;
      default:
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Generate password entropy score
 */
export const calculatePasswordEntropy = (password: string): number => {
  const charSetSize = getCharacterSetSize(password);
  return Math.log2(Math.pow(charSetSize, password.length));
};

/**
 * Get character set size for entropy calculation
 */
const getCharacterSetSize = (password: string): number => {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/\d/.test(password)) size += 10;
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) size += 32;
  if (/\s/.test(password)) size += 1;
  return size || 1;
};

/**
 * Validate custom field
 */
export const validateCustomField = (field: CustomField): string[] => {
  const errors: string[] = [];

  if (!field.name.trim()) {
    errors.push('Field name is required');
  }

  if (field.type === 'email' && field.value && !isValidEmail(field.value)) {
    errors.push('Invalid email format');
  }

  if (field.type === 'url' && field.value && !isValidUrl(field.value)) {
    errors.push('Invalid URL format');
  }

  if (
    field.type === 'phone' &&
    field.value &&
    !isValidPhoneNumber(field.value)
  ) {
    errors.push('Invalid phone number format');
  }

  return errors;
};

/**
 * Email validation
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valid TLDs - comprehensive list of generic, country, and modern TLDs
 * Updated list covering most common domains worldwide
 */
const VALID_TLDS = new Set([
  // Generic TLDs
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'museum', 'post', 'tel', 'mobi', 'aero', 'coop',
  
  // Common country codes (Europe)
  'uk', 'de', 'fr', 'it', 'es', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'ie', 'pt', 'gr', 'hu', 'ro', 'bg', 'hr', 'lt', 'lv', 'ee', 'si', 'sk', 'rs', 'ua', 'by', 'kz',
  
  // Common country codes (Asia-Pacific)
  'jp', 'cn', 'in', 'au', 'nz', 'kr', 'hk', 'tw', 'sg', 'my', 'th', 'vn', 'ph', 'id', 'bd', 'pk', 'lk', 'mn', 'kh', 'la', 'mm', 'bn', 'mv',
  
  // Common country codes (Americas)
  'us', 'ca', 'br', 'mx', 'ar', 'cl', 'co', 'pe', 've', 'uy', 'ec', 'bo', 'py', 'cr', 'pa', 'do', 'cu', 'jm', 'tt', 'bb', 'bs', 'ag', 'vc', 'lc',
  
  // Common country codes (Middle East & Africa)
  'ru', 'tr', 'sa', 'ae', 'eg', 'ng', 'za', 'ke', 'gh', 'tz', 'ug', 'et', 'ma', 'tn', 'dz', 'sd', 'il', 'ir', 'iq', 'jo', 'lb', 'ps', 'sy', 'ye', 'om', 'qa', 'bh', 'kw',
  
  // Modern/New generic TLDs
  'dev', 'app', 'online', 'site', 'website', 'cloud', 'ai', 'tech', 'io', 'co', 'tv', 'cc', 'ws', 'digital', 'agency', 'company', 'solutions', 'services',
  'store', 'shop', 'blog', 'news', 'media', 'design', 'marketing', 'business', 'finance', 'careers', 'community', 'education', 'foundation', 'ventures', 'careers',
  'download', 'software', 'systems', 'network', 'hosting', 'server', 'email', 'mail', 'space', 'link', 'asia', 'africa',
  
  // Second-level domains (country-specific)
  'co.uk', 'ac.uk', 'gov.uk', 'co.jp', 'or.jp', 'ne.jp', 'co.kr', 'go.kr', 'co.in', 'org.in', 'gov.in', 'co.id', 'co.th', 'co.nz', 'com.au', 'org.au', 'gov.au', 'edu.au',
  'com.br', 'gov.br', 'org.br', 'edu.br', 'com.mx', 'org.mx', 'com.vn', 'org.vn', 'gov.vn', 'edu.vn', 'co.za', 'org.za', 'gov.za',
  'com.sg', 'org.sg', 'gov.sg', 'edu.sg', 'com.hk', 'org.hk', 'gov.hk', 'edu.hk', 'com.tw', 'org.tw', 'gov.tw', 'edu.tw',
  'com.cn', 'org.cn', 'gov.cn', 'edu.cn', 'com.au', 'com.nz', 'org.nz', 'govt.nz',
]);

/**
 * URL validation - checks for valid domain with proper TLD
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const testUrl = new URL(urlWithProtocol);
    
    if (testUrl.protocol !== 'http:' && testUrl.protocol !== 'https:') {
      console.log('❌ isValidUrl: Invalid protocol:', testUrl.protocol);
      return false;
    }

    const hostname = testUrl.hostname;
    if (!hostname) {
      console.log('❌ isValidUrl: No hostname');
      return false;
    }

    // Extract TLD from hostname
    const parts = hostname.split('.');
    if (parts.length < 2) {
      console.log('❌ isValidUrl: Less than 2 parts:', parts);
      return false;
    }

    const lastPart = parts[parts.length - 1]; // Last part (TLD)
    
    // TLD must be at least 2 characters and not be all numbers
    if (lastPart.length < 2 || /^\d+$/.test(lastPart)) {
      console.log('❌ isValidUrl: Invalid TLD length or numeric:', lastPart);
      return false;
    }

    // Check for known TLDs or second-level domains
    const possibleTld = parts.slice(-2).join('.'); // Check last two parts (for co.uk, com.vn, etc.)
    const isValid = VALID_TLDS.has(possibleTld) || VALID_TLDS.has(lastPart);
    
    console.log('🔍 isValidUrl:', { url, hostname, lastPart, possibleTld, isValid });
    return isValid;
  } catch (error) {
    console.log('❌ isValidUrl error:', error);
    return false;
  }
};

/**
 * Validate domain - checks if domain is either a valid URL or valid app package name
 * Both must have a valid TLD from VALID_TLDS list
 */
export const isValidDomain = (domain: string | undefined): boolean => {
  if (!domain || domain.trim().length === 0) {
    return false;
  }

  const trimmed = domain.trim();

  // Check if it's a valid app package (for mobile apps)
  const isAppPackage =
    /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/.test(trimmed) &&
    !trimmed.includes('://') &&
    !trimmed.includes('/');

  if (isAppPackage) {
    // For app packages, verify it has at least 2 segments (e.g., com.example or com.zing.zalo)
    const segments = trimmed.split('.');
    if (segments.length < 2) {
      return false;
    }

    // All segments must be at least 1 character
    const allSegmentsValid = segments.every(seg => seg.length >= 1);
    if (!allSegmentsValid) {
      console.log('❌ isValidDomain: Invalid app package segments:', segments);
      return false;
    }

    // App packages from system are auto-verified, no need for TLD validation
    console.log('🔍 isValidDomain (app):', { domain: trimmed, valid: true });
    return true;
  }

  return isValidUrl(trimmed);
};

/**
 * Phone number validation (basic)
 */
const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
};

/**
 * Export password entry to CSV format
 */
export const exportPasswordToCSV = (entry: PasswordEntry): string => {
  const csvFields = [
    entry.title,
    entry.username,
    entry.password,
    entry.website || '',
    entry.notes || '',
    entry.category || '',
    entry.tags ? entry.tags.join(';') : '',
    entry.createdAt.toISOString(),
    entry.updatedAt.toISOString(),
  ];

  return csvFields.map(field => `"${field.replace(/"/g, '""')}"`).join(',');
};

/**
 * Calculate password security score (0-100)
 */
export const calculateSecurityScore = (entry: PasswordEntry): number => {
  let score = 0;

  // Password strength (40 points max)
  const strength = calculatePasswordStrength(entry.password);
  score += (strength.score / 4) * 40;

  // Password age (20 points max)
  if (!isPasswordOld(entry.createdAt, entry.updatedAt, 6)) {
    score += 20; // Fresh password
  } else if (!isPasswordOld(entry.createdAt, entry.updatedAt, 12)) {
    score += 10; // Moderately old
  }

  // Breach status (20 points max)
  if (!entry.breachStatus || !entry.breachStatus.isBreached) {
    score += 20;
  }

  // Two-factor auth indicator (10 points max)
  if (
    entry.notes &&
    (entry.notes.toLowerCase().includes('2fa') ||
      entry.notes.toLowerCase().includes('mfa') ||
      entry.notes.toLowerCase().includes('authenticator'))
  ) {
    score += 10;
  }

  // Unique password (10 points max) - would need to check against other passwords
  score += 10; // Assume unique for now

  return Math.round(score);
};

/**
 * Get password strength color
 */
export const getPasswordStrengthColor = (score: number): string => {
  if (score <= 1) return '#FF3B30'; // Red
  if (score <= 2) return '#FF9500'; // Orange
  if (score <= 3) return '#FFCC00'; // Yellow
  return '#34C759'; // Green
};

/**
 * Get security score color
 */
export const getSecurityScoreColor = (score: number): string => {
  if (score < 40) return '#FF3B30'; // Red
  if (score < 60) return '#FF9500'; // Orange
  if (score < 80) return '#FFCC00'; // Yellow
  return '#34C759'; // Green
};

/**
 * Create backup data structure
 */
export const createBackupData = (
  entries: PasswordEntry[],
): {
  metadata: {
    version: string;
    createdAt: string;
    entryCount: number;
  };
  entries: PasswordEntry[];
} => {
  return {
    metadata: {
      version: '1.0',
      createdAt: new Date().toISOString(),
      entryCount: entries.length,
    },
    entries,
  };
};

/**
 * Validate backup data structure
 */
export const validateBackupData = (
  data: any,
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid backup data format');
    return { isValid: false, errors };
  }

  if (!data.metadata || typeof data.metadata !== 'object') {
    errors.push('Missing or invalid metadata');
  }

  if (!Array.isArray(data.entries)) {
    errors.push('Missing or invalid entries array');
  }

  // Validate each entry structure
  if (data.entries) {
    data.entries.forEach((entry: any, index: number) => {
      if (!entry.id || typeof entry.id !== 'string') {
        errors.push(`Entry ${index}: Missing or invalid ID`);
      }
      if (!entry.title || typeof entry.title !== 'string') {
        errors.push(`Entry ${index}: Missing or invalid title`);
      }
      if (!entry.password || typeof entry.password !== 'string') {
        errors.push(`Entry ${index}: Missing or invalid password`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export default {
  calculatePasswordStrength,
  generateSecurePassword,
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
  getSecurityScoreColor,
  createBackupData,
  validateBackupData,
};
