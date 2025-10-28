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

export interface BackupData {
  version: string;
  timestamp: Date;
  entries: PasswordEntry[];
  categories: PasswordCategory[];
  settings: any;
  domains: any[]; // Trusted domains list
  metadata: BackupMetadata;
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
        content = await this.encryptData(content, options.encryptionPassword);
        console.log(
          '🟣 [BackupService] Encrypted size:',
          content.length,
          'bytes',
        );
      }

      // Write to file
      console.log('🟣 [BackupService] Writing to file:', fullPath);
      await RNFS.writeFile(fullPath, content, 'utf8');
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

      // Decrypt if needed
      if (options.decryptionPassword) {
        try {
          content = (await this.decryptData(
            content,
            options.decryptionPassword,
          )) as string;
        } catch (error) {
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
      // CRITICAL: Get encrypted entries from database to preserve encryption
      // This matches the export flow behavior
      const { EncryptedDatabaseService } = await import(
        './encryptedDatabaseService'
      );
      const dbService = EncryptedDatabaseService.getInstance();
      const encryptedEntries = await dbService.getAllEncryptedEntries();
      console.log(
        `🟣 [BackupService] Loaded ${encryptedEntries.length} encrypted entries from database`,
      );

      // Map entries with encrypted password data
      processedEntries = entries.map(entry => {
        // Find the encrypted entry from database
        const encryptedEntry = encryptedEntries.find(e => e.id === entry.id);

        if (encryptedEntry) {
          // Preserve the ALREADY ENCRYPTED password data directly
          // This preserves the original encryption without re-encrypting
          return {
            ...entry,
            password: encryptedEntry.encryptedData,
            salt: encryptedEntry.salt,
            iv: encryptedEntry.iv,
            authTag: encryptedEntry.authTag,
            isPasswordEncrypted: true,
          };
        } else {
          console.warn(
            `⚠️ [BackupService] Could not find encrypted data for: ${entry.title}`,
          );
          return {
            ...entry,
            password: '',
            isPasswordEncrypted: false,
          };
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

    // Create metadata
    const metadata: BackupMetadata = {
      appVersion,
      platform: `${Platform.OS} ${systemVersion}`,
      deviceId,
      entryCount: entries.length,
      categoryCount: categories.length,
      domainCount: backupDomains.length,
      encryptionMethod: options.encryptBackup ? 'AES-256-GCM' : 'none',
      compressionMethod: options.compressBackup ? 'gzip' : 'none',
      backupSize: 0, // Will be calculated after compression/encryption
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
      const derivedKey = await deriveKeyFromPassword(password, salt);

      // Generate IV for encryption
      const iv = generateSecureRandom(16);

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

      // Derive key from password and salt
      const derivedKey = await deriveKeyFromPassword(password, salt);

      // Decrypt the data
      return decryptData(ciphertext, derivedKey, iv, tag);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(
        'Failed to decrypt data: ' +
          (error instanceof Error ? error.message : String(error)),
      );
    }
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
    entries: PasswordEntry[],
    _options: RestoreOptions,
  ): PasswordEntry[] {
    return entries.map(entry => ({
      ...entry,
      id: this.generateId(), // Generate new IDs to avoid conflicts
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
    }));
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
}

export { BackupService };
export const backupService = new BackupService();
export default backupService;
