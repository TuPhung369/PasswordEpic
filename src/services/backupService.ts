import { PasswordEntry, PasswordCategory } from '../types/password';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
  encryptData,
  decryptData,
  deriveKeyFromPassword,
  generateSecureRandom,
} from './cryptoService';
import DeviceInfo from 'react-native-device-info';
import { Buffer } from 'buffer';
import { gzip, ungzip } from 'pako';

// UNIQUE constant string for backup encryption - MUST BE DIFFERENT from EXPORT_KEY_CONSTANT
// This ensures Backup/Restore flow is completely separate from Import/Export flow
const BACKUP_ENCRYPTION_CONSTANT = 'backup_encryption_v1_key_2024_#!@$%^&*()_backup_flow_only';

export interface BackupPasswordEntry extends PasswordEntry {
  isPasswordEncrypted?: boolean;
  salt?: string;
  iv?: string;
  authTag?: string;
  _corruptedDuringBackup?: boolean;
  _corruptedDuringRestore?: boolean;
}

export interface BackupData {
  version: string;
  timestamp: Date;
  entries: BackupPasswordEntry[];
  categories: PasswordCategory[];
  settings: any;
  domains: any[]; // Trusted domains list
  metadata: BackupMetadata;
  staticMasterPasswordSalt?: string; // 🔑 CRITICAL: Store the salt for the static master password
}

export interface BackupMetadata {
  appVersion: string;
  platform: string;
  deviceId: string;
  entryCount: number;
  categoryCount: number;
  domainCount: number;
  encryptionMethod: string;
  compressionMethod: string;
  backupSize: number;
  fixedSalt?: string;
}

export interface BackupOptions {
  includeSettings: boolean;
  includePasswords: boolean;
  includeAttachments: boolean;
  encryptBackup: boolean;
  compressBackup: boolean;
  encryptionPassword?: string;
  customPath?: string;
  filename?: string;
}

export interface RestoreOptions {
  mergeStrategy: 'replace' | 'merge' | 'skip';
  decryptionPassword?: string;
  restoreSettings: boolean;
  restoreCategories: boolean;
  restoreDomains: boolean;
  overwriteDuplicates: boolean;
  categoryMapping?: { [oldId: string]: string };
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  backupSize?: number;
  entryCount?: number;
  errors: string[];
  warnings: string[];
}

export interface RestoreResult {
  success: boolean;
  restoredEntries: number;
  skippedEntries: number;
  errorEntries: number;
  restoredCategories: number;
  restoredDomains: number;
  errors: string[];
  warnings: string[];
}

export interface BackupInfo {
  id: string;
  filename: string;
  filePath: string;
  timestamp: Date;
  size: number;
  entryCount: number;
  categoryCount: number;
  version: string;
  platform: string;
  isEncrypted: boolean;
  isCompressed: boolean;
}

export interface AutoBackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  maxBackups: number;
  includePasswords: boolean;
  encryptBackups: boolean;
  encryptionPassword?: string;
  backupPath?: string;
}

class BackupService {
  private readonly BACKUP_VERSION = '1.0';
  private readonly DEFAULT_BACKUP_PATH =
    Platform.OS === 'android'
      ? `${RNFS.ExternalDirectoryPath}/Backups`
      : `${RNFS.DocumentDirectoryPath}/Backups`;

  // Generate backup encryption key from plain text master password + fixed constant
  private generateBackupEncryptionKey(masterPassword: string): string {
    return `${masterPassword}::${BACKUP_ENCRYPTION_CONSTANT}`;
  }

