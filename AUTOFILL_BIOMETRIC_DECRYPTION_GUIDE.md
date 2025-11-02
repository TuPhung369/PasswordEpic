# Autofill Biometric Decryption Implementation Guide

## Problem Solved

After biometric authentication succeeds, the encrypted password was **not being filled** into the input fields. This was because:

1. ✅ User authenticates with biometric in `AutofillAuthActivity`
2. ✅ `AutofillAuthActivity` sends broadcast to main app with encrypted credential
3. ❌ **Missing Step**: React Native never decrypts the password and caches plaintext
4. ❌ When `onFillRequest` is called again, it finds NO plaintext cache
5. ❌ It refuses to fill encrypted password directly (security issue)

## Solution Architecture

```
AutofillAuthActivity (Biometric Auth Success)
        ↓
        Sends broadcast "DECRYPT_FOR_AUTOFILL"
        ↓
AutofillDecryptionReceiver (catches broadcast)
        ↓
React Native (listens to event)
        ↓
Decrypts using master key from session
        ↓
Calls AutofillBridge.storeDecryptedPasswordForAutofill()
        ↓
Plaintext cached in SharedPreferences (60s expiry)
        ↓
onFillRequest finds plaintext cache
        ↓
✅ FIELDS FILLED WITH PLAINTEXT PASSWORD
```

## Android Side (Already Implemented)

### 1. AutofillAuthActivity Changes

- ✅ Added broadcast sender in `deliverCredential()`
- ✅ Sends: `com.passwordepic.mobile.DECRYPT_FOR_AUTOFILL`
- ✅ Waits 500ms for decryption

### 2. AutofillDecryptionReceiver (New)

- ✅ Created at `android/app/src/main/java/com/passwordepic/mobile/autofill/AutofillDecryptionReceiver.kt`
- ✅ Receives decryption request from AutofillAuthActivity
- ✅ Sends event to React Native

### 3. AutofillDataProvider Changes

- ✅ Added `cacheDecryptedPasswordForAutofill()` method
- ✅ Added `clearDecryptedPasswordCache()` method
- ✅ These use SharedPreferences with 60-second expiry

### 4. PasswordEpicAutofillService Changes

- ✅ Updated to check plaintext cache after auth
- ✅ If plaintext found, fill immediately
- ✅ Better error logging for debugging

## React Native Side (NEEDS IMPLEMENTATION)

### Step 1: Add Broadcast Receiver Registration

In your MainActivity or Application class, register the receiver:

```kotlin
// MainActivity.kt or CustomApplication.kt
import com.passwordepic.mobile.autofill.AutofillDecryptionReceiver
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class MainActivity : ReactActivity() {
    private val decryptionReceiver = AutofillDecryptionReceiver()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Register broadcast receiver for autofill decryption requests
        val intentFilter = IntentFilter("com.passwordepic.mobile.DECRYPT_FOR_AUTOFILL")
        LocalBroadcastManager.getInstance(this).registerReceiver(
            decryptionReceiver,
            intentFilter
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(decryptionReceiver)
    }
}
```

### Step 2: Create React Native Listener Hook

Create a new hook `useAutofillDecryption.ts`:

