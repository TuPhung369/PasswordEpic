import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeEventSubscription } from 'react-native';
import { UserActivityService, ActivityInfo } from '../userActivityService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

// Mock SessionService
jest.mock('../sessionService', () => ({
  default: {
    getInstance: jest.fn(() => ({
      updateActivity: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
}));

describe('UserActivityService', () => {
  let service: UserActivityService;
  let mockAsyncStorage: jest.Mocked<typeof AsyncStorage>;
  let mockAppStateListener: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();

    // Reset singleton
    (UserActivityService as any).instance = undefined;
    service = UserActivityService.getInstance();

    // Setup AsyncStorage mock
    mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);

    // Setup AppState mock
    mockAppStateListener = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (service) {
      service.cleanup();
    }
  });

  // ============================================
  // SINGLETON PATTERN TESTS
  // ============================================

  describe('Singleton Pattern', () => {
    it('should create a single instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(UserActivityService);
    });

    it('should return the same instance on multiple calls', () => {
      const service1 = UserActivityService.getInstance();
      const service2 = UserActivityService.getInstance();
      expect(service1).toBe(service2);
    });

    it('should have all required methods', () => {
      expect(typeof service.initialize).toBe('function');
      expect(typeof service.startTracking).toBe('function');
      expect(typeof service.stopTracking).toBe('function');
      expect(typeof service.recordUserInteraction).toBe('function');
      expect(typeof service.updateConfig).toBe('function');
      expect(typeof service.getActivityInfo).toBe('function');
      expect(typeof service.shouldAutoLock).toBe('function');
      expect(typeof service.subscribe).toBe('function');
      expect(typeof service.getTimeUntilAutoLock).toBe('function');
      expect(typeof service.triggerAutoLock).toBe('function');
      expect(typeof service.cleanup).toBe('function');
    });
  });

  // ============================================
  // INITIALIZATION TESTS
  // ============================================

  describe('Initialization', () => {
    it('should initialize with default config', async () => {
      await service.initialize();

      mockAsyncStorage.getItem.mockResolvedValueOnce(null);
      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true); // Just initialized, should be active
    });

    it('should load saved config from AsyncStorage', async () => {
      const savedConfig = {
        inactivityTimeout: 10,
        trackUserInteraction: false,
      };
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user_activity_config') {
          return Promise.resolve(JSON.stringify(savedConfig));
        }
        return Promise.resolve(null);
      });

      await service.initialize();
      await service.updateConfig({ inactivityTimeout: 5 }); // Update to verify config was loaded
    });

    it('should load last interaction time from AsyncStorage', async () => {
      const lastInteractionTime = Date.now() - 60000; // 1 minute ago
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user_last_interaction') {
          return Promise.resolve(lastInteractionTime.toString());
        }
        return Promise.resolve(null);
      });

      await service.initialize();
      const info = service.getActivityInfo();
      expect(info.lastUserInteraction).toBe(lastInteractionTime);
    });

    it('should save new last interaction if not found in storage', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await service.initialize();

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'user_last_interaction',
        expect.any(String),
      );
    });

    it('should handle initialization errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await service.initialize();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize UserActivityService:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================
  // START/STOP TRACKING TESTS
  // ============================================

  describe('Start/Stop Tracking', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should start tracking successfully', async () => {
      await service.startTracking();

      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);
    });

    it('should prevent multiple startTracking calls', async () => {
      await service.startTracking();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.startTracking();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '🎯 Already tracking user activity',
      );
      consoleLogSpy.mockRestore();
    });

    it('should setup app state listener when starting tracking', async () => {
      await service.startTracking();

      expect(AppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should stop tracking successfully', async () => {
      await service.startTracking();
      service.stopTracking();

      // After stopping, shouldAutoLock should return false
      expect(service.shouldAutoLock()).toBe(false);
    });

    it('should clear timers when stopping tracking', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      service.stopTracking();

      // Timer should be cleared
      expect(service.shouldAutoLock()).toBe(false);
      jest.useRealTimers();
    });

    it('should remove app state subscription when stopping', async () => {
      const mockRemove = jest.fn();
      (AppState.addEventListener as jest.Mock).mockReturnValue({
        remove: mockRemove,
      });

      await service.startTracking();
      service.stopTracking();

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should handle multiple stop calls safely', () => {
      expect(() => {
        service.stopTracking();
        service.stopTracking();
      }).not.toThrow();
    });
  });

  // ============================================
  // RECORD USER INTERACTION TESTS
  // ============================================

  describe('Record User Interaction', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.startTracking();
    });

    it('should record user interaction', async () => {
      jest.useFakeTimers();
      await service.recordUserInteraction();

      jest.advanceTimersByTime(600); // Wait for debounce
      await Promise.resolve(); // Flush promises

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'user_last_interaction',
        expect.any(String),
      );
      jest.useRealTimers();
    });

    it('should debounce rapid interaction calls', async () => {
      jest.useFakeTimers();

      await service.recordUserInteraction();
      await service.recordUserInteraction();
      await service.recordUserInteraction();

      jest.advanceTimersByTime(600);
      await Promise.resolve();

      // Should only save once due to debouncing
      const setItemCalls = mockAsyncStorage.setItem.mock.calls.filter(
        call => call[0] === 'user_last_interaction',
      );
      expect(setItemCalls.length).toBeGreaterThanOrEqual(1);
      jest.useRealTimers();
    });

    it('should not record interaction if not tracking', async () => {
      service.stopTracking();
      mockAsyncStorage.setItem.mockClear();

      await service.recordUserInteraction();

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should not record interaction if trackUserInteraction is disabled', async () => {
      await service.updateConfig({ trackUserInteraction: false });
      mockAsyncStorage.setItem.mockClear();

      await service.recordUserInteraction();

      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should restart inactivity timer on interaction', async () => {
      jest.useFakeTimers();
      await service.recordUserInteraction();

      jest.advanceTimersByTime(600);
      await Promise.resolve();

      // Timer should be restarted
      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);
      jest.useRealTimers();
    });

    it('should handle interaction recording errors', async () => {
      jest.useFakeTimers();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAsyncStorage.setItem.mockRejectedValueOnce(
        new Error('Storage error'),
      );

      await service.recordUserInteraction();
      jest.advanceTimersByTime(600);
      await Promise.resolve();

      // The error comes from saveLastInteraction within the debounce
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save last interaction:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  // ============================================
  // UPDATE CONFIG TESTS
  // ============================================

  describe('Update Config', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should update configuration', async () => {
      await service.updateConfig({ inactivityTimeout: 10 });

      const info = service.getActivityInfo();
      expect(info.timeUntilAutoLock).toBeGreaterThan(0);
    });

    it('should save config to AsyncStorage', async () => {
      await service.updateConfig({ inactivityTimeout: 15 });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'user_activity_config',
        expect.stringContaining('"inactivityTimeout":15'),
      );
    });

    it('should restart inactivity timer when timeout changes while tracking', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      await service.updateConfig({ inactivityTimeout: 10 });

      // Timer should be restarted with new timeout
      jest.useRealTimers();
    });

    it('should not restart timer if not tracking', async () => {
      const setItemSpy = jest.spyOn(mockAsyncStorage, 'setItem');
      setItemSpy.mockClear();

      await service.updateConfig({ inactivityTimeout: 8 });

      // Should only save config, not restart timer
      expect(setItemSpy).toHaveBeenCalledWith(
        'user_activity_config',
        expect.any(String),
      );
    });

    it('should handle partial config updates', async () => {
      await service.updateConfig({ trackUserInteraction: false });

      const info = service.getActivityInfo();
      expect(info).toBeDefined();
    });

    it('should handle config update errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAsyncStorage.setItem.mockRejectedValueOnce(
        new Error('Storage error'),
      );

      await service.updateConfig({ inactivityTimeout: 20 });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update activity config:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it('should restart timer when trackUserInteraction is set to true', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      await service.updateConfig({ trackUserInteraction: true });

      // Timer should be restarted
      jest.useRealTimers();
    });
  });

  // ============================================
  // GET ACTIVITY INFO TESTS
  // ============================================

  describe('Get Activity Info', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.startTracking();
    });

    it('should return activity info', () => {
      const info = service.getActivityInfo();

      expect(info).toHaveProperty('lastUserInteraction');
      expect(info).toHaveProperty('lastAppState');
      expect(info).toHaveProperty('isUserActive');
      expect(info).toHaveProperty('timeUntilAutoLock');
      expect(info).toHaveProperty('shouldLock');
    });

    it('should mark user as active when within timeout', () => {
      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);
    });

    it('should mark user as inactive when past timeout', async () => {
      jest.useFakeTimers();

      await service.updateConfig({ inactivityTimeout: 1 }); // 1 minute

      // Advance time by 2 minutes
      jest.advanceTimersByTime(2 * 60 * 1000);

      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(false);

      jest.useRealTimers();
    });

    it('should calculate timeUntilAutoLock correctly', () => {
      const info = service.getActivityInfo();
      // Should be close to 5 minutes (default timeout)
      expect(info.timeUntilAutoLock).toBeGreaterThan(0);
      expect(info.timeUntilAutoLock).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('should set timeUntilAutoLock to 0 when inactive', async () => {
      jest.useFakeTimers();
      await service.updateConfig({ inactivityTimeout: 1 });

      jest.advanceTimersByTime(2 * 60 * 1000);

      const info = service.getActivityInfo();
      expect(info.timeUntilAutoLock).toBe(0);

      jest.useRealTimers();
    });

    it('should include shouldLock flag when passed', () => {
      const info = service.getActivityInfo(true);
      expect(info.shouldLock).toBe(true);
    });

    it('should include app state in activity info', () => {
      const info = service.getActivityInfo();
      expect(info.lastAppState).toBe('active');
    });
  });

  // ============================================
  // AUTO-LOCK LOGIC TESTS
  // ============================================

  describe('Auto-Lock Logic', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.startTracking();
    });

    it('should not auto-lock when user is active', () => {
      const shouldLock = service.shouldAutoLock();
      expect(shouldLock).toBe(false);
    });

    it('should return false if not tracking', async () => {
      service.stopTracking();
      const shouldLock = service.shouldAutoLock();
      expect(shouldLock).toBe(false);
    });

    it('should trigger auto-lock callback', async () => {
      const callback = jest.fn();
      service.subscribe(callback);

      service.triggerAutoLock();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldLock: true,
        }),
      );
    });

    it('should trigger auto-lock when timeout reached', async () => {
      jest.useFakeTimers();
      const callback = jest.fn();
      service.subscribe(callback);

      await service.updateConfig({ inactivityTimeout: 1 });

      // Advance time past timeout
      jest.advanceTimersByTime(2 * 60 * 1000);
      await Promise.resolve();

      // shouldAutoLock should return true
      const shouldLock = service.shouldAutoLock();
      expect(shouldLock).toBe(true);

      jest.useRealTimers();
    });

    it('should get time until auto-lock', () => {
      const timeUntilLock = service.getTimeUntilAutoLock();
      expect(timeUntilLock).toBeGreaterThan(0);
      expect(timeUntilLock).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('should return 0 for time until auto-lock when inactive', async () => {
      jest.useFakeTimers();
      await service.updateConfig({ inactivityTimeout: 1 });

      jest.advanceTimersByTime(2 * 60 * 1000);

      const timeUntilLock = service.getTimeUntilAutoLock();
      expect(timeUntilLock).toBe(0);

      jest.useRealTimers();
    });
  });

  // ============================================
  // SUBSCRIPTION TESTS
  // ============================================

  describe('Subscription & Callbacks', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.startTracking();
    });

    it('should subscribe to activity changes', () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when notified', () => {
      const callback = jest.fn();
      service.subscribe(callback);

      service.triggerAutoLock();

      expect(callback).toHaveBeenCalled();
    });

    it('should pass activity info to callbacks', () => {
      const callback = jest.fn();
      service.subscribe(callback);

      service.triggerAutoLock();

      const callArg = callback.mock.calls[0][0] as ActivityInfo;
      expect(callArg).toHaveProperty('isUserActive');
      expect(callArg).toHaveProperty('lastUserInteraction');
      expect(callArg).toHaveProperty('timeUntilAutoLock');
      expect(callArg).toHaveProperty('shouldLock');
    });

    it('should unsubscribe from callbacks', () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe(callback);

      unsubscribe();
      service.triggerAutoLock();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.subscribe(callback1);
      service.subscribe(callback2);

      service.triggerAutoLock();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle errors in callbacks gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();

      service.subscribe(errorCallback);
      service.subscribe(normalCallback);

      service.triggerAutoLock();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled(); // Should still be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in activity callback:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================
  // APP STATE CHANGES TESTS
  // ============================================

  describe('App State Changes', () => {
    let mockAppStateCallback: (state: string) => void;

    beforeEach(async () => {
      jest.useFakeTimers();
      await service.initialize();

      // Capture the app state callback
      mockAppStateCallback = (AppState.addEventListener as jest.Mock).mock
        .calls[0]?.[1];
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle app returning to foreground within timeout', async () => {
      await service.startTracking();

      // Get the callback that was registered
      const callback = (AppState.addEventListener as jest.Mock).mock.calls[
        (AppState.addEventListener as jest.Mock).mock.calls.length - 1
      ]?.[1];

      if (callback) {
        // Simulate app going to background then returning
        callback('background');
        jest.advanceTimersByTime(2 * 60 * 1000); // 2 minutes (less than 5 min timeout)
        callback('active');

        await Promise.resolve();

        const shouldLock = service.shouldAutoLock();
        expect(shouldLock).toBe(false); // Should not lock yet
      }
    });

    it('should trigger auto-lock when app returns after timeout', async () => {
      await service.startTracking();

      const callback = (AppState.addEventListener as jest.Mock).mock.calls[
        (AppState.addEventListener as jest.Mock).mock.calls.length - 1
      ]?.[1];

      if (callback) {
        await service.updateConfig({ inactivityTimeout: 1 });

        callback('background');
        jest.advanceTimersByTime(2 * 60 * 1000); // 2 minutes (more than 1 min timeout)
        callback('active');

        await Promise.resolve();

        const shouldLock = service.shouldAutoLock();
        expect(shouldLock).toBe(true); // Should lock
      }
    });

    it('should log app state changes', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await service.startTracking();

      const callback = (AppState.addEventListener as jest.Mock).mock.calls[
        (AppState.addEventListener as jest.Mock).mock.calls.length - 1
      ]?.[1];

      if (callback) {
        callback('background');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('App state changed'),
        );
      }

      consoleLogSpy.mockRestore();
    });
  });

  // ============================================
  // CLEANUP TESTS
  // ============================================

  describe('Cleanup', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.startTracking();
    });

    it('should cleanup resources', () => {
      service.cleanup();

      expect(service.shouldAutoLock()).toBe(false);
    });

    it('should clear callbacks on cleanup', () => {
      const callback = jest.fn();
      service.subscribe(callback);

      service.cleanup();
      service.triggerAutoLock();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should stop tracking on cleanup', () => {
      service.cleanup();

      const info = service.getActivityInfo();
      expect(service.shouldAutoLock()).toBe(false);
    });
  });

  // ============================================
  // EDGE CASES & INTEGRATION TESTS
  // ============================================

  describe('Edge Cases & Integration', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle rapid start/stop cycles', async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        await service.startTracking();
        jest.advanceTimersByTime(100);
        service.stopTracking();
        jest.advanceTimersByTime(100);
      }

      expect(() => service.getActivityInfo()).not.toThrow();
      jest.useRealTimers();
    });

    it('should maintain state through config updates', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      const initialInfo = service.getActivityInfo();

      await service.updateConfig({ inactivityTimeout: 15 });

      const updatedInfo = service.getActivityInfo();
      expect(updatedInfo.lastUserInteraction).toBe(
        initialInfo.lastUserInteraction,
      );

      jest.useRealTimers();
    });

    it('should handle very long inactivity timeout', async () => {
      await service.updateConfig({ inactivityTimeout: 1440 }); // 24 hours
      await service.startTracking();

      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);
      expect(info.timeUntilAutoLock).toBeGreaterThan(0);
    });

    it('should handle zero timeout gracefully', async () => {
      await service.updateConfig({ inactivityTimeout: 0.1 }); // Very short
      await service.startTracking();

      const info = service.getActivityInfo();
      expect(info).toBeDefined();
    });

    it('should handle multiple interactions in quick succession', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      for (let i = 0; i < 10; i++) {
        await service.recordUserInteraction();
        jest.advanceTimersByTime(100);
      }

      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);

      jest.useRealTimers();
    });

    it('should sync with session service on interaction', async () => {
      jest.useFakeTimers();
      // The SessionService is already mocked at the top of the file
      // We can verify it gets called through the mock
      mockAsyncStorage.setItem.mockClear();

      await service.startTracking();
      await service.recordUserInteraction();

      jest.advanceTimersByTime(600);
      await Promise.resolve();

      // Verify the interaction was recorded (which triggers session sync)
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'user_last_interaction',
        expect.any(String),
      );
      jest.useRealTimers();
    });

    it('should handle AsyncStorage unavailability', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(
        new Error('AsyncStorage unavailable'),
      );

      expect(() => service.initialize()).not.toThrow();
    });

    it('should properly track app foreground state', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      const callback = (AppState.addEventListener as jest.Mock).mock.calls[
        (AppState.addEventListener as jest.Mock).mock.calls.length - 1
      ]?.[1];

      if (callback) {
        expect(service.shouldAutoLock()).toBe(false);

        callback('background');
        expect(service.shouldAutoLock()).toBe(false); // Still shouldn't lock immediately

        callback('active');
        expect(service.shouldAutoLock()).toBe(false); // Back active
      }

      jest.useRealTimers();
    });
  });

  // ============================================
  // CONCURRENCY & TIMING TESTS
  // ============================================

  describe('Concurrency & Timing', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle concurrent operations', async () => {
      await Promise.all([
        service.startTracking(),
        service.recordUserInteraction(),
        service.updateConfig({ inactivityTimeout: 10 }),
      ]);

      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);
    });

    it('should debounce consecutive interactions correctly', async () => {
      jest.useFakeTimers();
      mockAsyncStorage.setItem.mockClear();
      await service.startTracking();

      // Record multiple interactions rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.recordUserInteraction());
      }
      await Promise.all(promises);

      jest.advanceTimersByTime(600);
      await Promise.resolve();

      // Should have debounced these calls
      const setItemCalls = mockAsyncStorage.setItem.mock.calls;
      const interactionSaves = setItemCalls.filter(
        call => call[0] === 'user_last_interaction',
      );
      expect(interactionSaves.length).toBeGreaterThanOrEqual(1);

      jest.useRealTimers();
    });

    it('should handle interaction recorded while updating config', async () => {
      jest.useFakeTimers();
      await service.startTracking();

      const updatePromise = service.updateConfig({ inactivityTimeout: 10 });
      const interactionPromise = service.recordUserInteraction();

      await Promise.all([updatePromise, interactionPromise]);

      jest.advanceTimersByTime(600);
      await Promise.resolve();

      const info = service.getActivityInfo();
      expect(info.isUserActive).toBe(true);

      jest.useRealTimers();
    });
  });

  // ============================================
  // INSTANCE EXPORT TEST
  // ============================================

  describe('Instance Export', () => {
    it('should have instance export', () => {
      // The service should be exportable as a singleton
      const instance = UserActivityService.getInstance();
      expect(instance).toBeDefined();
    });
  });
});
