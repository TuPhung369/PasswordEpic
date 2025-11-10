import { PasswordEntry, CustomField } from '../types/password';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import CryptoJS from 'crypto-js';
import { getEffectiveMasterPassword } from './staticMasterPasswordService';
import {
  encryptedDatabase,
  EncryptedDatabaseService,
} from './encryptedDatabaseService';
import { getCurrentUser } from './firebase';
import { decryptData, deriveKeyFromPassword } from './cryptoService';
import FilePicker from '../modules/FilePicker';

// Test if encryption key is correct by trying to decrypt/encrypt a test string
const validateEncryptionKey = (encryptionKey: string): boolean => {
  try {
    const testString = 'test_validation_string';
    const encrypted = CryptoJS.AES.encrypt(
      testString,
      encryptionKey,
    ).toString();
    const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey).toString(
      CryptoJS.enc.Utf8,
    );

    const isValid = decrypted === testString;
    console.log(
      '🔍 [Validation] Encryption key validation:',
      isValid ? 'PASSED' : 'FAILED',
    );
    return isValid;
  } catch (error) {
    console.log('🔍 [Validation] Key validation check failed:', error.message);
    return false;
  }
};

// Generate secure export key from masterPassword + email + uid (NEW - Enhanced Security)
const generateSecureExportKey = (
  masterPassword: string | null,
  email: string,
  uid: string,
): string => {
  // Combine master password with user identifiers
  // This key is NEVER stored in metadata, only reconstructed during import
  const exportKey = `${masterPassword}::${email}::${uid}`;

  console.log('🔐 [SecureExportKey] Generated secure export key:', {
    pattern: 'masterPassword::email::uid',
    keyLength: exportKey.length,
    keyHash: CryptoJS.SHA256(exportKey).toString().substring(0, 16),
    preview: exportKey.substring(0, 50) + (exportKey.length > 50 ? '...' : ''),
  });

  return exportKey;
};

// Helper function to log current encryption context for debugging
const logEncryptionContext = (currentUser: any, encryptedPassword: string) => {
  console.log('🔍 [Context] Current encryption context:', {
    userAuthenticated: !!currentUser,
    uid: currentUser?.uid?.substring(0, 20) + '...' || 'None',
    email: currentUser?.email || 'None',
    encryptedLength: encryptedPassword.length,
    encryptedPreview: encryptedPassword.substring(0, 30) + '...',
    startsWithSalted: encryptedPassword.startsWith('U2FsdGVkX1'),
    currentTimestamp: Date.now(),
    currentTime: new Date().toISOString(),
  });
};

// Comprehensive key testing function based on actual logs and patterns
const testAllPossibleKeys = (
  encryptedPassword: string,
  currentUser: any,
  options?: any,
): { success: boolean; password: string; method?: string; error?: string } => {
  console.log('🔍 [TestKeys] Testing all possible key patterns...');

  if (!currentUser || !encryptedPassword) {
    return {
      success: false,
      password: encryptedPassword,
      error: 'Missing user or encrypted password',
    };
  }

  // Log current context for debugging
  logEncryptionContext(currentUser, encryptedPassword);

  // Based on your logs, these are the patterns that might work
  const keyPatterns = [
    // Pattern 1: Simple UID only (this worked for FB accounts in logs)
    currentUser.uid,

    // Pattern 2: Static export/import pattern
    `${currentUser.uid}::${currentUser.email || 'anonymous'}`,

    // Pattern 3: Current session timestamp patterns (from logs)
    `${currentUser.uid}::1760074390006::${currentUser.email || 'anonymous'}`,
    `${currentUser.uid}::1760074390006::${
      currentUser.email || 'anonymous'
    }::8f8f59a5585f7dfe`,

    // Pattern 4: Entry timestamp patterns (from failed decryption logs)
    `${currentUser.uid}::1760077343497::${currentUser.email || 'anonymous'}`,
    `${currentUser.uid}::1760077343497::${
      currentUser.email || 'anonymous'
    }::8f8f59a5585f7dfe`,

    // Pattern 5: Different separators
    `${currentUser.uid}_${currentUser.email}`,
    `${currentUser.uid}-${currentUser.email}`,

    // Pattern 6: Email only
    currentUser.email,

    // Pattern 7: Truncated patterns
    currentUser.uid.substring(0, 12),
    currentUser.uid.substring(0, 16),
    currentUser.uid.substring(0, 20),

    // Pattern 8: Alternative options if provided
    ...(options?._alternativeKeys || []),
    ...(options?._originalEncryptionKey
      ? [options._originalEncryptionKey]
      : []),
  ];

  console.log(`🔑 [TestKeys] Testing ${keyPatterns.length} key patterns...`);

  for (let i = 0; i < keyPatterns.length; i++) {
    const key = keyPatterns[i];
    if (!key) continue;

    try {
      console.log(
        `🔄 [TestKeys] Testing pattern ${i + 1}: ${key.substring(0, 20)}...`,
      );

      const decrypted = CryptoJS.AES.decrypt(encryptedPassword, key);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

      if (decryptedString && decryptedString.trim().length > 0) {
        console.log(`✅ [TestKeys] SUCCESS with pattern ${i + 1}!`);
        console.log(
          `🔑 [TestKeys] Working key pattern: ${key.substring(0, 30)}...`,
        );
        console.log(
          `🔓 [TestKeys] Decrypted result: ${decryptedString.substring(
            0,
            10,
          )}...`,
        );

        return {
          success: true,
          password: decryptedString,
          method: `pattern_${i + 1}_${key.substring(0, 10)}`,
        };
      }
    } catch (error: any) {
      console.log(`❌ [TestKeys] Pattern ${i + 1} failed: ${error.message}`);
    }
  }

  console.log('❌ [TestKeys] All key patterns failed');
  return {
    success: false,
    password: encryptedPassword,
    error: 'All key patterns failed',
  };
};

// Analyze encrypted string to understand its format
const analyzeEncryptedString = (
  encryptedString: string,
): {
  format: string;
  details: any;
} => {
  const analysis = {
    length: encryptedString.length,
    startsWithSalted: encryptedString.startsWith('U2FsdGVkX1'), // "Salted__" in base64
    isBase64: /^[A-Za-z0-9+/]+=*$/.test(encryptedString),
    firstChars: encryptedString.substring(0, 20),
    lastChars: encryptedString.substring(-10),
  };

  if (analysis.startsWithSalted) {
    return {
      format: 'CryptoJS_AES_with_salt',
      details: analysis,
    };
  }

  if (analysis.isBase64) {
    return {
      format: 'Base64_encoded',
      details: analysis,
    };
  }

  return {
    format: 'Unknown',
    details: analysis,
  };
};

