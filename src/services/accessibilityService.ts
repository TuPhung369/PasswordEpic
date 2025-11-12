/**
 * Accessibility Service
 *
 * Manages accessibility service functionality for PasswordEpic.
 * Handles communication with native accessibility service manager.
 *
 * Features:
 * - Check if accessibility service is supported
 * - Check if PasswordEpic accessibility is enabled
 * - Request accessibility service enablement
 * - Disable accessibility service
 * - Get OEM-specific instructions
 */

import { NativeModules, Platform } from 'react-native';

interface AccessibilityBridgeModule {
  isAccessibilitySupported(): Promise<boolean>;
  isAccessibilityEnabled(): Promise<boolean>;
  requestEnableAccessibility(): Promise<boolean>;
  disableAccessibility(): Promise<
    | boolean
    | {
        success: boolean;
        instructions: string;
        error?: string;
        action?: string;
      }
  >;
  openAccessibilitySettingsNow(): Promise<boolean>;
}

const AccessibilityBridge: AccessibilityBridgeModule = (() => {
  if (NativeModules.AccessibilityBridge) {
    console.log('✅ [AccessibilityService] Using NATIVE AccessibilityBridge module');
    return NativeModules.AccessibilityBridge;
  } else {
    console.log(
      '📌 [AccessibilityService] Using MOCK implementation (expected in development)',
    );
    return {
      isAccessibilitySupported: async () => {
        console.log('📌 [Mock] isAccessibilitySupported called');
        return true;
      },
      isAccessibilityEnabled: async () => {
        console.log('📌 [Mock] isAccessibilityEnabled called');
        return false;
      },
      requestEnableAccessibility: async () => {
        console.log(
          '📌 [Mock] requestEnableAccessibility called - cannot open real settings in mock',
        );
        return true;
      },
      disableAccessibility: async () => {
        console.log('📌 [Mock] disableAccessibility called');
        return {
          success: true,
          instructions:
            'Mock: Please follow your device settings to disable accessibility.',
          action: 'openAccessibilitySettings',
        };
      },
      openAccessibilitySettingsNow: async () => {
        console.log(
          '📌 [Mock] openAccessibilitySettingsNow called - cannot open real settings in mock',
        );
        return true;
      },
    };
  }
})();

class AccessibilityService {
  /**
   * Check if accessibility is supported on this device
   */
  async isSupported(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      return await AccessibilityBridge.isAccessibilitySupported();
    } catch (error) {
      console.error('Error checking accessibility support:', error);
      return false;
    }
  }

  /**
   * Check if PasswordEpic accessibility service is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      return await AccessibilityBridge.isAccessibilityEnabled();
    } catch (error) {
      console.error('Error checking accessibility status:', error);
      return false;
    }
  }

  /**
   * Request to enable accessibility service
   * Opens system settings for user to enable
   */
  async requestEnable(): Promise<boolean> {
    try {
      console.log('📞 [AccessibilityService] requestEnable() called');

      if (Platform.OS !== 'android') {
        const errorMsg = 'Accessibility is only supported on Android';
        console.error('❌ [AccessibilityService]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '🔗 [AccessibilityService] Checking if AccessibilityBridge is available...',
      );
      if (!AccessibilityBridge) {
        const errorMsg = 'AccessibilityBridge native module is not available';
        console.error('❌ [AccessibilityService]', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(
        '📞 [AccessibilityService] Calling AccessibilityBridge.requestEnableAccessibility()...',
      );
      const result = await AccessibilityBridge.requestEnableAccessibility();
      console.log(
        '✅ [AccessibilityService] requestEnableAccessibility returned:',
        result,
      );

      return result;
    } catch (error) {
      console.error('Error requesting accessibility enable:', error);
      throw error;
    }
  }

  /**
   * Disable accessibility service
   * Opens system settings for user to disable the service
   * Returns OEM-specific instructions
   */
  async requestDisable(): Promise<
    | boolean
    | {
        success: boolean;
        instructions: string;
        error?: string;
        action?: string;
      }
  > {
    try {
      console.log('📞 [AccessibilityService] requestDisable() called');

      if (Platform.OS !== 'android') {
        return false;
      }

      if (!AccessibilityBridge) {
        throw new Error('AccessibilityBridge native module is not available');
      }

      console.log(
        '📞 [AccessibilityService] Calling AccessibilityBridge.disableAccessibility()...',
      );
      const result = await AccessibilityBridge.disableAccessibility();
      console.log(
        '✅ [AccessibilityService] disableAccessibility returned:',
        result,
      );

      return result;
    } catch (error) {
      console.error('Error requesting accessibility disable:', error);
      throw error;
    }
  }

  /**
   * Open accessibility settings now
   * Called after user confirms in alert dialog
   */
  async openAccessibilitySettingsNow(): Promise<boolean> {
    try {
      console.log('📞 [AccessibilityService] openAccessibilitySettingsNow() called');

      if (Platform.OS !== 'android') {
        return false;
      }

      if (!AccessibilityBridge) {
        throw new Error('AccessibilityBridge native module is not available');
      }

      console.log(
        '📞 [AccessibilityService] Calling AccessibilityBridge.openAccessibilitySettingsNow()...',
      );
      const result = await AccessibilityBridge.openAccessibilitySettingsNow();
      console.log(
        '✅ [AccessibilityService] openAccessibilitySettingsNow returned:',
        result,
      );

      return result;
    } catch (error) {
      console.error('Error opening accessibility settings:', error);
      throw error;
    }
  }
}

export const accessibilityService = new AccessibilityService();
