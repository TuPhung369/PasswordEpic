// Jest setup file
import 'react-native/jest/setup';

// Mock all native modules BEFORE they're imported
jest.mock('react-native-keychain', () => {
  const mockFns = {
    setGenericPassword: jest.fn(() => Promise.resolve(true)),
    getGenericPassword: jest.fn(() => Promise.resolve(false)),
    resetGenericPassword: jest.fn(() => Promise.resolve(true)),
    setInternetCredentials: jest.fn(() => Promise.resolve(true)),
    getInternetCredentials: jest.fn(() => Promise.resolve(false)),
    resetInternetCredentials: jest.fn(() => Promise.resolve(true)),
    getSupportedBiometryType: jest.fn(() => Promise.resolve('Fingerprint')),
    canImplyAuthentication: jest.fn(() => Promise.resolve(true)),
    ACCESS_CONTROL: {
      USER_PRESENCE: 'UserPresence',
      BIOMETRY_ANY: 'BiometryAny',
      BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
      DEVICE_PASSCODE: 'DevicePasscode',
      APPLICATION_PASSWORD: 'ApplicationPassword',
      BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE:
        'BiometryCurrentSetOrDevicePasscode',
    },
  };
  return mockFns;
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStorage = {};
  return {
    getItem: jest.fn(key => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key, value) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
    multiGet: jest.fn(keys =>
      Promise.resolve(keys.map(key => [key, mockStorage[key] || null])),
    ),
    multiSet: jest.fn(kvPairs => {
      kvPairs.forEach(([key, value]) => {
        mockStorage[key] = value;
      });
      return Promise.resolve();
    }),
    multiRemove: jest.fn(keys => {
      keys.forEach(key => {
        delete mockStorage[key];
      });
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(mockStorage).forEach(key => {
        delete mockStorage[key];
      });
      return Promise.resolve();
    }),
  };
});

jest.mock('react-native-biometrics', () => ({
  isSensorAvailable: jest.fn(() =>
    Promise.resolve({ available: true, biometryType: 'Fingerprint' }),
  ),
  simplePrompt: jest.fn(() => Promise.resolve({ success: true })),
  biometricKeysExist: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('firebase/app', () => ({}));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => {});
jest.mock('react-native-get-random-values', () => {});

// NOTE: Do not mock domainVerificationService globally - it should be tested with its real implementation
// Only mock its dependency (secureStorageService) which is handled in jest.config.js moduleNameMapper

// Mock React Native modules - Don't spread actual module to avoid DevMenu issues
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  Platform: {
    OS: 'android',
    select: jest.fn(obj => obj.android),
  },
  NativeModules: {
    ChromeInjectBridge: {
      detectLoginForm: jest.fn(() => Promise.resolve({ success: false })),
      injectCredentials: jest.fn(() => Promise.resolve(true)),
      clearInjectedContent: jest.fn(() => Promise.resolve()),
      autoFillCurrentPage: jest.fn(() => Promise.resolve(true)),
    },
  },
  StyleSheet: {
    create: styles => styles,
    flatten: style => {
      if (Array.isArray(style)) {
        return style.reduce((acc, s) => ({ ...acc, ...s }), {});
      }
      return style || {};
    },
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Switch: 'Switch',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  TouchableOpacity: 'TouchableOpacity',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  SafeAreaView: 'SafeAreaView',
  InputAccessoryView: 'InputAccessoryView',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  Alert: {
    alert: jest.fn(),
  },
  Clipboard: {
    setString: jest.fn(() => Promise.resolve()),
    getString: jest.fn(() => Promise.resolve('')),
  },
}));

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
