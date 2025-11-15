/**
 * Autofill Service
 *
 * React Native bridge for Android Autofill functionality.
 * Handles communication between native autofill service and React Native app.
 *
 * Features:
 * - Credential preparation for autofill
 * - Encryption/decryption for autofill data
 * - Event handling for autofill requests
 * - Settings management
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import {
  encryptData,
  decryptData,
  decryptDataWithRetry,
  deriveKeyFromPassword,
  CRYPTO_CONSTANTS,
  generateSecureRandom,
  generateIV,
} from './cryptoService';
import { secureStorageService } from './secureStorageService';
import { autofillStatisticsService } from './autofillStatisticsService';
import type { PasswordEntry } from '../types/password';

// Native module interface - matches Kotlin AutofillBridge @ReactMethod methods
interface AutofillBridgeModule {
  isAutofillSupported(): Promise<boolean>;
  isAutofillEnabled(): Promise<boolean>;
  requestEnableAutofill(): Promise<boolean>;
  disableAutofill(): Promise<
    | boolean
    | {
        success: boolean;
        instructions: string;
        error?: string;
        action?: string;
      }
  >;
  openAutofillSettingsNow(): Promise<boolean>;
  getCredentialsForDomain(domain: string): Promise<Array<any>>;
  prepareCredentials(credentialsJson: string): Promise<boolean>;
  clearCache(): Promise<boolean>;
  updateSettings(settingsJson: string): Promise<boolean>;
  getSettings(): Promise<Record<string, any>>;
  getStatistics(): Promise<AutofillStatistics>;
  recordUsage(type: string): Promise<boolean>;
  decryptAutofillPassword(
    encryptedPasswordJson: string,
    masterKey: string,
  ): Promise<string>;
  storeDecryptedPasswordForAutofill(
    credentialId: string,
    plaintextPassword: string,
  ): Promise<boolean>;
  updateAutofillDecryptResult(
    plainTextPassword: string,
    success: boolean,
    errorMessage: string,
  ): Promise<boolean>;
}

// Mock native module for development (fallback if AutofillBridge not available)
const AutofillBridge: AutofillBridgeModule = (() => {
  if (NativeModules.AutofillBridge) {
    console.log('✅ [AutofillService] Using NATIVE AutofillBridge module');
    return NativeModules.AutofillBridge;
  } else {
    console.warn(
      '⚠️ [AutofillService] NATIVE AutofillBridge not available - using MOCK implementation',
    );
    return {
      isAutofillSupported: async () => {
        console.warn('⚠️ [Mock] isAutofillSupported called');
        return false;
      },
      isAutofillEnabled: async () => {
        console.warn('⚠️ [Mock] isAutofillEnabled called');
        return false;
      },
      requestEnableAutofill: async () => {
        console.warn(
          '⚠️ [Mock] requestEnableAutofill called - cannot open real settings in mock',
        );
        return true;
      },
      disableAutofill: async () => {
        console.warn('⚠️ [Mock] disableAutofill called');
        return {
          success: true,
          instructions:
            'Mock: Please follow your device settings to disable autofill.',
          action: 'openAutofillSettings',
        };
      },
      openAutofillSettingsNow: async () => {
        console.warn(
          '⚠️ [Mock] openAutofillSettingsNow called - cannot open real settings in mock',
        );
        return true;
      },
      getCredentialsForDomain: async () => {
        console.warn('⚠️ [Mock] getCredentialsForDomain called');
        return [];
      },
      prepareCredentials: async () => {
        console.warn('⚠️ [Mock] prepareCredentials called');
        return true;
      },
      clearCache: async () => {
        console.warn('⚠️ [Mock] clearCache called');
        return true;
      },
      updateSettings: async () => {
        console.warn('⚠️ [Mock] updateSettings called');
        return true;
      },
      getSettings: async () => {
        console.warn('⚠️ [Mock] getSettings called');
        return {};
      },
      getStatistics: async () => {
        console.warn('⚠️ [Mock] getStatistics called');
        return {
          totalFills: 0,
          totalSaves: 0,
          blockedPhishing: 0,
          lastUsed: '',
        };
      },
      recordUsage: async () => {
        console.warn('⚠️ [Mock] recordUsage called');
        return true;
      },
      decryptAutofillPassword: async (
      ) => {
        console.warn(
          '⚠️ [Mock] AutofillBridge.decryptAutofillPassword called - returning mock response',
        );
        return 'mock_decrypted_password';
      },
      storeDecryptedPasswordForAutofill: async (
        credentialId: string,
        plaintextPassword: string,
      ) => {
        console.warn(
          '⚠️ [Mock] AutofillBridge.storeDecryptedPasswordForAutofill called',
          { credentialId, hasPassword: !!plaintextPassword },
        );
        return true;
      },
      updateAutofillDecryptResult: async (
        plainTextPassword: string,
        success: boolean,
      ) => {
        console.warn(
          '⚠️ [Mock] AutofillBridge.updateAutofillDecryptResult called',
          { success, hasPassword: !!plainTextPassword },
        );
        return true;
      },
    };
  }
})();

/**
 * Autofill event types
 */
export enum AutofillEventType {
  FILL_REQUEST = 'autofill_fill_request',
  SAVE_REQUEST = 'autofill_save_request',
  SERVICE_ENABLED = 'autofill_service_enabled',
  SERVICE_DISABLED = 'autofill_service_disabled',
  ERROR = 'autofill_error',
}

/**
 * Autofill credential data
 */
export interface AutofillCredential {
  id: string;
  domain: string;
  username: string;
  password: string; // Always encrypted hex string
  salt?: string; // 🔑 CRITICAL: Salt for key derivation during decryption
  iv?: string; // Initialization vector for decryption
  tag?: string; // Authentication tag for decryption
  packageName?: string;
  lastUsed?: number;
  encrypted: boolean; // Always true - passwords are always sent encrypted
}

/**
 * Autofill settings
 */
