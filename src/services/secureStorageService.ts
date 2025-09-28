// Secure storage service using React Native Keychain and AsyncStorage
import * as Keychain from "react-native-keychain";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { generateSalt, hashPassword, verifyPassword } from "./cryptoService";

// Keychain service configuration
const KEYCHAIN_SERVICE = "PasswordEpic";
const KEYCHAIN_OPTIONS: Keychain.Options = {
  service: KEYCHAIN_SERVICE,
  accessControl:
    Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
  authenticatePrompt: "Authenticate to access your passwords",
  accessGroup:
    Platform.OS === "ios" ? "group.passwordepic.keychain" : undefined,
  touchID: true,
  showModal: true,
  kLocalizedFallbackTitle: "Use Passcode",
};

// Storage keys
const STORAGE_KEYS = {
  MASTER_PASSWORD_HASH: "master_password_hash",
  MASTER_PASSWORD_SALT: "master_password_salt",
  USER_SETTINGS: "user_settings",
  ENCRYPTED_PASSWORDS: "encrypted_passwords",
  BIOMETRIC_ENABLED: "biometric_enabled",
  LAST_BACKUP: "last_backup",
};

// Master password management
export const storeMasterPassword = async (
  password: string,
  enableBiometric: boolean = true
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Generate salt for password hashing
    const salt = generateSalt();

    // Hash password for verification (not for encryption)
    const passwordHash = hashPassword(password, salt);

    // Store hash and salt in AsyncStorage for verification
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.MASTER_PASSWORD_HASH, passwordHash],
      [STORAGE_KEYS.MASTER_PASSWORD_SALT, salt],
    ]);

    // Store actual password in secure keychain if biometric is enabled
    if (enableBiometric) {
      const keychainOptions = {
        ...KEYCHAIN_OPTIONS,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      };

      await Keychain.setInternetCredentials(
        KEYCHAIN_SERVICE,
        "master_password",
        password,
        keychainOptions
      );

      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, "true");
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, "false");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to store master password:", error);
    return {
      success: false,
      error: error.message || "Failed to store master password",
    };
  }
};

export const verifyMasterPassword = async (
  password: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const [passwordHash, salt] = await AsyncStorage.multiGet([
      STORAGE_KEYS.MASTER_PASSWORD_HASH,
      STORAGE_KEYS.MASTER_PASSWORD_SALT,
    ]);

    if (!passwordHash[1] || !salt[1]) {
      return { success: false, error: "Master password not set" };
    }

    const isValid = verifyPassword(password, passwordHash[1], salt[1]);

    if (!isValid) {
      return { success: false, error: "Invalid master password" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to verify master password:", error);
    return {
      success: false,
      error: error.message || "Failed to verify master password",
    };
  }
};

export const getMasterPasswordFromBiometric = async (): Promise<{
  success: boolean;
  password?: string;
  error?: string;
}> => {
  try {
    const biometricEnabled = await AsyncStorage.getItem(
      STORAGE_KEYS.BIOMETRIC_ENABLED
    );

    if (biometricEnabled !== "true") {
      return { success: false, error: "Biometric authentication not enabled" };
    }

    // Check if biometric authentication is available
    const biometryType = await Keychain.getSupportedBiometryType();
    if (!biometryType) {
      return {
        success: false,
        error: "Biometric authentication not available",
      };
    }

    // Retrieve password from keychain with biometric authentication
    const credentials = await Keychain.getInternetCredentials(
      KEYCHAIN_SERVICE,
      KEYCHAIN_OPTIONS
    );

    if (!credentials || credentials === false) {
      return { success: false, error: "No stored credentials found" };
    }

    return {
      success: true,
      password: credentials.password,
    };
  } catch (error: any) {
    console.error("Failed to get master password from biometric:", error);

    let errorMessage = "Biometric authentication failed";

    if (error.message?.includes("UserCancel")) {
      errorMessage = "Authentication was cancelled";
    } else if (error.message?.includes("UserFallback")) {
      errorMessage = "User chose to enter password manually";
    } else if (error.message?.includes("BiometryNotAvailable")) {
      errorMessage = "Biometric authentication not available";
    }

    return { success: false, error: errorMessage };
  }
};

export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return enabled === "true";
  } catch (error) {
    console.error("Failed to check biometric status:", error);
    return false;
  }
};

export const isBiometricAvailable = async (): Promise<{
  available: boolean;
  biometryType?: Keychain.BIOMETRY_TYPE;
}> => {
  try {
    const biometryType = await Keychain.getSupportedBiometryType();
    return {
      available: biometryType !== null,
      biometryType: biometryType || undefined,
    };
  } catch (error) {
    console.error("Failed to check biometric availability:", error);
    return { available: false };
  }
};

// Encrypted data storage
export const storeEncryptedData = async (
  key: string,
  data: any
): Promise<{ success: boolean; error?: string }> => {
  try {
    const jsonData = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonData);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to store encrypted data for key ${key}:`, error);
    return {
      success: false,
      error: error.message || "Failed to store encrypted data",
    };
  }
};

export const getEncryptedData = async (
  key: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const jsonData = await AsyncStorage.getItem(key);

    if (!jsonData) {
      return { success: false, error: "No data found" };
    }

    const data = JSON.parse(jsonData);
    return { success: true, data };
  } catch (error: any) {
    console.error(`Failed to get encrypted data for key ${key}:`, error);
    return {
      success: false,
      error: error.message || "Failed to retrieve encrypted data",
    };
  }
};

export const removeEncryptedData = async (
  key: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await AsyncStorage.removeItem(key);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to remove encrypted data for key ${key}:`, error);
    return {
      success: false,
      error: error.message || "Failed to remove encrypted data",
    };
  }
};

// User settings management
export interface UserSettings {
  theme: "light" | "dark" | "system";
  autoLockTimeout: number; // minutes
  biometricEnabled: boolean;
  screenProtectionEnabled: boolean;
  autoBackupEnabled: boolean;
  lastBackupDate?: number;
}

export const storeUserSettings = async (
  settings: UserSettings
): Promise<{ success: boolean; error?: string }> => {
  return storeEncryptedData(STORAGE_KEYS.USER_SETTINGS, settings);
};

export const getUserSettings = async (): Promise<{
  success: boolean;
  settings?: UserSettings;
  error?: string;
}> => {
  const result = await getEncryptedData(STORAGE_KEYS.USER_SETTINGS);

  if (!result.success) {
    // Return default settings if none exist
    const defaultSettings: UserSettings = {
      theme: "dark",
      autoLockTimeout: 5,
      biometricEnabled: false,
      screenProtectionEnabled: true,
      autoBackupEnabled: false,
    };

    return { success: true, settings: defaultSettings };
  }

  return { success: true, settings: result.data };
};

// Clear all stored data (for logout/reset)
export const clearAllStoredData = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // Clear AsyncStorage data
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);

    // Clear keychain data
    try {
      await Keychain.resetInternetCredentials(KEYCHAIN_SERVICE);
    } catch (keychainError) {
      console.warn("Failed to clear keychain data:", keychainError);
      // Don't fail the entire operation if keychain clearing fails
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear stored data:", error);
    return {
      success: false,
      error: error.message || "Failed to clear stored data",
    };
  }
};

// Check if master password is set
export const isMasterPasswordSet = async (): Promise<boolean> => {
  try {
    const passwordHash = await AsyncStorage.getItem(
      STORAGE_KEYS.MASTER_PASSWORD_HASH
    );
    return passwordHash !== null;
  } catch (error) {
    console.error("Failed to check master password status:", error);
    return false;
  }
};

// Storage keys export for external use
export { STORAGE_KEYS };
