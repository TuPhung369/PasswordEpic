// React Native Biometrics mock for Jest
export default {
  isSensorAvailable: jest.fn(() =>
    Promise.resolve({
      available: true,
      biometryType: 'Fingerprint',
    }),
  ),
  simplePrompt: jest.fn(() =>
    Promise.resolve({
      success: true,
    }),
  ),
  biometricKeysExist: jest.fn(() => Promise.resolve(true)),
  createSignature: jest.fn(() =>
    Promise.resolve({
      success: true,
      signature: 'mock-signature',
    }),
  ),
  deleteSignature: jest.fn(() => Promise.resolve(true)),
};
