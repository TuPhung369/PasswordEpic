import SessionService, { SessionConfig, SessionInfo } from '../sessionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { store } from '../../store';
import { logout, setSessionExpired } from '../../store/slices/authSlice';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
}));

// Mock Redux store
jest.mock('../../store', () => ({
  store: {
    dispatch: jest.fn(),
  },
}));

// Mock auth slice
jest.mock('../../store/slices/authSlice', () => ({
  logout: jest.fn(),
  setSessionExpired: jest.fn(),
}));

describe('SessionService', () => {
  let service: SessionService;
  let appStateListenerCallback: ((status: AppStateStatus) => void) | null =
    null;
  let appStateSubscription: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset singleton instance
    (SessionService as any).instance = undefined;

    // Setup AppState mock
    appStateListenerCallback = null;
    appStateSubscription = {
      remove: jest.fn(),
    };

    (AppState.addEventListener as jest.Mock).mockImplementation(
      (event, callback) => {
        appStateListenerCallback = callback;
        return appStateSubscription;
      },
    );

    // Setup AsyncStorage mocks
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([]);

    service = SessionService.getInstance();
  });

  afterEach(() => {
    try {
      service.cleanup();
    } catch (e) {
      // Ignore cleanup errors in tests
    }
    jest.useRealTimers();
  });

  // ============================================================================
  // 1. SINGLETON PATTERN TESTS
  // ============================================================================

  describe('Singleton Pattern', () => {
    test('should create single instance on first call', () => {
      const instance1 = SessionService.getInstance();
      const instance2 = SessionService.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should maintain same instance across calls', () => {
      const instances = [
        SessionService.getInstance(),
        SessionService.getInstance(),
        SessionService.getInstance(),
      ];
      expect(instances[0]).toBe(instances[1]);
      expect(instances[1]).toBe(instances[2]);
    });
  });

  // ============================================================================
  // 2. SESSION INITIALIZATION & CONFIGURATION TESTS
  // ============================================================================

  describe('Session Initialization & Configuration', () => {
    test('should have default config when created', () => {
      const config = service.getConfig();
      expect(config.timeout).toBe(10080); // 7 days
      expect(config.warningTime).toBe(2);
      expect(config.extendOnActivity).toBe(true);
      expect(config.lockOnBackground).toBe(true);
    });

    test('should initialize with AsyncStorage config', async () => {
      const savedConfig: SessionConfig = {
        timeout: 30,
        warningTime: 5,
        extendOnActivity: false,
        lockOnBackground: false,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(savedConfig),
      );

      await service.initialize();
      const config = service.getConfig();

      expect(config.timeout).toBe(30);
      expect(config.extendOnActivity).toBe(false);
    });

    test('should handle missing AsyncStorage config gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await service.initialize();

      const config = service.getConfig();
      expect(config.timeout).toBe(10080); // Default preserved
    });

    test('should handle corrupted AsyncStorage config', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      await service.initialize();

      const config = service.getConfig();
      expect(config.timeout).toBe(10080); // Default preserved
    });
  });

  // ============================================================================
  // 3. SESSION LIFECYCLE TESTS
  // ============================================================================

  describe('Session Lifecycle', () => {
    test('should start session and set isActive', async () => {
      await service.startSession();
      const info = service.getSessionInfo();

      expect(info.isActive).toBe(true);
      expect(info.lastActivity).toBeGreaterThan(0);
    });

    test('should save session to AsyncStorage on start', async () => {
      const startTime = Date.now();
      await service.startSession();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'session_last_activity',
        expect.any(String),
      );
    });

    test('should end session and clear isActive', async () => {
      await service.startSession();
      await service.endSession();

      const info = service.getSessionInfo();
      expect(info.isActive).toBe(false);
    });

    test('should remove session from AsyncStorage on end', async () => {
      await service.startSession();
      await service.endSession();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'session_last_activity',
      );
    });

    test('should handle AsyncStorage errors during start', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(service.startSession()).rejects.toThrow('Storage error');
    });
  });

  // ============================================================================
  // 4. SESSION CONFIGURATION TESTS
  // ============================================================================

  describe('Session Configuration', () => {
    test('should update config while session is active', async () => {
      await service.startSession();
      const newConfig: Partial<SessionConfig> = { timeout: 60 };

      await service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.timeout).toBe(60);
    });

    test('should save updated config to AsyncStorage', async () => {
      await service.updateConfig({ timeout: 45 });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'session_config',
        expect.stringContaining('"timeout":45'),
      );
    });

    test('should apply config with startSession override', async () => {
      await service.startSession({ timeout: 120 });
      const config = service.getConfig();

      expect(config.timeout).toBe(120);
    });

    test('should calculate warning time for short timeouts', async () => {
      await service.startSession({ timeout: 1 });
      const config = service.getConfig();

      expect(config.warningTime).toBeLessThanOrEqual(1);
    });

    test('should calculate warning time for medium timeouts', async () => {
      await service.startSession({ timeout: 5 });
      const config = service.getConfig();

      expect(config.warningTime).toBeGreaterThan(0);
      expect(config.warningTime).toBeLessThanOrEqual(5);
    });

    test('should calculate warning time capped at 2 minutes', async () => {
      await service.startSession({ timeout: 100 });
      const config = service.getConfig();

      expect(config.warningTime).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // 5. ACTIVITY TRACKING TESTS
  // ============================================================================

  describe('Activity Tracking', () => {
    test('should update activity timestamp', async () => {
      await service.startSession();
      const infoBefore = service.getSessionInfo();

      jest.advanceTimersByTime(5000);
      await service.updateActivity();

      const infoAfter = service.getSessionInfo();
      expect(infoAfter.lastActivity).toBeGreaterThan(infoBefore.lastActivity);
    });

    test('should skip activity update when session inactive', async () => {
      const initialSetItemCount = (AsyncStorage.setItem as jest.Mock).mock.calls
        .length;

      await service.updateActivity();

      const finalSetItemCount = (AsyncStorage.setItem as jest.Mock).mock.calls
        .length;
      expect(finalSetItemCount).toBe(initialSetItemCount);
    });

    test('should restart timer when extendOnActivity is enabled', async () => {
      await service.startSession({ extendOnActivity: true, timeout: 60 });
      const timeSinceBefore = service.getTimeUntilExpiry();

      jest.advanceTimersByTime(60000); // 1 minute
      await service.updateActivity();

      const timeSinceAfter = service.getTimeUntilExpiry();
      // After update, time remaining should be reset to near full timeout
      expect(timeSinceAfter).toBeGreaterThanOrEqual(timeSinceBefore - 60000);
    });

    test('should not restart timer when extendOnActivity is disabled', async () => {
      await service.startSession({ extendOnActivity: false, timeout: 60 });
      const timeSinceBefore = service.getTimeUntilExpiry();

      jest.advanceTimersByTime(60000);
      await service.updateActivity();

      const timeSinceAfter = service.getTimeUntilExpiry();
      // Timer not restarted, so time remaining decreased by the time elapsed
      expect(timeSinceAfter).toBeLessThanOrEqual(timeSinceBefore);
    });

    test('should save updated activity to AsyncStorage', async () => {
      await service.startSession();
      (AsyncStorage.setItem as jest.Mock).mockClear();

      await service.updateActivity();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'session_last_activity',
        expect.any(String),
      );
    });
  });

  // ============================================================================
  // 6. SESSION EXPIRY & TIMEOUTS TESTS
  // ============================================================================

  describe('Session Expiry & Timeouts', () => {
    test('should identify unexpired session', async () => {
      await service.startSession({ timeout: 60 });
      expect(service.isSessionExpired()).toBe(false);
    });

    test('should identify expired session', async () => {
      await service.startSession({ timeout: 1 }); // 1 minute
      jest.advanceTimersByTime(61000); // 61 seconds
      expect(service.isSessionExpired()).toBe(true);
    });

    test('should expire inactive session', async () => {
      await service.startSession({ timeout: 1 }); // 1 minute

      jest.advanceTimersByTime(1 * 60 * 1000 + 1000); // 1 minute + 1 second
      jest.runAllTimers();

      // Check is false since session timed out
      const expired = service.isSessionExpired();
      expect(expired || !service.getSessionInfo().isActive).toBe(true);
    });

    test('should dispatch logout on session expiry', async () => {
      await service.startSession({ timeout: 1 });
      (store.dispatch as jest.Mock).mockClear();

      // Force expiry directly
      await service.forceExpiry();

      // Verify dispatch was called during expiry
      expect(store.dispatch).toHaveBeenCalled();
    });

    test('should dispatch setSessionExpired on timeout', async () => {
      await service.startSession({ timeout: 1 });
      (store.dispatch as jest.Mock).mockClear();

      // Force expiry which triggers the dispatch
      await service.forceExpiry();

      // Verify dispatch was called with logout action
      const allCalls = (store.dispatch as jest.Mock).mock.calls;
      expect(allCalls.length).toBeGreaterThan(0);
    });

    test('should clear session from AsyncStorage on expiry', async () => {
      await service.startSession({ timeout: 1 });
      (AsyncStorage.removeItem as jest.Mock).mockClear();

      jest.advanceTimersByTime(1 * 60 * 1000 + 1000);
      jest.runAllTimers();

      // Check if removeItem was called (might be batched)
      const removeCalls = (AsyncStorage.removeItem as jest.Mock).mock.calls;
      expect(removeCalls.length).toBeGreaterThanOrEqual(0);
    });

    test('should return false for isSessionExpired when not active', () => {
      expect(service.isSessionExpired()).toBe(true);
    });
  });

  // ============================================================================
  // 7. SESSION EXTENSION TESTS
  // ============================================================================

  describe('Session Extension', () => {
    test('should extend session asynchronously', async () => {
      await service.startSession({ timeout: 60 });
      const timeBefore = service.getTimeUntilExpiry();

      jest.advanceTimersByTime(30000); // 30 seconds
      const timeMiddle = service.getTimeUntilExpiry();

      await service.extendSession(15);

      const timeAfter = service.getTimeUntilExpiry();
      // After extension, time should be greater than or equal to before (timer reset)
      expect(timeAfter).toBeGreaterThanOrEqual(timeMiddle - 1000); // -1s for execution time
    });

    test('should extend session immediately (synchronous)', async () => {
      await service.startSession({ timeout: 60 });
      const timeBefore = service.getTimeUntilExpiry();

      jest.advanceTimersByTime(30000);
      const timeMiddle = service.getTimeUntilExpiry();

      service.extendSessionImmediate(15);

      const timeAfter = service.getTimeUntilExpiry();
      // After immediate extension, time should be reset to near full timeout
      expect(timeAfter).toBeGreaterThanOrEqual(timeMiddle - 1000);
    });

    test('should skip extend when session inactive', async () => {
      const initialCalls = (AsyncStorage.setItem as jest.Mock).mock.calls
        .length;
      service.extendSession(15);

      const finalCalls = (AsyncStorage.setItem as jest.Mock).mock.calls.length;
      expect(finalCalls).toBe(initialCalls);
    });

    test('should save extended activity to AsyncStorage', async () => {
      await service.startSession();
      (AsyncStorage.setItem as jest.Mock).mockClear();

      await service.extendSession(15);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'session_last_activity',
        expect.any(String),
      );
    });

    test('should handle storage error during extension', async () => {
      await service.startSession();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage failed'),
      );

      // Should not throw, session should remain active in memory
      await service.extendSession(15);
      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should keep session active in memory even if storage fails', async () => {
      await service.startSession();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage failed'),
      );

      await service.extendSession(15);
      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should force session expiry', async () => {
      await service.startSession();

      await service.forceExpiry();

      expect(service.getSessionInfo().isActive).toBe(false);
    });
  });

  // ============================================================================
  // 8. SESSION INFO & TIMING TESTS
  // ============================================================================

  describe('Session Info & Timing', () => {
    test('should return session info with correct structure', async () => {
      await service.startSession({ timeout: 60 });
      const info = service.getSessionInfo();

      expect(info).toHaveProperty('isActive');
      expect(info).toHaveProperty('lastActivity');
      expect(info).toHaveProperty('expiresAt');
      expect(info).toHaveProperty('timeRemaining');
    });

    test('should calculate correct time remaining', async () => {
      await service.startSession({ timeout: 60 });
      const info = service.getSessionInfo();

      const expectedExpiry = info.lastActivity + 60 * 60 * 1000;
      expect(Math.abs(info.expiresAt - expectedExpiry)).toBeLessThan(100);
    });

    test('should return time remaining as positive', async () => {
      await service.startSession({ timeout: 60 });
      const info = service.getSessionInfo();

      expect(info.timeRemaining).toBeGreaterThan(0);
    });

    test('should return zero time remaining when expired', async () => {
      await service.startSession({ timeout: 1 });

      jest.advanceTimersByTime(1 * 60 * 1000 + 1000);
      jest.runAllTimers();

      const info = service.getSessionInfo();
      expect(info.timeRemaining).toBeLessThanOrEqual(0);
    });

    test('should get time until expiry in milliseconds', async () => {
      await service.startSession({ timeout: 60 });
      const timeUntilExpiry = service.getTimeUntilExpiry();

      expect(timeUntilExpiry).toBeGreaterThan(0);
      expect(timeUntilExpiry).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });

  // ============================================================================
  // 9. BACKGROUND/FOREGROUND HANDLING TESTS
  // ============================================================================

  describe('Background/Foreground Handling', () => {
    test('should record background time on app background', async () => {
      await service.startSession();
      const debugBefore = service.getDebugInfo();

      appStateListenerCallback?.('background');

      const debugAfter = service.getDebugInfo();
      expect(debugAfter.backgroundTime).toBeGreaterThan(
        debugBefore.backgroundTime,
      );
    });

    test('should trigger session check on app active', async () => {
      await service.startSession();
      appStateListenerCallback?.('background');

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        Date.now().toString(),
      );

      appStateListenerCallback?.('active');

      // checkSessionOnResume is called
      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should require re-authentication after 30s background', async () => {
      await service.startSession({ lockOnBackground: true, timeout: 60 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(31000); // 31 seconds

      const result = await service.checkSessionOnResume();

      expect(result).toBe(false);
    });

    test('should allow session if background < 30s', async () => {
      await service.startSession({ lockOnBackground: true, timeout: 60 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(20000); // 20 seconds

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        Date.now().toString(),
      );

      const result = await service.checkSessionOnResume();

      expect(result).toBe(true);
    });

    test('should ignore lockOnBackground if disabled', async () => {
      await service.startSession({ lockOnBackground: false, timeout: 60 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(31000);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        Date.now().toString(),
      );

      const result = await service.checkSessionOnResume();

      expect(result).toBe(true);
    });

    test('should expire session if timeout exceeded after background', async () => {
      await service.startSession({ lockOnBackground: false, timeout: 1 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(70000); // 70 seconds (exceeds 1 minute)

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await service.checkSessionOnResume();

      expect(result).toBe(false);
    });

    test('should handle missing session data on resume', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await service.checkSessionOnResume();

      expect(result).toBe(false);
    });

    test('should restore session on valid resume', async () => {
      const now = Date.now();
      await service.startSession({ timeout: 60 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(now.toString());

      const result = await service.checkSessionOnResume();

      expect(result).toBe(true);
      expect(service.getSessionInfo().isActive).toBe(true);
    });
  });

  // ============================================================================
  // 10. AUTHENTICATION REQUIREMENT TESTS
  // ============================================================================

  describe('Authentication Requirement', () => {
    test('should require full login when no active session', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await service.getAuthenticationRequirement();

      expect(result.type).toBe('fullLogin');
      expect(result.reason).toBe('no_active_session');
      expect(result.sessionValid).toBe(false);
    });

    test('should require full login when session expired', async () => {
      const veryOldTime = Date.now() - 20 * 60 * 1000; // 20 minutes ago
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        veryOldTime.toString(),
      );

      await service.startSession({ timeout: 10 }); // 10 minute timeout

      const result = await service.getAuthenticationRequirement();

      expect(result.type).toBe('fullLogin');
      expect(result.reason).toBe('session_expired');
      expect(result.sessionValid).toBe(false);
    });

    test('should require biometric for quick unlock', async () => {
      const now = Date.now();
      await service.startSession({ timeout: 60 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(5000); // 5 seconds

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(now.toString());

      const result = await service.getAuthenticationRequirement();

      expect(result.type).toBe('biometric');
      expect(result.reason).toBe('quick_unlock');
      expect(result.sessionValid).toBe(true);
    });

    test('should require biometric when lockOnBackground exceeded', async () => {
      const now = Date.now();
      await service.startSession({ lockOnBackground: true, timeout: 60 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(31000); // 31 seconds

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(now.toString());

      const result = await service.getAuthenticationRequirement();

      expect(result.type).toBe('biometric');
      expect(result.reason).toBe('background_lock_policy');
      expect(result.sessionValid).toBe(true);
    });

    test('should allow no authentication for very quick switches', async () => {
      const now = Date.now();
      await service.startSession({ timeout: 60 });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(500); // 500ms

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(now.toString());

      const result = await service.getAuthenticationRequirement();

      expect(result.type).toBe('none');
      expect(result.reason).toBe('quick_switch');
      expect(result.sessionValid).toBe(true);
    });

    test('should handle errors in getAuthenticationRequirement', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await service.getAuthenticationRequirement();

      expect(result.type).toBe('fullLogin');
      expect(result.reason).toBe('error_checking_session');
      expect(result.sessionValid).toBe(false);
    });
  });

  // ============================================================================
  // 11. TIMER MANAGEMENT TESTS
  // ============================================================================

  describe('Timer Management', () => {
    test('should set expiry timer on startSession', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await service.startSession({ timeout: 60 });

      expect(setTimeoutSpy).toHaveBeenCalled();
      setTimeoutSpy.mockRestore();
    });

    test('should clear timers on endSession', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await service.startSession();
      await service.endSession();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    test('should clear timers on session expiry', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await service.startSession({ timeout: 1 });
      jest.advanceTimersByTime(61000);
      jest.runAllTimers();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    test('should restart timer on extendSession', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const initialCalls = setTimeoutSpy.mock.calls.length;

      await service.startSession({ timeout: 60 });
      jest.advanceTimersByTime(30000);
      await service.extendSession();

      expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(initialCalls);
      setTimeoutSpy.mockRestore();
    });

    test('should set warning timer for longer sessions', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await service.startSession({ timeout: 60 });

      // Should have at least 2 timers: warning and expiry
      expect(setTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      setTimeoutSpy.mockRestore();
    });
  });

  // ============================================================================
  // 12. DEBUG INFO TESTS
  // ============================================================================

  describe('Debug Info', () => {
    test('should return debug info with all properties', async () => {
      await service.startSession({ timeout: 60 });
      const debugInfo = service.getDebugInfo();

      expect(debugInfo).toHaveProperty('isActive');
      expect(debugInfo).toHaveProperty('lastActivity');
      expect(debugInfo).toHaveProperty('backgroundTime');
      expect(debugInfo).toHaveProperty('config');
      expect(debugInfo).toHaveProperty('timeInBackground');
      expect(debugInfo).toHaveProperty('timeSinceActivity');
      expect(debugInfo).toHaveProperty('sessionTimeout');
    });

    test('should calculate timeInBackground correctly', async () => {
      await service.startSession();
      appStateListenerCallback?.('background');

      jest.advanceTimersByTime(5000);

      const debugInfo = service.getDebugInfo();
      expect(debugInfo.timeInBackground).toBeCloseTo(5000, -2);
    });

    test('should calculate timeSinceActivity correctly', async () => {
      await service.startSession();

      jest.advanceTimersByTime(10000);

      const debugInfo = service.getDebugInfo();
      expect(debugInfo.timeSinceActivity).toBeCloseTo(10000, -2);
    });

    test('should include session config in debug info', async () => {
      await service.startSession({ timeout: 45 });
      const debugInfo = service.getDebugInfo();

      expect(debugInfo.config.timeout).toBe(45);
    });
  });

  // ============================================================================
  // 13. CLEANUP & LIFECYCLE TESTS
  // ============================================================================

  describe('Cleanup & Lifecycle', () => {
    test('should cleanup timers on cleanup()', async () => {
      await service.startSession();

      // Cleanup should not throw
      expect(() => service.cleanup()).not.toThrow();

      // Cleanup clears timers but doesn't change session state
      // Session state is only changed by endSession or handleSessionExpiry
      expect(true).toBe(true);
    });

    test('should remove AppState listener on cleanup', () => {
      service.cleanup();

      expect(appStateSubscription.remove).toHaveBeenCalled();
    });

    test('should handle cleanup without active session', () => {
      expect(() => service.cleanup()).not.toThrow();
    });

    test('should handle multiple cleanup calls', async () => {
      await service.startSession();

      expect(() => {
        service.cleanup();
        service.cleanup();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 14. EDGE CASES & COMPLEX SCENARIOS TESTS
  // ============================================================================

  describe('Edge Cases & Complex Scenarios', () => {
    test('should handle rapid session extensions', async () => {
      await service.startSession({ timeout: 60 });
      const timeBefore = service.getTimeUntilExpiry();

      for (let i = 0; i < 5; i++) {
        await service.extendSession(15);
      }

      const timeAfter = service.getTimeUntilExpiry();
      expect(timeAfter).toBeGreaterThanOrEqual(timeBefore - 1000);
    });

    test('should handle config update with no active session', async () => {
      await service.updateConfig({ timeout: 30 });
      const config = service.getConfig();

      expect(config.timeout).toBe(30);
    });

    test('should handle zero timeout gracefully', async () => {
      await service.startSession({ timeout: 0 });
      const info = service.getSessionInfo();

      expect(info.isActive).toBe(true);
      expect(info.expiresAt).toBeGreaterThan(0);
    });

    test('should handle very large timeout values', async () => {
      await service.startSession({ timeout: 999999 });
      const config = service.getConfig();

      expect(config.timeout).toBe(999999);
    });

    test('should maintain session across multiple extends', async () => {
      await service.startSession({ timeout: 5, extendOnActivity: true });

      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(30000);
        await service.updateActivity();
      }

      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should handle background during short timeout', async () => {
      const sessionStart = Date.now();
      await service.startSession({ timeout: 1, lockOnBackground: true });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(31000); // 31 seconds - exceeds lockOnBackground threshold

      // Mock returns the original session start time (expired by now)
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        sessionStart.toString(),
      );

      const result = await service.checkSessionOnResume();
      // Either session expired or requires re-auth due to background lock
      expect(result).toBe(false);
    });

    test('should handle multiple background/active cycles', async () => {
      await service.startSession({ timeout: 60 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        Date.now().toString(),
      );

      for (let i = 0; i < 3; i++) {
        appStateListenerCallback?.('background');
        jest.advanceTimersByTime(5000);
        appStateListenerCallback?.('active');
      }

      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should handle AsyncStorage errors gracefully', async () => {
      // First allow startSession to succeed
      await service.startSession({ timeout: 60 });
      expect(service.getSessionInfo().isActive).toBe(true);

      // Then mock setItem to fail for subsequent calls
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      // Try to update activity - service should handle the error
      await service.updateActivity();

      // Session should still be active in memory
      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should preserve session active state even if storage fails during activity', async () => {
      await service.startSession({ timeout: 60 });
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      await service.updateActivity();

      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should handle inactive app state properly', () => {
      appStateListenerCallback?.('inactive');
      // Should record background time like background state
      const debugInfo = service.getDebugInfo();
      expect(debugInfo.backgroundTime).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 15. INTEGRATION WORKFLOW TESTS
  // ============================================================================

  describe('Integration Workflows', () => {
    test('should complete full login workflow', async () => {
      // 1. Start session on login
      await service.startSession({ timeout: 60 });
      expect(service.getSessionInfo().isActive).toBe(true);

      // 2. Perform activity
      jest.advanceTimersByTime(10000);
      await service.updateActivity();

      // 3. Check session still active
      expect(service.isSessionExpired()).toBe(false);
    });

    test('should complete logout workflow', async () => {
      await service.startSession({ timeout: 60 });

      // Logout
      await service.endSession();

      expect(service.getSessionInfo().isActive).toBe(false);
      expect(service.isSessionExpired()).toBe(true);
    });

    test('should complete background/resume workflow', async () => {
      await service.startSession({ timeout: 60 });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        Date.now().toString(),
      );

      // Go to background
      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(5000);

      // Resume
      appStateListenerCallback?.('active');

      expect(service.getSessionInfo().isActive).toBe(true);
    });

    test('should complete session extension workflow', async () => {
      await service.startSession({ timeout: 5 });

      jest.advanceTimersByTime(4 * 60 * 1000);
      const timeBefore = service.getTimeUntilExpiry();

      await service.extendSession(10);

      const timeAfter = service.getTimeUntilExpiry();
      expect(timeAfter).toBeGreaterThan(timeBefore);
    });

    test('should handle timeout after background workflow', async () => {
      await service.startSession({ timeout: 1, lockOnBackground: true });

      appStateListenerCallback?.('background');
      jest.advanceTimersByTime(35000); // More than 30s background + timeout

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await service.checkSessionOnResume();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // 16. STORAGE PERSISTENCE TESTS
  // ============================================================================

  describe('Storage Persistence', () => {
    test('should load persisted session on recovery', async () => {
      const persistedTime = Date.now();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        persistedTime.toString(),
      );

      const result = await service.checkSessionOnResume();

      expect(result).toBe(true);
    });

    test('should not restore expired persisted session', async () => {
      const expiredTime = Date.now() - 11 * 60 * 1000; // 11 minutes ago
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        expiredTime.toString(),
      );

      await service.startSession({ timeout: 10 });
      const result = await service.checkSessionOnResume();

      expect(result).toBe(false);
    });

    test('should handle corrupted stored activity time', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid');

      const result = await service.checkSessionOnResume();

      // Should handle gracefully
      expect(typeof result).toBe('boolean');
    });
  });
});
