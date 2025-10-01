import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PasswordEntry,
  EncryptedPasswordEntry,
  PasswordCategory,
} from '../types/password';
import {
  encryptData,
  decryptData,
  generateSecureRandom,
  deriveKeyFromPassword,
} from './cryptoService';
import { getMasterPasswordHash } from './secureStorageService';

const PASSWORDS_STORAGE_KEY = 'encrypted_passwords';
const CATEGORIES_STORAGE_KEY = 'password_categories';

export class EncryptedDatabaseService {
  private static instance: EncryptedDatabaseService;
  private masterPasswordHash: string | null = null;

  private constructor() {}

  public static getInstance(): EncryptedDatabaseService {
    if (!EncryptedDatabaseService.instance) {
      EncryptedDatabaseService.instance = new EncryptedDatabaseService();
    }
    return EncryptedDatabaseService.instance;
  }

  /**
   * Initialize the database service with master password
   */
  public async initialize(_masterPassword: string): Promise<void> {
    try {
      this.masterPasswordHash = await getMasterPasswordHash();
      if (!this.masterPasswordHash) {
        throw new Error('Master password not configured');
      }
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  /**
   * Encrypt and store a password entry
   */
  public async savePasswordEntry(
    entry: PasswordEntry,
    masterPassword: string,
  ): Promise<void> {
    try {
      // Generate unique salt and IV for this entry
      const salt = generateSecureRandom(32);
      const iv = generateSecureRandom(16);

      // Derive key from master password and salt
      const derivedKey = deriveKeyFromPassword(masterPassword, salt);

      // Encrypt the password entry
      const encryptedResult = encryptData(
        JSON.stringify(entry),
        derivedKey,
        iv,
      );

      const encryptedEntry: EncryptedPasswordEntry = {
        id: entry.id,
        encryptedData: encryptedResult.ciphertext,
        salt: salt,
        iv: encryptedResult.iv,
        authTag: encryptedResult.tag,
        createdAt: entry.createdAt,
        updatedAt: new Date(),
      };

      // Get existing entries
      const existingEntries = await this.getAllEncryptedEntries();

      // Update or add the entry
      const updatedEntries = existingEntries.filter(e => e.id !== entry.id);
      updatedEntries.push(encryptedEntry);

      // Save back to storage
      await AsyncStorage.setItem(
        PASSWORDS_STORAGE_KEY,
        JSON.stringify(updatedEntries),
      );
    } catch (error) {
      throw new Error(`Failed to save password entry: ${error}`);
    }
  }

  /**
   * Decrypt and retrieve a password entry by ID
   */
  public async getPasswordEntry(
    id: string,
    masterPassword: string,
  ): Promise<PasswordEntry | null> {
    try {
      const encryptedEntries = await this.getAllEncryptedEntries();
      const encryptedEntry = encryptedEntries.find(e => e.id === id);

      if (!encryptedEntry) {
        return null;
      }

      // Derive key from master password and salt
      const derivedKey = deriveKeyFromPassword(
        masterPassword,
        encryptedEntry.salt,
      );

      // Decrypt the entry
      const decryptedData = decryptData(
        encryptedEntry.encryptedData,
        derivedKey,
        encryptedEntry.iv,
        encryptedEntry.authTag,
      );

      const entry: PasswordEntry = JSON.parse(decryptedData);
      return entry;
    } catch (error) {
      throw new Error(`Failed to retrieve password entry: ${error}`);
    }
  }

  /**
   * Decrypt and retrieve all password entries
   */
  public async getAllPasswordEntries(
    masterPassword: string,
  ): Promise<PasswordEntry[]> {
    try {
      const encryptedEntries = await this.getAllEncryptedEntries();
      const decryptedEntries: PasswordEntry[] = [];

      for (const encryptedEntry of encryptedEntries) {
        try {
          // Derive key from master password and salt
          const derivedKey = deriveKeyFromPassword(
            masterPassword,
            encryptedEntry.salt,
          );

          const decryptedData = decryptData(
            encryptedEntry.encryptedData,
            derivedKey,
            encryptedEntry.iv,
            encryptedEntry.authTag,
          );

          const entry: PasswordEntry = JSON.parse(decryptedData);
          decryptedEntries.push(entry);
        } catch (error) {
          console.error(`Failed to decrypt entry ${encryptedEntry.id}:`, error);
          // Continue with other entries instead of failing completely
        }
      }

      return decryptedEntries.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    } catch (error) {
      throw new Error(`Failed to retrieve password entries: ${error}`);
    }
  }

  /**
   * Delete a password entry
   */
  public async deletePasswordEntry(id: string): Promise<void> {
    try {
      const existingEntries = await this.getAllEncryptedEntries();
      const updatedEntries = existingEntries.filter(e => e.id !== id);

      await AsyncStorage.setItem(
        PASSWORDS_STORAGE_KEY,
        JSON.stringify(updatedEntries),
      );
    } catch (error) {
      throw new Error(`Failed to delete password entry: ${error}`);
    }
  }

  /**
   * Search password entries by title, username, or website
   */
  public async searchPasswordEntries(
    query: string,
    masterPassword: string,
  ): Promise<PasswordEntry[]> {
    try {
      const allEntries = await this.getAllPasswordEntries(masterPassword);
      const lowercaseQuery = query.toLowerCase();

      return allEntries.filter(
        entry =>
          entry.title.toLowerCase().includes(lowercaseQuery) ||
          entry.username.toLowerCase().includes(lowercaseQuery) ||
          (entry.website &&
            entry.website.toLowerCase().includes(lowercaseQuery)) ||
          (entry.notes && entry.notes.toLowerCase().includes(lowercaseQuery)) ||
          (entry.tags &&
            entry.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))),
      );
    } catch (error) {
      throw new Error(`Failed to search password entries: ${error}`);
    }
  }

