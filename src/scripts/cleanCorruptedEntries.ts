/**
 * Clear Corrupted Entries Script
 *
 * This script will identify and remove entries that cannot be decrypted
 * while preserving entries that decrypt successfully.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EncryptedPasswordEntry } from '../types/password';
import {
  decryptData,
  deriveKeyFromPassword,
  CRYPTO_CONSTANTS,
} from '../services/cryptoService';
import { generateStaticMasterPassword } from '../services/staticMasterPasswordService';

const PASSWORDS_STORAGE_KEY = 'optimized_passwords_v2';

export interface CleanupResult {
  totalEntries: number;
  successfulEntries: number;
  corruptedEntries: number;
  removedIds: string[];
}

/**
 * Clean corrupted entries from database
 */
export const cleanCorruptedEntries = async (): Promise<CleanupResult> => {
  console.log('🧹 Starting corrupted entries cleanup...');

  const result: CleanupResult = {
    totalEntries: 0,
    successfulEntries: 0,
    corruptedEntries: 0,
    removedIds: [],
  };

  try {
    // Get master password
    const staticMPResult = await generateStaticMasterPassword();
    if (!staticMPResult.success || !staticMPResult.password) {
      throw new Error(
        `Failed to generate static master password: ${staticMPResult.error}`,
      );
    }

    const masterPassword = staticMPResult.password;

    // Load encrypted entries
    const entriesJson = await AsyncStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (!entriesJson) {
      console.log('ℹ️ No encrypted entries found');
      return result;
    }

    const encryptedEntries: EncryptedPasswordEntry[] = JSON.parse(entriesJson);
    result.totalEntries = encryptedEntries.length;

    console.log(`📊 Found ${result.totalEntries} encrypted entries to check`);

    const validEntries: EncryptedPasswordEntry[] = [];

    for (let i = 0; i < encryptedEntries.length; i++) {
      const entry = encryptedEntries[i];
      console.log(
        `🔍 Checking entry ${i + 1}/${result.totalEntries}: ${entry.id}`,
      );

      try {
        // Try to decrypt with fixed iterations (10000)
        const derivedKey = deriveKeyFromPassword(
          masterPassword,
          entry.salt,
          CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
        );

        const decryptedData = decryptData(
          entry.encryptedData,
          derivedKey,
          entry.iv,
          entry.authTag,
        );

        // Validate it's valid JSON
        JSON.parse(decryptedData);

        // If we got here, decryption succeeded
        validEntries.push(entry);
        result.successfulEntries++;
        console.log(`✅ Entry ${entry.id} is valid (keeping)`);
      } catch (decryptError) {
        result.corruptedEntries++;
        result.removedIds.push(entry.id);
        console.log(
          `❌ Entry ${entry.id} is corrupted (removing): ${decryptError.message}`,
        );
      }
    }

    // Save only the valid entries back to storage
    await AsyncStorage.setItem(
      PASSWORDS_STORAGE_KEY,
      JSON.stringify(validEntries),
    );

    console.log('🎯 Cleanup Summary:');
    console.log(`   Total entries: ${result.totalEntries}`);
    console.log(`   Valid entries kept: ${result.successfulEntries}`);
    console.log(`   Corrupted entries removed: ${result.corruptedEntries}`);
    console.log(`   Removed IDs: ${result.removedIds.join(', ')}`);

    return result;
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    throw new Error(`Cleanup failed: ${error.message}`);
  }
};

/**
 * Run cleanup and return formatted report
 */
export const runCleanupProcess = async (): Promise<string> => {
  console.log('🚀 Starting corrupted entries cleanup process...');

  try {
    const cleanupResult = await cleanCorruptedEntries();

    const report = `
🧹 Corrupted Entries Cleanup Report
=====================================
Date: ${new Date().toISOString()}

Summary:
- Total Entries Found: ${cleanupResult.totalEntries}
- Valid Entries Kept: ${cleanupResult.successfulEntries}
- Corrupted Entries Removed: ${cleanupResult.corruptedEntries}

Status: ${
      cleanupResult.corruptedEntries === 0
        ? 'ALL ENTRIES VALID'
        : 'CLEANUP COMPLETED'
    }

${
  cleanupResult.removedIds.length > 0
    ? `Removed Entry IDs:
${cleanupResult.removedIds.map(id => `- ${id}`).join('\n')}`
    : 'No entries needed to be removed'
}

✅ Your database now contains only valid, decryptable entries!
All future password operations should work correctly.
    `;

    console.log('📋 Cleanup Complete!');
    console.log(report);

    return report;
  } catch (error: any) {
    const errorReport = `
❌ Cleanup Failed
=================
Date: ${new Date().toISOString()}
Error: ${error.message}

Please try again or contact support.
    `;

    console.error(errorReport);
    return errorReport;
  }
};