// Advanced decryption function with better error handling
const advancedDecryptPassword = (
  encryptedPassword: string,
  encryptionKey: string,
  options?: any,
): { success: boolean; password: string; method?: string; error?: string } => {
  if (!encryptedPassword || !encryptionKey) {
    return {
      success: false,
      password: encryptedPassword,
      error: 'Missing password or key',
    };
  }

  // Analyze the encrypted string first
  const analysis = analyzeEncryptedString(encryptedPassword);
  // console.log('🔍 [Advanced] Encrypted string analysis:', analysis);

  // Strategy 1: Standard CryptoJS AES decryption (recommended approach)
  try {
    // console.log('🔄 [Advanced] Trying standard CryptoJS AES decryption...');
    const decrypted = CryptoJS.AES.decrypt(encryptedPassword, encryptionKey);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

    if (decryptedString && decryptedString.trim().length > 0) {
      console.log('✅ [Advanced] Standard AES decryption succeeded');
      return {
        success: true,
        password: decryptedString,
        method: 'standard_aes',
      };
    } else {
      console.log(
        '❌ [Advanced] Standard AES decryption returned empty string',
      );
    }
  } catch (error: any) {
    console.log('❌ [Advanced] Standard AES decryption failed:', error.message);
  }

  // Strategy 1.5: Try alternative keys if available (from key comparison)
  if (options?._alternativeKeys && Array.isArray(options._alternativeKeys)) {
    for (let i = 0; i < options._alternativeKeys.length; i++) {
      const altKey = options._alternativeKeys[i];
      try {
        // console.log(`🔄 [Advanced] Trying alternative key ${i + 1}...`);
        const decrypted = CryptoJS.AES.decrypt(encryptedPassword, altKey);
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

        if (decryptedString && decryptedString.trim().length > 0) {
          console.log(
            `✅ [Advanced] Alternative key ${i + 1} decryption succeeded`,
          );
          return {
            success: true,
            password: decryptedString,
            method: `alternative_key_${i + 1}`,
          };
        }
      } catch (error: any) {
        console.log(
          `❌ [Advanced] Alternative key ${i + 1} failed:`,
          error.message,
        );
      }
    }
  }

  // Strategy 2: Try alternative key derivations (in case session changed)
  try {
    // console.log('🔄 [Advanced] Trying alternative key derivations...');

    // Get current user info for alternative key generation
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Try with just the base components (without session salt)
      const baseKey = `${currentUser.uid}::${currentUser.email || 'anonymous'}`;
      // console.log('🔑 [Advanced] Trying base key derivation...');

      const decrypted = CryptoJS.AES.decrypt(encryptedPassword, baseKey);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

      if (decryptedString && decryptedString.trim().length > 0) {
        console.log('✅ [Advanced] Base key decryption succeeded');
        return { success: true, password: decryptedString, method: 'base_key' };
      }
    }
  } catch (error: any) {
    console.log(
      '❌ [Advanced] Alternative key derivation failed:',
      error.message,
    );
  }

  // Strategy 3: Check if it's not actually encrypted (just base64 encoded)
  if (
    analysis.format === 'Base64_encoded' &&
    !analysis.details.startsWithSalted
  ) {
    try {
      console.log('🔄 [Advanced] Trying base64 decode only...');
      const decoded = CryptoJS.enc.Base64.parse(encryptedPassword).toString(
        CryptoJS.enc.Utf8,
      );
      if (decoded && decoded.trim().length > 0) {
        console.log('✅ [Advanced] Base64 decode succeeded');
        return { success: true, password: decoded, method: 'base64_only' };
      }
    } catch (error: any) {
      console.log('❌ [Advanced] Base64 decode failed:', error.message);
    }
  }

  // Strategy 4: Try with a simplified version of the current key
  try {
    // console.log('🔄 [Advanced] Trying simplified key version...');
    // Extract just the core components from the current key
    const keyParts = encryptionKey.split('::');
    if (keyParts.length >= 2) {
      const simplifiedKey = `${keyParts[0]}::${keyParts[1]}`;

      const decrypted = CryptoJS.AES.decrypt(encryptedPassword, simplifiedKey);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

      if (decryptedString && decryptedString.trim().length > 0) {
        console.log('✅ [Advanced] Simplified key decryption succeeded');
        return {
          success: true,
          password: decryptedString,
          method: 'simplified_key',
        };
      }
    }
  } catch (error: any) {
    console.log(
      '❌ [Advanced] Simplified key decryption failed:',
      error.message,
    );
  }

  // Strategy 5: Try common legacy key patterns that might have been used
  try {
    // console.log('🔄 [Advanced] Trying legacy key patterns...');
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.email) {
      // Try patterns that might have been used in older versions
      // Since "oioIuKovQe..." (user ID) worked for FB, let's try more variations
      const legacyPatterns = [
        // Basic patterns
        currentUser.uid, // This worked for FB!
        currentUser.email,
        `${currentUser.uid}_${currentUser.email}`,
        `master_${currentUser.uid}`,
        `password_${currentUser.email}`,

        // Timestamp-based patterns (from export info)
        `${currentUser.uid}::1760007498368`, // With export timestamp
        `${currentUser.uid}::1760007498368::${currentUser.email}`, // Export timestamp + email
        `${currentUser.uid}::${currentUser.email}`, // Just UID + email

        // Session-based patterns
        `${currentUser.uid}::1760074390006`, // With current session timestamp
        `${currentUser.uid}::1760074390006::${currentUser.email}`, // Current session + email

        // Different separators
        `${currentUser.uid}_1760007498368`, // Underscore separator
        `${currentUser.uid}-${currentUser.email}`, // Dash separator
        `${currentUser.uid}|${currentUser.email}`, // Pipe separator

        // Truncated versions
        currentUser.uid.substring(0, 12), // First 12 chars of UID
        currentUser.uid.substring(0, 16), // First 16 chars of UID

        // With different salts (guessing common patterns)
        `${currentUser.uid}::${currentUser.email}::salt`,
        `${currentUser.uid}::${currentUser.email}::session`,
      ];

      for (const pattern of legacyPatterns) {
        try {
          const decrypted = CryptoJS.AES.decrypt(encryptedPassword, pattern);
          const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

          if (decryptedString && decryptedString.trim().length > 0) {
            console.log(
              `✅ [Advanced] Legacy pattern decryption succeeded: ${pattern.substring(
                0,
                10,
              )}...`,
            );
            return {
              success: true,
              password: decryptedString,
              method: `legacy_${pattern.substring(0, 10)}`,
            };
          }
        } catch (legacyError) {
          // Continue to next pattern
        }
      }
    }
  } catch (error: any) {
    console.log(
      '❌ [Advanced] Legacy pattern decryption failed:',
      error.message,
    );
  }

  // Strategy 6: Comprehensive key testing (all possible patterns)
  try {
    const currentUser = getCurrentUser();
    if (currentUser) {
      console.log('🔄 [Advanced] Running comprehensive key testing...');

      const testResult = testAllPossibleKeys(
        encryptedPassword,
        currentUser,
        options,
      );
      if (testResult.success) {
        console.log(
          `✅ [Advanced] Comprehensive test succeeded with method: ${testResult.method}`,
        );
        return testResult;
      } else {
        console.log(
          `❌ [Advanced] Comprehensive test failed: ${testResult.error}`,
        );
      }
    }
  } catch (error: any) {
    console.log(
      '❌ [Advanced] Comprehensive key testing failed:',
      error.message,
    );
  }

  console.log('❌ [Advanced] All decryption strategies failed');
  return {
    success: false,
    password: encryptedPassword,
    error: 'All decryption strategies failed',
    method: 'none',
  };
};

