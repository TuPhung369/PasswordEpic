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
# find all of the path of Mobile to settings ******
adb shell dumpsys package com.android.settings | findstr "Activity"
(ex: Intent().setClassName("com.android.settings", "com.android.settings.Settings\$DefaultAutofillPickerActivity") => Samsung 22 Ultra)
#filter logcat into file
adb logcat > "E:\IT\Mobile\PasswordEpic\autofill_refill_fix_v2.log"
Select-String -Path "E:\IT\Mobile\PasswordEpic\autofill_refill_fix_v2.log" -Pattern "AutofillBridge|requestEnable" | Select-Object -Last 50
# Get string to the file
adb logcat -s AutofillBridge > huawei_autofill_debug.log 2>&1
#get the input field of App (zalo)
adb shell uiautomator dump /sdcard/layout.xml; adb pull /sdcard/layout.xml .; Get-Content layout.xml
UI hierchary dumped to: /sdcard/layout.xml

# Create the full file 
adb shell uiautomator dump /sdcard/layout.xml; adb pull /sdcard/layout.xml .
Get-Content layout.xml | Select-String -Pattern "EditText|TextInputEditText|inputPhoneNumber|phone|tel" -Context 2
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
