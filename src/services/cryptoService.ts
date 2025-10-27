// Cryptographic service for password encryption and key derivation
import CryptoJS from 'crypto-js';

// Constants for cryptographic operations
export const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS: 10000, // 10,000 iterations - for master password hashing
  PBKDF2_ITERATIONS_STATIC: 2000, // 2,000 iterations - Optimized for mobile (reduced from 5000 for 60% faster performance)
  PBKDF2_ITERATIONS_LEGACY: 5000, // 5,000 iterations - Legacy value for backward compatibility
  SALT_LENGTH: 32, // 256 bits
  KEY_LENGTH: 32, // 256 bits for AES-256
  IV_LENGTH: 12, // 96 bits for GCM
  TAG_LENGTH: 16, // 128 bits for GCM authentication tag
};

// Generate cryptographically secure random bytes
export const generateSecureRandom = (length: number): string => {
  try {
    // Validate length
    if (!length || length <= 0) {
      throw new Error('Length must be a positive number');
    }

    // Generate random words and convert to hex
    const randomWords = CryptoJS.lib.WordArray.random(length);
    return randomWords.toString(CryptoJS.enc.Hex);
  } catch (error) {
    console.error('Failed to generate secure random bytes:', error);
    throw new Error('Failed to generate secure random data');
  }
};

// Generate a cryptographic salt
export const generateSalt = (): string => {
  return generateSecureRandom(CRYPTO_CONSTANTS.SALT_LENGTH);
};

// Generate initialization vector for AES-GCM
export const generateIV = (): string => {
  return generateSecureRandom(CRYPTO_CONSTANTS.IV_LENGTH);
};

// Derive key from password using PBKDF2
// Key cache to avoid repeated expensive derivations
const keyCache = new Map<string, { key: string; timestamp: number }>();
const KEY_CACHE_TTL = 60 * 60 * 1000; // 60 minutes (increased from 5 for better performance)

export const deriveKeyFromPassword = (
  password: string,
  salt: string,
  iterations: number = CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_STATIC, // STATIC default - DO NOT CHANGE
): string => {
  // const startTime = Date.now();
  // Create a hash of the password for cache key to avoid collisions
  const passwordHash = CryptoJS.SHA256(password).toString().substring(0, 16);
  const cacheKey = `${passwordHash}:${salt}:${iterations}`; // Safe cache key with password hash

  // Check cache first
  const cached = keyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < KEY_CACHE_TTL) {
    // console.log(`🚀 [KeyDerivation] Cache hit`);
    return cached.key;
  }

  try {
    // console.log(
    //   `🔑 [KeyDerivation] Computing key with ${iterations} iterations...`,
    // );
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: CRYPTO_CONSTANTS.KEY_LENGTH / 4, // CryptoJS uses 32-bit words
      iterations: iterations,
      hasher: CryptoJS.algo.SHA256,
    });

    const derivedKey = key.toString(CryptoJS.enc.Hex);
    // const duration = Date.now() - startTime;

    // Cache the result
    keyCache.set(cacheKey, { key: derivedKey, timestamp: Date.now() });
    // console.log(
    //   `✅ [KeyDerivation] Key derived in ${endTime - startTime}ms (cached for 5min)`,
    // );

    return derivedKey;
  } catch (error) {
    console.error('Key derivation failed:', error);
    throw new Error('Failed to derive encryption key');
  }
};

// Encrypt data using AES-GCM
export const encryptData = (
  plaintext: string,
  key: string,
  iv?: string,
): {
  ciphertext: string;
  iv: string;
  tag: string;
} => {
  try {
    // Generate IV if not provided
    const initVector = iv || generateIV();

    // Convert hex key to WordArray
    const keyWordArray = CryptoJS.enc.Hex.parse(key);
    const ivWordArray = CryptoJS.enc.Hex.parse(initVector);

    // Encrypt using AES-GCM (simulated with AES-CTR + HMAC for compatibility)
    const encrypted = CryptoJS.AES.encrypt(plaintext, keyWordArray, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    });

    // Generate authentication tag using HMAC-SHA256
    // CRITICAL: Must use the same format as decryption (hex-encoded ciphertext + IV)
    const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    const tag = CryptoJS.HmacSHA256(ciphertextHex + initVector, keyWordArray)
      .toString(CryptoJS.enc.Hex)
      .substring(0, CRYPTO_CONSTANTS.TAG_LENGTH * 2);

    return {
      ciphertext: ciphertextHex,
      iv: initVector,
      tag: tag,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Decrypt data using AES-GCM
export const decryptData = (
  ciphertext: string,
  key: string,
  iv: string,
  tag: string,
): string => {
  try {
    // Convert hex strings to WordArrays
    const keyWordArray = CryptoJS.enc.Hex.parse(key);
    const ivWordArray = CryptoJS.enc.Hex.parse(iv);
    const ciphertextWordArray = CryptoJS.enc.Hex.parse(ciphertext);

    // Verify authentication tag
    const expectedTag = CryptoJS.HmacSHA256(ciphertext + iv, keyWordArray)
      .toString(CryptoJS.enc.Hex)
      .substring(0, CRYPTO_CONSTANTS.TAG_LENGTH * 2);

    if (expectedTag !== tag) {
      throw new Error('Authentication tag verification failed');
    }

    // Decrypt using AES-CTR
    const decrypted = CryptoJS.AES.decrypt(
      {
        ciphertext: ciphertextWordArray,
      } as any,
      keyWordArray,
      {
        iv: ivWordArray,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding,
      },
    );

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('Decryption resulted in empty data');
    }

    return plaintext;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid key or corrupted data');
  }
};

// Encrypt password entry
export interface EncryptedPasswordEntry {
  id: string;
  encryptedData: string;
  iv: string;
  tag: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
}

export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category?: string;
  tags?: string[];
}

