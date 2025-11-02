# Firebase Setup Guide - SHA-1 Management

## 📋 Overview

This project uses different SHA-1 certificates for **DEBUG** and **RELEASE** builds:

- **DEBUG SHA-1**: `ee7b8c2102d996cf5497cd4c2b85099f7fa3372f` (from `debug_new.keystore`)
- **RELEASE SHA-1**: `ee91ac196011defcd043ed5be480ff6389bd6cdf` (production)

The `google-services.json` file is **NOT committed** to Git (see `.gitignore`) because it's environment-specific.

---

## 🚀 Quick Start

### For DEBUG Build (Development)

```bash
npm run build:debug
```

This will:

1. Update `google-services.json` with DEBUG SHA-1
2. Build and run the app on Android

### For RELEASE Build (Production)

```bash
npm run build:release
```

This will:

1. Update `google-services.json` with RELEASE SHA-1
2. Ready for signing and release

---

## 📝 Manual Commands

### Update Firebase Config

```bash
# Switch to DEBUG mode
npm run update:firebase:debug

# Switch to RELEASE mode
npm run update:firebase:release
```

Then build:

```bash
# Build & run
npm run android

# Or directly with gradle
cd android && ./gradlew app:installDebug
```

---

## 🔧 Setup Instructions (First Time)

### 1. Download `google-services.json`

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **PasswordEpic**
3. Go to **Project Settings** → **General**
4. Find Android app `com.passwordepic.mobile`
5. Download `google-services.json`
6. Place it at: `android/app/google-services.json`

### 2. Verify SHA-1 Certificates

Get SHA-1 from debug keystore:

```bash
keytool -list -v -keystore "android/app/debug_new.keystore" -alias androiddebugkey -storepass android
```

Should output: `EE:7B:8C:21:02:D9:96:CF:54:97:CD:4C:2B:85:09:9F:7F:A3:37:2F`

### 3. Create OAuth Clients in Google Cloud

#### For Debug:

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- APIs & Services → **Credentials**
- Create **OAuth 2.0 Client ID** (Android)
  - Package name: `com.passwordepic.mobile`
  - SHA-1: `EE:7B:8C:21:02:D9:96:CF:54:97:CD:4C:2B:85:09:9F:7F:A3:37:2F`

#### For Release:

- Create another Android Client
  - Package name: `com.passwordepic.mobile`
  - SHA-1: (your release keystore SHA-1)

---

## 📂 File Structure

```
PasswordEpic/
├── .gitignore                           # google-services.json is ignored
├── android/app/
│   ├── google-services.json            # ⚠️ NOT committed (local only)
│   ├── google-services.json.example    # Template for reference
│   ├── debug_new.keystore              # DEBUG certificate
│   └── release.keystore                # RELEASE certificate
├── update-google-services-debug.js     # Script to switch to DEBUG
├── update-google-services-release.js   # Script to switch to RELEASE
└── package.json                         # npm scripts defined
```

---

## ✅ Verification

### Check current SHA-1 in google-services.json:

```bash
# On Windows (PowerShell)
(Get-Content "android/app/google-services.json" | ConvertFrom-Json).client[0].oauth_client[0].android_info.certificate_hash

# On Mac/Linux
cat android/app/google-services.json | jq '.client[0].oauth_client[0].android_info.certificate_hash'
```

Should be:

- DEBUG: `ee7b8c2102d996cf5497cd4c2b85099f7fa3372f`
- RELEASE: `ee91ac196011defcd043ed5be480ff6389bd6cdf`

---

## 🐛 Troubleshooting

### Error: "google-services.json not found"

→ Download it from Firebase Console (see Setup Instructions above)

### Error: "Invalid SHA-1"

→ Verify the keystore:

```bash
keytool -list -v -keystore "android/app/debug_new.keystore" -alias androiddebugkey -storepass android
```

### Build fails after updating SHA-1

→ Clean gradle cache:

```bash
cd android && ./gradlew clean && cd ..
npm run build:debug
```

### Firebase Sign-In not working

→ Make sure:

1. SHA-1 matches keystore ✓
2. Ran `npm run update:firebase:debug` ✓
3. Waited 5 minutes for Google to propagate ✓
4. Cleared app cache: `npm run clear-app`

---

## 📚 Related Files

- **SHA-1 Cert**: `android/app/debug_new.keystore`
- **Build Config**: `android/app/build.gradle`
- **Google Services Config**: `android/app/google-services.json`

---

## 🔑 Key Points

- ✅ Always run `npm run build:debug` (not just `npm run android`)
- ✅ Check SHA-1 when switching keystores
- ✅ Never commit `google-services.json` (it's in `.gitignore`)
- ✅ Use `update-google-services-*.js` scripts to manage SHA-1
