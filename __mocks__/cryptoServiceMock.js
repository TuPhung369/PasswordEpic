// Crypto service mock
export const generateSalt = jest.fn(() => 'mock-salt');
export const hashPassword = jest.fn(() => Promise.resolve('mock-hash'));
export const verifyPassword = jest.fn(() => Promise.resolve(true));
export const encrypt = jest.fn(() => Promise.resolve('encrypted-data'));
export const decrypt = jest.fn(() => Promise.resolve('decrypted-data'));
export const generateKey = jest.fn(() => 'mock-key');

export default {
  generateSalt,
  hashPassword,
  verifyPassword,
  encrypt,
  decrypt,
  generateKey,
};