export const encryptPasswordEntry = (
  entry: PasswordEntry,
  masterKey: string,
): EncryptedPasswordEntry => {
  try {
    // Generate unique salt for this entry
    const salt = generateSalt();

    // Derive entry-specific key with STATIC iterations (DO NOT CHANGE)
    const entryKey = deriveKeyFromPassword(
      masterKey,
      salt,
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_STATIC,
    );

    // Serialize entry data
    const entryData = JSON.stringify({
      title: entry.title,
      username: entry.username,
      password: entry.password,
      url: entry.url,
      notes: entry.notes,
      category: entry.category,
      tags: entry.tags,
    });

    // Encrypt the entry data
    const encrypted = encryptData(entryData, entryKey);

    return {
      id: entry.id,
      encryptedData: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      salt: salt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch (error) {
    console.error('Failed to encrypt password entry:', error);
    throw new Error('Failed to encrypt password entry');
  }
};

export const decryptPasswordEntry = (
  encryptedEntry: EncryptedPasswordEntry,
  masterKey: string,
): PasswordEntry => {
  try {
    // Derive entry-specific key using stored salt with STATIC iterations (DO NOT CHANGE)
    const entryKey = deriveKeyFromPassword(
      masterKey,
      encryptedEntry.salt,
      CRYPTO_CONSTANTS.PBKDF2_ITERATIONS_STATIC,
    );

    // Decrypt the entry data
    const decryptedData = decryptData(
      encryptedEntry.encryptedData,
      entryKey,
      encryptedEntry.iv,
      encryptedEntry.tag,
    );

    // Parse the decrypted JSON
    const entryData = JSON.parse(decryptedData);

    return {
      id: encryptedEntry.id,
      title: entryData.title,
      username: entryData.username,
      password: entryData.password,
      url: entryData.url,
      notes: entryData.notes,
      category: entryData.category,
      tags: entryData.tags,
    };
  } catch (error) {
    console.error('Failed to decrypt password entry:', error);
    throw new Error('Failed to decrypt password entry - invalid master key');
  }
};

// Hash password for verification (not for encryption)
export const hashPassword = (password: string, salt: string): string => {
  try {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    }).toString(CryptoJS.enc.Hex);
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error('Failed to hash password');
  }
};

// Verify password against hash
export const verifyPassword = (
  password: string,
  hash: string,
  salt: string,
): boolean => {
  try {
    const computedHash = hashPassword(password, salt);
    return computedHash === hash;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
};

// Generate secure password
export const generateSecurePassword = (
  length: number = 16,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
    excludeSimilar?: boolean;
  } = {},
): string => {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    excludeSimilar = false,
  } = options;

  let charset = '';

  if (includeUppercase) {
    charset += excludeSimilar
      ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  if (includeLowercase) {
    charset += excludeSimilar
      ? 'abcdefghjkmnpqrstuvwxyz'
      : 'abcdefghijklmnopqrstuvwxyz';
  }

  if (includeNumbers) {
    charset += excludeSimilar ? '23456789' : '0123456789';
  }

  if (includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (charset.length === 0) {
    throw new Error('At least one character type must be selected');
  }

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomBytes = generateSecureRandom(1);
    const randomIndex = parseInt(randomBytes, 16) % charset.length;
    password += charset[randomIndex];
  }

  return password;
};

// Secure memory cleanup (best effort)
export const secureCleanup = (sensitiveData: string): void => {
  try {
    // In JavaScript, we can't truly clear memory, but we can overwrite the string
    // This is a best-effort approach
    if (typeof sensitiveData === 'string') {
      // Overwrite with random data (not truly secure but better than nothing)
      // const overwrite = generateSecureRandom(sensitiveData.length);
      // Note: This doesn't actually clear the original string from memory
      // but it's the best we can do in JavaScript
    }
  } catch (error) {
    console.warn('Secure cleanup failed:', error);
  }
};
