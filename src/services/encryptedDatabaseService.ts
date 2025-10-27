import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PasswordEntry,
  OptimizedPasswordEntry,
  PasswordCategory,
} from '../types/password';
import {
  encryptData,
  decryptData,
  generateSecureRandom,
  deriveKeyFromPassword,
} from './cryptoService';
import { getMasterPasswordHash } from './secureStorageService';

const PASSWORDS_STORAGE_KEY = 'optimized_passwords_v2';
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
   * Save password entry using optimized format
   * Metadata is stored unencrypted for instant loading
   * Only password field is encrypted
   */
  public async savePasswordEntry(
    entry: PasswordEntry,
    masterPassword: string,
  ): Promise<void> {
    const startTime = Date.now();
    console.log('🔐 [Save] Starting password save...', {
      hasPassword: !!entry.password,
    });

    try {
      // Get existing entries to check if we need to preserve encrypted password
      const existingEntries = await this.getAllOptimizedEntries();
      const existingEntry = existingEntries.find(e => e.id === entry.id);

      let encryptedPasswordData: {
        ciphertext: string;
        salt: string;
        iv: string;
        tag: string;
      };

      // If password matches existing encrypted password, preserve it (no re-encryption needed)
      if (existingEntry && entry.password === existingEntry.encryptedPassword) {
        console.log(
          '🔐 [Save] Password unchanged, preserving existing encryption',
        );
        encryptedPasswordData = {
          ciphertext: existingEntry.encryptedPassword,
          salt: existingEntry.passwordSalt,
          iv: existingEntry.passwordIv,
          tag: existingEntry.passwordAuthTag,
        };
      } else {
        // Password has changed or is new, encrypt it
        console.log('🔐 [Save] Encrypting new/updated password');
        const salt = generateSecureRandom(32);
        const iv = generateSecureRandom(16);
        const derivedKey = deriveKeyFromPassword(masterPassword, salt);
        const encrypted = encryptData(entry.password, derivedKey, iv);

        encryptedPasswordData = {
          ciphertext: encrypted.ciphertext,
          salt: salt,
          iv: encrypted.iv,
          tag: encrypted.tag,
        };
      }

      // Create optimized entry with unencrypted metadata
      const optimizedEntry: OptimizedPasswordEntry = {
        id: entry.id,
        // Unencrypted metadata
        title: entry.title,
        username: entry.username,
        website: entry.website,
        notes: entry.notes,
        category: entry.category,
        tags: entry.tags,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt,
        updatedAt: new Date(),
        lastUsed: entry.lastUsed,
        // Encrypted password
        encryptedPassword: encryptedPasswordData.ciphertext,
        passwordSalt: encryptedPasswordData.salt,
        passwordIv: encryptedPasswordData.iv,
        passwordAuthTag: encryptedPasswordData.tag,
        storageVersion: 2,
        // Audit data
        auditData: entry.auditData,
        breachStatus: entry.breachStatus,
      };

      // Update or add the entry
      const updatedEntries = existingEntries.filter(e => e.id !== entry.id);
      updatedEntries.push(optimizedEntry);

      // Save to storage
      await AsyncStorage.setItem(
        PASSWORDS_STORAGE_KEY,
        JSON.stringify(updatedEntries),
      );

      const duration = Date.now() - startTime;
      console.log(`✅ [Save] Password saved in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Save] Failed after ${duration}ms:`, error);
      throw new Error(`Failed to save password entry: ${error}`);
    }
  }

  /**
   * Alias for backward compatibility
   */
  public async savePasswordEntryOptimized(
    entry: PasswordEntry,
    masterPassword: string,
  ): Promise<void> {
    return this.savePasswordEntry(entry, masterPassword);
  }

  /**
   * Get all password entries
   * When masterPassword provided: Returns with decrypted passwords (isDecrypted=true)
   * When masterPassword empty: Returns with encrypted passwords for lazy loading (isDecrypted=false)
   */
  public async getAllPasswordEntries(
    masterPassword: string,
  ): Promise<PasswordEntry[]> {
    const startTime = Date.now();
    const shouldDecrypt = masterPassword && masterPassword.length > 0;
    console.log(`📖 [Load] Loading passwords...`);
    console.log(
      `📖 [Load] masterPassword length: ${
        masterPassword ? masterPassword.length : 'undefined'
      }`,
    );
    console.log(`📖 [Load] shouldDecrypt: ${shouldDecrypt}`);

    try {
      const optimizedEntries = await this.getAllOptimizedEntries();

      // Convert to PasswordEntry format
      const entries: PasswordEntry[] = optimizedEntries.map(entry => ({
        id: entry.id,
        title: entry.title,
        username: entry.username,
        password: entry.encryptedPassword, // Initially set to encrypted password
        passwordSalt: entry.passwordSalt, // ✅ Include SALT for key derivation during autofill decryption
        passwordIv: entry.passwordIv, // ✅ Include IV for autofill decryption
        passwordTag: entry.passwordAuthTag, // ✅ Include TAG (mapped from authTag) for autofill decryption
        isDecrypted: false, // Will be updated if decryption happens
        website: entry.website,
        notes: entry.notes,
        category: entry.category,
        tags: entry.tags,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastUsed: entry.lastUsed,
        auditData: entry.auditData,
        breachStatus: entry.breachStatus,
      }));

      // Decrypt all password fields if masterPassword provided
      if (shouldDecrypt) {
        console.log(`🔓 [Load] Decrypting ${entries.length} passwords...`);
        for (let i = 0; i < entries.length; i++) {
          try {
            const optimizedEntry = optimizedEntries[i];
            const derivedKey = deriveKeyFromPassword(
              masterPassword,
              optimizedEntry.passwordSalt,
            );
            const decryptedPassword = decryptData(
              optimizedEntry.encryptedPassword,
              derivedKey,
              optimizedEntry.passwordIv,
              optimizedEntry.passwordAuthTag,
            );

            entries[i].password = decryptedPassword;
            entries[i].isDecrypted = true; // 🔓 Mark as decrypted!
          } catch (error) {
            console.warn(`⚠️ [Load] Failed to decrypt password ${i}:`, error);
            // Keep encrypted password if decryption fails
            entries[i].isDecrypted = false;
          }
        }
        console.log(`✅ [Load] Decryption complete`);
      }

      const duration = Date.now() - startTime;
      console.log(
        `✅ [Load] Loaded ${entries.length} passwords in ${duration}ms (decrypted: ${shouldDecrypt})`,
      );

      return entries.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    } catch (error) {
      console.error('❌ [Load] Failed to load passwords:', error);
      throw new Error(`Failed to retrieve password entries: ${error}`);
    }
  }

  /**
   * Alias for backward compatibility
   */
  public async getAllPasswordEntriesOptimized(): Promise<PasswordEntry[]> {
    return this.getAllPasswordEntries('');
  }

  /**
   * Get all password entries WITHOUT decrypting the password field (lazy loading)
   */
  public async getAllPasswordEntriesLazy(
    masterPassword: string,
  ): Promise<PasswordEntry[]> {
    return this.getAllPasswordEntries(masterPassword);
  }

  /**
   * Decrypt password field for a specific entry (on-demand)
   */
  public async decryptPasswordField(
    id: string,
    masterPassword: string,
  ): Promise<string | null> {
    const startTime = Date.now();
    console.log(`🔓 [Decrypt] Decrypting password for entry ${id}...`);

    try {
      const optimizedEntries = await this.getAllOptimizedEntries();
      const entry = optimizedEntries.find(e => e.id === id);

      if (!entry) {
        console.warn(`⚠️ [Decrypt] Entry ${id} not found`);
        return null;
      }

      // Derive key from master password and salt
      const derivedKey = deriveKeyFromPassword(
        masterPassword,
        entry.passwordSalt,
      );

      // Decrypt the password field
      const decryptedPassword = decryptData(
        entry.encryptedPassword,
        derivedKey,
        entry.passwordIv,
        entry.passwordAuthTag,
      );

      const duration = Date.now() - startTime;
      console.log(`✅ [Decrypt] Password decrypted in ${duration}ms`, {
        passwordLength: decryptedPassword?.length || 0,
        passwordPreview: decryptedPassword?.substring(0, 3) + '***',
      });

      return decryptedPassword;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [Decrypt] Failed after ${duration}ms:`, error);
      throw new Error(`Failed to decrypt password field: ${error}`);
    }
  }

  /**
   * Alias for backward compatibility
   */
  public async decryptPasswordFieldOptimized(
    id: string,
    masterPassword: string,
  ): Promise<string | null> {
    return this.decryptPasswordField(id, masterPassword);
  }

  /**
   * Get a single password entry by ID
   */
  public async getPasswordEntry(
    id: string,
    masterPassword: string,
  ): Promise<PasswordEntry | null> {
    try {
      const entries = await this.getAllPasswordEntries(masterPassword);
      const entry = entries.find(e => e.id === id);

      if (!entry) {
        return null;
      }

      // Decrypt the password field
      const decryptedPassword = await this.decryptPasswordField(
        id,
        masterPassword,
      );

      if (decryptedPassword) {
        entry.password = decryptedPassword;
      }

      return entry;
    } catch (error) {
      throw new Error(`Failed to retrieve password entry: ${error}`);
    }
  }

  /**
   * Delete a password entry
   */
  public async deletePasswordEntry(id: string): Promise<void> {
    try {
      const existingEntries = await this.getAllOptimizedEntries();
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
   * Alias for backward compatibility
   */
  public async deletePasswordEntryOptimized(id: string): Promise<void> {
    return this.deletePasswordEntry(id);
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

  /**
   * Get all optimized entries from storage
   */
  private async getAllOptimizedEntries(): Promise<OptimizedPasswordEntry[]> {
    try {
      const entriesJson = await AsyncStorage.getItem(PASSWORDS_STORAGE_KEY);
      if (!entriesJson) {
        return [];
      }

      const entries: OptimizedPasswordEntry[] = JSON.parse(entriesJson);
      return entries.map(entry => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
        lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get optimized entries:', error);
      return [];
    }
  }

  /**
   * Get all encrypted entries for export purposes
   * Returns entries with encrypted password data intact
   */
  public async getAllEncryptedEntries(): Promise<
    Array<{
      id: string;
      encryptedData: string;
      salt: string;
      iv: string;
      authTag: string;
    }>
  > {
    try {
      const optimizedEntries = await this.getAllOptimizedEntries();

      // Map optimized entries to the format expected by export service
      return optimizedEntries.map(entry => ({
        id: entry.id,
        encryptedData: entry.encryptedPassword,
        salt: entry.passwordSalt,
        iv: entry.passwordIv,
        authTag: entry.passwordAuthTag,
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
   * Check if optimized format is available (always true now)
   */
  public async isOptimizedFormatAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Clear all encrypted passwords
   */
  public async clearAllPasswords(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PASSWORDS_STORAGE_KEY);
      console.log('✅ All encrypted passwords cleared');
    } catch (error) {
      throw new Error(`Failed to clear passwords: ${error}`);
    }
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
        version: '2.0',
        storageFormat: 'optimized',
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
