import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Alert, Platform, NativeModules } from 'react-native';
import { SecureStorageService } from './secureStorageService';

const { BiometricModule } = NativeModules;

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

  // Cache for biometric capability check (5 second TTL)
  private capabilityCache: {
    result: BiometricCapability | null;
    timestamp: number;
  } = {
    result: null,
    timestamp: 0,
  };

  // Cache for biometric setup status (30 second TTL)
  private setupStatusCache: {
    result: boolean | null;
    timestamp: number;
    pending: Promise<boolean> | null; // Prevent simultaneous calls
  } = {
    result: null,
    timestamp: 0,
    pending: null,
  };

  private readonly CACHE_TTL = 30000; // 30 seconds (increased from 5 to survive navigation)

  private constructor() {
    this.rnBiometrics = new ReactNativeBiometrics({
      allowDeviceCredentials: false,
    });

    this.rnBiometricsWithFallback = new ReactNativeBiometrics({
      allowDeviceCredentials: true,
    });
  }

  public static getInstance(): BiometricService {
    if (!BiometricService.instance) {
      BiometricService.instance = new BiometricService();
    }
    return BiometricService.instance;
  }

  /**
   * Check if biometric sensor is available (simple boolean check)
   */
  public async isSensorAvailable(): Promise<boolean> {
    try {
      console.log('🔐 BiometricService: isSensorAvailable called');
      const capability = await this.checkBiometricCapability();
      console.log(
        '🔐 BiometricService: isSensorAvailable result:',
        capability.available,
      );
      return capability.available;
    } catch (error) {
      console.error('Error checking if sensor available:', error);
      return false;
    }
  }

  /**
   * Check if biometric authentication is available on the device
   * Results are cached for 5 seconds to prevent excessive calls
   */
  public async checkBiometricCapability(): Promise<BiometricCapability> {
    try {
      // Check cache first
      const now = Date.now();
      if (
        this.capabilityCache.result &&
        now - this.capabilityCache.timestamp < this.CACHE_TTL
      ) {
        return this.capabilityCache.result;
      }

      if (__DEV__) {
        console.log('🔐 BiometricService: checkBiometricCapability called');
      }

      const result = await this.rnBiometrics.isSensorAvailable();
      console.log('🔐 BiometricService: isSensorAvailable result:', result);

      const { biometryType } = result;

      const capability: BiometricCapability = {
        available: biometryType !== null,
        biometryType: biometryType as keyof typeof BiometryTypes | null,
      };

      // Cache the result
      this.capabilityCache = {
        result: capability,
        timestamp: now,
      };

      return capability;
    } catch (error) {
      console.error('Error checking biometric capability:', error);
      const errorResult: BiometricCapability = {
        available: false,
        biometryType: null,
        error: 'Failed to check biometric capability',
      };

      // Cache error result to prevent repeated failures
      this.capabilityCache = {
        result: errorResult,
        timestamp: Date.now(),
      };

      return errorResult;
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
        return Platform.OS === 'android'
          ? 'Fingerprint or Face ID'
          : 'Biometrics';
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

        console.log('🔐 [setupBiometricAuth] Storing biometric status to true');
        // Store biometric setup status
        try {
          console.log(
            '🔐 [setupBiometricAuth] About to call storeBiometricStatus(true)',
          );
          await SecureStorageService.getInstance().storeBiometricStatus(true);
          console.log(
            '✅ [setupBiometricAuth] Biometric status stored successfully',
          );

          const verification =
            await SecureStorageService.getInstance().getBiometricStatus();
          console.log(
            `🔐 [setupBiometricAuth] Verification after store: ${verification}`,
          );

          // Clear cache to force re-check with new status
          this.clearCache();
        } catch (storageError) {
          console.error(
            '❌ [setupBiometricAuth] Failed to store biometric status:',
            storageError,
          );
          throw storageError;
        }

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
   * @param promptMessage - Message to show in biometric prompt
   * @param biometricPreference - Preferred biometric type (fingerprint, face, any)
   */
  public async authenticateWithBiometrics(
    promptMessage: string = 'Authenticate to access your passwords',
    biometricPreference: 'fingerprint' | 'face' | 'any' = 'any',
  ): Promise<BiometricAuthResult> {
    try {
      console.log('🔐 [BiometricService] authenticateWithBiometrics called');
      console.log('🔐 [BiometricService] promptMessage:', promptMessage);
      console.log(
        '🔐 [BiometricService] biometricPreference:',
        biometricPreference,
      );

      const capability = await this.checkBiometricCapability();
      console.log('🔐 [BiometricService] capability:', capability);

      if (!capability.available) {
        console.log('❌ [BiometricService] Biometric not available');
        return {
          success: false,
          error: 'Biometric authentication is not available',
        };
      }

      // Don't check isSetup - allow authentication even if not configured in storage
      // This allows users to authenticate after reinstall without needing to reconfigure
      console.log(
        '✅ [BiometricService] Hardware available, proceeding with authentication',
      );

      try {
        console.log('🔐 [BiometricService] Preparing authentication prompt...');
        let finalPromptMessage = promptMessage;
        let title = 'Authenticate';
        let subtitle = 'Biometric Authentication';

        if (biometricPreference === 'face') {
          finalPromptMessage = 'Look at the camera to unlock';
          title = 'Face Recognition';
          subtitle = 'Position your face in front of the camera';
        } else if (biometricPreference === 'fingerprint') {
          finalPromptMessage = 'Touch the fingerprint sensor';
          title = 'Fingerprint';
          subtitle = 'Place your finger on the sensor';
        }

        console.log('🔐 [BiometricService] Platform.OS:', Platform.OS);
        console.log(
          '🔐 [BiometricService] BiometricModule exists:',
          !!BiometricModule,
        );

        if (Platform.OS === 'android' && BiometricModule) {
          try {
            console.log('🔐 [BiometricService] Using native BiometricModule');
            console.log(
              '🔐 [BiometricService] Calling authenticateWithPreference (biometric only)',
            );

            await BiometricModule.authenticateWithPreference(
              title,
              subtitle,
              finalPromptMessage,
              'Cancel',
              biometricPreference,
            );

            console.log(
              '✅ [BiometricService] Authentication succeeded (native module)',
            );

            // ===== FIX: Cache biometric setup status after successful auth =====
            const now = Date.now();
            this.setupStatusCache = {
              result: true, // If we successfully authenticated, biometric is set up
              timestamp: now,
              pending: null,
            };
            console.log(
              '✅ [BiometricService] Biometric setup status cached after successful auth',
            );
            // ===== END FIX =====

            return {
              success: true,
              signature: 'auth_signature_' + Date.now(),
            };
          } catch (nativeError: any) {
            console.log(
              '❌ [BiometricService] Native module error:',
              nativeError,
            );
            if (
              nativeError.message?.includes('cancelled') ||
              nativeError.message?.includes('Cancel')
            ) {
              console.log(
                '❌ [BiometricService] User cancelled authentication',
              );
              return {
                success: false,
                error: 'Authentication cancelled by user',
              };
            }
            throw nativeError;
          }
        }

        console.log(
          '🔐 [BiometricService] Using react-native-biometrics fallback',
        );

        const biometricInstance = this.rnBiometrics;

        const authResult = await biometricInstance.simplePrompt({
          promptMessage: finalPromptMessage,
          cancelButtonText: 'Cancel',
        });

        if (authResult.success) {
          console.log('✅ Authentication succeeded');
          return {
            success: true,
            signature: 'auth_signature_' + Date.now(),
          };
        }

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
        // console.error(
        //   '🔐 Biometric authentication error:',
        //   biometricError.message,
        // );

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
   * Results are cached for 5 seconds to prevent excessive calls
   */
  public async isBiometricSetup(): Promise<boolean> {
    try {
      // Check cache first
      const now = Date.now();
      if (
        this.setupStatusCache.result !== null &&
        now - this.setupStatusCache.timestamp < this.CACHE_TTL
      ) {
        return this.setupStatusCache.result;
      }

      // ===== FIX: Debounce simultaneous calls =====
      if (this.setupStatusCache.pending) {
        return this.setupStatusCache.pending;
      }
      // ===== END FIX =====

      if (__DEV__) {
        const stack = new Error().stack?.split('\n')[2] || 'unknown';
        console.log(
          '🔐 BiometricService: isBiometricSetup called from:',
          stack.trim(),
        );
        console.log('🔐 BiometricService: Cache miss - fetching from storage');
      }

      // ===== FIX: Create pending promise to prevent simultaneous calls =====
      const fetchPromise = this._fetchBiometricSetupStatus();
      this.setupStatusCache.pending = fetchPromise;

      try {
        const result = await fetchPromise;
        return result;
      } finally {
        this.setupStatusCache.pending = null;
      }
    } catch (error) {
      console.error('❌ Error checking biometric setup:', error);
      // Cache the error result
      this.setupStatusCache = {
        result: false,
        timestamp: Date.now(),
        pending: null,
      };
      return false;
    }
  }

  /**
   * Internal method to fetch biometric setup status from storage
   * Separated for debouncing purposes
   */
  private async _fetchBiometricSetupStatus(): Promise<boolean> {
    try {
      const now = Date.now();
      const status =
        await SecureStorageService.getInstance().getBiometricStatus();
      console.log('🔐 BiometricService: Storage status:', status);
      // If biometric is disabled in storage, return false
      if (!status) {
        console.log(
          '🔐 BiometricService: Biometric disabled in storage, returning false',
        );
        // Cache the result
        this.setupStatusCache = {
          result: false,
          timestamp: now,
          pending: null,
        };
        return false;
      }

      try {
        console.log('🔐 BiometricService: Checking if biometric keys exist...');
        console.log(
          '⚠️ WARNING: biometricKeysExist() might trigger native biometric prompt!',
        );
        const { keysExist } = await this.rnBiometrics.biometricKeysExist();
        console.log('🔐 BiometricService: Keys exist:', keysExist);
        console.log(
          '✅ biometricKeysExist() completed without triggering prompt',
        );

        const finalResult = keysExist || status;

        if (keysExist) {
          // Real device with actual keys
          console.log(
            '🔐 BiometricService: Real device with keys, returning true',
          );
        } else {
          // Emulator or no keys - use storage status for emulator mode
          console.log(
            '🔐 BiometricService: Emulator mode, returning storage status:',
            status,
          );
        }

        // Cache the result
        this.setupStatusCache = {
          result: finalResult,
          timestamp: now,
          pending: null,
        };

        return finalResult;
      } catch (keyCheckError) {
        // For emulator or when key check fails, rely on storage status only
        console.log(
          '🔐 BiometricService: Key check error, returning storage status:',
          status,
        );
        console.log(
          '🔐 BiometricService: Key check error details:',
          keyCheckError,
        );

        // Cache the result
        this.setupStatusCache = {
          result: status,
          timestamp: now,
          pending: null,
        };

        return status;
      }
    } catch (error) {
      console.error('❌ Error checking biometric setup:', error);
      // Cache the error result
      this.setupStatusCache = {
        result: false,
        timestamp: Date.now(),
        pending: null,
      };
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

      // Clear cache to force re-check
      this.clearCache();

      return true;
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
      return false;
    }
  }

  /**
   * Clear cached biometric status and capability
   * Should be called after enabling/disabling biometric or after significant auth changes
   */
  public clearCache(): void {
    console.log('🧹 BiometricService: Clearing cache');
    this.capabilityCache = {
      result: null,
      timestamp: 0,
    };
    this.setupStatusCache = {
      result: null,
      timestamp: 0,
      pending: null,
    };
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
      'Use your fingerprint, face recognition, or other biometric methods to quickly and securely access your passwords.',
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
