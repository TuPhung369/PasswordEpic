// Mock for jail-monkey
module.exports = {
  isJailBroken: jest.fn().mockResolvedValue(false),
  canMockLocation: jest.fn().mockResolvedValue(false),
  trustFall: jest.fn().mockResolvedValue(false),
  jailBrokenStatusCallback: jest.fn(),
};
