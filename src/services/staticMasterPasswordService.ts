// Static Master Password Service - PIN + Biometric Security
// Master password is encrypted with PIN and stored on Firebase
// PIN is never stored (user enters once per unlock)
// Biometric is device-only (OS handles security)
import { getCurrentUser, getFirebaseFirestore } from './firebase';
import {
  deriveKeyFromPassword,
  generateSalt,
  CRYPTO_CONSTANTS,
} from './cryptoService';
import {
  pinSecurityService,
  type PinEncryptedMasterPassword,
} from './pinSecurityService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionCache } from '../utils/sessionCache';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Storage keys for static master password (device local only)
export const STATIC_MP_KEYS = {
  FIXED_SALT: 'static_mp_fixed_salt', // Generated once, never changes (plaintext, not secret)
  USER_UUID: 'static_mp_user_uuid', // For consistency checks
  PIN_SETUP_COMPLETE: 'static_mp_pin_setup_complete', // Flag to check if setup done
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
const STATIC_MP_CACHE_TTL = 0; // DISABLED: No caching - require PIN/biometric for every operation (security-first)

// In-flight request deduplication - prevents multiple concurrent PBKDF2 operations
let inFlightRequest: Promise<StaticMasterPasswordResult> | null = null;

export interface StaticMasterPasswordResult {
  success: boolean;
  password?: string;
  derivedKey?: string;
  userId?: string;
  masterPassword?: string; // The decrypted user's master password (for entry decryption)
  error?: string;
}

/**
 * Save encrypted fixed salt to Firebase
 * Encrypts the salt with user's master password before storing
 */
const saveEncryptedSaltToFirebase = async (
  uid: string,
  fixedSalt: string,
  userMasterPassword: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    console.log('📤 [StaticMP] Encrypting and saving salt to Firebase...');

    // Derive encryption key from master password (using empty salt for deterministic key)
    const encryptionKey = deriveKeyFromPassword(
      userMasterPassword,
      '', // Empty salt for deterministic encryption
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    // Import CryptoJS for AES encryption
    const CryptoJS = await import('crypto-js');

    // Encrypt the fixed salt
    const encrypted = CryptoJS.AES.encrypt(fixedSalt, encryptionKey);
    const ciphertext = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    const iv = encrypted.iv.toString(CryptoJS.enc.Hex);
    const salt = encrypted.salt.toString(CryptoJS.enc.Hex);

    // Save to Firebase
    const userDocRef = doc(firestore, 'users', uid);
    await setDoc(
      userDocRef,
      {
        encryptedFixedSalt: ciphertext,
        saltEncryptionIV: iv,
        saltEncryptionSalt: salt,
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    console.log('✅ [StaticMP] Salt encrypted and saved to Firebase');
    return { success: true };
  } catch (error) {
    console.error('❌ [StaticMP] Failed to save encrypted salt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save salt',
    };
  }
};

/**
 * Fetch and decrypt fixed salt from Firebase
 * Decrypts the salt using user's master password
 */
const fetchDecryptedSaltFromFirebase = async (
  uid: string,
  userMasterPassword: string,
): Promise<{ success: boolean; salt?: string; error?: string }> => {
  try {
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    console.log('📥 [StaticMP] Fetching encrypted salt from Firebase...');

    const userDocRef = doc(firestore, 'users', uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
      console.log('ℹ️ [StaticMP] No salt data found in Firebase');
      return {
        success: false,
        error: 'No salt data found',
      };
    }

    const data = docSnap.data();
    const ciphertext = data?.encryptedFixedSalt;
    const iv = data?.saltEncryptionIV;
    const salt = data?.saltEncryptionSalt;

    if (!ciphertext || !iv || !salt) {
      console.log('⚠️ [StaticMP] Incomplete salt encryption data in Firebase');
      return {
        success: false,
        error: 'Incomplete encryption data',
      };
    }

    // Derive decryption key from master password (using empty salt for deterministic key)
    const decryptionKey = deriveKeyFromPassword(
      userMasterPassword,
      '', // Empty salt for deterministic encryption
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    // Import CryptoJS for AES decryption
    const CryptoJS = await import('crypto-js');

    // Reconstruct the encrypted object
    const encryptedData = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(ciphertext),
      iv: CryptoJS.enc.Hex.parse(iv),
      salt: CryptoJS.enc.Hex.parse(salt),
    });

    // Decrypt the fixed salt
    const decrypted = CryptoJS.AES.decrypt(encryptedData, decryptionKey);
    const decryptedSalt = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedSalt) {
      throw new Error(
        'Decryption failed - invalid master password or corrupted data',
      );
    }

    console.log('✅ [StaticMP] Salt decrypted from Firebase');
    return {
      success: true,
      salt: decryptedSalt,
    };
  } catch (error) {
    console.error('❌ [StaticMP] Failed to fetch/decrypt salt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decrypt salt',
    };
  }
};

/**
 * Get Master Password encrypted with PIN from Firebase
 * @param uid - User ID
 * @returns Encrypted Master Password from Firebase
 */
const getMasterPasswordFromFirebase = async (
  uid: string,
): Promise<{
  success: boolean;
  encryptedMP?: PinEncryptedMasterPassword;
  error?: string;
}> => {
  try {
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    console.log(
      '📥 [StaticMP] Fetching encrypted Master Password from Firebase...',
    );

    const userDocRef = doc(firestore, 'users', uid);

    // Fetch with timeout
    const fetchPromise = getDoc(userDocRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'Firebase fetch timeout (3s) - check Firestore rules or user auth',
            ),
          ),
        3000,
      ),
    );

    const docSnap = (await Promise.race([
      fetchPromise,
      timeoutPromise,
    ])) as Awaited<typeof fetchPromise>;

    if (!docSnap.exists()) {
      console.log('❌ [StaticMP] No Master Password data found in Firebase');
      return {
        success: false,
        error: 'No Master Password found - user needs to setup first',
      };
    }

    const data = docSnap.data();
    const ciphertext = data?.encryptedMasterPassword;
    const iv = data?.mpIV;
    const tag = data?.mpTag;

    if (!ciphertext || !iv || !tag) {
      throw new Error('Incomplete Master Password encryption data in Firebase');
    }

    console.log(
      '✅ [StaticMP] Encrypted Master Password retrieved from Firebase',
    );

    return {
      success: true,
      encryptedMP: { ciphertext, iv, tag },
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : 'Failed to fetch Master Password';
    console.error('❌ [StaticMP] Firebase fetch error:', error);
    return {
      success: false,
      error: errorMsg,
    };
  }
};

