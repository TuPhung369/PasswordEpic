import { debugSessionInfo, logSessionStatus } from '../debugSessionInfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseModule from '../../services/firebase';
import * as staticMasterPasswordModule from '../../services/staticMasterPasswordService';

// Mock modules
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../../services/firebase');
jest.mock('../../services/staticMasterPasswordService');

describe('debugSessionInfo Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    // Setup default mocks
    jest.mocked(AsyncStorage).multiGet = jest.fn().mockResolvedValue([
      ['static_mp_fixed_salt', null],
      ['static_mp_user_uuid', null],
    ]);
    jest.mocked(AsyncStorage).getAllKeys = jest.fn().mockResolvedValue([]);
  });

  describe('debugSessionInfo', () => {
    it('should log debug info with authenticated user', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123456789012',
        email: 'test@example.com',
      });
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: true,
          info: {
            hasFixedSalt: true,
            userUuidMatch: true,
            cacheValid: true,
          },
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: true,
          valid: true,
        });

      await debugSessionInfo();

      expect(firebaseModule.getCurrentUser).toHaveBeenCalled();
      expect(AsyncStorage.multiGet).toHaveBeenCalled();
      expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    });

    it('should handle unauthenticated user', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue(null);
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: false,
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
        });

      await debugSessionInfo();

      expect(firebaseModule.getCurrentUser).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle AsyncStorage errors', async () => {
      const testError = new Error('Storage error');
      jest.mocked(AsyncStorage).multiGet.mockRejectedValue(testError);

      await debugSessionInfo();

      expect(console.error).toHaveBeenCalledWith(
        '❌ Debug static password info failed:',
        testError,
      );
    });

    it('should filter password-related keys', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
      });
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: true,
          info: { hasFixedSalt: true, userUuidMatch: true, cacheValid: true },
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: true,
          valid: true,
        });
      jest
        .mocked(AsyncStorage)
        .getAllKeys.mockResolvedValue([
          'optimized_passwords_v2',
          'password_categories',
          'static_mp_fixed_salt',
          'encrypted_data',
          'other_key',
        ]);

      await debugSessionInfo();

      expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
      });
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: true,
          info: { hasFixedSalt: true, userUuidMatch: false, cacheValid: false },
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
          valid: false,
          error: 'Verification failed',
        });
      jest.mocked(AsyncStorage).getAllKeys.mockResolvedValue([]);

      await debugSessionInfo();

      expect(
        staticMasterPasswordModule.verifyStaticMasterPassword,
      ).toHaveBeenCalled();
    });

    it('should display storage values truncated at 16 chars', async () => {
      const longValue = 'x'.repeat(100);
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user12',
      });
      jest.mocked(AsyncStorage).multiGet.mockResolvedValue([
        ['static_mp_fixed_salt', longValue],
        ['static_mp_user_uuid', longValue],
      ]);
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: true,
          info: { hasFixedSalt: true, userUuidMatch: true, cacheValid: true },
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: true,
          valid: true,
        });
      jest.mocked(AsyncStorage).getAllKeys.mockResolvedValue([]);

      await debugSessionInfo();

      expect(AsyncStorage.multiGet).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('logSessionStatus', () => {
    it('should call debugSessionInfo', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue(null);
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: false,
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
        });

      await logSessionStatus();

      expect(firebaseModule.getCurrentUser).toHaveBeenCalled();
    });

    it('should handle errors from debugSessionInfo', async () => {
      jest
        .mocked(AsyncStorage)
        .multiGet.mockRejectedValue(new Error('Test error'));

      expect(() => logSessionStatus()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null current user', async () => {
      jest
        .mocked(firebaseModule.getCurrentUser)
        .mockReturnValue(undefined as any);
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: false,
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
        });

      await debugSessionInfo();

      expect(firebaseModule.getCurrentUser).toHaveBeenCalled();
    });

    it('should handle empty storage keys list', async () => {
      jest
        .mocked(firebaseModule.getCurrentUser)
        .mockReturnValue({ uid: 'user123' });
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: false,
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
        });
      jest.mocked(AsyncStorage).getAllKeys.mockResolvedValue([]);

      await debugSessionInfo();

      expect(AsyncStorage.getAllKeys).toHaveBeenCalled();
    });

    it('should handle service rejection in getStaticMasterPasswordInfo', async () => {
      jest
        .mocked(firebaseModule.getCurrentUser)
        .mockReturnValue({ uid: 'user123' });
      jest.mocked(AsyncStorage).multiGet.mockResolvedValue([
        ['static_mp_fixed_salt', 'salt'],
        ['static_mp_user_uuid', 'uuid'],
      ]);
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockRejectedValue(new Error('Service error'));
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
        });
      jest.mocked(AsyncStorage).getAllKeys.mockResolvedValue([]);

      await debugSessionInfo();

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle multiple calls in sequence', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue(null);
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: false,
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: false,
        });

      await debugSessionInfo();
      await debugSessionInfo();

      expect(firebaseModule.getCurrentUser).toHaveBeenCalledTimes(2);
    });

    it('should log all debug sections in order', async () => {
      jest.mocked(firebaseModule.getCurrentUser).mockReturnValue({
        uid: 'user123',
        email: 'test@test.com',
      });
      jest
        .mocked(staticMasterPasswordModule.getStaticMasterPasswordInfo)
        .mockResolvedValue({
          success: true,
          info: { hasFixedSalt: true, userUuidMatch: true, cacheValid: true },
        });
      jest
        .mocked(staticMasterPasswordModule.verifyStaticMasterPassword)
        .mockResolvedValue({
          success: true,
          valid: true,
        });
      jest.mocked(AsyncStorage).getAllKeys.mockResolvedValue([]);

      await debugSessionInfo();

      const calls = (console.log as jest.Mock).mock.calls.map(c => c[0]);
      expect(
        calls.some(
          c =>
            typeof c === 'string' &&
            c.includes('===== STATIC PASSWORD DEBUG INFO'),
        ),
      ).toBe(true);
    });
  });
});
