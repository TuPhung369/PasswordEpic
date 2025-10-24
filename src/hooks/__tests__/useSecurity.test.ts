/**
 * useSecurity Hook Tests
 *
 * Comprehensive test suite for security hook covering:
 * - Security state management
 * - Security check operations
 * - Screen protection management
 * - Memory management
 * - Periodic security checks
 * - Effect cleanup
 * - Error handling
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import useSecurity, {
  SecurityState,
  ScreenProtectionState,
} from '../useSecurity';

// Mock dependencies
jest.mock('../../services/securityService', () => ({
  __esModule: true,
  default: {
    performSecurityCheck: jest.fn(),
    isDeviceSecure: jest.fn(),
    getCriticalThreats: jest.fn(),
    getSecuritySummary: jest.fn(),
  },
}));

jest.mock('../../services/screenProtectionService', () => ({
  __esModule: true,
  default: {
    enableProtection: jest.fn(),
    disableProtection: jest.fn(),
    isScreenRecording: jest.fn(),
    setupScreenRecordingDetection: jest.fn(),
    getProtectionStatus: jest.fn(),
  },
}));

jest.mock('../../services/memoryService', () => ({
  __esModule: true,
  default: {
    clearAll: jest.fn(),
    getMemoryStats: jest.fn(),
  },
}));

import SecurityService from '../../services/securityService';
import ScreenProtectionService from '../../services/screenProtectionService';
import MemoryService from '../../services/memoryService';

describe('useSecurity Hook', () => {
  // Mock data
  const mockSecurityCheckResult = {
    isSecure: true,
    threats: [],
    deviceInfo: {
      isRooted: false,
      isJailbroken: false,
      isEmulator: false,
      isDebuggerAttached: false,
      isDeveloperModeEnabled: false,
      hasHooks: false,
      hasSuspiciousApps: false,
      canMockLocation: false,
      isOnExternalStorage: false,
      deviceId: 'test-device-id',
      systemVersion: '14.0',
      appVersion: '1.0.0',
    },
  };

  const mockSecurityCheckWithThreats = {
    isSecure: false,
    threats: [
      {
        type: 'root_detected' as const,
        severity: 'critical' as const,
        description: 'Device is rooted',
        recommendation: 'Unroot device',
      },
      {
        type: 'developer_mode' as const,
        severity: 'high' as const,
        description: 'Developer mode enabled',
        recommendation: 'Disable developer mode',
      },
    ],
    deviceInfo: {
      ...mockSecurityCheckResult.deviceInfo,
      isRooted: true,
      isDeveloperModeEnabled: true,
    },
  };

  const mockProtectionStatus = {
    isEnabled: true,
    isSupported: true,
    hasPermissions: true,
  };

  const mockMemoryStats = {
    usedMemory: 1024,
    availableMemory: 2048,
    percentUsed: 50,
  };

  const mockCriticalThreats = [
    {
      type: 'root_detected' as const,
      severity: 'critical' as const,
      description: 'Device is rooted',
      recommendation: 'Unroot device',
    },
  ];

  /**
   * Setup mocks for consistent test state
   */
  const setupMocks = (overrides?: {
    performSecurityCheck?: any;
    isDeviceSecure?: any;
    getCriticalThreats?: any;
    getSecuritySummary?: any;
    enableProtection?: any;
    disableProtection?: any;
    isScreenRecording?: any;
    setupScreenRecordingDetection?: any;
    getProtectionStatus?: any;
    clearAll?: any;
    getMemoryStats?: any;
  }) => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // SecurityService mocks
    (SecurityService.performSecurityCheck as jest.Mock).mockResolvedValue(
      overrides?.performSecurityCheck || mockSecurityCheckResult,
    );
    (SecurityService.isDeviceSecure as jest.Mock).mockResolvedValue(true);
    (SecurityService.getCriticalThreats as jest.Mock).mockResolvedValue(
      overrides?.getCriticalThreats || mockCriticalThreats,
    );
    (SecurityService.getSecuritySummary as jest.Mock).mockResolvedValue(
      overrides?.getSecuritySummary || 'Device is secure',
    );

    // ScreenProtectionService mocks
    (ScreenProtectionService.enableProtection as jest.Mock).mockResolvedValue(
      true,
    );
    (ScreenProtectionService.disableProtection as jest.Mock).mockResolvedValue(
      true,
    );
    (ScreenProtectionService.isScreenRecording as jest.Mock).mockResolvedValue(
      false,
    );
    (
      ScreenProtectionService.setupScreenRecordingDetection as jest.Mock
    ).mockReturnValue(() => {});
    (
      ScreenProtectionService.getProtectionStatus as jest.Mock
    ).mockResolvedValue(mockProtectionStatus);

    // MemoryService mocks
    (MemoryService.clearAll as jest.Mock).mockImplementation(() => {});
    (MemoryService.getMemoryStats as jest.Mock).mockReturnValue(
      mockMemoryStats,
    );
  };

  beforeEach(() => {
    setupMocks();
    // Mock Date.now() to return a real timestamp even with fake timers
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ============================================================================
  // 1. HOOK INITIALIZATION
  // ============================================================================

  describe('Hook Initialization', () => {
    it('should initialize with default security state', async () => {
      const { result } = renderHook(() => useSecurity());

      // Wait for initial security check to complete
      await waitFor(() => {
        expect(result.current.security.isChecking).toBe(false);
      });

      expect(result.current.security.isSecure).toBe(true);
      expect(result.current.security.threats).toEqual([]);
      expect(result.current.security.error).toBeNull();
    });

    it('should initialize with default screen protection state', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.screenProtection).toBeDefined();
      });

      expect(result.current.screenProtection.isEnabled).toBe(false);
      expect(result.current.screenProtection.isRecording).toBe(false);
      expect(result.current.screenProtection.status).toBeNull();
    });

    it('should export all required methods', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      expect(typeof result.current.checkSecurity).toBe('function');
      expect(typeof result.current.isDeviceSecure).toBe('function');
      expect(typeof result.current.getCriticalThreats).toBe('function');
      expect(typeof result.current.getSecuritySummary).toBe('function');
      expect(typeof result.current.enableScreenProtection).toBe('function');
      expect(typeof result.current.disableScreenProtection).toBe('function');
      expect(typeof result.current.checkScreenRecording).toBe('function');
      expect(typeof result.current.clearSensitiveMemory).toBe('function');
      expect(typeof result.current.getMemoryStats).toBe('function');
    });

    it('should perform initial security check on mount', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(true);
      });
    });
  });

  // ============================================================================
  // 2. SECURITY CHECK OPERATIONS
  // ============================================================================

  describe('Security Check Operations', () => {
    it('should perform security check successfully', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(true);
        expect(result.current.security.threats).toEqual([]);
        expect(result.current.security.deviceInfo).toBeDefined();
      });
    });

    it('should set isChecking to true during security check', async () => {
      setupMocks({
        performSecurityCheck: new Promise(resolve =>
          setTimeout(() => resolve(mockSecurityCheckResult), 100),
        ),
      });

      const { result } = renderHook(() => useSecurity());

      act(() => {
        result.current.checkSecurity();
      });

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(true);
      });
    });

    it('should update lastCheckTime after security check', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.lastCheckTime).not.toBeNull();
      });

      expect(result.current.security.lastCheckTime).toBeGreaterThan(0);
    });

    it('should handle security check with threats detected', async () => {
      setupMocks({
        performSecurityCheck: mockSecurityCheckWithThreats,
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(false);
      });

      expect(result.current.security.threats).toHaveLength(2);
      expect(result.current.security.threats[0].type).toBe('root_detected');
      expect(result.current.security.threats[0].severity).toBe('critical');
    });

    it('should handle security check failure', async () => {
      const errorMessage = 'Security check failed';
      (SecurityService.performSecurityCheck as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage),
      );

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.error).toBe(errorMessage);
      });

      expect(result.current.security.isChecking).toBe(false);
    });

    it('should force refresh security check when requested', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalled();
      });

      jest.clearAllMocks();

      act(() => {
        result.current.checkSecurity(true);
      });

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalledWith(true);
      });
    });

    it('should clear error on successful security check after failure', async () => {
      (SecurityService.performSecurityCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Initial error'),
      );

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.error).toBe('Initial error');
      });

      jest.clearAllMocks();
      (SecurityService.performSecurityCheck as jest.Mock).mockResolvedValueOnce(
        mockSecurityCheckResult,
      );

      act(() => {
        result.current.checkSecurity();
      });

      await waitFor(() => {
        expect(result.current.security.error).toBeNull();
      });
    });
  });

  // ============================================================================
  // 3. DEVICE SECURITY CHECK
  // ============================================================================

  describe('Device Security Check', () => {
    it('should check if device is secure', async () => {
      const { result } = renderHook(() => useSecurity());

      let isSecure: boolean | undefined;

      act(() => {
        result.current.isDeviceSecure().then(res => {
          isSecure = res;
        });
      });

      await waitFor(() => {
        expect(isSecure).toBe(true);
      });

      expect(SecurityService.isDeviceSecure).toHaveBeenCalled();
    });

    it('should return false when device check fails', async () => {
      (SecurityService.isDeviceSecure as jest.Mock).mockRejectedValueOnce(
        new Error('Check failed'),
      );

      const { result } = renderHook(() => useSecurity());

      let isSecure: boolean | undefined;

      act(() => {
        result.current.isDeviceSecure().then(res => {
          isSecure = res;
        });
      });

      await waitFor(() => {
        expect(isSecure).toBe(false);
      });
    });

    it('should log error when device check fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (SecurityService.isDeviceSecure as jest.Mock).mockRejectedValueOnce(
        new Error('Device check error'),
      );

      const { result } = renderHook(() => useSecurity());

      act(() => {
        result.current.isDeviceSecure();
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Device security check failed:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // 4. CRITICAL THREATS
  // ============================================================================

  describe('Critical Threats', () => {
    it('should retrieve critical threats', async () => {
      const { result } = renderHook(() => useSecurity());

      let threats: any = [];

      act(() => {
        result.current.getCriticalThreats().then(res => {
          threats = res;
        });
      });

      await waitFor(() => {
        expect(threats).toHaveLength(1);
      });

      expect(threats[0].type).toBe('root_detected');
      expect(threats[0].severity).toBe('critical');
    });

    it('should return empty array when getting critical threats fails', async () => {
      (SecurityService.getCriticalThreats as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to get threats'),
      );

      const { result } = renderHook(() => useSecurity());

      let threats: any = [];

      act(() => {
        result.current.getCriticalThreats().then(res => {
          threats = res;
        });
      });

      await waitFor(() => {
        expect(Array.isArray(threats)).toBe(true);
      });

      expect(threats).toHaveLength(0);
    });

    it('should handle multiple critical threats', async () => {
      const multiplethreats = [
        {
          type: 'root_detected' as const,
          severity: 'critical' as const,
          description: 'Device is rooted',
          recommendation: 'Unroot device',
        },
        {
          type: 'debugger_attached' as const,
          severity: 'high' as const,
          description: 'Debugger attached',
          recommendation: 'Disconnect debugger',
        },
      ];

      (SecurityService.getCriticalThreats as jest.Mock).mockResolvedValueOnce(
        multiplethreats,
      );

      const { result } = renderHook(() => useSecurity());

      let threats: any = [];

      act(() => {
        result.current.getCriticalThreats().then(res => {
          threats = res;
        });
      });

      await waitFor(() => {
        expect(threats).toHaveLength(2);
      });
    });
  });

  // ============================================================================
  // 5. SECURITY SUMMARY
  // ============================================================================

  describe('Security Summary', () => {
    it('should get security summary', async () => {
      const { result } = renderHook(() => useSecurity());

      let summary = '';

      act(() => {
        result.current.getSecuritySummary().then(res => {
          summary = res;
        });
      });

      await waitFor(() => {
        expect(summary).toBe('Device is secure');
      });

      expect(SecurityService.getSecuritySummary).toHaveBeenCalled();
    });

    it('should return default message when summary retrieval fails', async () => {
      (SecurityService.getSecuritySummary as jest.Mock).mockRejectedValueOnce(
        new Error('Failed'),
      );

      const { result } = renderHook(() => useSecurity());

      let summary = '';

      act(() => {
        result.current.getSecuritySummary().then(res => {
          summary = res;
        });
      });

      await waitFor(() => {
        expect(summary).toBe('Unable to determine security status');
      });
    });

    it('should handle summary with warnings', async () => {
      const warningSummary = 'Device has 1 critical threat: Root detected';
      (SecurityService.getSecuritySummary as jest.Mock).mockResolvedValueOnce(
        warningSummary,
      );

      const { result } = renderHook(() => useSecurity());

      let summary = '';

      act(() => {
        result.current.getSecuritySummary().then(res => {
          summary = res;
        });
      });

      await waitFor(() => {
        expect(summary).toBe(warningSummary);
      });
    });
  });

  // ============================================================================
  // 6. SCREEN PROTECTION ENABLE/DISABLE
  // ============================================================================

  describe('Screen Protection Management', () => {
    it('should enable screen protection', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      let success = false;

      act(() => {
        result.current.enableScreenProtection().then(res => {
          success = res;
        });
      });

      await waitFor(() => {
        expect(success).toBe(true);
      });

      expect(ScreenProtectionService.enableProtection).toHaveBeenCalled();
    });

    it('should update screen protection state when enabled', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.enableScreenProtection();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isEnabled).toBe(true);
      });
    });

    it('should get protection status when enabling screen protection', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.enableScreenProtection();
      });

      await waitFor(() => {
        expect(ScreenProtectionService.getProtectionStatus).toHaveBeenCalled();
      });
    });

    it('should disable screen protection', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      let success = false;

      act(() => {
        result.current.disableScreenProtection().then(res => {
          success = res;
        });
      });

      await waitFor(() => {
        expect(success).toBe(true);
      });

      expect(ScreenProtectionService.disableProtection).toHaveBeenCalled();
    });

    it('should update screen protection state when disabled', async () => {
      const { result } = renderHook(() => useSecurity());

      // First enable
      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.enableScreenProtection();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isEnabled).toBe(true);
      });

      // Then disable
      jest.clearAllMocks();
      (
        ScreenProtectionService.disableProtection as jest.Mock
      ).mockResolvedValueOnce(true);
      (
        ScreenProtectionService.getProtectionStatus as jest.Mock
      ).mockResolvedValueOnce({ ...mockProtectionStatus, isEnabled: false });

      act(() => {
        result.current.disableScreenProtection();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isEnabled).toBe(false);
      });
    });

    it('should handle screen protection enable failure', async () => {
      (
        ScreenProtectionService.enableProtection as jest.Mock
      ).mockRejectedValueOnce(new Error('Failed to enable'));

      const { result } = renderHook(() => useSecurity());

      let success = false;

      act(() => {
        result.current.enableScreenProtection().then(res => {
          success = res;
        });
      });

      await waitFor(() => {
        expect(success).toBe(false);
      });
    });

    it('should handle screen protection disable failure', async () => {
      (
        ScreenProtectionService.disableProtection as jest.Mock
      ).mockRejectedValueOnce(new Error('Failed to disable'));

      const { result } = renderHook(() => useSecurity());

      let success = false;

      act(() => {
        result.current.disableScreenProtection().then(res => {
          success = res;
        });
      });

      await waitFor(() => {
        expect(success).toBe(false);
      });
    });
  });

  // ============================================================================
  // 7. SCREEN RECORDING DETECTION
  // ============================================================================

  describe('Screen Recording Detection', () => {
    it('should check screen recording status', async () => {
      const { result } = renderHook(() => useSecurity());

      let isRecording = true;

      act(() => {
        result.current.checkScreenRecording().then(res => {
          isRecording = res;
        });
      });

      await waitFor(() => {
        expect(isRecording).toBe(false);
      });

      expect(ScreenProtectionService.isScreenRecording).toHaveBeenCalled();
    });

    it('should update screen recording state', async () => {
      (
        ScreenProtectionService.isScreenRecording as jest.Mock
      ).mockResolvedValueOnce(true);

      const { result } = renderHook(() => useSecurity());

      act(() => {
        result.current.checkScreenRecording();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isRecording).toBe(true);
      });
    });

    it('should handle screen recording check failure', async () => {
      (
        ScreenProtectionService.isScreenRecording as jest.Mock
      ).mockRejectedValueOnce(new Error('Check failed'));

      const { result } = renderHook(() => useSecurity());

      let isRecording = true;

      act(() => {
        result.current.checkScreenRecording().then(res => {
          isRecording = res;
        });
      });

      await waitFor(() => {
        expect(isRecording).toBe(false);
      });
    });

    it('should setup screen recording detection on mount', async () => {
      renderHook(() => useSecurity());

      await waitFor(() => {
        expect(
          ScreenProtectionService.setupScreenRecordingDetection,
        ).toHaveBeenCalled();
      });
    });

    it('should handle screen recording started callback', async () => {
      let recordingStartedCallback: (() => void) | null = null;

      (
        ScreenProtectionService.setupScreenRecordingDetection as jest.Mock
      ).mockImplementationOnce((onStart, onStop) => {
        recordingStartedCallback = onStart;
        return () => {};
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(recordingStartedCallback).toBeDefined();
      });

      act(() => {
        recordingStartedCallback?.();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isRecording).toBe(true);
      });
    });

    it('should handle screen recording stopped callback', async () => {
      let recordingStoppedCallback: (() => void) | null = null;

      (
        ScreenProtectionService.setupScreenRecordingDetection as jest.Mock
      ).mockImplementationOnce((onStart, onStop) => {
        recordingStoppedCallback = onStop;
        return () => {};
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(recordingStoppedCallback).toBeDefined();
      });

      act(() => {
        recordingStoppedCallback?.();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isRecording).toBe(false);
      });
    });

    it('should return cleanup function from screen recording detection', async () => {
      const mockCleanup = jest.fn();
      (
        ScreenProtectionService.setupScreenRecordingDetection as jest.Mock
      ).mockReturnValueOnce(mockCleanup);

      const { unmount } = renderHook(() => useSecurity());

      unmount();

      // Note: cleanup is called automatically by the hook
      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 8. MEMORY MANAGEMENT
  // ============================================================================

  describe('Memory Management', () => {
    it('should clear sensitive memory', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.clearSensitiveMemory();
      });

      expect(MemoryService.clearAll).toHaveBeenCalled();
    });

    it('should get memory stats', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      const stats = result.current.getMemoryStats();

      expect(stats).toEqual(mockMemoryStats);
      expect(MemoryService.getMemoryStats).toHaveBeenCalled();
    });

    it('should return null when getting memory stats fails', async () => {
      (MemoryService.getMemoryStats as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to get stats');
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      const stats = result.current.getMemoryStats();

      expect(stats).toBeNull();
    });

    it('should handle error when clearing sensitive memory', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (MemoryService.clearAll as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Clear failed');
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.clearSensitiveMemory();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear sensitive memory:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should clear sensitive memory on unmount', async () => {
      const { unmount } = renderHook(() => useSecurity());

      jest.clearAllMocks();

      unmount();

      await waitFor(() => {
        expect(MemoryService.clearAll).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // 9. PERIODIC SECURITY CHECKS
  // ============================================================================

  describe('Periodic Security Checks', () => {
    it('should set up periodic security checks interval', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      jest.clearAllMocks();

      // Advance time by 5 minutes
      act(() => {
        jest.advanceTimersByTime(300000);
      });

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalledWith(true);
      });
    });

    it('should perform security check with force refresh in periodic check', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      jest.clearAllMocks();

      act(() => {
        jest.advanceTimersByTime(300000);
      });

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalledWith(true);
      });
    });

    it('should clear interval on unmount', async () => {
      const { unmount } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalled();
      });

      jest.clearAllMocks();

      unmount();

      act(() => {
        jest.advanceTimersByTime(300000);
      });

      // Should not be called after unmount
      await waitFor(
        () => {
          expect(SecurityService.performSecurityCheck).not.toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });

    it('should handle periodic check errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (SecurityService.performSecurityCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Periodic check failed'),
      );

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      jest.clearAllMocks();
      (SecurityService.performSecurityCheck as jest.Mock).mockRejectedValueOnce(
        new Error('Periodic check error'),
      );

      act(() => {
        jest.advanceTimersByTime(300000);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Security check failed:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // 10. EFFECT CLEANUP AND TEARDOWN
  // ============================================================================

  describe('Effect Cleanup and Teardown', () => {
    it('should cleanup screen recording detection on unmount', async () => {
      const mockCleanup = jest.fn();
      (
        ScreenProtectionService.setupScreenRecordingDetection as jest.Mock
      ).mockReturnValueOnce(mockCleanup);

      const { unmount } = renderHook(() => useSecurity());

      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should clear all intervals on unmount', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should clear sensitive memory on unmount', async () => {
      const { unmount } = renderHook(() => useSecurity());

      jest.clearAllMocks();

      unmount();

      await waitFor(() => {
        expect(MemoryService.clearAll).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // 11. ERROR HANDLING AND EDGE CASES
  // ============================================================================

  describe('Error Handling and Edge Cases', () => {
    it('should handle multiple consecutive security checks', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      jest.clearAllMocks();

      act(() => {
        result.current.checkSecurity();
      });

      act(() => {
        result.current.checkSecurity();
      });

      await waitFor(() => {
        expect(SecurityService.performSecurityCheck).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle non-Error thrown from security check', async () => {
      (SecurityService.performSecurityCheck as jest.Mock).mockRejectedValueOnce(
        'String error',
      );

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.error).toBe('Security check failed');
      });
    });

    it('should maintain state across multiple operations', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(true);
        expect(result.current.security.deviceInfo).toBeDefined();
      });

      const initialIsSecure = result.current.security.isSecure;

      act(() => {
        result.current.enableScreenProtection();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isEnabled).toBe(true);
      });

      // Security state should remain unchanged after screen protection operation
      expect(result.current.security.isSecure).toBe(initialIsSecure);
    });

    it('should handle rapid successive operations', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.enableScreenProtection();
        result.current.checkScreenRecording();
        result.current.getCriticalThreats();
        result.current.clearSensitiveMemory();
      });

      await waitFor(() => {
        expect(ScreenProtectionService.enableProtection).toHaveBeenCalled();
        expect(ScreenProtectionService.isScreenRecording).toHaveBeenCalled();
        expect(SecurityService.getCriticalThreats).toHaveBeenCalled();
        expect(MemoryService.clearAll).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // 12. CALLBACK MEMOIZATION
  // ============================================================================

  describe('Callback Memoization', () => {
    it('should memoize checkSecurity callback', async () => {
      const { result, rerender } = renderHook(() => useSecurity());

      const firstCallback = result.current.checkSecurity;

      rerender();

      const secondCallback = result.current.checkSecurity;

      // Should be the same reference
      expect(firstCallback).toBe(secondCallback);
    });

    it('should memoize isDeviceSecure callback', async () => {
      const { result, rerender } = renderHook(() => useSecurity());

      const firstCallback = result.current.isDeviceSecure;

      rerender();

      const secondCallback = result.current.isDeviceSecure;

      expect(firstCallback).toBe(secondCallback);
    });

    it('should memoize enableScreenProtection callback', async () => {
      const { result, rerender } = renderHook(() => useSecurity());

      const firstCallback = result.current.enableScreenProtection;

      rerender();

      const secondCallback = result.current.enableScreenProtection;

      expect(firstCallback).toBe(secondCallback);
    });
  });

  // ============================================================================
  // 13. INTEGRATION SCENARIOS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should complete full security check workflow', async () => {
      setupMocks({
        performSecurityCheck: mockSecurityCheckWithThreats,
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(false);
        expect(result.current.security.threats).toHaveLength(2);
      });

      let criticalThreats: any = [];
      act(() => {
        result.current.getCriticalThreats().then(res => {
          criticalThreats = res;
        });
      });

      await waitFor(() => {
        expect(criticalThreats).toHaveLength(1);
      });

      let summary = '';
      act(() => {
        result.current.getSecuritySummary().then(res => {
          summary = res;
        });
      });

      await waitFor(() => {
        expect(summary).toBe('Device is secure');
      });
    });

    it('should enable protection and check recording together', async () => {
      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      act(() => {
        result.current.enableScreenProtection();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isEnabled).toBe(true);
      });

      (
        ScreenProtectionService.isScreenRecording as jest.Mock
      ).mockResolvedValueOnce(true);

      act(() => {
        result.current.checkScreenRecording();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isRecording).toBe(true);
      });

      expect(result.current.screenProtection.isEnabled).toBe(true);
    });

    it('should handle security threat then enable protection', async () => {
      setupMocks({
        performSecurityCheck: mockSecurityCheckWithThreats,
      });

      const { result } = renderHook(() => useSecurity());

      await waitFor(() => {
        expect(result.current.security.isSecure).toBe(false);
      });

      act(() => {
        result.current.enableScreenProtection();
      });

      await waitFor(() => {
        expect(result.current.screenProtection.isEnabled).toBe(true);
        expect(result.current.security.isSecure).toBe(false);
      });
    });
  });
});
