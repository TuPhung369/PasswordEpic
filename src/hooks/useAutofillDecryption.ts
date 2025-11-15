import { useEffect } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { decryptDataWithRetry } from '../services/cryptoService';
import { sessionCache } from '../utils/sessionCache';

const { AutofillBridge } = NativeModules;

/**
 * 🔐 useAutofillDecryption
 *
 * React Native hook that listens for autofill decryption requests from Android
 * and handles the decryption process.
 *
 * Flow:
 * 1. User taps autofill credential and authenticates with biometric
 * 2. Android sends AUTOFILL_DECRYPT_REQUEST event
 * 3. This hook catches it and decrypts the password
 * 4. Stores plaintext in cache via AutofillBridge.storeDecryptedPasswordForAutofill()
 * 5. onFillRequest is triggered again and fills the fields
 *
 * Security:
 * - Only works on Android (iOS doesn't need this flow)
 * - Requires master password to be in session cache
 * - Plaintext cached for only 60 seconds
 */
export const useAutofillDecryption = () => {
  // Get master password from session cache
  const masterPassword = sessionCache.get<string>('masterPassword');

  useEffect(() => {
    // Only on Android
    if (Platform.OS !== 'android') {
      return;
    }

    // Must have AutofillBridge and master password
    if (!AutofillBridge || !masterPassword) {
      console.log(
        '⚠️ [useAutofillDecryption] AutofillBridge or masterPassword not available',
      );
      return;
    }

    console.log(
      '📡 [useAutofillDecryption] Setting up listener for AUTOFILL_DECRYPT_REQUEST',
    );

    try {
      const eventEmitter = new NativeEventEmitter(AutofillBridge);

      // Listen for decryption requests from AutofillAuthActivity
      const subscription = eventEmitter.addListener(
        'AUTOFILL_DECRYPT_REQUEST',
        async (request: any) => {
          try {
            console.log(
              '🔐 [useAutofillDecryption] Received decryption request',
            );
            console.log(`   Credential ID: ${request.credentialId}`);
            console.log(`   Username: ${request.username}`);
            console.log(`   Domain: ${request.domain}`);
            console.log(`   Has IV: ${request.iv ? 'yes' : 'no'}`);
            console.log(`   Has TAG: ${request.tag ? 'yes' : 'no'}`);
            console.log(`   Has Salt: ${request.salt ? 'yes' : 'no'}`);

            // Step 1: Validate request data
            if (!request.credentialId || !request.encryptedPassword) {
              console.error(
                '❌ [useAutofillDecryption] Invalid decryption request - missing data',
              );
              return;
            }

            // Step 2-3: Decrypt password using AES-GCM with automatic retry for backward compatibility
            console.log(
              '🔑 [useAutofillDecryption] Decrypting password with retry mechanism...',
            );
            
            const salt = request.salt || ''; // Use provided salt or empty string
            
            let decrypted: string;
            try {
              decrypted = decryptDataWithRetry(
                request.encryptedPassword,
                masterPassword,
                salt,
                request.iv,
                request.tag,
              );
            } catch (retryError) {
              console.error(
                '❌ [useAutofillDecryption] Decryption failed with all retry attempts:',
                retryError,
              );
              throw retryError;
            }
            
            console.log(
              `   Decrypted password length: ${decrypted.length} chars`,
            );

            // Step 4: Cache plaintext via AutofillBridge
            console.log(
              `📦 [useAutofillDecryption] Caching plaintext for autofill (ID: ${request.credentialId})`,
            );

            const cacheResult = await new Promise<boolean>(resolve => {
              AutofillBridge.storeDecryptedPasswordForAutofill(
                request.credentialId,
                decrypted,
                (success: boolean) => {
                  console.log(
                    `   Cache result: ${success ? '✅ stored' : '❌ failed'}`,
                  );
                  resolve(success);
                },
              );
            });

            if (cacheResult) {
              console.log(
                '✅ [useAutofillDecryption] Password cached for autofill - onFillRequest will now trigger',
              );
            } else {
              console.warn(
                '⚠️ [useAutofillDecryption] Failed to cache password',
              );
            }
          } catch (error) {
            console.error(
              '❌ [useAutofillDecryption] Error during decryption:',
              error,
            );
          }
        },
      );

      return () => {
        // Cleanup listener on unmount
        console.log('🛑 [useAutofillDecryption] Removing listener');
        subscription.remove();
      };
    } catch (error) {
      console.error(
        '❌ [useAutofillDecryption] Error setting up listener:',
        error,
      );
    }
  }, [masterPassword]);
};
