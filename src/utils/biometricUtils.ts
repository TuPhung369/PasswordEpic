/**
 * Biometric Utilities
 *
 * Utility functions for biometric authentication operations,
 * validation, and error handling across the application.
 */

import { Alert, Platform } from 'react-native';
import {
  BiometricService,
  BiometricCapability,
  BiometricAuthResult,
} from '../services/biometricService';

// Biometric type constants
export const BIOMETRIC_TYPES = {
  FINGERPRINT: 'Fingerprint',
  FACE_ID: 'Face ID',
  FACE: 'Face Recognition',
  TOUCH_ID: 'Touch ID',
  BIOMETRIC: 'Biometric Authentication',
  NONE: 'None',
} as const;

export type BiometricType =
  (typeof BIOMETRIC_TYPES)[keyof typeof BIOMETRIC_TYPES];

// Error messages
export const BIOMETRIC_ERRORS = {
  NOT_AVAILABLE: 'Biometric authentication is not available on this device.',
  NOT_ENROLLED: 'No biometric credentials are enrolled on this device.',
  HARDWARE_NOT_PRESENT: 'Biometric hardware is not present on this device.',
  TEMPORARILY_UNAVAILABLE:
    'Biometric authentication is temporarily unavailable.',
  USER_CANCELLED: 'Biometric authentication was cancelled by the user.',
  AUTHENTICATION_FAILED: 'Biometric authentication failed. Please try again.',
  TOO_MANY_ATTEMPTS: 'Too many failed attempts. Please try again later.',
  LOCKOUT: 'Biometric authentication is locked. Please try again later.',
  SYSTEM_ERROR: 'A system error occurred during biometric authentication.',
  UNKNOWN_ERROR: 'An unknown error occurred during biometric authentication.',
} as const;

/**
 * Check if biometric authentication is supported and available
 */
export const checkBiometricSupport = async (): Promise<{
  supported: boolean;
  available: boolean;
  biometryType: BiometricType;
  reason?: string;
}> => {
  try {
    const biometricService = BiometricService.getInstance();
    const capability: BiometricCapability =
      await biometricService.checkBiometricCapability();

    return {
      supported: capability.available,
      available: capability.available,
      biometryType: mapBiometryType(capability.biometryType || ''),
      reason: capability.error || undefined,
    };
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return {
      supported: false,
      available: false,
      biometryType: BIOMETRIC_TYPES.NONE,
      reason: BIOMETRIC_ERRORS.SYSTEM_ERROR,
    };
  }
};

/**
 * Map native biometry type to standardized type
 */
export const mapBiometryType = (nativeType: string): BiometricType => {
  const lowercaseType = nativeType.toLowerCase();

  if (lowercaseType.includes('face')) {
    if (Platform.OS === 'ios') {
      return BIOMETRIC_TYPES.FACE_ID;
    }
    return BIOMETRIC_TYPES.FACE;
  }

  if (
    lowercaseType.includes('fingerprint') ||
    lowercaseType.includes('touch')
  ) {
    if (Platform.OS === 'ios') {
      return BIOMETRIC_TYPES.TOUCH_ID;
    }
    return BIOMETRIC_TYPES.FINGERPRINT;
  }

  if (lowercaseType.includes('biometric')) {
    return BIOMETRIC_TYPES.BIOMETRIC;
  }

  return BIOMETRIC_TYPES.BIOMETRIC;
};

/**
 * Get user-friendly biometric type name
 */
export const getBiometricDisplayName = (
  biometryType: BiometricType,
): string => {
  switch (biometryType) {
    case BIOMETRIC_TYPES.FACE_ID:
      return 'Face ID';
    case BIOMETRIC_TYPES.FACE:
      return 'Face Recognition';
    case BIOMETRIC_TYPES.TOUCH_ID:
      return 'Touch ID';
    case BIOMETRIC_TYPES.FINGERPRINT:
      return 'Fingerprint';
    case BIOMETRIC_TYPES.BIOMETRIC:
      return Platform.OS === 'android' ? 'Fingerprint or Face ID' : 'Biometric Authentication';
    default:
      return 'Biometric Authentication';
  }
};

/**
 * Get biometric icon name for UI
 */
