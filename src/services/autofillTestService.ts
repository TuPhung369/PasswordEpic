import { NativeModules, Platform } from 'react-native';
import { useAppSelector } from '../hooks/redux';
import { lightTheme, darkTheme } from '../contexts/ThemeContext';
import { useColorScheme } from 'react-native';

const { LaunchTestActivity } = NativeModules;

/**
 * Autofill Test Service
 * Provides UI for testing the Android Autofill Service
 */
export class AutofillTestService {
  /**
   * Get current theme colors from Redux state
   * Used internally for getting theme data outside React component context
   */
  private static getCurrentTheme() {
    // Default to dark theme if we can't get theme from store
    return darkTheme;
  }

  /**
   * Launch the autofill test activity with current theme colors
   * Shows a native activity with login form to test autofill
   * Theme colors are passed via Intent extras for seamless theming
   */
  static async launchTestActivity(
    themeMode: 'light' | 'dark' | 'system' = 'system',
    isDarkMode: boolean = true,
  ): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('⚠️ Autofill test is only available on Android');
      return false;
    }

    try {
      if (!LaunchTestActivity) {
        console.error('❌ LaunchTestActivity module not available');
        return false;
      }

      // Get the appropriate theme based on mode
      const currentTheme = isDarkMode ? darkTheme : lightTheme;

      // Prepare theme colors to send to native activity
      const themeData = {
        background: currentTheme.background,
        surface: currentTheme.surface,
        primary: currentTheme.primary,
        secondary: currentTheme.secondary,
        text: currentTheme.text,
        textSecondary: currentTheme.textSecondary,
        border: currentTheme.border,
        card: currentTheme.card,
        error: currentTheme.error,
        success: currentTheme.success,
        warning: currentTheme.warning,
        isDarkMode: isDarkMode,
      };

      console.log('🚀 Launching autofill test activity with theme...');
      console.log('🎨 Theme colors:', JSON.stringify(themeData, null, 2));

      const result = await LaunchTestActivity.launchAutofillTestWithTheme(
        themeData,
      );
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