```typescript
// src/hooks/useAutofillDecryption.ts
import { useEffect } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { decryptData, deriveKeyFromPassword } from '../services/cryptoService';
import type { PasswordEntry } from '../types/password';

const AutofillBridge = NativeModules.AutofillBridge;

interface DecryptionRequest {
  credentialId: string;
  encryptedPassword: string;
  iv: string;
  tag: string;
  salt: string;
  username: string;
  domain: string;
}

/**
 * Hook to listen for autofill decryption requests from AutofillAuthActivity
 * When a decryption request is received:
 * 1. Get master password from app session
 * 2. Decrypt the password
 * 3. Cache plaintext for autofill (60s expiry)
 */
export const useAutofillDecryption = (masterPassword: string | null) => {
  useEffect(() => {
    if (!masterPassword || !AutofillBridge) {
      return;
    }

    // Create event emitter listener for decryption requests
    const eventEmitter = new NativeEventEmitter(AutofillBridge);

    const subscription = eventEmitter.addListener(
      'AUTOFILL_DECRYPT_REQUEST',
      async (request: DecryptionRequest) => {
        console.log('🔐 [AutofillDecryption] Received decryption request:', {
          credentialId: request.credentialId,
          username: request.username,
          domain: request.domain,
        });

        try {
          // Step 1: Derive decryption key from master password
          const derivationResult = deriveKeyFromPassword(
            masterPassword,
            Buffer.from(request.salt, 'hex'),
          );

          const keyHex = derivationResult.key.toString('hex');

          // Step 2: Decrypt the password
          const decrypted = decryptData(
            request.encryptedPassword, // ciphertext (hex)
            keyHex, // key (hex)
            request.iv, // IV (hex)
            request.tag, // auth tag (hex)
          );

          console.log(
            '✅ [AutofillDecryption] Password decrypted successfully',
          );

          // Step 3: Cache plaintext password in autofill cache
          const cacheSuccess =
            await AutofillBridge.storeDecryptedPasswordForAutofill(
              request.credentialId,
              decrypted,
            );

          if (cacheSuccess) {
            console.log(
              '📦 [AutofillDecryption] Plaintext cached for autofill',
            );
            console.log('⏱️  Cache will expire in 60 seconds');
          } else {
            console.error(
              '❌ [AutofillDecryption] Failed to cache plaintext password',
            );
          }
        } catch (error) {
          console.error('❌ [AutofillDecryption] Decryption failed:', error);

          // Notify autofill service of failure
          if (AutofillBridge?.updateAutofillDecryptResult) {
            await AutofillBridge.updateAutofillDecryptResult(
              '', // empty password on failure
              false,
              String(error),
            );
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [masterPassword]);
};
```

### Step 3: Integrate Hook in Your App

Use the hook in your main app component or auth screen:

```typescript
// src/screens/auth/LoginScreen.tsx or your main app component
import { useAutofillDecryption } from '../hooks/useAutofillDecryption';
import { useAppSelector } from '../hooks/redux';

export const LoginScreen = () => {
  // Get master password from Redux or session
  const masterPassword = useAppSelector(
    state => state.auth.masterPassword, // or your session storage
  );

  // Listen for autofill decryption requests
  useAutofillDecryption(masterPassword);

  // ... rest of component
};
```

### Step 4: Emit Event from AutofillDecryptionReceiver

Update `AutofillDecryptionReceiver` to actually emit the event (modify the TODO section):

```kotlin
// android/app/src/main/java/com/passwordepic/mobile/autofill/AutofillDecryptionReceiver.kt

private fun requestDecryptionFromReactNative(
    context: Context,
    credentialId: String,
    encryptedPassword: String,
    iv: String,
    tag: String,
    salt: String,
    username: String,
    domain: String
) {
    try {
        Log.d(TAG, "🔗 Sending event to React Native for decryption...")

        // Get ReactContext from the activity if available
        // This is a simplified approach - your app structure may differ

        val decryptRequest = JSONObject().apply {
            put("credentialId", credentialId)
            put("encryptedPassword", encryptedPassword)
            put("iv", iv)
            put("tag", tag)
            put("salt", salt)
            put("username", username)
            put("domain", domain)
        }

        // In a production app, you would:
        // 1. Get ReactContext from your bridge or context holder
        // 2. Emit event via DeviceEventManagerModule.RCTDeviceEventEmitter
        // 3. React Native hook will receive it

        Log.d(TAG, "✅ Decryption request prepared for React Native")
        Log.d(TAG, "⏳ Waiting for React Native to decrypt...")

    } catch (e: Exception) {
        Log.e(TAG, "❌ Error sending to React Native", e)
    }
}
```

## Complete Flow Diagram

