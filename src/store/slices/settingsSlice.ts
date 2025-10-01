import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SecuritySettings {
  biometricEnabled: boolean;
  biometricType: string;
  autoLockTimeout: number; // in minutes
  requireBiometricForAutoFill: boolean;
  screenProtectionEnabled: boolean;
}

interface GeneratorSettings {
  defaultLength: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
}

interface SettingsState {
  security: SecuritySettings;
  generator: GeneratorSettings;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

const initialState: SettingsState = {
  security: {
    biometricEnabled: true,
    biometricType: 'Biometric Authentication',
    autoLockTimeout: 5,
    requireBiometricForAutoFill: true,
    screenProtectionEnabled: true,
  },
  generator: {
    defaultLength: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
  },
  theme: 'system',
  language: 'en',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSecuritySettings: (
      state,
      action: PayloadAction<Partial<SecuritySettings>>,
    ) => {
      state.security = { ...state.security, ...action.payload };
    },
    updateGeneratorSettings: (
      state,
      action: PayloadAction<Partial<GeneratorSettings>>,
    ) => {
      state.generator = { ...state.generator, ...action.payload };
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.security.biometricEnabled = action.payload;
    },
    setBiometricType: (state, action: PayloadAction<string>) => {
      state.security.biometricType = action.payload;
    },
  },
});

export const {
  updateSecuritySettings,
  updateGeneratorSettings,
  setTheme,
  setLanguage,
  setBiometricEnabled,
  setBiometricType,
} = settingsSlice.actions;
export default settingsSlice.reducer;
