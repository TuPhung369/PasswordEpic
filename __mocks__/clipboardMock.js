// Mock for @react-native-clipboard/clipboard
module.exports = {
  setString: jest.fn().mockResolvedValue(true),
  getString: jest.fn().mockResolvedValue(''),
  hasString: jest.fn().mockResolvedValue(false),
};
