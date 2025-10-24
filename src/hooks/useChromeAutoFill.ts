/**
 * useChromeAutoFill Hook
 *
 * React hook for integrating Chrome WebView autofill functionality.
 * Handles form detection, credential injection, and biometric authentication.
 *
 * Features:
 * - Detect login forms
 * - Inject credentials
 * - Biometric authentication before injection
 * - Error handling
 * - Loading states
 *
 * @author PasswordEpic Team
 * @since Week 10 - Chrome Integration Phase
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, AppStateStatus } from 'react-native';
import {
  chromeAutoFillService,
  type DetectionResult,
  type ChromeAutoFillOptions,
} from '../services/chromeAutoFillService';
import { biometricService } from '../services/biometricService';
import type { AutofillCredential } from '../services/autofillService';

export interface UseChromeAutoFillState {
  isSupported: boolean;
  isAvailable: boolean;
  isLoading: boolean;
  isInjecting: boolean;
  isDetecting: boolean;
  error: string | null;
  formDetected: boolean;
  lastInjectionTime: number | null;
}

export interface UseChromeAutoFillOptions {
  autoDetect?: boolean;
  biometricRequired?: boolean;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  pollInterval?: number; // ms for form detection polling
}

export function useChromeAutoFill(
  credentials?: AutofillCredential[],
  options?: UseChromeAutoFillOptions,
) {
  const {
    autoDetect = true,
    biometricRequired = true,
    onSuccess,
    onError,
    pollInterval = 3000,
  } = options || {};

  const [state, setState] = useState<UseChromeAutoFillState>({
    isSupported: false,
    isAvailable: false,
    isLoading: true,
    isInjecting: false,
    isDetecting: false,
    error: null,
    formDetected: false,
    lastInjectionTime: null,
  });

  // Check if Chrome autofill is supported
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await chromeAutoFillService.isSupported();
        setState(prev => ({
          ...prev,
          isSupported: supported,
          isAvailable: supported && Platform.OS === 'android',
          isLoading: false,
        }));
      } catch (error) {
        console.error('Error checking Chrome autofill support:', error);
        setState(prev => ({
          ...prev,
          isSupported: false,
          isAvailable: false,
          isLoading: false,
        }));
      }
    };

    checkSupport();
  }, []);

  // Auto-detect form on app focus
  useEffect(() => {
    if (!autoDetect || !state.isAvailable) return;

    let subscription: any;
    let pollInterval_: NodeJS.Timeout;

    const handleAppStateChange = async (status: AppStateStatus) => {
      if (status === 'active') {
        // App came to foreground, detect form
        await detectForm();
      }
    };

    const pollForForm = async () => {
      if (state.isDetecting) return;

      try {
        setState(prev => ({ ...prev, isDetecting: true }));
        const result = await chromeAutoFillService.detectLoginForm();
        setState(prev => ({
          ...prev,
          formDetected: result.isLoginForm,
          isDetecting: false,
        }));
      } catch (error) {
        console.warn('Error polling for form:', error);
        setState(prev => ({ ...prev, isDetecting: false }));
      }
    };

    subscription = AppState.addEventListener('change', handleAppStateChange);
    pollInterval_ = setInterval(pollForForm, pollInterval);

    // Initial detection
    pollForForm();

    return () => {
      subscription?.remove();
      clearInterval(pollInterval_);
    };
  }, [autoDetect, state.isAvailable, state.isDetecting, pollInterval]);

  /**
   * Detect login form on current page
   */
  const detectForm = useCallback(async (): Promise<DetectionResult | null> => {
    if (!state.isAvailable) {
      const error = 'Chrome autofill not available';
      setState(prev => ({ ...prev, error }));
      onError?.(error);
      return null;
    }

    try {
      setState(prev => ({ ...prev, isDetecting: true, error: null }));
      const result = await chromeAutoFillService.detectLoginForm();

      setState(prev => ({
        ...prev,
        formDetected: result.isLoginForm,
        isDetecting: false,
      }));

      if (!result.success) {
        const error = 'Could not detect form';
        setState(prev => ({ ...prev, error }));
        onError?.(error);
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error detecting form';
      console.error('Error detecting form:', error);
      setState(prev => ({ ...prev, error: errorMsg, isDetecting: false }));
      onError?.(errorMsg);
      return null;
    }
  }, [state.isAvailable, onError]);

  /**
   * Inject credentials with optional biometric verification
   */
  const injectCredentials = useCallback(
    async (options: ChromeAutoFillOptions): Promise<boolean> => {
      if (!state.isAvailable) {
        const error = 'Chrome autofill not available';
        setState(prev => ({ ...prev, error }));
        onError?.(error);
        return false;
      }

      try {
        setState(prev => ({ ...prev, isInjecting: true, error: null }));

        // Optional: Check biometric if required
        if (biometricRequired) {
          console.log('🔐 Requesting biometric authentication...');
          const biometricResult = await biometricService.authenticate();

          if (!biometricResult) {
            const error = 'Biometric authentication cancelled';
            setState(prev => ({ ...prev, error, isInjecting: false }));
            onError?.(error);
            return false;
          }

          console.log('✅ Biometric authentication passed');
        }

        // Inject credentials
        const success = await chromeAutoFillService.injectCredentials({
          ...options,
          onSuccess: () => {
            setState(prev => ({
              ...prev,
              isInjecting: false,
              lastInjectionTime: Date.now(),
              error: null,
            }));
            onSuccess?.();
          },
          onError: (error: string) => {
            setState(prev => ({ ...prev, isInjecting: false, error }));
            onError?.(error);
          },
        });

        if (success) {
          setState(prev => ({
            ...prev,
            isInjecting: false,
            lastInjectionTime: Date.now(),
          }));
        }

        return success;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown injection error';
        console.error('Error injecting credentials:', error);
        setState(prev => ({ ...prev, error: errorMsg, isInjecting: false }));
        onError?.(errorMsg);
        return false;
      }
    },
    [state.isAvailable, biometricRequired, onSuccess, onError],
  );

  /**
   * Auto-fill current page with matching credentials
   */
  const autoFillCurrentPage = useCallback(
    async (currentUrl: string): Promise<boolean> => {
      if (!credentials || credentials.length === 0) {
        const error = 'No credentials available';
        setState(prev => ({ ...prev, error }));
        onError?.(error);
        return false;
      }

      if (!state.isAvailable) {
        const error = 'Chrome autofill not available';
        setState(prev => ({ ...prev, error }));
        onError?.(error);
        return false;
      }

      try {
        setState(prev => ({ ...prev, isInjecting: true, error: null }));

        // Optional: Check biometric if required
        if (biometricRequired) {
          console.log('🔐 Requesting biometric authentication...');
          const biometricResult = await biometricService.authenticate();

          if (!biometricResult) {
            const error = 'Biometric authentication cancelled';
            setState(prev => ({ ...prev, error, isInjecting: false }));
            onError?.(error);
            return false;
          }

          console.log('✅ Biometric authentication passed');
        }

        // Auto-fill
        const success = await chromeAutoFillService.autoFillCurrentPage(
          currentUrl,
          credentials,
          () => {
            setState(prev => ({
              ...prev,
              isInjecting: false,
              lastInjectionTime: Date.now(),
              error: null,
            }));
            onSuccess?.();
          },
          (error: string) => {
            setState(prev => ({ ...prev, isInjecting: false, error }));
            onError?.(error);
          },
        );

        if (success) {
          setState(prev => ({
            ...prev,
            isInjecting: false,
            lastInjectionTime: Date.now(),
          }));
        }

        return success;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in auto-fill:', error);
        setState(prev => ({ ...prev, error: errorMsg, isInjecting: false }));
        onError?.(errorMsg);
        return false;
      }
    },
    [credentials, state.isAvailable, biometricRequired, onSuccess, onError],
  );

  /**
   * Clear injected content
   */
  const clearInjectedContent = useCallback(async (): Promise<void> => {
    try {
      await chromeAutoFillService.clearInjectedContent();
    } catch (error) {
      console.warn('Error clearing injected content:', error);
    }
  }, []);

  /**
   * Reset error state
   */
  const resetError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    ...state,

    // Methods
    detectForm,
    injectCredentials,
    autoFillCurrentPage,
    clearInjectedContent,
    resetError,
  };
}
