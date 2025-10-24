import { BiometricService } from '../biometricService';
import { SecureStorageService } from '../secureStorageService';
import { Alert, Platform } from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';

// Define BiometryTypes for testing
const BiometryTypes = {
  TouchID: 'TouchID',
  FaceID: 'FaceID',
  Fingerprint: 'Fingerprint',
  Biometrics: 'Biometrics',
};

// Mock dependencies
jest.mock('../secureStorageService');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'android',
  },
}));

let mockRNBiometrics: any;

jest.mock('react-native-biometrics', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRNBiometrics),
  BiometryTypes: {
    TouchID: 'TouchID',
    FaceID: 'FaceID',
    Fingerprint: 'Fingerprint',
    Biometrics: 'Biometrics',
  },
}));

describe('BiometricService', () => {
  let biometricService: BiometricService;
  let mockSecureStorageService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton
    (BiometricService as any).instance = undefined;

    // Setup mocks
    mockRNBiometrics = {
      isSensorAvailable: jest.fn().mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      }),
      simplePrompt: jest.fn().mockResolvedValue({ success: true }),
      biometricKeysExist: jest.fn().mockResolvedValue({ keysExist: true }),
      createKeys: jest.fn().mockResolvedValue({ publicKey: 'test_key' }),
      deleteKeys: jest.fn().mockResolvedValue(undefined),
    };

    mockSecureStorageService = {
      storeBiometricStatus: jest.fn().mockResolvedValue(undefined),
      getBiometricStatus: jest.fn().mockResolvedValue(false),
    };
    (SecureStorageService.getInstance as jest.Mock).mockReturnValue(
      mockSecureStorageService,
    );

    biometricService = BiometricService.getInstance();
  });

  // ==================== getInstance ====================
  describe('getInstance', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = BiometricService.getInstance();
      const instance2 = BiometricService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create singleton instance', () => {
      (BiometricService as any).instance = undefined;
      const instance = BiometricService.getInstance();
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(BiometricService);
    });
  });

  // ==================== checkBiometricCapability ====================
  describe('checkBiometricCapability', () => {
    it('should return available with fingerprint type', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });

      const result = await biometricService.checkBiometricCapability();

      expect(result.available).toBe(true);
      expect(result.biometryType).toBe(BiometryTypes.Fingerprint);
    });

    it('should return unavailable when biometrics not available', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: null,
      });

      const result = await biometricService.checkBiometricCapability();

      expect(result.available).toBe(false);
      expect(result.biometryType).toBeNull();
    });

    it('should handle FaceID type', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.FaceID,
      });

      const result = await biometricService.checkBiometricCapability();

      expect(result.available).toBe(true);
      expect(result.biometryType).toBe(BiometryTypes.FaceID);
    });

    it('should handle TouchID type', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.TouchID,
      });

      const result = await biometricService.checkBiometricCapability();

      expect(result.available).toBe(true);
      expect(result.biometryType).toBe(BiometryTypes.TouchID);
    });

    it('should handle sensor check errors', async () => {
      mockRNBiometrics.isSensorAvailable.mockRejectedValue(
        new Error('Sensor error'),
      );

      const result = await biometricService.checkBiometricCapability();

      expect(result.available).toBe(false);
      expect(result.error).toBe('Failed to check biometric capability');
    });
  });

  // ==================== getBiometricTypeName ====================
  describe('getBiometricTypeName', () => {
    it('should return Touch ID name', () => {
      const name = biometricService.getBiometricTypeName('TouchID' as any);
      expect(name).toBe('Touch ID');
    });

    it('should return Face ID name', () => {
      const name = biometricService.getBiometricTypeName('FaceID' as any);
      expect(name).toBe('Face ID');
    });

    it('should return Fingerprint for Android', () => {
      (Platform.OS as any) = 'android';
      const name = biometricService.getBiometricTypeName('Biometrics' as any);
      expect(name).toBe('Fingerprint');
    });

    it('should return Biometrics for iOS', () => {
      (Platform.OS as any) = 'ios';
      const name = biometricService.getBiometricTypeName('Biometrics' as any);
      expect(name).toBe('Biometrics');
    });

    it('should return default name for null', () => {
      const name = biometricService.getBiometricTypeName(null);
      expect(name).toBe('Biometric Authentication');
    });

    it('should return default name for unknown type', () => {
      const name = biometricService.getBiometricTypeName('Unknown' as any);
      expect(name).toBe('Biometric Authentication');
    });
  });

  // ==================== setupBiometricAuth ====================
  describe('setupBiometricAuth', () => {
    it('should setup biometric successfully', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockRNBiometrics.createKeys.mockResolvedValue({
        publicKey: 'my_public_key',
      });

      const result = await biometricService.setupBiometricAuth();

      expect(result.success).toBe(true);
      expect(result.publicKey).toBe('my_public_key');
    });

    it('should fail when biometrics not available', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: null,
      });

      const result = await biometricService.setupBiometricAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should handle emulator Hardware security module error', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockRNBiometrics.createKeys.mockRejectedValueOnce(
        new Error(
          'generating public private keys failed due to Hardware security module',
        ),
      );

      const result = await biometricService.setupBiometricAuth();

      expect(result.success).toBe(true);
      expect(result.publicKey).toBe('emulator_mock_key');
    });

    it('should handle KeyStore error with emulator mock', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockRNBiometrics.createKeys.mockRejectedValueOnce(
        new Error('KeyStore error'),
      );

      const result = await biometricService.setupBiometricAuth();

      expect(result.success).toBe(true);
      expect(result.publicKey).toBe('emulator_mock_key');
    });

    it('should retry on key creation failure', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockRNBiometrics.createKeys
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ publicKey: 'retry_key' });

      const result = await biometricService.setupBiometricAuth();

      expect(result.success).toBe(true);
      expect(result.publicKey).toBe('retry_key');
    });

    it('should fail on persistent key creation error', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockRNBiometrics.createKeys.mockRejectedValue(
        new Error('Persistent error'),
      );

      const result = await biometricService.setupBiometricAuth();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to setup');
    });
  });

  // ==================== authenticateWithBiometrics ====================
  describe('authenticateWithBiometrics', () => {
    beforeEach(() => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: BiometryTypes.Fingerprint,
      });
      mockSecureStorageService.getBiometricStatus.mockResolvedValue(true);
    });

    it('should authenticate successfully', async () => {
      mockRNBiometrics.simplePrompt.mockResolvedValue({ success: true });

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
    });

    it('should use custom prompt message', async () => {
      mockRNBiometrics.simplePrompt.mockResolvedValue({ success: true });

      await biometricService.authenticateWithBiometrics('Custom message');

      expect(mockRNBiometrics.simplePrompt).toHaveBeenCalledWith({
        promptMessage: 'Custom message',
        cancelButtonText: 'Cancel',
      });
    });

    it('should handle user cancellation', async () => {
      mockRNBiometrics.simplePrompt.mockResolvedValue({
        success: false,
        error: 'authentication was cancelled',
      });

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication cancelled by user');
    });

    it('should handle general authentication failure', async () => {
      mockRNBiometrics.simplePrompt.mockResolvedValue({
        success: false,
        error: 'Biometric not recognized',
      });

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Biometric not recognized');
    });

    it('should fail when biometrics not available', async () => {
      mockRNBiometrics.isSensorAvailable.mockResolvedValue({
        biometryType: null,
      });

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should fail when biometric not setup', async () => {
      mockSecureStorageService.getBiometricStatus.mockResolvedValue(false);

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not set up');
    });

    it('should handle FragmentActivity error', async () => {
      mockRNBiometrics.simplePrompt.mockRejectedValue(
        new Error('FragmentActivity must not be null'),
      );

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not ready');
    });

    it('should handle biometric error with cancellation', async () => {
      mockRNBiometrics.simplePrompt.mockRejectedValue(
        new Error('User cancelled'),
      );

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication cancelled by user');
    });

    it('should provide error message on generic error', async () => {
      mockRNBiometrics.simplePrompt.mockRejectedValue(
        new Error('Unknown error'),
      );

      const result = await biometricService.authenticateWithBiometrics();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Biometric authentication failed');
    });
  });

  // ==================== isBiometricSetup ====================
  describe('isBiometricSetup', () => {
    it('should return true when setup with keys', async () => {
      mockSecureStorageService.getBiometricStatus.mockResolvedValue(true);
      mockRNBiometrics.biometricKeysExist.mockResolvedValue({
        keysExist: true,
      });

      const result = await biometricService.isBiometricSetup();

      expect(result).toBe(true);
    });

    it('should return false when disabled in storage', async () => {
      mockSecureStorageService.getBiometricStatus.mockResolvedValue(false);

      const result = await biometricService.isBiometricSetup();

      expect(result).toBe(false);
    });

    it('should use storage status when keys dont exist', async () => {
      mockSecureStorageService.getBiometricStatus.mockResolvedValue(true);
      mockRNBiometrics.biometricKeysExist.mockResolvedValue({
        keysExist: false,
      });

      const result = await biometricService.isBiometricSetup();

      expect(result).toBe(true);
    });

    it('should use storage status when key check fails', async () => {
      mockSecureStorageService.getBiometricStatus.mockResolvedValue(true);
      mockRNBiometrics.biometricKeysExist.mockRejectedValue(
        new Error('Check failed'),
      );

      const result = await biometricService.isBiometricSetup();

      expect(result).toBe(true);
    });

    it('should return false on storage error', async () => {
      mockSecureStorageService.getBiometricStatus.mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await biometricService.isBiometricSetup();

      expect(result).toBe(false);
    });
  });

  // ==================== disableBiometricAuth ====================
  describe('disableBiometricAuth', () => {
    it('should disable biometric successfully', async () => {
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockSecureStorageService.storeBiometricStatus.mockResolvedValue(
        undefined,
      );

      const result = await biometricService.disableBiometricAuth();

      expect(result).toBe(true);
    });

    it('should return false on key deletion error', async () => {
      mockRNBiometrics.deleteKeys.mockRejectedValue(new Error('Delete failed'));

      const result = await biometricService.disableBiometricAuth();

      expect(result).toBe(false);
    });

    it('should return false on storage error', async () => {
      mockRNBiometrics.deleteKeys.mockResolvedValue(undefined);
      mockSecureStorageService.storeBiometricStatus.mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await biometricService.disableBiometricAuth();

      expect(result).toBe(false);
    });
  });

  // ==================== showBiometricSetupPrompt ====================
  describe('showBiometricSetupPrompt', () => {
    it('should show alert with correct content', () => {
      const onSetup = jest.fn();
      const onCancel = jest.fn();

      biometricService.showBiometricSetupPrompt(onSetup, onCancel);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Enable Biometric Authentication',
        expect.stringContaining('fingerprint or face'),
        expect.any(Array),
      );
    });

    it('should call callbacks on button press', () => {
      const onSetup = jest.fn();
      const onCancel = jest.fn();
      let buttons: any = [];

      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, btnArray) => {
          buttons = btnArray;
        },
      );

      biometricService.showBiometricSetupPrompt(onSetup, onCancel);

      const enableBtn = buttons.find((b: any) => b.text === 'Enable');
      const notNowBtn = buttons.find((b: any) => b.text === 'Not Now');

      enableBtn?.onPress?.();
      expect(onSetup).toHaveBeenCalled();

      notNowBtn?.onPress?.();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  // ==================== showBiometricError ====================
  describe('showBiometricError', () => {
    it('should show error alert', () => {
      biometricService.showBiometricError('Test error');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Authentication Failed',
        'Test error',
        expect.any(Array),
      );
    });

    it('should include OK button', () => {
      let buttons: any = [];
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, btnArray) => {
          buttons = btnArray;
        },
      );

      biometricService.showBiometricError('Error');

      expect(buttons.some((b: any) => b.text === 'OK')).toBe(true);
    });

    it('should include Try Again when callback provided', () => {
      let buttons: any = [];
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, btnArray) => {
          buttons = btnArray;
        },
      );

      biometricService.showBiometricError('Error', jest.fn());

      expect(buttons.some((b: any) => b.text === 'Try Again')).toBe(true);
    });

    it('should not include Try Again without callback', () => {
      let buttons: any = [];
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, btnArray) => {
          buttons = btnArray;
        },
      );

      biometricService.showBiometricError('Error');

      expect(buttons.length).toBe(1);
    });

    it('should call retry callback', () => {
      const onRetry = jest.fn();
      let buttons: any = [];
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, btnArray) => {
          buttons = btnArray;
        },
      );

      biometricService.showBiometricError('Error', onRetry);

      const retryBtn = buttons.find((b: any) => b.text === 'Try Again');
      retryBtn?.onPress?.();

      expect(onRetry).toHaveBeenCalled();
    });
  });
});
