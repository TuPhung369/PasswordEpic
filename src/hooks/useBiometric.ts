import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BiometricService,
  BiometricAuthResult,
} from '../services/biometricService';
import { useAppDispatch, useAppSelector } from './redux';
import {
  setBiometricEnabled,
  setBiometricType,
} from '../store/slices/settingsSlice';
import { RootState } from '../store';
import { useBiometricContext } from '../contexts/BiometricContext';

export interface UseBiometricReturn {
  // State
  isAvailable: boolean;
  isSetup: boolean;
  biometryType: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkCapability: () => Promise<void>;
  setupBiometric: () => Promise<boolean>;
  authenticate: (message?: string) => Promise<boolean>;
  disableBiometric: () => Promise<boolean>;
  clearError: () => void;

  // Utils
  showSetupPrompt: (onSetup: () => void, onCancel: () => void) => void;
}

export const useBiometric = (): UseBiometricReturn => {
  const dispatch = useAppDispatch();
  const { security } = useAppSelector((state: RootState) => state.settings);

  const biometricContext = useBiometricContext();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current security state to avoid circular dependencies
  const securityRef = useRef(security);
  securityRef.current = security;

  /**
   * Check biometric capability and setup status
   * Uses context data instead of doing individual checks
   */
  const checkCapability = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      if (biometricContext.error) {
        setError(biometricContext.error);
      }

      if (!biometricContext.isAvailable) {
        // Biometric not available, disabling
        // Only disable in Redux if biometric is not available on device
        if (securityRef.current.biometricEnabled) {
          dispatch(setBiometricEnabled(false));
        }
      }

      if (biometricContext.isAvailable && biometricContext.biometryType) {
        dispatch(setBiometricType(biometricContext.biometryType));
      }
    } catch (err) {
      console.error('Error checking biometric capability:', err);
      setError('Failed to check biometric capability');
    }
  }, [dispatch, biometricContext]);

  /**
   * Setup biometric authentication
   */
  const setupBiometric = useCallback(async (): Promise<boolean> => {
    try {
      console.log(
        '🔐 [useBiometric] setupBiometric called - setting loading to true',
      );
      setIsLoading(true);
      setError(null);

      const biometricService = BiometricService.getInstance();
      console.log(
        '🔐 [useBiometric] Calling biometricService.setupBiometricAuth()',
      );
      const result: BiometricAuthResult =
        await biometricService.setupBiometricAuth();

      console.log('🔐 [useBiometric] setupBiometricAuth result:', result);

      if (result.success) {
        console.log('✅ [useBiometric] Setup successful, updating states...');
        dispatch(setBiometricEnabled(true));
        console.log('✅ [useBiometric] Redux state updated to enabled=true');
        return true;
      } else {
        console.error('❌ [useBiometric] Setup failed:', result.error);
        setError(result.error || 'Failed to setup biometric authentication');
        return false;
      }
    } catch (err) {
      console.error('❌ [useBiometric] Error setting up biometric:', err);
      setError('Failed to setup biometric authentication');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  /**
   * Authenticate using biometrics
   * @param message - Custom authentication message (optional)
   */
  const authenticate = useCallback(
    async (message?: string): Promise<boolean> => {
      try {
        console.log(
          '🔐 [useBiometric] authenticate called with message:',
          message,
        );
        console.log('🔐 [useBiometric] biometryType:', biometricContext.biometryType);
        console.log(
          '🔐 [useBiometric] security.biometricPreference:',
          security.biometricPreference,
        );

        setIsLoading(true);
        setError(null);

        const biometricService = BiometricService.getInstance();
        const authMessage = message || `Authenticate with ${biometricContext.biometryType}`;

        console.log(
          '🔐 [useBiometric] Calling authenticateWithBiometrics with message:',
          authMessage,
        );

        const result: BiometricAuthResult =
          await biometricService.authenticateWithBiometrics(
            authMessage,
            security.biometricPreference,
          );

        console.log(
          '🔐 [useBiometric] authenticateWithBiometrics result:',
          result,
        );

        if (result.success) {
          console.log('✅ [useBiometric] Authentication successful');
          return true;
        } else {
          console.log('❌ [useBiometric] Authentication failed:', result.error);
          setError(result.error || 'Authentication failed');
          return false;
        }
      } catch (err) {
        console.error(
          '❌ [useBiometric] Exception during authentication:',
          err,
        );
        setError('Authentication failed');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [security.biometricPreference, biometricContext.biometryType],
  );

  /**
   * Disable biometric authentication
   */
  const disableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const biometricService = BiometricService.getInstance();
      const success = await biometricService.disableBiometricAuth();

      if (success) {
        dispatch(setBiometricEnabled(false));
        return true;
      } else {
        setError('Failed to disable biometric authentication');
        return false;
      }
    } catch (err) {
      console.error('Error disabling biometric:', err);
      setError('Failed to disable biometric authentication');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setError(null);
    biometricContext.clearError();
  }, [biometricContext]);

  /**
   * Show biometric setup prompt
   */
  const showSetupPrompt = useCallback(
    (onSetup: () => void, onCancel: () => void): void => {
      const biometricService = BiometricService.getInstance();
      biometricService.showBiometricSetupPrompt(onSetup, onCancel);
    },
    [],
  );

  // Sync Redux state with context on mount
  useEffect(() => {
    checkCapability();
  }, [checkCapability]);

  // Combine local isLoading with context isLoading for setup/auth operations
  const effectiveIsLoading = isLoading || biometricContext.isLoading;
  const effectiveError = error || biometricContext.error;

  return {
    // State
    isAvailable: biometricContext.isAvailable,
    isSetup: biometricContext.isSetup,
    biometryType: biometricContext.biometryType,
    isLoading: effectiveIsLoading,
    error: effectiveError,

    // Actions
    checkCapability,
    setupBiometric,
    authenticate,
    disableBiometric,
    clearError,

    // Utils
    showSetupPrompt,
  };
};

export default useBiometric;
