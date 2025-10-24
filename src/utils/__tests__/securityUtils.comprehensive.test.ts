/**
 * securityUtils.comprehensive.test.ts
 * Extended comprehensive test suite for security utilities
 * Tests threat handling, security scoring, recommendations, and reporting
 */

import { Platform } from 'react-native';
import {
  formatThreatType,
  getSeverityLevel,
  sortThreatsBySeverity,
  filterThreatsBySeverity,
  hasCriticalThreats,
  hasHighRiskThreats,
  getThreatSummary,
  getSecurityScore,
  getSecurityScoreColor,
  getSecurityScoreLabel,
  shouldBlockDevice,
  getPlatformSecurityRecommendations,
  validateSecuritySettings,
  getRecommendedSecuritySettings,
  formatDuration,
  generateSecurityReport,
} from '../securityUtils';

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

// Type definition
interface SecurityThreat {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  timestamp: number;
}

describe('securityUtils - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============== THREAT FORMATTING ==============
  describe('formatThreatType()', () => {
    test('should capitalize single word threat type', () => {
      expect(formatThreatType('jailbreak')).toBe('Jailbreak');
      expect(formatThreatType('rooted')).toBe('Rooted');
    });

    test('should handle underscore-separated threat types', () => {
      expect(formatThreatType('weak_password')).toBe('Weak Password');
      expect(formatThreatType('old_password')).toBe('Old Password');
    });

    test('should handle multiple underscores', () => {
      expect(formatThreatType('too_many_failed_attempts')).toBe(
        'Too Many Failed Attempts',
      );
    });

    test('should handle already capitalized input', () => {
      expect(formatThreatType('JAILBREAK')).toBe('JAILBREAK');
      // Note: JAILBREAK splits to ['JAILBREAK'], first letter upper() + rest = 'JAILBREAK'
    });

    test('should handle empty string', () => {
      expect(formatThreatType('')).toBe('');
    });

    test('should handle mixed case input without underscores', () => {
      const result = formatThreatType('WeakPassword');
      // No underscores, so it just capitalizes first letter of whole string
      expect(result).toBe('WeakPassword');
    });
  });

  // ============== SEVERITY LEVELS ==============
  describe('getSeverityLevel()', () => {
    test('should return 4 for critical severity', () => {
      expect(getSeverityLevel('critical')).toBe(4);
    });

    test('should return 3 for high severity', () => {
      expect(getSeverityLevel('high')).toBe(3);
    });

    test('should return 2 for medium severity', () => {
      expect(getSeverityLevel('medium')).toBe(2);
    });

    test('should return 1 for low severity', () => {
      expect(getSeverityLevel('low')).toBe(1);
    });

    test('should return 0 for unknown severity', () => {
      expect(getSeverityLevel('unknown')).toBe(0);
      expect(getSeverityLevel('invalid')).toBe(0);
    });

    test('should be case sensitive', () => {
      expect(getSeverityLevel('CRITICAL')).toBe(0);
      expect(getSeverityLevel('Critical')).toBe(0);
    });
  });

  // ============== THREAT SORTING ==============
  describe('sortThreatsBySeverity()', () => {
    const mockThreats: SecurityThreat[] = [
      {
        type: 'low_threat',
        severity: 'low',
        description: 'Low severity',
        timestamp: Date.now(),
      },
      {
        type: 'critical_threat',
        severity: 'critical',
        description: 'Critical severity',
        timestamp: Date.now(),
      },
      {
        type: 'medium_threat',
        severity: 'medium',
        description: 'Medium severity',
        timestamp: Date.now(),
      },
      {
        type: 'high_threat',
        severity: 'high',
        description: 'High severity',
        timestamp: Date.now(),
      },
    ];

    test('should sort threats by severity in descending order', () => {
      const sorted = sortThreatsBySeverity(mockThreats);

      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('high');
      expect(sorted[2].severity).toBe('medium');
      expect(sorted[3].severity).toBe('low');
    });

    test('should not modify original array', () => {
      const original = [...mockThreats];
      sortThreatsBySeverity(mockThreats);

      expect(mockThreats).toEqual(original);
    });

    test('should handle empty threat array', () => {
      const sorted = sortThreatsBySeverity([]);
      expect(sorted).toEqual([]);
    });

    test('should handle single threat', () => {
      const sorted = sortThreatsBySeverity([mockThreats[0]]);
      expect(sorted.length).toBe(1);
      expect(sorted[0]).toEqual(mockThreats[0]);
    });

    test('should handle multiple threats of same severity', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'threat1',
          severity: 'high',
          description: 'Desc1',
          timestamp: Date.now(),
        },
        {
          type: 'threat2',
          severity: 'high',
          description: 'Desc2',
          timestamp: Date.now(),
        },
      ];

      const sorted = sortThreatsBySeverity(threats);
      expect(sorted.length).toBe(2);
      expect(sorted[0].severity).toBe('high');
      expect(sorted[1].severity).toBe('high');
    });
  });

  // ============== THREAT FILTERING ==============
  describe('filterThreatsBySeverity()', () => {
    const mockThreats: SecurityThreat[] = [
      {
        type: 'low',
        severity: 'low',
        description: 'Low',
        timestamp: Date.now(),
      },
      {
        type: 'medium',
        severity: 'medium',
        description: 'Medium',
        timestamp: Date.now(),
      },
      {
        type: 'high',
        severity: 'high',
        description: 'High',
        timestamp: Date.now(),
      },
      {
        type: 'critical',
        severity: 'critical',
        description: 'Critical',
        timestamp: Date.now(),
      },
    ];

    test('should filter threats with minimum low severity', () => {
      const filtered = filterThreatsBySeverity(mockThreats, 'low');
      expect(filtered.length).toBe(4);
    });

    test('should filter threats with minimum medium severity', () => {
      const filtered = filterThreatsBySeverity(mockThreats, 'medium');
      expect(filtered.length).toBe(3);
      expect(
        filtered.every(t =>
          ['medium', 'high', 'critical'].includes(t.severity),
        ),
      ).toBe(true);
    });

    test('should filter threats with minimum high severity', () => {
      const filtered = filterThreatsBySeverity(mockThreats, 'high');
      expect(filtered.length).toBe(2);
      expect(
        filtered.every(t => ['high', 'critical'].includes(t.severity)),
      ).toBe(true);
    });

    test('should filter threats with minimum critical severity', () => {
      const filtered = filterThreatsBySeverity(mockThreats, 'critical');
      expect(filtered.length).toBe(1);
      expect(filtered[0].severity).toBe('critical');
    });

    test('should handle empty threat array', () => {
      const filtered = filterThreatsBySeverity([], 'high');
      expect(filtered).toEqual([]);
    });

    test('should not modify original array', () => {
      const original = JSON.stringify(mockThreats);
      filterThreatsBySeverity(mockThreats, 'high');
      expect(JSON.stringify(mockThreats)).toBe(original);
    });
  });

  // ============== THREAT DETECTION ==============
  describe('hasCriticalThreats()', () => {
    test('should return true when critical threats exist', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'jailbreak',
          severity: 'critical',
          description: 'Device is jailbroken',
          timestamp: Date.now(),
        },
      ];
      expect(hasCriticalThreats(threats)).toBe(true);
    });

    test('should return false when no critical threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'weak_password',
          severity: 'high',
          description: 'Weak password',
          timestamp: Date.now(),
        },
      ];
      expect(hasCriticalThreats(threats)).toBe(false);
    });

    test('should return false for empty threat array', () => {
      expect(hasCriticalThreats([])).toBe(false);
    });

    test('should return true with multiple threats including critical', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'threat1',
          severity: 'low',
          description: 'Low',
          timestamp: Date.now(),
        },
        {
          type: 'threat2',
          severity: 'critical',
          description: 'Critical',
          timestamp: Date.now(),
        },
      ];
      expect(hasCriticalThreats(threats)).toBe(true);
    });
  });

  describe('hasHighRiskThreats()', () => {
    test('should return true for critical threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'jailbreak',
          severity: 'critical',
          description: 'Device is jailbroken',
          timestamp: Date.now(),
        },
      ];
      expect(hasHighRiskThreats(threats)).toBe(true);
    });

    test('should return true for high threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'old_password',
          severity: 'high',
          description: 'Old password',
          timestamp: Date.now(),
        },
      ];
      expect(hasHighRiskThreats(threats)).toBe(true);
    });

    test('should return false for medium and low threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'medium_threat',
          severity: 'medium',
          description: 'Medium',
          timestamp: Date.now(),
        },
        {
          type: 'low_threat',
          severity: 'low',
          description: 'Low',
          timestamp: Date.now(),
        },
      ];
      expect(hasHighRiskThreats(threats)).toBe(false);
    });

    test('should return false for empty threat array', () => {
      expect(hasHighRiskThreats([])).toBe(false);
    });
  });

  // ============== THREAT SUMMARY ==============
  describe('getThreatSummary()', () => {
    test('should return no threats message for empty array', () => {
      expect(getThreatSummary([])).toBe('No security threats detected');
    });

    test('should summarize single threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'threat',
          severity: 'high',
          description: 'High severity',
          timestamp: Date.now(),
        },
      ];
      const summary = getThreatSummary(threats);
      expect(summary).toContain('1 threat');
      expect(summary).toContain('high');
    });

    test('should summarize multiple threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 't1',
          severity: 'critical',
          description: 'Critical',
          timestamp: Date.now(),
        },
        {
          type: 't2',
          severity: 'high',
          description: 'High',
          timestamp: Date.now(),
        },
        {
          type: 't3',
          severity: 'medium',
          description: 'Medium',
          timestamp: Date.now(),
        },
      ];
      const summary = getThreatSummary(threats);
      expect(summary).toContain('3 threats');
      expect(summary).toContain('1 critical');
      expect(summary).toContain('1 high');
      expect(summary).toContain('1 medium');
    });

    test('should handle multiple threats of same severity', () => {
      const threats: SecurityThreat[] = [
        {
          type: 't1',
          severity: 'high',
          description: 'High1',
          timestamp: Date.now(),
        },
        {
          type: 't2',
          severity: 'high',
          description: 'High2',
          timestamp: Date.now(),
        },
      ];
      const summary = getThreatSummary(threats);
      expect(summary).toContain('2 threats');
      expect(summary).toContain('2 high');
    });

    test('should use singular threat when count is 1', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'threat',
          severity: 'low',
          description: 'Low',
          timestamp: Date.now(),
        },
      ];
      const summary = getThreatSummary(threats);
      expect(summary).toContain('1 threat:');
    });

    test('should use plural threats when count > 1', () => {
      const threats: SecurityThreat[] = [
        {
          type: 't1',
          severity: 'low',
          description: 'Low1',
          timestamp: Date.now(),
        },
        {
          type: 't2',
          severity: 'low',
          description: 'Low2',
          timestamp: Date.now(),
        },
      ];
      const summary = getThreatSummary(threats);
      expect(summary).toContain('2 threats:');
    });
  });

  // ============== SECURITY SCORING ==============
  describe('getSecurityScore()', () => {
    test('should return 100 for no threats', () => {
      expect(getSecurityScore([])).toBe(100);
    });

    test('should deduct 30 points for each critical threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical',
          timestamp: Date.now(),
        },
      ];
      expect(getSecurityScore(threats)).toBe(70);
    });

    test('should deduct 20 points for each high threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'high',
          severity: 'high',
          description: 'High',
          timestamp: Date.now(),
        },
      ];
      expect(getSecurityScore(threats)).toBe(80);
    });

    test('should deduct 10 points for each medium threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'medium',
          severity: 'medium',
          description: 'Medium',
          timestamp: Date.now(),
        },
      ];
      expect(getSecurityScore(threats)).toBe(90);
    });

    test('should deduct 5 points for each low threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'low',
          severity: 'low',
          description: 'Low',
          timestamp: Date.now(),
        },
      ];
      expect(getSecurityScore(threats)).toBe(95);
    });

    test('should deduct points for multiple threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical',
          timestamp: Date.now(),
        },
        {
          type: 'high',
          severity: 'high',
          description: 'High',
          timestamp: Date.now(),
        },
        {
          type: 'medium',
          severity: 'medium',
          description: 'Medium',
          timestamp: Date.now(),
        },
      ];
      expect(getSecurityScore(threats)).toBe(100 - 30 - 20 - 10); // 40
    });

    test('should not go below 0', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'c1',
          severity: 'critical',
          description: 'C1',
          timestamp: Date.now(),
        },
        {
          type: 'c2',
          severity: 'critical',
          description: 'C2',
          timestamp: Date.now(),
        },
        {
          type: 'c3',
          severity: 'critical',
          description: 'C3',
          timestamp: Date.now(),
        },
        {
          type: 'c4',
          severity: 'critical',
          description: 'C4',
          timestamp: Date.now(),
        },
      ];
      expect(getSecurityScore(threats)).toBe(0);
    });
  });

  // ============== SECURITY SCORE VISUALIZATION ==============
  describe('getSecurityScoreColor()', () => {
    test('should return green for score >= 80', () => {
      expect(getSecurityScoreColor(100)).toBe('#10B981');
      expect(getSecurityScoreColor(80)).toBe('#10B981');
    });

    test('should return yellow for score 60-79', () => {
      expect(getSecurityScoreColor(75)).toBe('#F59E0B');
      expect(getSecurityScoreColor(60)).toBe('#F59E0B');
    });

    test('should return orange for score 40-59', () => {
      expect(getSecurityScoreColor(50)).toBe('#EA580C');
      expect(getSecurityScoreColor(40)).toBe('#EA580C');
    });

    test('should return red for score < 40', () => {
      expect(getSecurityScoreColor(39)).toBe('#DC2626');
      expect(getSecurityScoreColor(0)).toBe('#DC2626');
    });
  });

  describe('getSecurityScoreLabel()', () => {
    test('should return Excellent for score >= 80', () => {
      expect(getSecurityScoreLabel(100)).toBe('Excellent');
      expect(getSecurityScoreLabel(80)).toBe('Excellent');
    });

    test('should return Good for score 60-79', () => {
      expect(getSecurityScoreLabel(75)).toBe('Good');
      expect(getSecurityScoreLabel(60)).toBe('Good');
    });

    test('should return Fair for score 40-59', () => {
      expect(getSecurityScoreLabel(50)).toBe('Fair');
      expect(getSecurityScoreLabel(40)).toBe('Fair');
    });

    test('should return Poor for score 20-39', () => {
      expect(getSecurityScoreLabel(35)).toBe('Poor');
      expect(getSecurityScoreLabel(20)).toBe('Poor');
    });

    test('should return Critical for score < 20', () => {
      expect(getSecurityScoreLabel(19)).toBe('Critical');
      expect(getSecurityScoreLabel(0)).toBe('Critical');
    });
  });

  // ============== DEVICE BLOCKING ==============
  describe('shouldBlockDevice()', () => {
    test('should block device with critical threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical',
          timestamp: Date.now(),
        },
      ];
      expect(shouldBlockDevice(threats)).toBe(true);
    });

    test('should not block device without critical threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'high',
          severity: 'high',
          description: 'High',
          timestamp: Date.now(),
        },
      ];
      expect(shouldBlockDevice(threats)).toBe(false);
    });

    test('should not block device with no threats', () => {
      expect(shouldBlockDevice([])).toBe(false);
    });
  });

  // ============== PLATFORM RECOMMENDATIONS ==============
  describe('getPlatformSecurityRecommendations()', () => {
    test('should return Android recommendations for Android platform', () => {
      (Platform.OS as any) = 'android';
      const recommendations = getPlatformSecurityRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.some(r => r.toLowerCase().includes('google play')),
      ).toBe(true);
    });

    test('should return iOS recommendations for iOS platform', () => {
      (Platform.OS as any) = 'ios';
      const recommendations = getPlatformSecurityRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.some(r => r.toLowerCase().includes('app store')),
      ).toBe(true);
    });

    test('should return generic recommendations for unknown platform', () => {
      (Platform.OS as any) = 'unknown';
      const recommendations = getPlatformSecurityRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    test('Android recommendations should include rooting warning', () => {
      (Platform.OS as any) = 'android';
      const recommendations = getPlatformSecurityRecommendations();

      expect(recommendations.some(r => r.toLowerCase().includes('root'))).toBe(
        true,
      );
    });

    test('iOS recommendations should have multiple entries', () => {
      (Platform.OS as any) = 'ios';
      const recommendations = getPlatformSecurityRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(5);
      // iOS recommendations include passcode, Face ID/Touch ID, etc.
      expect(
        recommendations.some(r => r.includes('passcode') || r.includes('ID')),
      ).toBe(true);
    });
  });

  // ============== SETTINGS VALIDATION ==============
  describe('validateSecuritySettings()', () => {
    test('should return valid for all enabled settings', () => {
      const settings = {
        biometricEnabled: true,
        autoLockEnabled: true,
        autoLockTimeout: 120000,
        screenProtectionEnabled: true,
        securityChecksEnabled: true,
      };

      const result = validateSecuritySettings(settings);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    test('should warn when biometric is disabled', () => {
      const settings = {
        biometricEnabled: false,
        autoLockEnabled: true,
        autoLockTimeout: 120000,
        screenProtectionEnabled: true,
        securityChecksEnabled: true,
      };

      const result = validateSecuritySettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Biometric authentication is disabled');
    });

    test('should warn when auto-lock is disabled', () => {
      const settings = {
        biometricEnabled: true,
        autoLockEnabled: false,
        autoLockTimeout: 120000,
        screenProtectionEnabled: true,
        securityChecksEnabled: true,
      };

      const result = validateSecuritySettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Auto-lock is disabled');
    });

    test('should warn when auto-lock timeout is too long', () => {
      const settings = {
        biometricEnabled: true,
        autoLockEnabled: true,
        autoLockTimeout: 6 * 60 * 1000, // 6 minutes > 5 minute threshold
        screenProtectionEnabled: true,
        securityChecksEnabled: true,
      };

      const result = validateSecuritySettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.warnings.some(w => w.includes('timeout'))).toBe(true);
    });

    test('should accept auto-lock timeout at 5 minute threshold', () => {
      const settings = {
        biometricEnabled: true,
        autoLockEnabled: true,
        autoLockTimeout: 5 * 60 * 1000,
        screenProtectionEnabled: true,
        securityChecksEnabled: true,
      };

      const result = validateSecuritySettings(settings);
      expect(result.warnings.some(w => w.includes('timeout'))).toBe(false);
    });

    test('should warn when screen protection is disabled', () => {
      const settings = {
        biometricEnabled: true,
        autoLockEnabled: true,
        autoLockTimeout: 120000,
        screenProtectionEnabled: false,
        securityChecksEnabled: true,
      };

      const result = validateSecuritySettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Screen protection is disabled');
    });

    test('should warn when security checks are disabled', () => {
      const settings = {
        biometricEnabled: true,
        autoLockEnabled: true,
        autoLockTimeout: 120000,
        screenProtectionEnabled: true,
        securityChecksEnabled: false,
      };

      const result = validateSecuritySettings(settings);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Security checks are disabled');
    });

    test('should return multiple warnings when multiple settings are wrong', () => {
      const settings = {
        biometricEnabled: false,
        autoLockEnabled: false,
        autoLockTimeout: 120000,
        screenProtectionEnabled: false,
        securityChecksEnabled: false,
      };

      const result = validateSecuritySettings(settings);
      expect(result.warnings.length).toBeGreaterThan(1);
    });
  });

  describe('getRecommendedSecuritySettings()', () => {
    test('should return recommended settings', () => {
      const settings = getRecommendedSecuritySettings();

      expect(settings.biometricEnabled).toBe(true);
      expect(settings.autoLockEnabled).toBe(true);
      expect(settings.screenProtectionEnabled).toBe(true);
      expect(settings.securityChecksEnabled).toBe(true);
    });

    test('should set auto-lock timeout to 2 minutes', () => {
      const settings = getRecommendedSecuritySettings();
      expect(settings.autoLockTimeout).toBe(2 * 60 * 1000);
    });

    test('should return object with all required properties', () => {
      const settings = getRecommendedSecuritySettings();

      expect(settings).toHaveProperty('biometricEnabled');
      expect(settings).toHaveProperty('autoLockEnabled');
      expect(settings).toHaveProperty('autoLockTimeout');
      expect(settings).toHaveProperty('screenProtectionEnabled');
      expect(settings).toHaveProperty('securityChecksEnabled');
    });
  });

  // ============== DURATION FORMATTING ==============
  describe('formatDuration()', () => {
    test('should format seconds', () => {
      expect(formatDuration(500)).toBe('0s');
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(45000)).toBe('45s');
    });

    test('should format minutes and seconds', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(300000)).toBe('5m 0s');
    });

    test('should format hours, minutes', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(5400000)).toBe('1h 30m');
      expect(formatDuration(7200000)).toBe('2h 0m');
    });

    test('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    test('should round down to nearest second', () => {
      expect(formatDuration(1500)).toBe('1s');
      expect(formatDuration(1999)).toBe('1s');
    });
  });

  // ============== SECURITY REPORTING ==============
  describe('generateSecurityReport()', () => {
    const mockDeviceInfo = {
      systemVersion: '14.0',
      appVersion: '1.0.0',
      deviceId: 'test-device-123',
      isRooted: false,
      isJailbroken: false,
      isEmulator: false,
    };

    test('should generate report with no threats', () => {
      const report = generateSecurityReport([], mockDeviceInfo);

      expect(report).toContain('Security Report');
      expect(report).toContain('100');
      expect(report).toContain('Excellent');
    });

    test('should include security score in report', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'threat',
          severity: 'high',
          description: 'High severity threat',
          timestamp: Date.now(),
        },
      ];
      const report = generateSecurityReport(threats, mockDeviceInfo);

      expect(report).toContain('Security Score');
      expect(report).toContain('80');
    });

    test('should include threat summary in report', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'threat',
          severity: 'high',
          description: 'High severity threat',
          timestamp: Date.now(),
        },
      ];
      const report = generateSecurityReport(threats, mockDeviceInfo);

      expect(report).toContain('threat');
    });

    test('should include device information when provided', () => {
      const report = generateSecurityReport([], mockDeviceInfo);

      expect(report).toContain('Device Information');
      expect(report).toContain('Platform');
      expect(report).toContain('System Version');
      expect(report).toContain('App Version');
    });

    test('should list detected threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'jailbreak',
          severity: 'critical',
          description: 'Device is jailbroken',
          timestamp: Date.now(),
        },
      ];
      const report = generateSecurityReport(threats, mockDeviceInfo);

      expect(report).toContain('Threats Detected');
    });

    test('should handle null device info', () => {
      expect(() => generateSecurityReport([], null)).not.toThrow();
    });

    test('should handle undefined device info', () => {
      expect(() => generateSecurityReport([], undefined as any)).not.toThrow();
    });
  });

  describe('Integration: Full security flow', () => {
    test('should calculate security posture from threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'jailbreak',
          severity: 'critical',
          description: 'Device is jailbroken',
          timestamp: Date.now(),
        },
        {
          type: 'weak_password',
          severity: 'high',
          description: 'Weak password detected',
          timestamp: Date.now(),
        },
      ];

      const score = getSecurityScore(threats);
      const label = getSecurityScoreLabel(score);
      const color = getSecurityScoreColor(score);
      const shouldBlock = shouldBlockDevice(threats);

      expect(score).toBe(50); // 100 - 30 - 20
      expect(label).toBe('Fair');
      expect(color).toBe('#EA580C');
      expect(shouldBlock).toBe(true);
    });
  });
});
