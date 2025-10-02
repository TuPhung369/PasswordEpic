import { PasswordStrengthResult, PasswordEntry } from '../types/password';

// Common weak passwords (subset for performance)
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '123456789',
  'password123',
  'admin',
  'qwerty',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'abc123',
  '111111',
  'dragon',
  'master',
  'login',
  'pass',
  'football',
  'baseball',
  'superman',
  'access',
  'shadow',
  'trustno1',
  '654321',
  'jordan23',
  'harley',
  'password1',
  '000000',
  'starwars',
  'klaster',
  'princess',
  'qwerty123',
  'solo',
  'changeme',
  'computer',
  'mickey',
  'cheese',
]);

// Common patterns that reduce password strength
const WEAK_PATTERNS = [
  /^(.)\1{2,}$/, // Repeated characters (aaa, 111)
  /^(..)\1+$/, // Repeated pairs (abab, 1212)
  /^123+|^abc+|^qwe+/i, // Sequential characters
  /^password/i, // Starts with "password"
  /^\d+$/, // Only numbers
  /^[a-z]+$/i, // Only letters
  /^(.{1,3})\1+$/, // Short repeated patterns
];

// Symbol regex pattern for consistency
const SYMBOLS_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/;

export class PasswordValidationService {
  /**
   * Analyzes password strength with detailed feedback
   */
  public static analyzePasswordStrength(
    password: string,
  ): PasswordStrengthResult {
    if (!password || password.length === 0) {
      return {
        score: 0,
        label: 'No Password',
        color: '#FF3B30',
        feedback: ['Password is required'],
        crackTime: 'Instant',
      };
    }

    const analysis = this.performAnalysis(password);
    const score = this.calculateScore(analysis);
    const label = this.getStrengthLabel(score);
    const color = this.getStrengthColor(score);
    const feedback = this.generateFeedback(analysis);
    const crackTime = this.estimateCrackTime(analysis);

    return {
      score,
      label,
      color,
      feedback,
      crackTime,
    };
  }

  /**
   * Checks if password is commonly used
   */
  public static isCommonPassword(password: string): boolean {
    const normalizedPassword = password.toLowerCase().trim();
    return COMMON_PASSWORDS.has(normalizedPassword);
  }

  /**
   * Detects weak patterns in password
   */
  public static hasWeakPatterns(password: string): string[] {
    const weakPatterns: string[] = [];

    for (const pattern of WEAK_PATTERNS) {
      if (pattern.test(password)) {
        if (pattern.source.includes('(.)\\1{2,}')) {
          weakPatterns.push('Contains repeated characters');
        } else if (pattern.source.includes('(..)\\1+')) {
          weakPatterns.push('Contains repeated character pairs');
        } else if (pattern.source.includes('123+|abc+|qwe+')) {
          weakPatterns.push('Contains sequential characters');
        } else if (pattern.source.includes('password')) {
          weakPatterns.push('Contains common word "password"');
        } else if (pattern.source.includes('^\\d+$')) {
          weakPatterns.push('Contains only numbers');
        } else if (pattern.source.includes('^[a-z]+$')) {
          weakPatterns.push('Contains only letters');
        } else if (pattern.source.includes('(.{1,3})\\1+')) {
          weakPatterns.push('Contains short repeated patterns');
        }
      }
    }

    return weakPatterns;
  }

