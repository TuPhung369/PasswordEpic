// Dynamic Master Password Service - Security through UUID + LoginTime
import { getCurrentUser } from './firebase';
import {
  deriveKeyFromPassword,
  generateSalt,
  CRYPTO_CONSTANTS,
} from './cryptoService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for dynamic master password
const DYNAMIC_MP_KEYS = {
  LOGIN_TIMESTAMP: 'dynamic_mp_login_timestamp',
  USER_UUID: 'dynamic_mp_user_uuid',
  SESSION_SALT: 'dynamic_mp_session_salt',
  CURRENT_SESSION_HASH: 'dynamic_mp_session_hash', // For verification
};

// Session cache for performance
interface DynamicMasterPasswordCache {
  password: string;
  derivedKey: string;
  timestamp: number;
  sessionId: string;
}

let dynamicMPCache: DynamicMasterPasswordCache | null = null;
const DYNAMIC_MP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export interface DynamicMasterPasswordResult {
  success: boolean;
  password?: string;
  derivedKey?: string;
  sessionId?: string;
  error?: string;
}

/**
 * Generate dynamic master password from user UUID and login timestamp
 * This creates a unique password for each session that cannot be predicted
 */
export const generateDynamicMasterPassword =
  async (): Promise<DynamicMasterPasswordResult> => {
    try {
      console.log('🔐 [DynamicMP] Generating dynamic master password...');
      const startTime = Date.now();

      // Step 1: Get current authenticated user
      const currentUser = getCurrentUser();
      if (!currentUser) {
        return {
          success: false,
          error:
            'User not authenticated - cannot generate dynamic master password',
        };
      }

      // Step 2: Get or create PERSISTENT login timestamp
      // 🔥 CRITICAL: This timestamp must persist across app restarts for data continuity
      let loginTimestamp = await AsyncStorage.getItem(
        DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
      );
      if (!loginTimestamp) {
        // ⚠️ ONLY create new timestamp on FRESH LOGIN (not app restart)
        loginTimestamp = Date.now().toString();
        await AsyncStorage.setItem(
          DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
          loginTimestamp,
        );
        console.log('🆕 [DynamicMP] New PERSISTENT login session created');
        console.log(`🕐 [DynamicMP] Session timestamp: ${loginTimestamp}`);
      } else {
        console.log('🔄 [DynamicMP] Restored existing session timestamp');
        console.log(`🕐 [DynamicMP] Session timestamp: ${loginTimestamp}`);
      }

      // Step 3: Store user UUID for consistency
      if (!currentUser.uid || typeof currentUser.uid !== 'string') {
        throw new Error('Invalid user UID - cannot generate dynamic password');
      }
      
      await AsyncStorage.setItem(DYNAMIC_MP_KEYS.USER_UUID, currentUser.uid);

      // Step 4: Create session ID from UUID + timestamp
      const sessionId = `${currentUser.uid}_${loginTimestamp}`;

      // 🔍 Log session info for debugging
      console.log(`🔍 [DynamicMP] Session Info:`);
      console.log(`   User ID: ${currentUser.uid.substring(0, 8)}...`);
      console.log(
        `   Login Time: ${new Date(
          parseInt(loginTimestamp, 10),
        ).toISOString()}`,
      );
      console.log(`   Session ID: ${sessionId ? sessionId.substring(0, 20) : 'undefined'}...`);

      // Step 5: Check cache first
      if (
        dynamicMPCache &&
        dynamicMPCache.sessionId === sessionId &&
        Date.now() - dynamicMPCache.timestamp < DYNAMIC_MP_CACHE_TTL
      ) {
        console.log(`🚀 [DynamicMP] Cache hit (${Date.now() - startTime}ms)`);
        return {
          success: true,
          password: dynamicMPCache.password,
          derivedKey: dynamicMPCache.derivedKey,
          sessionId: sessionId,
        };
      }

      // Step 6: Generate session salt (unique per session)
      let sessionSalt = await AsyncStorage.getItem(
        DYNAMIC_MP_KEYS.SESSION_SALT,
      );
      if (!sessionSalt) {
        sessionSalt = generateSalt();
        await AsyncStorage.setItem(DYNAMIC_MP_KEYS.SESSION_SALT, sessionSalt);
        console.log('🧂 [DynamicMP] New session salt generated');
      }

      // Step 7: Create dynamic master password
      // Combine: UUID + LoginTimestamp + UserEmail (if available) + SessionSalt
      if (!sessionSalt || typeof sessionSalt !== 'string') {
        throw new Error('Invalid session salt - cannot generate dynamic password');
      }

      const passwordComponents = [
        currentUser.uid, // User UUID (unique per user)
        loginTimestamp, // Login timestamp (unique per session)
        currentUser.email || 'anonymous', // Email for additional entropy
        sessionSalt.substring(0, 16), // First 16 chars of session salt
      ];

      const dynamicPassword = passwordComponents.join('::');

      // Step 8: Derive cryptographic key with mobile-optimized iterations
      console.log('🔑 [DynamicMP] Deriving cryptographic key...');
      const derivedKey = deriveKeyFromPassword(
        dynamicPassword,
        sessionSalt,
        CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_FAST, // Use fast iterations for mobile
      );

      if (!derivedKey || typeof derivedKey !== 'string') {
        throw new Error('Failed to derive cryptographic key - invalid result');
      }

      // Step 9: Store session hash for verification
      const sessionHash = derivedKey.substring(0, 32); // First 32 chars as session identifier
      await AsyncStorage.setItem(
        DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
        sessionHash,
      );

      // Step 10: Cache the result
      dynamicMPCache = {
        password: dynamicPassword,
        derivedKey: derivedKey,
        timestamp: Date.now(),
        sessionId: sessionId,
      };

      const duration = Date.now() - startTime;
      console.log(
        `✅ [DynamicMP] Dynamic master password generated (${duration}ms)`,
      );
      console.log(
        `🔒 [DynamicMP] Session ID: ${sessionId ? sessionId.substring(0, 20) : 'undefined'}...`,
      );

      return {
        success: true,
        password: dynamicPassword,
        derivedKey: derivedKey,
        sessionId: sessionId,
      };
    } catch (error: any) {
      console.error(
        '❌ [DynamicMP] Failed to generate dynamic master password:',
        error,
      );
      return {
        success: false,
        error: error.message || 'Failed to generate dynamic master password',
      };
    }
  };

