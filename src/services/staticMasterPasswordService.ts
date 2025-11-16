// Static Master Password Service - Simple and Reliable
// Master password = UID + Email + Fixed Salt (never changes)
import { getCurrentUser, getFirebaseFirestore } from './firebase';
import {
  deriveKeyFromPassword,
  generateSalt,
  CRYPTO_CONSTANTS,
  encryptData,
  decryptData,
} from './cryptoService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionCache } from '../utils/sessionCache';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  originalUserPassword?: string; // Original user-provided password for Firebase operations
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
 * Save encrypted fixed salt to Firebase
 * Encrypted with user's master password to ensure only user can decrypt it
 */
const saveEncryptedSaltToFirebase = async (
  uid: string,
  fixedSalt: string,
  masterPassword: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    console.log('🔐 [StaticMP] Encrypting salt with master password...');
    
    // Derive key from master password for encrypting the salt
    // Use empty salt for deterministic key derivation (same password = same key)
    const encryptionKey = deriveKeyFromPassword(
      masterPassword,
      '', // Empty salt for deterministic key derivation
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    console.log(`🔑 [StaticMP] Encryption key preview: ${encryptionKey.substring(0, 32)}... (${encryptionKey.length} chars)`);

    // Encrypt the salt
    const encrypted = encryptData(fixedSalt, encryptionKey);

    console.log('🔍 [StaticMP] Encrypted data before Firebase save:');
    console.log(`   Ciphertext: ${encrypted.ciphertext.substring(0, 40)}... (${encrypted.ciphertext.length} chars)`);
    console.log(`   IV: ${encrypted.iv} (${encrypted.iv.length} chars)`);
    console.log(`   Tag: ${encrypted.tag} (${encrypted.tag.length} chars)`);

    console.log('📤 [StaticMP] Saving encrypted salt to Firebase...');
    
    // Save to Firebase with user's UID as document ID
    const userDocRef = doc(firestore, 'users', uid);
    
    // Add timeout to prevent hanging on network issues
    const savePromise = setDoc(
      userDocRef,
      {
        encryptedFixedSalt: encrypted.ciphertext,
        saltEncryptionIV: encrypted.iv,
        saltEncryptionTag: encrypted.tag,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase save timeout (10s) - check network connection and Firestore rules')), 10000)
    );
    
    await Promise.race([savePromise, timeoutPromise]);

    console.log('✅ [StaticMP] Encrypted salt saved to Firebase');
    return { success: true };
  } catch (error) {
    console.error('❌ [StaticMP] Failed to save encrypted salt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Fetch and decrypt fixed salt from Firebase
 * User must provide master password to decrypt it
 */
const fetchDecryptedSaltFromFirebase = async (
  uid: string,
  masterPassword: string,
): Promise<{ success: boolean; salt?: string; error?: string }> => {
  try {
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    console.log('📥 [StaticMP] Fetching encrypted salt from Firebase...');
    console.log(`🔍 [StaticMP] User UID: ${uid}, Firestore initialized: ${!!firestore}`);
    
    const userDocRef = doc(firestore, 'users', uid);
    
    // Fetch with timeout to prevent hanging when offline
    const fetchPromise = getDoc(userDocRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase fetch timeout (3s) - check Firestore rules or user auth')), 3000)
    );
    
    const docSnap = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;

    if (!docSnap.exists()) {
      console.log('❌ [StaticMP] No salt data found in Firebase for user');
      return {
        success: false,
        error: 'No salt data found - user needs to initialize first',
      };
    }

    const data = docSnap.data();
    const encryptedSalt = data?.encryptedFixedSalt;
    const iv = data?.saltEncryptionIV;
    const tag = data?.saltEncryptionTag;

    if (!encryptedSalt || !iv || !tag) {
      throw new Error('Incomplete encryption data in Firebase');
    }

    console.log('🔍 [StaticMP] Encrypted data retrieved from Firebase:');
    console.log(`   Ciphertext: ${String(encryptedSalt).substring(0, 40)}... (${String(encryptedSalt).length} chars)`);
    console.log(`   IV: ${String(iv)} (${String(iv).length} chars)`);
    console.log(`   Tag: ${String(tag)} (${String(tag).length} chars)`);

    console.log('🔐 [StaticMP] Decrypting salt with master password...');
    
    // Derive key from master password for decrypting the salt
    // ⚠️ CRITICAL: We need to use the SAME derivation method as encryption
    // But here's the issue: we used a random salt for encryption,
    // so we need to store that salt too OR use a deterministic approach
    
    // Let me reconsider: we should use a fixed/empty salt for the encryption key
    const decryptionKey = deriveKeyFromPassword(
      masterPassword,
      '', // Empty salt for deterministic key derivation
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    console.log(`🔑 [StaticMP] Decryption key preview: ${decryptionKey.substring(0, 32)}... (${decryptionKey.length} chars)`);
    console.log(`🔐 [StaticMP] masterPassword: "${masterPassword.substring(0, 32)}..."`);

    const decryptedSalt = decryptData(encryptedSalt, decryptionKey, iv, tag);

    console.log('✅ [StaticMP] Salt decrypted successfully');
    return { success: true, salt: decryptedSalt };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to decrypt salt';
    // Only log timeout as debug, not error
    if (errorMsg.includes('Firebase fetch timeout')) {
      console.log('⏱️ [StaticMP] Firebase fetch timeout (expected when offline)');
    } else {
      console.error('❌ [StaticMP] Failed to decrypt salt:', error);
    }
    return {
      success: false,
      error: errorMsg,
    };
  }
};

/**
 * Generate static master password from user UID + email + fixed salt
 * This password NEVER changes, ensuring all entries can always be decrypted
 * 
 * @param userMasterPassword - User's master password (optional, for Firebase sync)
 *   If provided, will fetch encrypted salt from Firebase and save it if new.
 *   If not provided, will use local AsyncStorage salt (backwards compatible).
 */
export const generateStaticMasterPassword = async (
  userMasterPassword?: string,
): Promise<StaticMasterPasswordResult> => {
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
        // Re-cache in sessionCache to ensure autofill can access it
        sessionCache.set<string>(
          'masterPassword',
          staticMPCache.password,
          24 * 60 * 60 * 1000,
        );
        sessionCache.set<string>(
          'encryptionKey',
          staticMPCache.derivedKey,
          24 * 60 * 60 * 1000,
        );
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
        let fixedSalt: string | null = null;
        
        // If userMasterPassword provided, try to sync with Firebase
        if (userMasterPassword) {
          console.log('🔐 [StaticMP] userMasterPassword provided - attempting Firebase sync...');
          
          // Check if Firebase is ready
          const firestore = getFirebaseFirestore();
          console.log(`🔥 [StaticMP] Firebase ready: ${!!firestore}, Current user UID: ${currentUser.uid}`);
          
          // Try to fetch from Firebase first
          const firebaseFetch = await fetchDecryptedSaltFromFirebase(
            currentUser.uid,
            userMasterPassword,
          );
          
          if (firebaseFetch.success && firebaseFetch.salt) {
            fixedSalt = firebaseFetch.salt;
            console.log('📥 [StaticMP] Using salt from Firebase');
            // Save to local storage as backup
            await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
          } else {
            // Firebase fetch failed or no data - try local AsyncStorage
            if (firebaseFetch.error) {
              console.warn('⚠️ [StaticMP] Firebase fetch error:', firebaseFetch.error);
              if (firebaseFetch.error.includes('tag') || firebaseFetch.error.includes('decrypt')) {
                console.warn('⚠️ [StaticMP] Firebase data may be corrupted or password mismatch detected');
              }
            } else {
              console.log('ℹ️ [StaticMP] No salt data in Firebase');
            }
            console.log('📦 [StaticMP] Falling back to local storage...');
            fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
            
            if (!fixedSalt) {
              // No salt anywhere - generate new one
              fixedSalt = generateSalt();
              console.log('🆕 [StaticMP] New fixed salt generated');
              
              // Save to local storage
              await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
              
              // Save encrypted version to Firebase
              const firebaseSave = await saveEncryptedSaltToFirebase(
                currentUser.uid,
                fixedSalt,
                userMasterPassword,
              );
              if (firebaseSave.success) {
                console.log('📤 [StaticMP] New salt saved to Firebase');
              } else {
                console.warn('⚠️ [StaticMP] Failed to save salt to Firebase:', firebaseSave.error);
              }
            } else {
              console.log('✅ [StaticMP] Using existing salt from local storage (Firebase unavailable/corrupted)');
              
              // Local salt exists - also try to re-save to Firebase to fix any corruption
              const firebaseSave = await saveEncryptedSaltToFirebase(
                currentUser.uid,
                fixedSalt,
                userMasterPassword,
              );
              if (firebaseSave.success) {
                console.log('📤 [StaticMP] Local salt re-encrypted and saved to Firebase');
              } else {
                console.warn('⚠️ [StaticMP] Could not sync salt to Firebase, but local copy is valid');
              }
            }
          }
        } else {
          // No userMasterPassword - use local AsyncStorage only (backwards compatible)
          console.log('⚠️ [StaticMP] No userMasterPassword provided - using local storage only');
          fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
          if (!fixedSalt) {
            // Generate new fixed salt (only happens once per user)
            fixedSalt = generateSalt();
            await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
            console.log('🆕 [StaticMP] New fixed salt generated and stored locally');
          } else {
            console.log('🔄 [StaticMP] Using existing fixed salt from local storage');
          }
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
          CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
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
          originalUserPassword: userMasterPassword, // Store original password for Firebase operations
        };

        // Step 4f: Also store in sessionCache for autofill service access
        // This allows autofillService to retrieve the master password even when app is backgrounded
        sessionCache.set<string>(
          'masterPassword',
          staticPassword,
          24 * 60 * 60 * 1000,
        ); // 24 hours TTL
        sessionCache.set<string>(
          'encryptionKey',
          derivedKey,
          24 * 60 * 60 * 1000,
        ); // 24 hours TTL
        console.log(
          '🔐 [StaticMP] Master password cached in sessionCache for autofill access',
        );

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
  async (userMasterPassword?: string): Promise<StaticMasterPasswordResult> => {
    // If no password provided, try to use original password from cache (if available)
    const passwordToUse = userMasterPassword || staticMPCache?.originalUserPassword;
    return await generateStaticMasterPassword(passwordToUse);
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

/**
 * Get the authoritative fixed salt
 * CRITICAL: Must verify Firebase when master password available
 * Falls back to local storage only if Firebase unavailable
 */
export const getFixedSalt = async (
  userMasterPassword?: string,
): Promise<string | null> => {
  try {
    const currentUser = getCurrentUser();
    
    // If no password provided but cache has original password, use it
    const passwordToUse = userMasterPassword || staticMPCache?.originalUserPassword;
    
    console.log(`📥 [StaticMP] getFixedSalt called with password: ${passwordToUse ? 'provided' : 'empty/undefined'}, user: ${currentUser ? 'authenticated' : 'not authenticated'}`);
    
    // First, try local storage (primary source for active session)
    const localSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
    if (localSalt) {
      console.log('📦 [StaticMP] Using fixedSalt from local storage (primary source)');
      return localSalt;
    }
    
    // If no local salt but password provided, try Firebase (only as secondary)
    if (passwordToUse && currentUser) {
      try {
        console.log('🔐 [StaticMP] No local salt found, fetching from Firebase (secondary)...');
        const firebaseResult = await fetchDecryptedSaltFromFirebase(
          currentUser.uid,
          passwordToUse,
        );
        
        if (firebaseResult.success && firebaseResult.salt) {
          const firebaseSalt = firebaseResult.salt;
          
          // Store the Firebase salt locally for future use
          await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, firebaseSalt);
          console.log('✅ [StaticMP] Using fixedSalt from Firebase (cached locally for next use)');
          return firebaseSalt;
        }
      } catch (firebaseError) {
        console.warn('⚠️ [StaticMP] Firebase fetch failed');
        if (firebaseError instanceof Error && !firebaseError.message.includes('timeout')) {
          console.warn('⚠️ [StaticMP] Firebase decryption failed - data may be corrupted');
        }
      }
    }

    return null;
  } catch (error) {
    console.error('❌ [StaticMP] Failed to get fixed salt:', error);
    return null;
  }
};

/**
 * Generate static master password using a provided fixed salt
 * Used during backup restore when backup has its own fixedSalt
 */
export const generateStaticMasterPasswordWithSalt = async (
  userMasterPassword: string,
  fixedSalt: string,
): Promise<StaticMasterPasswordResult> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    console.log('🔐 [StaticMP] Generating master password with provided fixedSalt...');

    const passwordComponents = [
      currentUser.uid,
      currentUser.email || 'anonymous',
      fixedSalt.substring(0, 16),
    ];

    const staticPassword = passwordComponents.join('::');

    console.log('🔑 [StaticMP] Deriving cryptographic key with provided salt...');
    const derivedKey = deriveKeyFromPassword(
      staticPassword,
      fixedSalt,
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    if (!derivedKey || typeof derivedKey !== 'string') {
      throw new Error('Failed to derive cryptographic key');
    }

    console.log('✅ [StaticMP] Master password generated with provided fixedSalt');

    return {
      success: true,
      password: staticPassword,
      derivedKey: derivedKey,
      userId: currentUser.uid,
    };
  } catch (error: any) {
    console.error('❌ [StaticMP] Failed to generate master password:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate master password',
    };
  }
};

/**
 * Sync fixed salt with Firebase
 * - If Firebase doesn't have it: upload local salt
 * - If Firebase has it: fetch and sync to local
 */
export const syncFixedSaltWithFirebase = async (
  userMasterPassword: string,
): Promise<{ success: boolean; action?: 'uploaded' | 'fetched'; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!userMasterPassword) {
      return { success: false, error: 'Master password required' };
    }

    console.log('🔄 [StaticMP] Starting Firebase sync...');

    // Get local fixed salt
    let localSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
    if (!localSalt) {
      return { success: false, error: 'No local salt found' };
    }

    // Try to fetch from Firebase (to check if it exists)
    const firebaseFetch = await fetchDecryptedSaltFromFirebase(
      currentUser.uid,
      userMasterPassword,
    );

    if (firebaseFetch.success && firebaseFetch.salt) {
      // Firebase has salt - sync it to local storage
      const firebaseSalt = firebaseFetch.salt;
      
      if (localSalt !== firebaseSalt) {
        console.log('⚠️ [StaticMP] Salt mismatch detected - updating local with Firebase version');
        await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, firebaseSalt);
      }
      
      console.log('✅ [StaticMP] Fetched salt from Firebase and synced locally');
      return { success: true, action: 'fetched' };
    }

    // Firebase doesn't have salt - upload local salt
    console.log('📤 [StaticMP] Firebase has no salt - uploading local version');
    const saveResult = await saveEncryptedSaltToFirebase(
      currentUser.uid,
      localSalt,
      userMasterPassword,
    );

    if (saveResult.success) {
      console.log('✅ [StaticMP] Uploaded salt to Firebase');
      return { success: true, action: 'uploaded' };
    } else {
      return { success: false, error: saveResult.error };
    }
  } catch (error: any) {
    console.error('❌ [StaticMP] Firebase sync failed:', error);
    return {
      success: false,
      error: error.message || 'Firebase sync failed',
    };
  }
};
