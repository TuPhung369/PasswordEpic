// Secure storage service using React Native Keychain and AsyncStorage
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { generateSalt, hashPassword, verifyPassword } from './cryptoService';

// Keychain service configuration
const KEYCHAIN_SERVICE = 'PasswordEpic';

// Get keychain options - lazy load to ensure mocks are ready
const getKeychainOptions = () => {
  const accessControl =
    Keychain.ACCESS_CONTROL?.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE;

  return {
    service: KEYCHAIN_SERVICE,
    accessControl: accessControl as any,
    authenticatePrompt: 'Authenticate to access your passwords',
    accessGroup:
      Platform.OS === 'ios' ? 'group.passwordepic.keychain' : undefined,
    touchID: true,
    showModal: true,
    kLocalizedFallbackTitle: 'Use Passcode',
  };
};

// Storage keys
const STORAGE_KEYS = {
  MASTER_PASSWORD_HASH: 'master_password_hash',
  MASTER_PASSWORD_SALT: 'master_password_salt',
  MASTER_PASSWORD_LAST_VERIFIED: 'master_password_last_verified',
  USER_SETTINGS: 'user_settings',
  ENCRYPTED_PASSWORDS: 'optimized_passwords_v2',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  LAST_BACKUP: 'last_backup',
  MASTER_PASSWORD_SET_CACHE: 'master_password_set_cache',
  MASTER_PASSWORD_SET_CACHE_TIMESTAMP: 'master_password_set_cache_timestamp',
};

// Cache TTL: 1 minute - balance between performance and freshness
const MASTER_PASSWORD_CACHE_TTL = 60 * 1000;

// 🔥 Helper: Clear cache when master password changes
const invalidateMasterPasswordCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.MASTER_PASSWORD_SET_CACHE,
      STORAGE_KEYS.MASTER_PASSWORD_SET_CACHE_TIMESTAMP,
    ]);
    console.log(
      '🧹 [invalidateMasterPasswordCache] Cache cleared - next check will recompute',
    );
  } catch (error) {
    console.error('Error clearing master password cache:', error);
  }
};

// Master password management
export const storeMasterPassword = async (
  password: string,
  enableBiometric: boolean = true,
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Generate salt for password hashing
    const salt = generateSalt();

    // Hash password for verification (not for encryption)
    const passwordHash = hashPassword(password, salt);

    // Store hash, salt, and initial verification timestamp in AsyncStorage
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.MASTER_PASSWORD_HASH, passwordHash],
      [STORAGE_KEYS.MASTER_PASSWORD_SALT, salt],
      [STORAGE_KEYS.MASTER_PASSWORD_LAST_VERIFIED, Date.now().toString()],
    ]);

    // Store actual password in secure keychain if biometric is enabled
    if (enableBiometric) {
      const baseOptions = getKeychainOptions();
      const keychainOptions = {
        ...baseOptions,
        accessControl: Keychain.ACCESS_CONTROL?.BIOMETRY_CURRENT_SET as any,
      };

      try {
        await Keychain.setInternetCredentials(
          KEYCHAIN_SERVICE,
          'master_password',
          password,
          keychainOptions,
        );
        await storeBiometricStatus(true);
      } catch (biometricError: any) {
        console.warn(
          'Biometric storage not available, falling back to basic keychain storage:',
          biometricError.message,
        );

        const fallbackOptions = {
          service: KEYCHAIN_SERVICE,
          accessGroup:
            Platform.OS === 'ios' ? 'group.passwordepic.keychain' : undefined,
          showModal: false,
        };

        await Keychain.setInternetCredentials(
          KEYCHAIN_SERVICE,
          'master_password',
          password,
          fallbackOptions,
        );

        await storeBiometricStatus(false);
        console.log(
          'Master password stored without biometric - will be set up during biometric configuration',
        );
      }
    } else {
      await storeBiometricStatus(false);
    }

    // 🔥 Invalidate cache - master password state changed
    await invalidateMasterPasswordCache();

    return { success: true };
  } catch (error: any) {
    console.error('Failed to store master password:', error);
    return {
      success: false,
      error: error.message || 'Failed to store master password',
    };
  }
};