export const getBiometricIcon = (biometryType: BiometricType): string => {
  switch (biometryType) {
    case BIOMETRIC_TYPES.FACE_ID:
    case BIOMETRIC_TYPES.FACE:
      return 'face';
    case BIOMETRIC_TYPES.TOUCH_ID:
    case BIOMETRIC_TYPES.FINGERPRINT:
      return 'fingerprint';
    default:
      return 'security';
  }
};

/**
 * Get biometric prompt message
 */
export const getBiometricPromptMessage = (
  biometryType: BiometricType,
  action: 'unlock' | 'verify' | 'authenticate' = 'authenticate',
): string => {
  const actionText = {
    unlock: 'unlock',
    verify: 'verify your identity',
    authenticate: 'authenticate',
  }[action];

  switch (biometryType) {
    case BIOMETRIC_TYPES.FACE_ID:
      return `Use Face ID to ${actionText}`;
    case BIOMETRIC_TYPES.FACE:
      return `Look at the camera to ${actionText}`;
    case BIOMETRIC_TYPES.TOUCH_ID:
      return `Use Touch ID to ${actionText}`;
    case BIOMETRIC_TYPES.FINGERPRINT:
      return `Place your finger on the sensor to ${actionText}`;
    case BIOMETRIC_TYPES.BIOMETRIC:
      return Platform.OS === 'android' 
        ? `Use fingerprint or face recognition to ${actionText}`
        : `Use biometric authentication to ${actionText}`;
    default:
      return `Use biometric authentication to ${actionText}`;
  }
};

/**
 * Show biometric setup confirmation dialog
 */
export const showBiometricSetupDialog = (
  biometryType: BiometricType,
  onConfirm: () => void,
  onCancel: () => void,
): void => {
  const displayName = getBiometricDisplayName(biometryType);
  const shortName = biometryType === BIOMETRIC_TYPES.BIOMETRIC && Platform.OS === 'android' 
    ? 'Biometric Authentication' 
    : displayName;

  Alert.alert(
    `Enable ${shortName}`,
    `Would you like to enable ${displayName.toLowerCase()} for quick and secure access to your passwords?`,
    [
      {
        text: 'Not Now',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: `Enable`,
        onPress: onConfirm,
      },
    ],
  );
};

/**
 * Show biometric error dialog
 */
export const showBiometricErrorDialog = (
  error: string,
  onRetry?: () => void,
  onCancel?: () => void,
): void => {
  const buttons = [];

  if (onCancel) {
    buttons.push({
      text: 'Cancel',
      style: 'cancel' as const,
      onPress: onCancel,
    });
  }

  if (onRetry) {
    buttons.push({
      text: 'Try Again',
      onPress: onRetry,
    });
  }

  if (buttons.length === 0) {
    buttons.push({ text: 'OK' });
  }

  Alert.alert('Authentication Error', error, buttons);
};

/**
 * Validate biometric authentication result
 */
export const validateBiometricResult = (
  result: BiometricAuthResult,
): {
  isValid: boolean;
  error?: string;
} => {
  if (!result) {
    return {
      isValid: false,
      error: BIOMETRIC_ERRORS.AUTHENTICATION_FAILED,
    };
  }

  if (result.success) {
    return { isValid: true };
  }

  // Map specific error types
  const errorMessage = mapBiometricError(result.error || 'Unknown error');

  return {
    isValid: false,
    error: errorMessage,
  };
};

/**
 * Map biometric error to user-friendly message
 */
