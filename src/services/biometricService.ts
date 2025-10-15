import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Alert, Platform } from 'react-native';
import { SecureStorageService } from './secureStorageService';

export interface BiometricCapability {
  available: boolean;
  biometryType: keyof typeof BiometryTypes | null;
  error?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  signature?: string;
  publicKey?: string;
}

export class BiometricService {
  private static instance: BiometricService;
  private rnBiometrics: ReactNativeBiometrics;
  private rnBiometricsWithFallback: ReactNativeBiometrics;
  private readonly BIOMETRIC_KEY_ALIAS = 'passwordepic_biometric_key';

  private constructor() {
    // Initialize biometric-only instance (shows fingerprint icon)
    this.rnBiometrics = new ReactNativeBiometrics({
      allowDeviceCredentials: false, // Biometric only - shows fingerprint icon
    });

    // Initialize instance with device credentials fallback (for retry after biometric fails)
    this.rnBiometricsWithFallback = new ReactNativeBiometrics({
      allowDeviceCredentials: true, // Allow fallback to PIN/Pattern
    });

    // BiometricService initialized
  }

  public static getInstance(): BiometricService {
    if (!BiometricService.instance) {
      BiometricService.instance = new BiometricService();
    }
    return BiometricService.instance;
  }

  /**
   * Check if biometric authentication is available on the device
   */
  public async checkBiometricCapability(): Promise<BiometricCapability> {
    try {
      console.log('🔐 BiometricService: checkBiometricCapability called');
      const result = await this.rnBiometrics.isSensorAvailable();
      console.log('🔐 BiometricService: isSensorAvailable result:', result);

      const { biometryType } = result;

      return {
        available: biometryType !== null,
        biometryType: biometryType as keyof typeof BiometryTypes | null,
      };
    } catch (error) {
      console.error('Error checking biometric capability:', error);
      return {
        available: false,
        biometryType: null,
        error: 'Failed to check biometric capability',
      };
    }
  }

  /**
   * Get human-readable biometric type name
   */
  public getBiometricTypeName(
    biometryType: keyof typeof BiometryTypes | null,
  ): string {
    switch (biometryType) {
      case BiometryTypes.TouchID:
        return 'Touch ID';
      case BiometryTypes.FaceID:
        return 'Face ID';
      case BiometryTypes.Biometrics:
        return Platform.OS === 'android' ? 'Fingerprint' : 'Biometrics';
      default:
        return 'Biometric Authentication';
    }
  }

  /**
   * Setup biometric authentication (create key pair)
   */
  public async setupBiometricAuth(): Promise<BiometricAuthResult> {
    try {
      // Check if biometrics are available
      const capability = await this.checkBiometricCapability();
      if (!capability.available) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      // For Android emulator, we need to handle key creation differently
      // Setting up biometric authentication

      try {
        // Try to delete existing keys first (ignore errors)
        await this.rnBiometrics.deleteKeys().catch(() => {
          // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
          // console.log(
          //   'No existing keys to delete or deletion failed - continuing...',
          // );
        });

        // Create new key pair with smart emulator detection
        let publicKey;

        try {
          const result = await this.rnBiometrics.createKeys();
          publicKey = result.publicKey;
          // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
          // console.log('✅ Biometric keys created successfully');
        } catch (keyError: any) {
          console.warn('Key creation failed:', keyError.message);

          // Check if this is an emulator-specific issue
          if (
            keyError.message?.includes('generating public private keys') ||
            keyError.message?.includes('KeyStore') ||
            keyError.message?.includes('Hardware security module')
          ) {
            // Android emulator detected - using fallback mode for setup
            publicKey = 'emulator_mock_key';
          } else {
            // For other errors, try once more
            // Retrying key creation
            try {
              await new Promise<void>(resolve =>
                setTimeout(() => resolve(), 500),
              );
              const retryResult = await this.rnBiometrics.createKeys();
              publicKey = retryResult.publicKey;
              // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
              // console.log('✅ Biometric keys created on retry');
            } catch (retryError: any) {
              console.error(
                'Key creation failed on retry:',
                retryError.message,
              );
              throw retryError;
            }
          }
        }

        // Store biometric setup status
        await SecureStorageService.getInstance().storeBiometricStatus(true);

        //const isEmulator = publicKey === 'emulator_mock_key';
        // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
        // console.log(
        //   `✅ Biometric authentication setup completed ${
        //     isEmulator ? '(emulator mode)' : '(real device)'
        //   }`,
        // );

        return {
          success: true,
          publicKey,
        };
      } catch (keyCreationError: any) {
        console.error(
          '❌ Biometric key creation failed completely:',
          keyCreationError.message,
        );
        throw keyCreationError;
      }
    } catch (error: any) {
      console.error('❌ Biometric setup failed:', error.message);
      return {
        success: false,
        error: `Failed to setup biometric authentication: ${error.message}`,
      };
    }
  }

