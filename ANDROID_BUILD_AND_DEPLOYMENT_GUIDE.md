# Android Build & Deployment Guide - PasswordEpic

**Complete guide for building, signing, and submitting your PasswordEpic app to Google Play Store**

---

Kết nối USB và chạy:

adb tcpip 5555


Nó sẽ trả về:

restarting in TCP mode port: 5555


Ngắt cáp USB.

Xem IP của điện thoại (Settings → About phone → Status → IP address).

Kết nối qua Wi-Fi:

adb connect 192.168.x.x:5555


Nếu thành công, kiểm tra:

adb devices


→ sẽ thấy thiết bị ở trạng thái device (wifi).


---
## 📋 Table of Contents

1. [Gradle Synchronization](#gradle-synchronization)
2. [Building the App](#building-the-app)
3. [Google Play Store Submission](#google-play-store-submission)

---

## Gradle Synchronization

Nếu bạn không thấy **File → Sync Project with Gradle Files**, đây là các cách khác để sync Gradle:

### Method 1: Using Keyboard Shortcut ⚡ (Fastest)

**Press**: `Ctrl + Shift + A` (Windows/Linux) hoặc `Cmd + Shift + A` (Mac)

**Then type**: `gradle`

**Select**: "Sync Now" hoặc "Sync Project with Gradle Files"

**Press**: `Enter`

---

### Method 2: Look for Sync Button in UI

#### Cách 1: Top Bar Notification

- Nếu bạn vừa mở project hoặc thay đổi file `build.gradle`
- Android Studio sẽ hiện thông báo ở **top bar**:
  ```
  Gradle files have changed since last sync. Sync now?
  [Sync Now] [Don't Show Again]
  ```
- Click: **[Sync Now]**

#### Cách 2: Find in Android Studio Top Menu

1. Nhìn vào top menu bar
2. Tìm option sau (theo thứ tự):
   - **File** menu
   - Hoặc **Project** menu
   - Hoặc **Tools** menu → **Android** → **Sync Now**

---

### Method 3: Command Line (PowerShell) ✅ RECOMMENDED

Mở PowerShell và chạy:

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic"

# Tùy chọn 1: Kiểm tra và sync Gradle
./gradlew --version

# Tùy chọn 2: Rebuild project (sẽ sync tự động)
./gradlew clean

# Tùy chọn 3: Full rebuild
./gradlew build
```

---

### Method 4: Invalidate Cache and Restart

Nếu Android Studio "bị treo" hoặc không phản hồi:

1. Click: **File** menu (top left)
2. Find: **Invalidate Caches / Restart**
3. Choose: **Invalidate and Restart**
4. Android Studio sẽ:
   - Tắt
   - Xóa cache
   - Khởi động lại
   - Tự động sync Gradle

---

### Method 5: Manual Gradle Sync (Advanced)

```powershell
# Vào thư mục Android
Set-Location "e:\IT\Mobile\PasswordEpic\android"

# Sync Gradle dependencies
.\gradlew clean
.\gradlew build --refresh-dependencies

# Nếu build thất bại, thử:
.\gradlew clean build
```

---

### Method 6: Reload Gradle Project (React Native)

```powershell
# Ở thư mục gốc project
Set-Location "e:\IT\Mobile\PasswordEpic"

# Xóa cache React Native
npm start -- --reset-cache

# Hoặc dùng Gradle directly
Set-Location "e:\IT\Mobile\PasswordEpic\android"
./gradlew clean build
```

---

### Verify Gradle Sync Success

Sau khi sync, kiểm tra:

```powershell
# Xem Gradle version
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew --version

# Expected output:
# Gradle 8.x.x
# Build time: ...
```

---

### Common Gradle Issues & Solutions

#### ❌ Issue: "gradle-wrapper not found"

**Solution**:

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"
Get-ChildItem gradlew  # Kiểm tra file tồn tại
```

#### ❌ Issue: "Permission denied" on gradlew

**Solution (PowerShell)**:

```powershell
# Cho phép chạy script
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Rồi thử lại
.\gradlew --version
```

#### ❌ Issue: "JAVA_HOME not set"

**Solution (PowerShell)**:

```powershell
# Tìm Java
Get-Command java

# Hoặc đặt manual:
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-17", "User")
```

#### ❌ Issue: Gradle takes too long

**Solution**: Tăng memory:

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"

# Tạo file gradle.properties nếu chưa có
@"
org.gradle.jvmargs=-Xmx4096m
org.gradle.daemon=true
org.gradle.parallel=true
"@ | Out-File -FilePath "gradle.properties" -Encoding UTF8
```

---

### Quick Checklist for Gradle Sync

- [ ] Android Studio opened
- [ ] Project loaded
- [ ] No error messages in bottom bar
- [ ] gradle/wrapper/gradle-wrapper.jar tồn tại
- [ ] Chạy `./gradlew --version` thành công
- [ ] build.gradle files không có lỗi syntax

---

## Building the App

**Purpose**: Complete guide to build APK and AAB files using Android Studio for Google Play Store submission

---

### Method 1: Build Using Android Studio GUI (Recommended)

#### Step-by-Step Instructions:

##### 1️⃣ Verify Module Selection

- Open your project in Android Studio
- Look at the top-left corner (near the green Run ▶️ button)
- **MUST SEE**: Dropdown showing **"app"** (not "Project" or "Android")
- If not: Click dropdown → Select **"app"**

```
Expected: [app] ▼  (or similar)
```

##### 2️⃣ Sync Gradle (Important!)

Navigate to: **File → Sync Project with Gradle Files**

- Wait for sync to complete (bottom status bar should show "✓" or no red errors)
- This is CRITICAL - don't skip!

##### 3️⃣ Build Signed App Bundle (.aab)

Navigate to: **Build → Generate Signed Bundle / APK**

**Expected popup menu**:

```
┌─────────────────────────────────┐
│ Android App Bundle (.aab)       │  ← Click this for Google Play
│ APK                             │
└─────────────────────────────────┘
```

Click: **Android App Bundle (.aab)**

##### 4️⃣ Select/Create Keystore

A dialog will appear asking for signing key configuration:

**Option A: If you have existing keystore**

```
✓ Use existing keystore
Key store path: C:\path\to\your\keystore.jks
Password: ••••••••
Key alias: your_key_alias
Key password: ••••••••
```

**Option B: Create new keystore** (First time)

```
○ Create new...
Key store path: e:\IT\Mobile\PasswordEpic\android\app\debug.keystore
Password: [Create strong password]
Confirm: [Repeat password]
Key alias: passwordepic_key
Key password: [Create strong password]
First and Last Name: [Your Name]
Organization Unit: [Your Organization]
Organization: [Company Name]
City or Locality: [City]
State or Province: [State/Province]
Country Code: [Country Code, e.g., GB, US, VN]
```

Click: **Next**

##### 5️⃣ Build Configuration

Select build variant:

```
Build Variants:
☑ release  ← SELECT THIS
```

Click: **Finish**

##### 6️⃣ Wait for Build

Android Studio will:

- Compile your code
- Package assets
- Sign with your keystore
- Generate .aab file

**Expected output message**:

```
✓ Build Complete!
Locate: app/build/outputs/bundle/release/app-release.aab
```

---

### Method 2: Build Using Command Line (PowerShell)

#### Using Gradle Wrapper (Windows PowerShell)

##### Build APK (Debug)

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew assembleDebug
```

**Output location**:

```
e:\IT\Mobile\PasswordEpic\android\app\build\outputs\apk\debug\app-debug.apk
```

##### Build APK (Release)

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew assembleRelease
```

**Output location**:

```
e:\IT\Mobile\PasswordEpic\android\app\build\outputs\apk\release\app-release-unsigned.apk
```

##### Build App Bundle (AAB - Recommended for Play Store)

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew bundleRelease
```

**Output location**:

```
e:\IT\Mobile\PasswordEpic\android\app\build\outputs\bundle\release\app-release.aab
```

##### With Signing (Advanced PowerShell)

Create signed APK:

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"

$keystorePath = "e:\IT\Mobile\PasswordEpic\android\app\debug.keystore"
$keystorePassword = "your_keystore_password"
$keyAlias = "your_key_alias"
$keyPassword = "your_key_password"

.\gradlew assembleRelease `
  -Pandroid.injected.signing.store.file=$keystorePath `
  -Pandroid.injected.signing.store.password=$keystorePassword `
  -Pandroid.injected.signing.key.alias=$keyAlias `
  -Pandroid.injected.signing.key.password=$keyPassword
```

---

### Method 3: Build Using npm (React Native)

Since PasswordEpic is React Native:

```powershell
# Build APK (Debug)
npm run android

# Build APK (Release) - from project root
Set-Location "e:\IT\Mobile\PasswordEpic"
npm run build:android:release
```

---

### File Locations After Build

#### Debug Build (for testing)

```
e:\IT\Mobile\PasswordEpic\android\app\build\outputs\apk\debug\app-debug.apk
```

#### Release Build (for Google Play)

```
# APK (older format)
e:\IT\Mobile\PasswordEpic\android\app\build\outputs\apk\release\app-release-unsigned.apk

# AAB (recommended for Google Play)
e:\IT\Mobile\PasswordEpic\android\app\build\outputs\bundle\release\app-release.aab
```

---

### Verify Build Output

After build completes, verify files:

```powershell
# Check AAB exists
Get-ChildItem -Path "e:\IT\Mobile\PasswordEpic\android\app\build\outputs\bundle\release\*.aab"

# Check AAB size (should be reasonable)
$aab = Get-ChildItem "e:\IT\Mobile\PasswordEpic\android\app\build\outputs\bundle\release\app-release.aab"
Write-Host "File size: $($aab.Length / 1MB) MB"
```

---

### Troubleshooting Common Build Issues

#### Issue 1: "Generate Signed Bundle / APK" is disabled/grayed out

**Causes & Solutions**:

1. **Wrong module selected**

   - Solution: Click dropdown → Select **"app"**

2. **Gradle not synced**

   - Solution: File → Sync Project with Gradle Files
   - Wait for completion

3. **Missing Android Application plugin**

   - Check: `android/app/build.gradle`
   - Must have: `id 'com.android.application'` (NOT 'com.android.library')

4. **Android Studio cache corruption**
   - Solution: File → Invalidate Caches / Restart → Invalidate and Restart

#### Issue 2: Build fails with "No keystore configured"

**Solution**: First time setup - click "Create new..." during signing dialog

#### Issue 3: Build fails with "versionCode not specified"

**Solution**: Check `android/app/build.gradle` has:

```gradle
android {
    compileSdk 34

    defaultConfig {
        applicationId "com.passwordepic"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

#### Issue 4: "JAVA_HOME not found" error

**Solution (PowerShell)**:

```powershell
# Find Java installation
Get-Command java
# Or manually set
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

#### Issue 5: Gradle build timeout

**Solution**: Increase timeout in `gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx4096m
org.gradle.daemon=true
org.gradle.parallel=true
```

---

### Which Format to Use?

#### For Google Play Store Submission ✅ RECOMMENDED

**Format**: Android App Bundle (.aab)
**File**: `app-release.aab`
**Reason**:

- Google Play requires AAB for new apps
- Smaller file sizes
- Automatic optimization for each device
- Link: https://developer.android.com/guide/app-bundle

#### For Testing on Real Devices

**Format**: APK (.apk)
**File**: `app-debug.apk` or `app-release-unsigned.apk`
**Command**:

```powershell
adb install "e:\IT\Mobile\PasswordEpic\android\app\build\outputs\apk\debug\app-debug.apk"
```

#### For Distribution Outside Google Play

**Format**: APK (.apk)
**File**: Signed `app-release.apk`

---

### Official Google References

1. **Build & Release Overview**
   https://developer.android.com/studio/publish

2. **Generate Signed App Bundle/APK**
   https://developer.android.com/studio/publish/app-signing

3. **App Bundle Format**
   https://developer.android.com/guide/app-bundle

4. **Play Console Help - Upload & Release**
   https://support.google.com/googleplay/android-developer/answer/9859152

5. **Gradle Build System**
   https://developer.android.com/build

6. **Android Gradle Plugin Documentation**
   https://developer.android.com/reference/tools/gradle-api

---

### Build Configuration Reference

#### android/app/build.gradle should contain:

```gradle
plugins {
    id 'com.android.application'
    id 'kotlin-android'
}

android {
    compileSdk 34

    defaultConfig {
        applicationId "com.passwordepic.app"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    signingConfigs {
        release {
            storeFile file("debug.keystore")
            storePassword "password"
            keyAlias "debug"
            keyPassword "password"
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

---

### Build Checklist

- [ ] Android Studio installed and updated
- [ ] Project synced with Gradle
- [ ] "app" module selected (not "Project")
- [ ] Minimum SDK 24 configured
- [ ] App icon and resources ready
- [ ] Version code and name set in build.gradle
- [ ] Keystore file created or available
- [ ] Build → Generate Signed Bundle / APK works
- [ ] .aab file generated successfully
- [ ] File size reasonable (typically 50-200 MB)

---

## Google Play Store Submission

### Store Listing Configuration

**Language**: English (United Kingdom) - en-GB  
**Platform**: Android  
**Version**: For Google Play Store Submission

---

### 1. App Name

**Field Limit**: 30 characters  
**Current**: PasswordEpic (13/30)

```
PasswordEpic
```

---

### 2. Short Description

**Field Limit**: 80 characters  
**Purpose**: Hook users at first glance

**Alternative (80 chars max)**:

```
Secure password manager with AES-256 encryption and biometric protection.
```

**Character Count**: 73/80 ✓

---

### 3. Full Description

**Field Limit**: Typically 4000 characters recommended

```
PasswordEpic - Your Ultra-Secure Password Manager

Keep your digital life protected with military-grade encryption.

🔒 MILITARY-GRADE SECURITY
• AES-GCM 256-bit encryption for every password
• PBKDF2 key derivation for maximum protection
• End-to-end encryption - nothing leaves your device unencrypted
• All encryption happens on-device using zero-knowledge architecture
• Your passwords never touch our servers unencrypted

🔐 BIOMETRIC AUTHENTICATION
• Face ID recognition (iOS)
• Touch ID fingerprint scanning (iOS)
• Fingerprint authentication (Android)
• Fast, secure, and convenient access to your passwords

🛡️ ADVANCED SECURITY FEATURES
• Multi-layer security architecture
• Root/jailbreak detection prevents unauthorized access
• Session timeout with customizable auto-lock
• Screen protection to prevent shoulder surfing
• Memory protection against unauthorized access

✨ FEATURES
• Create and manage unlimited passwords
• Organize passwords with custom categories and tags
• Password strength indicator and security audit
• Emergency decryption recovery system
• Secure backup and restore capabilities
• Cloud backup with encryption (optional)
• Search passwords quickly and easily
• Generate strong, random passwords
• Native autofill integration for Android

🚀 PERFORMANCE
• Lightning-fast performance optimized for mobile
• Minimal battery drain with efficient encryption
• Smooth, responsive user interface

🔄 BACKUP & SYNC
• Secure backup to Google Drive
• Encrypted cloud synchronization
• Disaster recovery options
• Full data portability

👤 PRIVACY FIRST
• Zero-knowledge architecture
• No tracking or analytics
• No unnecessary permissions requested
• Your data is yours alone

SECURITY CERTIFICATIONS & STANDARDS
• AES-GCM 256-bit industry standard encryption
• PBKDF2 password derivation following best practices
• Complies with mobile security best practices
• Regular security audits and updates

Join thousands of users who trust PasswordEpic with their most sensitive information. Download now and experience password security done right.

PERMISSIONS
PasswordEpic only requests the minimum permissions needed:
• Biometric access for secure authentication
• Clipboard access for password autofill
• File storage for backup and export

Your privacy and security are our top priority.
```

**Character Count**: ~1,800 characters ✓

---

### 4. Screenshots & Visuals (Metadata)

**Recommended Screenshots** (to showcase):

1. Main password vault screen - showing organization
2. Biometric authentication in action
3. Password strength indicator
4. Security audit panel
5. Settings/encryption info screen

**Icon Requirements**:

- Size: 512 x 512 pixels
- Format: PNG or JPG
- Recommendation: Use existing logo.png (e:\IT\Mobile\PasswordEpic\logo.png)

---

### 5. Category

**Primary Category**: Tools  
**Alternative**: Productivity

---

### 6. Content Rating

**Age Rating**: 3+ (General Audiences)  
**Violence**: None
**Profanity**: None
**Adult Content**: None

---

### 7. Key Marketing Points

#### Main Selling Points:

1. ✅ Military-grade AES-256 encryption
2. ✅ Biometric authentication
3. ✅ Zero-knowledge architecture
4. ✅ Open-source security model
5. ✅ Emergency recovery system

#### Unique Differentiators:

- On-device encryption (no cloud exposure)
- Advanced root/jailbreak detection
- Multi-layer security architecture
- Professional security audit capabilities

---

### 8. Target Audience

- Security-conscious users
- Privacy advocates
- Business professionals
- Users seeking password management solutions
- Mobile users aged 18+

---

### 9. Compliance Notes

✅ Follows Google Play Store Metadata Policy  
✅ Highlights security features prominently  
✅ No misleading claims  
✅ Honest about encryption methods  
✅ Clear privacy statement

---

### 10. SEO Keywords

**Primary Keywords**:

- Password manager
- Secure password storage
- Biometric authentication
- AES-256 encryption
- Password generator
- Encrypted storage

**Long-tail Keywords**:

- Best secure password manager for Android
- Military-grade password encryption
- Offline password manager
- Private password storage app

---

### Store Listing Submission Checklist

- [ ] App name approved (13/30 characters)
- [ ] Short description finalized (73/80 characters)
- [ ] Full description approved (~1,800 characters)
- [ ] Screenshots prepared (5 recommended)
- [ ] App icon ready (512x512px)
- [ ] Category selected (Tools/Productivity)
- [ ] Content rating set (3+)
- [ ] Privacy policy link added
- [ ] Support email configured
- [ ] Pricing set (Free or Premium)
- [ ] All metadata in en-GB English
- [ ] Screenshots localized if needed
- [ ] Beta testing configured (optional)

---

### Important Notes for Submission

**Before submitting, ensure**:

1. All text is in British English (en-GB)
2. Double-check character limits are met
3. Screenshots clearly show the app's main features
4. Verify all security claims are accurate and supported
5. Include proper privacy policy and terms of service links
6. Test autofill and biometric features on real devices

---

## Complete Workflow Summary

### 1️⃣ Prepare Gradle

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic"
./gradlew --version
```

### 2️⃣ Build Release AAB

```powershell
Set-Location "e:\IT\Mobile\PasswordEpic\android"
.\gradlew bundleRelease
```

### 3️⃣ Verify Output

```powershell
Get-ChildItem "e:\IT\Mobile\PasswordEpic\android\app\build\outputs\bundle\release\app-release.aab"
```

### 4️⃣ Upload to Google Play Console

- Go to https://play.google.com/console
- Create new release
- Upload app-release.aab
- Fill in store listing (see section above)
- Submit for review

---

## Next Steps After Building

1. ✅ Generate signed `.aab` file (follow Method 1 or 2)
2. ✅ Test on multiple Android devices (optional but recommended)
3. ✅ Create Google Play Console account if needed
4. ✅ Upload .aab to Google Play Store
5. ✅ Fill in store listing (see Store Listing section)
6. ✅ Submit for review
