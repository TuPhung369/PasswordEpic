import {
  requestStoragePermission,
  checkStoragePermission,
} from '../permissionsUtils';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 30,
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    check: jest.fn(),
    request: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

describe('Permissions Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  describe('requestStoragePermission - iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('should return true for iOS without requesting permission', async () => {
      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });
  });

  describe('requestStoragePermission - Android 13+', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 33;
    });

    it('should return true for Android 13+ without requesting permission', async () => {
      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('should log appropriate message for Android 13+', async () => {
      await requestStoragePermission();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Android 13+'),
      );
    });

    it('should handle API 34+', async () => {
      Platform.Version = 34;

      const result = await requestStoragePermission();

      expect(result).toBe(true);
    });
  });

  describe('requestStoragePermission - Android 11-12', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 31;
    });

    it('should return true if permission already granted', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('should request permission if not granted', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED,
      );

      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.request).toHaveBeenCalled();
    });

    it('should handle permission denied', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED,
      );

      const result = await requestStoragePermission();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should show alert with correct title when permission denied', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED,
      );

      await requestStoragePermission();

      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission Required',
        expect.stringContaining('Storage permission is required'),
      );
    });

    it('should log message for Android 11-12', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      await requestStoragePermission();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Android 11-12'),
      );
    });

    it('should handle API 30', async () => {
      Platform.Version = 30;
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
    });

    it('should handle API 32', async () => {
      Platform.Version = 32;
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
    });
  });

  describe('requestStoragePermission - Android 6-10', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 28;
    });

    it('should return true if permission already granted', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('should request permission if not granted', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED,
      );

      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.request).toHaveBeenCalled();
    });

    it('should handle permission denied', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED,
      );

      const result = await requestStoragePermission();

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should log message for Android 6-10', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      await requestStoragePermission();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Android 6-10'),
      );
    });

    it('should handle API 23', async () => {
      Platform.Version = 23;
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
    });

    it('should handle API 29', async () => {
      Platform.Version = 29;
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
    });
  });

  describe('requestStoragePermission - Error Handling', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 28;
    });

    it('should handle check permission errors', async () => {
      const testError = new Error('Check failed');
      (PermissionsAndroid.check as jest.Mock).mockRejectedValue(testError);

      const result = await requestStoragePermission();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalled();
    });

    it('should handle request permission errors', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      const testError = new Error('Request failed');
      (PermissionsAndroid.request as jest.Mock).mockRejectedValue(testError);

      const result = await requestStoragePermission();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission Error',
        expect.stringContaining('Failed to request'),
      );
    });

    it('should show generic error alert', async () => {
      (PermissionsAndroid.check as jest.Mock).mockRejectedValue(
        new Error('Test error'),
      );

      await requestStoragePermission();

      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('checkStoragePermission - iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('should return true for iOS', async () => {
      const result = await checkStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
    });
  });

  describe('checkStoragePermission - Android 13+', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 33;
    });

    it('should return true for Android 13+', async () => {
      const result = await checkStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).not.toHaveBeenCalled();
    });
  });

  describe('checkStoragePermission - Android 6-12', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 30;
    });

    it('should return true if permission granted', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await checkStoragePermission();

      expect(result).toBe(true);
    });

    it('should return false if permission not granted', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);

      const result = await checkStoragePermission();

      expect(result).toBe(false);
    });

    it('should handle check permission errors', async () => {
      (PermissionsAndroid.check as jest.Mock).mockRejectedValue(
        new Error('Check error'),
      );

      const result = await checkStoragePermission();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('checkStoragePermission - Error Handling', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 28;
    });

    it('should handle permission check errors gracefully', async () => {
      (PermissionsAndroid.check as jest.Mock).mockRejectedValue(
        new Error('Permission check failed'),
      );

      const result = await checkStoragePermission();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking storage permission'),
        expect.any(Error),
      );
    });
  });

  describe('Permission Dialog Content', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 28;
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED,
      );
    });

    it('should include PasswordEpic in permission message', async () => {
      await requestStoragePermission();

      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining('PasswordEpic'),
        }),
      );
    });

    it('should include backup mention in permission message', async () => {
      await requestStoragePermission();

      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: expect.stringContaining('backup'),
        }),
      );
    });

    it('should have proper dialog buttons', async () => {
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED,
      );

      await requestStoragePermission();

      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          buttonPositive: expect.stringContaining('OK'),
          buttonNegative: expect.stringContaining('Cancel'),
          buttonNeutral: expect.stringContaining('Later'),
        }),
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete permission flow on Android 6-10', async () => {
      Platform.OS = 'android';
      Platform.Version = 28;

      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED,
      );

      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).toHaveBeenCalled();
      expect(PermissionsAndroid.request).toHaveBeenCalled();
    });

    it('should handle permission already granted flow', async () => {
      Platform.OS = 'android';
      Platform.Version = 28;

      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result = await requestStoragePermission();

      expect(result).toBe(true);
      expect(PermissionsAndroid.check).toHaveBeenCalled();
      expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    });

    it('should maintain consistency between request and check', async () => {
      Platform.OS = 'android';
      Platform.Version = 28;

      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const requestResult = await requestStoragePermission();
      const checkResult = await checkStoragePermission();

      // Both should indicate permission is granted
      expect(requestResult).toBe(true);
      expect(checkResult).toBe(true);
    });

    it('should handle multiple permission checks', async () => {
      Platform.OS = 'android';
      Platform.Version = 30;

      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(true);

      const result1 = await checkStoragePermission();
      const result2 = await checkStoragePermission();
      const result3 = await checkStoragePermission();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(PermissionsAndroid.check).toHaveBeenCalledTimes(3);
    });
  });
});
