# ⚡ Autofill Quick Test Guide

## What Was Fixed?

**Problem:** After biometric auth, password fields were NOT auto-filled (stayed empty)
**Root Cause:** No plaintext password cache after authentication  
**Solution:** Complete decryption bridge from Android → React Native → Autofill Service

---

## Quick Build & Test

### 1. Clean rebuild:

```bash
cd e:\IT\Mobile\PasswordEpic\android
gradlew.bat clean
cd ..
npm run android
```

### 2. Open logs:

```bash
adb logcat -s "useAutofillDecryption|AutofillBridge|AutofillAuthActivity|AutofillDecryptionReceiver"
```

### 3. Test flow:

- Open HSL app (or any login form)
- Tap username field → Autofill dropdown
- Tap credential → Biometric prompt
- Authenticate → **Fields should auto-fill** ✅

---

## What Changed?

### Android Files:

| File                            | What                      | Why                          |
| ------------------------------- | ------------------------- | ---------------------------- |
| `MainActivity.kt`               | Registered receiver       | Listen for decrypt requests  |
| `AutofillBridge.kt`             | Added 2 methods           | Cache password + emit events |
| `AutofillDecryptionReceiver.kt` | Emit to React Native      | Bridge to JS decryption      |
| `build.gradle`                  | LocalBroadcastManager dep | For inter-process comms      |

### React Native Files:

| File                       | What                   | Why                          |
| -------------------------- | ---------------------- | ---------------------------- |
| `useAutofillDecryption.ts` | **NEW** - Decrypt hook | Listen & decrypt password    |
| `App.tsx`                  | Added listener         | Initialize hook on app start |

---

## Success Indicators (In Logs)

### ✅ Good Signs:

```
D AutofillAuthActivity: 🔐 Delivering credential
D AutofillAuthActivity: 📡 Broadcast sent
D AutofillDecryptionReceiver: 📤 Emitting AUTOFILL_DECRYPT_REQUEST
D AutofillBridge: 📤 Emitting decryption request
I ReactNativeJS: 🔐 Received decryption request
I ReactNativeJS: ✅ Password decrypted successfully
D AutofillBridge: 🔐 Storing decrypted password
D AutofillDataProvider: ✅ Found cached plaintext password
```

### ❌ Problem Signs:

```
⚠️ No cached plaintext password  → React Native didn't cache
❌ Could not cast to MainApplication  → MainApplication not initialized
📭 ReactContext not available  → App not ready
Error during decryption  → Master password issue or wrong salt
```

---

## If Still Not Working

### Issue: Fields empty after auth

**Check:** Master password available in Redux

```bash
adb logcat | grep "masterPassword"
```

### Issue: Auth succeeds but no decrypt request

**Check:** Receiver registered

```bash
adb logcat | grep "AutofillDecryptionReceiver"
```

### Issue: Decrypt request received but fails

**Check:** Master password + crypto keys valid

```bash
adb logcat | grep "deriveKey\|decrypt"
```

---

## Expected Behavior

**Before Fix:**

```
1. Autofill dropdown ✅
2. Biometric auth ✅
3. Fields empty ❌
```

**After Fix:**

```
1. Autofill dropdown ✅
2. Biometric auth ✅
3. Fields auto-filled ✅
4. User sees both username & password
```

---

## Key Files to Monitor

1. **`useAutofillDecryption.ts`** - The decryption logic
2. **`MainActivity.kt`** - Receiver registration
3. **`AutofillBridge.kt`** - Cache storage + event emission
4. **`AutofillAuthActivity.kt`** - Broadcast sender (already working)
5. **`AutofillDecryptionReceiver.kt`** - Broadcast receiver (event bridge)

All are now implemented! Build and test. 🚀