  /**
   * Get password entries by category
   */
  public async getPasswordEntriesByCategory(
    category: string,
    masterPassword: string,
  ): Promise<PasswordEntry[]> {
    try {
      const allEntries = await this.getAllPasswordEntries(masterPassword);
      return allEntries.filter(entry => entry.category === category);
    } catch (error) {
      throw new Error(`Failed to get entries by category: ${error}`);
    }
  }

  /**
   * Update last used timestamp for a password entry
   */
  public async updateLastUsed(
    id: string,
    masterPassword: string,
  ): Promise<void> {
    try {
      const entry = await this.getPasswordEntry(id, masterPassword);
      if (entry) {
        entry.lastUsed = new Date();
        entry.updatedAt = new Date();
        await this.savePasswordEntry(entry, masterPassword);
      }
    } catch (error) {
      throw new Error(`Failed to update last used: ${error}`);
    }
  }

  /**
   * Get frequently used password entries
   */
  public async getFrequentlyUsedEntries(
    masterPassword: string,
    limit: number = 10,
  ): Promise<PasswordEntry[]> {
    try {
      const allEntries = await this.getAllPasswordEntries(masterPassword);
      return allEntries
        .filter(entry => entry.lastUsed)
        .sort(
          (a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0),
        )
        .slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to get frequently used entries: ${error}`);
    }
  }

  /**
   * Get favorite password entries
   */
  public async getFavoriteEntries(
    masterPassword: string,
  ): Promise<PasswordEntry[]> {
    try {
      const allEntries = await this.getAllPasswordEntries(masterPassword);
      return allEntries.filter(entry => entry.isFavorite);
    } catch (error) {
      throw new Error(`Failed to get favorite entries: ${error}`);
    }
  }

  // Category management methods

  /**
   * Save a password category
   */
  public async saveCategory(category: PasswordCategory): Promise<void> {
    try {
      const existingCategories = await this.getAllCategories();
      const updatedCategories = existingCategories.filter(
        c => c.id !== category.id,
      );
      updatedCategories.push(category);

      await AsyncStorage.setItem(
        CATEGORIES_STORAGE_KEY,
        JSON.stringify(updatedCategories),
      );
    } catch (error) {
      throw new Error(`Failed to save category: ${error}`);
    }
  }

  /**
   * Get all password categories
   */
  public async getAllCategories(): Promise<PasswordCategory[]> {
    try {
      const categoriesJson = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (!categoriesJson) {
        return this.getDefaultCategories();
      }

      const categories: PasswordCategory[] = JSON.parse(categoriesJson);
      return categories.map(cat => ({
        ...cat,
        createdAt: new Date(cat.createdAt),
      }));
    } catch (error) {
      console.error('Failed to get categories:', error);
      return this.getDefaultCategories();
    }
  }

  /**
   * Delete a category
   */
  public async deleteCategory(id: string): Promise<void> {
    try {
      const existingCategories = await this.getAllCategories();
      const updatedCategories = existingCategories.filter(c => c.id !== id);

      await AsyncStorage.setItem(
        CATEGORIES_STORAGE_KEY,
        JSON.stringify(updatedCategories),
      );
    } catch (error) {
      throw new Error(`Failed to delete category: ${error}`);
    }
  }

  // Private helper methods

  private async getAllEncryptedEntries(): Promise<EncryptedPasswordEntry[]> {
    try {
      const entriesJson = await AsyncStorage.getItem(PASSWORDS_STORAGE_KEY);
      if (!entriesJson) {
        return [];
      }

      const entries: EncryptedPasswordEntry[] = JSON.parse(entriesJson);
      return entries.map(entry => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      }));
    } catch (error) {
      console.error('Failed to get encrypted entries:', error);
      return [];
    }
  }

  private getDefaultCategories(): PasswordCategory[] {
    return [
      {
        id: 'social',
        name: 'Social Media',
        icon: 'people',
        color: '#3B82F6',
        createdAt: new Date(),
      },
      {
        id: 'work',
        name: 'Work',
        icon: 'work',
        color: '#10B981',
        createdAt: new Date(),
      },
      {
        id: 'finance',
        name: 'Finance',
        icon: 'account-balance',
        color: '#F59E0B',
        createdAt: new Date(),
      },
      {
        id: 'shopping',
        name: 'Shopping',
        icon: 'shopping-cart',
        color: '#EF4444',
        createdAt: new Date(),
      },
      {
        id: 'entertainment',
        name: 'Entertainment',
        icon: 'movie',
        color: '#8B5CF6',
        createdAt: new Date(),
      },
      {
        id: 'other',
        name: 'Other',
        icon: 'folder',
        color: '#6B7280',
        createdAt: new Date(),
      },
    ];
  }

  /**
   * Clear all data (for logout or reset)
   */
  public async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        PASSWORDS_STORAGE_KEY,
        CATEGORIES_STORAGE_KEY,
      ]);
      this.masterPasswordHash = null;
    } catch (error) {
      throw new Error(`Failed to clear data: ${error}`);
    }
  }

  /**
   * Export encrypted data for backup
   */
  public async exportData(): Promise<string> {
    try {
      const passwords = await AsyncStorage.getItem(PASSWORDS_STORAGE_KEY);
      const categories = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);

      const exportData = {
        passwords: passwords ? JSON.parse(passwords) : [],
        categories: categories ? JSON.parse(categories) : [],
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      return JSON.stringify(exportData);
    } catch (error) {
      throw new Error(`Failed to export data: ${error}`);
    }
  }

  /**
   * Import encrypted data from backup
   */
  public async importData(importDataString: string): Promise<void> {
    try {
      const importData = JSON.parse(importDataString);

      if (importData.passwords) {
        await AsyncStorage.setItem(
          PASSWORDS_STORAGE_KEY,
          JSON.stringify(importData.passwords),
        );
      }

      if (importData.categories) {
        await AsyncStorage.setItem(
          CATEGORIES_STORAGE_KEY,
          JSON.stringify(importData.categories),
        );
      }
    } catch (error) {
      throw new Error(`Failed to import data: ${error}`);
    }
  }
}

// Export singleton instance
export const encryptedDatabase = EncryptedDatabaseService.getInstance();