/**
 * Setup: Encrypt Master Password with PIN and save to Firebase
 * Called during initial account setup
 * @param masterPassword - User's master password
 * @param userPin - User's PIN (6-8 digits, never stored)
 */
export const setupMasterPasswordWithPin = async (
  masterPassword: string,
  userPin: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    console.log('🔐 [StaticMP] Setting up Master Password with PIN...');

    // Validate PIN
    if (!pinSecurityService.isValidPin(userPin)) {
      throw new Error('Invalid PIN format - must be 6-8 digits');
    }

    // Check if salt already exists (from Firebase or local storage)
    let fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);

    if (!fixedSalt) {
      // Try to fetch from Firebase first (in case of reinstall)
      console.log('🔍 [StaticMP] Checking Firebase for existing salt...');
      const firestore = getFirebaseFirestore();
      if (firestore) {
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          fixedSalt = data?.fixedSalt;
          if (fixedSalt) {
            console.log('✅ [StaticMP] Using existing salt from Firebase');
          }
        }
      }
    } else {
      console.log('✅ [StaticMP] Using existing local salt');
    }

    // If still no salt, generate a new one (first-time setup)
    if (!fixedSalt) {
      fixedSalt = generateSalt();
      console.log('🆕 [StaticMP] Generated NEW fixed salt (first-time setup)');
    }

    // Save salt locally
    await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
    await AsyncStorage.setItem(STATIC_MP_KEYS.USER_UUID, currentUser.uid);

    // Encrypt Master Password with PIN
    const encryptedMP = pinSecurityService.encryptMasterPasswordWithPin(
      masterPassword,
      userPin,
      fixedSalt,
    );

    // Save encrypted MP to Firebase
    const firestore = getFirebaseFirestore();
    if (!firestore) {
      throw new Error('Firestore not initialized');
    }

    const userDocRef = doc(firestore, 'users', currentUser.uid);
    await setDoc(
      userDocRef,
      {
        encryptedMasterPassword: encryptedMP.ciphertext,
        mpIV: encryptedMP.iv,
        mpTag: encryptedMP.tag,
        fixedSalt: fixedSalt, // Save salt to Firebase for cross-device/reinstall recovery
        setupComplete: true,
        setupAt: Date.now(),
      },
      { merge: true },
    );

    // ✅ Save encrypted MP to AsyncStorage for Android Native autofill access
    console.log(
      '💾 [StaticMP] Saving encrypted MP to AsyncStorage during setup...',
    );
    await AsyncStorage.multiSet([
      ['@encrypted_master_password', encryptedMP.ciphertext],
      ['@encrypted_mp_iv', encryptedMP.iv],
      ['@encrypted_mp_tag', encryptedMP.tag],
    ]);
    console.log('✅ [StaticMP] Encrypted MP saved to AsyncStorage:', {
      ciphertextLength: encryptedMP.ciphertext.length,
      ivLength: encryptedMP.iv.length,
      tagLength: encryptedMP.tag.length,
    });

    // Mark setup complete locally
    await AsyncStorage.setItem(STATIC_MP_KEYS.PIN_SETUP_COMPLETE, 'true');

    // Set master password hash for database (using static password, not user's password)
    // This is required for database initialization
    const staticPassword = [
      currentUser.uid,
      currentUser.email || 'anonymous',
      fixedSalt.substring(0, 16),
    ].join('::');

    const { hashPassword, generateSalt: genSalt } = await import(
      './cryptoService'
    );
    const hashSalt = genSalt();
    const passwordHash = hashPassword(staticPassword, hashSalt);

    await AsyncStorage.multiSet([
      ['master_password_hash', passwordHash],
      ['master_password_salt', hashSalt],
      ['master_password_last_verified', Date.now().toString()],
    ]);

    console.log('✅ [StaticMP] Master password hash set');

    console.log('✅ [StaticMP] Master Password setup complete');

    return { success: true };
  } catch (error) {
    console.error('❌ [StaticMP] Setup failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Setup failed',
    };
  }
};