const decryptPassword = (
  encryptedPassword: string,
  encryptionKey: string,
): string => {
  try {
    // If the password is empty or doesn't look encrypted, return as-is
    if (!encryptedPassword || encryptedPassword.trim().length === 0) {
      return encryptedPassword;
    }

    // Check if it looks like a CryptoJS encrypted string (base64 with salt)
    const isBase64Encrypted =
      /^[A-Za-z0-9+/]+={0,2}$/.test(encryptedPassword) &&
      encryptedPassword.length > 20;

    // Check if it starts with "U2FsdGVkX1" which is "Salted__" in base64
    const isSaltedEncryption = encryptedPassword.startsWith('U2FsdGVkX1');

    if (!isBase64Encrypted && !isSaltedEncryption) {
      // Doesn't look like encrypted data, return as-is
      console.log(
        "🔍 [Decrypt] Data doesn't appear to be encrypted, returning as-is",
      );
      return encryptedPassword;
    }

    // console.log('🔓 [Decrypt] Attempting to decrypt AES data...', {
    //   encryptedLength: encryptedPassword.length,
    //   isSalted: isSaltedEncryption,
    //   keyLength: encryptionKey?.length || 0,
    // });

    const decrypted = CryptoJS.AES.decrypt(encryptedPassword, encryptionKey);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

    // If decryption results in empty string, it likely failed (wrong key or corrupted data)
    if (!decryptedString || decryptedString.trim().length === 0) {
      // console.warn(
      //   '⚠️ Decryption resulted in empty string - possible wrong key or corrupted data',
      // );
      // console.warn('🔍 [Decrypt] Failure details:', {
      //   encryptedPreview: encryptedPassword.substring(0, 50) + '...',
      //   keyPreview: encryptionKey.substring(0, 10) + '...',
      //   decryptedLength: decryptedString?.length || 0,
      // });
      return encryptedPassword;
    }

    // console.log('✅ [Decrypt] Successfully decrypted password');
    return decryptedString;
  } catch (error: any) {
    console.log(
      '🔄 [Decrypt] Standard decryption attempt failed:',
      error.message,
    );
    console.log('🔍 [Decrypt] Will try alternative methods:', {
      errorMessage: error.message,
      errorType: error.name,
      encryptedLength: encryptedPassword.length,
      encryptedPreview: encryptedPassword.substring(0, 50) + '...',
      keyLength: encryptionKey?.length || 0,
      keyPreview: encryptionKey?.substring(0, 10) + '...' || 'null',
    });

    // Try comprehensive key testing as fallback
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        console.log(
          '🔄 [Decrypt] Trying comprehensive key testing fallback...',
        );
        const testResult = testAllPossibleKeys(encryptedPassword, currentUser);

        if (testResult.success) {
          console.log(
            `✅ [Decrypt] Comprehensive fallback succeeded with method: ${testResult.method}`,
          );
          return testResult.password;
        } else {
          console.log(
            `❌ [Decrypt] Comprehensive fallback failed: ${testResult.error}`,
          );
        }
      }
    } catch (fallbackError: any) {
      console.log(
        '🔍 [Decrypt] Comprehensive fallback error:',
        fallbackError.message,
      );
    }
    return encryptedPassword; // Return encrypted if decryption fails
  }
};

export interface ImportOptions {
  format:
    | 'json'
    | 'csv'
    | 'xlsx'
    | 'bitwarden'
    | 'lastpass'
    | 'chrome'
    | 'firefox'
    | 'safari';
  mergeStrategy: 'replace' | 'merge' | 'skip';
  categoryMapping?: { [key: string]: string };
  defaultCategory?: string;
  encryptionPassword?: string;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf' | 'html';
  includePasswords: boolean;
  includeNotes: boolean;
  includeCustomFields: boolean;
  categories?: string[];
  tags?: string[];
  encryptionPassword?: string;
  fileName?: string;
  destinationFolder?: string;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  duplicateCount: number;
  errors: Array<{ line: number; error: string; data?: any }>;
  warnings: Array<{ line: number; warning: string; data?: any }>;
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  exportedCount: number;
  errors: string[];
}

export interface ImportPreview {
  totalEntries: number;
  sampleEntries: PasswordEntry[];
  detectedFormat: string;
  hasPasswords: boolean;
  categories: string[];
  duplicates: Array<{ existing: PasswordEntry; imported: PasswordEntry }>;
  issues: Array<{ type: 'warning' | 'error'; message: string; count: number }>;
}

class ImportExportService {
  private readonly SUPPORTED_FORMATS = {
    import: [
      'json',
      'csv',
      'xlsx',
      'bitwarden',
      'lastpass',
      'chrome',
      'firefox',
      'safari',
    ],
    export: ['json', 'csv', 'xlsx', 'pdf', 'html'],
  };