export interface AutofillSettings {
  enabled: boolean;
  requireBiometric: boolean;
  allowSubdomains: boolean;
  trustedDomains: string[];
}

/**
 * Autofill statistics
 */
export interface AutofillStatistics {
  totalFills: number;
  totalSaves: number;
  blockedPhishing: number;
  lastUsed: string;
}

class AutofillService {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private decryptRequestListener: any = null; // Listener for decrypt requests from native

  constructor() {
    if (Platform.OS === 'android') {
      // Initialize event emitter for autofill events
      // Pass null since AutofillBridge doesn't implement addListener/removeListeners
      this.eventEmitter = new NativeEventEmitter(null);
      this.setupDecryptRequestListener();
    }
  }

  /**
   * Set up listener for decryption requests from native code
   * When AutofillTestActivity needs to decrypt a password, it emits an event
   * This listener handles that event and performs the actual decryption
   */
  private setupDecryptRequestListener() {
    if (!this.eventEmitter || Platform.OS !== 'android') {
      return;
    }

    try {
      // Listen for decryption requests from native autofill code
      this.decryptRequestListener = this.eventEmitter.addListener(
        'onAutofillDecryptRequest',
        async eventData => {
          try {
            console.log(
              '🔔 [AutofillService] Received decryption request from native:',
              {
                credentialId: eventData.credentialId,
                hasEncryptedPassword: !!eventData.encryptedPassword,
                hasSalt: !!eventData.salt,
                hasIv: !!eventData.iv,
                hasTag: !!eventData.tag,
                domain: eventData.domain,
              },
            );

            // Get master password from session (user must have unlocked it)
            const masterPassword = await this.getMasterPasswordFromSession();

            if (!masterPassword) {
              console.error(
                '❌ [AutofillService] Master password not available in session',
              );
              // Record failed autofill event
              await autofillStatisticsService.recordFill(
                eventData.domain || 'unknown',
                false,
                'Master password not available',
              );
              await this.sendDecryptResultToNative(
                eventData.credentialId,
                '',
                false,
                'Master password not available - user must unlock the app first',
              );
              return;
            }

            // Extract encrypted password data from native side event
            const {
              credentialId,
              encryptedPassword,
              salt,
              iv,
              tag,
            } = eventData;

            console.log(
              '🔍 [DEBUG] Extracted values:',
              {
                credentialId,
                hasEncryptedPassword: !!encryptedPassword,
                hasSalt: !!salt,
                hasIv: !!iv,
                hasTag: !!tag,
              },
            );

            if (
              !credentialId ||
              !encryptedPassword ||
              !salt ||
              !iv ||
              !tag
            ) {
              console.error(
                '❌ [AutofillService] Missing encryption components:',
                {
                  credentialId: !!credentialId,
                  encryptedPassword: !!encryptedPassword,
                  salt: !!salt,
                  iv: !!iv,
                  tag: !!tag,
                },
              );
              await autofillStatisticsService.recordFill(
                eventData.domain || 'unknown',
                false,
                'Missing encryption components',
              );
              await this.sendDecryptResultToNative(
                credentialId || '',
                '',
                false,
                'Missing encryption components',
              );
              return;
            }

            // Derive the encryption key using master password + salt
            const encryptionKey = deriveKeyFromPassword(
              masterPassword,
              salt,
              CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
            );

            // Decrypt the password
            console.log('🔓 [AutofillService] Decrypting autofill password...');
            const plainTextPassword = decryptData(
              encryptedPassword,
              encryptionKey,
              iv,
              tag,
            );

            if (!plainTextPassword) {
              console.error(
                '❌ [AutofillService] Decryption resulted in empty password',
              );
              await autofillStatisticsService.recordFill(
                eventData.domain || 'unknown',
                false,
                'Decryption resulted in empty password',
              );
              await this.sendDecryptResultToNative(
                credentialId,
                '',
                false,
                'Decryption resulted in empty password',
              );
              return;
            }

            console.log(
              '✅ [AutofillService] Decryption successful - caching plaintext password',
            );

            // Record successful autofill event
            await autofillStatisticsService.recordFill(
              eventData.domain || 'unknown',
              true,
            );

            // Cache plaintext password and send result to native code
            await this.sendDecryptResultToNative(credentialId, plainTextPassword, true, '');
          } catch (error) {
            console.error(
              '❌ [AutofillService] Error processing decrypt request:',
              error,
            );
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            await autofillStatisticsService.recordFill(
              eventData.domain || 'unknown',
              false,
              errorMessage,
            );
            await this.sendDecryptResultToNative(
              eventData.credentialId || '',
              '',
              false,
              errorMessage,
            );
          }
        },
      );

      console.log('✅ [AutofillService] Decryption request listener set up');
    } catch (error) {
      console.error(
        '❌ [AutofillService] Failed to set up decrypt request listener:',
        error,
      );
    }
  }

  /**
   * Get master password from current session
   * The master password should be cached in session after user authentication
   * @returns Master password if available in session
   */
  private async getMasterPasswordFromSession(): Promise<string | null> {
    try {
      // Import sessionCache to retrieve the cached master password
      const { sessionCache } = await import('../utils/sessionCache');

      // The master password is typically cached during login
      // Check common cache keys where it might be stored
      const masterPassword =
        sessionCache.get<string>('masterPassword') ||
        sessionCache.get<string>('master_password') ||
        sessionCache.get<string>('encryptionKey');

      if (masterPassword) {
        console.log(
          '🔑 [AutofillService] Retrieved master password from session cache',
        );
        return masterPassword;
      }

      console.warn('⚠️ [AutofillService] Master password not in session cache');
      console.warn(
        '⚠️ [AutofillService] User must have the app open and unlocked to decrypt autofill passwords',
      );
      return null;
    } catch (error) {
      console.error(
        '❌ [AutofillService] Error getting master password from session:',
        error,
      );
      return null;
    }
  }

