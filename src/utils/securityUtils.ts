/**
 * Security Utilities
 *
 * Helper functions for security operations
 */

import { Platform } from 'react-native';
import { SecurityThreat } from '../services/securityService';

/**
 * Format threat type for display
 */
export const formatThreatType = (type: string): string => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Get severity level number (for sorting)
 */
export const getSeverityLevel = (severity: string): number => {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
};

/**
 * Sort threats by severity
 */
export const sortThreatsBySeverity = (
  threats: SecurityThreat[],
): SecurityThreat[] => {
  return [...threats].sort((a, b) => {
    return getSeverityLevel(b.severity) - getSeverityLevel(a.severity);
  });
};

/**
 * Filter threats by severity
 */
export const filterThreatsBySeverity = (
  threats: SecurityThreat[],
  minSeverity: 'low' | 'medium' | 'high' | 'critical',
): SecurityThreat[] => {
  const minLevel = getSeverityLevel(minSeverity);
  return threats.filter(
    threat => getSeverityLevel(threat.severity) >= minLevel,
  );
};

/**
 * Check if threats contain critical issues
 */
export const hasCriticalThreats = (threats: SecurityThreat[]): boolean => {
  return threats.some(threat => threat.severity === 'critical');
};

/**
 * Check if threats contain high-risk issues
 */
export const hasHighRiskThreats = (threats: SecurityThreat[]): boolean => {
  return threats.some(
    threat => threat.severity === 'high' || threat.severity === 'critical',
  );
};

/**
 * Get threat summary text
 */
export const getThreatSummary = (threats: SecurityThreat[]): string => {
  if (threats.length === 0) {
    return 'No security threats detected';
  }

  const critical = threats.filter(t => t.severity === 'critical').length;
  const high = threats.filter(t => t.severity === 'high').length;
  const medium = threats.filter(t => t.severity === 'medium').length;
  const low = threats.filter(t => t.severity === 'low').length;

  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (high > 0) parts.push(`${high} high`);
  if (medium > 0) parts.push(`${medium} medium`);
  if (low > 0) parts.push(`${low} low`);

  return `${threats.length} threat${
    threats.length === 1 ? '' : 's'
  }: ${parts.join(', ')}`;
};

/**
 * Get security score (0-100)
 */
export const getSecurityScore = (threats: SecurityThreat[]): number => {
  if (threats.length === 0) {
    return 100;
  }

  let score = 100;

  threats.forEach(threat => {
    switch (threat.severity) {
      case 'critical':
        score -= 30;
        break;
      case 'high':
        score -= 20;
        break;
      case 'medium':
        score -= 10;
        break;
      case 'low':
        score -= 5;
        break;
    }
  });

  return Math.max(0, score);
};

/**
 * Get security score color
 */
export const getSecurityScoreColor = (score: number): string => {
  if (score >= 80) return '#10B981'; // Green
  if (score >= 60) return '#F59E0B'; // Yellow
  if (score >= 40) return '#EA580C'; // Orange
  return '#DC2626'; // Red
};

/**
 * Get security score label
 */
export const getSecurityScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Critical';
};

/**
 * Check if device should be blocked
 */
export const shouldBlockDevice = (threats: SecurityThreat[]): boolean => {
  // Block if there are critical threats
  return hasCriticalThreats(threats);
};

/**
 * Get platform-specific security recommendations
 */
export const getPlatformSecurityRecommendations = (): string[] => {
  if (Platform.OS === 'android') {
    return [
      'Keep your device unrooted',
      'Install apps only from Google Play Store',
      'Enable Google Play Protect',
      'Keep your Android OS updated',
      'Use a strong device lock screen',
      'Avoid installing unknown APKs',
      'Disable USB debugging when not needed',
    ];
  } else if (Platform.OS === 'ios') {
    return [
      'Keep your device non-jailbroken',
      'Install apps only from App Store',
      'Keep your iOS updated',
      'Use a strong device passcode',
      'Enable Face ID or Touch ID',
      'Avoid installing profiles from unknown sources',
      'Keep Find My iPhone enabled',
    ];
  }

  return [
    'Keep your device secure',
    'Install apps from official sources only',
    'Keep your OS updated',
    'Use strong authentication',
  ];
};

/**
 * Validate security settings
 */
export interface SecuritySettings {
  biometricEnabled: boolean;
  autoLockEnabled: boolean;
  autoLockTimeout: number;
  screenProtectionEnabled: boolean;
  securityChecksEnabled: boolean;
}

export const validateSecuritySettings = (
  settings: SecuritySettings,
): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];

  if (!settings.biometricEnabled) {
    warnings.push('Biometric authentication is disabled');
  }

  if (!settings.autoLockEnabled) {
    warnings.push('Auto-lock is disabled');
  } else if (settings.autoLockTimeout > 300000) {
    // 5 minutes
    warnings.push('Auto-lock timeout is too long (>5 minutes)');
  }

  if (!settings.screenProtectionEnabled) {
    warnings.push('Screen protection is disabled');
  }

  if (!settings.securityChecksEnabled) {
    warnings.push('Security checks are disabled');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
};

/**
 * Get recommended security settings
 */
export const getRecommendedSecuritySettings = (): SecuritySettings => {
  return {
    biometricEnabled: true,
    autoLockEnabled: true,
    autoLockTimeout: 120000, // 2 minutes
    screenProtectionEnabled: true,
    securityChecksEnabled: true,
  };
};

/**
 * Format time duration
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * Generate security report
 */
export const generateSecurityReport = (
  threats: SecurityThreat[],
  deviceInfo: any,
): string => {
  const score = getSecurityScore(threats);
  const label = getSecurityScoreLabel(score);
  const summary = getThreatSummary(threats);

  let report = `Security Report\n`;
  report += `===============\n\n`;
  report += `Security Score: ${score}/100 (${label})\n`;
  report += `${summary}\n\n`;

  if (deviceInfo) {
    report += `Device Information:\n`;
    report += `- Platform: ${Platform.OS}\n`;
    report += `- System Version: ${deviceInfo.systemVersion}\n`;
    report += `- App Version: ${deviceInfo.appVersion}\n`;
    report += `- Device ID: ${deviceInfo.deviceId}\n`;
    report += `- Rooted/Jailbroken: ${
      deviceInfo.isRooted || deviceInfo.isJailbroken ? 'Yes' : 'No'
    }\n`;
    report += `- Emulator: ${deviceInfo.isEmulator ? 'Yes' : 'No'}\n\n`;
  }

  if (threats.length > 0) {
    report += `Threats Detected:\n`;
    threats.forEach((threat, index) => {
      report += `\n${index + 1}. ${formatThreatType(threat.type)} (${
        threat.severity
      })\n`;
      report += `   ${threat.description}\n`;
      report += `   Recommendation: ${threat.recommendation}\n`;
    });
  }

  return report;
};

/**
 * Sanitize sensitive data for logging
 */
export const sanitizeForLogging = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = [
    'password',
    'masterPassword',
    'encryptedPassword',
    'salt',
    'iv',
    'key',
    'token',
    'secret',
    'credential',
  ];

  const sanitized: any = Array.isArray(data) ? [] : {};

  Object.keys(data).forEach(key => {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitiveKey =>
      lowerKey.includes(sensitiveKey),
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = sanitizeForLogging(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  });

  return sanitized;
};

export default {
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
  sanitizeForLogging,
};