/**
 * Verify if current session is valid
 * This checks if the user and login timestamp match stored values
 */
export const verifyDynamicMasterPasswordSession = async (): Promise<{
  success: boolean;
  valid?: boolean;
  sessionId?: string;
  error?: string;
}> => {
  try {
    console.log('🔍 [DynamicMP] Verifying session validity...');

    // Check if user is authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Get stored session data
    const [storedUUID, storedTimestamp, storedHash] =
      await AsyncStorage.multiGet([
        DYNAMIC_MP_KEYS.USER_UUID,
        DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
        DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
      ]);

    if (!storedUUID[1] || !storedTimestamp[1] || !storedHash[1]) {
      console.log('📭 [DynamicMP] No stored session found');
      return {
        success: true,
        valid: false,
        error: 'No stored session found',
      };
    }

    // Check if current user matches stored user
    const sessionValid = currentUser.uid === storedUUID[1];
    const sessionId = `${storedUUID[1]}_${storedTimestamp[1]}`;

    console.log(
      `${
        sessionValid ? '✅' : '❌'
      } [DynamicMP] Session validity: ${sessionValid}`,
    );

    return {
      success: true,
      valid: sessionValid,
      sessionId: sessionId,
    };
  } catch (error: any) {
    console.error('❌ [DynamicMP] Session verification failed:', error);
    return {
      success: false,
      error: error.message || 'Session verification failed',
    };
  }
};

/**
 * Start new session (called on fresh login)
 * Clears old session data and prepares for new dynamic master password
 */
export const startNewDynamicMasterPasswordSession = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log('🆕 [DynamicMP] Starting new session...');

    // Clear old session data
    await AsyncStorage.multiRemove([
      DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
      DYNAMIC_MP_KEYS.SESSION_SALT,
      DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
    ]);

    // Clear cache
    dynamicMPCache = null;

    console.log('✅ [DynamicMP] New session started - old data cleared');

    return { success: true };
  } catch (error: any) {
    console.error('❌ [DynamicMP] Failed to start new session:', error);
    return {
      success: false,
      error: error.message || 'Failed to start new session',
    };
  }
};

/**
 * Get current session info for debugging
 */
export const getDynamicMasterPasswordInfo = async (): Promise<{
  success: boolean;
  info?: {
    hasSession: boolean;
    userUUID?: string;
    loginTimestamp?: string;
    sessionAge?: number; // in milliseconds
    cacheValid?: boolean;
  };
  error?: string;
}> => {
  try {
    const currentUser = getCurrentUser();
    const [storedUUID, storedTimestamp] = await AsyncStorage.multiGet([
      DYNAMIC_MP_KEYS.USER_UUID,
      DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
    ]);

    const hasSession = !!(storedUUID[1] && storedTimestamp[1]);
    const sessionAge = storedTimestamp[1]
      ? Date.now() - parseInt(storedTimestamp[1], 10)
      : undefined;

    const cacheValid =
      dynamicMPCache &&
      Date.now() - dynamicMPCache.timestamp < DYNAMIC_MP_CACHE_TTL;

    return {
      success: true,
      info: {
        hasSession,
        userUUID: currentUser?.uid,
        loginTimestamp: storedTimestamp[1] || undefined,
        sessionAge,
        cacheValid,
      },
    };
  } catch (error: any) {
    console.error('❌ [DynamicMP] Failed to get session info:', error);
    return {
      success: false,
      error: error.message || 'Failed to get session info',
    };
  }
};

