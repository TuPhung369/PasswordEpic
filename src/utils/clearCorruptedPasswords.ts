/**
 * Utility to clear corrupted passwords that cannot be decrypted
 * Use this when passwords were encrypted with a different session
 */

import { encryptedDatabase } from '../services/encryptedDatabaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearCorruptedPasswords = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log('🗑️ Clearing corrupted passwords...');

    // Clear all encrypted data
    await encryptedDatabase.clearAllData();

    // Also clear any related storage
    await AsyncStorage.removeItem('passwords_storage');
    await AsyncStorage.removeItem('categories_storage');

    console.log('✅ Corrupted passwords cleared successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to clear corrupted passwords:', error);
    return {
      success: false,
      error: error.message || 'Failed to clear corrupted passwords',
    };
  }
};

/**
 * Check if there are any corrupted passwords
 * This can be called to detect if user needs to clear data
 */
export const hasCorruptedPasswords = async (
  masterPassword: string,
): Promise<{
  hasCorrupted: boolean;
  totalCount: number;
  corruptedCount: number;
}> => {
  try {
    const passwords = await encryptedDatabase.getAllPasswordEntries(
      masterPassword,
    );

    // Get raw data to count total entries
    const rawData = await AsyncStorage.getItem('passwords_storage');
    const totalCount = rawData ? JSON.parse(rawData).length : 0;
    const successfulCount = passwords.length;
    const corruptedCount = totalCount - successfulCount;

    return {
      hasCorrupted: corruptedCount > 0,
      totalCount,
      corruptedCount,
    };
  } catch (error) {
    console.error('Failed to check for corrupted passwords:', error);
    return {
      hasCorrupted: false,
      totalCount: 0,
      corruptedCount: 0,
    };
  }
};
