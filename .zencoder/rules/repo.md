---
description: Repository Information Overview
alwaysApply: true
---

# PasswordEpic Information

## Summary

PasswordEpic is an ultra-secure mobile password manager built with React Native, featuring end-to-end encryption, biometric authentication, and native auto-fill capabilities. The app implements AES-GCM 256-bit encryption with PBKDF2 key derivation and follows a zero-knowledge architecture where all encryption happens on-device.

## Structure

- **android/**: Android platform-specific code and configuration
- **ios/**: iOS platform-specific code and configuration
- **src/**: Main application source code
  - **components/**: Reusable UI components
  - **constants/**: Application constants
  - **contexts/**: React contexts for state management
  - **hooks/**: Custom React hooks
  - **navigation/**: Navigation configuration
  - **screens/**: Application screens
  - **services/**: Business logic and services
  - **store/**: Redux store configuration
  - **types/**: TypeScript type definitions
  - **utils/**: Utility functions
- ****tests**/**: Test files

## Language & Runtime

**Language**: TypeScript/JavaScript
**Version**: TypeScript 5.8.3, ES2017 target
**Build System**: React Native CLI
**Package Manager**: npm

## Dependencies

**Main Dependencies**:

- React Native 0.81.4
- React 19.1.0
- @react-navigation/native 7.1.17
- @reduxjs/toolkit 2.9.0
- crypto-js 4.2.0
- react-native-biometrics 3.0.1
- firebase 12.3.0
- react-native-keychain 10.0.0

**Development Dependencies**:

- Jest 29.6.3
- ESLint 8.19.0
- Prettier 2.8.8
- TypeScript 5.8.3

## Build & Installation

```bash
# Install dependencies
npm install

# iOS specific setup
bundle install
bundle exec pod install --project-directory=ios

# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Testing

**Framework**: Jest
**Test Location**: `__tests__/` directory
**Configuration**: jest.config.js
**Run Command**:

```bash
npm test
```

## CI/CD

**Workflows**:

- CI/CD Pipeline (.github/workflows/ci-cd.yml)
  - Runs tests, security scans, and builds Android APK/AAB
- iOS Build (.github/workflows/ios-build.yml)
  - Builds iOS app for simulator and creates IPA for distribution

## Platform Support

- Android SDK 24+ (minSdkVersion)
- iOS 13+ (in development)

## Security Features

- End-to-End Encryption with AES-GCM 256-bit
- Biometric Authentication (Face ID, Touch ID, Fingerprint)
- Zero-Knowledge Architecture
- Multi-layer Security with root/jailbreak detection
