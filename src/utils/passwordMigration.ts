/**
 * Password Migration Utility
 *
 * This utility migrates existing passwords to include:
 * - passwordHistory array (empty for existing passwords)
 * - auditData with security analysis
 * - breachStatus (default safe status)
 */

import { PasswordEntry, AuditData, BreachStatus } from '../types/password';
import { PasswordValidationService } from '../services/passwordValidationService';

/**
 * Migrate a single password entry to include new fields
 */
export const migratePasswordEntry = (
  password: PasswordEntry,
): PasswordEntry => {
  // Check if already migrated
  if (
    password.passwordHistory !== undefined &&
    password.auditData !== undefined
  ) {
    return password;
  }

  // Initialize password history (empty for existing passwords)
  const passwordHistory = password.passwordHistory || [];

  // Calculate password strength
  const passwordStrength = password.password
    ? PasswordValidationService.analyzePasswordStrength(password.password)
    : {
        score: 0,
        label: 'Very Weak',
        color: '#F44336',
        feedback: ['No password set'],
        crackTime: 'Instant',
      };

  // Calculate security score (0-100)
  const securityScore = calculateSecurityScore(
    password,
    passwordStrength.score,
  );

  // Create audit data
  const auditData: AuditData = {
    passwordStrength,
    duplicateCount: 0, // Will be calculated by duplicate detection service
    compromisedCount: 0, // Will be updated by breach detection service
    lastPasswordChange: password.updatedAt || password.createdAt,
    recommendedAction: getRecommendedAction(
      securityScore,
      passwordStrength.score,
    ),
    securityScore,
  };

  // Create default breach status (safe)
  const breachStatus: BreachStatus = password.breachStatus || {
    isBreached: false,
    breachCount: 0,
    lastChecked: new Date(),
    breachSources: [],
    severity: 'low',
  };

  return {
    ...password,
    passwordHistory,
    auditData,
    breachStatus,
  };
};

/**
 * Migrate multiple password entries
 */
export const migratePasswordEntries = (
  passwords: PasswordEntry[],
): PasswordEntry[] => {
  return passwords.map(migratePasswordEntry);
};

/**
 * Calculate overall security score (0-100)
 */
const calculateSecurityScore = (
  password: PasswordEntry,
  strengthScore: number,
): number => {
  let score = 0;

  // Password strength (40 points)
  score += (strengthScore / 4) * 40;

  // Has username (10 points)
  if (password.username && password.username.trim().length > 0) {
    score += 10;
  }

  // Has website (10 points)
  if (password.website && password.website.trim().length > 0) {
    score += 10;
  }

  // Recently updated (20 points)
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(password.updatedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (daysSinceUpdate < 30) {
    score += 20;
  } else if (daysSinceUpdate < 90) {
    score += 15;
  } else if (daysSinceUpdate < 180) {
    score += 10;
  } else if (daysSinceUpdate < 365) {
    score += 5;
  }

  // Has notes/additional info (10 points)
  if (password.notes && password.notes.trim().length > 0) {
    score += 5;
  }

  // Has category (5 points)
  if (password.category && password.category.trim().length > 0) {
    score += 5;
  }

  // Has tags (5 points)
  if (password.tags && password.tags.length > 0) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
};

/**
 * Get recommended action based on security score
 */
const getRecommendedAction = (
  securityScore: number,
  strengthScore: number,
): 'none' | 'change_password' | 'enable_2fa' | 'update_info' => {
  if (strengthScore < 2) {
    return 'change_password';
  }

  if (securityScore < 40) {
    return 'update_info';
  }

  if (securityScore < 60) {
    return 'enable_2fa';
  }

  return 'none';
};

/**
 * Check if a password entry needs migration
 */
export const needsMigration = (password: PasswordEntry): boolean => {
  return (
    password.passwordHistory === undefined || password.auditData === undefined
  );
};

/**
 * Get migration statistics
 */
export const getMigrationStats = (passwords: PasswordEntry[]) => {
  const needsMigrationCount = passwords.filter(needsMigration).length;
  const alreadyMigratedCount = passwords.length - needsMigrationCount;

  return {
    total: passwords.length,
    needsMigration: needsMigrationCount,
    alreadyMigrated: alreadyMigratedCount,
    migrationProgress:
      passwords.length > 0
        ? Math.round((alreadyMigratedCount / passwords.length) * 100)
        : 100,
  };
};
