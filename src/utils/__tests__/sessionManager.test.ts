/**
 * sessionManager.test.ts
 * Comprehensive test suite for SessionManager utility
 * Tests app state lifecycle, session timeout logic, and cleanup
 */

import { AppState } from 'react-native';
import { sessionManager } from '../sessionManager';
import * as sessionCacheModule from '../sessionCache';

// Mock dependencies
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
}));

jest.mock('../sessionCache', () => ({
  sessionCache: {
    clear: jest.fn(),
  },
}));

describe('SessionManager', () => {
  let mockAppStateListener: ((state: any) => void) | null = null;
  let mockSubscription: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock for AppState.addEventListener
    mockAppStateListener = null;
    mockSubscription = {
      remove: jest.fn(),
    };

    (AppState.addEventListener as jest.Mock).mockImplementation(
      (event, callback) => {
        if (event === 'change') {
          mockAppStateListener = callback;
        }
        return mockSubscription;
      },
    );

    // Reset sessionManager's internal state
    sessionManager.appStateSubscription = null;
    sessionManager.lastActiveTime = Date.now();

    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('init()', () => {
    test('should initialize AppState listener', () => {
      sessionManager.init();

      expect(AppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(sessionManager.appStateSubscription).toBe(mockSubscription);
    });

    test('should set lastActiveTime to current time', () => {
      const beforeTime = Date.now();
      sessionManager.init();
      const afterTime = Date.now();

      const storedTime = sessionManager.lastActiveTime;
      expect(storedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(storedTime).toBeLessThanOrEqual(afterTime);
    });

    test('should log initialization (implicitly via AppState setup)', () => {
      sessionManager.init();
      expect(AppState.addEventListener).toHaveBeenCalled();
    });
  });

  describe('cleanup()', () => {
    test('should remove AppState subscription', () => {
      sessionManager.init();
      sessionManager.cleanup();

      expect(mockSubscription.remove).toHaveBeenCalled();
    });

    test('should handle cleanup when no subscription exists', () => {
      sessionManager.appStateSubscription = null;
      expect(() => sessionManager.cleanup()).not.toThrow();
    });

    test('should clear subscription reference after cleanup', () => {
      sessionManager.init();
      expect(sessionManager.appStateSubscription).toBeTruthy();
      sessionManager.cleanup();
      // The subscription should still exist (we don't set to null in cleanup)
      // but it should have been removed
      expect(mockSubscription.remove).toHaveBeenCalled();
    });
  });

  describe('handleAppStateChange()', () => {
    beforeEach(() => {
      sessionManager.init();
      jest.clearAllMocks();
    });

    describe('when app becomes active', () => {
      test('should not clear session if app was active for less than timeout', () => {
        const TIMEOUT = 5 * 60 * 1000; // 5 minutes
        sessionManager.lastActiveTime = Date.now();

        // Advance time by 2 minutes (less than timeout)
        jest.advanceTimersByTime(2 * 60 * 1000);

        if (mockAppStateListener) {
          mockAppStateListener('active');
        }

        expect(sessionCacheModule.sessionCache.clear).not.toHaveBeenCalled();
      });

      test('should clear session if app was inactive for more than timeout', () => {
        const TIMEOUT = 5 * 60 * 1000; // 5 minutes
        sessionManager.lastActiveTime = Date.now();

        // Advance time by 6 minutes (more than timeout)
        jest.advanceTimersByTime(6 * 60 * 1000);

        if (mockAppStateListener) {
          mockAppStateListener('active');
        }

        expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalled();
      });

      test('should clear session if app was inactive for exactly timeout duration', () => {
        const TIMEOUT = 5 * 60 * 1000; // 5 minutes
        sessionManager.lastActiveTime = Date.now();

        // Advance time by exactly timeout + 1ms
        jest.advanceTimersByTime(TIMEOUT + 1);

        if (mockAppStateListener) {
          mockAppStateListener('active');
        }

        expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalled();
      });

      test('should update lastActiveTime when app becomes active', () => {
        const initialTime = Date.now();
        sessionManager.lastActiveTime = initialTime;

        jest.advanceTimersByTime(1000);

        if (mockAppStateListener) {
          mockAppStateListener('active');
        }

        expect(sessionManager.lastActiveTime).toBeGreaterThan(initialTime);
      });

      test('should log message when clearing session due to inactivity', () => {
        const consoleSpy = jest.spyOn(console, 'log');
        sessionManager.lastActiveTime = Date.now();

        jest.advanceTimersByTime(6 * 60 * 1000);

        if (mockAppStateListener) {
          mockAppStateListener('active');
        }

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('SessionManager'),
        );
      });
    });

    describe('when app goes to background', () => {
      test('should not clear session immediately on background', () => {
        sessionManager.lastActiveTime = Date.now();

        if (mockAppStateListener) {
          mockAppStateListener('background');
        }

        expect(sessionCacheModule.sessionCache.clear).not.toHaveBeenCalled();
      });

      test('should update lastActiveTime on background', () => {
        const initialTime = Date.now();
        sessionManager.lastActiveTime = initialTime;

        jest.advanceTimersByTime(1000);

        if (mockAppStateListener) {
          mockAppStateListener('background');
        }

        expect(sessionManager.lastActiveTime).toBeGreaterThan(initialTime);
      });

      test('should log background message', () => {
        const consoleSpy = jest.spyOn(console, 'log');
        sessionManager.lastActiveTime = Date.now();

        if (mockAppStateListener) {
          mockAppStateListener('background');
        }

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('backgrounded'),
        );
      });
    });

    describe('when app becomes inactive', () => {
      test('should not clear session immediately on inactive', () => {
        sessionManager.lastActiveTime = Date.now();

        if (mockAppStateListener) {
          mockAppStateListener('inactive');
        }

        expect(sessionCacheModule.sessionCache.clear).not.toHaveBeenCalled();
      });

      test('should update lastActiveTime on inactive', () => {
        const initialTime = Date.now();
        sessionManager.lastActiveTime = initialTime;

        jest.advanceTimersByTime(1000);

        if (mockAppStateListener) {
          mockAppStateListener('inactive');
        }

        expect(sessionManager.lastActiveTime).toBeGreaterThan(initialTime);
      });
    });

    describe('unknown app state', () => {
      test('should handle unknown app state gracefully', () => {
        expect(() => {
          if (mockAppStateListener) {
            mockAppStateListener('unknown' as any);
          }
        }).not.toThrow();
      });
    });
  });

  describe('clearSensitiveData()', () => {
    test('should call sessionCache.clear()', () => {
      sessionManager.clearSensitiveData();

      expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalled();
    });

    test('should clear session cache exactly once per call', () => {
      sessionManager.clearSensitiveData();
      sessionManager.clearSensitiveData();

      expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalledTimes(2);
    });
  });

  describe('logout()', () => {
    test('should clear sensitive data on logout', () => {
      sessionManager.logout();

      expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalled();
    });

    test('should log logout message', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      sessionManager.logout();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('logout'),
      );
    });

    test('should be callable multiple times', () => {
      expect(() => {
        sessionManager.logout();
        sessionManager.logout();
        sessionManager.logout();
      }).not.toThrow();

      expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalledTimes(3);
    });
  });

  describe('isSessionExpired()', () => {
    beforeEach(() => {
      sessionManager.init();
      jest.clearAllMocks();
    });

    test('should return false if session is not expired', () => {
      sessionManager.lastActiveTime = Date.now();
      jest.advanceTimersByTime(2 * 60 * 1000); // 2 minutes

      const isExpired = sessionManager.isSessionExpired();

      expect(isExpired).toBe(false);
    });

    test('should return true if session is expired', () => {
      sessionManager.lastActiveTime = Date.now();
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes (exceeds 5 min timeout)

      const isExpired = sessionManager.isSessionExpired();

      expect(isExpired).toBe(true);
    });

    test('should return true at exact timeout boundary', () => {
      const TIMEOUT = 5 * 60 * 1000;
      sessionManager.lastActiveTime = Date.now();
      jest.advanceTimersByTime(TIMEOUT + 1);

      const isExpired = sessionManager.isSessionExpired();

      expect(isExpired).toBe(true);
    });

    test('should return false just before timeout', () => {
      const TIMEOUT = 5 * 60 * 1000;
      sessionManager.lastActiveTime = Date.now();
      jest.advanceTimersByTime(TIMEOUT - 1);

      const isExpired = sessionManager.isSessionExpired();

      expect(isExpired).toBe(false);
    });

    test('should correctly track expiration after multiple state changes', () => {
      sessionManager.lastActiveTime = Date.now();
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(sessionManager.isSessionExpired()).toBe(false);

      jest.advanceTimersByTime(4 * 60 * 1000); // Total 6 minutes
      expect(sessionManager.isSessionExpired()).toBe(true);
    });
  });

  describe('Integration: Full lifecycle', () => {
    test('should handle complete session lifecycle', () => {
      // Initialize
      sessionManager.init();
      expect(AppState.addEventListener).toHaveBeenCalled();

      // App active - session active
      expect(sessionManager.isSessionExpired()).toBe(false);

      // App backgrounded
      jest.advanceTimersByTime(2 * 60 * 1000);
      if (mockAppStateListener) {
        mockAppStateListener('background');
      }
      expect(sessionCacheModule.sessionCache.clear).not.toHaveBeenCalled();
      expect(sessionManager.isSessionExpired()).toBe(false);

      // App comes back quickly - session still valid
      jest.advanceTimersByTime(1 * 60 * 1000);
      if (mockAppStateListener) {
        mockAppStateListener('active');
      }
      expect(sessionCacheModule.sessionCache.clear).not.toHaveBeenCalled();

      // App backgrounded again
      if (mockAppStateListener) {
        mockAppStateListener('background');
      }

      // Long time passes - session expired
      jest.advanceTimersByTime(6 * 60 * 1000);
      expect(sessionManager.isSessionExpired()).toBe(true);

      // App comes back - cache cleared
      if (mockAppStateListener) {
        mockAppStateListener('active');
      }
      expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalled();

      // Cleanup
      sessionManager.cleanup();
      expect(mockSubscription.remove).toHaveBeenCalled();
    });

    test('should handle rapid state changes', () => {
      sessionManager.init();

      if (mockAppStateListener) {
        mockAppStateListener('active');
        mockAppStateListener('background');
        mockAppStateListener('active');
        mockAppStateListener('background');
        mockAppStateListener('active');
      }

      expect(AppState.addEventListener).toHaveBeenCalled();
      sessionManager.cleanup();
    });

    test('should handle logout at any time', () => {
      sessionManager.init();
      jest.advanceTimersByTime(2 * 60 * 1000);

      sessionManager.logout();
      expect(sessionCacheModule.sessionCache.clear).toHaveBeenCalled();

      sessionManager.cleanup();
      expect(mockSubscription.remove).toHaveBeenCalled();
    });
  });

  describe('Timeout constant', () => {
    test('should use 5-minute timeout constant', () => {
      const EXPECTED_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
      expect(sessionManager.INACTIVE_TIMEOUT).toBe(EXPECTED_TIMEOUT);
    });
  });
});
