/**
 * useAccessibility Hook
 *
 * Custom hook for managing accessibility service state.
 * Provides methods to check and enable/disable accessibility.
 */

import { useState, useCallback } from 'react';
import { accessibilityService } from '../services/accessibilityService';

interface UseAccessibilityReturn {
  isSupported: boolean;
  isEnabled: boolean;
  loading: boolean;
  error: string | null;
  checkAccessibility: () => Promise<void>;
  enableAccessibility: () => Promise<void>;
  disableAccessibility: () => Promise<void>;
}

export const useAccessibility = (): UseAccessibilityReturn => {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAccessibility = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supported = await accessibilityService.isSupported();
      setIsSupported(supported);

      if (supported) {
        const enabled = await accessibilityService.isEnabled();
        setIsEnabled(enabled);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to check accessibility';
      console.error('Error checking accessibility:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const enableAccessibility = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Requesting accessibility enable...');
      await accessibilityService.requestEnable();
      console.log('✅ Accessibility enable requested');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to enable accessibility';
      console.error('Error enabling accessibility:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disableAccessibility = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔐 Requesting accessibility disable...');
      const result = await accessibilityService.requestDisable();
      console.log('✅ Accessibility disable requested:', result);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to disable accessibility';
      console.error('Error disabling accessibility:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isSupported,
    isEnabled,
    loading,
    error,
    checkAccessibility,
    enableAccessibility,
    disableAccessibility,
  };
};
