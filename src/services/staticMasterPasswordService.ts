// Static Master Password Service - Simple and Reliable
// Master password = UID + Email + Fixed Salt (never changes)
import { getCurrentUser } from './firebase';
import {
  deriveKeyFromPassword,
  generateSalt,
  CRYPTO_CONSTANTS,
} from './cryptoService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for static master password
export const STATIC_MP_KEYS = {
  FIXED_SALT: 'static_mp_fixed_salt', // Generated once, never changes
  USER_UUID: 'static_mp_user_uuid',
};

// Cache for performance
interface StaticMasterPasswordCache {
  password: string;
  derivedKey: string;
  timestamp: number;
  userId: string;
}

let staticMPCache: StaticMasterPasswordCache | null = null;
const STATIC_MP_CACHE_TTL = 60 * 60 * 1000; // 60 minutes cache (increased from 30 for better performance)

// In-flight request deduplication - prevents multiple concurrent PBKDF2 operations
let inFlightRequest: Promise<StaticMasterPasswordResult> | null = null;

export interface StaticMasterPasswordResult {
  success: boolean;
  password?: string;
  derivedKey?: string;
  userId?: string;
  error?: string;
}

/**
 * Generate static master password from user UID + email + fixed salt
 * This password NEVER changes, ensuring all entries can always be decrypted
 */
export const generateStaticMasterPassword =
  async (): Promise<StaticMasterPasswordResult> => {
    console.log('🔐 [StaticMP] Generating static master password...');
    const startTime = Date.now();

    // Step 1: Get current authenticated user (needed for cache check)
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error:
          'User not authenticated - cannot generate static master password',
      };
    }

    if (!currentUser.uid || typeof currentUser.uid !== 'string') {
      throw new Error('Invalid user UID - cannot generate static password');
    }

    // Step 2: Check cache FIRST (before in-flight check to avoid waiting for cached data)
    if (
      staticMPCache &&
      staticMPCache.userId === currentUser.uid &&
      Date.now() - staticMPCache.timestamp < STATIC_MP_CACHE_TTL
    ) {
      const cacheHitTime = Date.now() - startTime;
      const cacheAge = Math.round(
        (Date.now() - staticMPCache.timestamp) / 1000,
      );
      console.log(
        `🚀 [StaticMP] Cache hit (${cacheHitTime}ms, age: ${cacheAge}s)`,
      );

      // Validate cache has valid password
      if (
        !staticMPCache.password ||
        typeof staticMPCache.password !== 'string'
      ) {
        console.warn(
          '⚠️ [StaticMP] Cache hit but password is invalid, regenerating...',
        );
        staticMPCache = null; // Clear invalid cache
      } else {
        return {
          success: true,
          password: staticMPCache.password,
          derivedKey: staticMPCache.derivedKey,
          userId: currentUser.uid,
        };
      }
    } else {
      console.log('❌ [StaticMP] Cache miss - will generate new password');
    }

    // Step 3: Check if there's already an in-flight request (after cache check)
    if (inFlightRequest) {
      console.log('⏳ [StaticMP] Waiting for in-flight request to complete...');
      return await inFlightRequest;
    }

    // Step 4: Create in-flight request IMMEDIATELY (no cache, no in-flight → create new)
    inFlightRequest = (async () => {
      try {
        // Step 4a: Get or create FIXED salt (generated once, never changes)
        let fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
        if (!fixedSalt) {
          // Generate new fixed salt (only happens once per user)
          fixedSalt = generateSalt();
          await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
          console.log('🆕 [StaticMP] New fixed salt generated and stored');
        } else {
          console.log('🔄 [StaticMP] Using existing fixed salt');
        }

        // Step 4b: Store user UUID for consistency
        await AsyncStorage.setItem(STATIC_MP_KEYS.USER_UUID, currentUser.uid);

        // Step 4c: Create static master password
        // Format: UID::email::fixed_salt_first_16_chars
        // This NEVER changes, so all entries can always be decrypted
        if (!fixedSalt || typeof fixedSalt !== 'string') {
          throw new Error(
            'Invalid fixed salt - cannot generate static password',
          );
        }

        const passwordComponents = [
          currentUser.uid, // User UUID (unique per user)
          currentUser.email || 'anonymous', // Email for additional entropy
          fixedSalt.substring(0, 16), // First 16 chars of fixed salt
        ];

        const staticPassword = passwordComponents.join('::');

        console.log('🔍 [StaticMP] Password components:');
        console.log(`   UID: ${currentUser.uid.substring(0, 8)}...`);
        console.log(`   Email: ${currentUser.email || 'anonymous'}`);
        console.log(`   Salt (first 16): ${fixedSalt.substring(0, 16)}`);

        // Step 4d: Derive cryptographic key
        console.log('🔑 [StaticMP] Deriving cryptographic key...');
        const derivedKey = deriveKeyFromPassword(
          staticPassword,
          fixedSalt,
          CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_STATIC, // Uses configured iterations (5000)
        );

        if (!derivedKey || typeof derivedKey !== 'string') {
          throw new Error(
            'Failed to derive cryptographic key - invalid result',
          );
        }

        // Step 4e: Cache the result
        staticMPCache = {
          password: staticPassword,
          derivedKey: derivedKey,
          timestamp: Date.now(),
          userId: currentUser.uid,
        };

        const duration = Date.now() - startTime;
        console.log(
          `✅ [StaticMP] Static master password generated (${duration}ms)`,
        );
        console.log(
          `🔒 [StaticMP] Password pattern: ${staticPassword.substring(
            0,
            40,
          )}...`,
        );

        return {
          success: true,
          password: staticPassword,
          derivedKey: derivedKey,
          userId: currentUser.uid,
        };
      } catch (error: any) {
        console.error(
          '❌ [StaticMP] Failed to generate static master password:',
          error,
        );
        return {
          success: false,
          error: error.message || 'Failed to generate static master password',
        };
      } finally {
        // Clear in-flight request after completion (success or error)
        inFlightRequest = null;
      }
    })();

    // Step 3: Return the in-flight request promise
    return await inFlightRequest;
  };

