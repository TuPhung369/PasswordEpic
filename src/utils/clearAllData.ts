// Utility to clear all encrypted data and start fresh
import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearAllEncryptedData = async (): Promise<{
  success: boolean;
  clearedKeys: string[];
  error?: string;
}> => {
  try {
    console.log('🧹 [ClearData] Starting to clear all encrypted data...');

    // Keys to clear
    const keysToRemove = [
      // Encrypted passwords (optimized format)
      'optimized_passwords_v2',
      'password_categories',

      // Dynamic master password (old system)
      'dynamic_mp_login_timestamp',
      'dynamic_mp_user_uuid',
      'dynamic_mp_session_salt',
      'dynamic_mp_session_hash',

      // Static master password (new system)
      'static_mp_fixed_salt',
      'static_mp_user_uuid',

      // Session data
      'session_config',
      'session_last_activity',

      // Any other password-related keys
      'master_password_hash',
      'master_password_salt',
    ];

    console.log(`🔍 [ClearData] Will remove ${keysToRemove.length} keys`);

    // Remove all keys
    await AsyncStorage.multiRemove(keysToRemove);

    console.log('✅ [ClearData] All encrypted data cleared successfully');
    console.log(`📋 [ClearData] Cleared keys:`, keysToRemove);

    return {
      success: true,
      clearedKeys: keysToRemove,
    };
  } catch (error: any) {
    console.error('❌ [ClearData] Failed to clear data:', error);
    return {
      success: false,
      clearedKeys: [],
      error: error.message || 'Failed to clear data',
    };
  }
};

export const clearAllAsyncStorage = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.warn('⚠️ [ClearData] Clearing ALL AsyncStorage data...');
    await AsyncStorage.clear();
    console.log('✅ [ClearData] All AsyncStorage data cleared');
    return { success: true };
  } catch (error: any) {
    console.error('❌ [ClearData] Failed to clear AsyncStorage:', error);
    return {
      success: false,
      error: error.message || 'Failed to clear AsyncStorage',
    };
  }
};
