import { generateSecurePassword } from '../utils/passwordUtils';
import {
  PasswordGeneratorOptions,
  PasswordStrengthResult,
} from '../types/password';
import { calculatePasswordStrength } from '../utils/passwordUtils';

export interface PasswordTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  options: PasswordGeneratorOptions;
  category: 'security' | 'usability' | 'specific';
  examples: string[];
}

export interface GeneratorPreset {
  id: string;
  name: string;
  description: string;
  options: PasswordGeneratorOptions;
  color: string;
}

export interface GenerationHistory {
  id: string;
  password: string;
  timestamp: Date;
  options: PasswordGeneratorOptions;
  strength: PasswordStrengthResult;
  isFavorite: boolean;
  templateUsed?: string;
}

export class PasswordGeneratorService {
  private static instance: PasswordGeneratorService;
  private generationHistory: GenerationHistory[] = [];
  private maxHistorySize = 50;

  public static getInstance(): PasswordGeneratorService {
    if (!PasswordGeneratorService.instance) {
      PasswordGeneratorService.instance = new PasswordGeneratorService();
    }
    return PasswordGeneratorService.instance;
  }

  // Predefined templates for different use cases
  public getTemplates(): PasswordTemplate[] {
    return [
      {
        id: 'banking',
        name: 'Banking & Finance',
        description: 'Ultra-secure passwords for financial accounts',
        icon: 'account-balance',
        category: 'security',
        options: {
          length: 16,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 3,
          minSymbols: 2,
        },
        examples: ['K9#mP2$rL4xN8@qW', 'R7&nQ3!sM5yT9#eA'],
      },
      {
        id: 'social',
        name: 'Social Media',
        description: 'Memorable yet secure for social platforms',
        icon: 'people',
        category: 'usability',
        options: {
          length: 12,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: false,
          minNumbers: 2,
        },
        examples: ['BrightSun42Me', 'Ocean7Wave3'],
      },
      {
        id: 'email',
        name: 'Email Accounts',
        description: 'Strong passwords for email security',
        icon: 'email',
        category: 'security',
        options: {
          length: 14,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
          minSymbols: 1,
        },
        examples: ['Mail9#Secure2K', 'Inbox4$Safe7T'],
      },
      {
        id: 'wifi',
        name: 'WiFi Network',
        description: 'Easy to type and share WiFi passwords',
        icon: 'wifi',
        category: 'usability',
        options: {
          length: 10,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
        },
        examples: ['HomeNet2024', 'GuestWifi99'],
      },
      {
        id: 'gaming',
        name: 'Gaming Accounts',
        description: 'Fun yet secure for gaming platforms',
        icon: 'games',
        category: 'usability',
        options: {
          length: 13,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: false,
          excludeAmbiguous: false,
          minNumbers: 2,
          minSymbols: 1,
        },
        examples: ['Player1*Best', 'Game7#Hero9'],
      },
      {
        id: 'work',
        name: 'Work & Corporate',
        description: 'Professional passwords for work accounts',
        icon: 'work',
        category: 'security',
        options: {
          length: 15,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
          minSymbols: 2,
        },
        examples: ['Work2024#Safe!', 'Corp9$Secure@'],
      },
      {
        id: 'memorable',
        name: 'Memorable',
        description: 'Easy to remember patterns',
        icon: 'psychology',
        category: 'usability',
        options: {
          length: 11,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
        },
        examples: ['BlueSky2024', 'RedCar789Go'],
      },
      {
        id: 'maximum',
        name: 'Maximum Security',
        description: 'Highest security for critical accounts',
        icon: 'security',
        category: 'security',
        options: {
          length: 20,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 4,
          minSymbols: 3,
        },
        examples: ['X9#mK2$rQ7!nP5@wL4&z', 'A8%nM3*sR6#qT9$eY2!u'],
      },
    ];
  }

  // Quick presets for common scenarios
  public getPresets(): GeneratorPreset[] {
    return [
      {
        id: 'quick-strong',
        name: 'Strong',
        description: 'Balanced security and usability',
        color: '#34C759',
        options: {
          length: 12,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: false,
          minNumbers: 2,
          minSymbols: 1,
        },
      },
      {
        id: 'quick-secure',
        name: 'Ultra Secure',
        description: 'Maximum security protection',
        color: '#FF3B30',
        options: {
          length: 16,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 3,
          minSymbols: 2,
        },
      },
      {
        id: 'quick-simple',
        name: 'Simple',
        description: 'Easy to type and remember',
        color: '#007AFF',
        options: {
          length: 10,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 2,
        },
      },
      {
        id: 'quick-pin',
        name: 'PIN Code',
        description: 'Numeric PIN for quick access',
        color: '#FF9500',
        options: {
          length: 6,
          includeUppercase: false,
          includeLowercase: false,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: false,
          excludeAmbiguous: false,
        },
      },
    ];
  }