  /**
   * Send decryption result back to native code and cache plaintext password
   * @param credentialId The credential ID
   * @param plainTextPassword Decrypted password (empty if failed)
   * @param success Whether decryption was successful
   * @param errorMessage Error message if decryption failed
   */
  private async sendDecryptResultToNative(
    credentialId: string,
    plainTextPassword: string,
    success: boolean,
    errorMessage: string,
  ) {
    try {
      console.log(
        `📤 [AutofillService] Sending decrypt result to native: credentialId=${credentialId}, success=${success}`,
      );

      // If decryption was successful, cache plaintext password for autofill
      if (success && plainTextPassword && credentialId) {
        try {
          console.log(`💾 [AutofillService] Caching plaintext password for credential: ${credentialId}`);
          
          if (!AutofillBridge.storeDecryptedPasswordForAutofill) {
            console.warn(
              '⚠️ [AutofillService] storeDecryptedPasswordForAutofill not available in AutofillBridge',
            );
          } else {
            const cacheSuccess = await AutofillBridge.storeDecryptedPasswordForAutofill(
              credentialId,
              plainTextPassword,
            );
            
            if (cacheSuccess) {
              console.log(`✅ [AutofillService] Plaintext password cached successfully`);
            } else {
              console.warn(`⚠️ [AutofillService] Failed to cache plaintext password`);
            }
          }
        } catch (cacheError) {
          console.error(
            '❌ [AutofillService] Error caching plaintext password:',
            cacheError,
          );
        }
      }

      // Also notify activity via updateAutofillDecryptResult for backward compatibility
      if (!AutofillBridge.updateAutofillDecryptResult) {
        console.warn(
          '⚠️ [AutofillService] updateAutofillDecryptResult not available in AutofillBridge',
        );
        return;
      }

      await AutofillBridge.updateAutofillDecryptResult(
        plainTextPassword,
        success,
        errorMessage,
      );

      console.log(
        `✅ [AutofillService] Decryption result sent to native successfully`,
      );
    } catch (error) {
      console.error(
        '❌ [AutofillService] Failed to send decrypt result to native:',
        error,
      );
    }
  }

  /**
   * Cleanup - remove listeners when service is destroyed
   */
  cleanup() {
    if (this.decryptRequestListener) {
      this.decryptRequestListener.remove();
      this.decryptRequestListener = null;
    }
  }

