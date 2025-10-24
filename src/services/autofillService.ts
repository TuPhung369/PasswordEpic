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
import { encryptData, decryptData } from './cryptoService';
import { secureStorageService } from './secureStorageService';
import type { PasswordEntry } from '../types/password';

// Native module interface - matches Kotlin AutofillBridge @ReactMethod methods
interface AutofillBridgeModule {
  isAutofillSupported(): Promise<boolean>;
  isAutofillEnabled(): Promise<boolean>;
  requestEnableAutofill(): Promise<boolean>;
  disableAutofill(): Promise<boolean>;
  getCredentialsForDomain(domain: string): Promise<Array<any>>;
  prepareCredentials(credentialsJson: string): Promise<boolean>;
  clearCache(): Promise<boolean>;
  updateSettings(settingsJson: string): Promise<boolean>;
  getSettings(): Promise<Record<string, any>>;
  getStatistics(): Promise<AutofillStatistics>;
  recordUsage(type: string): Promise<boolean>;
}

// Mock native module for development (fallback if AutofillBridge not available)
const AutofillBridge: AutofillBridgeModule = NativeModules.AutofillBridge || {
  isAutofillSupported: async () => false,
  isAutofillEnabled: async () => false,
  requestEnableAutofill: async () => true,
  disableAutofill: async () => true,
  getCredentialsForDomain: async () => [],
  prepareCredentials: async () => true,
  clearCache: async () => true,
  updateSettings: async () => true,
  getSettings: async () => ({}),
  getStatistics: async () => ({
    totalFills: 0,
    totalSaves: 0,
    blockedPhishing: 0,
    lastUsed: '',
  }),
  recordUsage: async () => true,
};

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
  password: string;
  packageName?: string;
  lastUsed?: number;
}

/**
 * Autofill settings
 */
export interface AutofillSettings {
  enabled: boolean;
  requireBiometric: boolean;
  allowSubdomains: boolean;
  autoSubmit: boolean;
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

  constructor() {
    if (Platform.OS === 'android') {
      // Initialize event emitter for autofill events
      // this.eventEmitter = new NativeEventEmitter(AutofillBridge);
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
      if (Platform.OS !== 'android') {
        throw new Error('Autofill is only supported on Android');
      }

      return await AutofillBridge.requestEnableAutofill();
    } catch (error) {
      console.error('Error requesting autofill enable:', error);
      return false;
    }
  }

  /**
   * Disables autofill service
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
      // Convert passwords to autofill credentials
      const credentials: AutofillCredential[] = passwords
        .map(password => {
          const domain = this.extractDomain(password.website || '');

          // Skip credentials with no domain or username
          if (!domain || !password.username) {
            console.warn(
              `⚠️ Skipping credential - missing domain or username: ${password.title}`,
            );
            return null;
          }

          return {
            id: password.id,
            domain,
            username: password.username,
            password: password.password,
            lastUsed: password.lastUsed
              ? new Date(password.lastUsed).getTime()
              : undefined,
          };
        })
        .filter((cred): cred is AutofillCredential => cred !== null);

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
          console.log(
            '📱 Sending credentials to native autofill bridge...',
            JSON.stringify(credentials, null, 2),
          );
          const result = await AutofillBridge.prepareCredentials(
            JSON.stringify(credentials),
          );
          console.log(`✅ Native bridge stored credentials: ${result}`);
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

      const credential: AutofillCredential = {
        id: Date.now().toString(),
        domain,
        username,
        password,
        lastUsed: Date.now(),
      };

      // Get existing credentials
      const encryptedData = await secureStorageService.getItem(
        'autofill_credentials',
      );

      let credentials: AutofillCredential[] = [];
      if (encryptedData) {
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
        credentials = JSON.parse(decryptedData);
      }

      // Add new credential
      credentials.push(credential);

      // Encrypt and save
      const encrypted = encryptData(JSON.stringify(credentials), masterKey);

      await secureStorageService.setItem(
        'autofill_credentials',
        JSON.stringify(encrypted),
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
      autoSubmit: false,
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