/**
 * Get static master password info for debugging
 */
export const getStaticMasterPasswordInfo = async (): Promise<{
  success: boolean;
  info?: {
    hasFixedSalt: boolean;
    userUuidMatch: boolean;
    cacheValid: boolean;
    userId?: string;
  };
  error?: string;
}> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const storedUUID = await AsyncStorage.getItem(STATIC_MP_KEYS.USER_UUID);
    const fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);

    const hasFixedSalt = fixedSalt !== null && fixedSalt !== '';
    const userUuidMatch = storedUUID === currentUser.uid;
    const cacheValid =
      staticMPCache !== null &&
      staticMPCache.userId === currentUser.uid &&
      Date.now() - staticMPCache.timestamp < STATIC_MP_CACHE_TTL;

    return {
      success: true,
      info: {
        hasFixedSalt,
        userUuidMatch,
        cacheValid,
        userId: currentUser.uid,
      },
    };
  } catch (error: any) {
    console.error('❌ [StaticMP] Get info failed:', error);
    return {
      success: false,
      error: error.message || 'Get info failed',
    };
  }
};

/**
 * Verify if static master password can be generated for current user
 */
export const verifyStaticMasterPassword = async (): Promise<{
  success: boolean;
  valid?: boolean;
  userId?: string;
  error?: string;
}> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const storedUUID = await AsyncStorage.getItem(STATIC_MP_KEYS.USER_UUID);
    const fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);

    const valid =
      storedUUID === currentUser.uid && fixedSalt !== null && fixedSalt !== '';

    return {
      success: true,
      valid: valid,
      userId: currentUser.uid,
    };
  } catch (error: any) {
    console.error('❌ [StaticMP] Verification failed:', error);
    return {
      success: false,
      error: error.message || 'Verification failed',
    };
  }
};

/**
 * Clear static master password cache (useful after logout)
 */
export const clearStaticMasterPasswordCache = async (): Promise<void> => {
  staticMPCache = null;
  inFlightRequest = null;
  console.log('🧹 [StaticMP] Cache cleared');
};

/**
 * Reset static master password (WARNING: This will make all encrypted data unrecoverable!)
 */
export const resetStaticMasterPassword = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.warn('⚠️ [StaticMP] Resetting static master password...');
    console.warn('⚠️ [StaticMP] All encrypted data will become unrecoverable!');

    // Clear cache and in-flight request
    staticMPCache = null;
    inFlightRequest = null;

    // Remove stored values
    await AsyncStorage.removeItem(STATIC_MP_KEYS.FIXED_SALT);
    await AsyncStorage.removeItem(STATIC_MP_KEYS.USER_UUID);

    console.log('✅ [StaticMP] Static master password reset complete');
    return { success: true };
  } catch (error: any) {
    console.error('❌ [StaticMP] Reset failed:', error);
    return {
      success: false,
      error: error.message || 'Reset failed',
    };
  }
};

/**
 * Get effective master password (returns result object for better error handling)
 */
export const getEffectiveMasterPassword =
  async (): Promise<StaticMasterPasswordResult> => {
    return await generateStaticMasterPassword();
  };

/**
 * Clear all static master password data (for logout)
 */
export const clearStaticMasterPasswordData = async (): Promise<void> => {
  try {
    console.log('🧹 [StaticMP] Clearing all static master password data...');
    staticMPCache = null;
    inFlightRequest = null;
    await AsyncStorage.removeItem(STATIC_MP_KEYS.FIXED_SALT);
    await AsyncStorage.removeItem(STATIC_MP_KEYS.USER_UUID);
    console.log('✅ [StaticMP] All data cleared');
  } catch (error) {
    console.error('❌ [StaticMP] Failed to clear data:', error);
  }
};
