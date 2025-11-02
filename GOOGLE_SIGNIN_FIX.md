# Google Sign-In Fix - Complete Guide

## 🔍 Problem Identified

**Root Cause**: SHA-1 Certificate fingerprint mismatch between keystores and Firebase Console

### Issues Found:

1. ❌ `build.gradle` was using **release.keystore** for BOTH debug and release builds
2. ❌ `release.keystore` SHA-1 didn't match Firebase Console configuration
3. ❌ `npm scripts` were incomplete for full release builds

---

## ✅ Fixes Applied

### 1. Fixed `android/app/build.gradle`

**Before:**

```gradle
debug {
    storeFile file('release.keystore')  // ❌ WRONG!
}
```

**After:**

```gradle
debug {
    storeFile file('debug_new.keystore')  // ✅ Correct
    storePassword 'android'
    keyAlias 'androiddebugkey'
    keyPassword 'android'
}
```

### 2. Updated `update-google-services-release.js`

Changed SHA-1 from outdated Google Play value to actual keystore:

```javascript
const RELEASE_SHA1 = 'a304d812af40e84020de91fe873331ae671b59e0'; // ✅ From keytool
```

### 3. Created npm scripts in `package.json`

| Script                      | Purpose                        | When to Use                |
| --------------------------- | ------------------------------ | -------------------------- |
| `npm run android:debug`     | Build + install for testing    | 🧪 Testing on device       |
| `npm run android:release`   | Update SHA-1 for release build | 📋 Prepare for build       |
| `npm run android:build-apk` | Build release APK              | 📦 For direct distribution |
| `npm run android:build-aab` | Build release AAB              | 📱 For Google Play Store   |

---

## 📝 Certificate Fingerprints (SHA-1)

### Debug Keystore (`debug_new.keystore`)

```
SHA-1: EE:7B:8C:21:02:D9:96:CF:54:97:CD:4C:2B:85:09:9F:7F:A3:37:2F
Hex:   ee7b8c2102d996cf5497cd4c2b85099f7fa3372f
```

### Release Keystore (`release.keystore`)

```
SHA-1: A3:04:D8:12:AF:40:E8:40:20:DE:91:FE:87:73:31:AE:67:1B:59:E0
Hex:   a304d812af40e84020de91fe873331ae671b59e0
```

---

## ⚠️ Next Step: Update Firebase Console

You MUST add BOTH SHA-1 fingerprints in Firebase Console:

### Steps:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select "PasswordEpic" project
3. Go to **Project Settings** → **Your Apps** → Android app
4. Find **SHA certificate fingerprints** section
5. **Add BOTH:**
   - `ee7b8c2102d996cf5497cd4c2b85099f7fa3372f` (Debug)
   - `a304d812af40e84020de91fe873331ae671b59e0` (Release)
6. Click **Save**

### Or via Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select "PasswordEpic" project
3. Go to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID (Android)**
5. Edit and add both SHA-1 fingerprints

---

## 🚀 Now Ready to Test

### For Debug Testing:

```bash
npm run android:debug
```

- Updates SHA-1 for debug
- Builds APK
- Installs on device/emulator
- Ready to test Google Sign-In

### For Release Builds:

```bash
npm run android:release
npm run android:build-aab
```

- First command: Updates SHA-1 for release
- Second command: Builds AAB for Google Play

---

## ✔️ Verification Checklist

- [ ] Firebase Console has BOTH debug + release SHA-1 fingerprints added
- [ ] Run `npm run android:debug` and test Google Sign-In
- [ ] Verify no "non-recoverable sign in failure" error
- [ ] Test with biometric auth enabled
- [ ] Test autofill with Google Sign-In credentials

---

## 📊 Files Modified

```
✅ android/app/build.gradle               (Fixed keystore config)
✅ update-google-services-release.js       (Fixed SHA-1)
✅ package.json                            (Added npm scripts)
```

---

## 🔗 Related Documentation

- [Google Sign-In Android Setup](https://developers.google.com/identity/sign-in/android/start-integrating)
- [Firebase Console](https://console.firebase.google.com)
- [React Native Google Sign-In](https://github.com/react-native-google-signin/google-signin)