  // Generate password using specified options
  public async generatePassword(
    options: PasswordGeneratorOptions,
    templateId?: string,
  ): Promise<{ password: string; strength: PasswordStrengthResult }> {
    try {
      const password = generateSecurePassword(options);
      const strength = calculatePasswordStrength(password);

      // Add to history
      const historyEntry: GenerationHistory = {
        id: this.generateId(),
        password,
        timestamp: new Date(),
        options: { ...options },
        strength,
        isFavorite: false,
        templateUsed: templateId,
      };

      this.addToHistory(historyEntry);

      return { password, strength };
    } catch (error) {
      console.error('Error generating password:', error);
      throw new Error('Failed to generate password');
    }
  }

  // Generate multiple passwords for comparison
  public async generateMultiple(
    options: PasswordGeneratorOptions,
    count: number = 5,
  ): Promise<Array<{ password: string; strength: PasswordStrengthResult }>> {
    const passwords: Array<{
      password: string;
      strength: PasswordStrengthResult;
    }> = [];

    for (let i = 0; i < count; i++) {
      const result = await this.generatePassword(options);
      passwords.push(result);
    }

    return passwords;
  }

  // Generate pronounceable passwords
  public generatePronounceablePassword(length: number = 12): string {
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    const vowels = 'aeiou';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';

    let password = '';
    let useConsonant = Math.random() > 0.5;

    for (let i = 0; i < length; i++) {
      if (i > 0 && i % 4 === 0) {
        // Add number or symbol occasionally
        if (Math.random() > 0.7) {
          password +=
            Math.random() > 0.5
              ? numbers.charAt(Math.floor(Math.random() * numbers.length))
              : symbols.charAt(Math.floor(Math.random() * symbols.length));
          continue;
        }
      }

      if (useConsonant) {
        let char = consonants.charAt(
          Math.floor(Math.random() * consonants.length),
        );
        if (i === 0 || Math.random() > 0.7) {
          char = char.toUpperCase();
        }
        password += char;
      } else {
        password += vowels.charAt(Math.floor(Math.random() * vowels.length));
      }

      useConsonant = !useConsonant;
    }

    return password;
  }

  // Generate pattern-based passwords (e.g., Word-Number-Symbol-Word)
  public generatePatternPassword(pattern: string): string {
    const words = [
      'Sun',
      'Moon',
      'Star',
      'Ocean',
      'Mountain',
      'River',
      'Forest',
      'Sky',
      'Wind',
      'Fire',
    ];
    const numbers = '123456789';
    const symbols = '!@#$%^&*';

    return pattern
      .replace(/W/g, () => words[Math.floor(Math.random() * words.length)])
      .replace(/w/g, () =>
        words[Math.floor(Math.random() * words.length)].toLowerCase(),
      )
      .replace(/N/g, () =>
        numbers.charAt(Math.floor(Math.random() * numbers.length)),
      )
      .replace(/S/g, () =>
        symbols.charAt(Math.floor(Math.random() * symbols.length)),
      )
      .replace(/D/g, () => Math.floor(Math.random() * 100).toString());
  }

  // History management
  public getHistory(): GenerationHistory[] {
    return [...this.generationHistory].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  public addToHistory(entry: GenerationHistory): void {
    this.generationHistory.unshift(entry);

    // Keep only the most recent entries
    if (this.generationHistory.length > this.maxHistorySize) {
      this.generationHistory = this.generationHistory.slice(
        0,
        this.maxHistorySize,
      );
    }
  }

  public toggleFavorite(entryId: string): void {
    const entry = this.generationHistory.find(e => e.id === entryId);
    if (entry) {
      entry.isFavorite = !entry.isFavorite;
    }
  }

  public removeFromHistory(entryId: string): void {
    this.generationHistory = this.generationHistory.filter(
      e => e.id !== entryId,
    );
  }

  public clearHistory(): void {
    this.generationHistory = [];
  }

  public getFavorites(): GenerationHistory[] {
    return this.generationHistory.filter(entry => entry.isFavorite);
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Export history for backup
  public exportHistory(): string {
    return JSON.stringify(
      {
        version: '1.0',
        timestamp: new Date().toISOString(),
        history: this.generationHistory,
      },
      null,
      2,
    );
  }

  // Import history from backup
  public importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.history && Array.isArray(parsed.history)) {
        this.generationHistory = parsed.history.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing history:', error);
      return false;
    }
  }
}

export const passwordGeneratorService = PasswordGeneratorService.getInstance();
