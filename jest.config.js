module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '@react-native-async-storage/async-storage':
      '<rootDir>/__mocks__/asyncStorageMock.js',
    'react-native-keychain': '<rootDir>/__mocks__/keychainMock.js',
    'react-native-biometrics': '<rootDir>/__mocks__/biometricsMock.js',
    '^@react-navigation/(.*)$': '<rootDir>/__mocks__/navigationMock.js',
    '@react-native-google-signin/google-signin':
      '<rootDir>/__mocks__/googleSignInMock.js',
    'firebase/app': '<rootDir>/__mocks__/firebaseMock.js',
    'firebase/auth': '<rootDir>/__mocks__/firebaseMock.js',
    'firebase/database': '<rootDir>/__mocks__/firebaseMock.js',
    'react-native-vector-icons/Ionicons':
      '<rootDir>/__mocks__/vectorIconsMock.js',
    'react-native-safe-area-context':
      '<rootDir>/__mocks__/safeAreaContextMock.js',
    'react-native-fs': '<rootDir>/__mocks__/rnfsMock.js',
    'react-native-gesture-handler': '<rootDir>/__mocks__/gestureHandlerMock.js',
    'react-native-screens': '<rootDir>/__mocks__/screensMock.js',
    'react-native-device-info': '<rootDir>/__mocks__/deviceInfoMock.js',
    'jail-monkey': '<rootDir>/__mocks__/jailMonkeyMock.js',
    '@react-native-clipboard/clipboard': '<rootDir>/__mocks__/clipboardMock.js',
    '^src/services/secureStorageService$':
      '<rootDir>/src/services/__mocks__/secureStorageService.ts',
    '^src/services/cryptoService$':
      '<rootDir>/src/services/__mocks__/cryptoService.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-redux|@react-redux|redux-persist|@react-navigation|react-native|@react-native|@react-native-google-signin|firebase|react-native-vector-icons|react-native-safe-area-context|react-native-fs|react-native-gesture-handler|react-native-screens|react-native-device-info|jail-monkey)/)',
  ],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/?(*.)(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/__tests__/App.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};
