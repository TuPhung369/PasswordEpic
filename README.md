# PasswordEpic - Ultra-Secure Mobile Password Manager

A cross-platform mobile password manager built with absolute security and seamless auto-fill functionality in mind.

## 🔐 Security-First Architecture

PasswordEpic implements a **multi-layered security model** designed to protect your sensitive data at every level:

### Security Layers
1. **User Authentication** - Firebase Auth + Google OAuth 2.0
2. **End-to-End Encryption** - Client-side encryption with AES-GCM 256-bit
3. **Data Protection** - Encrypted at rest and in transit
4. **Mobile Security** - Anti-tampering, root/jailbreak detection
5. **Secure Auto-fill** - Platform-native auto-fill frameworks

## 🚀 Key Features

### Core Functionality
- **Cross-Platform**: Built with React Native for iOS and Android
- **Zero-Knowledge Architecture**: Server cannot decrypt your data
- **Biometric Authentication**: Face ID, Touch ID, Fingerprint support
- **Password Generator**: Cryptographically secure password generation
- **Secure Auto-fill**: Native Android Autofill & iOS Password AutoFill
- **Offline Capability**: Full functionality without internet connection

### Advanced Security
- **Master Key Derivation**: PBKDF2 with 100,000+ iterations
- **Hardware Security**: Android Keystore / iOS Keychain integration
- **Memory Protection**: Anti-debugging and secure memory management
- **Screen Protection**: Screenshot and screen recording prevention
- **Device Integrity**: Root/jailbreak detection with automatic lockdown

## 🏗️ Technical Architecture

### Frontend
- **Framework**: React Native (Cross-platform)
- **Authentication**: Firebase Auth with Google OAuth 2.0
- **Local Storage**: React Native Keychain for sensitive data
- **Biometrics**: React Native Biometrics

### Backend & Data
- **Metadata Storage**: Firebase Firestore (encrypted metadata only)
- **Sensitive Data**: Encrypted local storage only
- **Encryption**: AES-GCM 256-bit with client-side key derivation
- **Key Management**: Platform-native secure storage

### Auto-fill Implementation
- **Android**: Autofill Framework Service
- **iOS**: Password AutoFill Extension with Associated Domains
- **Security**: Biometric verification before auto-fill
- **Domain Verification**: Strict domain/package matching

## 📱 Platform Support

| Feature | Android | iOS |
|---------|---------|-----|
| Password Management | ✅ | ✅ |
| Biometric Auth | ✅ | ✅ |
| Auto-fill | ✅ (Autofill Framework) | ✅ (Password AutoFill) |
| Hardware Security | ✅ (Keystore) | ✅ (Keychain) |
| Root/Jailbreak Detection | ✅ | ✅ |

## 🛠️ Development Setup

### Prerequisites
- Node.js (v16 or higher)
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- Firebase project with Authentication enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TuPhung369/PasswordEpic.git
   cd PasswordEpic
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Firebase Configuration**
   - Create a Firebase project
   - Enable Authentication with Google provider
   - Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Place configuration files in appropriate directories

4. **Platform Setup**
   
   **Android:**
   ```bash
   npx react-native run-android
   ```
   
   **iOS:**
   ```bash
   cd ios && pod install && cd ..
   npx react-native run-ios
   ```

## 🔒 Security Implementation Details

### Encryption Flow
1. **Master Password** → PBKDF2 (100k+ iterations) → **Master Key**
2. **Master Key** + Random Salt → **Encryption Key**
3. **Sensitive Data** → AES-GCM 256-bit → **Encrypted Data**
4. **Encryption Key** → Platform Keystore/Keychain

### Data Storage Strategy
- **Local Device**: Encrypted passwords and sensitive data
- **Firebase Firestore**: Encrypted metadata, user preferences, sync data
- **No Cloud Passwords**: Actual passwords never leave the device unencrypted

### Auto-fill Security
- Biometric authentication required before auto-fill
- Domain verification prevents credential theft
- No sensitive data cached in auto-fill service
- Secure communication between main app and auto-fill service

## 📋 Development Roadmap

See [Planning.md](./Planning.md) for detailed development phases and timeline.

## 🧪 Testing

### Security Testing
- Penetration testing
- Code obfuscation verification
- Memory dump analysis
- Root/jailbreak bypass testing

### Functional Testing
- Cross-platform compatibility
- Auto-fill accuracy
- Biometric authentication
- Offline functionality

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🔐 Security Disclosure

If you discover a security vulnerability, please send an email to security@passwordepic.com. All security vulnerabilities will be promptly addressed.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/TuPhung369/PasswordEpic/issues)
- **Discussions**: [GitHub Discussions](https://github.com/TuPhung369/PasswordEpic/discussions)
- **Email**: support@passwordepic.com

---

**⚠️ Security Notice**: This application handles sensitive data. Always use the latest version and report any security concerns immediately.