export const mapBiometricError = (error: string): string => {
  const lowercaseError = error.toLowerCase();

  if (lowercaseError.includes('user') && lowercaseError.includes('cancel')) {
    return BIOMETRIC_ERRORS.USER_CANCELLED;
  }

  if (
    lowercaseError.includes('not available') ||
    lowercaseError.includes('unavailable')
  ) {
    return BIOMETRIC_ERRORS.NOT_AVAILABLE;
  }

  if (
    lowercaseError.includes('not enrolled') ||
    lowercaseError.includes('no credentials')
  ) {
    return BIOMETRIC_ERRORS.NOT_ENROLLED;
  }

  if (
    lowercaseError.includes('hardware') ||
    lowercaseError.includes('not present')
  ) {
    return BIOMETRIC_ERRORS.HARDWARE_NOT_PRESENT;
  }

  if (lowercaseError.includes('temporarily')) {
    return BIOMETRIC_ERRORS.TEMPORARILY_UNAVAILABLE;
  }

  if (
    lowercaseError.includes('too many') ||
    lowercaseError.includes('attempts')
  ) {
    return BIOMETRIC_ERRORS.TOO_MANY_ATTEMPTS;
  }

  if (lowercaseError.includes('lockout') || lowercaseError.includes('locked')) {
    return BIOMETRIC_ERRORS.LOCKOUT;
  }

  if (
    lowercaseError.includes('failed') ||
    lowercaseError.includes('authentication')
  ) {
    return BIOMETRIC_ERRORS.AUTHENTICATION_FAILED;
  }

  return BIOMETRIC_ERRORS.UNKNOWN_ERROR;
};

/**
 * Check if biometric error is recoverable (user can retry)
 */
export const isRecoverableBiometricError = (error: string): boolean => {
  const nonRecoverableErrors = [
    BIOMETRIC_ERRORS.NOT_AVAILABLE,
    BIOMETRIC_ERRORS.NOT_ENROLLED,
    BIOMETRIC_ERRORS.HARDWARE_NOT_PRESENT,
    BIOMETRIC_ERRORS.TOO_MANY_ATTEMPTS,
    BIOMETRIC_ERRORS.LOCKOUT,
  ];

  return !nonRecoverableErrors.includes(error as any);
};

/**
 * Format biometric setup instructions
 */
export const getBiometricSetupInstructions = (
  biometryType: BiometricType,
): string[] => {
  switch (biometryType) {
    case BIOMETRIC_TYPES.FACE_ID:
      return [
        '1. Position your face in front of the camera',
        '2. Follow the on-screen instructions',
        '3. Move your head in a circle to capture different angles',
        '4. Complete the setup process',
      ];

    case BIOMETRIC_TYPES.FACE:
      return [
        '1. Look directly at the camera',
        '2. Keep your face within the frame',
        '3. Follow the setup instructions',
        '4. Complete enrollment',
      ];

    case BIOMETRIC_TYPES.TOUCH_ID:
    case BIOMETRIC_TYPES.FINGERPRINT:
      return [
        '1. Place your finger on the sensor',
        '2. Lift and place your finger multiple times',
        '3. Try different angles and positions',
        '4. Complete the enrollment process',
      ];

    default:
      return [
        '1. Follow the device-specific setup instructions',
        '2. Complete the biometric enrollment',
        '3. Test the authentication',
        '4. Enable in PasswordEpic settings',
      ];
  }
};

/**
 * Get security benefits text for biometric authentication
 */
export const getBiometricSecurityBenefits = (): string[] => {
  return [
    '🔒 Enhanced security with biometric verification',
    '⚡ Quick and convenient access to your passwords',
    '🛡️ Your biometric data never leaves your device',
    '✨ Seamless authentication experience',
    '🔐 Additional layer of protection for sensitive data',
  ];
};

/**
 * Check if biometric re-authentication is needed
 * (e.g., after app backgrounding for a certain time)
 */
export const shouldRequireBiometricReauth = (
  lastAuthTime: number,
  reauthThreshold: number = 30000, // 30 seconds default
): boolean => {
  const now = Date.now();
  return now - lastAuthTime > reauthThreshold;
};

/**
 * Generate biometric challenge for enhanced security
 */
export const generateBiometricChallenge = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
};

/**
 * Validate biometric challenge
 */
export const validateBiometricChallenge = (
  challenge: string,
  maxAge: number = 300000, // 5 minutes default
): boolean => {
  try {
    const [timestampStr] = challenge.split('-');
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    return now - timestamp <= maxAge;
  } catch (error) {
    console.error('Invalid biometric challenge format:', error);
    return false;
  }
};

export default {
  BIOMETRIC_TYPES,
  BIOMETRIC_ERRORS,
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
  getBiometricSetupInstructions,
  getBiometricSecurityBenefits,
  shouldRequireBiometricReauth,
  generateBiometricChallenge,
  validateBiometricChallenge,
};