  // Create backup
  async createBackup(
    entries: PasswordEntry[],
    categories: PasswordCategory[],
    settings: any,
    options: BackupOptions,
  ): Promise<BackupResult> {
    console.log('🟣 [BackupService] createBackup called');
    console.log('🟣 [BackupService] Entries count:', entries.length);
    console.log('🟣 [BackupService] Categories count:', categories.length);
    console.log(
      '🟣 [BackupService] Settings received:',
      JSON.stringify(settings, null, 2),
    );
    console.log('🟣 [BackupService] Options:', options);

    try {
      // Prepare backup data
      console.log('🟣 [BackupService] Preparing backup data...');
      const backupData = await this.prepareBackupData(
        entries,
        categories,
        settings,
        options,
      );
      console.log('🟣 [BackupService] Backup data prepared');

      // Generate filename
      const filename = options.filename || this.generateBackupFilename();
      const backupPath = options.customPath || this.DEFAULT_BACKUP_PATH;
      const fullPath = `${backupPath}/${filename}`;
      console.log('🟣 [BackupService] Backup path:', fullPath);

      // Ensure backup directory exists
      console.log('🟣 [BackupService] Ensuring directory exists...');
      await this.ensureDirectoryExists(backupPath);
      console.log('🟣 [BackupService] Directory ready');

      // Convert to JSON
      console.log('🟣 [BackupService] Converting to JSON...');
      let content = JSON.stringify(backupData, null, 2);
      console.log('🟣 [BackupService] JSON size:', content.length, 'bytes');

      // Extract metadata for unencrypted prefix (allows reading metadata without password)
      const metadataPrefix = backupData.metadata ? 
        `METADATA_V1:${Buffer.from(JSON.stringify(backupData.metadata)).toString('base64')}|||` : 
        '';

      // Compress if enabled
      if (options.compressBackup) {
        console.log('🟣 [BackupService] Compressing data...');
        content = await this.compressData(content);
        console.log(
          '🟣 [BackupService] Compressed size:',
          content.length,
          'bytes',
        );
      }

      // Encrypt if enabled
      if (options.encryptBackup && options.encryptionPassword) {
        console.log('🟣 [BackupService] Encrypting data...');
        // Use combined encryption key: masterPassword::fixedConstant
        const backupEncryptionKey = this.generateBackupEncryptionKey(
          options.encryptionPassword,
        );
        content = await this.encryptData(content, backupEncryptionKey);
        console.log(
          '🟣 [BackupService] Encrypted size:',
          content.length,
          'bytes',
        );
      }

      // Prepend metadata prefix to the backup file
      const finalContent = metadataPrefix + content;

      // Write to file
      console.log('🟣 [BackupService] Writing to file:', fullPath);
      await RNFS.writeFile(fullPath, finalContent, 'utf8');
      console.log('🟣 [BackupService] File written successfully');

      // Get file stats
      const stats = await RNFS.stat(fullPath);
      console.log('🟣 [BackupService] File stats:', stats);

      console.log('✅ [BackupService] Backup created successfully');
      return {
        success: true,
        filePath: fullPath,
        backupSize: stats.size,
        entryCount: backupData.entries.length,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      console.error('❌ [BackupService] Backup failed:', error);
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Backup failed',
        ] as string[],
        warnings: [],
      };
    }
  }

  // Restore from backup
  async restoreFromBackup(
    filePath: string,
    options: RestoreOptions,
  ): Promise<{ result: RestoreResult; data?: BackupData }> {
    try {
      // Read backup file
      let content: string = await RNFS.readFile(filePath, 'utf8');

      console.log('🔵 [BackupService] Read backup file, length:', content.length);
      console.log('🔵 [BackupService] First 100 chars:', content.substring(0, 100));

      // Check if content is base64-encoded (e.g., from Google Drive download)
      const base64Pattern = /^[A-Za-z0-9+/=\s\r\n]*$/;
      const trimmedContent = content.trim();
      
      if (base64Pattern.test(trimmedContent)) {
        try {
          // Remove all whitespace before decoding
          const cleanBase64 = trimmedContent.replace(/\s/g, '');
          
          // Try to decode - valid base64 should decode without errors
          const decoded = Buffer.from(cleanBase64, 'base64').toString('utf8');
          
          // Verify it's valid JSON by checking for common JSON markers
          if ((decoded.includes('{') || decoded.includes('[')) && 
              !content.includes('ENCRYPTED_V1:') && // Only decode if not already an encrypted backup marker
              content.length !== decoded.length) { // Only decode if size changed significantly
            content = decoded;
            console.log('🔵 [BackupService] Decoded base64 content, new length:', content.length);
            console.log('🔵 [BackupService] First 100 chars after decode:', content.substring(0, 100));
          }
        } catch (decodeError) {
          console.warn('⚠️ [BackupService] Failed to decode base64, proceeding with original content:', decodeError);
        }
      } else {
        console.log('🔵 [BackupService] Content does not appear to be base64 encoded');
      }

      let backupFixedSalt: string | null = null;
      let decryptionPasswordToUse = options.decryptionPassword;

      // Extract metadata from unencrypted prefix if present
      if (content.startsWith('METADATA_V1:')) {
        try {
          const separatorIndex = content.indexOf('|||');
          if (separatorIndex !== -1) {
            const metadataBase64 = content.substring(12, separatorIndex);
            const metadataJson = Buffer.from(metadataBase64, 'base64').toString('utf8');
            const metadata: BackupMetadata = JSON.parse(metadataJson);
            
            if (metadata.fixedSalt) {
              backupFixedSalt = metadata.fixedSalt;
              console.log('🔐 [BackupService] Found fixedSalt in backup metadata:', backupFixedSalt.substring(0, 16) + '...');
              
              // If decryption password is provided, regenerate it using the backup's fixed salt
              if (decryptionPasswordToUse) {
                try {
                  const { generateStaticMasterPasswordWithSalt } = await import(
                    './staticMasterPasswordService'
                  );
                  const result = await generateStaticMasterPasswordWithSalt(
                    decryptionPasswordToUse,
                    backupFixedSalt,
                  );
                  if (result.success && result.password) {
                    decryptionPasswordToUse = result.password;
                    console.log('🔐 [BackupService] Using master password derived from backup fixedSalt');
                  } else {
                    console.error('❌ [BackupService] Failed to generate password with backup fixedSalt:', result.error);
                  }
                } catch (error) {
                  console.error('❌ [BackupService] Exception regenerating password with backup fixedSalt:', error);
                  // Continue with original password - it might still work if local salt matches
                }
              }
            } else {
              console.log('ℹ️ [BackupService] No fixedSalt in backup metadata - will use current system salt');
            }
          }
        } catch (error) {
          console.warn('⚠️ [BackupService] Failed to extract fixedSalt from metadata:', error);
        }
      }

      // Remove metadata prefix if present (new format stores metadata unencrypted at start)
      if (content.startsWith('METADATA_V1:')) {
        const separatorIndex = content.indexOf('|||');
        if (separatorIndex !== -1) {
          console.log('🔵 [BackupService] Removing metadata prefix');
          content = content.substring(separatorIndex + 3);
        }
      }

      // Decrypt if needed
      if (decryptionPasswordToUse) {
        try {
          console.log('🔓 [BackupService] Decrypting backup with password...');
          // Use combined decryption key: masterPassword::fixedConstant
          const backupDecryptionKey = this.generateBackupEncryptionKey(
            decryptionPasswordToUse,
          );
          const beforeDecrypt = content.substring(0, 100);
          content = (await this.decryptData(
            content,
            backupDecryptionKey,
          )) as string;
          const afterDecrypt = content.substring(0, 100);
          console.log('✅ [BackupService] Backup decrypted successfully', {
            beforeDecryptPreview: beforeDecrypt,
            afterDecryptPreview: afterDecrypt,
            decryptedLength: content.length,
          });
        } catch (error) {
          console.error('❌ [BackupService] Backup decryption failed:', error);
          return {
            result: {
              success: false,
              restoredEntries: 0,
              skippedEntries: 0,
              errorEntries: 0,
              restoredCategories: 0,
              restoredDomains: 0,
              errors: ['Invalid decryption password'] as string[],
              warnings: [],
            },
          };
        }
      }

      // Decompress if needed
      if (this.isCompressed(content)) {
        content = (await this.decompressData(content)) as string;
      }

      // Parse backup data
      const backupData: BackupData = JSON.parse(content);

      // Validate backup
      const validationResult = this.validateBackup(backupData);
      if (!validationResult.isValid) {
        return {
          result: {
            success: false,
            restoredEntries: 0,
            skippedEntries: 0,
            errorEntries: 0,
            restoredCategories: 0,
            restoredDomains: 0,
            errors: validationResult.errors as string[],
            warnings: [],
          },
        };
      }

      // If the backup was encrypted, the entries within it were also re-encrypted with the backup key.
      // We must decrypt them here before returning them to the caller.
      if (options.decryptionPassword) {
        console.log('🔵 [BackupService] Decrypting entries within the backup...');
        const backupDecryptionKey = this.generateBackupEncryptionKey(
          options.decryptionPassword,
        );

        const decryptedEntries = await Promise.all(
          backupData.entries.map(async (entry: BackupPasswordEntry) => {
            if (entry.isPasswordEncrypted && entry.password && entry.salt && entry.iv && entry.authTag) {
              try {
                const derivedKey = deriveKeyFromPassword(
                  backupDecryptionKey,
                  entry.salt,
                );
                const decryptedPassword = decryptData(
                  entry.password,
                  derivedKey,
                  entry.iv,
                  entry.authTag,
                );
                console.log(`✅ [BackupService] Decrypted entry: ${entry.title}`);
                const decrypted: BackupPasswordEntry = {
                  ...entry,
                  password: decryptedPassword,
                  isPasswordEncrypted: false,
                  salt: undefined,
                  iv: undefined,
                  authTag: undefined,
                };
                return decrypted;
              } catch (error) {
                console.error(
                  `❌ [BackupService] Failed to decrypt entry "${entry.title}" during restore. It will be skipped.`,
                  error,
                );
                return { ...entry, password: '', _corruptedDuringRestore: true } as BackupPasswordEntry;
              }
            }
            return entry;
          }),
        );
        backupData.entries = decryptedEntries.filter((e: BackupPasswordEntry) => !e._corruptedDuringRestore);
      }

      // Process restored entries
      const processedEntries = this.processRestoredEntries(
        backupData.entries,
        options,
      );
      const processedCategories = this.processRestoredCategories(
        backupData.categories,
        options,
      );

      // Process restored domains
      let processedDomains = backupData.domains || [];
      if (processedDomains.length > 0) {
        processedDomains = this.processRestoredDomains(
          processedDomains,
          options,
        );
      }

      console.log(
        '🟣 [BackupService] Restore - processed domains count:',
        processedDomains.length,
      );

      return {
        result: {
          success: true,
          restoredEntries: processedEntries.length,
          skippedEntries: 0,
          errorEntries: 0,
          restoredCategories: processedCategories.length,
          restoredDomains: processedDomains.length,
          errors: [],
          warnings: [],
        },
        data: {
          ...backupData,
          entries: processedEntries,
          categories: processedCategories,
          domains: processedDomains,
        },
      };
    } catch (error) {
      return {
        result: {
          success: false,
          restoredEntries: 0,
          skippedEntries: 0,
          errorEntries: 0,
          restoredCategories: 0,
          restoredDomains: 0,
          errors: [
            error instanceof Error ? error.message : 'Restore failed',
          ] as string[],
          warnings: [],
        },
      };
    }
  }

  // List available backups
  async listBackups(customPath?: string): Promise<BackupInfo[]> {
    try {
      const backupPath = customPath || this.DEFAULT_BACKUP_PATH;

      if (!(await RNFS.exists(backupPath))) {
        return [];
      }

      const files = await RNFS.readdir(backupPath);
      const backups: BackupInfo[] = [];

      for (const fileName of files) {
        if (fileName.endsWith('.backup') || fileName.endsWith('.bak')) {
          try {
            const filePath = `${backupPath}/${fileName}`;
            const info = await this.getBackupInfo(filePath);
            if (info) {
              backups.push(info);
            }
          } catch (error) {
            console.warn(`Failed to read backup info for ${fileName}:`, error);
          }
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  // Get backup information without fully loading it
  async getBackupInfo(filePath: string): Promise<BackupInfo | null> {
    try {
      let content: string = await RNFS.readFile(filePath, 'utf8');
      const stats = await RNFS.stat(filePath);

      // Try to read just the metadata
      if (this.isEncrypted(content)) {
        // For encrypted backups, we can't read metadata without password
        const filename = filePath.split('/').pop() || '';
        const timestampMatch = filename.match(
          /(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/,
        );
        const timestamp = timestampMatch
          ? new Date(timestampMatch[1].replace(/_/, 'T').replace(/-/g, ':'))
          : stats.mtime;

        return {
          id: this.generateId(),
          filename,
          filePath,
          timestamp,
          size: stats.size,
          entryCount: 0,
          categoryCount: 0,
          version: 'unknown',
          platform: 'unknown',
          isEncrypted: true,
          isCompressed: false,
        };
      }

      if (this.isCompressed(content)) {
        content = (await this.decompressData(content)) as string;
      }

      const backupData: BackupData = JSON.parse(content);

      return {
        id: this.generateId(),
        filename: filePath.split('/').pop() || '',
        filePath,
        timestamp: new Date(backupData.timestamp),
        size: stats.size,
        entryCount: backupData.metadata.entryCount,
        categoryCount: backupData.metadata.categoryCount,
        version: backupData.version,
        platform: backupData.metadata.platform,
        isEncrypted: this.isEncrypted(await RNFS.readFile(filePath, 'utf8')),
        isCompressed: backupData.metadata.compressionMethod !== 'none',
      };
    } catch (error) {
      console.error('Failed to get backup info:', error);
      return null;
    }
  }

  // Delete backup
  async deleteBackup(filePath: string): Promise<boolean> {
    try {
      await RNFS.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return false;
    }
  }

  // Restore trusted domains from backup data
  async restoreTrustedDomains(domains: any[]): Promise<boolean> {
    try {
      if (!domains || domains.length === 0) {
        console.log('🟣 [BackupService] No domains to restore');
        return true;
      }

      const { domainVerificationService } = await import(
        './domainVerificationService'
      );

      // Save the domains to storage
      await domainVerificationService.saveTrustedDomains(domains);

      console.log(
        `✅ [BackupService] Successfully restored ${domains.length} trusted domains`,
      );
      return true;
    } catch (error) {
      console.error(
        '❌ [BackupService] Failed to restore trusted domains:',
        error,
      );
      return false;
    }
  }

  // Auto backup functionality
  async setupAutoBackup(settings: AutoBackupSettings): Promise<boolean> {
    try {
      // This would integrate with system scheduling
      // For now, just store the settings
      await this.saveAutoBackupSettings(settings);
      return true;
    } catch (error) {
      console.error('Failed to setup auto backup:', error);
      return false;
    }
  }

  async performAutoBackup(
    entries: PasswordEntry[],
    categories: PasswordCategory[],
    settings: any,
  ): Promise<BackupResult> {
    const autoSettings = await this.getAutoBackupSettings();

    if (!autoSettings.enabled) {
      return {
        success: false,
        errors: ['Auto backup is disabled'] as string[],
        warnings: [],
      };
    }

    const options: BackupOptions = {
      includeSettings: true,
      includePasswords: autoSettings.includePasswords,
      includeAttachments: false,
      encryptBackup: autoSettings.encryptBackups,
      compressBackup: true,
      encryptionPassword: autoSettings.encryptionPassword,
      customPath: autoSettings.backupPath,
      filename: this.generateAutoBackupFilename(),
    };

    const result = await this.createBackup(
      entries,
      categories,
      settings,
      options,
    );

    if (result.success) {
      // Clean up old backups
      await this.cleanupOldBackups(
        autoSettings.maxBackups,
        autoSettings.backupPath,
      );
    }

    return result;
  }

  // Private helper methods
  private async prepareBackupData(
    entries: PasswordEntry[],
    categories: PasswordCategory[],
    settings: any,
    options: BackupOptions,
  ): Promise<BackupData> {
    let processedEntries: any[] = [];

    // Process entries based on options
    if (options.includePasswords) {
      if (options.encryptBackup && !options.encryptionPassword) {
        throw new Error(
          'Backup encryption is enabled, but no password was provided to re-encrypt entries.',
        );
      }

      // Use a consistent key for re-encrypting all entries within this backup.
      // This key is derived from the master password provided for the backup operation.
      const backupEntryEncryptionKey = this.generateBackupEncryptionKey(
        options.encryptionPassword!,
      );

      processedEntries = entries.map(entry => {
        try {
          // The `entry.password` from PasswordsScreen is the decrypted plaintext password.
          // We re-encrypt it here for the backup to ensure all entries use the same key.
          const plainPassword = entry.password || '';

          const salt = generateSecureRandom(32); // 32 bytes for salt
          const iv = generateSecureRandom(12); // 12 bytes for GCM IV

          // Derive a key for this specific entry using the consistent backup key and a new salt.
          const derivedKey = deriveKeyFromPassword(
            backupEntryEncryptionKey,
            salt,
          );

          // Encrypt the plaintext password.
          const { ciphertext, tag } = encryptData(plainPassword, derivedKey, iv);

          const backupEntry: BackupPasswordEntry = {
            ...entry,
            password: ciphertext, // This is the new ciphertext for the backup
            salt: salt,
            iv: iv,
            authTag: tag,
            isPasswordEncrypted: true,
          };

          console.log(
            `🔐 [BackupService] Re-encrypted entry "${entry.title}" for backup.`,
          );

          return backupEntry;
        } catch (error) {
          console.error(
            `❌ [BackupService] Failed to re-encrypt entry "${entry.title}" for backup. It will be excluded.`,
            error,
          );
          return {
            ...entry,
            password: '',
            isPasswordEncrypted: false,
            _corruptedDuringBackup: true, // Mark for skipping during restore
          } as BackupPasswordEntry;
        }
      });
    } else {
      processedEntries = entries.map(entry => ({
        ...entry,
        password: '[REDACTED]',
      }));
    }

    // Load trusted domains for backup
    let backupDomains: any[] = [];
    try {
      const { domainVerificationService } = await import(
        './domainVerificationService'
      );
      backupDomains = await domainVerificationService.getTrustedDomains();
      console.log(
        `🟣 [BackupService] Loaded ${backupDomains.length} trusted domains for backup`,
      );
    } catch (error) {
      console.warn('⚠️ [BackupService] Failed to load trusted domains:', error);
    }

    // Get device information
    const appVersion = await DeviceInfo.getVersion();
    const deviceId = await DeviceInfo.getUniqueId();
    const deviceModel = await DeviceInfo.getModel();
    const deviceBrand = await DeviceInfo.getBrand();
    const systemVersion = await DeviceInfo.getSystemVersion();

    let fixedSalt: string | null = null;
    try {
      const { getFixedSalt } = await import('./staticMasterPasswordService');
      fixedSalt = await getFixedSalt(options.encryptionPassword);
      if (fixedSalt) {
        console.log('🔐 [BackupService] Fixed salt included in backup metadata (from Firebase)');
      }
    } catch (error) {
      console.warn('⚠️ [BackupService] Failed to get fixed salt for backup:', error);
    }

    const metadata: BackupMetadata = {
      appVersion,
      platform: `${Platform.OS} ${systemVersion}`,
      deviceId,
      entryCount: entries.length,
      categoryCount: categories.length,
      domainCount: backupDomains.length,
      encryptionMethod: options.encryptBackup ? 'AES-256-GCM' : 'none',
      compressionMethod: options.compressBackup ? 'gzip' : 'none',
      backupSize: 0,
      fixedSalt: fixedSalt || undefined,
    };

    // Prepare settings with device info if needed
    let backupSettings = {};
    if (options.includeSettings) {
      // Create a new object to avoid mutating frozen Redux state
      backupSettings = {
        ...settings,
        deviceInfo: {
          model: deviceModel,
          brand: deviceBrand,
          systemVersion,
          platform: Platform.OS,
        },
      };
      console.log(
        '🟣 [BackupService] prepareBackupData - settings with deviceInfo:',
        JSON.stringify(backupSettings, null, 2),
      );
    }

    // Create backup data object
    const backupData: BackupData = {
      version: this.BACKUP_VERSION,
      timestamp: new Date(),
      entries: processedEntries,
      categories,
      settings: backupSettings,
      domains: backupDomains,
      metadata,
    };

    console.log(
      '🟣 [BackupService] prepareBackupData - includeSettings:',
      options.includeSettings,
    );
    console.log(
      '🟣 [BackupService] prepareBackupData - domains count:',
      backupData.domains.length,
    );
    console.log(
      '🟣 [BackupService] prepareBackupData - final backupData entries count:',
      backupData.entries.length,
    );

    return backupData;
  }

  private generateBackupFilename(): string {
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5);
    return `password-backup-${timestamp}.backup`;
  }

  private generateAutoBackupFilename(): string {
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5);
    return `auto-backup-${timestamp}.backup`;
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) {
        console.log('🟣 [BackupService] Creating directory:', path);

        // Create directories recursively by splitting the path
        const pathParts = path.split('/').filter(part => part.length > 0);
        let currentPath = '';

        for (const part of pathParts) {
          currentPath += '/' + part;
          const dirExists = await RNFS.exists(currentPath);

          if (!dirExists) {
            console.log(
              '🟣 [BackupService] Creating subdirectory:',
              currentPath,
            );
            try {
              await RNFS.mkdir(currentPath);
            } catch (mkdirError) {
              console.error(
                '❌ [BackupService] Failed to create subdirectory:',
                currentPath,
                mkdirError,
              );
              throw mkdirError;
            }
          }
        }

        console.log('🟣 [BackupService] Directory created successfully');
      } else {
        console.log('🟣 [BackupService] Directory already exists');
      }
    } catch (error) {
      console.error('❌ [BackupService] Failed to create directory:', error);
      throw new Error(
        `Failed to create backup directory: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async compressData(data: string): Promise<string> {
    try {
      // Convert string to Uint8Array using Buffer (TextEncoder not available in React Native)
      const uint8Array = Buffer.from(data, 'utf8');

      // Compress the data
      const compressed = gzip(uint8Array);

      // Convert to base64 for storage
      return Buffer.from(compressed).toString('base64');
    } catch (error) {
      console.error('Compression error:', error);
      throw new Error('Failed to compress data');
    }
  }

  private async decompressData(data: string): Promise<string> {
    try {
      // Convert base64 to Uint8Array
      const compressed = Buffer.from(data, 'base64');

      // Decompress
      const decompressed = ungzip(compressed);

      // Convert back to string using Buffer (TextDecoder not available in React Native)
      return Buffer.from(decompressed).toString('utf8');
    } catch (error) {
      console.error('Decompression error:', error);
      throw new Error('Failed to decompress data');
    }
  }

  private isCompressed(data: string): boolean {
    // Try to detect if the data is compressed by checking if it's base64
    // and attempting to decompress a small portion
    try {
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(data);
      if (!isBase64) return false;

      // We'll assume it's compressed if it's valid base64
      // A more thorough check would attempt to decompress a small portion
      return true;
    } catch (error) {
      return false;
    }
  }

  private async encryptData(data: string, password: string): Promise<string> {
    try {
      // Generate salt for key derivation
      const salt = generateSecureRandom(32);

      // Derive encryption key from password
      const derivedKey = deriveKeyFromPassword(password, salt);

      // Generate IV for encryption (12 bytes = 96 bits for AES-GCM)
      const iv = generateSecureRandom(12);

      // Encrypt the data
      const encryptedResult = encryptData(data, derivedKey, iv);

      // Format: ENCRYPTED_V1:{base64_salt}:{base64_iv}:{base64_ciphertext}:{base64_tag}
      return `ENCRYPTED_V1:${salt}:${iv}:${encryptedResult.ciphertext}:${encryptedResult.tag}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  private async decryptData(data: string, password: string): Promise<string> {
    try {
      if (!data.startsWith('ENCRYPTED_V1:')) {
        throw new Error('Invalid encrypted data format');
      }

      // Parse the encrypted data
      const parts = data.split(':');
      if (parts.length !== 5) {
        throw new Error('Invalid encrypted data format');
      }

      const [_, salt, iv, ciphertext, tag] = parts;

      // Try decryption with the provided password
      try {
        const derivedKey = deriveKeyFromPassword(password, salt);
        return decryptData(ciphertext, derivedKey, iv, tag);
      } catch (initialError) {
        // If decryption fails, try alternative password formats
        console.warn(
          '🔄 [BackupService] Initial decryption failed, trying alternative password formats...',
        );

        const alternativePasswords = this.generateAlternativePasswordFormats(
          password,
        );

        for (const altPassword of alternativePasswords) {
          try {
            console.log(
              '🔄 [BackupService] Trying alternative password format...',
            );
            const derivedKey = deriveKeyFromPassword(altPassword, salt);
            const result = decryptData(ciphertext, derivedKey, iv, tag);
            console.log(
              '✅ [BackupService] Decryption successful with alternative password format!',
            );
            return result;
          } catch (altError) {
            // Continue to next alternative
          }
        }

        // If all alternatives failed, throw the original error
        throw initialError;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(
        'Failed to decrypt data: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /**
   * Generate alternative password format combinations for backward compatibility
   * Handles changes in how the dynamic master password is composed
   */
  private generateAlternativePasswordFormats(password: string): string[] {
    const alternatives: string[] = [];

    // Split the password by :: to work with components
    const components = password.split('::');

    // If password has 4+ components and ends with our fixed constant, try without it
    if (
      components.length >= 4 &&
      components[components.length - 1] === BACKUP_ENCRYPTION_CONSTANT
    ) {
      // Try removing the fixed constant (backward compatibility for old backups)
      const passwordWithoutConstant = components.slice(0, -1).join('::');
      alternatives.push(passwordWithoutConstant);

      // Also try the 4-component format variations
      if (components.length === 4) {
        const [uuid, timestamp, email] = components;
        alternatives.push([uuid, email, timestamp].join('::'));
      }
    }

    // If password has 4 components (UUID::TIMESTAMP::EMAIL::SALT or similar)
    // Try 3-component format variations
    if (components.length === 4) {
      const [uuid, timestamp, email, salt] = components;
      alternatives.push([uuid, email, timestamp].join('::'));
      alternatives.push([uuid, email, salt].join('::'));
      alternatives.push([uuid, timestamp, email].join('::'));
    }

    // If password has 3 components, try different orderings
    if (components.length === 3) {
      const [comp1, comp2, comp3] = components;
      alternatives.push([comp1, comp3, comp2].join('::'));
      alternatives.push([comp2, comp1, comp3].join('::'));
      alternatives.push([comp2, comp3, comp1].join('::'));
      alternatives.push([comp3, comp1, comp2].join('::'));
      alternatives.push([comp3, comp2, comp1].join('::'));
    }

    return alternatives;
  }

  private isEncrypted(data: string): boolean {
    return data.startsWith('ENCRYPTED_V1:');
  }

  private validateBackup(backup: BackupData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!backup.version) {
      errors.push('Missing backup version');
    }

    if (!backup.timestamp) {
      errors.push('Missing backup timestamp');
    }

    if (!Array.isArray(backup.entries)) {
      errors.push('Invalid entries data');
    }

    if (!Array.isArray(backup.categories)) {
      errors.push('Invalid categories data');
    }

    if (!backup.metadata) {
      errors.push('Missing backup metadata');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private processRestoredEntries(
    entries: BackupPasswordEntry[],
    _options: RestoreOptions,
  ): PasswordEntry[] {
    return entries.map(entry => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _corruptedDuringBackup, _corruptedDuringRestore, isPasswordEncrypted, salt, iv, authTag, ...cleanEntry } = entry;
      return {
        ...cleanEntry,
        id: this.generateId(),
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
        lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
      } as PasswordEntry;
    });
  }

  private processRestoredCategories(
    categories: PasswordCategory[],
    _options: RestoreOptions,
  ): PasswordCategory[] {
    return categories.map(category => {
      return {
        ...category,
        id: this.generateId(),
        createdAt: new Date(category.createdAt),
      };
    });
  }

  private processRestoredDomains(
    domains: any[],
    _options: RestoreOptions,
  ): any[] {
    // Domains are preserved as-is since they contain timestamps
    // that should be maintained during restore
    return domains.map(domain => ({
      ...domain,
      addedAt:
        typeof domain.addedAt === 'string'
          ? parseInt(domain.addedAt, 10)
          : domain.addedAt,
      lastUsed:
        typeof domain.lastUsed === 'string'
          ? parseInt(domain.lastUsed, 10)
          : domain.lastUsed,
    }));
  }

  private async cleanupOldBackups(
    maxBackups: number,
    customPath?: string,
  ): Promise<void> {
    try {
      const backups = await this.listBackups(customPath);

      if (backups.length > maxBackups) {
        const backupsToDelete = backups
          .slice(maxBackups)
          .filter(backup => backup.filename.startsWith('auto-backup-'));

        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  private async saveAutoBackupSettings(
    settings: AutoBackupSettings,
  ): Promise<void> {
    // This would save to persistent storage
    console.log('Saving auto backup settings:', settings);
  }

  private async getAutoBackupSettings(): Promise<AutoBackupSettings> {
    // This would load from persistent storage
    return {
      enabled: false,
      frequency: 'weekly',
      time: '02:00',
      maxBackups: 5,
      includePasswords: true,
      encryptBackups: true,
    };
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  // Public utility methods
  async estimateBackupSize(
    entries: PasswordEntry[],
    categories: PasswordCategory[],
    settings: any,
    options: BackupOptions,
  ): Promise<number> {
    const backupData = await this.prepareBackupData(
      entries,
      categories,
      settings,
      options,
    );
    const jsonString = JSON.stringify(backupData);

    let size = new Blob([jsonString]).size;

    if (options.compressBackup) {
      // Estimate 30-50% compression ratio
      size = Math.round(size * 0.4);
    }

    if (options.encryptBackup) {
      // Encryption adds some overhead
      size = Math.round(size * 1.1);
    }

    return size;
  }

  async verifyBackup(
    filePath: string,
    password?: string,
  ): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const result = await this.restoreFromBackup(filePath, {
        mergeStrategy: 'skip',
        decryptionPassword: password,
        restoreSettings: false,
        restoreCategories: false,
        restoreDomains: false,
        overwriteDuplicates: false,
      });

      return {
        isValid: result.result.success,
        errors: result.result.errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown error',
        ] as string[],
      };
    }
  }

  getDefaultBackupPath(): string {
    return this.DEFAULT_BACKUP_PATH;
  }

  generateBackupName(customName?: string): string {
    if (customName) {
      const timestamp = new Date().toISOString().slice(0, 10);
      return `${customName}-${timestamp}.backup`;
    }
    return this.generateBackupFilename();
  }

  async extractBackupMetadata(
    fileContent: string,
    decryptionPassword?: string,
  ): Promise<BackupMetadata | null> {
    try {
      let content = fileContent.trim();

      // Check for unencrypted metadata prefix first (new format)
      if (content.startsWith('METADATA_V1:')) {
        try {
          const metadataEndIndex = content.indexOf('|||');
          if (metadataEndIndex !== -1) {
            const metadataBase64 = content.substring(12, metadataEndIndex); // Remove 'METADATA_V1:' prefix
            const metadataJson = Buffer.from(metadataBase64, 'base64').toString('utf8');
            const metadata: BackupMetadata = JSON.parse(metadataJson);
            console.log('✅ [extractBackupMetadata] Successfully extracted metadata from prefix');
            return metadata;
          }
        } catch (error) {
          console.warn('⚠️ [extractBackupMetadata] Failed to extract metadata from prefix:', error);
          // Fall through to try decrypting the rest
        }
      }

      // Remove metadata prefix if present (for processing encrypted content)
      if (content.includes('|||')) {
        const separatorIndex = content.indexOf('|||');
        content = content.substring(separatorIndex + 3);
      }

      // If content is encrypted and no password provided, cannot extract metadata
      if (content.startsWith('ENCRYPTED_V1:') || content.startsWith('ENCRYPTED_V2:')) {
        if (!decryptionPassword) {
          console.warn('⚠️ [extractBackupMetadata] Backup is encrypted but no password provided');
          return null;
        }
        try {
          const backupDecryptionKey = this.generateBackupEncryptionKey(
            decryptionPassword,
          );
          content = (await this.decryptData(
            content,
            backupDecryptionKey,
          )) as string;
        } catch (error) {
          console.error('Failed to decrypt backup for metadata extraction:', error);
          return null;
        }
      }

      if (this.isCompressed(content)) {
        content = (await this.decompressData(content)) as string;
      }

      const backupData: BackupData = JSON.parse(content);
      return backupData.metadata || null;
    } catch (error) {
      console.error('Failed to extract backup metadata:', error);
      return null;
    }
  }
}

export { BackupService };
export const backupService = new BackupService();
export default backupService;
