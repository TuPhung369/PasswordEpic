// Mock for react-native-fs
module.exports = {
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ size: 0 }),
  exists: jest.fn().mockResolvedValue(true),
  DocumentDirectoryPath: '/mock/documents',
  DownloadDirectoryPath: '/mock/downloads',
  CachesDirectoryPath: '/mock/caches',
  ExternalFilesDirectoryPath: '/mock/external',
};