export const enableBiometricForMasterPassword = async (
  password: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔐 [enableBiometricForMasterPassword] Starting...');
    const baseOptions = getKeychainOptions();
    const keychainOptions = {
      ...baseOptions,
      accessControl: Keychain.ACCESS_CONTROL?.BIOMETRY_CURRENT_SET as any,
    };

    console.log('🔐 [enableBiometricForMasterPassword] Setting keychain credentials...');
    await Keychain.setInternetCredentials(
      KEYCHAIN_SERVICE,
      'master_password',
      password,
      keychainOptions,
    );

    console.log('🔐 [enableBiometricForMasterPassword] Storing biometric status...');
    await storeBiometricStatus(true);
    console.log('✅ Biometric storage enabled for master password');

    return { success: true };
  } catch (error: any) {
    console.warn(
      'Failed to enable biometric storage for master password:',
      error.message,
    );
    return {
      success: false,
      error: error.message || 'Failed to enable biometric storage',
    };
  }
};

export const verifyMasterPassword = async (
  password: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const [passwordHash, salt] = await AsyncStorage.multiGet([
      STORAGE_KEYS.MASTER_PASSWORD_HASH,
      STORAGE_KEYS.MASTER_PASSWORD_SALT,
    ]);

    if (!passwordHash[1] || !salt[1]) {
      return { success: false, error: 'Master password not set' };
    }

    const isValid = verifyPassword(password, passwordHash[1], salt[1]);

    if (!isValid) {
      return { success: false, error: 'Invalid master password' };
    }

    // Update last verified timestamp on successful verification
    await AsyncStorage.setItem(
      STORAGE_KEYS.MASTER_PASSWORD_LAST_VERIFIED,
      Date.now().toString(),
    );

    return { success: true };
  } catch (error: any) {
    console.error('Failed to verify master password:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify master password',
    };
  }
};

// Cache biometric support check to avoid repeated expensive calls
let biometricSupportCache: { supported: boolean; timestamp: number } | null =
  null;
const BIOMETRIC_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const BIOMETRIC_TIMEOUT = 15 * 1000; // 15 seconds timeout

// Reset cache - for testing purposes
export const _resetBiometricCache = (): void => {
  biometricSupportCache = null;
};

// Timeout wrapper for biometric operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error('Biometric authentication timeout')),
        timeoutMs,
      ),
    ),
  ]);
};

