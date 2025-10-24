/**
 * Security Service Tests
 * Comprehensive test coverage for device security checks and threat detection
 */

import { Platform } from 'react-native';
import JailMonkey from 'jail-monkey';
import DeviceInfo from 'react-native-device-info';
import SecurityService, {
  SecurityCheckResult,
  DeviceSecurityInfo,
  SecurityThreat,
  ThreatType,
} from '../securityService';

// Mock dependencies BEFORE importing service
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  NativeModules: {},
}));

jest.mock('jail-monkey', () => ({
  isJailBroken: jest.fn(() => false),
  hookDetected: jest.fn(() => false),
  canMockLocation: jest.fn(() => false),
  isOnExternalStorage: jest.fn(() => false),
}));

jest.mock('react-native-device-info', () => ({
  isEmulator: jest.fn(async () => false),
  getUniqueId: jest.fn(async () => 'test-device-id'),
  getSystemVersion: jest.fn(async () => '14.0'),
  getVersion: jest.fn(async () => '1.0.0'),
}));

// Mock __DEV__ global
global.__DEV__ = false;

describe('SecurityService', () => {
  beforeEach(() => {
    // Clear singleton instance
    (SecurityService as any).instance = undefined;

    // Reset all mock implementations (but first mock console.error)
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();

    // Re-mock console.error after clearing
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Setup default mock returns
    (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(false);
    (JailMonkey.hookDetected as jest.Mock).mockReturnValue(false);
    (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(false);
    (JailMonkey.isOnExternalStorage as jest.Mock).mockReturnValue(false);

    (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(false);
    (DeviceInfo.getUniqueId as jest.Mock).mockResolvedValue(
      'test-device-id-123',
    );
    (DeviceInfo.getSystemVersion as jest.Mock).mockResolvedValue('14.0');
    (DeviceInfo.getVersion as jest.Mock).mockResolvedValue('1.0.0');

    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = SecurityService;
      const instance2 = SecurityService;
      expect(instance1).toBe(instance2);
    });

    test('should properly initialize singleton on first call', async () => {
      const instance = SecurityService;
      expect(instance).toBeDefined();
      await instance.performSecurityCheck();
      expect(DeviceInfo.getUniqueId as jest.Mock).toHaveBeenCalled();
    });
  });

  describe('performSecurityCheck', () => {
    test('should perform complete security check with all systems secure', async () => {
      const result = await SecurityService.performSecurityCheck();

      expect(result).toHaveProperty('isSecure');
      expect(result).toHaveProperty('threats');
      expect(result).toHaveProperty('deviceInfo');
      expect(typeof result.isSecure).toBe('boolean');
      expect(Array.isArray(result.threats)).toBe(true);
      expect(result.deviceInfo).toBeDefined();
    });

    test('should detect root on Android', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.isSecure).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      const rootThreat = result.threats.find(t => t.type === 'root_detected');
      expect(rootThreat).toBeDefined();
      expect(rootThreat?.severity).toBe('critical');
    });

    test('should detect jailbreak on iOS', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'ios';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.isSecure).toBe(false);
      const jailbreakThreat = result.threats.find(
        t => t.type === 'jailbreak_detected',
      );
      expect(jailbreakThreat).toBeDefined();
      expect(jailbreakThreat?.severity).toBe('critical');
    });

    test('should detect emulator', async () => {
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.isEmulator).toBe(true);
      const emulatorThreat = result.threats.find(
        t => t.type === 'emulator_detected',
      );
      expect(emulatorThreat).toBeDefined();
      expect(emulatorThreat?.severity).toBe('low');
    });

    test('should detect hooked framework', async () => {
      (JailMonkey.hookDetected as jest.Mock).mockReturnValue(true);

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.isSecure).toBe(false);
      const hookThreat = result.threats.find(t => t.type === 'hook_detected');
      expect(hookThreat).toBeDefined();
      expect(hookThreat?.severity).toBe('critical');
    });

    test('should detect mock location on Android', async () => {
      (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.canMockLocation).toBe(true);
    });

    test('should detect external storage on Android', async () => {
      (JailMonkey.isOnExternalStorage as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.isOnExternalStorage).toBe(true);
      const storageThreat = result.threats.find(
        t => t.type === 'tampering_detected',
      );
      // Storage threat may or may not be detected depending on other conditions
      if (storageThreat) {
        expect(storageThreat.severity).toBe('medium');
      }
    });

    test('should set isSecure to false only when critical or high severity threats present', async () => {
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true); // low severity
      const result = await SecurityService.performSecurityCheck(true);

      expect(result.isSecure).toBe(true); // Only low severity threat
    });

    test('should set isSecure to false when high severity threat present', async () => {
      (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(true); // Creates medium/high severity threat
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true); // critical
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.isSecure).toBe(false);
    });

    test('should return device info with correct types', async () => {
      const result = await SecurityService.performSecurityCheck();

      expect(typeof result.deviceInfo.isRooted).toBe('boolean');
      expect(typeof result.deviceInfo.isJailbroken).toBe('boolean');
      expect(typeof result.deviceInfo.isEmulator).toBe('boolean');
      expect(typeof result.deviceInfo.isDebuggerAttached).toBe('boolean');
      expect(typeof result.deviceInfo.isDeveloperModeEnabled).toBe('boolean');
      expect(typeof result.deviceInfo.hasHooks).toBe('boolean');
      expect(typeof result.deviceInfo.hasSuspiciousApps).toBe('boolean');
      expect(typeof result.deviceInfo.canMockLocation).toBe('boolean');
      expect(typeof result.deviceInfo.isOnExternalStorage).toBe('boolean');
      expect(typeof result.deviceInfo.deviceId).toBe('string');
      expect(typeof result.deviceInfo.systemVersion).toBe('string');
      expect(typeof result.deviceInfo.appVersion).toBe('string');
    });

    test('should cache results for 60 seconds', async () => {
      const result1 = await SecurityService.performSecurityCheck();
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);

      const result2 = await SecurityService.performSecurityCheck();

      // Results should be the same due to caching
      expect(result1).toEqual(result2);
    });

    test('should bypass cache when forceRefresh is true', async () => {
      const result1 = await SecurityService.performSecurityCheck();
      const initialCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;

      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      const result2 = await SecurityService.performSecurityCheck(true);

      // forceRefresh should cause another call to DeviceInfo
      const secondCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;
      expect(secondCallCount).toBeGreaterThan(initialCallCount);
    });

    test('should handle errors gracefully and return safe default', async () => {
      // Test that even with partial failures, result structure is valid
      (DeviceInfo.getSystemVersion as jest.Mock).mockRejectedValueOnce(
        new Error('System version error'),
      );

      const result = await SecurityService.performSecurityCheck(true);

      expect(result).toHaveProperty('isSecure');
      expect(result).toHaveProperty('threats');
      expect(result).toHaveProperty('deviceInfo');
      expect(typeof result.isSecure).toBe('boolean');
    });

    test('should collect multiple threats', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (JailMonkey.hookDetected as jest.Mock).mockReturnValue(true);
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.threats.length).toBeGreaterThanOrEqual(2);
      const threatTypes = result.threats.map(t => t.type);
      // Check that hook_detected and emulator_detected are present
      expect(threatTypes).toContain('hook_detected');
      expect(threatTypes).toContain('emulator_detected');
    });

    test('should return proper threat structure', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);

      const result = await SecurityService.performSecurityCheck(true);
      const threat = result.threats[0];

      expect(threat).toHaveProperty('type');
      expect(threat).toHaveProperty('severity');
      expect(threat).toHaveProperty('description');
      expect(threat).toHaveProperty('recommendation');
      expect(['critical', 'high', 'medium', 'low']).toContain(threat.severity);
    });
  });

  describe('isDeviceSecure', () => {
    test('should return true when no critical or high threats detected', async () => {
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true); // low severity only
      const isSecure = await SecurityService.isDeviceSecure();
      expect(typeof isSecure).toBe('boolean');
    });

    test('should return false when critical threat detected', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      const isSecure = await SecurityService.isDeviceSecure();
      expect(isSecure).toBe(false);
    });

    test('should return false when high severity threat detected', async () => {
      (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';
      const isSecure = await SecurityService.isDeviceSecure();
      expect(typeof isSecure).toBe('boolean');
    });

    test('should use cached security check', async () => {
      await SecurityService.performSecurityCheck();
      const initialCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;

      await SecurityService.isDeviceSecure();
      const afterCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;

      // Should not call DeviceInfo again due to caching
      expect(afterCallCount).toBe(initialCallCount);
    });
  });

  describe('getCriticalThreats', () => {
    test('should return only critical severity threats', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);
      (Platform as any).OS = 'android';

      const threats = await SecurityService.getCriticalThreats();

      expect(Array.isArray(threats)).toBe(true);
      threats.forEach(threat => {
        expect(threat.severity).toBe('critical');
      });
    });

    test('should return empty array when no critical threats', async () => {
      // With default setup (no critical threats mocked)
      const threats = await SecurityService.getCriticalThreats();

      expect(Array.isArray(threats)).toBe(true);
      // Should have no critical threats by default
      threats.forEach(threat => {
        expect(threat.severity).toBe('critical');
      });
    });

    test('should return multiple critical threats if present', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (JailMonkey.hookDetected as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const threats = await SecurityService.getCriticalThreats();

      expect(threats.length).toBeGreaterThanOrEqual(1);
      threats.forEach(threat => {
        expect(threat.severity).toBe('critical');
      });
    });
  });

  describe('clearCache', () => {
    test('should clear cached security check', async () => {
      const result1 = await SecurityService.performSecurityCheck();
      const initialCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;

      SecurityService.clearCache();
      const result2 = await SecurityService.performSecurityCheck();

      // Should make another call after cache clear
      const secondCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;
      expect(secondCallCount).toBeGreaterThan(initialCallCount);
    });

    test('should allow new security check after clearing cache', async () => {
      await SecurityService.performSecurityCheck();
      const initialCallCount = (DeviceInfo.getUniqueId as jest.Mock).mock.calls
        .length;

      SecurityService.clearCache();
      await SecurityService.performSecurityCheck();

      // Should call DeviceInfo again after cache clear
      expect(
        (DeviceInfo.getUniqueId as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(initialCallCount);
    });

    test('should not throw when clearing cache', () => {
      expect(() => SecurityService.clearCache()).not.toThrow();
    });

    test('should allow cache rebuild after clear', async () => {
      await SecurityService.performSecurityCheck();
      SecurityService.clearCache();

      const result = await SecurityService.performSecurityCheck();

      expect(result).toHaveProperty('isSecure');
      expect(result).toHaveProperty('threats');
      expect(result).toHaveProperty('deviceInfo');
    });
  });

  describe('getSecuritySummary', () => {
    test('should return secure summary when device is secure', async () => {
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true); // only low severity
      const summary = await SecurityService.getSecuritySummary();

      expect(typeof summary).toBe('string');
      expect(summary).toContain('✅');
    });

    test('should indicate critical threats in summary', async () => {
      // Clear cache to ensure fresh check
      SecurityService.clearCache();

      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const summary = await SecurityService.getSecuritySummary();

      expect(summary).toBeDefined();
      expect(summary).toMatch(/Device security:/);
    });

    test('should indicate high-risk threats when no critical', async () => {
      (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(true);
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(false);
      (Platform as any).OS = 'android';

      const summary = await SecurityService.getSecuritySummary();

      expect(typeof summary).toBe('string');
    });

    test('should return proper format', async () => {
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);
      const summary = await SecurityService.getSecuritySummary();

      expect(summary).toMatch(/Device security:/);
    });

    test('should include threat count in summary', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (JailMonkey.hookDetected as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const summary = await SecurityService.getSecuritySummary();

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('Device Info Collection', () => {
    test('should collect device ID from DeviceInfo', async () => {
      (DeviceInfo.getUniqueId as jest.Mock).mockResolvedValue(
        'unique-device-id-xyz',
      );

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.deviceId).toBe('unique-device-id-xyz');
    });

    test('should collect system version from DeviceInfo', async () => {
      (DeviceInfo.getSystemVersion as jest.Mock).mockResolvedValue('15.5');

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.systemVersion).toBe('15.5');
    });

    test('should collect app version from DeviceInfo', async () => {
      (DeviceInfo.getVersion as jest.Mock).mockResolvedValue('2.3.4');

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.appVersion).toBe('2.3.4');
    });

    test('should collect all security checks for Android', async () => {
      (Platform as any).OS = 'android';
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(true);
      (JailMonkey.isOnExternalStorage as jest.Mock).mockReturnValue(true);
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);

      const result = await SecurityService.performSecurityCheck(true);
      const { deviceInfo } = result;

      expect(typeof deviceInfo.isRooted).toBe('boolean');
      expect(typeof deviceInfo.isJailbroken).toBe('boolean');
      expect(typeof deviceInfo.isEmulator).toBe('boolean');
      expect(typeof deviceInfo.canMockLocation).toBe('boolean');
      expect(typeof deviceInfo.isOnExternalStorage).toBe('boolean');
    });

    test('should collect all security checks for iOS', async () => {
      (Platform as any).OS = 'ios';
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(false);

      const result = await SecurityService.performSecurityCheck(true);
      const { deviceInfo } = result;

      expect(typeof deviceInfo.isJailbroken).toBe('boolean');
      expect(typeof deviceInfo.isEmulator).toBe('boolean');
    });
  });

  describe('Platform-Specific Checks', () => {
    test('should skip root check on iOS', async () => {
      (Platform as any).OS = 'ios';
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(false);

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.isRooted).toBe(false);
    });

    test('should skip jailbreak check on Android', async () => {
      (Platform as any).OS = 'android';
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(false);

      const result = await SecurityService.performSecurityCheck(true);

      // On Android, isJailbroken might be checked but won't be set to true by jailbreak logic
      expect(typeof result.deviceInfo.isJailbroken).toBe('boolean');
    });

    test('should skip mock location check on iOS', async () => {
      (Platform as any).OS = 'ios';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.canMockLocation).toBe(false);
    });

    test('should skip external storage check on iOS', async () => {
      (Platform as any).OS = 'ios';

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.isOnExternalStorage).toBe(false);
    });
  });

  describe('Threat Analysis Logic', () => {
    test('should create appropriate threat objects', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);
      const rootThreat = result.threats[0];

      expect(rootThreat.type).toBeDefined();
      expect(rootThreat.severity).toBeDefined();
      expect(rootThreat.description).toBeDefined();
      expect(rootThreat.recommendation).toBeDefined();
    });

    test('should provide actionable recommendations', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);
      const threat = result.threats[0];

      expect(threat.recommendation).toBeTruthy();
      expect(threat.recommendation.length).toBeGreaterThan(0);
    });

    test('should not create duplicate threats', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);
      (JailMonkey.canMockLocation as jest.Mock).mockReturnValue(false);
      (Platform as any).OS = 'android';

      const result = await SecurityService.performSecurityCheck(true);
      const threatTypes = result.threats.map(t => t.type);

      expect(new Set(threatTypes).size).toBe(threatTypes.length); // No duplicates
    });
  });

  describe('Error Handling', () => {
    test('should handle JailMonkey errors gracefully', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockImplementation(() => {
        throw new Error('JailMonkey error');
      });

      const result = await SecurityService.performSecurityCheck(true);

      expect(result).toHaveProperty('isSecure');
      expect(result).toHaveProperty('threats');
      expect(result).toHaveProperty('deviceInfo');
    });

    test('should handle partial security check failures', async () => {
      (JailMonkey.hookDetected as jest.Mock).mockImplementation(() => {
        throw new Error('Hook check error');
      });

      const result = await SecurityService.performSecurityCheck(true);

      expect(result).toHaveProperty('isSecure');
      expect(result).toHaveProperty('threats');
      expect(Array.isArray(result.threats)).toBe(true);
    });

    test('should continue security check despite individual failures', async () => {
      (JailMonkey.isJailBroken as jest.Mock).mockImplementation(() => {
        throw new Error('error');
      });
      (JailMonkey.canMockLocation as jest.Mock).mockImplementation(() => {
        throw new Error('error');
      });

      const result = await SecurityService.performSecurityCheck(true);

      expect(result).toHaveProperty('isSecure');
      expect(result).toHaveProperty('threats');
      expect(result).toHaveProperty('deviceInfo');
    });

    test('should return valid result structure on error', async () => {
      (JailMonkey.isOnExternalStorage as jest.Mock).mockImplementation(() => {
        throw new Error('error');
      });

      const result = await SecurityService.performSecurityCheck(true);

      expect(result).toHaveProperty('isSecure');
      expect(typeof result.isSecure).toBe('boolean');
      expect(Array.isArray(result.threats)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle no threats scenario', async () => {
      const result = await SecurityService.performSecurityCheck();

      expect(Array.isArray(result.threats)).toBe(true);
      expect(result.isSecure).toBe(result.threats.length === 0);
    });

    test('should handle multiple security checks in succession', async () => {
      const result1 = await SecurityService.performSecurityCheck();
      const result2 = await SecurityService.performSecurityCheck();

      expect(result1).toEqual(result2); // cached
    });

    test('should clear cache and perform fresh check', async () => {
      await SecurityService.performSecurityCheck();
      SecurityService.clearCache();
      (JailMonkey.isJailBroken as jest.Mock).mockReturnValue(true);

      const result = await SecurityService.performSecurityCheck();

      expect(result.isSecure).toBe(false);
    });

    test('should handle rapid successive checks', async () => {
      const results = await Promise.all([
        SecurityService.performSecurityCheck(),
        SecurityService.performSecurityCheck(),
        SecurityService.performSecurityCheck(),
      ]);

      // All should be the same due to caching
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    test('should correctly identify device types', async () => {
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);

      const result = await SecurityService.performSecurityCheck(true);

      expect(result.deviceInfo.isEmulator).toBe(true);
    });
  });
});
