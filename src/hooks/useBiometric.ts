import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BiometricService,
  BiometricCapability,
  BiometricAuthResult,
} from '../services/biometricService';
import { useAppDispatch, useAppSelector } from './redux';
import {
  setBiometricEnabled,
  setBiometricType,
} from '../store/slices/settingsSlice';
import { RootState } from '../store';

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

  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isSetup, setIsSetup] = useState<boolean>(false);
  const [biometryType, setBiometryTypeLocal] = useState<string>(
    'Biometric Authentication',
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current security state to avoid circular dependencies
  const securityRef = useRef(security);
  securityRef.current = security;

  /**
   * Check biometric capability and setup status
   */
  const checkCapability = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const biometricService = BiometricService.getInstance();

      // Check device capability
      const capability: BiometricCapability =
        await biometricService.checkBiometricCapability();

      setIsAvailable(capability.available);

      if (capability.available && capability.biometryType) {
        const typeName = biometricService.getBiometricTypeName(
          capability.biometryType,
        );
        setBiometryTypeLocal(typeName);
        dispatch(setBiometricType(typeName));
      }

      // Check if biometric is set up
      if (capability.available) {
        const setupStatus = await biometricService.isBiometricSetup();
        // Biometric capability checked

        setIsSetup(setupStatus);

        // Only update Redux if different (avoid circular updates)
        const currentEnabled = securityRef.current.biometricEnabled;
        if (currentEnabled !== setupStatus) {
          // Syncing Redux state
          dispatch(setBiometricEnabled(setupStatus));
        }
      } else {
        // Biometric not available, disabling
        setIsSetup(false);
        dispatch(setBiometricEnabled(false));
      }

      if (capability.error) {
        setError(capability.error);
      }
    } catch (err) {
      console.error('Error checking biometric capability:', err);
      setError('Failed to check biometric capability');
      setIsAvailable(false);
      setIsSetup(false);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]); // Remove security.biometricEnabled to avoid circular dependency

  /**
   * Setup biometric authentication
   */
  const setupBiometric = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const biometricService = BiometricService.getInstance();
      const result: BiometricAuthResult =
        await biometricService.setupBiometricAuth();

      if (result.success) {
        console.log('📱 useBiometric: Setup successful, updating states...');
        setIsSetup(true);
        dispatch(setBiometricEnabled(true));
        console.log('📱 useBiometric: Redux state updated to enabled=true');
        return true;
      } else {
        console.error('📱 useBiometric: Setup failed:', result.error);
        setError(result.error || 'Failed to setup biometric authentication');
        return false;
      }
    } catch (err) {
      console.error('Error setting up biometric:', err);
      setError('Failed to setup biometric authentication');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  /**
   * Authenticate using biometrics
   */
  const authenticate = useCallback(
    async (message?: string): Promise<boolean> => {
      try {
        console.log('📱 useBiometric.authenticate: Starting authentication...');
        console.log('📱 useBiometric.authenticate: message =', message);
        console.log(
          '📱 useBiometric.authenticate: biometryType =',
          biometryType,
        );

        setIsLoading(true);
        setError(null);

        const biometricService = BiometricService.getInstance();
        const authMessage = message || `Authenticate with ${biometryType}`;

        // Calling biometric authentication service
        const result: BiometricAuthResult =
          await biometricService.authenticateWithBiometrics(authMessage);

        // Authentication completed

        if (result.success) {
          console.log('📱 useBiometric.authenticate: SUCCESS!');
          return true;
        } else {
          console.log(
            '📱 useBiometric.authenticate: FAILED - error =',
            result.error,
          );
          setError(result.error || 'Authentication failed');
          return false;
        }
      } catch (err) {
        console.error(
          '📱 useBiometric.authenticate: EXCEPTION during authentication:',
          err,
        );
        setError('Authentication failed');
        return false;
      } finally {
        console.log(
          '📱 useBiometric.authenticate: Cleaning up - setIsLoading(false)',
        );
        setIsLoading(false);
      }
    },
    [biometryType],
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
        setIsSetup(false);
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
  }, []);

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

  // Check capability on mount only
  useEffect(() => {
    checkCapability();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync with Redux state changes
  useEffect(() => {
    if (security.biometricEnabled !== isSetup && isAvailable) {
      checkCapability();
    }
  }, [security.biometricEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    isAvailable,
    isSetup,
    biometryType,
    isLoading,
    error,

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
