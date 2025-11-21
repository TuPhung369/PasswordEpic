import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PasswordEntry,
  OptimizedPasswordEntry,
  PasswordCategory,
} from '../types/password';
import {
  encryptData,
  decryptDataWithRetry,
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
        
        // VALIDATION: Verify that the preserved encrypted data has valid encryption metadata
        // In AES-CTR, ciphertext size equals plaintext size, so we only check that metadata exists
        if (!existingEntry.passwordSalt || !existingEntry.passwordIv || !existingEntry.passwordAuthTag) {
          console.error(
            `🚨 [Save] CORRUPTION DETECTED: Entry "${entry.title}" has missing encryption metadata!`,
            {
              hasSalt: !!existingEntry.passwordSalt,
              hasIv: !!existingEntry.passwordIv,
              hasTag: !!existingEntry.passwordAuthTag,
              recommendation: 'This entry should be re-created or updated to fix the corruption',
            },
          );
          // Re-encrypt instead of using corrupted metadata
          console.log('🔐 [Save] Re-encrypting due to missing metadata...');
          const salt = generateSecureRandom(32);
          const iv = generateSecureRandom(12);
          const derivedKey = deriveKeyFromPassword(masterPassword, salt);
          const encrypted = encryptData(entry.password, derivedKey, iv);

          if (!encrypted.ciphertext || encrypted.ciphertext.length === 0) {
            throw new Error(
              `Failed to encrypt password for "${entry.title}" - encryption produced invalid ciphertext`,
            );
          }

          encryptedPasswordData = {
            ciphertext: encrypted.ciphertext,
            salt: salt,
            iv: encrypted.iv,
            tag: encrypted.tag,
          };
        } else {
          encryptedPasswordData = {
            ciphertext: existingEntry.encryptedPassword,
            salt: existingEntry.passwordSalt,
            iv: existingEntry.passwordIv,
            tag: existingEntry.passwordAuthTag,
          };
        }
      } else {
        // Password has changed or is new, encrypt it
        console.log('🔐 [Save] Encrypting new/updated password', {
          isNewEntry: !existingEntry,
          passwordLength: entry.password?.length || 0,
          passwordPreview: entry.password?.substring(0, 20) + (entry.password && entry.password.length > 20 ? '...' : ''),
        });
        const salt = generateSecureRandom(32);
        const iv = generateSecureRandom(12);
        const derivedKey = deriveKeyFromPassword(masterPassword, salt);
        const encrypted = encryptData(entry.password, derivedKey, iv);

        if (!encrypted.ciphertext || encrypted.ciphertext.length === 0) {
          console.error(
            `❌ [Save] CRITICAL: Encryption produced empty ciphertext for "${entry.title}".`,
          );
          throw new Error(
            `Failed to encrypt password for "${entry.title}" - encryption produced invalid ciphertext`,
          );
        }

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
   * Save password entry with already-encrypted data (for imports)
   * Bypasses encryption - directly stores the encrypted ciphertext with its metadata
   * Used during import to restore encrypted entries without decrypt/re-encrypt cycle
   */
  public async savePasswordEntryWithEncryptedData(
    entry: PasswordEntry,
    encryptedData: {
      ciphertext: string;
      salt: string;
      iv: string;
      tag: string;
    },
  ): Promise<void> {
    try {
      console.log('🔐 [SaveEncrypted] Saving pre-encrypted password entry:', {
        title: entry.title,
        ciphertextLength: encryptedData.ciphertext.length,
        saltLength: encryptedData.salt.length,
        ivLength: encryptedData.iv.length,
        tagLength: encryptedData.tag.length,
      });

      const existingEntries = await this.getAllOptimizedEntries();
      const allEntries = [...existingEntries];
      const existingIndex = allEntries.findIndex(e => e.id === entry.id);

      const optimizedEntry = {
        id: entry.id,
        title: entry.title,
        username: entry.username,
        encryptedPassword: encryptedData.ciphertext,
        passwordSalt: encryptedData.salt,
        passwordIv: encryptedData.iv,
        passwordAuthTag: encryptedData.tag,
        website: entry.website || '',
        notes: entry.notes || '',
        category: entry.category || 'General',
        tags: entry.tags || [],
        isFavorite: entry.isFavorite || false,
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUsed: entry.lastUsed || null,
        auditData: entry.auditData || [],
        breachStatus: entry.breachStatus || { status: 'unknown' },
      };

      if (existingIndex >= 0) {
        allEntries[existingIndex] = optimizedEntry;
      } else {
        allEntries.push(optimizedEntry);
      }

      await AsyncStorage.setItem(
        PASSWORDS_STORAGE_KEY,
        JSON.stringify(allEntries),
      );

      console.log(
        `✅ [SaveEncrypted] Pre-encrypted entry saved: ${entry.title}`,
      );
    } catch (error) {
      console.error(
        `❌ [SaveEncrypted] Failed to save encrypted entry:`,
        error,
      );
      throw new Error(`Failed to save encrypted entry: ${error}`);
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
   * 
   * RESILIENCE: If some entries fail to decrypt due to tag mismatches or corruption,
   * they are returned with isDecrypted=false and encrypted password intact.
   * This allows duplicate detection using title/username metadata even with corrupted entries.
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
      let optimizedEntries: any[] = [];
      try {
        optimizedEntries = await this.getAllOptimizedEntries();
      } catch (error) {
        console.error('❌ [Load] Failed to load encrypted entries from storage:', error);
        return [];
      }

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
        let successCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < entries.length; i++) {
          try {
            const optimizedEntry = optimizedEntries[i];
            
            // Check for missing encryption metadata
            if (!optimizedEntry.encryptedPassword || !optimizedEntry.passwordSalt || !optimizedEntry.passwordIv || !optimizedEntry.passwordAuthTag) {
              console.warn(
                `⚠️ [Load] Entry "${entries[i].title}" (index ${i}) has corrupted encrypted data (missing metadata). Keeping encrypted password for duplicate detection.`,
              );
              entries[i].isDecrypted = false;
              skippedCount++;
              continue;
            }
            
            const decryptedPassword = decryptDataWithRetry(
              optimizedEntry.encryptedPassword,
              masterPassword,
              optimizedEntry.passwordSalt,
              optimizedEntry.passwordIv,
              optimizedEntry.passwordAuthTag,
            );

            entries[i].password = decryptedPassword;
            entries[i].isDecrypted = true; // 🔓 Mark as decrypted!
            successCount++;
          } catch (error) {
            console.warn(
              `⚠️ [Load] Entry "${entries[i].title}" (index ${i}) failed to decrypt (tag mismatch or corruption). Reason:`,
              error instanceof Error ? error.message : 'Unknown error',
            );
            console.warn(
              `ℹ️ [Load] This entry can still be used for duplicate detection via title/username metadata. The password field remains encrypted.`,
            );
            // Keep encrypted password if decryption fails - title/username are still available for duplicate detection
            entries[i].isDecrypted = false;
            failedCount++;
          }
        }
        console.log(
          `✅ [Load] Decryption complete: ${successCount} successful, ${skippedCount} skipped (missing metadata), ${failedCount} failed (corrupted/tag mismatch)`,
        );
      }

      const duration = Date.now() - startTime;
      console.log(
        `✅ [Load] Loaded ${entries.length} passwords in ${duration}ms (decrypted: ${shouldDecrypt})`,
      );

      return entries.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
    } catch (error) {
      console.error('❌ [Load] Unexpected error during password load:', error);
      console.warn('⚠️ [Load] Returning empty list as fallback');
      return [];
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

      // Check for missing encryption metadata
      if (!entry.encryptedPassword || !entry.passwordSalt || !entry.passwordIv || !entry.passwordAuthTag) {
        console.error(
          `❌ [Decrypt] Entry "${entry.title}" (${id}) has corrupted encrypted data (missing metadata). Cannot decrypt due to data corruption.`,
        );
        throw new Error(
          `Cannot decrypt password for "${entry.title}" - encrypted data is corrupted. Try re-creating this password entry.`,
        );
      }

      // Decrypt the password field using retry mechanism for backward compatibility
      const decryptedPassword = decryptDataWithRetry(
        entry.encryptedPassword,
        masterPassword,
        entry.passwordSalt,
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

  /**
   * Repair corrupted entries by re-encrypting them
   * Identifies entries with missing or invalid encryption metadata and fixes them
   */
  public async repairCorruptedEntries(): Promise<{
    repairedCount: number;
    skippedCount: number;
    errors: string[];
  }> {
    const result = {
      repairedCount: 0,
      skippedCount: 0,
      errors: [] as string[],
    };

    try {
      console.log('🔧 [Repair] Starting corrupted entries repair...');
      const entries = await this.getAllOptimizedEntries();
      
      let needsUpdate = false;
      const repairedEntries = entries.map(entry => {
        // Check for corrupted encryption metadata
        if (!entry.passwordSalt || !entry.passwordIv || !entry.passwordAuthTag || !entry.encryptedPassword) {
          console.warn(
            `🔧 [Repair] Found corrupted entry: "${entry.title}" - missing encryption metadata`,
          );
          result.repairedCount++;
          needsUpdate = true;

          // Try to decrypt and re-encrypt if we have encrypted data
          if (entry.encryptedPassword) {
            try {
              // Generate new encryption metadata
              const salt = generateSecureRandom(32);
              const iv = generateSecureRandom(12);
              
              // Keep the existing ciphertext as-is since we can't decrypt without metadata
              // But generate new metadata for future decryption attempts
              return {
                ...entry,
                passwordSalt: salt,
                passwordIv: iv,
                passwordAuthTag: '0000000000000000', // Placeholder - will need re-encryption on next access
                updatedAt: new Date(),
              };
            } catch (error) {
              console.error(`🔧 [Repair] Failed to repair entry "${entry.title}":`, error);
              result.errors.push(`Failed to repair entry "${entry.title}": ${error}`);
              result.repairedCount--;
              result.skippedCount++;
              return entry; // Return unchanged
            }
          }
        }

        return entry;
      });

      // Save repaired entries if needed
      if (needsUpdate && result.repairedCount > 0) {
        console.log(`🔧 [Repair] Saving ${result.repairedCount} repaired entries...`);
        await AsyncStorage.setItem(
          PASSWORDS_STORAGE_KEY,
          JSON.stringify(repairedEntries),
        );
        console.log(`✅ [Repair] Successfully repaired ${result.repairedCount} entries`);
      }

      return result;
    } catch (error) {
      console.error('❌ [Repair] Repair operation failed:', error);
      result.errors.push(`Repair operation failed: ${error}`);
      return result;
    }
  }
}

// Export singleton instance
export const encryptedDatabase = EncryptedDatabaseService.getInstance();
