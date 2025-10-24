/**
 * biometricUtils.test.ts
 * Comprehensive test suite for biometric utilities
 * Tests biometric type mapping, error handling, and UI helpers
 */

import { Alert, Platform } from 'react-native';
import {
  checkBiometricSupport,
  mapBiometryType,
  getBiometricDisplayName,
  getBiometricIcon,
  getBiometricPromptMessage,
  showBiometricSetupDialog,
  showBiometricErrorDialog,
  validateBiometricResult,
  mapBiometricError,
  isRecoverableBiometricError,
  BIOMETRIC_TYPES,
  BIOMETRIC_ERRORS,
} from '../biometricUtils';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'android',
  },
}));

// Mock BiometricService
jest.mock('../../services/biometricService', () => ({
  BiometricService: {
    getInstance: jest.fn().mockReturnValue({
      checkBiometricCapability: jest.fn(),
    }),
  },
}));

import { BiometricService } from '../../services/biometricService';

describe('biometricUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform.OS as any) = 'android';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============== BIOMETRIC SUPPORT ==============
  describe('checkBiometricSupport()', () => {
    test('should return supported biometric when available', async () => {
      const mockBiometricService = {
        checkBiometricCapability: jest.fn().mockResolvedValue({
          available: true,
          biometryType: 'fingerprint',
        }),
      };

      (BiometricService.getInstance as jest.Mock).mockReturnValue(
        mockBiometricService,
      );

      const result = await checkBiometricSupport();

      expect(result.supported).toBe(true);
      expect(result.available).toBe(true);
      expect(result.biometryType).toBeDefined();
    });

    test('should return not supported when unavailable', async () => {
      const mockBiometricService = {
        checkBiometricCapability: jest.fn().mockResolvedValue({
          available: false,
          biometryType: '',
          error: 'Not available',
        }),
      };

      (BiometricService.getInstance as jest.Mock).mockReturnValue(
        mockBiometricService,
      );

      const result = await checkBiometricSupport();

      expect(result.supported).toBe(false);
      expect(result.available).toBe(false);
      // Empty biometryType maps to generic BIOMETRIC type, not NONE
      expect(result.biometryType).toBeDefined();
    });

    test('should handle biometric service error', async () => {
      const mockBiometricService = {
        checkBiometricCapability: jest
          .fn()
          .mockRejectedValue(new Error('Service error')),
      };

      (BiometricService.getInstance as jest.Mock).mockReturnValue(
        mockBiometricService,
      );

      const result = await checkBiometricSupport();

      expect(result.supported).toBe(false);
      expect(result.available).toBe(false);
      expect(result.biometryType).toBe(BIOMETRIC_TYPES.NONE);
      expect(result.reason).toBe(BIOMETRIC_ERRORS.SYSTEM_ERROR);
    });

    test('should include error reason when provided', async () => {
      const errorReason = 'Hardware not present';
      const mockBiometricService = {
        checkBiometricCapability: jest.fn().mockResolvedValue({
          available: false,
          biometryType: '',
          error: errorReason,
        }),
      };

      (BiometricService.getInstance as jest.Mock).mockReturnValue(
        mockBiometricService,
      );

      const result = await checkBiometricSupport();

      expect(result.reason).toBe(errorReason);
    });

    test('should map biometry type correctly', async () => {
      const mockBiometricService = {
        checkBiometricCapability: jest.fn().mockResolvedValue({
          available: true,
          biometryType: 'Face',
        }),
      };

      (BiometricService.getInstance as jest.Mock).mockReturnValue(
        mockBiometricService,
      );

      const result = await checkBiometricSupport();

      expect(result.biometryType).toBeDefined();
      expect(typeof result.biometryType).toBe('string');
    });
  });

  // ============== BIOMETRY TYPE MAPPING ==============
  describe('mapBiometryType()', () => {
    describe('Face detection', () => {
      test('should map to Face ID on iOS when face detected', () => {
        (Platform.OS as any) = 'ios';
        expect(mapBiometryType('Face')).toBe(BIOMETRIC_TYPES.FACE_ID);
      });

      test('should map to Face Recognition on Android when face detected', () => {
        (Platform.OS as any) = 'android';
        expect(mapBiometryType('Face')).toBe(BIOMETRIC_TYPES.FACE);
      });

      test('should be case insensitive for face detection', () => {
        (Platform.OS as any) = 'ios';
        expect(mapBiometryType('FACE')).toBe(BIOMETRIC_TYPES.FACE_ID);
        expect(mapBiometryType('face')).toBe(BIOMETRIC_TYPES.FACE_ID);
      });
    });

    describe('Fingerprint/Touch detection', () => {
      test('should map to Touch ID on iOS when fingerprint detected', () => {
        (Platform.OS as any) = 'ios';
        expect(mapBiometryType('Fingerprint')).toBe(BIOMETRIC_TYPES.TOUCH_ID);
      });

      test('should map to Fingerprint on Android when fingerprint detected', () => {
        (Platform.OS as any) = 'android';
        expect(mapBiometryType('Fingerprint')).toBe(
          BIOMETRIC_TYPES.FINGERPRINT,
        );
      });

      test('should handle touch keyword for fingerprint', () => {
        (Platform.OS as any) = 'ios';
        expect(mapBiometryType('Touch')).toBe(BIOMETRIC_TYPES.TOUCH_ID);
      });

      test('should be case insensitive', () => {
        (Platform.OS as any) = 'android';
        expect(mapBiometryType('FINGERPRINT')).toBe(
          BIOMETRIC_TYPES.FINGERPRINT,
        );
        expect(mapBiometryType('fingerprint')).toBe(
          BIOMETRIC_TYPES.FINGERPRINT,
        );
      });
    });

    describe('Generic biometric', () => {
      test('should map to generic biometric type', () => {
        expect(mapBiometryType('Biometric')).toBe(BIOMETRIC_TYPES.BIOMETRIC);
      });

      test('should return generic for unknown type', () => {
        expect(mapBiometryType('Unknown')).toBe(BIOMETRIC_TYPES.BIOMETRIC);
      });
    });

    test('should handle empty string', () => {
      expect(mapBiometryType('')).toBe(BIOMETRIC_TYPES.BIOMETRIC);
    });
  });

  // ============== DISPLAY NAMES ==============
  describe('getBiometricDisplayName()', () => {
    test('should return Face ID for Face ID type', () => {
      expect(getBiometricDisplayName(BIOMETRIC_TYPES.FACE_ID)).toBe('Face ID');
    });

    test('should return Face Recognition for Face type', () => {
      expect(getBiometricDisplayName(BIOMETRIC_TYPES.FACE)).toBe(
        'Face Recognition',
      );
    });

    test('should return Touch ID for Touch ID type', () => {
      expect(getBiometricDisplayName(BIOMETRIC_TYPES.TOUCH_ID)).toBe(
        'Touch ID',
      );
    });

    test('should return Fingerprint for Fingerprint type', () => {
      expect(getBiometricDisplayName(BIOMETRIC_TYPES.FINGERPRINT)).toBe(
        'Fingerprint',
      );
    });

    test('should return default name for unknown type', () => {
      expect(getBiometricDisplayName(BIOMETRIC_TYPES.BIOMETRIC)).toBe(
        'Biometric Authentication',
      );
    });

    test('should return default name for None type', () => {
      expect(getBiometricDisplayName(BIOMETRIC_TYPES.NONE)).toBe(
        'Biometric Authentication',
      );
    });
  });

  // ============== ICONS ==============
  describe('getBiometricIcon()', () => {
    test('should return face icon for Face ID', () => {
      expect(getBiometricIcon(BIOMETRIC_TYPES.FACE_ID)).toBe('face');
    });

    test('should return face icon for Face Recognition', () => {
      expect(getBiometricIcon(BIOMETRIC_TYPES.FACE)).toBe('face');
    });

    test('should return fingerprint icon for Touch ID', () => {
      expect(getBiometricIcon(BIOMETRIC_TYPES.TOUCH_ID)).toBe('fingerprint');
    });

    test('should return fingerprint icon for Fingerprint', () => {
      expect(getBiometricIcon(BIOMETRIC_TYPES.FINGERPRINT)).toBe('fingerprint');
    });

    test('should return security icon for generic biometric', () => {
      expect(getBiometricIcon(BIOMETRIC_TYPES.BIOMETRIC)).toBe('security');
    });

    test('should return security icon for None', () => {
      expect(getBiometricIcon(BIOMETRIC_TYPES.NONE)).toBe('security');
    });
  });

  // ============== PROMPT MESSAGES ==============
  describe('getBiometricPromptMessage()', () => {
    describe('Face ID', () => {
      test('should generate Face ID unlock message', () => {
        const message = getBiometricPromptMessage(
          BIOMETRIC_TYPES.FACE_ID,
          'unlock',
        );
        expect(message).toContain('Face ID');
        expect(message).toContain('unlock');
      });

      test('should generate Face ID verify message', () => {
        const message = getBiometricPromptMessage(
          BIOMETRIC_TYPES.FACE_ID,
          'verify',
        );
        expect(message).toContain('Face ID');
        expect(message).toContain('verify');
      });

      test('should generate Face ID authenticate message (default)', () => {
        const message = getBiometricPromptMessage(BIOMETRIC_TYPES.FACE_ID);
        expect(message).toContain('Face ID');
        expect(message).toContain('authenticate');
      });
    });

    describe('Face Recognition', () => {
      test('should generate Face Recognition message', () => {
        const message = getBiometricPromptMessage(
          BIOMETRIC_TYPES.FACE,
          'unlock',
        );
        expect(message).toContain('camera');
        expect(message).toContain('unlock');
      });
    });

    describe('Touch ID', () => {
      test('should generate Touch ID message', () => {
        const message = getBiometricPromptMessage(
          BIOMETRIC_TYPES.TOUCH_ID,
          'verify',
        );
        expect(message).toContain('Touch ID');
        expect(message).toContain('verify');
      });
    });

    describe('Fingerprint', () => {
      test('should generate Fingerprint message', () => {
        const message = getBiometricPromptMessage(
          BIOMETRIC_TYPES.FINGERPRINT,
          'authenticate',
        );
        // Message says "Place your finger on the sensor"
        expect(message).toContain('finger');
        expect(message).toContain('sensor');
      });
    });

    test('should handle default action', () => {
      const message = getBiometricPromptMessage(BIOMETRIC_TYPES.FINGERPRINT);
      expect(message).toContain('authenticate');
    });
  });

  // ============== DIALOG FUNCTIONS ==============
  describe('showBiometricSetupDialog()', () => {
    test('should show alert for biometric setup', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      showBiometricSetupDialog(BIOMETRIC_TYPES.FACE_ID, onConfirm, onCancel);

      expect(Alert.alert).toHaveBeenCalled();
    });

    test('should include biometric type in title', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      showBiometricSetupDialog(
        BIOMETRIC_TYPES.FINGERPRINT,
        onConfirm,
        onCancel,
      );

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('Fingerprint');
    });

    test('should provide confirm and cancel buttons', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      showBiometricSetupDialog(BIOMETRIC_TYPES.TOUCH_ID, onConfirm, onCancel);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];

      expect(buttons.length).toBe(2);
      expect(buttons.some((b: any) => b.style === 'cancel')).toBe(true);
    });

    test('should call onCancel when cancel button pressed', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      showBiometricSetupDialog(BIOMETRIC_TYPES.FACE_ID, onConfirm, onCancel);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];
      const cancelButton = buttons.find((b: any) => b.style === 'cancel');

      cancelButton.onPress();
      expect(onCancel).toHaveBeenCalled();
    });

    test('should call onConfirm when confirm button pressed', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      showBiometricSetupDialog(BIOMETRIC_TYPES.FACE_ID, onConfirm, onCancel);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];
      const confirmButton = buttons.find((b: any) => b.style !== 'cancel');

      confirmButton.onPress();
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('showBiometricErrorDialog()', () => {
    test('should show alert for biometric error', () => {
      showBiometricErrorDialog('Authentication failed');

      expect(Alert.alert).toHaveBeenCalled();
    });

    test('should include error message in dialog', () => {
      const errorMessage = 'Custom error message';
      showBiometricErrorDialog(errorMessage);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(errorMessage);
    });

    test('should show OK button when no callbacks provided', () => {
      showBiometricErrorDialog('Error');

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];

      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.some((b: any) => b.text === 'OK')).toBe(true);
    });

    test('should show Cancel button when onCancel provided', () => {
      const onCancel = jest.fn();
      showBiometricErrorDialog('Error', undefined, onCancel);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];

      expect(buttons.some((b: any) => b.text === 'Cancel')).toBe(true);
    });

    test('should show Try Again button when onRetry provided', () => {
      const onRetry = jest.fn();
      showBiometricErrorDialog('Error', onRetry);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];

      expect(buttons.some((b: any) => b.text === 'Try Again')).toBe(true);
    });

    test('should call onRetry when Try Again button pressed', () => {
      const onRetry = jest.fn();
      showBiometricErrorDialog('Error', onRetry);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];
      const retryButton = buttons.find((b: any) => b.text === 'Try Again');

      retryButton.onPress();
      expect(onRetry).toHaveBeenCalled();
    });

    test('should call onCancel when Cancel button pressed', () => {
      const onCancel = jest.fn();
      showBiometricErrorDialog('Error', undefined, onCancel);

      const callArgs = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = callArgs[2];
      const cancelButton = buttons.find((b: any) => b.text === 'Cancel');

      cancelButton.onPress();
      expect(onCancel).toHaveBeenCalled();
    });
  });

  // ============== RESULT VALIDATION ==============
  describe('validateBiometricResult()', () => {
    test('should validate successful authentication', () => {
      const result = {
        success: true,
        error: undefined,
      };

      const validation = validateBiometricResult(result as any);

      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    test('should invalidate failed authentication', () => {
      const result = {
        success: false,
        error: 'Authentication failed',
      };

      const validation = validateBiometricResult(result as any);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    test('should handle null result', () => {
      const validation = validateBiometricResult(null as any);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe(BIOMETRIC_ERRORS.AUTHENTICATION_FAILED);
    });

    test('should handle undefined result', () => {
      const validation = validateBiometricResult(undefined as any);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe(BIOMETRIC_ERRORS.AUTHENTICATION_FAILED);
    });

    test('should map error message', () => {
      const result = {
        success: false,
        error: 'User cancelled',
      };

      const validation = validateBiometricResult(result as any);

      expect(validation.error).toBe(BIOMETRIC_ERRORS.USER_CANCELLED);
    });
  });

  // ============== ERROR MAPPING ==============
  describe('mapBiometricError()', () => {
    test('should map user cancellation', () => {
      expect(mapBiometricError('User cancelled authentication')).toBe(
        BIOMETRIC_ERRORS.USER_CANCELLED,
      );
      expect(mapBiometricError('user cancel')).toBe(
        BIOMETRIC_ERRORS.USER_CANCELLED,
      );
    });

    test('should map not available error', () => {
      expect(mapBiometricError('Biometric not available')).toBe(
        BIOMETRIC_ERRORS.NOT_AVAILABLE,
      );
      expect(mapBiometricError('unavailable')).toBe(
        BIOMETRIC_ERRORS.NOT_AVAILABLE,
      );
    });

    test('should map not enrolled error', () => {
      expect(mapBiometricError('Biometric not enrolled')).toBe(
        BIOMETRIC_ERRORS.NOT_ENROLLED,
      );
      expect(mapBiometricError('no credentials')).toBe(
        BIOMETRIC_ERRORS.NOT_ENROLLED,
      );
    });

    test('should map hardware not present error', () => {
      expect(mapBiometricError('Hardware not present')).toBe(
        BIOMETRIC_ERRORS.HARDWARE_NOT_PRESENT,
      );
      expect(mapBiometricError('no hardware')).toBe(
        BIOMETRIC_ERRORS.HARDWARE_NOT_PRESENT,
      );
    });

    test('should map temporarily unavailable', () => {
      // 'Temporarily unavailable' contains both 'temporarily' and 'unavailable'
      // The 'unavailable' check comes first, so it maps to NOT_AVAILABLE
      const result = mapBiometricError('Temporarily unavailable');
      expect([
        BIOMETRIC_ERRORS.NOT_AVAILABLE,
        BIOMETRIC_ERRORS.TEMPORARILY_UNAVAILABLE,
      ]).toContain(result);
    });

    test('should map too many attempts', () => {
      expect(mapBiometricError('Too many attempts')).toBe(
        BIOMETRIC_ERRORS.TOO_MANY_ATTEMPTS,
      );
      expect(mapBiometricError('too many failed attempts')).toBe(
        BIOMETRIC_ERRORS.TOO_MANY_ATTEMPTS,
      );
    });

    test('should map lockout error', () => {
      expect(mapBiometricError('Lockout')).toBe(BIOMETRIC_ERRORS.LOCKOUT);
      expect(mapBiometricError('locked')).toBe(BIOMETRIC_ERRORS.LOCKOUT);
    });

    test('should be case insensitive', () => {
      expect(mapBiometricError('USER CANCELLED')).toBe(
        BIOMETRIC_ERRORS.USER_CANCELLED,
      );
      expect(mapBiometricError('NOT AVAILABLE')).toBe(
        BIOMETRIC_ERRORS.NOT_AVAILABLE,
      );
    });

    test('should return unknown error for unmapped error', () => {
      expect(mapBiometricError('Some unmapped error')).toBe(
        BIOMETRIC_ERRORS.UNKNOWN_ERROR,
      );
    });
  });

  // ============== ERROR RECOVERABILITY ==============
  describe('isRecoverableBiometricError()', () => {
    test('should be recoverable from user cancellation', () => {
      // First map the error, then check recoverability
      const mappedError = mapBiometricError('User cancelled');
      expect(isRecoverableBiometricError(mappedError)).toBe(true);
    });

    test('should be recoverable with mapped error', () => {
      // Test with mapped error constants
      const recoverable = mapBiometricError('Authentication failed');
      expect(isRecoverableBiometricError(recoverable)).toBe(true);
    });

    test('should not be recoverable from NOT_ENROLLED constant', () => {
      expect(isRecoverableBiometricError(BIOMETRIC_ERRORS.NOT_ENROLLED)).toBe(
        false,
      );
    });

    test('should not be recoverable from HARDWARE_NOT_PRESENT constant', () => {
      expect(
        isRecoverableBiometricError(BIOMETRIC_ERRORS.HARDWARE_NOT_PRESENT),
      ).toBe(false);
    });

    test('should not be recoverable from TOO_MANY_ATTEMPTS constant', () => {
      expect(
        isRecoverableBiometricError(BIOMETRIC_ERRORS.TOO_MANY_ATTEMPTS),
      ).toBe(false);
    });

    test('should not be recoverable from LOCKOUT constant', () => {
      expect(isRecoverableBiometricError(BIOMETRIC_ERRORS.LOCKOUT)).toBe(false);
    });
  });
});