  /**
   * Checks if autofill is supported on this device
   * Autofill requires Android 8.0 (API 26) or higher
   */
  async isSupported(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      // Android 8.0 (API 26) and higher support autofill
      return Platform.Version >= 26;
    } catch (error) {
      console.error('Error checking autofill support:', error);
      return false;
    }
  }

  /**
   * Checks if autofill service is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      return await AutofillBridge.isAutofillEnabled();
    } catch (error) {
      console.error('Error checking autofill status:', error);
      return false;
    }
  }

  /**
   * Requests to enable autofill service
   * Opens system settings for user to enable
   */
  async requestEnable(): Promise<boolean> {
    try {
      console.log('📞 [AutofillService] requestEnable() called');

      if (Platform.OS !== 'android') {
        const errorMsg = 'Autofill is only supported on Android';
        console.error('❌ [AutofillService]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '🔗 [AutofillService] Checking if AutofillBridge is available...',
      );
      if (!AutofillBridge) {
        const errorMsg = 'AutofillBridge native module is not available';
        console.error('❌ [AutofillService]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '📞 [AutofillService] Calling AutofillBridge.requestEnableAutofill()...',
      );
      const result = await AutofillBridge.requestEnableAutofill();
      console.log(
        '✅ [AutofillService] requestEnableAutofill returned:',
        result,
      );
      
      if (result) {
        console.log('🔑 [CRITICAL] Autofill enable succeeded - initializing default settings...');
        await this.ensureDefaultSettingsAreSaved();
      }
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        '❌ [AutofillService] Error requesting autofill enable:',
        errorMsg,
      );
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : 'N/A',
      );
      return false;
    }
  }

  /**
   * 🔑 CRITICAL: Ensure default settings are saved to native side
   * This is called when autofill is first enabled to guarantee that
   * the requireBiometric setting is persisted to SharedPreferences
   */
  private async ensureDefaultSettingsAreSaved(): Promise<void> {
    try {
      console.log('🔑 Ensuring autofill settings are initialized with defaults...');
      const currentSettings = await this.getSettings();
      
      // If settings don't exist or are incomplete, save defaults
      if (!currentSettings || !currentSettings.requireBiometric === undefined) {
        const defaultSettings: AutofillSettings = {
          enabled: true,
          requireBiometric: true,
          allowSubdomains: true,
          trustedDomains: [],
        };
        
        console.log('💾 Saving default settings to ensure biometric is REQUIRED:', defaultSettings);
        await this.updateSettings(defaultSettings);
        console.log('✅ Default settings saved - biometric WILL be required');
      } else {
        console.log('✅ Settings already exist - no action needed', currentSettings);
      }
    } catch (error) {
      console.error('⚠️ Error ensuring default settings:', error);
      // Don't throw - continue anyway
    }
  }

  /**
   * Requests to disable autofill service
   * Opens system settings for user to disable
   * Returns OEM-specific instructions along with success status
   */
  async requestDisable(): Promise<
    boolean | { success: boolean; instructions: string; error?: string }
  > {
    try {
      console.log('📞 [AutofillService] requestDisable() called');

      if (Platform.OS !== 'android') {
        const errorMsg = 'Autofill is only supported on Android';
        console.error('❌ [AutofillService]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '🔗 [AutofillService] Checking if AutofillBridge is available...',
      );
      if (!AutofillBridge) {
        const errorMsg = 'AutofillBridge native module is not available';
        console.error('❌ [AutofillService]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '📞 [AutofillService] Calling AutofillBridge.disableAutofill()...',
      );
      const result = await AutofillBridge.disableAutofill();
      console.log('✅ [AutofillService] disableAutofill returned:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        '❌ [AutofillService] Error requesting autofill disable:',
        errorMsg,
      );
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : 'N/A',
      );
      return false;
    }
  }

  /**
   * Open autofill settings now (after user confirms from alert dialog)
   * This is called from the Alert button press to ensure alert is visible first
   */
  async openAutofillSettingsNow(): Promise<boolean> {
    try {
      console.log(
        '📱 [AutofillService] openAutofillSettingsNow() called - Opening settings intent',
      );

      if (Platform.OS !== 'android') {
        console.warn(
          '⚠️ [AutofillService] Autofill is only supported on Android',
        );
        return false;
      }

      console.log(
        '🔗 [AutofillService] Checking if AutofillBridge is available...',
      );
      if (!AutofillBridge) {
        const errorMsg = 'AutofillBridge native module is not available';
        console.error('❌ [AutofillService]', errorMsg);
        return false;
      }

      console.log(
        '📞 [AutofillService] Calling AutofillBridge.openAutofillSettingsNow()...',
      );
      const result = await AutofillBridge.openAutofillSettingsNow();
      console.log(
        '✅ [AutofillService] openAutofillSettingsNow returned:',
        result,
      );
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        '❌ [AutofillService] Error opening autofill settings:',
        errorMsg,
      );
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : 'N/A',
      );
      return false;
    }
  }

  /**
   * Auto-prompt to enable autofill after Master Password setup
   * Directly opens autofill settings without showing additional dialogs
   * Called after user successfully sets up their master password
   */
  async autoPromptEnableAutofill(): Promise<boolean> {
    try {
      console.log(
        '📱 [AutofillService] autoPromptEnableAutofill() called - Opening settings for first-time setup',
      );

      if (Platform.OS !== 'android') {
        console.warn(
          '⚠️ [AutofillService] Autofill is only supported on Android',
        );
        return false;
      }

      // Check if already enabled - skip if so
      const isAlreadyEnabled = await this.isEnabled();
      if (isAlreadyEnabled) {
        console.log(
          '✅ [AutofillService] Autofill is already enabled - skipping prompt',
        );
        return true;
      }

      console.log(
        '🔗 [AutofillService] Autofill not enabled yet - requesting enable from Master Password setup',
      );

      if (!AutofillBridge) {
        console.error(
          '❌ [AutofillService] AutofillBridge native module is not available',
        );
        return false;
      }

      // Directly call requestEnable without dialog wrapper
      // The native settings dialog will handle user interaction
      console.log(
        '📞 [AutofillService] Calling AutofillBridge.requestEnableAutofill()...',
      );
      const result = await AutofillBridge.requestEnableAutofill();
      console.log(
        '✅ [AutofillService] requestEnableAutofill completed, result:',
        result,
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        '❌ [AutofillService] Error in autoPromptEnableAutofill:',
        errorMsg,
      );
      console.error(
        'Stack trace:',
        error instanceof Error ? error.stack : 'N/A',
      );
      return false;
    }
  }

  /**
   * Disables autofill service (legacy method - use requestDisable instead)
   */
  async disable(): Promise<void> {
    try {
      if (Platform.OS !== 'android') {
        return;
      }

      await AutofillBridge.disableAutofill();
    } catch (error) {
      console.error('Error disabling autofill:', error);
      throw error;
    }
  }

  /**
   * Prepares credentials for autofill
   * Encrypts and formats credentials for native autofill service
   *
   * @param passwords Array of password entries
   * @param masterKey Master encryption key
   */
  async prepareCredentialsForAutofill(
    passwords: PasswordEntry[],
    masterKey: string,
  ): Promise<void> {
    try {
      console.log(`🔄 [Autofill] prepareCredentialsForAutofill called`);
      console.log(`🔄 [Autofill] Password count: ${passwords.length}`);
      if (passwords.length > 0) {
        console.log(
          `🔄 [Autofill] Sample entries:`,
          passwords.slice(0, 2).map(p => ({
            title: p.title,
            isDecrypted: p.isDecrypted,
            hasPassword: !!p.password,
            passwordLength: p.password ? p.password.length : 0,
          })),
        );
      }

      console.log('🔑 [CRITICAL] Before preparing credentials, ensure default settings are saved to native...');
      await this.ensureDefaultSettingsAreSaved();

      // 🔑 CRITICAL FIX: Get autofill settings to determine if we should encrypt or send plaintext
      let requireBiometric = true; // Default: require biometric for security
      try {
        const settings = await this.getSettings();
        requireBiometric = settings.requireBiometric ?? true;
        console.log(
          `📋 [Autofill] Current settings: requireBiometric=${requireBiometric}`,
        );
      } catch (settingsError) {
        console.warn(
          `⚠️ [Autofill] Failed to get settings, defaulting to requireBiometric=true:`,
          settingsError,
        );
      }

      // Convert passwords to autofill credentials
      const credentials: AutofillCredential[] = [];

      for (const password of passwords) {
        const domain = this.extractDomain(password.website || '');

        // Skip credentials with no domain or username
        if (!domain || !password.username) {
          console.warn(
            `⚠️ Skipping credential - missing domain or username: ${password.title}`,
          );
          continue;
        }

        // 🔴 CRITICAL: Check for corrupted encrypted data before processing
        if (!password.isDecrypted && password.password) {
          // Check if all encryption metadata is present
          if (!password.passwordSalt || !password.passwordIv || !password.passwordTag) {
            console.warn(
              `⚠️ Skipping credential - missing encryption metadata for "${password.title}". Entry needs to be re-created.`,
            );
            continue;
          }
        }

        // 🔐 SECURITY: Always include complete encryption context
        // - If password is plaintext (isDecrypted=true), encrypt it now + capture SALT/IV/TAG
        // - If password is encrypted (isDecrypted=false), use stored SALT/IV/TAG from when it was encrypted
        let encryptedPassword = password.password;
        let encryptedSalt: string | undefined = password.passwordSalt;
        let encryptedIV: string | undefined = password.passwordIv;
        let encryptedTag: string | undefined = password.passwordTag;

        // ✅ Support both new format (with salt) and legacy format (without salt)
        const isLegacyEncrypted =
          !password.isDecrypted &&
          (!encryptedSalt || !encryptedIV || !encryptedTag);

        if (password.isDecrypted && password.password) {
          // Password is plaintext - encrypt it before sending to autofill
          try {
            // 🔑 CRITICAL: Generate salt and derive key for autofill encryption
            // This ensures each autofill credential has its own salt
            const salt = generateSecureRandom(CRYPTO_CONSTANTS.SALT_LENGTH);
            const iv = generateIV();
            const derivedKey = deriveKeyFromPassword(masterKey, salt);
            const encrypted = encryptData(password.password, derivedKey, iv);

            encryptedPassword = encrypted.ciphertext;
            encryptedSalt = salt;
            encryptedIV = encrypted.iv;
            encryptedTag = encrypted.tag;
            console.log(
              `🔐 Encrypting plaintext password for ${password.username} with generated salt`,
            );
          } catch (encryptError) {
            console.error(
              `❌ Failed to encrypt password for ${password.username}:`,
              encryptError,
            );
            continue; // Skip this credential if encryption fails
          }
        } else if (isLegacyEncrypted) {
          // ⚠️ LEGACY: Password encrypted with old format (no salt/IV/TAG stored)
          // The plaintext is likely still in memory, so we'll re-encrypt with new format
          console.warn(
            `⚠️ Migrating legacy encrypted password for ${password.username} (missing SALT/IV/TAG)`,
          );

          if (password.password) {
            // Re-encrypt legacy password with new format
            try {
              const salt = generateSecureRandom(CRYPTO_CONSTANTS.SALT_LENGTH);
              const iv = generateIV();
              const derivedKey = deriveKeyFromPassword(masterKey, salt);
              const encrypted = encryptData(password.password, derivedKey, iv);

              encryptedPassword = encrypted.ciphertext;
              encryptedSalt = salt;
              encryptedIV = encrypted.iv;
              encryptedTag = encrypted.tag;
              console.log(
                `✅ Successfully migrated legacy password for ${password.username} with new salt/IV/tag`,
              );
            } catch (migrationError) {
              console.error(
                `❌ Failed to migrate legacy password for ${password.username}:`,
                migrationError,
              );
              continue; // Skip if migration fails
            }
          } else {
            console.error(
              `❌ Skipping ${password.username}: encrypted but no plaintext available for migration`,
            );
            continue;
          }
        } else if (!encryptedSalt || !encryptedIV || !encryptedTag) {
          // 🔴 NEW FORMAT: Missing one or more required fields
          console.error(
            `❌ Skipping ${password.username}: missing required encryption components (salt/iv/tag)`,
          );
          continue;
        }

        // 🔑 CRITICAL FIX: If requireBiometric=false, send plaintext instead of encrypted
        // This prevents Android autofill from forcing biometric as a security fallback
        let finalPassword = encryptedPassword;
        let finalSalt = encryptedSalt;
        let finalIV = encryptedIV;
        let finalTag = encryptedTag;
        let isEncrypted = true;

        if (!requireBiometric && password.password && password.isDecrypted) {
          // User disabled biometric requirement - send plaintext to allow auto-fill without auth
          console.log(
            `📤 [FIX] requireBiometric=false for ${password.username} - sending as PLAINTEXT to avoid forced auth`,
          );
          finalPassword = password.password;
          finalSalt = undefined;
          finalIV = undefined;
          finalTag = undefined;
          isEncrypted = false;
        }

        const credential: AutofillCredential = {
          id: password.id,
          domain,
          username: password.username,
          password: finalPassword, // Encrypted OR plaintext depending on requireBiometric
          salt: finalSalt, // 🔑 CRITICAL: Only set if encrypted
          iv: finalIV, // Only set if encrypted
          tag: finalTag, // Only set if encrypted
          lastUsed: password.lastUsed
            ? new Date(password.lastUsed).getTime()
            : undefined,
          encrypted: isEncrypted, // true if encrypted, false if plaintext
        };

        console.log(
          `🔐 Credential for ${password.username} prepared as ${
            isEncrypted ? 'ENCRYPTED' : 'PLAINTEXT'
          } (${
            password.isDecrypted
              ? 'was plaintext, now ' +
                (isEncrypted ? 'encrypted' : 'kept as plaintext')
              : 'already encrypted'
          }) with IV=${!!finalIV} TAG=${!!finalTag}`,
        );

        credentials.push(credential);
      }

      console.log(
        `🔄 Prepared ${credentials.length} credentials for autofill:`,
        credentials.map(c => ({ domain: c.domain, username: c.username })),
      );

      // Encrypt credentials for autofill cache
      const encrypted = encryptData(JSON.stringify(credentials), masterKey);

      // Store in secure storage for autofill service access
      // Store as JSON with ciphertext, iv, and tag
      await secureStorageService.setItem(
        'autofill_credentials',
        JSON.stringify(encrypted),
      );

      // Also send to native autofill bridge to store in SharedPreferences
      // This allows Android autofill service to access credentials
      if (Platform.OS === 'android') {
        try {
          // STEP A: Sync autofill settings to native bridge first
          // This ensures biometric requirements are correctly set before credentials are accessed
          console.log(
            '📱 [STEP A] Syncing autofill settings to native bridge...',
          );
          try {
            const currentSettings = await this.getSettings();
            const settingsSyncResult = await AutofillBridge.updateSettings(
              JSON.stringify(currentSettings),
            );
            console.log(
              `✅ [STEP A] Settings synced to native bridge: ${settingsSyncResult}`,
            );
          } catch (settingsSyncError) {
            console.warn(
              '⚠️ [STEP A] Failed to sync settings to native bridge:',
              settingsSyncError,
            );
            // Continue anyway - credentials are more important
          }

          // STEP B: Verify credentials have all required fields before sending
          console.log(
            '📊 [STEP B] Verifying credentials have encryption metadata:',
          );
          credentials.forEach((cred, idx) => {
            console.log(
              `   [${idx}] ${cred.username}: salt=${!!cred.salt} (${
                cred.salt?.length || 0
              } chars), iv=${!!cred.iv} (${
                cred.iv?.length || 0
              } chars), tag=${!!cred.tag} (${cred.tag?.length || 0} chars)`,
            );
          });

          console.log(
            '📱 [STEP C] Sending credentials to native autofill bridge...',
            JSON.stringify(credentials, null, 2),
          );
          const result = await AutofillBridge.prepareCredentials(
            JSON.stringify(credentials),
          );
          console.log(
            `✅ [STEP D] Native bridge stored credentials: ${result}`,
          );

          // 🔑 CRITICAL: Cache plaintext passwords for decryption after autofill
          // When user taps login after autofill, they may need to decrypt
          // So cache plaintext now for quick access
          console.log(
            '📦 [STEP E] Caching plaintext passwords for decryption...',
          );
          for (const password of passwords) {
            if (password.password && password.id) {
              try {
                // CRITICAL: Only cache passwords that are already in plaintext (isDecrypted = true).
                // Avoid attempting decryption here, as the master key may not be available during app startup.
                // On-demand decryption is handled later when an autofill request is actually made.
                if (password.isDecrypted) {
                  const plaintextToCache = password.password;
                  if (plaintextToCache) {
                    console.log(
                      `✅ [Cache] Password for ${password.id} is already plaintext, caching it.`,
                    );
                    await AutofillBridge.storeDecryptedPasswordForAutofill(
                      password.id,
                      plaintextToCache,
                    );
                    console.log(`✅ Cached plaintext for: ${password.id}`);
                  }
                } else {
                  // If password is not decrypted, we skip caching it.
                  console.log(
                    `ℹ️ [Cache] Password for ${password.id} is encrypted. Skipping plaintext cache for now.`,
                  );
                }
              } catch (cacheError) {
                console.warn(
                  `⚠️ Failed to cache plaintext for ${password.id}:`,
                  cacheError,
                );
              }
            }
          }
        } catch (bridgeError) {
          console.warn(
            '⚠️ Failed to send credentials to autofill bridge:',
            bridgeError,
          );
          // Don't throw - app should still work even if bridge call fails
        }
      }
    } catch (error) {
      console.error('❌ Error preparing credentials for autofill:', error);
      throw error;
    }
  }

  /**
   * Gets credentials for a specific domain
   *
   * @param domain The domain to get credentials for
   * @param masterKey Master encryption key
   */
  async getCredentialsForDomain(
    domain: string,
    masterKey: string,
  ): Promise<AutofillCredential[]> {
    try {
      // Get encrypted credentials from secure storage
      const encryptedData = await secureStorageService.getItem(
        'autofill_credentials',
      );

      if (!encryptedData) {
        return [];
      }

      // Decrypt credentials - parse the encrypted object
      const encrypted = JSON.parse(encryptedData) as {
        ciphertext: string;
        iv: string;
        tag: string;
      };
      const decryptedData = decryptData(
        encrypted.ciphertext,
        masterKey,
        encrypted.iv,
        encrypted.tag,
      );

      const allCredentials: AutofillCredential[] = JSON.parse(decryptedData);

      // Filter credentials matching the domain
      const matchingCredentials = allCredentials.filter(cred =>
        this.domainsMatch(cred.domain, domain),
      );

      console.log(
        `Found ${matchingCredentials.length} credentials for domain: ${domain}`,
      );

      return matchingCredentials;
    } catch (error) {
      console.error('Error getting credentials for domain:', error);
      return [];
    }
  }

  /**
   * Saves a new credential from autofill save request
   *
   * @param domain The domain
   * @param username The username
   * @param password The password
   * @param masterKey Master encryption key
   */
  async saveCredential(
    domain: string,
    username: string,
    password: string,
    masterKey: string,
  ): Promise<boolean> {
    try {
      // This should integrate with the main password storage
      // For now, just add to autofill cache

      // 🔐 Encrypt password before storing with generated salt
      const salt = generateSecureRandom(CRYPTO_CONSTANTS.SALT_LENGTH);
      const iv = generateIV();
      const derivedKey = deriveKeyFromPassword(masterKey, salt);
      const encrypted = encryptData(password, derivedKey, iv);

      const credential: AutofillCredential = {
        id: Date.now().toString(),
        domain,
        username,
        password: encrypted.ciphertext, // Always encrypted
        salt: salt, // 🔑 CRITICAL: Include salt for key derivation during decryption
        iv: encrypted.iv, // Include IV for decryption
        tag: encrypted.tag, // Include tag for decryption
        lastUsed: Date.now(),
        encrypted: true, // Always true
      };

      // Get existing credentials
      const encryptedData = await secureStorageService.getItem(
        'autofill_credentials',
      );

      let credentials: AutofillCredential[] = [];
      if (encryptedData) {
        const encryptedCredentialsObject = JSON.parse(encryptedData) as {
          ciphertext: string;
          iv: string;
          tag: string;
        };
        const decryptedData = decryptData(
          encryptedCredentialsObject.ciphertext,
          masterKey,
          encryptedCredentialsObject.iv,
          encryptedCredentialsObject.tag,
        );
        credentials = JSON.parse(decryptedData);
      }

      // Add new credential
      credentials.push(credential);

      // Encrypt and save
      const encryptedCredentialsData = encryptData(
        JSON.stringify(credentials),
        masterKey,
      );

      await secureStorageService.setItem(
        'autofill_credentials',
        JSON.stringify(encryptedCredentialsData),
      );

      console.log(`Saved credential for domain: ${domain}`);
      return true;
    } catch (error) {
      console.error('Error saving credential:', error);
      return false;
    }
  }

  /**
   * Clears autofill cache
   */
  async clearCache(): Promise<void> {
    try {
      await secureStorageService.removeItem('autofill_credentials');
      await AutofillBridge.clearCache();
      console.log('Autofill cache cleared');
    } catch (error) {
      console.error('Error clearing autofill cache:', error);
      throw error;
    }
  }

  /**
   * Gets autofill settings
   */
  async getSettings(): Promise<AutofillSettings> {
    try {
      const settingsJson = await secureStorageService.getItem(
        'autofill_settings',
      );

      if (!settingsJson) {
        return this.getDefaultSettings();
      }

      return JSON.parse(settingsJson);
    } catch (error) {
      console.error('Error getting autofill settings:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Updates autofill settings
   */
  async updateSettings(settings: Partial<AutofillSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };

      await secureStorageService.setItem(
        'autofill_settings',
        JSON.stringify(newSettings),
      );

      console.log('Autofill settings updated:', newSettings);

      // 🔑 CRITICAL: Sync settings to native Android autofill service
      // This ensures the biometric requirement is properly propagated to the Android side
      if (Platform.OS === 'android') {
        try {
          console.log(
            '📱 Syncing autofill settings to native bridge:',
            newSettings,
          );
          const syncResult = await AutofillBridge.updateSettings(
            JSON.stringify(newSettings),
          );
          console.log(`✅ Native autofill settings synced: ${syncResult}`);
        } catch (bridgeError) {
          console.warn(
            '⚠️ Failed to sync settings to autofill bridge:',
            bridgeError,
          );
          // Don't throw - app should still work even if bridge call fails
        }
      }
    } catch (error) {
      console.error('Error updating autofill settings:', error);
      throw error;
    }
  }

  /**
   * Gets default autofill settings
   */
  private getDefaultSettings(): AutofillSettings {
    return {
      enabled: false,
      requireBiometric: true,
      allowSubdomains: true,
      trustedDomains: [],
    };
  }

  /**
   * Gets autofill statistics
   */
  async getStatistics(): Promise<AutofillStatistics> {
    try {
      const statsJson = await secureStorageService.getItem(
        'autofill_statistics',
      );

      if (!statsJson) {
        return this.getDefaultStatistics();
      }

      return JSON.parse(statsJson);
    } catch (error) {
      console.error('Error getting autofill statistics:', error);
      return this.getDefaultStatistics();
    }
  }

  /**
   * Updates autofill statistics
   */
  async updateStatistics(stats: Partial<AutofillStatistics>): Promise<void> {
    try {
      const currentStats = await this.getStatistics();
      const newStats = { ...currentStats, ...stats };

      await secureStorageService.setItem(
        'autofill_statistics',
        JSON.stringify(newStats),
      );

      console.log('Autofill statistics updated:', newStats);
    } catch (error) {
      console.error('Error updating autofill statistics:', error);
    }
  }

  /**
   * Gets default autofill statistics
   */
  private getDefaultStatistics(): AutofillStatistics {
    return {
      totalFills: 0,
      totalSaves: 0,
      blockedPhishing: 0,
      lastUsed: '',
    };
  }

  /**
   * Extracts domain from URL
   */
  private extractDomain(url: string): string {
    try {
      let domain = url.toLowerCase().trim();

      // Remove protocol
      domain = domain.replace(/^https?:\/\//, '');
      domain = domain.replace(/^www\./, '');

      // Remove path
      domain = domain.split('/')[0];
      domain = domain.split('?')[0];
      domain = domain.split('#')[0];

      // Remove port
      domain = domain.split(':')[0];

      return domain;
    } catch (error) {
      return url;
    }
  }

  /**
   * Checks if two domains match
   */
  private domainsMatch(domain1: string, domain2: string): boolean {
    const normalized1 = this.extractDomain(domain1);
    const normalized2 = this.extractDomain(domain2);

    if (normalized1 === normalized2) {
      return true;
    }

    // Check subdomain matching
    return (
      normalized1.endsWith(`.${normalized2}`) ||
      normalized2.endsWith(`.${normalized1}`)
    );
  }

  /**
   * Adds event listener
   */
  addEventListener(event: AutofillEventType, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Removes event listener
   */
  removeEventListener(event: AutofillEventType, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 🔐 CRITICAL FIX: Stores plaintext password for autofill after decryption
   *
   * THE ISSUE:
   * - Autofill service receives encrypted passwords from SharedPreferences
   * - Autofill service cannot decrypt (no master key, no React Native context)
   * - So encrypted password gets filled directly into form = BAD
   *
   * THE SOLUTION:
   * - After user authenticates (biometric/master password in app)
   * - App decrypts the password using React Native crypto service
   * - App stores plaintext password temporarily in autofill cache
   * - Autofill service uses plaintext password to fill forms
   * - Plaintext is cleared after autofill completes for security
   *
   * @param credentialId The ID of the credential
   * @param plaintextPassword The plaintext password (decrypted)
   * @param expirySeconds How long to keep plaintext in memory (default 60 seconds)
   */
  async storeDecryptedPasswordForAutofill(
    credentialId: string,
    plaintextPassword: string,
    expirySeconds: number = 60,
  ): Promise<void> {
    try {
      console.log(
        `🔓 [AutofillService] Storing plaintext password for autofill: ${credentialId}`,
      );

      // Store plaintext password with expiry time
      const expiryTime = Date.now() + expirySeconds * 1000;
      const decryptedPasswordsKey = 'autofill_decrypted_passwords';
      const existingData = await secureStorageService.getItem(
        decryptedPasswordsKey,
      );

      let decryptedPasswords: Record<string, any> = {};
      if (existingData) {
        try {
          decryptedPasswords = JSON.parse(existingData);
        } catch (e) {
          console.warn(
            '⚠️ Could not parse existing decrypted passwords, starting fresh',
          );
        }
      }

      // Store with expiry
      decryptedPasswords[credentialId] = {
        password: plaintextPassword,
        expiryTime: expiryTime,
        storedAt: Date.now(),
      };

      console.log(`✅ Plaintext password stored for ${expirySeconds}s expiry`);
      await secureStorageService.setItem(
        decryptedPasswordsKey,
        JSON.stringify(decryptedPasswords),
      );
    } catch (error) {
      console.error('❌ Error storing decrypted password for autofill:', error);
      throw error;
    }
  }

  /**
   * Retrieves plaintext password for autofill (if available and not expired)
   *
   * @param credentialId The ID of the credential
   * @returns The plaintext password or null if not found/expired
   */
  async getDecryptedPasswordForAutofill(
    credentialId: string,
  ): Promise<string | null> {
    try {
      const decryptedPasswordsKey = 'autofill_decrypted_passwords';
      const existingData = await secureStorageService.getItem(
        decryptedPasswordsKey,
      );

      if (!existingData) {
        return null;
      }

      const decryptedPasswords = JSON.parse(existingData);
      const entry = decryptedPasswords[credentialId];

      if (!entry) {
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiryTime) {
        console.warn(`⚠️ Plaintext password for ${credentialId} has expired`);
        delete decryptedPasswords[credentialId];
        await secureStorageService.setItem(
          decryptedPasswordsKey,
          JSON.stringify(decryptedPasswords),
        );
        return null;
      }

      return entry.password;
    } catch (error) {
      console.error(
        '❌ Error retrieving decrypted password for autofill:',
        error,
      );
      return null;
    }
  }

  /**
   * Clears plaintext password for autofill (cleanup after use)
   *
   * @param credentialId The ID of the credential
   */
  async clearDecryptedPasswordForAutofill(credentialId: string): Promise<void> {
    try {
      const decryptedPasswordsKey = 'autofill_decrypted_passwords';
      const existingData = await secureStorageService.getItem(
        decryptedPasswordsKey,
      );

      if (!existingData) {
        return;
      }

      const decryptedPasswords = JSON.parse(existingData);
      delete decryptedPasswords[credentialId];

      await secureStorageService.setItem(
        decryptedPasswordsKey,
        JSON.stringify(decryptedPasswords),
      );

      console.log(`✅ Cleared plaintext password for ${credentialId}`);
    } catch (error) {
      console.error(
        '❌ Error clearing decrypted password for autofill:',
        error,
      );
    }
  }

  /**
   * Decrypts autofill password
   * Called from native AutofillTestActivity when user clicks Login
   *
   * This is the React Native side of the decryption flow:
   * 1. Android has encrypted password + salt + iv + tag
   * 2. Android calls this React Native method with these components
   * 3. React Native derives key from master password + salt
   * 4. React Native decrypts using AES-GCM
   * 5. Returns plaintext to Android
   *
   * @param encryptedPassword The encrypted password ciphertext (hex)
   * @param salt The salt used for key derivation (hex)
   * @param iv The initialization vector (hex)
   * @param tag The authentication tag (hex)
   * @param masterPassword The master password (plaintext)
   * @returns The decrypted plaintext password
   */
  async decryptAutofillPassword(
    encryptedPassword: string,
    salt: string,
    iv: string,
    tag: string,
    masterPassword: string,
  ): Promise<string> {
    try {
      console.log('🔓 [AutofillService] Decrypting autofill password...');
      console.log('📋 Components:', {
        ciphertextLen: encryptedPassword?.length,
        saltLen: salt?.length,
        ivLen: iv?.length,
        tagLen: tag?.length,
        masterPasswordLen: masterPassword?.length,
      });

      // Validate all components are present
      if (!encryptedPassword || !salt || !iv || !tag || !masterPassword) {
        throw new Error('Missing encryption components');
      }

      console.log('✅ [AutofillService] All encryption components present');

      // Derive key from master password + salt (this is the same process used during encryption)
      const derivedKey = deriveKeyFromPassword(masterPassword, salt);
      console.log('🔑 Key derived from master password + salt');

      // Decrypt using cryptoService with derived key
      const decryptedPassword = decryptData(
        encryptedPassword,
        derivedKey,
        iv,
        tag,
      );

      console.log('✅ [AutofillService] Password successfully decrypted');
      return decryptedPassword;
    } catch (error) {
      console.error(
        '❌ [AutofillService] Error decrypting autofill password:',
        error,
      );
      throw new Error(
        `Failed to decrypt autofill password: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Decrypts autofill password by ID
   * Simpler variant called from Android with just the password ID
   * React Native looks up the full entry with encryption components from database
   *
   * @param passwordId The password entry ID
   * @param masterPassword The master password
   * @returns The decrypted plaintext password
   */
  async decryptAutofillPasswordById(
    passwordId: string,
    masterPassword: string,
  ): Promise<string> {
    try {
      console.log(
        `🔓 [AutofillService] Decrypting autofill password by ID: ${passwordId}`,
      );

      if (!passwordId || !masterPassword) {
        throw new Error('Missing password ID or master password');
      }

      // Import encryptedDatabase to fetch the entry with all components
      const { encryptedDatabase } = await import('./encryptedDatabaseService');

      // Get all optimized entries from storage (need to access private method via workaround)
      const entries = await (
        encryptedDatabase as any
      ).getAllOptimizedEntries?.();
      if (!entries) {
        throw new Error('Failed to load password entries from database');
      }

      // Find the entry
      const entry = entries.find((e: any) => e.id === passwordId);
      if (!entry) {
        throw new Error(`Password entry ${passwordId} not found`);
      }

      console.log('✅ Password entry found, extracting encryption components');

      // Extract components
      const encryptedPassword = entry.encryptedPassword;
      const salt = entry.passwordSalt;
      const iv = entry.passwordIv;
      const tag = entry.passwordAuthTag;

      if (!encryptedPassword || !salt || !iv || !tag) {
        throw new Error('Incomplete encryption components in entry');
      }

      // Decrypt using the component-based method
      return await this.decryptAutofillPassword(
        encryptedPassword,
        salt,
        iv,
        tag,
        masterPassword,
      );
    } catch (error) {
      console.error(
        '❌ [AutofillService] Error decrypting autofill password by ID:',
        error,
      );
      throw new Error(
        `Failed to decrypt password: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Emits event to listeners
   */
  private emitEvent(event: AutofillEventType, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

export const autofillService = new AutofillService();
