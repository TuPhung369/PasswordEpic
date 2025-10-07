import CryptoJS from 'crypto-js';

/**
 * Password pattern analysis and generation service
 */
export class PasswordPatternService {
  private static readonly COMMON_PATTERNS = [
    /^[a-z]+$/, // all lowercase
    /^[A-Z]+$/, // all uppercase
    /^[0-9]+$/, // all numbers
    /^[a-zA-Z]+$/, // letters only
    /^[a-zA-Z0-9]+$/, // letters and numbers
    /^[a-z]+[0-9]+$/, // lowercase then numbers
    /^[A-Z][a-z]+[0-9]+$/, // title case then numbers
    /^.*(123|abc|qwe|password|admin|user)/i, // common sequences
  ];

  private static readonly KEYBOARD_PATTERNS = [
    'qwerty',
    'asdf',
    'zxcv',
    '1234',
    '4321',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    '1234567890',
    '0987654321',
  ];

  private static readonly SYLLABLE_PATTERNS = {
    consonants: 'bcdfghjklmnpqrstvwxyz',
    vowels: 'aeiou',
    digraphs: ['ch', 'sh', 'th', 'ph', 'wh', 'ck', 'ng'],
    common_endings: ['ing', 'tion', 'sion', 'ed', 'er', 'ly'],
  };

  /**
   * Detect common patterns in password
   */
  static detectPatterns(password: string): {
    hasCommonPattern: boolean;
    hasKeyboardPattern: boolean;
    hasRepeatingChars: boolean;
    hasSequence: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];
    let hasCommonPattern = false;
    let hasKeyboardPattern = false;
    let hasRepeatingChars = false;
    let hasSequence = false;

    // Check common patterns
    for (const pattern of this.COMMON_PATTERNS) {
      if (pattern.test(password)) {
        hasCommonPattern = true;
        patterns.push('Common pattern detected');
        break;
      }
    }

    // Check keyboard patterns
    const lowerPassword = password.toLowerCase();
    for (const kbPattern of this.KEYBOARD_PATTERNS) {
      if (lowerPassword.includes(kbPattern)) {
        hasKeyboardPattern = true;
        patterns.push(`Keyboard pattern: ${kbPattern}`);
      }
    }

    // Check repeating characters
    const repeatingMatch = password.match(/(.)\1{2,}/);
    if (repeatingMatch) {
      hasRepeatingChars = true;
      patterns.push(`Repeating character: ${repeatingMatch[1]}`);
    }

    // Check sequences (abc, 123, etc.)
    hasSequence = this.hasSequentialChars(password);
    if (hasSequence) {
      patterns.push('Sequential characters detected');
    }