  /**
   * Validates password against multiple criteria
   */
  public static validatePassword(
    password: string,
    requirements?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSymbols?: boolean;
      minScore?: number;
    },
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const reqs = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      minScore: 2,
      ...requirements,
    };

    // Length check
    if (password.length < reqs.minLength) {
      errors.push(
        `Password must be at least ${reqs.minLength} characters long`,
      );
    }

    // Character requirements
    if (reqs.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (reqs.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (reqs.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (reqs.requireSymbols && !SYMBOLS_REGEX.test(password)) {
      errors.push('Password must contain at least one symbol');
    }

    // Strength check
    const strength = this.analyzePasswordStrength(password);
    if (strength.score < reqs.minScore) {
      errors.push(`Password strength is too weak (${strength.label})`);
    }

    // Common password check
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Checks for password reuse within a collection
   */
  public static findDuplicatePasswords(
    entries: PasswordEntry[],
  ): Map<string, PasswordEntry[]> {
    const duplicates = new Map<string, PasswordEntry[]>();

    for (const entry of entries) {
      const password = entry.password;
      if (!duplicates.has(password)) {
        duplicates.set(password, []);
      }
      duplicates.get(password)!.push(entry);
    }

    // Filter to only include actual duplicates
    for (const [password, entryList] of duplicates.entries()) {
      if (entryList.length < 2) {
        duplicates.delete(password);
      }
    }

    return duplicates;
  }

  /**
   * Identifies weak passwords in a collection
   */
  public static findWeakPasswords(
    entries: PasswordEntry[],
    minScore: number = 2,
  ): PasswordEntry[] {
    return entries.filter(entry => {
      const strength = this.analyzePasswordStrength(entry.password);
      return strength.score < minScore;
    });
  }

  /**
   * Generates security recommendations for password collection
   */
  public static generateSecurityRecommendations(entries: PasswordEntry[]): {
    criticalIssues: string[];
    recommendations: string[];
    stats: {
      total: number;
      weak: number;
      duplicates: number;
      common: number;
      old: number;
    };
  } {
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];
    const duplicates = this.findDuplicatePasswords(entries);
    const weakPasswords = this.findWeakPasswords(entries);
    const commonPasswords = entries.filter(entry =>
      this.isCommonPassword(entry.password),
    );

    // Old passwords (over 1 year without change)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oldPasswords = entries.filter(
      entry => entry.updatedAt < oneYearAgo && entry.createdAt < oneYearAgo,
    );

    // Critical issues
    if (duplicates.size > 0) {
      criticalIssues.push(
        `${duplicates.size} passwords are reused across multiple accounts`,
      );
    }

    if (commonPasswords.length > 0) {
      criticalIssues.push(
        `${commonPasswords.length} accounts use common, easily guessable passwords`,
      );
    }

    if (weakPasswords.length > entries.length * 0.3) {
      criticalIssues.push(
        `${Math.round(
          (weakPasswords.length / entries.length) * 100,
        )}% of passwords are weak`,
      );
    }

    // Recommendations
    if (weakPasswords.length > 0) {
      recommendations.push(`Strengthen ${weakPasswords.length} weak passwords`);
    }

    if (duplicates.size > 0) {
      recommendations.push('Use unique passwords for each account');
    }

    if (oldPasswords.length > 0) {
      recommendations.push(
        `Update ${oldPasswords.length} passwords that haven't been changed in over a year`,
      );
    }

    if (entries.length > 0) {
      const avgStrength =
        entries.reduce((sum, entry) => {
          const strength = this.analyzePasswordStrength(entry.password);
          return sum + strength.score;
        }, 0) / entries.length;

      if (avgStrength < 3) {
        recommendations.push(
          'Improve overall password strength across all accounts',
        );
      }
    }

    return {
      criticalIssues,
      recommendations,
      stats: {
        total: entries.length,
        weak: weakPasswords.length,
        duplicates: duplicates.size,
        common: commonPasswords.length,
        old: oldPasswords.length,
      },
    };
  }

  // Private helper methods
  private static performAnalysis(password: string) {
    const analysis = {
      length: password.length,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSymbols: SYMBOLS_REGEX.test(password),
      hasSpaces: /\s/.test(password),
      isCommon: this.isCommonPassword(password),
      weakPatterns: this.hasWeakPatterns(password),
      entropy: this.calculateEntropy(password),
      characterSets: 0,
    };

    // Count character sets
    if (analysis.hasLowercase) analysis.characterSets++;
    if (analysis.hasUppercase) analysis.characterSets++;
    if (analysis.hasNumbers) analysis.characterSets++;
    if (analysis.hasSymbols) analysis.characterSets++;
    if (analysis.hasSpaces) analysis.characterSets++;

    return analysis;
  }

  private static calculateScore(analysis: any): number {
    let score = 0;

    // Length scoring (0-2 points)
    if (analysis.length >= 12) score += 2;
    else if (analysis.length >= 8) score += 1;

    // Character diversity (0-2 points)
    if (analysis.characterSets >= 4) score += 2;
    else if (analysis.characterSets >= 3) score += 1;

    // Entropy bonus (0-1 point)
    if (analysis.entropy > 50) score += 1;

    // Penalties
    if (analysis.isCommon) score = Math.max(0, score - 2);
    if (analysis.weakPatterns.length > 0) score = Math.max(0, score - 1);
    if (analysis.length < 6) score = 0;

    return Math.min(4, Math.max(0, score));
  }

  private static getStrengthLabel(score: number): string {
    switch (score) {
      case 0:
        return 'Very Weak';
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      default:
        return 'Unknown';
    }
  }

  private static getStrengthColor(score: number): string {
    switch (score) {
      case 0:
        return '#FF3B30'; // Red
      case 1:
        return '#FF9500'; // Orange
      case 2:
        return '#FFCC00'; // Yellow
      case 3:
        return '#30D158'; // Light Green
      case 4:
        return '#34C759'; // Green
      default:
        return '#8E8E93'; // Gray
    }
  }

  private static generateFeedback(analysis: any): string[] {
    const feedback: string[] = [];

    if (analysis.length < 8) {
      feedback.push('Use at least 8 characters');
    } else if (analysis.length < 12) {
      feedback.push('Consider using 12+ characters for better security');
    }

    if (!analysis.hasLowercase) {
      feedback.push('Add lowercase letters');
    }

    if (!analysis.hasUppercase) {
      feedback.push('Add uppercase letters');
    }

    if (!analysis.hasNumbers) {
      feedback.push('Add numbers');
    }

    if (!analysis.hasSymbols) {
      feedback.push('Add symbols for extra security');
    }

    if (analysis.isCommon) {
      feedback.push('Avoid common passwords');
    }

    if (analysis.weakPatterns.length > 0) {
      feedback.push(
        ...analysis.weakPatterns.map(pattern => `Avoid: ${pattern}`),
      );
    }

    if (feedback.length === 0) {
      feedback.push('Excellent password strength!');
    }

    return feedback;
  }

  private static estimateCrackTime(analysis: any): string {
    const { entropy, isCommon, weakPatterns } = analysis;

    if (isCommon || weakPatterns.length > 0) {
      return 'Less than 1 second';
    }

    // Simplified crack time estimation based on entropy
    if (entropy < 20) return 'Less than 1 minute';
    if (entropy < 30) return 'Minutes to hours';
    if (entropy < 40) return 'Hours to days';
    if (entropy < 50) return 'Days to months';
    if (entropy < 60) return 'Months to years';
    if (entropy < 70) return 'Years to decades';
    return 'Centuries or more';
  }

  private static calculateEntropy(password: string): number {
    const charSetSize = this.getCharacterSetSize(password);
    return Math.log2(Math.pow(charSetSize, password.length));
  }

  private static getCharacterSetSize(password: string): number {
    let size = 0;

    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/\d/.test(password)) size += 10;
    if (SYMBOLS_REGEX.test(password)) size += 32;
    if (/\s/.test(password)) size += 1;

    return size || 1; // Minimum 1 to avoid division by zero
  }
}

export default PasswordValidationService;
