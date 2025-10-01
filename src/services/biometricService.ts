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
  private readonly BIOMETRIC_KEY_ALIAS = 'passwordepic_biometric_key';

  private constructor() {
    // For Android emulator, we need to allow device credentials as fallback
    this.rnBiometrics = new ReactNativeBiometrics({
      allowDeviceCredentials: true, // Allow PIN/Pattern as fallback for emulator
    });

    // BiometricService initialized with device credentials allowed
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
      const result = await this.rnBiometrics.isSensorAvailable();

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
          console.log(
            'No existing keys to delete or deletion failed - continuing...',
          );
        });

        // Create new key pair with smart emulator detection
        let publicKey;

        try {
          const result = await this.rnBiometrics.createKeys();
          publicKey = result.publicKey;
          console.log('✅ Biometric keys created successfully');
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
              console.log('✅ Biometric keys created on retry');
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

        const isEmulator = publicKey === 'emulator_mock_key';
        console.log(
          `✅ Biometric authentication setup completed ${
            isEmulator ? '(emulator mode)' : '(real device)'
          }`,
        );

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
      // Check if biometrics are available
      const capability = await this.checkBiometricCapability();
      if (!capability.available) {
        return {
          success: false,
          error: 'Biometric authentication is not available',
        };
      }

      // Check if biometric auth is set up
      const isSetup = await this.isBiometricSetup();
      if (!isSetup) {
        return {
          success: false,
          error: 'Biometric authentication is not set up',
        };
      }

      // Create signature with current timestamp
      const payload = `auth_${Date.now()}`;

      try {
        // First, check if we need to use emulator fallback immediately
        const { keysExist } = await this.rnBiometrics.biometricKeysExist();

        if (!keysExist) {
          // Emulator mode: attempting biometric authentication
          try {
            // First try to use simplePrompt which is more reliable on emulator
            console.log('🎭 Emulator: Trying simplePrompt first...');
            const simpleResult = await this.rnBiometrics.simplePrompt({
              promptMessage:
                promptMessage +
                '\n\n💡 Emulator: Use Extended Controls → Touch Sensor',
              cancelButtonText: 'Cancel',
            });

            if (simpleResult.success) {
              console.log('✅ Emulator biometric authentication succeeded');
              return {
                success: true,
                signature: 'emulator_fake_signature_' + Date.now(),
              };
            } else {
              // Check if user cancelled
              if (
                simpleResult.error?.includes('cancelled') ||
                simpleResult.error?.includes('Cancel') ||
                simpleResult.error?.includes('authentication was cancelled')
              ) {
                return {
                  success: false,
                  error: 'Authentication cancelled by user',
                };
              }

              return {
                success: false,
                error:
                  simpleResult.error ||
                  'Biometric authentication failed. On emulator, use Extended Controls → Touch Sensor.',
              };
            }
          } catch (emulatorError: any) {
            console.error(
              '🎭 Emulator authentication error:',
              emulatorError.message,
            );

            // Check if user cancelled
            if (
              emulatorError.message?.includes('cancelled') ||
              emulatorError.message?.includes('Cancel') ||
              emulatorError.message?.includes('authentication was cancelled')
            ) {
              console.log('❌ User cancelled emulator authentication');
              return {
                success: false,
                error: 'Authentication cancelled by user',
              };
            }

            // For other emulator errors, provide helpful message
            return {
              success: false,
              error:
                'Biometric authentication failed. On emulator, use Extended Controls → Touch Sensor.',
            };
          }
        }

        // For real devices with actual keys
        // Using real device biometric authentication
        const { success, signature, error } =
          await this.rnBiometrics.createSignature({
            promptMessage,
            payload,
            cancelButtonText: 'Cancel',
          });

        if (success && signature) {
          // Real device biometric authentication succeeded
          return { success: true, signature };
        } else {
          const errorMessage =
            typeof error === 'string'
              ? error
              : 'Biometric authentication failed';
          console.error('Biometric authentication failed:', errorMessage);
          return {
            success: false,
            error: errorMessage,
          };
        }
      } catch (signatureError: any) {
        console.warn('🔐 Signature creation error:', signatureError.message);

        // Check if user cancelled
        if (
          signatureError.message?.includes('cancelled') ||
          signatureError.message?.includes('Cancel') ||
          signatureError.message?.includes('authentication was cancelled')
        ) {
          console.log('❌ User cancelled authentication');
          return { success: false, error: 'Authentication cancelled by user' };
        }

        // For hardware/key errors, return failure instead of fallback
        if (
          signatureError.message?.includes('generating public private keys') ||
          signatureError.message?.includes('KeyStore') ||
          signatureError.message?.includes(
            'No installed provider supports this key',
          ) ||
          signatureError.message?.includes('generating signature') ||
          signatureError.message?.includes('Hardware security module')
        ) {
          console.log('❌ Hardware biometric authentication failed');
          return {
            success: false,
            error: 'Biometric hardware authentication failed',
          };
        }

        // For other errors, rethrow
        throw signatureError;
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
      const status =
        await SecureStorageService.getInstance().getBiometricStatus();
      // If biometric is disabled in storage, return false
      if (!status) {
        return false;
      }

      try {
        const { keysExist } = await this.rnBiometrics.biometricKeysExist();

        if (keysExist) {
          // Real device with actual keys
          return true;
        } else {
          // Emulator or no keys - use storage status for emulator mode
          return status;
        }
      } catch (keyCheckError) {
        // For emulator or when key check fails, rely on storage status only
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
