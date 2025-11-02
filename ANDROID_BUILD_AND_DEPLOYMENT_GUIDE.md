# 🚀 Android Build & Deployment Guide - PasswordEpic

**Complete workflow for building, signing, and deploying PasswordEpic to Google Play Store**

---

## 📋 Table of Contents

1. [Step 1: Setup Firebase & Google Cloud](#step-1-setup-firebase--google-cloud)
2. [Step 2: Build Release AAB](#step-2-build-release-aab)
3. [Step 3: Upload to Play Console](#step-3-upload-to-play-console)
4. [Step 4: Deploy to Internal Testing](#step-4-deploy-to-internal-testing)
5. [Troubleshooting](#troubleshooting)

---

## Step 1: Setup Firebase & Google Cloud

### 1️⃣ Get SHA Fingerprint from Google Play Console

```
Google Play Console
  ↓
Your App → Release → Setup → App Signing
  ↓
Copy: SHA-256 certificate fingerprint (App signing key)
```

### 2️⃣ Add to Google Cloud OAuth 2.0

```
Google Cloud Console
  ↓
Credentials → OAuth 2.0 Client IDs
  ↓
Android → SHA-256 certificate fingerprints
  ↓
Paste SHA-256 from Step 1
```

✅ **Result**: Play Integrity API will work

### 3️⃣ Add to Firebase Console

```
Firebase Console
  ↓
Project Settings → Your Apps → Android
  ↓
App fingerprints → Add
  ↓
Paste SHA-256 from Step 1
```

✅ **Status**: If you already did this → **Skip to Step 2** ✨

---

## Step 2: Build Release AAB

### ⚠️ PRE-BUILD: Kill Running Tasks

**CRITICAL**: Stop all processes before building to avoid build conflicts:

```powershell
# Kill ADB connections
taskkill /IM adb.exe /F

# Kill Node.js processes (Metro bundler)
taskkill /IM node.exe /F

# Verify all killed
Get-Process adb, node -ErrorAction SilentlyContinue
```

Why? Metro and ADB can lock files, causing build failures.

### 🔧 Quick Command (Fastest)

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew clean bundleRelease
```

**Output**:

```
✅ e:\IT\Mobile\PasswordEpic\android\app\build\outputs\bundle\release\app-release.aab
```

### 📊 Build Process Flow

```
Step 2.0: Kill tasks (critical!)
  ↓
  taskkill /IM adb.exe /F
  taskkill /IM node.exe /F

Step 2.1: Clean build cache
  ↓
  .\gradlew clean

Step 2.2: Build release AAB
  ↓
  .\gradlew bundleRelease

Step 2.3: Sign with your release keystore
  ↓
  App.aab signed ✅

Step 2.4: Find output file
  ↓
  app/build/outputs/bundle/release/app-release.aab
```

### ⚙️ If Build Fails

```powershell
# 1. Verify Gradle version
.\gradlew --version

# 2. Check Java is installed
Get-Command java

# 3. Increase Gradle memory
# Edit: e:\IT\Mobile\PasswordEpic\android\gradle.properties
# Add/Update:
# org.gradle.jvmargs=-Xmx4096m
# org.gradle.daemon=true
# org.gradle.parallel=true

# 4. Try clean build again
.\gradlew clean bundleRelease
```

---

## Step 3: Upload to Play Console

### 📤 Upload AAB File

```
1. Go to: Google Play Console → Your App
2. Click: Release → Internal Testing
3. Click: Create new release
4. Upload: app-release.aab (from Step 2)
5. Add: Release notes
6. Click: Review release
```

### 🔄 What Happens Automatically

```
You upload AAB (signed with your keystore)
  ↓
Google Play Console receives it
  ↓
Google strips your signature
  ↓
Google signs with their App signing key
  ↓
Device receives app with Google's signature (SHA-256)
  ↓
Firebase verifies using SHA-256 from Step 1 ✅
```

**Result**: No manual SHA input needed! Google handles it automatically.

---

## Step 4: Deploy to Internal Testing

### 🎯 Release to Testers

```
1. Google Play Console → Internal Testing
2. Click: Release to testers
3. Select: Testers (add test accounts)
4. Send: Link to testers
5. Testers install from Play Console link
```

### 📱 Testing Checklist

- [ ] App installs successfully
- [ ] App launches without crashes
- [ ] Biometric authentication works
- [ ] Firebase initialization succeeds
- [ ] Play Integrity API responds correctly
- [ ] All features function normally

---

## Troubleshooting

### ❌ Build Fails: "Module not found"

**Solution**:

```powershell
# Sync Gradle
Set-Location "e:\IT\Mobile\PasswordEpic"
npm install
npm start -- --reset-cache
```

### ❌ Upload Fails: "APK signature invalid"

**This is OK!** Google Play Console expects this. The error resolves when you:

- Use the correct keystore password
- Upload full AAB (not split APK)
- AAB is from `bundleRelease` (not `assembleRelease`)

### ❌ Firebase Not Initializing

**Check**:

1. SHA-256 is in Firebase Console ✅
2. google-services.json has latest version
3. App was signed with correct keystore

**Fix**:

```powershell
# Rebuild with latest google-services.json Increase Version into build/gradle
Set-Location "e:\IT\Mobile\PasswordEpic\android"
# kill all task before build
taskkill /IM adb.exe /F
taskkill /IM node.exe /F
.\gradlew clean bundleRelease
```

### ❌ Play Integrity API Failing

**Verify**:

1. SHA-256 in Google Cloud OAuth 2.0 ✅
2. Play Integrity API enabled in Google Cloud
3. App ID in code matches package name

**Check**:

```powershell
# View signing report to verify keystore
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew signingReport
```

---

## 📋 SHA Fingerprint Types & Locations

| Service                    | SHA Type        | Source                                | Purpose                           | When Needed            |
| -------------------------- | --------------- | ------------------------------------- | --------------------------------- | ---------------------- |
| **Play Integrity API**     | SHA-256         | Google Play Console (App signing key) | Verify app authenticity on device | ✅ **REQUIRED**        |
| **Google Cloud OAuth 2.0** | SHA-256         | Google Play Console                   | Authenticate via Play Integrity   | ✅ **REQUIRED**        |
| **Firebase Console**       | SHA-1 + SHA-256 | Google Play Console                   | Sign-in methods & Dynamic Links   | ✅ **For Production**  |
| **google-services.json**   | SHA-1           | Debug keystore (auto-added)           | Development/testing only          | ✅ **Auto-configured** |

### ✨ Key Points:

- **Development**: SHA-1 from debug keystore (automatic)
- **Production**: SHA-256 from Google Play Console (manual add)
- **Never use**: SHA from personal release keystore for production
- **Google handles**: Re-signing when you upload AAB

---

## 🎯 Quick Reference

| Step      | Command                   | Output            |
| --------- | ------------------------- | ----------------- |
| 1️⃣ Clean  | `.\gradlew clean`         | Cache cleared     |
| 2️⃣ Build  | `.\gradlew bundleRelease` | app-release.aab   |
| 3️⃣ Upload | Via Play Console UI       | Pending review    |
| 4️⃣ Test   | Share internal test link  | Ready for testing |

---

## ✨ Complete Workflow Summary

```
┌─────────────────────────────────────────────┐
│ Step 1: Setup Firebase & Google Cloud       │
│ (SHA-256 fingerprints configured)           │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ Step 2: Build Release AAB                   │
│ (.\gradlew bundleRelease)                   │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ Step 3: Upload to Play Console              │
│ (Google re-signs automatically)             │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ Step 4: Deploy to Internal Testing          │
│ (Testers can install & test)                │
└──────────────────┬──────────────────────────┘
                   ↓
              ✅ READY FOR
          PRODUCTION DEPLOYMENT
```

---

## 📞 Need Help?

Check the relevant troubleshooting section or review Step 1-4 for any missed configuration.