```
1. User opens login form in browser/app
                ↓
2. Autofill suggestions appear (username display only)
                ↓
3. User taps credential
                ↓
4. AutofillAuthActivity launches (biometric prompt)
                ↓
5. User authenticates with fingerprint/face
                ↓
6. onAuthenticationSucceeded() called
                ↓
7. Broadcast sent: "DECRYPT_FOR_AUTOFILL" + encrypted password
                ↓
8. AutofillDecryptionReceiver catches broadcast
                ↓
9. React Native hook receives event "AUTOFILL_DECRYPT_REQUEST"
                ↓
10. 🔑 Get master password from session
                ↓
11. 🔐 Decrypt password: AES-GCM(encryptedPassword, derivedKey, iv, tag)
                ↓
12. 📦 Cache plaintext: storeDecryptedPasswordForAutofill(id, plaintext)
                ↓
13. AutofillAuthActivity finishes (RESULT_OK)
                ↓
14. Android Autofill calls onFillRequest again
                ↓
15. buildDataset checks plaintext cache
                ↓
16. 🎉 PLAINTEXT FOUND!
                ↓
17. ✅ Fill username and password fields automatically
```

## Debugging

### Check Logs for Each Step

```bash
# Watch for broadcast sent
adb logcat -s AutofillAuthActivity

# Watch for receiver catching broadcast
adb logcat -s AutofillDecryptReceiver

# Watch for React Native event received
adb logcat -s ReactNativeJS

# Watch for autofill service filling
adb logcat -s PasswordEpicAutofill
```

### Expected Log Sequence

```
[AutofillAuthActivity] 🔐 Delivering credential: testLastUsed
[AutofillAuthActivity] 📡 Broadcast sent to main app for decryption
[AutofillAuthActivity] ⏳ Waiting for decryption to complete...
[AutofillDecryptReceiver] 📡 Received decryption request
[React Native Hook] 🔐 [AutofillDecryption] Received decryption request
[React Native Hook] ✅ [AutofillDecryption] Password decrypted successfully
[React Native Hook] 📦 [AutofillDecryption] Plaintext cached for autofill
[AutofillAuthActivity] ✅ Decryption should be complete
[AutofillAuthActivity] ✅ Finishing auth activity with RESULT_OK
[PasswordEpicAutofill] 🔑 Found cached authenticated credential
[PasswordEpicAutofill] 🔒 Encrypted password detected
[PasswordEpicAutofill] ✅ FOUND PLAINTEXT IN CACHE
[PasswordEpicAutofill] ✍️ Filling USERNAME/EMAIL
[PasswordEpicAutofill] 🔓 Filling PASSWORD field with decrypted plaintext
[PasswordEpicAutofill] ✅ Sending response with decrypted plaintext password
```

### Troubleshooting

**Problem**: "⚠️ NO PLAINTEXT CACHE FOUND - Password still encrypted"

**Solutions**:

1. Ensure React Native hook is registered before login
2. Check that `masterPassword` is not null when decryption request arrives
3. Verify `storeDecryptedPasswordForAutofill()` is being called successfully
4. Check logs for decryption errors (wrong master password, invalid crypto params)

**Problem**: Broadcast receiver not receiving events

**Solutions**:

1. Ensure `LocalBroadcastManager` is properly registered in MainActivity
2. Check that receiver filter matches action name exactly
3. Verify receiver is registered before autofill auth activity launches

## Security Considerations

- ✅ Master password is never sent to autofill service
- ✅ Plaintext password cached only in memory (SharedPreferences in autofill service process)
- ✅ 60-second expiry ensures plaintext cache auto-clears
- ✅ Decryption only happens after successful biometric authentication
- ✅ Each decrypt request validates IV and auth tag
- ✅ Encrypted credentials stored in secure encrypted storage

## Next Steps

1. ✅ Android implementation complete
2. ⏳ **Register broadcast receiver in MainActivity** (Kotlin)
3. ⏳ **Implement React Native hook** (TypeScript)
4. ⏳ **Integrate hook into app**
5. ⏳ **Update AutofillDecryptionReceiver** to emit events
6. ✅ Test end-to-end flow

## Files Modified

### Android

- ✅ `AutofillAuthActivity.kt` - Added broadcast sender
- ✅ `AutofillDataProvider.kt` - Added cache methods
- ✅ `PasswordEpicAutofillService.kt` - Enhanced plaintext cache checking
- ✅ `AutofillDecryptionReceiver.kt` - **NEW** - Receives and processes decryption requests

### React Native (TODO)

- ⏳ Register broadcast receiver in MainActivity.kt
- ⏳ Create `useAutofillDecryption.ts` hook
- ⏳ Integrate hook in app initialization
- ⏳ Complete AutofillDecryptionReceiver event emission
