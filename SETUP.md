# PasswordEpic Development Setup

## Prerequisites

### Node.js Update Required

Your current Node.js version (20.17.0) needs to be updated to ≥20.19.4 for React Native compatibility.

**Update Node.js:**

1. Download Node.js ≥20.19.4 from [nodejs.org](https://nodejs.org/)
2. Install the new version
3. Restart your terminal/IDE

### Development Environment

#### Android Development

1. **Install Android Studio**

   - Download from [developer.android.com](https://developer.android.com/studio)
   - Install Android SDK (API 34)
   - Configure Android SDK path in environment variables

2. **Configure Environment Variables**

   ```powershell
   # Add to your system environment variables
   ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk
   ANDROID_SDK_ROOT=C:\Users\YourUsername\AppData\Local\Android\Sdk

   # Add to PATH
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\tools
   %ANDROID_HOME%\tools\bin
   ```

#### iOS Development (macOS only)

1. **Install Xcode** (latest version from App Store)
2. **Install Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```
3. **Install CocoaPods**
   ```bash
   sudo gem install cocoapods
   ```

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Project name: `passwordepic-mobile`
4. Enable Google Analytics

### 2. Configure Authentication

1. Go to **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Add support email

### 3. Add Apps to Firebase Project

#### Android App

1. Click "Add app" → Android
2. Package name: `com.passwordepic`
3. Download `google-services.json`
4. Replace the placeholder file at `android/app/google-services.json`

#### iOS App

1. Click "Add app" → iOS
2. Bundle ID: `com.passwordepic`
3. Download `GoogleService-Info.plist`
4. Replace the placeholder file at `ios/GoogleService-Info.plist`

### 4. Update Firebase Configuration

Replace the placeholder values in `src/services/firebase.ts` with your actual Firebase config:

```typescript
export const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "passwordepic-mobile.firebaseapp.com",
  projectId: "passwordepic-mobile",
  storageBucket: "passwordepic-mobile.appspot.com",
  messagingSenderId: "your-actual-sender-id",
  appId: "your-actual-app-id",
};
```

## Installation & Setup

### 1. Install Dependencies

```powershell
# Navigate to project directory
Set-Location "e:\IT\Mobile\PasswordEpic"

# Install Node.js dependencies
npm install

# For iOS (macOS only)
Set-Location ios; pod install; Set-Location ..
```

### 2. Start Metro Bundler

```powershell
npm start
```

### 3. Run on Android

```powershell
# Make sure Android emulator is running or device is connected
npm run android
```

### 4. Run on iOS (macOS only)

```powershell
npm run ios
```

## Troubleshooting

### Common Issues

1. **Node.js Version Error**

   - Update Node.js to ≥20.19.4
   - Clear npm cache: `npm cache clean --force`

2. **Android Build Errors**

   - Ensure ANDROID_HOME is set correctly
   - Run `./gradlew clean` in android folder

3. **iOS Build Errors**

   - Run `pod install` in ios folder
   - Clean Xcode build folder

4. **Metro Bundler Issues**
   - Clear Metro cache: `npx react-native start --reset-cache`
   - Delete node_modules and reinstall

### Firebase Connection Issues

1. Verify `google-services.json` and `GoogleService-Info.plist` are correctly placed
2. Check Firebase project configuration
3. Ensure package names match exactly

## Next Steps (Week 2)

After completing the setup:

1. Test Firebase authentication
2. Implement Google Sign-In flow
3. Create user onboarding screens
4. Set up navigation between auth and main app

## Development Commands

```powershell
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run tests
npm test

# Type checking
npm run tsc

# Linting
npm run lint

# Build for production
npm run build
```

## Project Structure

```
PasswordEpic/
├── src/
│   ├── components/     # Reusable UI components
│   ├── screens/        # Screen components
│   ├── navigation/     # Navigation configuration
│   ├── services/       # Firebase and API services
│   ├── store/          # Redux store and slices
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── hooks/          # Custom React hooks
├── android/            # Android-specific code
├── ios/                # iOS-specific code
└── ...
```

This setup provides the foundation for Week 2 implementation of the authentication framework.
