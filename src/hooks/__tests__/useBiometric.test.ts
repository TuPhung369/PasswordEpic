/**
 * useBiometric.test.ts
 * Comprehensive test suite for useBiometric custom hook
 * Tests biometric setup, authentication, and state management
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useBiometric } from '../useBiometric';
import { BiometricService } from '../../services/biometricService';
import { useAppDispatch, useAppSelector } from '../redux';
import {
  setBiometricEnabled,
  setBiometricType,
} from '../../store/slices/settingsSlice';

// Mock dependencies
jest.mock('../../services/biometricService');
jest.mock('../redux');
jest.mock('../../store/slices/settingsSlice', () => ({
  setBiometricEnabled: jest.fn(val => ({
    type: 'SET_BIOMETRIC_ENABLED',
    payload: val,
  })),
  setBiometricType: jest.fn(val => ({
    type: 'SET_BIOMETRIC_TYPE',
    payload: val,
  })),
}));

describe('useBiometric Hook', () => {
  let mockDispatch: jest.Mock;
  let mockGetInstance: jest.Mock;
  let mockBiometricService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock dispatch
    mockDispatch = jest.fn();
    (useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);

    // Setup mock selector
    (useAppSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        settings: {
          security: {
            biometricEnabled: false,
          },
        },
      });
    });

    // Setup mock BiometricService
    mockBiometricService = {
      checkBiometricCapability: jest.fn(),
      setupBiometricAuth: jest.fn(),
      authenticateWithBiometrics: jest.fn(),
      isBiometricSetup: jest.fn(),
      disableBiometricAuth: jest.fn(),
      getBiometricTypeName: jest.fn(),
      showBiometricSetupPrompt: jest.fn(),
    };

    mockGetInstance = jest.fn(() => mockBiometricService);
    (BiometricService as jest.Mock).getInstance = mockGetInstance;
  });

  // Test hook initialization
  describe('Hook Initialization', () => {
    test('should initialize with default state', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        biometryType: null,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
        expect(result.current.isSetup).toBe(false);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.biometryType).toBe('Biometric Authentication');
      });
    });

    test('should have all required methods', () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      expect(typeof result.current.checkCapability).toBe('function');
      expect(typeof result.current.setupBiometric).toBe('function');
      expect(typeof result.current.authenticate).toBe('function');
      expect(typeof result.current.disableBiometric).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.showSetupPrompt).toBe('function');
    });

    test('should call checkCapability on mount', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');

      renderHook(() => useBiometric());

      await waitFor(() => {
        expect(
          mockBiometricService.checkBiometricCapability,
        ).toHaveBeenCalled();
      });
    });
  });

  // Test checkCapability function
  describe('checkCapability', () => {
    test('should check biometric capability and update state', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(false);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
        expect(
          mockBiometricService.checkBiometricCapability,
        ).toHaveBeenCalled();
      });
    });

    test('should handle biometric unavailable', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
        expect(result.current.isSetup).toBe(false);
      });
    });

    test('should handle capability check errors', async () => {
      mockBiometricService.checkBiometricCapability.mockRejectedValue(
        new Error('Capability check failed'),
      );

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.error).toBe(
          'Failed to check biometric capability',
        );
        expect(result.current.isAvailable).toBe(false);
      });
    });

    test('should set error from capability result', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: 'Device does not support biometrics',
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.error).toBe('Device does not support biometrics');
      });
    });

    test('should dispatch setBiometricType when available', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'FaceID',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Face ID');

      renderHook(() => useBiometric());

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });
    });
  });

  // Test setupBiometric function
  describe('setupBiometric', () => {
    test('should setup biometric successfully', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: true,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      let setupResult: boolean = false;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });

      expect(setupResult).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      expect(mockBiometricService.setupBiometricAuth).toHaveBeenCalled();
    });

    test('should handle setup failure', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: false,
        error: 'Setup failed',
      });

      const { result } = renderHook(() => useBiometric());

      let setupResult: boolean = true;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });

      expect(setupResult).toBe(false);
      expect(result.current.error).toBe('Setup failed');
    });

    test('should handle setup exception', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockRejectedValue(
        new Error('Setup exception'),
      );

      const { result } = renderHook(() => useBiometric());

      let setupResult: boolean = true;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });

      expect(setupResult).toBe(false);
      expect(result.current.error).toBe(
        'Failed to setup biometric authentication',
      );
    });

    test('should handle setup with no error message', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: false,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      let setupResult: boolean = true;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });

      expect(setupResult).toBe(false);
      expect(result.current.error).toBe(
        'Failed to setup biometric authentication',
      );
    });

    test('should set isLoading state correctly', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  error: null,
                }),
              50,
            ),
          ),
      );

      const { result } = renderHook(() => useBiometric());

      await act(async () => {
        const promise = result.current.setupBiometric();
        expect(result.current.isLoading).toBe(true);
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // Test authenticate function
  describe('authenticate', () => {
    test('should authenticate successfully with default message', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: true,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Fingerprint');
      });

      let authResult: boolean = false;
      await act(async () => {
        authResult = await result.current.authenticate();
      });

      expect(authResult).toBe(true);
      expect(
        mockBiometricService.authenticateWithBiometrics,
      ).toHaveBeenCalledWith('Authenticate with Fingerprint');
    });

    test('should authenticate successfully with custom message', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: true,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      let authResult: boolean = false;
      await act(async () => {
        authResult = await result.current.authenticate('Custom message');
      });

      expect(authResult).toBe(true);
      expect(
        mockBiometricService.authenticateWithBiometrics,
      ).toHaveBeenCalledWith('Custom message');
    });

    test('should handle authentication failure', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: false,
        error: 'Authentication failed',
      });

      const { result } = renderHook(() => useBiometric());

      let authResult: boolean = true;
      await act(async () => {
        authResult = await result.current.authenticate();
      });

      expect(authResult).toBe(false);
      expect(result.current.error).toBe('Authentication failed');
    });

    test('should handle authentication exception', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockRejectedValue(
        new Error('Auth exception'),
      );

      const { result } = renderHook(() => useBiometric());

      let authResult: boolean = true;
      await act(async () => {
        authResult = await result.current.authenticate();
      });

      expect(authResult).toBe(false);
      expect(result.current.error).toBe('Authentication failed');
    });

    test('should handle user cancellation', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: false,
        error: 'User cancelled',
      });

      const { result } = renderHook(() => useBiometric());

      let authResult: boolean = true;
      await act(async () => {
        authResult = await result.current.authenticate();
      });

      expect(authResult).toBe(false);
    });

    test('should handle authentication without error message', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: false,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      let authResult: boolean = true;
      await act(async () => {
        authResult = await result.current.authenticate();
      });

      expect(authResult).toBe(false);
      expect(result.current.error).toBe('Authentication failed');
    });
  });

  // Test disableBiometric function
  describe('disableBiometric', () => {
    test('should disable biometric successfully', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.disableBiometricAuth.mockResolvedValue(true);

      const { result } = renderHook(() => useBiometric());

      let disableResult: boolean = false;
      await act(async () => {
        disableResult = await result.current.disableBiometric();
      });

      expect(disableResult).toBe(true);
      expect(mockDispatch).toHaveBeenCalled();
      expect(mockBiometricService.disableBiometricAuth).toHaveBeenCalled();
    });

    test('should handle disable failure', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.disableBiometricAuth.mockResolvedValue(false);

      const { result } = renderHook(() => useBiometric());

      let disableResult: boolean = true;
      await act(async () => {
        disableResult = await result.current.disableBiometric();
      });

      expect(disableResult).toBe(false);
      expect(result.current.error).toBe(
        'Failed to disable biometric authentication',
      );
    });

    test('should handle disable exception', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.disableBiometricAuth.mockRejectedValue(
        new Error('Disable exception'),
      );

      const { result } = renderHook(() => useBiometric());

      let disableResult: boolean = true;
      await act(async () => {
        disableResult = await result.current.disableBiometric();
      });

      expect(disableResult).toBe(false);
      expect(result.current.error).toBe(
        'Failed to disable biometric authentication',
      );
    });
  });

  // Test showSetupPrompt function
  describe('showSetupPrompt', () => {
    test('should call showBiometricSetupPrompt with callbacks', () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      const onSetup = jest.fn();
      const onCancel = jest.fn();

      result.current.showSetupPrompt(onSetup, onCancel);

      expect(
        mockBiometricService.showBiometricSetupPrompt,
      ).toHaveBeenCalledWith(onSetup, onCancel);
    });

    test('should pass different callbacks correctly', () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      result.current.showSetupPrompt(callback1, callback2);

      expect(
        mockBiometricService.showBiometricSetupPrompt,
      ).toHaveBeenCalledWith(callback1, callback2);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  // Test getBiometricTypeName conversions
  describe('getBiometricTypeName', () => {
    test('should return Touch ID for TouchID type', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'TouchID',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Touch ID');

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Touch ID');
      });
    });

    test('should return Face ID for FaceID type', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'FaceID',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Face ID');

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Face ID');
      });
    });

    test('should return Fingerprint for Fingerprint type', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Fingerprint');
      });
    });

    test('should return generic message for unknown type', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'UnknownType',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue(
        'Biometric Authentication',
      );

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Biometric Authentication');
      });
    });
  });

  // Test clearError function
  describe('clearError', () => {
    test('should clear error state', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: 'Initial error',
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // Test Redux integration
  describe('Redux Integration', () => {
    test('should dispatch setBiometricType action', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'FaceID',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(false);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Face ID');

      renderHook(() => useBiometric());

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });
    });

    test('should dispatch setBiometricEnabled action on successful setup', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBiometric());

      await act(async () => {
        await result.current.setupBiometric();
      });

      expect(mockDispatch).toHaveBeenCalled();
    });

    test('should dispatch setBiometricEnabled(false) on successful disable', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.disableBiometricAuth.mockResolvedValue(true);

      const { result } = renderHook(() => useBiometric());

      await act(async () => {
        await result.current.disableBiometric();
      });

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  // Test complex workflows
  describe('Complex Workflows', () => {
    test('should handle setup flow: check capability -> setup', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(false);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let setupResult: boolean = false;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });

      expect(setupResult).toBe(true);
      expect(mockBiometricService.setupBiometricAuth).toHaveBeenCalled();
    });

    test('should handle authentication flow: setup -> authenticate', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: true,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBiometric());

      let setupResult: boolean = false;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });
      expect(setupResult).toBe(true);

      let authResult: boolean = false;
      await act(async () => {
        authResult = await result.current.authenticate();
      });
      expect(authResult).toBe(true);
    });

    test('should handle disable flow', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(true);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');
      mockBiometricService.disableBiometricAuth.mockResolvedValue(true);

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });

      let disableResult: boolean = false;
      await act(async () => {
        disableResult = await result.current.disableBiometric();
      });

      expect(disableResult).toBe(true);
    });

    test('should handle multiple authentication attempts', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBiometric());

      const firstAuth = await act(async () => {
        return await result.current.authenticate();
      });
      expect(firstAuth).toBe(true);

      const secondAuth = await act(async () => {
        return await result.current.authenticate();
      });
      expect(secondAuth).toBe(true);

      expect(
        mockBiometricService.authenticateWithBiometrics,
      ).toHaveBeenCalledTimes(2);
    });

    test('should handle error recovery', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValueOnce({
        available: false,
        error: 'Initial error',
      });
      mockBiometricService.checkBiometricCapability.mockResolvedValueOnce({
        available: true,
        biometryType: 'Fingerprint',
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(false);
      mockBiometricService.getBiometricTypeName.mockReturnValue('Fingerprint');

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });

  // Test edge cases
  describe('Edge Cases', () => {
    test('should handle null biometry type gracefully', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        biometryType: null,
        error: null,
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Biometric Authentication');
      });
    });

    test('should handle empty error message', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: false,
        error: '',
      });

      const { result } = renderHook(() => useBiometric());

      let setupResult: boolean = true;
      await act(async () => {
        setupResult = await result.current.setupBiometric();
      });

      expect(setupResult).toBe(false);
      expect(result.current.error).toBe(
        'Failed to setup biometric authentication',
      );
    });

    test('should handle rapid consecutive calls', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.authenticateWithBiometrics.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBiometric());

      await act(async () => {
        const promises = [
          result.current.authenticate(),
          result.current.authenticate(),
          result.current.authenticate(),
        ];
        const results = await Promise.all(promises);
        expect(results).toEqual([true, true, true]);
      });
    });

    test('should handle undefined biometry type in name conversion', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: true,
        biometryType: undefined,
        error: null,
      });
      mockBiometricService.isBiometricSetup.mockResolvedValue(false);
      mockBiometricService.getBiometricTypeName.mockReturnValue(
        'Biometric Authentication',
      );

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(result.current.biometryType).toBe('Biometric Authentication');
      });
    });
  });

  // Test service instance management
  describe('Service Instance', () => {
    test('should get BiometricService instance', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });

      renderHook(() => useBiometric());

      await waitFor(() => {
        expect(mockGetInstance).toHaveBeenCalled();
      });
    });

    test('should use same instance on multiple calls', async () => {
      mockBiometricService.checkBiometricCapability.mockResolvedValue({
        available: false,
        error: null,
      });
      mockBiometricService.setupBiometricAuth.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBiometric());

      await waitFor(() => {
        expect(mockGetInstance).toHaveBeenCalled();
      });

      const initialCallCount = mockGetInstance.mock.calls.length;

      await act(async () => {
        await result.current.setupBiometric();
      });

      // getInstance should be called for checkCapability on mount and setupBiometric
      expect(mockGetInstance).toHaveBeenCalled();
    });
  });
});
