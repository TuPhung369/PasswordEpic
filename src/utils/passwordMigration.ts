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
 * IMPORTANT: Only recalculate security score if auditData is missing.
 * If auditData exists (from DB or create/update), preserve it to avoid double-encryption issues.
 */
export const migratePasswordEntry = (
  password: PasswordEntry,
): PasswordEntry => {
  // Initialize password history (empty for existing passwords)
  const passwordHistory = password.passwordHistory || [];

  // 🔐 SECURITY: Only recalculate audit data if it doesn't exist
  // If password.auditData exists, it means:
  // 1. It was calculated from plaintext during create/update, OR
  // 2. It was loaded from DB and includes latest audit history
  // Either way, don't recalculate from password field (which may be encrypted)
  let auditData: AuditData;
  
  if (password.auditData) {
    // Preserve existing auditData - don't recalculate
    auditData = {
      ...password.auditData,
      duplicateCount: password.auditData.duplicateCount ?? 0,
      compromisedCount: password.auditData.compromisedCount ?? 0,
      lastPasswordChange: password.auditData.lastPasswordChange ?? password.updatedAt ?? password.createdAt,
    };
  } else {
    // Old data without auditData - calculate from scratch
    // This only works if password is plaintext (decrypt before calling)
    const passwordStrength = password.password
      ? PasswordValidationService.analyzePasswordStrength(password.password)
      : {
          score: 0,
          label: 'Very Weak',
          color: '#F44336',
          feedback: ['No password set'],
          crackTime: 'Instant',
        };

    const securityScore = calculateSecurityScore(
      password,
      passwordStrength.score,
    );

    auditData = {
      passwordStrength,
      duplicateCount: password.auditData?.duplicateCount ?? 0,
      compromisedCount: password.auditData?.compromisedCount ?? 0,
      lastPasswordChange: password.auditData?.lastPasswordChange ?? password.updatedAt ?? password.createdAt,
      recommendedAction: getRecommendedAction(
        securityScore,
        passwordStrength.score,
      ),
      securityScore,
    };
  }

  // Create default breach status (safe)
  const breachStatus: BreachStatus = password.breachStatus || {
    isBreached: false,
    breachCount: 0,
    lastChecked: new Date(),
    breachSources: [],
    severity: 'low',
  };

  // 🔥 Ensure lastUsed is initialized (handle string conversion from storage)
  let lastUsed = password.lastUsed;
  if (lastUsed && typeof lastUsed === 'string') {
    lastUsed = new Date(lastUsed);
  }

  return {
    ...password,
    passwordHistory,
    auditData,
    breachStatus,
    lastUsed, // 🔥 Preserve and convert lastUsed field
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
 * Based only on security-relevant factors:
 * - Password strength (60 points)
 * - Password recency (30 points)
 * - Not compromised (10 points)
 */
export const calculateSecurityScore = (
  password: PasswordEntry,
  strengthScore: number,
): number => {
  let score = 0;

  // Password strength (60 points max)
  score += (strengthScore / 4) * 60;

  // Password recency (30 points max)
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(password.updatedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (daysSinceUpdate < 30) {
    score += 30;
  } else if (daysSinceUpdate < 90) {
    score += 20;
  } else if (daysSinceUpdate < 180) {
    score += 10;
  } else if (daysSinceUpdate < 365) {
    score += 5;
  }

  // Not compromised bonus (10 points)
  const breachStatus = password.breachStatus;
  if (!breachStatus || !breachStatus.isBreached) {
    score += 10;
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
