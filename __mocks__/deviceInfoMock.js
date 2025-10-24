// Mock for react-native-device-info
module.exports = {
  getUniqueId: jest.fn().mockResolvedValue('mock-device-id'),
  getModel: jest.fn().mockResolvedValue('MockDevice'),
  getSystemVersion: jest.fn().mockResolvedValue('14.0'),
  getSystemName: jest.fn().mockResolvedValue('Android'),
  getVersion: jest.fn().mockResolvedValue('1.0.0'),
  getBuildNumber: jest.fn().mockResolvedValue('1'),
  getApplicationName: jest.fn().mockResolvedValue('PasswordEpic'),
  getCarrier: jest.fn().mockResolvedValue('MockCarrier'),
  isTablet: jest.fn().mockResolvedValue(false),
  isLandscape: jest.fn().mockResolvedValue(false),
  isPortrait: jest.fn().mockResolvedValue(true),
};
