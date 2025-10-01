/**
 * useSecurity Hook
 *
 * Custom hook for security features:
 * - Device security checks
 * - Screen protection management
 * - Memory security
 * - Security monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import SecurityService, {
  SecurityCheckResult,
  SecurityThreat,
  DeviceSecurityInfo,
} from '../services/securityService';
import ScreenProtectionService, {
  ScreenProtectionStatus,
} from '../services/screenProtectionService';
import MemoryService from '../services/memoryService';

export interface SecurityState {
  isChecking: boolean;
  isSecure: boolean;
  threats: SecurityThreat[];
  deviceInfo: DeviceSecurityInfo | null;
  lastCheckTime: number | null;
  error: string | null;
}

export interface ScreenProtectionState {
  isEnabled: boolean;
  isRecording: boolean;
  status: ScreenProtectionStatus | null;
}

export interface UseSecurity {
  // Security check state
  security: SecurityState;

  // Screen protection state
  screenProtection: ScreenProtectionState;

  // Security check methods
  checkSecurity: (forceRefresh?: boolean) => Promise<void>;
  isDeviceSecure: () => Promise<boolean>;
  getCriticalThreats: () => Promise<SecurityThreat[]>;
  getSecuritySummary: () => Promise<string>;

  // Screen protection methods
  enableScreenProtection: () => Promise<boolean>;
  disableScreenProtection: () => Promise<boolean>;
  checkScreenRecording: () => Promise<boolean>;

  // Memory management methods
  clearSensitiveMemory: () => void;
  getMemoryStats: () => any;
}

export const useSecurity = (): UseSecurity => {
  const [security, setSecurity] = useState<SecurityState>({
    isChecking: false,
    isSecure: true,
    threats: [],
    deviceInfo: null,
    lastCheckTime: null,
    error: null,
  });

  const [screenProtection, setScreenProtection] =
    useState<ScreenProtectionState>({
      isEnabled: false,
      isRecording: false,
      status: null,
    });

  /**
   * Perform security check
   */
  const checkSecurity = useCallback(async (forceRefresh: boolean = false) => {
    setSecurity(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const result: SecurityCheckResult =
        await SecurityService.performSecurityCheck(forceRefresh);

      setSecurity({
        isChecking: false,
        isSecure: result.isSecure,
        threats: result.threats,
        deviceInfo: result.deviceInfo,
        lastCheckTime: Date.now(),
        error: null,
      });
    } catch (error) {
      console.error('Security check failed:', error);
      setSecurity(prev => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Security check failed',
      }));
    }
  }, []);

  /**
   * Check if device is secure
   */
  const isDeviceSecure = useCallback(async (): Promise<boolean> => {
    try {
      return await SecurityService.isDeviceSecure();
    } catch (error) {
      console.error('Device security check failed:', error);
      return false;
    }
  }, []);

  /**
   * Get critical threats
   */
  const getCriticalThreats = useCallback(async (): Promise<
    SecurityThreat[]
  > => {
    try {
      return await SecurityService.getCriticalThreats();
    } catch (error) {
      console.error('Failed to get critical threats:', error);
      return [];
    }
  }, []);

  /**
   * Get security summary
   */
  const getSecuritySummary = useCallback(async (): Promise<string> => {
    try {
      return await SecurityService.getSecuritySummary();
    } catch (error) {
      console.error('Failed to get security summary:', error);
      return 'Unable to determine security status';
    }
  }, []);

  /**
   * Enable screen protection
   */
  const enableScreenProtection = useCallback(async (): Promise<boolean> => {
    try {
      const success = await ScreenProtectionService.enableProtection();

      if (success) {
        const status = await ScreenProtectionService.getProtectionStatus();
        setScreenProtection(prev => ({
          ...prev,
          isEnabled: true,
          status,
        }));
      }

      return success;
    } catch (error) {
      console.error('Failed to enable screen protection:', error);
      return false;
    }
  }, []);

  /**
   * Disable screen protection
   */
  const disableScreenProtection = useCallback(async (): Promise<boolean> => {
    try {
      const success = await ScreenProtectionService.disableProtection();

      if (success) {
        const status = await ScreenProtectionService.getProtectionStatus();
        setScreenProtection(prev => ({
          ...prev,
          isEnabled: false,
          status,
        }));
      }

      return success;
    } catch (error) {
      console.error('Failed to disable screen protection:', error);
      return false;
    }
  }, []);

  /**
   * Check if screen recording is active
   */
  const checkScreenRecording = useCallback(async (): Promise<boolean> => {
    try {
      const isRecording = await ScreenProtectionService.isScreenRecording();
      setScreenProtection(prev => ({
        ...prev,
        isRecording,
      }));
      return isRecording;
    } catch (error) {
      console.error('Failed to check screen recording:', error);
      return false;
    }
  }, []);

  /**
   * Clear sensitive data from memory
   */
  const clearSensitiveMemory = useCallback(() => {
    try {
      MemoryService.clearAll();
      console.log('Sensitive memory cleared');
    } catch (error) {
      console.error('Failed to clear sensitive memory:', error);
    }
  }, []);

  /**
   * Get memory statistics
   */
  const getMemoryStats = useCallback(() => {
    try {
      return MemoryService.getMemoryStats();
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return null;
    }
  }, []);

  /**
   * Initial security check on mount
   */
  useEffect(() => {
    checkSecurity();
  }, [checkSecurity]);

  /**
   * Setup screen recording detection
   */
  useEffect(() => {
    const cleanup = ScreenProtectionService.setupScreenRecordingDetection(
      () => {
        console.warn('Screen recording started!');
        setScreenProtection(prev => ({ ...prev, isRecording: true }));
      },
      () => {
        console.log('Screen recording stopped');
        setScreenProtection(prev => ({ ...prev, isRecording: false }));
      },
    );

    return cleanup;
  }, []);

  /**
   * Periodic security checks
   */
  useEffect(() => {
    // Check security every 5 minutes
    const interval = setInterval(() => {
      checkSecurity(true);
    }, 300000);

    return () => clearInterval(interval);
  }, [checkSecurity]);

  /**
   * Clear memory on unmount
   */
  useEffect(() => {
    return () => {
      clearSensitiveMemory();
    };
  }, [clearSensitiveMemory]);

  return {
    security,
    screenProtection,
    checkSecurity,
    isDeviceSecure,
    getCriticalThreats,
    getSecuritySummary,
    enableScreenProtection,
    disableScreenProtection,
    checkScreenRecording,
    clearSensitiveMemory,
    getMemoryStats,
  };
};

export default useSecurity;