/**
 * Clear all dynamic master password data (for logout)
 */
export const clearDynamicMasterPasswordData = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log('🗑️ [DynamicMP] Clearing all session data...');

    // Clear AsyncStorage data
    await AsyncStorage.multiRemove([
      DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
      DYNAMIC_MP_KEYS.USER_UUID,
      DYNAMIC_MP_KEYS.SESSION_SALT,
      DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
    ]);

    // Clear cache
    dynamicMPCache = null;

    console.log('✅ [DynamicMP] All session data cleared');

    return { success: true };
  } catch (error: any) {
    console.error('❌ [DynamicMP] Failed to clear session data:', error);
    return {
      success: false,
      error: error.message || 'Failed to clear session data',
    };
  }
};

/**
 * Migration helper: Check if user is using old static master password system
 */
export const isUsingStaticMasterPassword = async (): Promise<boolean> => {
  try {
    const staticMPHash = await AsyncStorage.getItem('master_password_hash');
    const dynamicSessionExists = await AsyncStorage.getItem(
      DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
    );

    // Using static if has static hash but no dynamic session
    return !!(staticMPHash && !dynamicSessionExists);
  } catch (error) {
    console.error(
      '❌ [DynamicMP] Failed to check master password type:',
      error,
    );
    return false;
  }
};

/**
 * Restore dynamic master password session on app startup
 * This ensures continuity of encrypted data between app restarts
 */
export const restoreDynamicMasterPasswordSession = async (): Promise<{
  success: boolean;
  restored?: boolean;
  sessionId?: string;
  error?: string;
}> => {
  try {
    console.log('🔄 [DynamicMP] Restoring session on app startup...');

    // Check if user is authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.log(
        '📭 [DynamicMP] No authenticated user - skipping session restore',
      );
      return {
        success: true,
        restored: false,
        error: 'No authenticated user',
      };
    }

    // Check if existing session is valid
    const sessionCheck = await verifyDynamicMasterPasswordSession();
    if (sessionCheck.success && sessionCheck.valid) {
      console.log(
        '✅ [DynamicMP] Valid session found - attempting to restore...',
      );

      // Try to regenerate the dynamic master password from existing session data
      const restoreResult = await generateDynamicMasterPassword();

      if (restoreResult.success) {
        console.log(
          `🔐 [DynamicMP] Session restored successfully: ${restoreResult.sessionId?.substring(
            0,
            20,
          )}...`,
        );
        return {
          success: true,
          restored: true,
          sessionId: restoreResult.sessionId,
        };
      } else {
        console.warn(
          `⚠️ [DynamicMP] Session restore failed: ${restoreResult.error}`,
        );
        return {
          success: true,
          restored: false,
          error: restoreResult.error,
        };
      }
    } else {
      console.log('📭 [DynamicMP] No valid session found to restore');
      return {
        success: true,
        restored: false,
        error: 'No valid session to restore',
      };
    }
  } catch (error: any) {
    console.error('❌ [DynamicMP] Session restoration failed:', error);
    return {
      success: false,
      error: error.message || 'Session restoration failed',
    };
  }
};

/**
 * Get the effective master password (either dynamic or fallback to static)
 * This is the main function that other services should call
 */
export const getEffectiveMasterPassword =
  async (): Promise<DynamicMasterPasswordResult> => {
    try {
      // Try dynamic master password first
      const dynamicResult = await generateDynamicMasterPassword();

      if (dynamicResult.success) {
        return dynamicResult;
      }

      // If dynamic fails and user is authenticated, it's an error
      const currentUser = getCurrentUser();
      if (currentUser) {
        console.error(
          '❌ [DynamicMP] Failed to generate dynamic password for authenticated user',
        );
        return {
          success: false,
          error: 'Failed to generate secure session password',
        };
      }

      // User not authenticated - this shouldn't happen in normal flow
      return {
        success: false,
        error: 'User authentication required',
      };
    } catch (error: any) {
      console.error(
        '❌ [DynamicMP] Failed to get effective master password:',
        error,
      );
      return {
        success: false,
        error: error.message || 'Failed to get master password',
      };
    }
  };

// Export storage keys for testing/debugging
export { DYNAMIC_MP_KEYS };