  /**
   * Authenticate using biometrics
   */
  public async authenticateWithBiometrics(
    promptMessage: string = 'Authenticate to access your passwords',
  ): Promise<BiometricAuthResult> {
    try {
      // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
      // console.log(
      //   '🔐 BiometricService: authenticateWithBiometrics called with message:',
      //   promptMessage,
      // );
      // Check if biometrics are available
      const capability = await this.checkBiometricCapability();
      if (!capability.available) {
        // console.log('🔐 BiometricService: Biometric not available');
        return {
          success: false,
          error: 'Biometric authentication is not available',
        };
      }

      // Check if biometric auth is set up
      const isSetup = await this.isBiometricSetup();
      if (!isSetup) {
        // console.log('🔐 BiometricService: Biometric not set up');
        return {
          success: false,
          error: 'Biometric authentication is not set up',
        };
      }

      // console.log('🔐 BiometricService: Starting biometric authentication...');

      try {
        // Use biometric with device credentials fallback (PIN/Pattern) from the start
        // This shows fingerprint icon AND allows PIN/Pattern as alternative
        console.log(
          '🔐 Starting authentication with biometric and PIN/Pattern fallback...',
        );

        const authResult = await this.rnBiometricsWithFallback.simplePrompt({
          promptMessage: promptMessage,
          cancelButtonText: 'Cancel',
        });

        if (authResult.success) {
          console.log('✅ Authentication succeeded');
          return {
            success: true,
            signature: 'auth_signature_' + Date.now(),
          };
        }

        // Check if user cancelled
        if (
          authResult.error?.includes('cancelled') ||
          authResult.error?.includes('Cancel') ||
          authResult.error?.includes('authentication was cancelled')
        ) {
          console.log('❌ User cancelled authentication');
          return {
            success: false,
            error: 'Authentication cancelled by user',
          };
        }

        return {
          success: false,
          error: authResult.error || 'Authentication failed.',
        };
      } catch (biometricError: any) {
        console.error(
          '🔐 Biometric authentication error:',
          biometricError.message,
        );

        // Check if FragmentActivity is null (Android-specific timing issue)
        if (
          biometricError.message?.includes('FragmentActivity') ||
          biometricError.message?.includes('must not be null')
        ) {
          console.error(
            '❌ FragmentActivity not ready - Activity context is null',
          );
          return {
            success: false,
            error: 'Biometric prompt not ready. Please try again in a moment.',
          };
        }

        // Check if user cancelled
        if (
          biometricError.message?.includes('cancelled') ||
          biometricError.message?.includes('Cancel') ||
          biometricError.message?.includes('authentication was cancelled')
        ) {
          console.log('❌ User cancelled authentication');
          return {
            success: false,
            error: 'Authentication cancelled by user',
          };
        }

        // For other errors, provide helpful message
        return {
          success: false,
          error:
            'Biometric authentication failed. Make sure biometric is set up on your device.',
        };
      }
    } catch (error: any) {
      console.error('❌ Error during biometric authentication:', error);

      // Final check for cancellation
      if (
        error.message?.includes('cancelled') ||
        error.message?.includes('Cancel') ||
        error.message?.includes('authentication was cancelled')
      ) {
        return { success: false, error: 'Authentication cancelled by user' };
      }

      return {
        success: false,
        error: 'Biometric authentication failed',
      };
    }
  }

  /**
   * Check if biometric authentication is set up
   */
  public async isBiometricSetup(): Promise<boolean> {
    try {
      // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
      // console.log('🔐 BiometricService: isBiometricSetup called');
      const status =
        await SecureStorageService.getInstance().getBiometricStatus();
      // console.log('🔐 BiometricService: Storage status:', status);
      // If biometric is disabled in storage, return false
      if (!status) {
        // console.log(
        //   '🔐 BiometricService: Biometric disabled in storage, returning false',
        // );
        return false;
      }

      try {
        // console.log('🔐 BiometricService: Checking if biometric keys exist...');
        // console.log(
        //   '⚠️ WARNING: biometricKeysExist() might trigger native biometric prompt!',
        // );
        const { keysExist } = await this.rnBiometrics.biometricKeysExist();
        // console.log('🔐 BiometricService: Keys exist:', keysExist);
        // console.log(
        //   '✅ biometricKeysExist() completed without triggering prompt',
        // );

        if (keysExist) {
          // Real device with actual keys
          // console.log(
          //   '🔐 BiometricService: Real device with keys, returning true',
          // );
          return true;
        } else {
          // Emulator or no keys - use storage status for emulator mode
          // console.log(
          //   '🔐 BiometricService: Emulator mode, returning storage status:',
          //   status,
          // );
          return status;
        }
      } catch (keyCheckError) {
        // For emulator or when key check fails, rely on storage status only
        // console.log(
        //   '🔐 BiometricService: Key check error, returning storage status:',
        //   status,
        // );
        return status;
      }
    } catch (error) {
      console.error('Error checking biometric setup:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication
   */
  public async disableBiometricAuth(): Promise<boolean> {
    try {
      // Delete biometric keys
      await this.rnBiometrics.deleteKeys();

      // Update storage
      await SecureStorageService.getInstance().storeBiometricStatus(false);

      return true;
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
      return false;
    }
  }

  /**
   * Show biometric setup prompt to user
   */
  public showBiometricSetupPrompt(
    onSetup: () => void,
    onCancel: () => void,
  ): void {
    Alert.alert(
      'Enable Biometric Authentication',
      'Use your fingerprint or face to quickly and securely access your passwords.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: 'Enable',
          onPress: onSetup,
        },
      ],
    );
  }

  /**
   * Show biometric authentication error
   */
  public showBiometricError(error: string, onRetry?: () => void): void {
    const buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'cancel';
    }> = [
      {
        text: 'OK',
        style: 'cancel',
      },
    ];

    if (onRetry) {
      buttons.push({
        text: 'Try Again',
        onPress: onRetry,
      });
    }

    Alert.alert('Authentication Failed', error, buttons);
  }
}

export default BiometricService;
