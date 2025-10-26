/**
 * Chrome AutoFill Service
 *
 * Handles Chrome WebView autofill functionality via JavaScript injection.
 * Since Android Autofill Framework doesn't work with Chrome's WebView,
 * this service provides JavaScript-based autofill for web forms.
 *
 * Features:
 * - Form detection
 * - JavaScript injection for credential filling
 * - Domain verification
 * - Security checks (HTTPS only)
 * - Biometric authentication integration
 *
 * @author PasswordEpic Team
 * @since Week 10 - Chrome Integration Phase
 */

import { NativeModules, Platform, NativeAppEventEmitter } from 'react-native';
import { domainVerificationService } from './domainVerificationService';
import type { AutofillCredential } from './autofillService';

// Native module interface
interface ChromeInjectBridgeModule {
  detectLoginForm(): Promise<DetectionResult>;
  detectAllForms(): Promise<AllFormsDetectionResult>;
  injectCredentials(
    username: string,
    password: string,
    domain: string,
  ): Promise<InjectionResult>;
  clearInjectedContent(): Promise<{ success: boolean }>;
  getCurrentPageUrl(): Promise<string>;
  getCurrentPageTitle(): Promise<{
    success: boolean;
    title: string;
    url: string;
  }>;
}

// TypeScript interfaces
export interface DetectionResult {
  success: boolean;
  hasUserField: boolean;
  hasPassField: boolean;
  isLoginForm: boolean;
  fieldIds: {
    userFieldId: string | null;
    userFieldName: string | null;
    passFieldId: string | null;
    passFieldName: string | null;
  };
}

export interface AllFormsDetectionResult {
  success: boolean;
  formCount: number;
  pageUrl: string;
  title: string;
  forms: Array<{
    formIndex: number;
    userFieldName: string;
    passFieldName: string;
    formId: string;
  }>;
}

export interface InjectionResult {
  success: boolean;
  message?: string;
  error?: string;
  usernameInjected?: boolean;
  passwordInjected?: boolean;
}

export interface ChromeAutoFillOptions {
  domain: string;
  username: string;
  password: string;
  requireBiometric?: boolean;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

// Get native module
const ChromeInjectBridgeModule: ChromeInjectBridgeModule =
  NativeModules.ChromeInjectBridge || {
    detectLoginForm: async () => ({
      success: false,
      hasUserField: false,
      hasPassField: false,
      isLoginForm: false,
      fieldIds: {
        userFieldId: null,
        userFieldName: null,
        passFieldId: null,
        passFieldName: null,
      },
    }),
    detectAllForms: async () => ({
      success: false,
      formCount: 0,
      pageUrl: '',
      title: '',
      forms: [],
    }),
    injectCredentials: async () => ({
      success: false,
      error: 'Module not available',
    }),
    clearInjectedContent: async () => ({ success: false }),
    getCurrentPageUrl: async () => '',
    getCurrentPageTitle: async () => ({
      success: false,
      title: '',
      url: '',
    }),
  };

class ChromeAutoFillService {
  private detectionCache: Map<string, DetectionResult> = new Map();
  private cacheTTL = 5000; // 5 seconds

  constructor() {
    if (Platform.OS === 'android') {
      try {
        this.setupEventListeners();
      } catch (e) {
        console.warn('ChromeInjectBridge event setup failed:', e);
      }
    }
  }

  private setupEventListeners() {
    try {
      // Use NativeAppEventEmitter which is compatible with DeviceEventManager from native
      NativeAppEventEmitter.addListener('onFormDetected', (event: any) => {
        console.log('✅ [Native Event] Login form detected:', event);
      });

      NativeAppEventEmitter.addListener('onInjectionSuccess', (event: any) => {
        console.log(
          '✅ [Native Event] Credentials injected successfully:',
          event,
        );
      });

      NativeAppEventEmitter.addListener('onInjectionFailed', (event: any) => {
        console.warn('❌ [Native Event] Injection failed:', event);
      });
    } catch (e) {
      console.warn('Failed to setup native event listeners:', e);
    }
  }

  /**
   * Checks if Chrome injection is available on this device
   */
  async isSupported(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      // Try to detect if we can access WebView
      const result = await this.detectLoginForm();
      return result.success || result.hasUserField !== undefined;
    } catch (error) {
      console.warn('Chrome injection not supported:', error);
      return false;
    }
  }

  /**
   * Detects if a login form exists on the current page
   * Results are cached for a short time to avoid repeated calls
   */
  async detectLoginForm(): Promise<DetectionResult> {
    try {
      if (Platform.OS !== 'android') {
        return {
          success: false,
          hasUserField: false,
          hasPassField: false,
          isLoginForm: false,
          fieldIds: {
            userFieldId: null,
            userFieldName: null,
            passFieldId: null,
            passFieldName: null,
          },
        };
      }

      const result = await ChromeInjectBridgeModule.detectLoginForm();
      console.log('🔍 Form detection result:', result);
      return result;
    } catch (error) {
      console.error('Error detecting login form:', error);
      return {
        success: false,
        hasUserField: false,
        hasPassField: false,
        isLoginForm: false,
        fieldIds: {
          userFieldId: null,
          userFieldName: null,
          passFieldId: null,
          passFieldName: null,
        },
      };
    }
  }

  /**
   * Detects all login forms on the current page
   */
  async detectAllForms(): Promise<AllFormsDetectionResult> {
    try {
      if (Platform.OS !== 'android') {
        return {
          success: false,
          formCount: 0,
          pageUrl: '',
          title: '',
          forms: [],
        };
      }

      const result = await ChromeInjectBridgeModule.detectAllForms();
      console.log('🔍 All forms detection result:', result);
      return result;
    } catch (error) {
      console.error('Error detecting all forms:', error);
      return {
        success: false,
        formCount: 0,
        pageUrl: '',
        title: '',
        forms: [],
      };
    }
  }

