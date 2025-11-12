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

        // ⚠️ DO NOT automatically sync Redux state with device capability
        // This would override user's explicit settings (e.g., after restore from backup)
        // Only update local state, let Redux state be controlled by user actions
      } else {
        // Biometric not available, disabling
        setIsSetup(false);
        // Only disable in Redux if biometric is not available on device
        if (securityRef.current.biometricEnabled) {
          dispatch(setBiometricEnabled(false));
        }
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
        // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
        // console.log('📱 useBiometric: Setup successful, updating states...');
        setIsSetup(true);
        dispatch(setBiometricEnabled(true));
        // console.log('📱 useBiometric: Redux state updated to enabled=true');
        return true;
      } else {
        // console.error('📱 useBiometric: Setup failed:', result.error);
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
        console.log('🔐 [useBiometric] authenticate called with message:', message);
        console.log('🔐 [useBiometric] biometryType:', biometryType);
        console.log('🔐 [useBiometric] security.biometricPreference:', security.biometricPreference);
        
        setIsLoading(true);
        setError(null);

        const biometricService = BiometricService.getInstance();
        const authMessage = message || `Authenticate with ${biometryType}`;
        
        console.log('🔐 [useBiometric] Calling authenticateWithBiometrics with message:', authMessage);

        const result: BiometricAuthResult =
          await biometricService.authenticateWithBiometrics(
            authMessage,
            security.biometricPreference,
          );

        console.log('🔐 [useBiometric] authenticateWithBiometrics result:', result);

        if (result.success) {
          console.log('✅ [useBiometric] Authentication successful');
          return true;
        } else {
          console.log('❌ [useBiometric] Authentication failed:', result.error);
          setError(result.error || 'Authentication failed');
          return false;
        }
      } catch (err) {
        console.error('❌ [useBiometric] Exception during authentication:', err);
        setError('Authentication failed');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [biometryType, security.biometricPreference],
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

  // ⚠️ REMOVED: Auto-sync with Redux state changes
  // This was causing biometric to be re-enabled after restore from backup
  // The checkCapability function should only run on mount, not on every Redux state change

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