    return {
      hasCommonPattern,
      hasKeyboardPattern,
      hasRepeatingChars,
      hasSequence,
      patterns,
    };
  }

  /**
   * Check for sequential characters
   */
  private static hasSequentialChars(password: string): boolean {
    for (let i = 0; i < password.length - 2; i++) {
      const char1 = password.charCodeAt(i);
      const char2 = password.charCodeAt(i + 1);
      const char3 = password.charCodeAt(i + 2);

      // Check ascending sequence
      if (char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }

      // Check descending sequence
      if (char2 === char1 - 1 && char3 === char2 - 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate pattern-based password templates
   */
  static generatePatternTemplates(): Array<{
    name: string;
    pattern: string;
    description: string;
    example: string;
  }> {
    return [
      {
        name: 'Word-Number-Symbol',
        pattern: 'Lllllll-nnnn-s',
        description: 'Memorable word + numbers + symbol',
        example: 'Rainbow-2024-!',
      },
      {
        name: 'Initials-Year-Special',
        pattern: 'LL-nnnn-ss',
        description: 'Initials + year + symbols',
        example: 'JD-2024-@#',
      },
      {
        name: 'Mixed Case',
        pattern: 'LlLlLlLl-nnnn',
        description: 'Alternating case + numbers',
        example: 'PaSwOrD-1234',
      },
      {
        name: 'Syllable Pattern',
        pattern: 'CvCvCv-nnn',
        description: 'Consonant-vowel syllables + numbers',
        example: 'BaKeMo-789',
      },
      {
        name: 'Strong Mixed',
        pattern: 'LlllnLlllnsLlll',
        description: 'Random strong pattern',
        example: 'Pass5Word9!Safe',
      },
    ];
  }

  /**
   * Generate pronounceable password using advanced syllable patterns
   */
  static generateAdvancedPronounceablePassword(
    length: number,
    options: {
      includeNumbers?: boolean;
      includeSymbols?: boolean;
      capitalizeFirst?: boolean;
      useDiagraphs?: boolean;
    } = {},
  ): string {
    const {
      includeNumbers = true,
      includeSymbols = false,
      capitalizeFirst = true,
      useDiagraphs = true,
    } = options;

    let password = '';
    let remaining = length;
    const randomBytes = CryptoJS.lib.WordArray.random(length * 8);
    let byteIndex = 0;

    const getRandomFromArray = (array: string | string[]): string => {
      const randomIndex =
        Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
        array.length;
      byteIndex++;
      return Array.isArray(array) ? array[randomIndex] : array[randomIndex];
    };

    // Generate syllables
    while (remaining > 0) {
      let syllable = '';

      // Maybe use digraph
      if (useDiagraphs && remaining >= 4 && Math.random() > 0.7) {
        syllable = getRandomFromArray(this.SYLLABLE_PATTERNS.digraphs);
        remaining -= syllable.length;
      } else {
        // Standard consonant-vowel pattern
        if (remaining >= 2) {
          const consonant = getRandomFromArray(
            this.SYLLABLE_PATTERNS.consonants,
          );
          const vowel = getRandomFromArray(this.SYLLABLE_PATTERNS.vowels);
          syllable = consonant + vowel;
          remaining -= 2;
        } else if (remaining === 1) {
          syllable = getRandomFromArray(this.SYLLABLE_PATTERNS.vowels);
          remaining -= 1;
        }
      }

      password += syllable;

      // Add ending if we're near the end and have space
      if (remaining <= 3 && remaining > 0 && Math.random() > 0.8) {
        const ending = this.SYLLABLE_PATTERNS.common_endings.find(
          e => e.length <= remaining,
        );
        if (ending) {
          password += ending;
          remaining -= ending.length;
        }
      }
    }

    // Capitalize first letter
    if (capitalizeFirst && password.length > 0) {
      password = password[0].toUpperCase() + password.slice(1);
    }

    // Insert numbers
    if (includeNumbers) {
      const numberCount = Math.min(2, Math.floor(password.length * 0.2));
      for (let i = 0; i < numberCount; i++) {
        const pos =
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
          password.length;
        byteIndex++;
        const num =
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
          10;
        byteIndex++;
        password = password.slice(0, pos) + num + password.slice(pos);
      }
    }

    // Insert symbols
    if (includeSymbols) {
      const symbols = '!@#$%&*';
      const symbolCount = Math.min(1, Math.floor(password.length * 0.1));
      for (let i = 0; i < symbolCount; i++) {
        const pos =
          Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
          password.length;
        byteIndex++;
        const sym = getRandomFromArray(symbols);
        password = password.slice(0, pos) + sym + password.slice(pos);
      }
    }

    return password.slice(0, length);
  }

  /**
   * Analyze password entropy and complexity
   */
  static analyzePasswordComplexity(password: string): {
    entropy: number;
    characterSetSize: number;
    patterns: ReturnType<typeof PasswordPatternService.detectPatterns>;
    complexity: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
    suggestions: string[];
  } {
    const characterSetSize = this.calculateCharacterSetSize(password);
    const entropy = Math.log2(Math.pow(characterSetSize, password.length));
    const patterns = this.detectPatterns(password);

    let complexity: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' =
      'medium';
    const suggestions: string[] = [];

    // Determine complexity based on entropy and patterns
    if (entropy < 30 || patterns.hasCommonPattern) {
      complexity = 'very_low';
      suggestions.push('Use a longer password with mixed characters');
    } else if (entropy < 50 || patterns.hasKeyboardPattern) {
      complexity = 'low';
      suggestions.push('Avoid keyboard patterns and common sequences');
    } else if (entropy < 70 || patterns.hasSequence) {
      complexity = 'medium';
      suggestions.push('Add more character variety');
    } else if (entropy < 90) {
      complexity = 'high';
      suggestions.push('Consider adding special characters');
    } else {
      complexity = 'very_high';
    }

    // Additional suggestions based on patterns
    if (patterns.hasRepeatingChars) {
      suggestions.push('Avoid repeating characters');
    }

    if (password.length < 12) {
      suggestions.push('Use at least 12 characters');
    }

    if (!/[A-Z]/.test(password)) {
      suggestions.push('Add uppercase letters');
    }

    if (!/[a-z]/.test(password)) {
      suggestions.push('Add lowercase letters');
    }

    if (!/[0-9]/.test(password)) {
      suggestions.push('Add numbers');
    }

    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
      suggestions.push('Add symbols');
    }

    return {
      entropy,
      characterSetSize,
      patterns,
      complexity,
      suggestions,
    };
  }

  /**
   * Calculate character set size for entropy calculation
   */
  private static calculateCharacterSetSize(password: string): number {
    let size = 0;
    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/[0-9]/.test(password)) size += 10;
    if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) size += 32;
    if (/\s/.test(password)) size += 1;
    // Count any other unique characters
    const otherChars = password.replace(
      /[a-zA-Z0-9!@#$%^&*()_+\-=[\]{}|;:,.<>?\s]/g,
      '',
    );
    size += new Set(otherChars).size;
    return size || 1;
  }

  /**
   * Generate secure passphrase from word list
   */
  static generatePassphrase(
    wordCount: number = 4,
    separator: string = '-',
    includeNumbers: boolean = true,
    capitalizeWords: boolean = true,
  ): string {
    // Simple word list - in production, you'd use a larger dictionary
    const words = [
      'apple',
      'brave',
      'cloud',
      'dream',
      'eagle',
      'flame',
      'grace',
      'heart',
      'island',
      'jungle',
      'knight',
      'lemon',
      'magic',
      'night',
      'ocean',
      'peace',
      'quick',
      'river',
      'storm',
      'tiger',
      'unity',
      'voice',
      'water',
      'xenon',
      'yellow',
      'zebra',
      'action',
      'bridge',
      'circle',
      'dragon',
      'energy',
      'forest',
      'golden',
      'hammer',
      'impact',
      'jacket',
      'kernel',
      'ladder',
      'marble',
      'nature',
      'orange',
      'planet',
      'quartz',
      'rabbit',
      'silver',
      'temple',
      'united',
      'violet',
      'window',
      'xylem',
      'yogurt',
      'zephyr',
    ];

    const randomBytes = CryptoJS.lib.WordArray.random(wordCount * 4);
    const selectedWords: string[] = [];

    for (let i = 0; i < wordCount; i++) {
      const randomIndex =
        Math.abs(randomBytes.words[i % randomBytes.words.length]) %
        words.length;
      let word = words[randomIndex];

      if (capitalizeWords) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }

      selectedWords.push(word);
    }

    let passphrase = selectedWords.join(separator);

    // Add numbers if requested
    if (includeNumbers) {
      const numberBytes = CryptoJS.lib.WordArray.random(8);
      const number = (Math.abs(numberBytes.words[0]) % 9999) + 1;
      passphrase += separator + number.toString().padStart(2, '0');
    }

    return passphrase;
  }

  /**
   * Generate password based on custom pattern with advanced features
   */
  static generateFromAdvancedPattern(
    pattern: string,
    options: {
      excludeSimilar?: boolean;
      customCharSets?: Record<string, string>;
      enforceMinimums?: {
        numbers?: number;
        symbols?: number;
        uppercase?: number;
        lowercase?: number;
      };
    } = {},
  ): string {
    const {
      excludeSimilar = true,
      customCharSets = {},
      enforceMinimums,
    } = options;

    const defaultCharSets = {
      L: excludeSimilar
        ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      l: excludeSimilar
        ? 'abcdefghijkmnopqrstuvwxyz'
        : 'abcdefghijklmnopqrstuvwxyz',
      n: excludeSimilar ? '23456789' : '0123456789',
      s: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      w: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // Word character (any case)
      d: '0123456789', // Digit
      p: '!@#$%&*', // Punctuation (safe symbols)
      h: '0123456789ABCDEF', // Hexadecimal
      b: '01', // Binary
      o: '01234567', // Octal
    };

    const charSets = { ...defaultCharSets, ...customCharSets };
    const randomBytes = CryptoJS.lib.WordArray.random(pattern.length * 4);
    let password = '';

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      const charset = charSets[char];

      if (charset) {
        const randomIndex =
          Math.abs(randomBytes.words[i % randomBytes.words.length]) %
          charset.length;
        password += charset[randomIndex];
      } else {
        // Literal character
        password += char;
      }
    }

    // Enforce minimum requirements if specified
    if (enforceMinimums) {
      password = this.enforcePasswordMinimums(password, enforceMinimums);
    }

    return password;
  }

  /**
   * Enforce minimum character requirements
   */
  private static enforcePasswordMinimums(
    password: string,
    minimums: {
      numbers?: number;
      symbols?: number;
      uppercase?: number;
      lowercase?: number;
    },
  ): string {
    let result = password;
    const randomBytes = CryptoJS.lib.WordArray.random(32);
    let byteIndex = 0;

    // Helper function to count character types
    const counts = {
      numbers: (result.match(/[0-9]/g) || []).length,
      symbols: (result.match(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/g) || []).length,
      uppercase: (result.match(/[A-Z]/g) || []).length,
      lowercase: (result.match(/[a-z]/g) || []).length,
    };

    // Add missing characters by replacing existing ones
    Object.entries(minimums).forEach(([type, minimum]) => {
      if (minimum && counts[type as keyof typeof counts] < minimum) {
        const needed = minimum - counts[type as keyof typeof counts];
        const charSets = {
          numbers: '0123456789',
          symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
          uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          lowercase: 'abcdefghijklmnopqrstuvwxyz',
        };

        for (let i = 0; i < needed && i < result.length; i++) {
          const charset = charSets[type as keyof typeof charSets];
          const randomCharIndex =
            Math.abs(randomBytes.words[byteIndex % randomBytes.words.length]) %
            charset.length;
          const randomPosIndex =
            Math.abs(
              randomBytes.words[(byteIndex + 1) % randomBytes.words.length],
            ) % result.length;

          result =
            result.slice(0, randomPosIndex) +
            charset[randomCharIndex] +
            result.slice(randomPosIndex + 1);
          byteIndex += 2;
        }
      }
    });

    return result;
  }
}
