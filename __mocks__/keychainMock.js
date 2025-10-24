// React Native Keychain mock for Jest
export default {
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
  SECURITY_LEVEL: {
    NONE: 'none',
    ANY: 'any',
    BIOMETRIC_WEAK: 'biometric_weak',
  },
};
