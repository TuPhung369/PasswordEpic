export const secureStorageService = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  storeBiometricStatus: jest.fn().mockResolvedValue(undefined),
  getBiometricStatus: jest.fn().mockResolvedValue(false),
  clear: jest.fn().mockResolvedValue(undefined),
};

export default secureStorageService;
