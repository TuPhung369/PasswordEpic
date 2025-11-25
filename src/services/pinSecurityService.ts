import {
  deriveKeyFromPassword,
  encryptData,
  decryptData,
} from './cryptoService';

interface PinEncryptedMasterPassword {
  ciphertext: string;
  iv: string;
  tag: string;
}

interface PinDecryptResult {
  success: boolean;
  masterPassword?: string;
  error?: string;
}

class PinSecurityService {
  private pinAttempts = 0;
  private maxPinAttempts = 3;
  private pinLockoutTime = 5 * 60 * 1000; // 5 minutes
  private pinLockoutExpiry: number | null = null;

  /**
   * Encrypt Master Password with user PIN
   * @param masterPassword - The master password to encrypt
   * @param userPin - User's PIN (6-8 digits, never stored)
   * @param fixedSalt - The fixed salt from device
   * @returns Encrypted data ready for Firebase storage
   */
  encryptMasterPasswordWithPin(
    masterPassword: string,
    userPin: string,
    fixedSalt: string,
  ): PinEncryptedMasterPassword {
    try {
      console.log('🔐 [PinSecurity] Encrypting Master Password with PIN...');

      // Validate PIN
      if (!userPin || userPin.length < 6 || userPin.length > 8) {
        throw new Error('PIN must be 6-8 digits');
      }

      if (!/^\d+$/.test(userPin)) {
        throw new Error('PIN must contain only digits');
      }

      // Derive encryption key from PIN + salt
      const encryptionKey = deriveKeyFromPassword(userPin, fixedSalt);

      console.log(`🔑 [PinSecurity] Encryption key derived from PIN + salt`);

      // Encrypt Master Password
      const encrypted = encryptData(masterPassword, encryptionKey);

      console.log('✅ [PinSecurity] Master Password encrypted successfully');

      return {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
      };
    } catch (error) {
      console.error('❌ [PinSecurity] Encryption failed:', error);
      throw new Error(
        `Failed to encrypt Master Password: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Decrypt Master Password with user PIN
   * @param encryptedMP - Encrypted Master Password from Firebase
   * @param userPin - User's PIN (from user input)
   * @param fixedSalt - The fixed salt from device
   * @returns Decrypted Master Password
   */
  decryptMasterPasswordWithPin(
    encryptedMP: PinEncryptedMasterPassword,
    userPin: string,
    fixedSalt: string,
  ): PinDecryptResult {
    try {
      // Check if locked out
      if (this.isPinLockedOut()) {
        const remainingTime = Math.ceil(
          ((this.pinLockoutExpiry || 0) - Date.now()) / 1000,
        );
        const error = `Too many failed PIN attempts. Try again in ${remainingTime} seconds.`;
        console.warn('⏱️ [PinSecurity]', error);
        return { success: false, error };
      }

      console.log('🔐 [PinSecurity] Decrypting Master Password with PIN...');

      // Validate PIN
      if (!userPin || userPin.length < 6 || userPin.length > 8) {
        this.recordFailedPinAttempt();
        return { success: false, error: 'Invalid PIN format' };
      }

      if (!/^\d+$/.test(userPin)) {
        this.recordFailedPinAttempt();
        return { success: false, error: 'PIN must contain only digits' };
      }

      // Derive decryption key from PIN + salt
      const decryptionKey = deriveKeyFromPassword(userPin, fixedSalt);

      console.log(`🔑 [PinSecurity] Decryption key derived from PIN + salt`);

      // Attempt decryption
      const masterPassword = decryptData(
        encryptedMP.ciphertext,
        decryptionKey,
        encryptedMP.iv,
        encryptedMP.tag,
      );

      // Reset failed attempts on success
      this.pinAttempts = 0;
      this.pinLockoutExpiry = null;

      console.log('✅ [PinSecurity] Master Password decrypted successfully');

      return { success: true, masterPassword };
    } catch (error) {
      this.recordFailedPinAttempt();

      const errorMsg =
        error instanceof Error ? error.message : 'Decryption failed';

      if (errorMsg.includes('tag') || errorMsg.includes('Authentication')) {
        console.error(
          '❌ [PinSecurity] Wrong PIN - authentication tag verification failed',
        );
        return {
          success: false,
          error: `Wrong PIN. Attempts remaining: ${
            this.maxPinAttempts - this.pinAttempts
          }`,
        };
      }

      console.error('❌ [PinSecurity] Decryption error:', error);
      return {
        success: false,
        error: 'Failed to decrypt Master Password',
      };
    }
  }

  /**
   * Record failed PIN attempt and lock if exceeded
   */
  private recordFailedPinAttempt(): void {
    this.pinAttempts++;
    console.warn(
      `⚠️ [PinSecurity] Failed PIN attempt ${this.pinAttempts}/${this.maxPinAttempts}`,
    );

    if (this.pinAttempts >= this.maxPinAttempts) {
      this.pinLockoutExpiry = Date.now() + this.pinLockoutTime;
      console.error(
        '🔒 [PinSecurity] PIN locked for 5 minutes due to too many failed attempts',
      );
    }
  }

  /**
   * Check if PIN is currently locked out
   */
  isPinLockedOut(): boolean {
    if (!this.pinLockoutExpiry) {
      return false;
    }

    if (Date.now() > this.pinLockoutExpiry) {
      // Lockout expired
      this.pinAttempts = 0;
      this.pinLockoutExpiry = null;
      return false;
    }

    return true;
  }

  /**
   * Get remaining PIN attempts
   */
  getRemainingPinAttempts(): number {
    if (this.isPinLockedOut()) {
      return 0;
    }
    return Math.max(0, this.maxPinAttempts - this.pinAttempts);
  }

  /**
   * Get PIN lockout remaining time in seconds
   */
  getPinLockoutRemainingTime(): number {
    if (!this.isPinLockedOut()) {
      return 0;
    }
    return Math.ceil(((this.pinLockoutExpiry || 0) - Date.now()) / 1000);
  }

  /**
   * Clear PIN lockout (admin only)
   */
  clearPinLockout(): void {
    this.pinAttempts = 0;
    this.pinLockoutExpiry = null;
    console.log('🧹 [PinSecurity] PIN lockout cleared');
  }

  /**
   * Validate PIN format
   */
  isValidPin(pin: string): boolean {
    return !!pin && pin.length >= 6 && pin.length <= 8 && /^\d+$/.test(pin);
  }
}

export const pinSecurityService = new PinSecurityService();
export type { PinEncryptedMasterPassword, PinDecryptResult };
