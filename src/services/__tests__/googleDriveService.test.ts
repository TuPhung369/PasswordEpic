import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import {
  uploadToGoogleDrive,
  listGoogleDriveBackups,
  downloadFromGoogleDrive,
  deleteFromGoogleDrive,
  isGoogleDriveAvailable,
  requestDrivePermissions,
} from '../googleDriveService';

// Mock modules
jest.mock('@react-native-google-signin/google-signin');
jest.mock('react-native-fs');

// Mock fetch globally
const fetchMock = jest.fn();
global.fetch = fetchMock as any;

// Setup GoogleSignin mock
beforeAll(() => {
  (GoogleSignin.getTokens as jest.Mock) = jest.fn();
  (GoogleSignin.hasPreviousSignIn as jest.Mock) = jest.fn();
  (GoogleSignin.addScopes as jest.Mock) = jest.fn();
});

describe('googleDriveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockClear();
    (GoogleSignin.getTokens as jest.Mock).mockClear();
    (GoogleSignin.hasPreviousSignIn as jest.Mock).mockClear();
    (GoogleSignin.addScopes as jest.Mock).mockClear();
  });

  // ============= getAccessToken (internal) =============
  describe('getAccessToken', () => {
    it('should get access token successfully', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_access_token_123',
      });

      const result = await uploadToGoogleDrive('/path/file.txt', 'file.txt');
      expect(GoogleSignin.getTokens).toHaveBeenCalled();
    });

    it('should throw error if getTokens fails', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(
        new Error('Auth failed'),
      );
      (RNFS.readFile as jest.Mock).mockResolvedValue('file_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 100 });

      const result = await uploadToGoogleDrive('/path/file.txt', 'file.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticate');
    });
  });

  // ============= uploadToGoogleDrive =============
  describe('uploadToGoogleDrive', () => {
    const testFilePath = '/test/backup.json';
    const testFileName = 'backup.json';
    const testMimeType = 'application/json';

    it('should upload file successfully', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'file_id_123' }),
      });

      const result = await uploadToGoogleDrive(
        testFilePath,
        testFileName,
        testMimeType,
      );

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('file_id_123');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/upload/drive/v3/files'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer'),
          }),
        }),
      );
    });

    it('should upload with default mime type', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'file_id_456' }),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': expect.stringContaining('multipart/related'),
          }),
        }),
      );
    });

    it('should handle read file error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockRejectedValue(
        new Error('File not found'),
      );

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should handle stat error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockRejectedValue(new Error('Cannot stat file'));

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle 400 bad request from API', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('Invalid file format'),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
    });

    it('should handle 401 unauthorized error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid token'),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle 403 forbidden error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Access denied'),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle 500 server error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server error'),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle fetch network error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle malformed JSON response', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include multipart boundary in request', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('base64_content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'file_id' }),
      });

      await uploadToGoogleDrive(testFilePath, testFileName);

      const callArgs = fetchMock.mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('-------314159265358979323846');
    });

    it('should handle empty file', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 0 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'empty_file_id' }),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('empty_file_id');
    });

    it('should handle large file', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('x'.repeat(10000000)); // 10MB
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 10000000 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'large_file_id' }),
      });

      const result = await uploadToGoogleDrive(testFilePath, testFileName);

      expect(result.success).toBe(true);
    });
  });

  // ============= listGoogleDriveBackups =============
  describe('listGoogleDriveBackups', () => {
    it('should list files successfully', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          files: [
            {
              id: 'file1',
              name: 'backup1.json',
              mimeType: 'application/json',
              size: '1024',
              createdTime: '2024-01-01T00:00:00Z',
              modifiedTime: '2024-01-02T00:00:00Z',
            },
            {
              id: 'file2',
              name: 'backup2.json',
              mimeType: 'application/json',
              size: '2048',
              createdTime: '2024-01-02T00:00:00Z',
              modifiedTime: '2024-01-03T00:00:00Z',
            },
          ],
        }),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files?.[0].id).toBe('file1');
      expect(result.files?.[1].id).toBe('file2');
    });

    it('should handle empty file list', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ files: [] }),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(true);
      expect(result.files).toEqual([]);
    });

    it('should handle missing files property', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(true);
      expect(result.files).toEqual([]);
    });

    it('should handle 401 unauthorized', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'invalid_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid token'),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle 403 forbidden', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Access denied'),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle 404 not found', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Not found'),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle network error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockRejectedValue(new Error('Network timeout'));

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle malformed JSON response', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle token retrieval error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(
        new Error('Token error'),
      );

      const result = await listGoogleDriveBackups();

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticate');
    });

    it('should include authorization header', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token_xyz',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ files: [] }),
      });

      await listGoogleDriveBackups();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test_token_xyz',
          }),
        }),
      );
    });
  });

  // ============= downloadFromGoogleDrive =============
  describe('downloadFromGoogleDrive', () => {
    const fileId = 'file_id_123';
    const destinationPath = '/test/downloads/backup.json';

    it('should download file successfully', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('{"key": "value"}'),
      });
      (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(true);
      expect(RNFS.writeFile).toHaveBeenCalledWith(
        destinationPath,
        expect.any(String),
        'utf8',
      );
    });

    it('should handle 401 unauthorized', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'invalid_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid token'),
      });

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle 404 file not found', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('File not found'),
      });

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle 403 forbidden', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Access denied'),
      });

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle write file error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('file content'),
      });
      (RNFS.writeFile as jest.Mock).mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle network error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockRejectedValue(new Error('Network failure'));

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });

    it('should handle empty file content', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(''),
      });
      (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(true);
    });

    it('should include file ID in URL', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('content'),
      });
      (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

      await downloadFromGoogleDrive('specific_file_id', destinationPath);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('specific_file_id'),
        expect.any(Object),
      );
    });

    it('should handle token retrieval error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(
        new Error('Token fetch failed'),
      );

      const result = await downloadFromGoogleDrive(fileId, destinationPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticate');
    });
  });

  // ============= deleteFromGoogleDrive =============
  describe('deleteFromGoogleDrive', () => {
    const fileId = 'file_to_delete_123';

    it('should delete file successfully', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(''),
      });

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(fileId),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('should handle 401 unauthorized', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'invalid_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid token'),
      });

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle 404 file not found', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('File not found'),
      });

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle 403 forbidden', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue('Cannot delete'),
      });

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle 500 server error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server error'),
      });

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle network error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockRejectedValue(new Error('Connection lost'));

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection lost');
    });

    it('should handle token retrieval error', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(
        new Error('Token error'),
      );

      const result = await deleteFromGoogleDrive(fileId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticate');
    });

    it('should use DELETE method', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(''),
      });

      await deleteFromGoogleDrive(fileId);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('should handle multiple deletes', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(''),
      });

      const result1 = await deleteFromGoogleDrive('file1');
      const result2 = await deleteFromGoogleDrive('file2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ============= isGoogleDriveAvailable =============
  describe('isGoogleDriveAvailable', () => {
    it('should return true if user is signed in and has tokens', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(true);
    });

    it('should return false if user is not signed in', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(false);

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(false);
      expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
    });

    it('should return false if getTokens fails', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(
        new Error('Token error'),
      );

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(false);
    });

    it('should return false if no access token', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: null,
      });

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(false);
    });

    it('should return false if access token is empty string', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: '',
      });

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(false);
    });

    it('should return false if hasPreviousSignIn fails', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockRejectedValue(
        new Error('Check failed'),
      );

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(false);
    });

    it('should return true if access token exists', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'valid_access_token_xyz',
      });

      const result = await isGoogleDriveAvailable();

      expect(result).toBe(true);
    });
  });

  // ============= requestDrivePermissions =============
  describe('requestDrivePermissions', () => {
    it('should request permissions successfully', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockResolvedValue(undefined);

      const result = await requestDrivePermissions();

      expect(result.success).toBe(true);
      expect(GoogleSignin.addScopes).toHaveBeenCalledWith({
        scopes: [
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });
    });

    it('should handle permission request error', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await requestDrivePermissions();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle user cancellation', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockRejectedValue(
        new Error('User cancelled'),
      );

      const result = await requestDrivePermissions();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include drive.appdata scope', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockResolvedValue(undefined);

      await requestDrivePermissions();

      expect(GoogleSignin.addScopes).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining([
            'https://www.googleapis.com/auth/drive.appdata',
          ]),
        }),
      );
    });

    it('should include drive.file scope', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockResolvedValue(undefined);

      await requestDrivePermissions();

      expect(GoogleSignin.addScopes).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining([
            'https://www.googleapis.com/auth/drive.file',
          ]),
        }),
      );
    });

    it('should handle network error during permission request', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockRejectedValue(
        new Error('Network timeout'),
      );

      const result = await requestDrivePermissions();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle non-Error rejection', async () => {
      (GoogleSignin.addScopes as jest.Mock).mockRejectedValue('Unknown error');

      const result = await requestDrivePermissions();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ============= Integration-like tests =============
  describe('Integration scenarios', () => {
    it('should handle complete upload workflow', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('backup_data');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'uploaded_file_id' }),
      });

      const uploadResult = await uploadToGoogleDrive(
        '/backups/data.json',
        'data.json',
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileId).toBe('uploaded_file_id');
    });

    it('should handle download after listing', async () => {
      // List files
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          files: [{ id: 'file_to_download', name: 'backup.json' }],
        }),
      });

      const listResult = await listGoogleDriveBackups();
      expect(listResult.success).toBe(true);

      // Download the file
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('{"restored": true}'),
      });
      (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

      const downloadResult = await downloadFromGoogleDrive(
        'file_to_download',
        '/restore/data.json',
      );

      expect(downloadResult.success).toBe(true);
    });

    it('should handle check availability before permission request', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });

      const isAvailable = await isGoogleDriveAvailable();
      expect(isAvailable).toBe(true);

      // Request more permissions
      (GoogleSignin.addScopes as jest.Mock).mockResolvedValue(undefined);
      const permResult = await requestDrivePermissions();
      expect(permResult.success).toBe(true);
    });

    it('should handle fallback when initially unavailable', async () => {
      // First check - not available
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValueOnce(
        false,
      );

      let isAvailable = await isGoogleDriveAvailable();
      expect(isAvailable).toBe(false);

      // Request permissions (in real app, user signs in)
      (GoogleSignin.addScopes as jest.Mock).mockResolvedValue(undefined);
      let permResult = await requestDrivePermissions();
      expect(permResult.success).toBe(true);

      // Check again - now available
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValueOnce(true);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'new_token',
      });

      isAvailable = await isGoogleDriveAvailable();
      expect(isAvailable).toBe(true);
    });
  });

  // ============= Edge cases and error recovery =============
  describe('Error recovery and edge cases', () => {
    it('should handle rapid successive uploads', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 100 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'file_id' }),
      });

      const results = await Promise.all([
        uploadToGoogleDrive('/file1.json', 'file1.json'),
        uploadToGoogleDrive('/file2.json', 'file2.json'),
        uploadToGoogleDrive('/file3.json', 'file3.json'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle special characters in file names', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 100 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'special_file_id' }),
      });

      const result = await uploadToGoogleDrive(
        '/test/file.json',
        'backup-2024-01-15_14:30:45.json',
      );

      expect(result.success).toBe(true);
    });

    it('should handle Unicode characters in file names', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 100 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'unicode_file_id' }),
      });

      const result = await uploadToGoogleDrive(
        '/test/file.json',
        'backup-备份-バックアップ.json',
      );

      expect(result.success).toBe(true);
    });

    it('should handle very long file names', async () => {
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        accessToken: 'test_token',
      });
      (RNFS.readFile as jest.Mock).mockResolvedValue('content');
      (RNFS.stat as jest.Mock).mockResolvedValue({ size: 100 });
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'long_name_file_id' }),
      });

      const longName =
        'backup_' + 'a'.repeat(200) + '_backup_2024_password_manager.json';

      const result = await uploadToGoogleDrive('/test/file.json', longName);

      expect(result.success).toBe(true);
    });

    it('should preserve error context through error handling chain', async () => {
      const customError = new Error('Custom specific error');
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(customError);

      const result = await uploadToGoogleDrive('/test/file.json', 'file.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticate');
    });
  });
});
