# Bug Record & Solutions - PasswordEpic Project

## Table of Contents

1. [Android Emulator Setup Issues](#android-emulator-setup-issues)
2. [Java Version Compatibility](#java-version-compatibility)
3. [Development Environment Flow](#development-environment-flow)
4. [Fingerprint Authentication Setup](#fingerprint-authentication-setup)
5. [React Native Metro Connection Issues](#react-native-metro-connection-issues)

---

## Android Emulator Setup Issues

### Problem: API Level Compatibility

- **Issue**: Using Android API 36 causes instability and compatibility issues
- **Solution**: Always use Android API 34 for stable development

### Steps to Create Stable Emulator:

```bash
# 1. Open Android Studio
# 2. Tools → AVD Manager → Create Virtual Device
# 3. Choose Pixel 6 Pro (or similar device)
# 4. Select System Image: Android 14 (API level 34) - NOT API 36
# 5. Configure Advanced Settings:
#    - RAM: 4096 MB (minimum)
#    - VM heap: 512 MB
#    - Internal Storage: 8192 MB
#    - Graphics: Hardware - GLES 2.0
#    - Boot option: Cold boot
```

### Recommended Emulator Configuration:

```
Device: Pixel 6 Pro
Android Version: Android 14 (API 34)
Target: Google Play Store
RAM: 4GB
Internal Storage: 8GB
Graphics: Hardware - GLES 2.0
```

---

## Java Version Compatibility

### Problem: Java Version Mismatch

- **Issue**: Gradle requires specific Java version for React Native projects
- **Current Setup**: Java 17 (Eclipse Adoptium JDK 17.0.15.6)

### Verification Commands:

```bash
# Check current Java version
java -version

# Check Gradle Java home
./gradlew -version

# Verify Android Studio Java settings
# File → Settings → Build → Build Tools → Gradle → Gradle JDK
```

### Configuration in gradle.properties:

```properties
org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.15.6-hotspot
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
```

---

## Development Environment Flow

### Android Studio Development Flow

#### 1. Initial Setup:

```bash
# Open Android Studio
# File → Open → Select: E:\IT\Mobile\PasswordEpic\android
# Wait for Gradle sync to complete
```

#### 2. Running from Android Studio:

```bash
# Step 1: Start Metro Bundler (in VS Code terminal)
cd E:\IT\Mobile\PasswordEpic
npx react-native start --reset-cache

# Step 2: In Android Studio
# - Ensure Pixel 6 Pro emulator is running
# - Click Run button (▶️) or Shift+F10
# - App will automatically install and connect to Metro
```

### Terminal Development Flow (Complete Build Required)

#### 1. Full Build Process:

```bash
# Navigate to project root
cd E:\IT\Mobile\PasswordEpic

# Clean previous builds
npx react-native clean
cd android
./gradlew clean
cd ..

# Start Metro Bundler
npx react-native start --reset-cache

# In new terminal: Build and install
npx react-native run-android
```

#### 2. Quick Development Commands:

```bash
# Hot reload (when Metro is running)
r

# Open Dev Menu
d

# Open DevTools
j

# Reload app manually
adb shell input keyevent 82  # Menu key
# Then select "Reload"
```

### Troubleshooting Commands:

#### Metro Connection Issues:

```bash
# Kill Metro process
npx react-native start --reset-cache

# Reset ADB
adb kill-server
adb start-server
adb devices

# Port forwarding for emulator
adb reverse tcp:8081 tcp:8081

# Check Metro is running on correct port
netstat -an | findstr 8081
```

#### Build Issues:

```bash
# Clean everything
cd android
./gradlew clean
cd ..
npx react-native clean

# Clear Metro cache
npx react-native start --reset-cache

# Clear npm cache (if needed)
npm start -- --reset-cache
```

---

## Fingerprint Authentication Setup

### Problem: Emulator Fingerprint Authentication

- **Issue**: Password manager apps require biometric authentication testing
- **Solution**: Configure fingerprint authentication in Android Emulator

### Step-by-Step Fingerprint Setup:

#### 1. Enable Screen Lock:

```bash
# In emulator:
# Settings → Security → Screen lock → PIN/Password/Pattern
# Set up a PIN/Password for the device
```

#### 2. Configure Fingerprint via Extended Controls:

```bash
# Method 1: Extended Controls UI
# 1. In emulator, click "..." (More) button
# 2. Select "Fingerprint" from left menu
# 3. Click "Touch the sensor" button to simulate fingerprint touch
```

#### 3. Add Fingerprint in Android Settings:

```bash
# In emulator Android Settings:
# Settings → Security → Fingerprint
# 1. Enter your PIN/Password
# 2. Follow setup wizard
# 3. When prompted to place finger on sensor:
#    - Use Extended Controls → Fingerprint → "Touch the sensor"
#    - Repeat multiple times as requested
# 4. Complete fingerprint enrollment
```

#### 4. Testing Fingerprint Authentication:

```bash
# Test in your app:
# 1. Trigger biometric authentication in your app
# 2. When fingerprint prompt appears:
#    - Open Extended Controls (... button)
#    - Go to Fingerprint section
#    - Click "Touch the sensor" to simulate successful authentication
#    - Or click "Touch the sensor" with wrong finger simulation for failure
```

### Extended Controls Fingerprint Options:

```
✅ Touch the sensor (successful authentication)
❌ Touch and hold (failed authentication - wrong finger)
🔄 Multiple touches (simulate multiple attempts)
```

### Alternative: ADB Commands for Fingerprint:

```bash
# Simulate successful fingerprint
adb -e emu finger touch 1

# Simulate failed fingerprint
adb -e emu finger touch 2
```

---

## React Native Metro Connection Issues

### Problem: "No apps connected" Error

- **Issue**: Metro bundler running but app not connecting
- **Common Cause**: Port forwarding or ADB connection issues

### Solution Steps:

#### 1. Verify ADB Connection:

```bash
# Check connected devices
adb devices

# Should show something like:
# emulator-5554    device
```

#### 2. Setup Port Forwarding:

```bash
# Forward Metro port to emulator
adb reverse tcp:8081 tcp:8081

# Verify Metro is accessible
adb shell curl http://localhost:8081/status
```

#### 3. App-Side Configuration:

```bash
# In emulator, shake device (Ctrl+M)
# Dev Settings → Debug server host & port for device:
# Set to: localhost:8081 (for emulator)
# Or: 10.0.2.2:8081 (alternative for emulator)
```

#### 4. Network Troubleshooting:

```bash
# Check if Metro is running on correct port
netstat -an | findstr 8081

# Should show:
# TCP    0.0.0.0:8081           0.0.0.0:0              LISTENING

# Test Metro health
curl http://localhost:8081/status
```

---

## Common Error Solutions

### Build Errors:

#### Gradle Build Failed:

```bash
cd android
./gradlew clean
./gradlew --refresh-dependencies
cd ..
npx react-native run-android
```

#### Metro Cache Issues:

```bash
npx react-native start --reset-cache
# Or
rm -rf node_modules
npm install
npx react-native start --reset-cache
```

#### Android Studio Module Not Found:

```bash
# File → Invalidate Caches and Restart
# File → Sync Project with Gradle Files
# Or click Gradle sync icon in toolbar
```

### Runtime Errors:

#### App Crashes on Launch:

```bash
# Check Logcat in Android Studio for specific errors
# Common fixes:
./gradlew clean
npx react-native run-android --reset-cache
```

#### White Screen / App Not Loading:

```bash
# Reload Metro bundle
adb shell input keyevent 82  # Open dev menu
# Select "Reload"

# Or restart Metro
npx react-native start --reset-cache
```

---

## Development Workflow Recommendations

### Daily Development Flow:

```bash
# 1. Start Android Studio → Start Pixel 6 Pro emulator
# 2. In VS Code terminal:
cd E:\IT\Mobile\PasswordEpic
npx react-native start

# 3. If first run of day or after changes to native code:
npx react-native run-android

# 4. For subsequent runs, just use Android Studio Run button
```

### Before Committing Code:

```bash
# Clean build test
npx react-native clean
cd android && ./gradlew clean && cd ..
npx react-native run-android

# Test fingerprint functionality
# Test on both emulator and real device if possible
```

### Performance Tips:

- Keep only one emulator running at a time
- Use "Cold Boot Now" if emulator becomes slow
- Restart Metro bundler if hot reload stops working
- Close unnecessary Android Studio projects

---

## Environment Variables Check

### Required Environment Variables:

```bash
# Windows PowerShell - Check these paths:
echo $env:ANDROID_HOME
echo $env:ANDROID_SDK_ROOT
echo $env:PATH

# Should include:
# C:\Users\[Username]\AppData\Local\Android\Sdk
# C:\Users\[Username]\AppData\Local\Android\Sdk\platform-tools
# C:\Users\[Username]\AppData\Local\Android\Sdk\tools
```

### Add to PATH if missing:

```bash
# In PowerShell (temporary):
$env:PATH += ";C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools"

# Permanent: Add via System Properties → Environment Variables
```

---

## Platform-Specific Issues

### Windows Development:

```bash
# Use PowerShell instead of CMD for better compatibility
# Ensure Windows Defender doesn't block Metro port 8081
# Use absolute paths when possible
```

### Android Permissions:

```bash
# Ensure app has required permissions in AndroidManifest.xml:
# - USE_BIOMETRIC
# - USE_FINGERPRINT
# - CAMERA (if using for authentication)
```

---

## Testing Checklist

### Before Each Release:

- [ ] Test on API 34 emulator
- [ ] Test fingerprint authentication flow
- [ ] Test on real device if available
- [ ] Verify Metro connection stability
- [ ] Clean build test
- [ ] Performance test on low-end device

### Security Testing:

- [ ] Biometric authentication works correctly
- [ ] App locks after inactivity
- [ ] Data encryption is working
- [ ] Screen capture protection is active

---

---

## Recent Improvements (October 2025)

### Session Management Enhancement

- **Extended Session Timeout**: Changed from 5 minutes to 7-30 days options
  - New options: 30 seconds, 1 min, 5 min, 15 min, 30 min, 1 hour, 7 days, 14 days, 30 days
  - Default timeout changed to 7 days for better user experience
- **Removed Session Warning Modal**: Sessions now auto-expire without warning modal
  - Direct logout when session expires - no intermediate warning
  - Cleaner UX without interruption dialogs
- **Professional Auto-Lock UI**: Replaced AlertDialog with custom dropdown selector
  - Enhanced UI with security level indicators
  - Visual feedback for each timeout option
  - Professional look with descriptions and icons

### Code Changes:

```bash
# Files modified:
src/screens/main/SettingsScreen.tsx - New AutoLockSelector integration
src/components/AutoLockSelector.tsx - New professional dropdown component
src/navigation/AppNavigator.tsx - Removed session warning modal logic
src/services/sessionService.ts - Updated default timeout and disabled warnings
```

---

_Last Updated: October 2025_
_Project: PasswordEpic - React Native Password Manager_
_Environment: Windows 11, Android Studio, VS Code_