export const getMasterPasswordFromBiometric = async (): Promise<{
  success: boolean;
  password?: string;
  error?: string;
}> => {
  const startTime = Date.now();
  console.log('🔐 [Biometric] Starting biometric authentication...');

  try {
    // Fast check: is biometric enabled?
    const checkStart = Date.now();
    const biometricStatus = await getBiometricStatus();
    console.log(`🔍 [Biometric] Enabled check: ${Date.now() - checkStart}ms`);

    if (!biometricStatus) {
      console.log(`❌ [Biometric] Not enabled (${Date.now() - startTime}ms)`);
      return { success: false, error: 'Biometric authentication not enabled' };
    }

    // Check biometric support (with caching)
    const supportStart = Date.now();
    let biometricSupported = false;

    if (
      biometricSupportCache &&
      Date.now() - biometricSupportCache.timestamp < BIOMETRIC_CACHE_TTL
    ) {
      console.log('🚀 [Biometric] Using cached support status');
      biometricSupported = biometricSupportCache.supported;
    } else {
      console.log('🔍 [Biometric] Checking biometric support...');
      const biometryType = await Keychain.getSupportedBiometryType();
      biometricSupported = !!biometryType;

      // Cache the result
      biometricSupportCache = {
        supported: biometricSupported,
        timestamp: Date.now(),
      };
      console.log(`✅ [Biometric] Support cached: ${biometricSupported}`);
    }

    console.log(`📊 [Biometric] Support check: ${Date.now() - supportStart}ms`);

    if (!biometricSupported) {
      const duration = Date.now() - startTime;
      console.log(`❌ [Biometric] Not supported (${duration}ms)`);
      return {
        success: false,
        error: 'Biometric authentication not available',
      };
    }

    // Retrieve password from keychain with biometric authentication (with timeout)
    console.log('🔑 [Biometric] Accessing keychain...');
    const keychainStart = Date.now();

    const credentials = await withTimeout(
      Keychain.getInternetCredentials(KEYCHAIN_SERVICE, getKeychainOptions()),
      BIOMETRIC_TIMEOUT,
    );

    console.log(
      `🔑 [Biometric] Keychain access: ${Date.now() - keychainStart}ms`,
    );

    if (!credentials || typeof credentials === 'boolean') {
      const duration = Date.now() - startTime;
      console.log(`❌ [Biometric] No credentials found (${duration}ms)`);
      return { success: false, error: 'No stored credentials found' };
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [Biometric] Authentication successful (${duration}ms)`);
    return {
      success: true,
      password: credentials.password,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Biometric] Failed after ${duration}ms:`, error);

    let errorMessage = 'Biometric authentication failed';

    if (error.message?.includes('timeout')) {
      errorMessage = 'Biometric authentication timeout';
    } else if (error.message?.includes('UserCancel')) {
      errorMessage = 'Authentication was cancelled';
    } else if (error.message?.includes('UserFallback')) {
      errorMessage = 'User chose to enter password manually';
    } else if (error.message?.includes('BiometryNotAvailable')) {
      errorMessage = 'Biometric authentication not available';
    }

    return { success: false, error: errorMessage };
  }
};

export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return enabled === 'true';
  } catch (error) {
    console.error('Failed to check biometric status:', error);
    return false;
  }
};

export const isBiometricAvailable = async (): Promise<{
  available: boolean;
  biometryType?: Keychain.BIOMETRY_TYPE;
}> => {
  try {
    const biometryType = await Keychain.getSupportedBiometryType();
    return {
      available: biometryType !== null,
      biometryType: biometryType || undefined,
    };
  } catch (error) {
    console.error('Failed to check biometric availability:', error);
    return { available: false };
  }
};

// Encrypted data storage
export const storeEncryptedData = async (
  key: string,
  data: any,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const jsonData = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonData);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to store encrypted data for key ${key}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to store encrypted data',
    };
  }
};

