import { NativeModules, Platform } from 'react-native';

const { LaunchTestActivity } = NativeModules;

/**
 * Autofill Test Service
 * Provides UI for testing the Android Autofill Service
 */
export class AutofillTestService {
  /**
   * Launch the autofill test activity
   * Shows a native activity with login form to test autofill
   */
  static async launchTestActivity(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('⚠️ Autofill test is only available on Android');
      return false;
    }

    try {
      if (!LaunchTestActivity) {
        console.error('❌ LaunchTestActivity module not available');
        return false;
      }

      console.log('🚀 Launching autofill test activity...');
      const result = await LaunchTestActivity.launchAutofillTest();
      console.log(`✅ Test activity launched successfully`);
      return result;
    } catch (error) {
      console.error('❌ Failed to launch test activity:', error);
      return false;
    }
  }

  /**
   * Check if autofill is currently enabled on the device
   */
  static async isAutofillEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      if (!LaunchTestActivity) {
        return false;
      }

      const isEnabled = await LaunchTestActivity.isAutofillEnabled();
      console.log(`🔍 Autofill enabled: ${isEnabled}`);
      return isEnabled;
    } catch (error) {
      console.error('❌ Error checking autofill status:', error);
      return false;
    }
  }

  /**
   * Open the system autofill settings for user to enable the service
   */
  static async openAutofillSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      if (!LaunchTestActivity) {
        return false;
      }

      console.log('🔧 Opening autofill settings...');
      const result = await LaunchTestActivity.openAutofillSettings();
      console.log('✅ Autofill settings opened');
      return result;
    } catch (error) {
      console.error('❌ Failed to open autofill settings:', error);
      return false;
    }
  }
}

export default AutofillTestService;