/**
 * Unlock: Decrypt Master Password from Firebase using PIN
 * Called on app unlock or when cache expires
 * @param userPin - User's PIN (from user input)
 */
export const unlockMasterPasswordWithPin = async (
  userPin: string,
): Promise<StaticMasterPasswordResult> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    console.log('🔓 [StaticMP] Unlocking with PIN...');

    // Check PIN lockout
    if (pinSecurityService.isPinLockedOut()) {
      const remainingTime = pinSecurityService.getPinLockoutRemainingTime();
      return {
        success: false,
        error: `Too many failed attempts. Try again in ${remainingTime} seconds.`,
      };
    }

    // ALWAYS fetch salt from Firebase first (source of truth)
    let fixedSalt: string | null = null;

    console.log(
      '🔍 [StaticMP] Fetching salt from Firebase (source of truth)...',
    );

    const firestore = getFirebaseFirestore();
    if (firestore) {
      const userDocRef = doc(firestore, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        fixedSalt = data?.fixedSalt;

        if (fixedSalt) {
          console.log(
            '✅ [StaticMP] Using salt from Firebase:',
            fixedSalt.substring(0, 16) + '...',
          );

          // Update local storage to match Firebase
          await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
        }
      }
    }

    // Fallback to local storage only if Firebase doesn't have it
    if (!fixedSalt) {
      console.log(
        '⚠️ [StaticMP] Salt not in Firebase, checking local storage...',
      );
      fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);

      if (fixedSalt) {
        console.log(
          '⚠️ [StaticMP] Using local salt (Firebase should be updated):',
          fixedSalt.substring(0, 16) + '...',
        );
      }
    }

    // If still no salt, cannot proceed
    if (!fixedSalt) {
      throw new Error(
        'Fixed salt not found - user needs to setup Master Password first',
      );
    }

    // Get encrypted Master Password from Firebase
    const fbResult = await getMasterPasswordFromFirebase(currentUser.uid);
    if (!fbResult.success || !fbResult.encryptedMP) {
      throw new Error(
        fbResult.error || 'Failed to fetch encrypted Master Password',
      );
    }

    // ✅ Save encrypted MP to AsyncStorage for Android Native autofill access
    console.log(
      '💾 [StaticMP] Saving encrypted MP to AsyncStorage for autofill...',
    );
    await AsyncStorage.multiSet([
      ['@encrypted_master_password', fbResult.encryptedMP.ciphertext],
      ['@encrypted_mp_iv', fbResult.encryptedMP.iv],
      ['@encrypted_mp_tag', fbResult.encryptedMP.tag],
    ]);
    console.log('✅ [StaticMP] Encrypted MP saved to AsyncStorage:', {
      ciphertextLength: fbResult.encryptedMP.ciphertext.length,
      ivLength: fbResult.encryptedMP.iv.length,
      tagLength: fbResult.encryptedMP.tag.length,
    });

    // Decrypt Master Password with PIN
    const decryptResult = pinSecurityService.decryptMasterPasswordWithPin(
      fbResult.encryptedMP,
      userPin,
      fixedSalt,
    );

    if (!decryptResult.success || !decryptResult.masterPassword) {
      return {
        success: false,
        error: decryptResult.error,
      };
    }

    // Get the user's actual Master Password (decrypted from Firebase)
    const userMasterPassword = decryptResult.masterPassword;

    // Generate static master password (UID::email::salt_prefix) for vault encryption
    const staticPassword = [
      currentUser.uid,
      currentUser.email || 'anonymous',
      fixedSalt.substring(0, 16),
    ].join('::');

    const derivedKey = deriveKeyFromPassword(
      staticPassword,
      fixedSalt,
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    // Cache in memory (session-based)
    staticMPCache = {
      password: staticPassword,
      derivedKey,
      timestamp: Date.now(),
      userId: currentUser.uid,
    };

    console.log('✅ [StaticMP] Unlock successful');

    return {
      success: true,
      password: staticPassword, // Return static password for vault decryption (not user's master password)
      masterPassword: userMasterPassword, // Return the decrypted user's master password for entry decryption
      derivedKey, // Keep the static derived key for vault encryption
      userId: currentUser.uid,
    };
  } catch (error) {
    console.error('❌ [StaticMP] Unlock failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unlock failed',
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
      error: 'User not authenticated - cannot generate static master password',
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
    const cacheAge = Math.round((Date.now() - staticMPCache.timestamp) / 1000);
    console.log(
      `🚀 [StaticMP] Cache hit (${cacheHitTime}ms, age: ${cacheAge}s)`,
    );

    // Validate cache has valid password
    if (!staticMPCache.password || typeof staticMPCache.password !== 'string') {
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
        console.log(
          '🔐 [StaticMP] userMasterPassword provided - attempting Firebase sync...',
        );

        // Check if Firebase is ready
        const firestore = getFirebaseFirestore();
        console.log(
          `🔥 [StaticMP] Firebase ready: ${!!firestore}, Current user UID: ${
            currentUser.uid
          }`,
        );

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
            console.warn(
              '⚠️ [StaticMP] Firebase fetch error:',
              firebaseFetch.error,
            );
            if (
              firebaseFetch.error.includes('tag') ||
              firebaseFetch.error.includes('decrypt')
            ) {
              console.warn(
                '⚠️ [StaticMP] Firebase data may be corrupted or password mismatch detected',
              );
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
              console.warn(
                '⚠️ [StaticMP] Failed to save salt to Firebase:',
                firebaseSave.error,
              );
            }
          } else {
            console.log(
              '✅ [StaticMP] Using existing salt from local storage (Firebase unavailable/corrupted)',
            );

            // Local salt exists - also try to re-save to Firebase to fix any corruption
            const firebaseSave = await saveEncryptedSaltToFirebase(
              currentUser.uid,
              fixedSalt,
              userMasterPassword,
            );
            if (firebaseSave.success) {
              console.log(
                '📤 [StaticMP] Local salt re-encrypted and saved to Firebase',
              );
            } else {
              console.warn(
                '⚠️ [StaticMP] Could not sync salt to Firebase, but local copy is valid',
              );
            }
          }
        }
      } else {
        // No userMasterPassword - use local AsyncStorage only (backwards compatible)
        console.log(
          '⚠️ [StaticMP] No userMasterPassword provided - using local storage only',
        );
        fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
        if (!fixedSalt) {
          // Generate new fixed salt (only happens once per user)
          fixedSalt = generateSalt();
          await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, fixedSalt);
          console.log(
            '🆕 [StaticMP] New fixed salt generated and stored locally',
          );
        } else {
          console.log(
            '🔄 [StaticMP] Using existing fixed salt from local storage',
          );
        }
      }

      // Step 4b: Store user UUID for consistency
      await AsyncStorage.setItem(STATIC_MP_KEYS.USER_UUID, currentUser.uid);

      // Step 4c: Create static master password
      // Format: UID::email::fixed_salt_first_16_chars
      // This NEVER changes, so all entries can always be decrypted
      if (!fixedSalt || typeof fixedSalt !== 'string') {
        throw new Error('Invalid fixed salt - cannot generate static password');
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
        throw new Error('Failed to derive cryptographic key - invalid result');
      }

      // Step 4e: Cache the result
      staticMPCache = {
        password: staticPassword,
        derivedKey: derivedKey,
        timestamp: Date.now(),
        userId: currentUser.uid,
        originalUserPassword: userMasterPassword, // Store original password for Firebase operations
      };

      const duration = Date.now() - startTime;
      console.log(
        `✅ [StaticMP] Static master password generated (${duration}ms)`,
      );
      console.log(
        `🔒 [StaticMP] Password pattern: ${staticPassword.substring(0, 40)}...`,
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
 * With PIN flow: Returns cached MP if available (and valid)
 * Otherwise requires unlock with PIN
 */
export const getEffectiveMasterPassword =
  async (): Promise<StaticMasterPasswordResult> => {
    // Check if we have valid cached master password
    if (
      staticMPCache &&
      Date.now() - staticMPCache.timestamp < STATIC_MP_CACHE_TTL
    ) {
      console.log('🚀 [StaticMP] Returning cached master password');
      return {
        success: true,
        password: staticMPCache.password,
        derivedKey: staticMPCache.derivedKey,
        userId: staticMPCache.userId,
      };
    }

    // No valid cache - need PIN unlock
    console.log(
      '⚠️ [StaticMP] No cached master password - requires PIN unlock',
    );
    return {
      success: false,
      error: 'Master password not cached - PIN unlock required',
    };
  };

/**
 * Clear all static master password data (for logout)
 * Clears in-memory cache but keeps fixed salt locally
 */
export const clearStaticMasterPasswordData = async (): Promise<void> => {
  try {
    console.log('🧹 [StaticMP] Clearing master password cache...');
    staticMPCache = null;
    inFlightRequest = null;
    pinSecurityService.clearPinLockout();
    console.log(
      '✅ [StaticMP] Cache cleared (fixed salt kept locally for device)',
    );
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
    const passwordToUse =
      userMasterPassword || staticMPCache?.originalUserPassword;

    console.log(
      `📥 [StaticMP] getFixedSalt called with password: ${
        passwordToUse ? 'provided' : 'empty/undefined'
      }, user: ${currentUser ? 'authenticated' : 'not authenticated'}`,
    );

    // First, try local storage (primary source for active session)
    const localSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);
    if (localSalt) {
      console.log(
        '📦 [StaticMP] Using fixedSalt from local storage (primary source)',
      );
      return localSalt;
    }

    // If no local salt but password provided, try Firebase (only as secondary)
    if (passwordToUse && currentUser) {
      try {
        console.log(
          '🔐 [StaticMP] No local salt found, fetching from Firebase (secondary)...',
        );
        const firebaseResult = await fetchDecryptedSaltFromFirebase(
          currentUser.uid,
          passwordToUse,
        );

        if (firebaseResult.success && firebaseResult.salt) {
          const firebaseSalt = firebaseResult.salt;

          // Store the Firebase salt locally for future use
          await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, firebaseSalt);
          console.log(
            '✅ [StaticMP] Using fixedSalt from Firebase (cached locally for next use)',
          );
          return firebaseSalt;
        }
      } catch (firebaseError) {
        console.warn('⚠️ [StaticMP] Firebase fetch failed');
        if (
          firebaseError instanceof Error &&
          !firebaseError.message.includes('timeout')
        ) {
          console.warn(
            '⚠️ [StaticMP] Firebase decryption failed - data may be corrupted',
          );
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

    console.log(
      '🔐 [StaticMP] Generating master password with provided fixedSalt...',
    );

    const passwordComponents = [
      currentUser.uid,
      currentUser.email || 'anonymous',
      fixedSalt.substring(0, 16),
    ];

    const staticPassword = passwordComponents.join('::');

    console.log(
      '🔑 [StaticMP] Deriving cryptographic key with provided salt...',
    );
    const derivedKey = deriveKeyFromPassword(
      staticPassword,
      fixedSalt,
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    );

    if (!derivedKey || typeof derivedKey !== 'string') {
      throw new Error('Failed to derive cryptographic key');
    }

    console.log(
      '✅ [StaticMP] Master password generated with provided fixedSalt',
    );

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
): Promise<{
  success: boolean;
  action?: 'uploaded' | 'fetched';
  error?: string;
}> => {
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
        console.log(
          '⚠️ [StaticMP] Salt mismatch detected - updating local with Firebase version',
        );
        await AsyncStorage.setItem(STATIC_MP_KEYS.FIXED_SALT, firebaseSalt);
      }

      console.log(
        '✅ [StaticMP] Fetched salt from Firebase and synced locally',
      );
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

/**
 * Re-encrypt all existing passwords with new master password and PIN
 * Called when user chooses to update their credentials
 * @param newMasterPassword - New master password
 * @param newPin - New PIN (6-8 digits)
 */
export const updateAndReencryptCredentials = async (
  newMasterPassword: string,
  newPin: string,
): Promise<{ success: boolean; reencryptedCount?: number; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser?.uid) {
      throw new Error('User not authenticated');
    }

    console.log(
      '🔄 [StaticMP] Starting credential update and re-encryption...',
    );

    // Step 1: Setup new credentials with PIN
    const setupResult = await setupMasterPasswordWithPin(
      newMasterPassword,
      newPin,
    );
    if (!setupResult.success) {
      throw new Error(setupResult.error || 'Failed to setup new credentials');
    }

    console.log('✅ [StaticMP] New credentials saved to Firebase');

    // Step 2: Clear cache and regenerate static password with new credentials
    staticMPCache = null; // Clear old cache

    // Generate static password (UID::email::salt) - this hasn't changed
    // because it's derived from UID, email, and the SAME fixedSalt
    const staticPasswordResult = await generateStaticMasterPassword();
    if (!staticPasswordResult.success || !staticPasswordResult.derivedKey) {
      throw new Error('Failed to generate static password for database');
    }

    // Step 3: Set master password hash for database initialization
    // In PIN-based system, we use static password hash instead of user's password hash
    const { hashPassword, generateSalt: genSalt } = await import(
      './cryptoService'
    );
    const hashSalt = genSalt();
    const passwordHash = hashPassword(staticPasswordResult.password!, hashSalt);

    await AsyncStorage.multiSet([
      ['master_password_hash', passwordHash],
      ['master_password_salt', hashSalt],
      ['master_password_last_verified', Date.now().toString()],
    ]);

    console.log('✅ [StaticMP] Master password hash set for database');

    // Step 4: Re-initialize database with static password (not user's password!)
    const { EncryptedDatabaseService } = await import(
      './encryptedDatabaseService'
    );
    const dbService = EncryptedDatabaseService.getInstance();

    // Initialize with STATIC password (UID::email::salt), NOT user's Master Password
    await dbService.initialize(staticPasswordResult.password!);

    console.log('🔐 [StaticMP] Re-encrypting all password entries...');

    // Note: The existing password entries are already stored encrypted
    // Since the static master password is derived from UID::email::salt,
    // and that doesn't change, the old encrypted entries can still be decrypted
    // and re-encrypted with the new static password
    // However, for better security, we should re-save all entries to update their encryption

    // This is handled automatically when accessing entries through the app,
    // as they'll be decrypted with old key and saved with new key
    // For now, we just log successful update

    console.log(
      '✅ [StaticMP] Credential update complete - entries will be re-encrypted on next access',
    );

    return {
      success: true,
      reencryptedCount: 0, // Entries are re-encrypted on-demand
    };
  } catch (error) {
    console.error('❌ [StaticMP] Credential update failed:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Credential update failed',
    };
  }
};

/**
 * Cache encrypted master password to AsyncStorage for Android Native Autofill access
 * This should be called after biometric authentication succeeds
 * so that autofill can decrypt the master password using PIN
 */
export const cacheEncryptedMasterPasswordToAsyncStorage = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser?.uid) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    console.log(
      '💾 [StaticMP] Caching encrypted MP to AsyncStorage for autofill...',
    );

    // Fetch encrypted data from Firebase
    const fbResult = await getMasterPasswordFromFirebase(currentUser.uid);
    if (!fbResult.success || !fbResult.encryptedMP) {
      return {
        success: false,
        error: fbResult.error || 'Failed to fetch encrypted Master Password',
      };
    }

    // Save to AsyncStorage for React Native access
    await AsyncStorage.multiSet([
      ['@encrypted_master_password', fbResult.encryptedMP.ciphertext],
      ['@encrypted_mp_iv', fbResult.encryptedMP.iv],
      ['@encrypted_mp_tag', fbResult.encryptedMP.tag],
    ]);

    // Also save to SharedPreferences for Android Native autofill access
    const { NativeModules } = await import('react-native');
    const { SharedPreferencesModule } = NativeModules;

    if (SharedPreferencesModule) {
      try {
        // Get fixed salt from AsyncStorage
        const fixedSalt = await AsyncStorage.getItem(STATIC_MP_KEYS.FIXED_SALT);

        await SharedPreferencesModule.saveEncryptedData({
          ciphertext: fbResult.encryptedMP.ciphertext,
          iv: fbResult.encryptedMP.iv,
          tag: fbResult.encryptedMP.tag,
          fixedSalt: fixedSalt || '', // Include fixed salt
          userId: currentUser.uid, // Include user ID for static password generation
          userEmail: currentUser.email || 'anonymous', // Include email for static password generation
        });
        console.log(
          '✅ [StaticMP] Encrypted MP also saved to SharedPreferences for native autofill',
        );
      } catch (err) {
        console.warn('⚠️ [StaticMP] Failed to save to SharedPreferences:', err);
      }
    }

    console.log('✅ [StaticMP] Encrypted MP cached to AsyncStorage:', {
      ciphertextLength: fbResult.encryptedMP.ciphertext.length,
      ivLength: fbResult.encryptedMP.iv.length,
      tagLength: fbResult.encryptedMP.tag.length,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ [StaticMP] Failed to cache encrypted MP:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to cache encrypted MP',
    };
  }
};