export const getEncryptedData = async (
  key: string,
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const jsonData = await AsyncStorage.getItem(key);

    if (!jsonData) {
      return { success: false, error: 'No data found' };
    }

    const data = JSON.parse(jsonData);
    return { success: true, data };
  } catch (error: any) {
    console.error(`Failed to get encrypted data for key ${key}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to retrieve encrypted data',
    };
  }
};

export const removeEncryptedData = async (
  key: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await AsyncStorage.removeItem(key);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to remove encrypted data for key ${key}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to remove encrypted data',
    };
  }
};

// User settings management
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  autoLockTimeout: number; // minutes
  biometricEnabled: boolean;
  screenProtectionEnabled: boolean;
  autoBackupEnabled: boolean;
  lastBackupDate?: number;
}

export const storeUserSettings = async (
  settings: UserSettings,
): Promise<{ success: boolean; error?: string }> => {
  return storeEncryptedData(STORAGE_KEYS.USER_SETTINGS, settings);
};

export const getUserSettings = async (): Promise<{
  success: boolean;
  settings?: UserSettings;
  error?: string;
}> => {
  const result = await getEncryptedData(STORAGE_KEYS.USER_SETTINGS);

  if (!result.success) {
    // Return default settings if none exist
    const defaultSettings: UserSettings = {
      theme: 'dark',
      autoLockTimeout: 5, // 5 minutes default
      biometricEnabled: false,
      screenProtectionEnabled: true,
      autoBackupEnabled: false,
    };

    return { success: true, settings: defaultSettings };
  }

  return { success: true, settings: result.data };
};

// Clear all stored data (for logout/reset)
export const clearAllStoredData = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Clear AsyncStorage data
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);

    // Clear keychain data
    try {
      await Keychain.resetInternetCredentials({ service: KEYCHAIN_SERVICE });
    } catch (keychainError) {
      console.warn('Failed to clear keychain data:', keychainError);
      // Don't fail the entire operation if keychain clearing fails
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to clear stored data:', error);
    return {
      success: false,
      error: error.message || 'Failed to clear stored data',
    };
  }
};

// Check if master password is set
export const isMasterPasswordSet = async (): Promise<boolean> => {
  try {
    // 🔥 CHECK CACHE FIRST - Avoid redundant Firestore calls
    const cacheTimestamp = await AsyncStorage.getItem(
      STORAGE_KEYS.MASTER_PASSWORD_SET_CACHE_TIMESTAMP,
    );
    const cachedValue = await AsyncStorage.getItem(
      STORAGE_KEYS.MASTER_PASSWORD_SET_CACHE,
    );

    if (cacheTimestamp && cachedValue) {
      const timestamp = parseInt(cacheTimestamp, 10);
      const now = Date.now();

      // If cache is still valid, return it immediately
      if (now - timestamp < MASTER_PASSWORD_CACHE_TTL) {
        console.log(
          '✅ [isMasterPasswordSet] Returning cached result (age: ' +
            (now - timestamp) +
            'ms)',
        );
        return cachedValue === 'true';
      }
    }

    // Cache expired or doesn't exist - recompute
    console.log('🔍 [isMasterPasswordSet] Cache miss/expired - checking sources');
    let result = false;

    // First check Firebase if user is authenticated
    const { getCurrentUser, getFirebaseFirestore } = await import('./firebase');
    const currentUser = getCurrentUser();

    if (currentUser?.uid) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const firestore = getFirebaseFirestore();
        if (firestore) {
          const userDocRef = doc(firestore, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const data = userDoc.data();
            // Check if encrypted master password exists in Firebase
            if (data?.encryptedMasterPassword) {
              result = true;
            }
          }
        }
      } catch (fbError) {
        console.warn('Error checking Firebase for master password:', fbError);
        // Fall through to local storage check
      }
    }

    // Fallback: check local storage for new PIN-based setup
    if (!result) {
      const { STATIC_MP_KEYS } = await import('./staticMasterPasswordService');
      const pinSetupComplete = await AsyncStorage.getItem(
        STATIC_MP_KEYS.PIN_SETUP_COMPLETE,
      );
      if (pinSetupComplete === 'true') {
        result = true;
      }
    }

    // Legacy: check old password hash
    if (!result) {
      const passwordHash = await AsyncStorage.getItem(
        STORAGE_KEYS.MASTER_PASSWORD_HASH,
      );
      result = passwordHash !== null;
    }

    // 🔥 SAVE TO CACHE
    console.log(
      '💾 [isMasterPasswordSet] Caching result:',
      result,
      '(TTL: ' + MASTER_PASSWORD_CACHE_TTL + 'ms)',
    );
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.MASTER_PASSWORD_SET_CACHE, result ? 'true' : 'false'],
      [
        STORAGE_KEYS.MASTER_PASSWORD_SET_CACHE_TIMESTAMP,
        Date.now().toString(),
      ],
    ]);

    return result;
  } catch (error) {
    console.error('Failed to check master password status:', error);
    return false;
  }
};

// Biometric authentication management
export const storeBiometricStatus = async (enabled: boolean): Promise<void> => {
  try {
    const stringValue = enabled ? 'true' : 'false';
    console.log(`🔐 [storeBiometricStatus] Storing enabled=${enabled} as "${stringValue}"`);
    await AsyncStorage.setItem(
      STORAGE_KEYS.BIOMETRIC_ENABLED,
      stringValue,
    );
    console.log(`✅ [storeBiometricStatus] Successfully stored`);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify the value was actually stored (non-blocking verification)
    try {
      const verification = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      if (verification === stringValue) {
        console.log(`🔐 [storeBiometricStatus] Verification successful - value is: "${verification}"`);
      } else {
        console.warn(`⚠️ [storeBiometricStatus] VERIFICATION ISSUE! Expected "${stringValue}" but got "${verification}"`);
      }
    } catch (verificationError) {
      console.warn(`⚠️ [storeBiometricStatus] Verification check failed:`, verificationError);
    }
  } catch (error) {
    console.error('❌ Failed to store biometric status:', error);
  }
};

export const getBiometricStatus = async (): Promise<boolean> => {
  try {
    const status = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    console.log(`🔐 [getBiometricStatus] Retrieved raw value: "${status}"`);
    
    if (status === 'true') {
      console.log(`🔐 [getBiometricStatus] Parsed result: true`);
      return true;
    } else if (status === 'false') {
      console.log(`🔐 [getBiometricStatus] Parsed result: false`);
      return false;
    } else {
      console.log(`🔐 [getBiometricStatus] No valid status found (null/undefined), returning false`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to get biometric status:', error);
    return false;
  }
};

export const getMasterPasswordHash = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.MASTER_PASSWORD_HASH);
  } catch (error) {
    console.error('Failed to get master password hash:', error);
    return null;
  }
};

/**
 * Check if master password verification is required (after 7 days)
 * @returns true if master password needs to be re-verified
 */
export const isMasterPasswordVerificationRequired =
  async (): Promise<boolean> => {
    try {
      const lastVerifiedStr = await AsyncStorage.getItem(
        STORAGE_KEYS.MASTER_PASSWORD_LAST_VERIFIED,
      );

      // If never verified, require verification
      if (!lastVerifiedStr) {
        return true;
      }

      const lastVerified = parseInt(lastVerifiedStr, 10);
      const now = Date.now();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      // Check if more than 7 days have passed
      const timeSinceVerification = now - lastVerified;
      const isRequired = timeSinceVerification >= sevenDaysInMs;

      console.log('🔐 Master password verification check:', {
        lastVerified: new Date(lastVerified).toLocaleString(),
        daysSinceVerification: (
          timeSinceVerification /
          (24 * 60 * 60 * 1000)
        ).toFixed(2),
        isRequired,
      });

      return isRequired;
    } catch (error) {
      console.error(
        'Failed to check master password verification requirement:',
        error,
      );
      // On error, require verification for security
      return true;
    }
  };

/**
 * Update master password last verified timestamp
 * This should be called after successful biometric authentication as well
 */
export const updateMasterPasswordLastVerified = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.MASTER_PASSWORD_LAST_VERIFIED,
      Date.now().toString(),
    );
    console.log('🔐 Master password last verified timestamp updated');
  } catch (error) {
    console.error('Failed to update master password last verified:', error);
  }
};

// SecureStorageService singleton class for biometric integration
export class SecureStorageService {
  private static instance: SecureStorageService;

  private constructor() {}

  public static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  public async storeBiometricStatus(enabled: boolean): Promise<void> {
    try {
      return await storeBiometricStatus(enabled);
    } catch (error) {
      console.error('❌ SecureStorageService: Failed to store biometric status:', error);
      throw error;
    }
  }

  public async getBiometricStatus(): Promise<boolean> {
    try {
      return await getBiometricStatus();
    } catch (error) {
      console.error('❌ SecureStorageService: Failed to get biometric status:', error);
      return false;
    }
  }

  /**
   * Stores a generic item in AsyncStorage
   */
  public async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a generic item from AsyncStorage
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      throw error;
    }
  }

  /**
   * Removes a generic item from AsyncStorage
   */
  public async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
      throw error;
    }
  }
}

// Export singleton instance for use throughout the app
export const secureStorageService = SecureStorageService.getInstance();

// Storage keys export for external use
export { STORAGE_KEYS, invalidateMasterPasswordCache };