  // Import passwords from file
  async importPasswords(
    filePath: string,
    existingEntries: PasswordEntry[],
    options: ImportOptions,
  ): Promise<ImportResult> {
    try {
      console.log('🔄 [Import] Starting import process...', {
        filePath,
        format: options.format,
        hasEncryptionPassword: !!options.encryptionPassword,
      });

      // NEW SECURITY STRATEGY: Reconstruct secure export key from current credentials
      // Key format: masterPassword::email::uid (same as export time)
      const masterPasswordResult = await getEffectiveMasterPassword();
      const masterPassword = masterPasswordResult.success
        ? masterPasswordResult.password
        : null;

      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.email || !currentUser.uid) {
        throw new Error(
          'User not authenticated - cannot reconstruct import key',
        );
      }

      // Reconstruct the EXACT export key that was used during export
      const reconstructedExportKey = generateSecureExportKey(
        masterPassword,
        currentUser.email,
        currentUser.uid,
      );

      // Log key reconstruction
      console.log('🔐 [Import] Reconstructed secure import key:', {
        pattern: 'masterPassword::email::uid',
        keyLength: reconstructedExportKey.length,
        keyHash: CryptoJS.SHA256(reconstructedExportKey)
          .toString()
          .substring(0, 16),
        userEmail: currentUser.email,
        userUid: currentUser.uid?.substring(0, 10) + '...',
      });

      // CRITICAL FIX: Set up key hierarchy correctly
      // Passwords were encrypted with: deriveKeyFromPassword(masterPassword, salt)
      // NOT with the export key format, so we must try the original master password FIRST
      if (!(options as any)._alternativeKeys) {
        (options as any)._alternativeKeys = [];
      }

      // PRIMARY KEY: Use the original master password (this is what was used during encryption)
      options.encryptionPassword = masterPassword;

      // FALLBACK: Add reconstructed export key as alternative
      // This handles cases where export key was used during encryption
      if (reconstructedExportKey !== masterPassword) {
        (options as any)._alternativeKeys.push(reconstructedExportKey);
        console.log(
          '🔄 [Import] Using master password as primary, export key as fallback',
        );
      }

      // Add user-provided encryption password as last resort (if provided)
      if (
        options.encryptionPassword &&
        options.encryptionPassword !== masterPassword
      ) {
        (options as any)._alternativeKeys.push(options.encryptionPassword);
        console.log(
          '🔄 [Import] Added user-provided key as additional fallback',
        );
      }

      // Validate encryption key
      const isKeyValid = validateEncryptionKey(masterPassword || '');
      if (!isKeyValid) {
        console.warn(
          '⚠️ [Import] Master password validation failed - decryption may encounter issues',
        );
      }

      const fileContent = await RNFS.readFile(filePath, 'utf8');
      console.log(
        '📁 [Import] File read successfully, size:',
        fileContent.length,
      );

      const parsedData = await this.parseImportData(
        fileContent,
        options.format,
      );
      console.log('📊 [Import] Data parsed, entries found:', parsedData.length);

      console.log('✅ [Import] Key preparation complete:', {
        primaryKeyLength: options.encryptionPassword?.length || 0,
        primaryKeyHash: options.encryptionPassword
          ? CryptoJS.SHA256(options.encryptionPassword)
              .toString()
              .substring(0, 16)
          : 'null',
        alternativeKeysCount: ((options as any)._alternativeKeys || []).length,
        version: 'v2.0-secure-export',
      });

      const result: ImportResult = {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        duplicateCount: 0,
        errors: [],
        warnings: [],
      };

      const processedEntries: PasswordEntry[] = [];

      console.log('💾 [Import] Processing entries and preparing for save...');

      for (let i = 0; i < parsedData.length; i++) {
        try {
          const rawEntry = parsedData[i];
          const entry = await this.normalizeImportEntry(
            rawEntry,
            options,
            i + 1,
          );

          if (!entry) {
            result.skippedCount++;
            continue;
          }

          // Check for duplicates
          const existingEntry = this.findDuplicateEntry(
            entry,
            existingEntries.concat(processedEntries),
          );

          if (existingEntry) {
            result.duplicateCount++;

            switch (options.mergeStrategy) {
              case 'skip':
                result.skippedCount++;
                result.warnings.push({
                  line: i + 1,
                  warning: `Duplicate entry skipped: ${entry.title}`,
                  data: entry,
                });
                continue;

              case 'replace':
                const index = processedEntries.findIndex(
                  e => e.id === existingEntry.id,
                );
                if (index >= 0) {
                  processedEntries[index] = { ...entry, id: existingEntry.id };
                } else {
                  processedEntries.push({ ...entry, id: existingEntry.id });
                }
                result.importedCount++;
                break;

              case 'merge':
                const mergedEntry = this.mergeEntries(existingEntry, entry);
                const mergeIndex = processedEntries.findIndex(
                  e => e.id === existingEntry.id,
                );
                if (mergeIndex >= 0) {
                  processedEntries[mergeIndex] = mergedEntry;
                } else {
                  processedEntries.push(mergedEntry);
                }
                result.importedCount++;
                break;
            }
          } else {
            processedEntries.push(entry);
            result.importedCount++;
            console.log(
              `✅ [Import] Entry ${i + 1} imported successfully: ${
                entry.title
              }`,
            );
          }
        } catch (error) {
          console.error(`❌ [Import] Error processing entry ${i + 1}:`, error);
          result.errorCount++;
          result.errors.push({
            line: i + 1,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: parsedData[i],
          });
        }
      }

      // Save processed entries to database
      if (processedEntries.length > 0 && options.encryptionPassword) {
        console.log(
          '💾 [Import] Saving entries to database...',
          processedEntries.length,
        );

        try {
          console.log('📦 [Import] Using optimized storage format');

          for (let i = 0; i < processedEntries.length; i++) {
            const entry = processedEntries[i];
            const rawEntry = parsedData[i];

            // Check if this entry has encrypted data from export
            if (
              rawEntry.salt &&
              rawEntry.iv &&
              rawEntry.authTag &&
              rawEntry.password
            ) {
              // This is an encrypted entry from our export format
              // We need to decrypt it first, then re-encrypt with current format
              console.log(
                `🔓 [Import] Decrypting exported entry: ${entry.title}`,
              );

              try {
                // CRITICAL: The exported entry was encrypted with the MASTER PASSWORD
                // NOT with options.encryptionPassword. Use master password to decrypt.
                if (!masterPassword) {
                  throw new Error(
                    'Cannot decrypt exported entries: Master password not available',
                  );
                }

                let decryptedPassword: string | null = null;
                let keysToTry = [masterPassword];

                // Add alternative keys if primary key failed
                if ((options as any)._alternativeKeys) {
                  keysToTry = keysToTry.concat(
                    (options as any)._alternativeKeys,
                  );
                }

                console.log(
                  `🔑 [Import] Attempting decryption with ${keysToTry.length} key(s) for: ${entry.title}`,
                );

                // Debug: Log all keys being tried
                keysToTry.forEach((key, idx) => {
                  const keyPreview = key
                    ? key.substring(0, 50) + (key.length > 50 ? '...' : '')
                    : 'null';
                  const keyLength = key?.length || 0;
                  console.log(
                    `  └─ Key ${idx + 1}/${
                      keysToTry.length
                    }: length=${keyLength}, preview="${keyPreview}"`,
                  );
                });

                // Try each key until one works
                for (
                  let keyIndex = 0;
                  keyIndex < keysToTry.length;
                  keyIndex++
                ) {
                  try {
                    const keyToTry = keysToTry[keyIndex];
                    const derivedKey = deriveKeyFromPassword(
                      keyToTry,
                      rawEntry.salt,
                    );
                    const attemptedDecryption = decryptData(
                      rawEntry.password,
                      derivedKey,
                      rawEntry.iv,
                      rawEntry.authTag,
                    );

                    // Success!
                    decryptedPassword = attemptedDecryption;
                    const successfulKey = keysToTry[keyIndex];
                    const successfulKeyPreview = successfulKey
                      ? successfulKey.substring(0, 60) +
                        (successfulKey.length > 60 ? '...' : '')
                      : 'null';
                    console.log(
                      `✅ [Import] Successfully decrypted with key ${
                        keyIndex + 1
                      }: ${entry.title}`,
                    );
                    console.log(
                      `   🔑 Key content: "${successfulKeyPreview}" (length: ${successfulKey?.length})`,
                    );
                    break;
                  } catch (keyError) {
                    console.log(
                      `⚠️ [Import] Key ${keyIndex + 1} failed for ${
                        entry.title
                      }`,
                    );
                    if (keyIndex === keysToTry.length - 1) {
                      // Last key failed
                      throw keyError;
                    }
                  }
                }

                if (!decryptedPassword) {
                  throw new Error('All decryption attempts failed');
                }

                // Update entry with decrypted password
                const entryWithPassword = {
                  ...entry,
                  password: decryptedPassword,
                };

                // Re-encrypt and save using current storage format
                await encryptedDatabase.savePasswordEntry(
                  entryWithPassword,
                  options.encryptionPassword,
                );
                console.log(
                  `💾 [Import] Re-encrypted and saved: ${entry.title}`,
                );
              } catch (decryptError) {
                console.error(
                  `❌ [Import] Failed to decrypt entry ${entry.title}:`,
                  decryptError,
                );
                throw new Error(
                  `Failed to decrypt imported entry: ${decryptError.message}`,
                );
              }
            } else {
              // This is a plaintext entry or from another format
              // Encrypt and save
              await encryptedDatabase.savePasswordEntry(
                entry,
                options.encryptionPassword,
              );
              console.log(`💾 [Import] Encrypted and saved: ${entry.title}`);
            }
          }
          console.log('✅ [Import] All entries saved to database successfully');
        } catch (saveError) {
          console.error('❌ [Import] Database save error:', saveError);
          result.success = false;
          result.errors.push({
            line: 0,
            error: `Failed to save to database: ${saveError.message}`,
          });
        }
      }

      result.success = result.errorCount === 0 || result.importedCount > 0;

      console.log('✅ [Import] Import process completed:', {
        success: result.success,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errorCount,
        duplicateCount: result.duplicateCount,
        errors: result.errors.map(e => e.error),
        warnings: result.warnings.map(w => w.warning),
      });

      return result;
    } catch (error) {
      console.error('💥 [Import] Import failed with error:', error);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        duplicateCount: 0,
        errors: [
          {
            line: 0,
            error:
              error instanceof Error ? error.message : 'Failed to read file',
          },
        ],
        warnings: [],
      };
    }
  }

  // Export passwords to file
  async exportPasswords(
    entries: PasswordEntry[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    try {
      console.log('🔄 Starting export process...', {
        entriesCount: entries.length,
        format: options.format,
        options,
      });

      // Filter entries based on options
      let filteredEntries = [...entries];

      if (options.categories && options.categories.length > 0) {
        filteredEntries = filteredEntries.filter(entry =>
          options.categories!.includes(entry.category),
        );
      }

      if (options.tags && options.tags.length > 0) {
        filteredEntries = filteredEntries.filter(entry =>
          entry.tags.some(tag => options.tags!.includes(tag)),
        );
      }

      // Get master password and current user info for secure export key generation
      const masterPasswordResult = await getEffectiveMasterPassword();
      const masterPassword = masterPasswordResult.success
        ? masterPasswordResult.password
        : null;

      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated - cannot generate export key');
      }

      // Generate secure export key: masterPassword::email::uid
      // This key is NEVER stored in metadata (security enhancement)
      const exportKey = generateSecureExportKey(
        masterPassword,
        currentUser.email,
        currentUser.uid,
      );

      // Generate export data (using secure export key)
      const exportData = await this.prepareExportData(
        filteredEntries,
        options,
        exportKey,
      );

      // Generate file content (pass masterPassword for metadata, but NOT the export key)
      const fileContent = await this.generateExportContent(
        exportData,
        options,
        masterPassword,
        exportKey, // For validation only, not stored
      );

      // Generate file path
      const fileName =
        options.fileName || this.generateFileName(options.format);
      const filePath = await this.saveExportFile(
        fileContent,
        fileName,
        options,
      );

      return {
        success: true,
        filePath,
        exportedCount: filteredEntries.length,
        errors: [],
      };
    } catch (error) {
      return {
        success: false,
        filePath: '',
        exportedCount: 0,
        errors: [error instanceof Error ? error.message : 'Export failed'],
      };
    }
  }

  // Preview import data before actual import
  async previewImport(
    filePath: string,
    format: string,
  ): Promise<ImportPreview> {
    try {
      const fileContent = await RNFS.readFile(filePath, 'utf8');
      const parsedData = await this.parseImportData(fileContent, format as any);

      const preview: ImportPreview = {
        totalEntries: parsedData.length,
        sampleEntries: [],
        detectedFormat: format,
        hasPasswords: false,
        categories: [],
        duplicates: [],
        issues: [],
      };

      const categories = new Set<string>();
      const issues = new Map<string, number>();
      let hasPasswords = false;

      // Process first 5 entries for preview
      for (let i = 0; i < Math.min(5, parsedData.length); i++) {
        try {
          const entry = await this.normalizeImportEntry(
            parsedData[i],
            { format: format as any, mergeStrategy: 'skip' },
            i + 1,
          );
          if (entry) {
            preview.sampleEntries.push(entry);
            categories.add(entry.category);
            if (entry.password && entry.password.length > 0) {
              hasPasswords = true;
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          issues.set(errorMessage, (issues.get(errorMessage) || 0) + 1);
        }
      }

      preview.categories = Array.from(categories);
      preview.hasPasswords = hasPasswords;
      preview.issues = Array.from(issues.entries()).map(([message, count]) => ({
        type: 'warning' as const,
        message,
        count,
      }));

      return preview;
    } catch (error) {
      return {
        totalEntries: 0,
        sampleEntries: [],
        detectedFormat: format,
        hasPasswords: false,
        categories: [],
        duplicates: [],
        issues: [
          {
            type: 'error',
            message:
              error instanceof Error ? error.message : 'Failed to preview file',
            count: 1,
          },
        ],
      };
    }
  }

  // Parse different file formats
  private async parseImportData(
    content: string,
    format: string,
  ): Promise<any[]> {
    switch (format) {
      case 'json':
        console.log('🔍 [Import] Parsing JSON content...');
        const jsonData = JSON.parse(content);
        console.log('📋 [Import] JSON structure:', Object.keys(jsonData));

        // Handle new format with exportInfo and entries
        if (jsonData.exportInfo && jsonData.entries) {
          console.log('📦 [Import] New format detected:', jsonData.exportInfo);
          return jsonData.entries;
        }

        // Handle legacy array format
        if (Array.isArray(jsonData)) {
          console.log('📜 [Import] Legacy array format detected');
          return jsonData;
        }

        // Handle object format
        console.log('📄 [Import] Object format detected');
        return [jsonData];

      case 'csv':
        return this.parseCSV(content);

      case 'xlsx':
        return this.parseXLSX(content);

      case 'bitwarden':
        return this.parseBitwardenExport(content);

      case 'lastpass':
        return this.parseLastPassExport(content);

      case 'chrome':
        return this.parseChromeExport(content);

      case 'firefox':
        return this.parseFirefoxExport(content);

      case 'safari':
        return this.parseSafariExport(content);

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  // Parse CSV content
  private parseCSV(content: string): any[] {
    const lines = content.split('\n');
    if (lines.length < 2)
      throw new Error(
        'CSV file must have at least a header row and one data row',
      );

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      data.push(row);
    }

    return data;
  }

  // Parse CSV line with proper quote handling
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  // Parse XLSX content
  private parseXLSX(_content: string): any[] {
    // This would require proper XLSX parsing library
    // For now, throw error as placeholder
    throw new Error('XLSX import not yet implemented');
  }

  // Parse Bitwarden export
  private parseBitwardenExport(content: string): any[] {
    const data = JSON.parse(content);
    return data.items || [];
  }

  // Parse LastPass export
  private parseLastPassExport(content: string): any[] {
    // LastPass exports as CSV
    return this.parseCSV(content);
  }

  // Parse Chrome export
  private parseChromeExport(content: string): any[] {
    return this.parseCSV(content);
  }

  // Parse Firefox export
  private parseFirefoxExport(content: string): any[] {
    return this.parseCSV(content);
  }

  // Parse Safari export
  private parseSafariExport(content: string): any[] {
    return this.parseCSV(content);
  }

  // Normalize imported entry to our format
  private async normalizeImportEntry(
    rawEntry: any,
    options: ImportOptions,
    lineNumber: number,
  ): Promise<PasswordEntry | null> {
    if (!rawEntry || typeof rawEntry !== 'object') {
      throw new Error('Invalid entry data');
    }

    // console.log(
    //   `🔧 [Import] Processing entry ${lineNumber}:`,
    //   rawEntry.title || 'Unknown',
    // );

    // Common field mappings
    const fieldMappings = this.getFieldMappings(options.format);

    const title =
      this.extractField(rawEntry, fieldMappings.name) || `Import ${lineNumber}`;
    const username = this.extractField(rawEntry, fieldMappings.username) || '';
    let password = this.extractField(rawEntry, fieldMappings.password) || '';
    const website = this.extractField(rawEntry, fieldMappings.website) || '';
    const notes = this.extractField(rawEntry, fieldMappings.notes) || '';

    // Check if this is an encrypted entry from our export format
    // If it has salt, iv, and authTag, it's already encrypted - keep it as is
    if (rawEntry.salt && rawEntry.iv && rawEntry.authTag) {
      console.log(`🔐 [Import] Detected encrypted entry from export: ${title}`);
      // Password is already encrypted, don't decrypt it
      // It will be saved directly to database
    } else if (rawEntry.isPasswordEncrypted && options.encryptionPassword) {
      // This is an encrypted entry from another format (legacy)
      // Try to decrypt it
      // console.log('🔓 [Import] Decrypting password for:', title);
      // console.log('🔍 [Import] Debug info:', {
      //   hasEncryptionPassword: !!options.encryptionPassword,
      //   encryptionPasswordLength: options.encryptionPassword?.length || 0,
      //   passwordLength: password.length,
      //   passwordPreview: password.substring(0, 20) + '...',
      //   isPasswordEncrypted: rawEntry.isPasswordEncrypted,
      //   encryptionKeyHash: CryptoJS.SHA256(options.encryptionPassword)
      //     .toString()
      //     .substring(0, 16),
      // });

      // Test if the key can encrypt/decrypt correctly
      // const testDecryption = validateEncryptionKey(options.encryptionPassword);
      // console.log(
      //   '🔍 [Import] Encryption key validation result:',
      //   testDecryption,
      // );

      // Try basic decryption first
      let decryptedPassword = decryptPassword(
        password,
        options.encryptionPassword,
      );

      // If basic decryption failed, try advanced strategies
      let decryptionSuccess =
        decryptedPassword && decryptedPassword !== password;
      // let decryptionMethod = 'standard';

      if (!decryptionSuccess) {
        console.log(
          '🔄 [Import] Basic decryption failed, trying advanced strategies...',
        );
        const advancedResult = advancedDecryptPassword(
          password,
          options.encryptionPassword,
          options,
        );
        if (advancedResult.success) {
          decryptedPassword = advancedResult.password;
          decryptionSuccess = true;
          // decryptionMethod = advancedResult.method || 'advanced';
        } else {
          console.log(
            '🔄 [Import] Advanced decryption strategies tried, using encrypted value:',
            advancedResult.error,
          );
        }
      }

      if (decryptionSuccess) {
        password = decryptedPassword;
        // console.log(
        //   `✅ [Import] Password decrypted successfully for: ${title} (method: ${decryptionMethod})`,
        // );
      } else {
        // console.warn(
        //   '⚠️ [Import] Password decryption failed for:',
        //   title,
        //   '- using encrypted value',
        // );
        // // Additional debugging for failed decryption
        // console.warn('🔍 [Import] Decryption failure details:', {
        //   originalPassword: password.substring(0, 30) + '...',
        //   decryptedPassword:
        //     decryptedPassword?.substring(0, 30) + '...' || 'null',
        //   areEqual: decryptedPassword === password,
        //   decryptedLength: decryptedPassword?.length || 0,
        //   encryptedPasswordStartsWith: password.substring(0, 10),
        //   isBase64: /^[A-Za-z0-9+/]+=*$/.test(password),
        // });

        // Try a simple test: encrypt a test string and see if we can decrypt it
        try {
          const testString = 'test_password_123';
          const testEncrypted = CryptoJS.AES.encrypt(
            testString,
            options.encryptionPassword,
          ).toString();
          const testDecrypted = CryptoJS.AES.decrypt(
            testEncrypted,
            options.encryptionPassword,
          ).toString(CryptoJS.enc.Utf8);
          console.log('🧪 [Import] Round-trip test:', {
            testEncrypted: testEncrypted.substring(0, 30) + '...',
            testDecrypted,
            success: testDecrypted === testString,
          });
        } catch (testError) {
          console.log(
            '🧪 [Import] Round-trip test not available:',
            testError.message,
          );
        }
      }
    } else if (rawEntry.isPasswordEncrypted && !options.encryptionPassword) {
      console.warn(
        '⚠️ [Import] Password is encrypted but no encryption key provided for:',
        title,
      );
    } else if (!rawEntry.isPasswordEncrypted) {
      console.log('ℹ️ [Import] Password is not encrypted for:', title);
    }

    // Validate required fields
    if (!title.trim()) {
      throw new Error('Entry title is required');
    }

    // Determine category
    let category =
      this.extractField(rawEntry, fieldMappings.category) ||
      options.defaultCategory ||
      'Imported';

    if (options.categoryMapping && options.categoryMapping[category]) {
      category = options.categoryMapping[category];
    }

    // Parse custom fields
    const customFields: CustomField[] = [];
    if (fieldMappings.customFields) {
      fieldMappings.customFields.forEach((fieldName: string) => {
        const value = this.extractField(rawEntry, [fieldName]);
        if (value && value.trim()) {
          customFields.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: fieldName,
            value: value.trim(),
            type: 'text',
            isHidden: false,
            createdAt: new Date(),
          });
        }
      });
    }

    // Parse tags
    const tags: string[] = [];
    const tagsField = this.extractField(rawEntry, fieldMappings.tags);
    if (tagsField) {
      const parsedTags = tagsField
        .split(/[,;|]/)
        .map((tag: string) => tag.trim())
        .filter(Boolean);
      tags.push(...parsedTags);
    }

    const now = new Date();

    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      username: username.trim(),
      password: password.trim(),
      website: website.trim(),
      category: category.trim(),
      tags,
      notes: notes.trim(),
      customFields,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
    };
  }

  // Get field mappings for different formats
  private getFieldMappings(format: string): any {
    const mappings: { [key: string]: any } = {
      json: {
        name: ['name', 'title', 'site'],
        username: ['username', 'login', 'email'],
        password: ['password', 'pwd'],
        website: ['website', 'url', 'site'],
        notes: ['notes', 'note', 'description'],
        category: ['category', 'folder', 'group'],
        tags: ['tags', 'labels'],
      },
      csv: {
        name: ['name', 'title', 'site', 'account'],
        username: ['username', 'login', 'email', 'user'],
        password: ['password', 'pwd', 'pass'],
        website: ['website', 'url', 'site', 'domain'],
        notes: ['notes', 'note', 'description', 'comment'],
        category: ['category', 'folder', 'group', 'type'],
        tags: ['tags', 'labels', 'keywords'],
      },
      bitwarden: {
        name: ['name'],
        username: ['login.username'],
        password: ['login.password'],
        website: ['login.uris[0].uri'],
        notes: ['notes'],
        category: ['organizationId'],
        tags: ['collectionIds'],
      },
      lastpass: {
        name: ['name', 'account'],
        username: ['username'],
        password: ['password'],
        website: ['url'],
        notes: ['extra'],
        category: ['grouping'],
        tags: ['fav'],
      },
      chrome: {
        name: ['name'],
        username: ['username'],
        password: ['password'],
        website: ['url'],
        notes: ['note'],
        category: [''],
        tags: [''],
      },
    };

    return mappings[format] || mappings.csv;
  }

  // Extract field value using multiple possible field names
  private extractField(entry: any, fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
      if (fieldName.includes('.')) {
        // Handle nested fields like 'login.username'
        const value = this.getNestedValue(entry, fieldName);
        if (value !== undefined && value !== null) {
          return String(value);
        }
      } else {
        const value = entry[fieldName];
        if (value !== undefined && value !== null) {
          return String(value);
        }
      }
    }
    return '';
  }

  // Get nested object value
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const index = parseInt(
          key.substring(key.indexOf('[') + 1, key.indexOf(']')),
          10,
        );
        return current?.[arrayKey]?.[index];
      }
      return current?.[key];
    }, obj);
  }

  // Find duplicate entry
  private findDuplicateEntry(
    entry: PasswordEntry,
    existingEntries: PasswordEntry[],
  ): PasswordEntry | null {
    return (
      existingEntries.find(
        existing =>
          existing.title.toLowerCase() === entry.title.toLowerCase() &&
          existing.username.toLowerCase() === entry.username.toLowerCase() &&
          (existing.website || '').toLowerCase() ===
            (entry.website || '').toLowerCase(),
      ) || null
    );
  }

  // Merge two entries
  private mergeEntries(
    existing: PasswordEntry,
    imported: PasswordEntry,
  ): PasswordEntry {
    return {
      ...existing,
      password: imported.password || existing.password,
      notes: imported.notes || existing.notes,
      tags: [...new Set([...(existing.tags || []), ...(imported.tags || [])])],
      customFields: [
        ...(existing.customFields || []),
        ...(imported.customFields || []).filter(
          cf =>
            !(existing.customFields || []).some(ecf => ecf.name === cf.name),
        ),
      ],
      updatedAt: new Date(),
    };
  }

  // Prepare data for export
  private async prepareExportData(
    entries: PasswordEntry[],
    options: ExportOptions,
    exportKey?: string, // Secure export key (masterPassword::email::uid)
  ): Promise<any[]> {
    // Log the export key being used
    if (exportKey) {
      console.log('🔐 [Export] Using secure export key:', {
        keyLength: exportKey.length,
        keyHash: CryptoJS.SHA256(exportKey).toString().substring(0, 16),
        pattern: 'masterPassword::email::uid',
      });
    }

    // CRITICAL: Get encrypted entries from database to preserve encryption
    const dbService = EncryptedDatabaseService.getInstance();
    const encryptedEntries = await dbService.getAllEncryptedEntries();
    console.log(
      `📦 [Export] Loaded ${encryptedEntries.length} encrypted entries from database`,
    );

    return entries.map(entry => {
      const exportEntry: any = {
        title: entry.title,
        username: entry.username,
        website: entry.website || '',
        category: entry.category || '',
        tags: (entry.tags || []).join(', '),
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastUsed: entry.lastUsed,
      };

      if (options.includePasswords) {
        // Find the encrypted entry from database
        const encryptedEntry = encryptedEntries.find(e => e.id === entry.id);

        if (encryptedEntry) {
          // Export the ALREADY ENCRYPTED password data directly
          // This preserves the original encryption without re-encrypting
          exportEntry.password = encryptedEntry.encryptedData;
          exportEntry.salt = encryptedEntry.salt;
          exportEntry.iv = encryptedEntry.iv;
          exportEntry.authTag = encryptedEntry.authTag;
          exportEntry.isPasswordEncrypted = true;
          console.log(
            `🔐 [Export] Preserved encrypted password for: ${entry.title}`,
          );
        } else {
          console.warn(
            `⚠️ [Export] Could not find encrypted data for: ${entry.title}`,
          );
          exportEntry.password = '';
          exportEntry.isPasswordEncrypted = false;
        }
      }

      if (options.includeNotes) {
        exportEntry.notes = entry.notes;
      }

      if (options.includeCustomFields && entry.customFields) {
        entry.customFields.forEach(field => {
          exportEntry[`custom_${field.name}`] = field.value;
        });
      }

      return exportEntry;
    });
  }

  // Generate export content based on format
  private async generateExportContent(
    data: any[],
    options: ExportOptions,
    masterPassword: string | null,
    exportKey?: string, // For validation only, NOT stored in metadata
  ): Promise<string> {
    switch (options.format) {
      case 'json':
        // Check if any entries are encrypted
        const hasEncryptedPasswords = data.some(
          entry => entry.isPasswordEncrypted === true,
        );

        // Add metadata for JSON exports
        // SECURITY: Export key is NOT stored in metadata - it's reconstructed on import
        const jsonData = {
          exportInfo: {
            exportDate: new Date().toISOString(),
            format: 'PasswordEpic JSON Export',
            version: '2.0', // Version bump for secure key strategy
            isEncrypted: hasEncryptedPasswords,
            encryptionMethod: hasEncryptedPasswords
              ? 'Master Password + AES-256'
              : 'None',
            totalEntries: data.length,
            warning: hasEncryptedPasswords
              ? '🔐 Passwords are encrypted with your Master Password using AES-256'
              : '⚠️ WARNING: Passwords are stored in PLAINTEXT format!',
            // Export key validation hashes (for debugging, not decryption)
            exportKeyHash: exportKey
              ? CryptoJS.SHA256(exportKey).toString().substring(0, 16)
              : CryptoJS.SHA256(masterPassword || '')
                  .toString()
                  .substring(0, 16),
            exportKeyLength: exportKey?.length || masterPassword?.length || 0,
            securityNote:
              'Export key is not stored - it is reconstructed on import using your current Master Password and account information',
          },
          entries: data,
        };
        return JSON.stringify(jsonData, null, 2);

      case 'csv':
        return this.generateCSV(data);

      case 'xlsx':
        return this.generateXLSX(data);

      case 'html':
        return this.generateHTML(data, options);

      case 'pdf':
        // This would require a PDF generation library
        throw new Error('PDF export not yet implemented');

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  // Generate CSV content
  private generateCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape quotes and wrap in quotes if contains comma or quote
        if (
          value.includes(',') ||
          value.includes('"') ||
          value.includes('\n')
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  // Generate XLSX content
  private generateXLSX(_data: any[]): string {
    // This would require proper XLSX generation
    throw new Error('XLSX export not yet implemented');
  }

  // Generate HTML content
  private generateHTML(data: any[], options: ExportOptions): string {
    const title = 'Password Export';
    const date = new Date().toLocaleDateString();

    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #007bff; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .password { font-family: monospace; background: #f8f9fa; padding: 2px 4px; }
        .strong { color: #28a745; font-weight: bold; }
        .good { color: #17a2b8; }
        .fair { color: #ffc107; }
        .weak { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="info">
        <p><strong>Export Date:</strong> ${date}</p>
        <p><strong>Total Entries:</strong> ${data.length}</p>
        <p><strong>Includes Passwords:</strong> ${
          options.includePasswords ? 'Yes' : 'No'
        }</p>
    </div>
    <table>
        <thead>
            <tr>`;

    // Add table headers
    if (data.length > 0) {
      Object.keys(data[0]).forEach(key => {
        html += `<th>${
          key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
        }</th>`;
      });
    }

    html += `
            </tr>
        </thead>
        <tbody>`;

    // Add table rows
    data.forEach(row => {
      html += '<tr>';
      Object.entries(row).forEach(([key, value]) => {
        let cellValue = String(value || '');

        if (key === 'password' && options.includePasswords) {
          cellValue = `<span class="password">${cellValue}</span>`;
        } else if (key === 'strength') {
          cellValue = `<span class="${cellValue}">${cellValue}</span>`;
        }

        html += `<td>${cellValue}</td>`;
      });
      html += '</tr>';
    });

    html += `
        </tbody>
    </table>
</body>
</html>`;

    return html;
  }

  // Save export file
  private async saveExportFile(
    content: string,
    fileName: string,
    options: ExportOptions,
  ): Promise<string> {
    let downloadPath: string;

    // Use custom destination folder if provided
    if (options.destinationFolder) {
      const customFolder = options.destinationFolder;
      console.log(
        `📁 Using custom destination folder: ${customFolder}`,
      );

      try {
        if (Platform.OS === 'android' && customFolder.startsWith('content://')) {
          console.log(`🎯 Using DocumentProvider URI for write`);
          console.log(`📋 Folder URI: ${customFolder}`);
          console.log(`📝 File name: ${fileName}`);
          console.log(`📊 Content size: ${content.length} bytes`);
          
          try {
            const result = await FilePicker.writeToFolder(
              customFolder,
              fileName,
              content,
            );
            console.log(`✅ Successfully wrote to custom folder: ${result}`);
            return result;
          } catch (writeError: any) {
            console.warn('⚠️ Custom folder write failed, falling back to internal storage');
            console.warn(`Reason: ${writeError?.message || writeError}`);
            console.debug(`Full error: ${JSON.stringify(writeError)}`);
            
            downloadPath = RNFS.DocumentDirectoryPath;
          }
        } else {
          downloadPath = customFolder;
        }
      } catch (uriError) {
        console.error('Failed to write using URI:', uriError);
        console.warn('⚠️ Custom folder access failed. Falling back to internal storage...');
        downloadPath = RNFS.DocumentDirectoryPath;
      }
    } else if (Platform.OS === 'android') {
      // Use app-specific directory (no special permissions required)
      downloadPath = RNFS.ExternalDirectoryPath;
      console.log(
        `✅ Using app-specific directory for backups: ${downloadPath}`,
      );
    } else {
      downloadPath = RNFS.DocumentDirectoryPath;
    }

    const filePath = `${downloadPath}/${fileName}`;

    try {
      // Check if file exists and delete it to allow overwrite
      const fileExists = await RNFS.exists(filePath);
      if (fileExists) {
        console.log(`File already exists, deleting: ${filePath}`);
        await RNFS.unlink(filePath);
        console.log(`Successfully deleted old file: ${filePath}`);
      }

      console.log(`Attempting to write export to: ${filePath}`);
      await RNFS.writeFile(filePath, content, 'utf8');
      console.log(`✅ Successfully wrote export to: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('Write failed:', error);
      throw error;
    }
  }

  // Generate file name
  private generateFileName(format: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    return `password-export-${timestamp}.${format}`;
  }

  // Calculate password strength
  private calculatePasswordStrength(
    password: string,
  ): 'weak' | 'fair' | 'good' | 'strong' {
    if (!password) return 'weak';

    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (score <= 2) return 'weak';
    if (score <= 3) return 'fair';
    if (score <= 4) return 'good';
    return 'strong';
  }

  // Get supported formats
  getSupportedFormats(): { import: string[]; export: string[] } {
    return { ...this.SUPPORTED_FORMATS };
  }
}

// Debug function to test decryption with various keys (for troubleshooting)
export const debugDecryptionTest = async (
  encryptedPassword: string,
): Promise<void> => {
  console.log('🧪 [Debug] Starting decryption test...');

  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.log('❌ [Debug] No authenticated user found');
    return;
  }

  const testResult = testAllPossibleKeys(encryptedPassword, currentUser);

  console.log('🧪 [Debug] Test completed:', {
    success: testResult.success,
    method: testResult.method,
    resultPreview: testResult.success
      ? testResult.password.substring(0, 10) + '...'
      : 'Failed',
  });
};

// Helper function to test a specific encrypted password from your logs
export const testSpecificDecryption = (
  encryptedText: string,
  keyPattern: string,
): boolean => {
  try {
    console.log(
      `🧪 [TestSpecific] Testing: ${encryptedText.substring(
        0,
        30,
      )}... with key: ${keyPattern.substring(0, 20)}...`,
    );

    const decrypted = CryptoJS.AES.decrypt(encryptedText, keyPattern);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

    if (decryptedString && decryptedString.trim().length > 0) {
      console.log(
        `✅ [TestSpecific] SUCCESS! Decrypted: ${decryptedString.substring(
          0,
          10,
        )}...`,
      );
      return true;
    } else {
      console.log(`❌ [TestSpecific] Failed - empty result`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ [TestSpecific] Failed - error: ${error.message}`);
    return false;
  }
};

// Quick test function for your current session (call this in React Native debugger)
export const quickDecryptionTest = async (): Promise<void> => {
  console.log('🚀 [QuickTest] Running quick decryption test...');

  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.log('❌ [QuickTest] No user authenticated');
    return;
  }

  console.log('👤 [QuickTest] Current user:', {
    uid: currentUser.uid?.substring(0, 20) + '...',
    email: currentUser.email,
  });

  // Test with current session info
  try {
    const masterPasswordResult = await getEffectiveMasterPassword();
    if (masterPasswordResult.success) {
      console.log('🔑 [QuickTest] Current master password pattern:', {
        length: masterPasswordResult.password?.length,
        preview: masterPasswordResult.password?.substring(0, 30) + '...',
      });

      // Test if this key can encrypt/decrypt
      const testString = 'Hello World 123';
      const encrypted = CryptoJS.AES.encrypt(
        testString,
        masterPasswordResult.password,
      ).toString();
      const decrypted = CryptoJS.AES.decrypt(
        encrypted,
        masterPasswordResult.password,
      ).toString(CryptoJS.enc.Utf8);

      console.log('🧪 [QuickTest] Round-trip test:', {
        original: testString,
        encrypted: encrypted.substring(0, 30) + '...',
        decrypted: decrypted,
        success: decrypted === testString,
      });
    }
  } catch (error: any) {
    console.log('❌ [QuickTest] Master password test failed:', error.message);
  }
};

// Specific test for your current decryption issue based on logs
export const testCurrentDecryptionIssue = (): void => {
  console.log(
    '🩺 [DiagnosticTest] Testing specific decryption patterns from logs...',
  );

  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.log('❌ [DiagnosticTest] No user authenticated');
    return;
  }

  // Based on your logs, these are the exact patterns being tried
  const testPatterns = [
    // Current session pattern
    `${currentUser.uid}::1760074390006::${currentUser.email}`,

    // Entry timestamp pattern (from logs)
    `${currentUser.uid}::1760077343497::${currentUser.email}`,

    // Simple UID only (this worked for FB accounts)
    currentUser.uid,

    // With session salt
    `${currentUser.uid}::1760077343497::${currentUser.email}::8f8f59a5585f7dfe`,
    `${currentUser.uid}::1760074390006::${currentUser.email}::8f8f59a5585f7dfe`,

    // Legacy patterns
    `${currentUser.uid}::${currentUser.email}`,
  ];

  console.log(
    `🔑 [DiagnosticTest] Testing ${testPatterns.length} specific patterns...`,
  );

  // Create a test encrypted string
  const testString = 'TestPassword123';

  testPatterns.forEach((pattern, index) => {
    try {
      console.log(
        `🧪 [DiagnosticTest] Pattern ${index + 1}: ${pattern.substring(
          0,
          30,
        )}...`,
      );

      // Try to encrypt with this pattern
      const encrypted = CryptoJS.AES.encrypt(testString, pattern).toString();
      console.log(`   📝 Encrypted: ${encrypted.substring(0, 30)}...`);

      // Try to decrypt it back
      const decrypted = CryptoJS.AES.decrypt(encrypted, pattern).toString(
        CryptoJS.enc.Utf8,
      );
      console.log(`   🔓 Decrypted: "${decrypted}"`);

      const success = decrypted === testString;
      console.log(
        `   ${success ? '✅' : '❌'} Round-trip: ${
          success ? 'PASSED' : 'FAILED'
        }`,
      );

      if (success) {
        console.log(
          `🎉 [DiagnosticTest] Pattern ${index + 1} WORKS for new encryption!`,
        );
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  });

  console.log(
    '🩺 [DiagnosticTest] Test completed. Check which patterns work for encryption.',
  );
};

// Test decryption of actual encrypted data from your database
export const testActualEncryptedData = (encryptedData: string): void => {
  console.log(
    '🔍 [ActualDataTest] Testing decryption of actual encrypted data...',
  );
  console.log(
    `📦 [ActualDataTest] Encrypted data: ${encryptedData.substring(0, 50)}...`,
  );

  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.log('❌ [ActualDataTest] No user authenticated');
    return;
  }

  // Test all possible patterns from your logs
  const patterns = [
    // Simple UID (worked for FB)
    currentUser.uid,

    // Static patterns
    `${currentUser.uid}::${currentUser.email}`,

    // Timestamp patterns from your logs
    `${currentUser.uid}::1760077343497::${currentUser.email}`,
    `${currentUser.uid}::1760074390006::${currentUser.email}`,

    // With salt patterns
    `${currentUser.uid}::1760077343497::${currentUser.email}::8f8f59a5585f7dfe`,
    `${currentUser.uid}::1760074390006::${currentUser.email}::8f8f59a5585f7dfe`,

    // Full salt patterns (from your logs)
    `${currentUser.uid}::1760077343497::${currentUser.email}::8f8f59a5585f7dfe0374352446b2f9397a16f94a074e0724855ee07fe2c92446`,
    `${currentUser.uid}::1760074390006::${currentUser.email}::8f8f59a5585f7dfe0374352446b2f9397a16f94a074e0724855ee07fe2c92446`,

    // Legacy patterns
    currentUser.email,
    `${currentUser.uid}_${currentUser.email}`,
    `${currentUser.uid}-${currentUser.email}`,

    // Truncated patterns
    currentUser.uid.substring(0, 12),
    currentUser.uid.substring(0, 16),
    currentUser.uid.substring(0, 20),
  ];

  console.log(
    `🔑 [ActualDataTest] Testing ${patterns.length} patterns against actual data...`,
  );

  let successCount = 0;

  patterns.forEach((pattern, index) => {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, pattern);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

      if (decryptedString && decryptedString.trim().length > 0) {
        console.log(`🎉 [ActualDataTest] SUCCESS with pattern ${index + 1}!`);
        console.log(`🔑 Pattern: ${pattern.substring(0, 40)}...`);
        console.log(`🔓 Result: ${decryptedString.substring(0, 20)}...`);
        successCount++;
      } else {
        console.log(
          `❌ [ActualDataTest] Pattern ${index + 1} failed: empty result`,
        );
      }
    } catch (error: any) {
      console.log(
        `❌ [ActualDataTest] Pattern ${index + 1} failed: ${error.message}`,
      );
    }
  });

  if (successCount === 0) {
    console.log(
      '💔 [ActualDataTest] No patterns worked. The data might be corrupted or use a different encryption method.',
    );

    // Additional diagnostic info
    console.log('🔍 [ActualDataTest] Diagnostic info:', {
      dataLength: encryptedData.length,
      startsWithSalted: encryptedData.startsWith('U2FsdGVkX1'),
      isBase64: /^[A-Za-z0-9+/]+=*$/.test(encryptedData),
      firstChars: encryptedData.substring(0, 20),
      userUid: currentUser.uid?.substring(0, 20) + '...',
      userEmail: currentUser.email,
    });
  } else {
    console.log(
      `🎉 [ActualDataTest] Found ${successCount} working pattern(s)!`,
    );
  }
};

export { ImportExportService };
export const importExportService = new ImportExportService();
export default importExportService;
