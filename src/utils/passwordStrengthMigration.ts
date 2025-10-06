import { PasswordEntry } from '../types/password';
import { PasswordValidationService } from '../services/passwordValidationService';

/**
 * Utility to recalculate password strength for existing passwords
 * that may have been created with hardcoded "Unknown" strength values
 */
export const recalculatePasswordStrengths = (passwords: PasswordEntry[]): PasswordEntry[] => {
  return passwords.map(password => {
    // Only recalculate if password has auditData but strength is unknown/placeholder
    if (
      password.auditData?.passwordStrength &&
      (password.auditData.passwordStrength.label === 'Unknown' || 
       password.auditData.passwordStrength.score === 0) &&
      password.password &&
      password.password.trim().length > 0
    ) {
      const newStrength = PasswordValidationService.analyzePasswordStrength(password.password);
      
      return {
        ...password,
        auditData: {
          ...password.auditData,
          passwordStrength: newStrength,
        },
      };
    }
    
    return password;
  });
};

/**
 * Check if a password needs strength recalculation
 */
export const needsStrengthRecalculation = (password: PasswordEntry): boolean => {
  return !!(
    password.auditData?.passwordStrength &&
    (password.auditData.passwordStrength.label === 'Unknown' || 
     password.auditData.passwordStrength.score === 0) &&
    password.password &&
    password.password.trim().length > 0
  );
};