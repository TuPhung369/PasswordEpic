// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

export type MainTabParamList = {
  Passwords: undefined;
  Generator: undefined;
  Settings: undefined;
};

// User Types
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

// Password Types
export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  website: string;
  notes?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

// Security Types
export interface SecuritySettings {
  biometricEnabled: boolean;
  autoLockTimeout: number;
  requireBiometricForAutoFill: boolean;
  screenProtectionEnabled: boolean;
}

// Generator Types
export interface GeneratorSettings {
  defaultLength: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
}

// Theme Types
export type ThemeMode = 'light' | 'dark' | 'system';