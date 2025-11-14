# PasswordEpic

[![CI/CD Pipeline](https://github.com/TuPhung369/PasswordEpic/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/TuPhung369/PasswordEpic/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An ultra-secure mobile password manager built with React Native, featuring end-to-end encryption, biometric authentication, and native auto-fill capabilities.

## User Guide

### Installation

1.  Download the app from the Google Play Store or Apple App Store (coming soon).
2.  Install the app on your device.

### Setup for Autofill

To use the autofill feature, you need to enable it in your phone's settings.

1.  **Enable Autofill Service:**
    *   Go to your phone's **Settings**.
    *   Search for "Autofill service".
    *   Select **PasswordEpic** as your autofill service.
2.  **Enable in Browser (Chrome or Firefox):**
    *   Open your web browser's settings.
    *   Go to "Autofill" or "Passwords".
    *   Ensure **PasswordEpic Autofill** is selected.
3.  **Enable Accessibility Service:**
    *   Go to your phone's **Settings > Accessibility**.
    *   Find **PasswordEpic** in the list of downloaded apps.
    *   Enable the accessibility service for PasswordEpic. This is required for the autofill feature to work correctly in all apps.

### Main Screens

#### Passwords Screen

This is the main screen where you can manage all your saved passwords. It provides the following functions:

*   **Search:** Quickly find any password.
*   **Sort:** Sort your passwords by creation date, last used, or alphabetically.
*   **Filter:** Filter passwords by category, tags, or security status (weak, compromised).
*   **Add Password:** Manually add a new password entry.
*   **Export/Import:** Export your passwords to a JSON file or import from a previous backup.
*   **Backup & Restore:** Securely back up your encrypted password vault to Google Drive and restore it when needed.
*   **Bulk Actions:** Select multiple passwords to delete them at once.
*   **View Details:** Tap on a password to view its details, edit, or delete it.

#### Generator Screen

Create strong and unique passwords with the built-in password generator. You can customize:

*   Password length.
*   Inclusion of uppercase letters, lowercase letters, numbers, and symbols.
*   Exclusion of similar or ambiguous characters.

#### Settings Screen

Configure the app to your preferences:

*   **Security:** Enable biometric authentication (Face ID/Fingerprint), set an auto-lock timer, and manage other security features.
*   **Appearance:** Choose between light, dark, or system default theme.
*   **Backup & Restore:** Manage your backups.
*   **Account:** Manage your account and sign out.

## Developer Guide

### Prerequisites

- Node.js 20+
- Android Studio with SDK 34
- Java 17
- Ruby with Bundler for iOS development

### Getting Started

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/TuPhung369/PasswordEpic.git
    cd PasswordEpic
    ```
2.  **Install dependencies:**
    ```sh
    # Using npm
    npm install

    # OR using Yarn
    yarn
    ```
3.  **For iOS, install CocoaPods dependencies:**
    ```sh
    cd ios
    bundle install
    bundle exec pod install
    cd ..
    ```
4.  **Start the Metro server:**
    ```sh
    # Using npm
    npm start

    # OR using Yarn
    yarn start
    ```
5.  **Run the app:**
    Open a new terminal and run one of the following commands:
    ```sh
    # For Android
    npm run android

    # For iOS
    npm run ios
    ```

### Available Scripts

```bash
npm run android          # Run on Android
npm run ios             # Run on iOS
npm start               # Start Metro bundler
npm test                # Run tests
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking
npm run security-audit  # Security vulnerability scan
npm run format          # Format code with Prettier
```

## 🔐 Security Features

- **End-to-End Encryption**: AES-GCM 256-bit encryption with PBKDF2 key derivation
- **Zero-Knowledge Architecture**: All encryption happens on-device
- **Biometric Authentication**: Face ID, Touch ID, and Fingerprint support
- **Native Auto-fill**: Secure password auto-fill for Android and iOS
- **Multi-layer Security**: Root/jailbreak detection, anti-tampering measures

## 🚀 Development

### Prerequisites

- Node.js 20+
- Android Studio with SDK 34
- Java 17

### Available Scripts

```bash
npm run android          # Run on Android
npm run ios             # Run on iOS
npm start               # Start Metro bundler
npm test                # Run tests
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking
npm run security-audit  # Security vulnerability scan
npm run format          # Format code with Prettier
```

## 📱 Platform Support

- ✅ Android (SDK 26+)
- 🔄 iOS (iOS 13+) - In development

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request