/**
 * screenProtectionService.test.ts
 * Comprehensive test suite for screen protection functionality
 */

import { Platform, NativeModules } from 'react-native';

let screenProtectionService: any;

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  NativeModules: {
    ScreenProtectionModule: {
      enableProtection: jest.fn(),
      disableProtection: jest.fn(),
      isScreenRecording: jest.fn(),
      isProtectionEnabled: jest.fn(),
    },
  },
}));

global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

describe('ScreenProtectionService', () => {
  beforeAll(() => {
    screenProtectionService = require('../screenProtectionService').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish mocks after clearing
    NativeModules.ScreenProtectionModule = {
      enableProtection: jest.fn(),
      disableProtection: jest.fn(),
      isScreenRecording: jest.fn(),
      isProtectionEnabled: jest.fn(),
    };
    // Reset internal state by disabling protection
    (screenProtectionService as any).isProtectionEnabled = false;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers(); // Ensure real timers are restored
  });

  // ============================================================================
  // BASIC FUNCTIONALITY
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should export a service instance', () => {
      expect(screenProtectionService).toBeDefined();
      expect(typeof screenProtectionService.enableProtection).toBe('function');
      expect(typeof screenProtectionService.disableProtection).toBe('function');
      expect(typeof screenProtectionService.isEnabled).toBe('function');
    });

    it('should initialize with isProtectionEnabled as false', () => {
      expect(screenProtectionService.isEnabled()).toBe(false);
    });

    it('should have all required methods', () => {
      const methods = [
        'enableProtection',
        'disableProtection',
        'isScreenRecording',
        'getProtectionStatus',
        'isEnabled',
        'verifyProtectionStatus',
        'setupScreenRecordingDetection',
        'createSecureView',
      ];
      methods.forEach(method => {
        expect(typeof screenProtectionService[method]).toBe('function');
      });
    });
  });

  // ============================================================================
  // ANDROID PROTECTION
  // ============================================================================

  describe('Android Protection', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });
    });

    it('should enable Android protection successfully', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(true);
      expect(
        NativeModules.ScreenProtectionModule.enableProtection,
      ).toHaveBeenCalled();
      expect(screenProtectionService.isEnabled()).toBe(true);
    });

    it('should handle native module not available', async () => {
      (NativeModules as any).ScreenProtectionModule = undefined;

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should handle native method not available', async () => {
      NativeModules.ScreenProtectionModule = {} as any;

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should return false on enableProtection error', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockRejectedValue(new Error('Native error'));

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should log error on exception', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));

      await screenProtectionService.enableProtection();

      // The service logs the error message, either from private or public method
      expect(console.error).toHaveBeenCalled();
      const callArgs = (console.error as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('error');
    });

    it('should disable Android protection successfully', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);
      NativeModules.ScreenProtectionModule.disableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      await screenProtectionService.enableProtection();
      const result = await screenProtectionService.disableProtection();

      expect(result).toBe(true);
      expect(
        NativeModules.ScreenProtectionModule.disableProtection,
      ).toHaveBeenCalled();
      expect(screenProtectionService.isEnabled()).toBe(false);
    });

    it('should return false on disableProtection error', async () => {
      NativeModules.ScreenProtectionModule.disableProtection = jest
        .fn()
        .mockRejectedValue(new Error('Disable failed'));

      const result = await screenProtectionService.disableProtection();

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // iOS PROTECTION
  // ============================================================================

  describe('iOS Protection', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });
    });

    it('should enable iOS protection successfully', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(true);
      expect(
        NativeModules.ScreenProtectionModule.enableProtection,
      ).toHaveBeenCalled();
    });

    it('should handle native module not available on iOS', async () => {
      (NativeModules as any).ScreenProtectionModule = undefined;

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should log warning when native module unavailable', async () => {
      (NativeModules as any).ScreenProtectionModule = undefined;

      await screenProtectionService.enableProtection();

      expect(console.warn).toHaveBeenCalled();
    });

    it('should return false on iOS enableProtection error', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockRejectedValue(new Error('iOS error'));

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should disable iOS protection successfully', async () => {
      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);
      NativeModules.ScreenProtectionModule.disableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      await screenProtectionService.enableProtection();
      const result = await screenProtectionService.disableProtection();

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // SCREEN RECORDING DETECTION
  // ============================================================================

  describe('Screen Recording Detection', () => {
    it('should return false on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const result = await screenProtectionService.isScreenRecording();

      expect(result).toBe(false);
    });

    it('should check screen recording on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.isScreenRecording = jest
        .fn()
        .mockResolvedValue(true);

      const result = await screenProtectionService.isScreenRecording();

      expect(result).toBe(true);
      expect(
        NativeModules.ScreenProtectionModule.isScreenRecording,
      ).toHaveBeenCalled();
    });

    it('should handle iOS screen recording check error', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.isScreenRecording = jest
        .fn()
        .mockRejectedValue(new Error('Check failed'));

      const result = await screenProtectionService.isScreenRecording();

      expect(result).toBe(false);
    });

    it('should return false when native module not available on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      (NativeModules as any).ScreenProtectionModule = undefined;

      const result = await screenProtectionService.isScreenRecording();

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // PROTECTION STATUS
  // ============================================================================

  describe('Protection Status', () => {
    it('should return protection status on Android', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      await screenProtectionService.enableProtection();

      const status = await screenProtectionService.getProtectionStatus();

      expect(status.isProtected).toBe(true);
      expect(status.screenshotBlocked).toBe(true);
      expect(status.screenRecordingBlocked).toBe(false);
      expect(status.platform).toBe('android');
    });

    it('should return protection status on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);
      NativeModules.ScreenProtectionModule.isScreenRecording = jest
        .fn()
        .mockResolvedValue(false);

      await screenProtectionService.enableProtection();

      const status = await screenProtectionService.getProtectionStatus();

      expect(status.isProtected).toBe(true);
      expect(status.screenshotBlocked).toBe(false);
      expect(status.screenRecordingBlocked).toBe(true);
      expect(status.platform).toBe('ios');
    });

    it('should return disabled status', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const status = await screenProtectionService.getProtectionStatus();

      expect(status.isProtected).toBe(false);
      expect(status.screenshotBlocked).toBe(false);
      expect(status.screenRecordingBlocked).toBe(false);
    });
  });

  describe('isEnabled()', () => {
    it('should return false initially', () => {
      expect(screenProtectionService.isEnabled()).toBe(false);
    });

    it('should return true after enabling', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      await screenProtectionService.enableProtection();

      expect(screenProtectionService.isEnabled()).toBe(true);
    });

    it('should return false after disabling', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);
      NativeModules.ScreenProtectionModule.disableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      await screenProtectionService.enableProtection();
      await screenProtectionService.disableProtection();

      expect(screenProtectionService.isEnabled()).toBe(false);
    });
  });

  // ============================================================================
  // VERIFY PROTECTION STATUS
  // ============================================================================

  describe('Verify Protection Status', () => {
    it('should verify Android protection when enabled', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.isProtectionEnabled = jest
        .fn()
        .mockResolvedValue(true);

      const result = await screenProtectionService.verifyProtectionStatus();

      expect(result.isSet).toBe(true);
      expect(result.platform).toBe('android');
      expect(result.note).toContain('FLAG_SECURE');
    });

    it('should verify Android protection when disabled', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.isProtectionEnabled = jest
        .fn()
        .mockResolvedValue(false);

      const result = await screenProtectionService.verifyProtectionStatus();

      expect(result.isSet).toBe(false);
      expect(result.platform).toBe('android');
    });

    it('should return default status on iOS', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      const result = await screenProtectionService.verifyProtectionStatus();

      expect(result.isSet).toBe(false);
      expect(result.platform).toBe('ios');
      expect(result.note).toContain('not available');
    });

    it('should handle verification error', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.isProtectionEnabled = jest
        .fn()
        .mockRejectedValue(new Error('Verify failed'));

      const result = await screenProtectionService.verifyProtectionStatus();

      expect(result.isSet).toBe(false);
      expect(result.note).toContain('Error');
    });
  });

  // ============================================================================
  // SCREEN RECORDING DETECTION SETUP
  // ============================================================================

  describe('Setup Screen Recording Detection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should return cleanup function on Android', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      const cleanup = screenProtectionService.setupScreenRecordingDetection(
        jest.fn(),
        jest.fn(),
      );

      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('should return a function on iOS that can be called', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      const cleanup = screenProtectionService.setupScreenRecordingDetection(
        jest.fn(),
        jest.fn(),
      );

      expect(typeof cleanup).toBe('function');
      // Cleanup should not throw
      expect(() => cleanup()).not.toThrow();
    });

    it('should set up interval polling on iOS', () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      const cleanup = screenProtectionService.setupScreenRecordingDetection(
        jest.fn(),
        jest.fn(),
      );

      // Should have called setInterval
      expect(setIntervalSpy).toHaveBeenCalled();

      // Clean up the interval
      cleanup();
      setIntervalSpy.mockRestore();
    });
  });

  // ============================================================================
  // CREATE SECURE VIEW
  // ============================================================================

  describe('Create Secure View', () => {
    it('should return secure view configuration', () => {
      const config = screenProtectionService.createSecureView();

      expect(config.pointerEvents).toBe('none');
      expect(config.accessible).toBe(false);
      expect(config.importantForAccessibility).toBe('no-hide-descendants');
      expect(config.accessibilityElementsHidden).toBe(true);
    });

    it('should return consistent configuration', () => {
      const config1 = screenProtectionService.createSecureView();
      const config2 = screenProtectionService.createSecureView();

      expect(config1).toEqual(config2);
    });

    it('should have required properties', () => {
      const config = screenProtectionService.createSecureView();

      expect(config).toHaveProperty('pointerEvents');
      expect(config).toHaveProperty('accessible');
      expect(config).toHaveProperty('importantForAccessibility');
      expect(config).toHaveProperty('accessibilityElementsHidden');
    });
  });

  // ============================================================================
  // EDGE CASES & INTEGRATION
  // ============================================================================

  describe('Edge Cases & Integration', () => {
    it('should handle unsupported platform', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        writable: true,
      });

      const enableResult = await screenProtectionService.enableProtection();
      const disableResult = await screenProtectionService.disableProtection();

      expect(enableResult).toBe(false);
      expect(disableResult).toBe(false);
    });

    it('should handle rapid enable/disable cycles', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);
      NativeModules.ScreenProtectionModule.disableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      for (let i = 0; i < 3; i++) {
        await screenProtectionService.enableProtection();
        expect(screenProtectionService.isEnabled()).toBe(true);

        await screenProtectionService.disableProtection();
        expect(screenProtectionService.isEnabled()).toBe(false);
      }
    });

    it('should handle concurrent operations', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      const results = await Promise.all([
        screenProtectionService.getProtectionStatus(),
        screenProtectionService.isScreenRecording(),
        screenProtectionService.verifyProtectionStatus(),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });

    it('should maintain state consistency', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);
      NativeModules.ScreenProtectionModule.isProtectionEnabled = jest
        .fn()
        .mockResolvedValue(true);

      await screenProtectionService.enableProtection();

      const status = await screenProtectionService.getProtectionStatus();
      expect(status.isProtected).toBe(true);

      expect(screenProtectionService.isEnabled()).toBe(true);
    });

    it('should recover from errors', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce(undefined);

      const result1 = await screenProtectionService.enableProtection();
      expect(result1).toBe(false);

      const result2 = await screenProtectionService.enableProtection();
      expect(result2).toBe(true);
    });

    it('should handle null errors', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockRejectedValue(null);

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should handle non-Error rejections', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockRejectedValue('String error');

      const result = await screenProtectionService.enableProtection();

      expect(result).toBe(false);
    });

    it('should handle module becoming unavailable', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      const result1 = await screenProtectionService.enableProtection();
      expect(result1).toBe(true);

      (NativeModules as any).ScreenProtectionModule = undefined;

      const result2 = await screenProtectionService.disableProtection();
      expect(result2).toBe(false);
    });

    it('should handle multiple concurrent enables', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      NativeModules.ScreenProtectionModule.enableProtection = jest
        .fn()
        .mockResolvedValue(undefined);

      const results = await Promise.all([
        screenProtectionService.enableProtection(),
        screenProtectionService.enableProtection(),
      ]);

      expect(results).toEqual([true, true]);
    });
  });
});