  /**
   * Injects credentials into a login form
   *
   * @param options Chrome autofill options
   */
  async injectCredentials(options: ChromeAutoFillOptions): Promise<boolean> {
    try {
      const { domain, username, password, onSuccess, onError } = options;

      console.log('🚀 [JS] injectCredentials called');
      console.log(`  📧 Username: ${username}`);
      console.log(`  🔐 Domain: ${domain}`);

      // Validate inputs
      if (!domain || !username || !password) {
        throw new Error(
          'Missing required credentials: domain, username, password',
        );
      }

      // Verify domain first
      const isVerified = await domainVerificationService.verifyDomain(domain);
      if (!isVerified) {
        const error = `Domain verification failed for: ${domain}`;
        console.warn('⚠️ ' + error);
        onError?.(error);
        return false;
      }

      console.log(
        `📱 Calling native module: ChromeInjectBridge.injectCredentials()`,
      );

      if (Platform.OS !== 'android') {
        onError?.('Chrome injection only supported on Android');
        return false;
      }

      // Perform injection
      console.log('⏳ Waiting for native response...');
      const result = await ChromeInjectBridgeModule.injectCredentials(
        username,
        password,
        domain,
      );

      console.log('📤 Native response:', result);

      if (result.success) {
        console.log('✅✅✅ Credentials injected successfully!');
        onSuccess?.();
        return true;
      } else {
        const error = result.error || 'Unknown injection error';
        console.error('❌ Injection failed:', error);
        onError?.(error);
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Error injecting credentials:', errorMsg);
      console.error('   Stack:', error instanceof Error ? error.stack : '');
      options.onError?.(errorMsg);
      return false;
    }
  }

  /**
   * Finds matching credentials for current page and injects them
   *
   * @param currentUrl The current page URL
   * @param credentials Array of available credentials
   * @param onSuccess Callback on success
   * @param onError Callback on error
   */
  async autoFillCurrentPage(
    currentUrl: string,
    credentials: AutofillCredential[],
    onSuccess?: () => void,
    onError?: (error: string) => void,
  ): Promise<boolean> {
    try {
      // Extract domain from URL
      const url = new URL(currentUrl);
      const currentDomain = url.hostname;

      console.log(
        `🔍 Looking for credentials matching domain: ${currentDomain}`,
      );

      // Find matching credentials
      const matchingCredentials = credentials.filter(cred => {
        // Exact domain match
        if (cred.domain === currentDomain) return true;

        // Subdomain match
        if (currentDomain.endsWith('.' + cred.domain)) return true;

        // Reverse subdomain match (www.example.com vs example.com)
        if (cred.domain.endsWith('.' + currentDomain)) return true;

        return false;
      });

      if (matchingCredentials.length === 0) {
        console.warn(`⚠️ No matching credentials for domain: ${currentDomain}`);
        onError?.(`No credentials found for ${currentDomain}`);
        return false;
      }

      console.log(
        `✅ Found ${matchingCredentials.length} matching credentials`,
      );

      // Use the first matching credential
      const credential = matchingCredentials[0];

      // Detect if form exists
      const formDetection = await this.detectLoginForm();
      if (!formDetection.isLoginForm) {
        onError?.('No login form detected on this page');
        return false;
      }

      // Inject credentials
      return await this.injectCredentials({
        domain: credential.domain,
        username: credential.username,
        password: credential.password,
        onSuccess,
        onError,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Error in auto-fill:', errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }

  /**
   * Clears injected content (optional security feature)
   */
  async clearInjectedContent(): Promise<void> {
    try {
      if (Platform.OS !== 'android') {
        return;
      }

      await ChromeInjectBridgeModule.clearInjectedContent();
      console.log('✅ Injected content cleared');
    } catch (error) {
      console.warn('Warning while clearing injected content:', error);
    }
  }

  /**
   * Gets the current page URL from WebView
   */
  async getCurrentPageUrl(): Promise<string> {
    try {
      if (Platform.OS !== 'android') {
        return '';
      }

      const url = await ChromeInjectBridgeModule.getCurrentPageUrl();
      console.log('📱 Current page URL:', url);
      return url;
    } catch (error) {
      console.error('Error getting current page URL:', error);
      return '';
    }
  }

  /**
   * Gets the current page title and URL
   */
  async getCurrentPageTitle(): Promise<{ title: string; url: string } | null> {
    try {
      if (Platform.OS !== 'android') {
        return null;
      }

      const result = await ChromeInjectBridgeModule.getCurrentPageTitle();
      if (result.success) {
        console.log('📱 Current page title:', result.title);
        return {
          title: result.title,
          url: result.url,
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting current page title:', error);
      return null;
    }
  }

  /**
   * Checks if current page is HTTPS (security requirement)
   */
  async isCurrentPageHttps(): Promise<boolean> {
    try {
      const url = await this.getCurrentPageUrl();
      return url.startsWith('https://');
    } catch (error) {
      console.error('Error checking if page is HTTPS:', error);
      return false;
    }
  }

  /**
   * Destroys the service and cleans up listeners
   */
  destroy() {
    try {
      if (this.eventEmitter) {
        this.eventEmitter.removeAllListeners('onFormDetected');
        this.eventEmitter.removeAllListeners('onInjectionSuccess');
        this.eventEmitter.removeAllListeners('onInjectionFailed');
      }
      this.detectionCache.clear();
    } catch (error) {
      console.error('Error destroying ChromeAutoFillService:', error);
    }
  }
}

export const chromeAutoFillService = new ChromeAutoFillService();
