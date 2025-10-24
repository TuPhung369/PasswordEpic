import {
  formatThreatType,
  getSeverityLevel,
  sortThreatsBySeverity,
  filterThreatsBySeverity,
  hasCriticalThreats,
  hasHighRiskThreats,
  getThreatSummary,
} from '../securityUtils';
import { SecurityThreat } from '../../services/securityService';

describe('securityUtils', () => {
  describe('formatThreatType', () => {
    it('should format threat type with underscores', () => {
      const result = formatThreatType('device_jailbroken');
      expect(result).toBe('Device Jailbroken');
    });

    it('should format single word', () => {
      const result = formatThreatType('jailbroken');
      expect(result).toBe('Jailbroken');
    });

    it('should handle multiple underscores', () => {
      const result = formatThreatType('weak_password_detected');
      expect(result).toBe('Weak Password Detected');
    });

    it('should capitalize first letters', () => {
      const result = formatThreatType('root_detected');
      expect(result).toBe('Root Detected');
    });
  });

  describe('getSeverityLevel', () => {
    it('should return 4 for critical', () => {
      expect(getSeverityLevel('critical')).toBe(4);
    });

    it('should return 3 for high', () => {
      expect(getSeverityLevel('high')).toBe(3);
    });

    it('should return 2 for medium', () => {
      expect(getSeverityLevel('medium')).toBe(2);
    });

    it('should return 1 for low', () => {
      expect(getSeverityLevel('low')).toBe(1);
    });

    it('should return 0 for unknown', () => {
      expect(getSeverityLevel('unknown')).toBe(0);
    });
  });

  describe('sortThreatsBySeverity', () => {
    const threats: SecurityThreat[] = [
      {
        type: 'low_threat',
        severity: 'low',
        description: 'Low severity',
        recommendation: 'Monitor',
        timestamp: Date.now(),
      },
      {
        type: 'critical_threat',
        severity: 'critical',
        description: 'Critical threat',
        recommendation: 'Fix immediately',
        timestamp: Date.now(),
      },
      {
        type: 'medium_threat',
        severity: 'medium',
        description: 'Medium severity',
        recommendation: 'Address soon',
        timestamp: Date.now(),
      },
    ];

    it('should sort threats by severity descending', () => {
      const sorted = sortThreatsBySeverity(threats);
      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('medium');
      expect(sorted[2].severity).toBe('low');
    });

    it('should not mutate original array', () => {
      const original = [...threats];
      sortThreatsBySeverity(threats);
      expect(threats).toEqual(original);
    });

    it('should handle empty array', () => {
      const result = sortThreatsBySeverity([]);
      expect(result).toEqual([]);
    });
  });

  describe('filterThreatsBySeverity', () => {
    const threats: SecurityThreat[] = [
      {
        type: 'low',
        severity: 'low',
        description: 'Low',
        recommendation: 'Check',
        timestamp: Date.now(),
      },
      {
        type: 'high',
        severity: 'high',
        description: 'High',
        recommendation: 'Fix',
        timestamp: Date.now(),
      },
      {
        type: 'critical',
        severity: 'critical',
        description: 'Critical',
        recommendation: 'Fix now',
        timestamp: Date.now(),
      },
    ];

    it('should filter threats by minimum severity', () => {
      const result = filterThreatsBySeverity(threats, 'high');
      expect(result.length).toBe(2);
      expect(result.every(t => ['high', 'critical'].includes(t.severity))).toBe(
        true,
      );
    });

    it('should include equal severity level', () => {
      const result = filterThreatsBySeverity(threats, 'medium');
      expect(result.length).toBe(2);
    });

    it('should return all for low severity', () => {
      const result = filterThreatsBySeverity(threats, 'low');
      expect(result.length).toBe(3);
    });

    it('should return empty for critical filter on lower threats', () => {
      const lowThreats = threats.filter(t => t.severity === 'low');
      const result = filterThreatsBySeverity(lowThreats, 'high');
      expect(result.length).toBe(0);
    });
  });

  describe('hasCriticalThreats', () => {
    it('should return true if critical threat exists', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical',
          recommendation: 'Fix',
          timestamp: Date.now(),
        },
      ];
      expect(hasCriticalThreats(threats)).toBe(true);
    });

    it('should return false if no critical threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'low',
          severity: 'low',
          description: 'Low',
          recommendation: 'Monitor',
          timestamp: Date.now(),
        },
      ];
      expect(hasCriticalThreats(threats)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(hasCriticalThreats([])).toBe(false);
    });
  });

  describe('hasHighRiskThreats', () => {
    it('should return true for high severity', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'high',
          severity: 'high',
          description: 'High',
          recommendation: 'Fix',
          timestamp: Date.now(),
        },
      ];
      expect(hasHighRiskThreats(threats)).toBe(true);
    });

    it('should return true for critical severity', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical',
          recommendation: 'Fix now',
          timestamp: Date.now(),
        },
      ];
      expect(hasHighRiskThreats(threats)).toBe(true);
    });

    it('should return false for medium and low', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'medium',
          severity: 'medium',
          description: 'Medium',
          recommendation: 'Address',
          timestamp: Date.now(),
        },
        {
          type: 'low',
          severity: 'low',
          description: 'Low',
          recommendation: 'Monitor',
          timestamp: Date.now(),
        },
      ];
      expect(hasHighRiskThreats(threats)).toBe(false);
    });
  });

  describe('getThreatSummary', () => {
    it('should return no threats message for empty array', () => {
      const result = getThreatSummary([]);
      expect(result).toBe('No security threats detected');
    });

    it('should summarize single critical threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical',
          recommendation: 'Fix',
          timestamp: Date.now(),
        },
      ];
      const result = getThreatSummary(threats);
      expect(result).toContain('1 threat');
      expect(result).toContain('1 critical');
    });

    it('should summarize multiple threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical 1',
          recommendation: 'Fix',
          timestamp: Date.now(),
        },
        {
          type: 'critical',
          severity: 'critical',
          description: 'Critical 2',
          recommendation: 'Fix',
          timestamp: Date.now(),
        },
        {
          type: 'high',
          severity: 'high',
          description: 'High',
          recommendation: 'Fix',
          timestamp: Date.now(),
        },
        {
          type: 'low',
          severity: 'low',
          description: 'Low',
          recommendation: 'Monitor',
          timestamp: Date.now(),
        },
      ];
      const result = getThreatSummary(threats);
      expect(result).toContain('4 threats');
      expect(result).toContain('2 critical');
      expect(result).toContain('1 high');
      expect(result).toContain('1 low');
    });

    it('should use singular for single threat', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'low',
          severity: 'low',
          description: 'Low',
          recommendation: 'Monitor',
          timestamp: Date.now(),
        },
      ];
      const result = getThreatSummary(threats);
      expect(result).toContain('1 threat:');
      expect(result).not.toContain('threats:');
    });

    it('should use plural for multiple threats', () => {
      const threats: SecurityThreat[] = [
        {
          type: 'low',
          severity: 'low',
          description: 'Low 1',
          recommendation: 'Monitor',
          timestamp: Date.now(),
        },
        {
          type: 'low',
          severity: 'low',
          description: 'Low 2',
          recommendation: 'Monitor',
          timestamp: Date.now(),
        },
      ];
      const result = getThreatSummary(threats);
      expect(result).toContain('2 threats:');
    });
  });
});
