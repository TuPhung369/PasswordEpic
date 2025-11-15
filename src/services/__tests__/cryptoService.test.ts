import {
  generateSecureRandom,
  generateSalt,
  generateIV,
  deriveKeyFromPassword,
  encryptData,
  decryptData,
  encryptPasswordEntry,
  decryptPasswordEntry,
  hashPassword,
  verifyPassword,
  generateSecurePassword,
  CRYPTO_CONSTANTS,
  type PasswordEntry,
  type EncryptedPasswordEntry,
} from '../cryptoService';

describe('CryptoService', () => {
  // ==================== Random Generation ====================
  describe('generateSecureRandom', () => {
    it('should generate random bytes of correct length', () => {
      const length = 32;
      const random = generateSecureRandom(length);

      // Hex encoding: each byte = 2 chars
      expect(random).toHaveLength(length * 2);
    });

    it('should generate different random values each time', () => {
      const random1 = generateSecureRandom(16);
      const random2 = generateSecureRandom(16);

      expect(random1).not.toBe(random2);
    });

    it('should generate valid hex strings', () => {
      const random = generateSecureRandom(16);
      expect(/^[0-9a-f]+$/.test(random)).toBe(true);
    });

    it('should throw on invalid length', () => {
      expect(() => generateSecureRandom(0)).toThrow();
    });
  });

  describe('generateSalt', () => {
    it('should generate salt of correct length', () => {
      const salt = generateSalt();
      const expectedLength = CRYPTO_CONSTANTS.SALT_LENGTH * 2; // hex encoding
      expect(salt).toHaveLength(expectedLength);
    });

    it('should generate different salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('generateIV', () => {
    it('should generate IV of correct length', () => {
      const iv = generateIV();
      const expectedLength = CRYPTO_CONSTANTS.IV_LENGTH * 2; // hex encoding
      expect(iv).toHaveLength(expectedLength);
    });
  });

  // ==================== Key Derivation ====================
  describe('deriveKeyFromPassword', () => {
    it('should derive key of correct length', () => {
      const salt = generateSalt();
      const key = deriveKeyFromPassword('password123', salt);

      // 256 bits = 32 bytes = 64 hex chars
      expect(key).toHaveLength(64);
    });

    it('should produce same key with same inputs', () => {
      const salt = generateSalt();
      const password = 'testPassword123!';

      const key1 = deriveKeyFromPassword(password, salt, 2000);
      const key2 = deriveKeyFromPassword(password, salt, 2000);

      expect(key1).toBe(key2);
    });

    it('should produce different keys with different passwords', () => {
      const salt = generateSalt();

      const key1 = deriveKeyFromPassword('password1', salt);
      const key2 = deriveKeyFromPassword('password2', salt);

      expect(key1).not.toBe(key2);
    });

    it('should produce different keys with different salts', () => {
      const password = 'samePassword';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = deriveKeyFromPassword(password, salt1);
      const key2 = deriveKeyFromPassword(password, salt2);

      expect(key1).not.toBe(key2);
    });

    it('should use default iterations when not specified', () => {
      const salt = generateSalt();
      const password = 'test';

      const key1 = deriveKeyFromPassword(password, salt);
      const key2 = deriveKeyFromPassword(
        password,
        salt,
        CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
      );

      expect(key1).toBe(key2);
    });

    it('should cache derived keys', () => {
      const salt = generateSalt();
      const password = 'password';

      const start = Date.now();
      const key1 = deriveKeyFromPassword(password, salt);
      const time1 = Date.now() - start;

      const start2 = Date.now();
      const key2 = deriveKeyFromPassword(password, salt);
      const time2 = Date.now() - start2;

      // Second call should be much faster (cached)
      expect(key2).toBe(key1);
      expect(time2).toBeLessThan(time1);
    });
  });

  // ==================== Encryption/Decryption ====================
  describe('encryptData', () => {
    it('should encrypt data successfully', () => {
      const plaintext = 'Hello, World!';
      const key = deriveKeyFromPassword('password', generateSalt());

      const result = encryptData(plaintext, key);

      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result.ciphertext).toBeTruthy();
      expect(result.iv).toBeTruthy();
      expect(result.tag).toBeTruthy();
    });

    it('should generate different ciphertexts for same plaintext', () => {
      const plaintext = 'Same message';
      const key = deriveKeyFromPassword('password', generateSalt());

      const result1 = encryptData(plaintext, key);
      const result2 = encryptData(plaintext, key);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });

    it('should use provided IV if given', () => {
      const plaintext = 'Test';
      const key = deriveKeyFromPassword('password', generateSalt());
      const customIV = generateIV();

      const result = encryptData(plaintext, key, customIV);

      expect(result.iv).toBe(customIV);
    });

    it('should generate IV if not provided', () => {
      const plaintext = 'Test';
      const key = deriveKeyFromPassword('password', generateSalt());

      const result = encryptData(plaintext, key);

      expect(result.iv).toHaveLength(CRYPTO_CONSTANTS.IV_LENGTH * 2);
    });
  });

  describe('decryptData', () => {
    it('should decrypt encrypted data', () => {
      const plaintext = 'Secret message';
      const key = deriveKeyFromPassword('password', generateSalt());

      const encrypted = encryptData(plaintext, key);
      const decrypted = decryptData(
        encrypted.ciphertext,
        key,
        encrypted.iv,
        encrypted.tag,
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong key', () => {
      const plaintext = 'Secret data';
      const key1 = deriveKeyFromPassword('password1', generateSalt());
      const key2 = deriveKeyFromPassword('password2', generateSalt());

      const encrypted = encryptData(plaintext, key1);

      expect(() =>
        decryptData(encrypted.ciphertext, key2, encrypted.iv, encrypted.tag),
      ).toThrow();
    });

    it('should fail with wrong IV', () => {
      const plaintext = 'Data';
      const key = deriveKeyFromPassword('password', generateSalt());
      const wrongIV = generateIV();

      const encrypted = encryptData(plaintext, key);

      expect(() =>
        decryptData(encrypted.ciphertext, key, wrongIV, encrypted.tag),
      ).toThrow();
    });

    it('should fail with wrong tag', () => {
      const plaintext = 'Secure data';
      const key = deriveKeyFromPassword('password', generateSalt());

      const encrypted = encryptData(plaintext, key);
      const wrongTag = generateSecureRandom(CRYPTO_CONSTANTS.TAG_LENGTH);

      expect(() =>
        decryptData(encrypted.ciphertext, key, encrypted.iv, wrongTag),
      ).toThrow();
    });

    it('should fail with corrupted ciphertext', () => {
      const plaintext = 'Data';
      const key = deriveKeyFromPassword('password', generateSalt());

      const encrypted = encryptData(plaintext, key);
      const corruptedCiphertext = encrypted.ciphertext.slice(0, -2) + 'XX';

      expect(() =>
        decryptData(corruptedCiphertext, key, encrypted.iv, encrypted.tag),
      ).toThrow();
    });
  });

  // ==================== Password Entry Encryption ====================
  describe('encryptPasswordEntry', () => {
    const createTestEntry = (): PasswordEntry => ({
      id: 'entry-1',
      title: 'Gmail Account',
      username: 'john@gmail.com',
      password: 'SecurePass123!',
      url: 'https://gmail.com',
      notes: 'Personal email account',
      category: 'email',
      tags: ['personal', 'email'],
    });

    it('should encrypt password entry', () => {
      const entry = createTestEntry();
      const masterKey = deriveKeyFromPassword('masterPassword', generateSalt());

      const encrypted = encryptPasswordEntry(entry, masterKey);

      expect(encrypted).toHaveProperty('id', entry.id);
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('createdAt');
      expect(encrypted).toHaveProperty('updatedAt');
      expect(encrypted.encryptedData).toBeTruthy();
      expect(typeof encrypted.createdAt).toBe('number');
    });

    it('should generate unique salt for each entry', () => {
      const entry = createTestEntry();
      const masterKey = deriveKeyFromPassword('masterPassword', generateSalt());

      const encrypted1 = encryptPasswordEntry(entry, masterKey);
      const encrypted2 = encryptPasswordEntry(entry, masterKey);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should include all entry data', () => {
      const entry: PasswordEntry = {
        id: 'test',
        title: 'Test Entry',
        username: 'testuser',
        password: 'testpass',
        url: 'https://test.com',
        notes: 'Test notes',
        category: 'test',
        tags: ['tag1', 'tag2'],
      };
      const masterKey = deriveKeyFromPassword('master', generateSalt());

      const encrypted = encryptPasswordEntry(entry, masterKey);
      const decrypted = decryptPasswordEntry(encrypted, masterKey);

      expect(decrypted.title).toBe(entry.title);
      expect(decrypted.username).toBe(entry.username);
      expect(decrypted.password).toBe(entry.password);
      expect(decrypted.url).toBe(entry.url);
      expect(decrypted.notes).toBe(entry.notes);
      expect(decrypted.category).toBe(entry.category);
      expect(decrypted.tags).toEqual(entry.tags);
    });
  });

  describe('decryptPasswordEntry', () => {
    it('should decrypt password entry', () => {
      const entry: PasswordEntry = {
        id: 'entry-1',
        title: 'Facebook',
        username: 'john_doe',
        password: 'FacePass123!',
      };
      const masterKey = deriveKeyFromPassword('mymaster', generateSalt());

      const encrypted = encryptPasswordEntry(entry, masterKey);
      const decrypted = decryptPasswordEntry(encrypted, masterKey);

      expect(decrypted.id).toBe(entry.id);
      expect(decrypted.title).toBe(entry.title);
      expect(decrypted.username).toBe(entry.username);
      expect(decrypted.password).toBe(entry.password);
    });

    it('should fail with wrong master key', () => {
      const entry: PasswordEntry = {
        id: 'entry-1',
        title: 'Test',
        username: 'test',
        password: 'test',
      };
      const masterKey1 = deriveKeyFromPassword('password1', generateSalt());
      const masterKey2 = deriveKeyFromPassword('password2', generateSalt());

      const encrypted = encryptPasswordEntry(entry, masterKey1);

      expect(() => decryptPasswordEntry(encrypted, masterKey2)).toThrow();
    });

    it('should preserve optional fields', () => {
      const entry: PasswordEntry = {
        id: 'entry-1',
        title: 'Test',
        username: 'user',
        password: 'pass',
        url: 'https://example.com',
        notes: 'Important notes',
        category: 'work',
        tags: ['important'],
      };
      const masterKey = deriveKeyFromPassword('master', generateSalt());

      const encrypted = encryptPasswordEntry(entry, masterKey);
      const decrypted = decryptPasswordEntry(encrypted, masterKey);

      expect(decrypted.url).toBe(entry.url);
      expect(decrypted.notes).toBe(entry.notes);
      expect(decrypted.category).toBe(entry.category);
      expect(decrypted.tags).toEqual(entry.tags);
    });
  });

  // ==================== Password Hashing ====================
  describe('hashPassword', () => {
    it('should hash password', () => {
      const password = 'myPassword123!';
      const salt = generateSalt();

      const hash = hashPassword(password, salt);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should produce same hash with same inputs', () => {
      const password = 'testPass';
      const salt = generateSalt();

      const hash1 = hashPassword(password, salt);
      const hash2 = hashPassword(password, salt);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes with different passwords', () => {
      const salt = generateSalt();

      const hash1 = hashPassword('password1', salt);
      const hash2 = hashPassword('password2', salt);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes with different salts', () => {
      const password = 'samePassword';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const hash1 = hashPassword(password, salt1);
      const hash2 = hashPassword(password, salt2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', () => {
      const password = 'correctPassword123!';
      const salt = generateSalt();
      const hash = hashPassword(password, salt);

      const result = verifyPassword(password, hash, salt);

      expect(result).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'correctPassword';
      const wrongPassword = 'wrongPassword';
      const salt = generateSalt();
      const hash = hashPassword(password, salt);

      const result = verifyPassword(wrongPassword, hash, salt);

      expect(result).toBe(false);
    });

    it('should reject with wrong salt', () => {
      const password = 'password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const hash = hashPassword(password, salt1);

      const result = verifyPassword(password, hash, salt2);

      expect(result).toBe(false);
    });

    it('should handle case sensitivity', () => {
      const salt = generateSalt();
      const hash = hashPassword('Password123', salt);

      const result = verifyPassword('password123', hash, salt);

      expect(result).toBe(false);
    });
  });

  // ==================== Password Generation ====================
  describe('generateSecurePassword', () => {
    it('should generate password of correct length', () => {
      const length = 16;
      const password = generateSecurePassword(length);

      expect(password).toHaveLength(length);
    });

    it('should generate different passwords', () => {
      const password1 = generateSecurePassword(16);
      const password2 = generateSecurePassword(16);

      expect(password1).not.toBe(password2);
    });

    it('should include uppercase by default', () => {
      let hasUppercase = false;
      for (let i = 0; i < 20; i++) {
        const password = generateSecurePassword(20);
        if (/[A-Z]/.test(password)) {
          hasUppercase = true;
          break;
        }
      }
      expect(hasUppercase).toBe(true);
    });

    it('should include lowercase by default', () => {
      let hasLowercase = false;
      for (let i = 0; i < 20; i++) {
        const password = generateSecurePassword(20);
        if (/[a-z]/.test(password)) {
          hasLowercase = true;
          break;
        }
      }
      expect(hasLowercase).toBe(true);
    });

    it('should include numbers by default', () => {
      let hasNumbers = false;
      for (let i = 0; i < 20; i++) {
        const password = generateSecurePassword(20);
        if (/[0-9]/.test(password)) {
          hasNumbers = true;
          break;
        }
      }
      expect(hasNumbers).toBe(true);
    });

    it('should include symbols by default', () => {
      let hasSymbols = false;
      for (let i = 0; i < 20; i++) {
        const password = generateSecurePassword(20, {
          includeSymbols: true,
        });
        if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
          hasSymbols = true;
          break;
        }
      }
      expect(hasSymbols).toBe(true);
    });

    it('should exclude uppercase when specified', () => {
      const password = generateSecurePassword(20, {
        includeUppercase: false,
      });

      expect(/[A-Z]/.test(password)).toBe(false);
    });

    it('should exclude lowercase when specified', () => {
      const password = generateSecurePassword(20, {
        includeLowercase: false,
      });

      expect(/[a-z]/.test(password)).toBe(false);
    });

    it('should exclude numbers when specified', () => {
      const password = generateSecurePassword(20, {
        includeNumbers: false,
      });

      expect(/[0-9]/.test(password)).toBe(false);
    });

    it('should exclude symbols when specified', () => {
      const password = generateSecurePassword(20, {
        includeSymbols: false,
      });

      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(false);
    });

    it('should exclude similar characters when specified', () => {
      const password = generateSecurePassword(20, {
        excludeSimilar: true,
      });

      // Should not contain: i, l, 1, L, o, 0, O
      expect(/[il1Lo0O]/.test(password)).toBe(false);
    });

    it('should throw when no character types selected', () => {
      expect(() =>
        generateSecurePassword(16, {
          includeUppercase: false,
          includeLowercase: false,
          includeNumbers: false,
          includeSymbols: false,
        }),
      ).toThrow();
    });

    it('should handle custom length', () => {
      const lengths = [8, 16, 32, 64];
      lengths.forEach(length => {
        const password = generateSecurePassword(length);
        expect(password).toHaveLength(length);
      });
    });
  });

  // ==================== Constants ====================
  describe('CRYPTO_CONSTANTS', () => {
    it('should have correct values', () => {
      expect(CRYPTO_CONSTANTS.PBKDF2_ITERATIONS).toBe(10000);
      expect(CRYPTO_CONSTANTS.SALT_LENGTH).toBe(32);
      expect(CRYPTO_CONSTANTS.KEY_LENGTH).toBe(32);
      expect(CRYPTO_CONSTANTS.IV_LENGTH).toBe(12);
      expect(CRYPTO_CONSTANTS.TAG_LENGTH).toBe(16);
    });
  });
});
