import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SecuritySettings {
  biometricEnabled: boolean;
  biometricType: string;
  autoLockTimeout: number; // in minutes
  requireBiometricForAutoFill: boolean;
  screenProtectionEnabled: boolean;
  securityChecksEnabled: boolean;
  rootDetectionEnabled: boolean;
  antiTamperingEnabled: boolean;
  memoryProtectionEnabled: boolean;
}

interface GeneratorSettings {
  defaultLength: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
  minNumbers: number;
  minSymbols: number;
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
    securityChecksEnabled: true,
    rootDetectionEnabled: true,
    antiTamperingEnabled: true,
    memoryProtectionEnabled: true,
  },
  generator: {
    defaultLength: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    excludeAmbiguous: false,
    minNumbers: 2,
    minSymbols: 1,
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
    setScreenProtectionEnabled: (state, action: PayloadAction<boolean>) => {
      state.security.screenProtectionEnabled = action.payload;
    },
    setSecurityChecksEnabled: (state, action: PayloadAction<boolean>) => {
      state.security.securityChecksEnabled = action.payload;
    },
    setRootDetectionEnabled: (state, action: PayloadAction<boolean>) => {
      state.security.rootDetectionEnabled = action.payload;
    },
    setAntiTamperingEnabled: (state, action: PayloadAction<boolean>) => {
      state.security.antiTamperingEnabled = action.payload;
    },
    setMemoryProtectionEnabled: (state, action: PayloadAction<boolean>) => {
      state.security.memoryProtectionEnabled = action.payload;
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
  setScreenProtectionEnabled,
  setSecurityChecksEnabled,
  setRootDetectionEnabled,
  setAntiTamperingEnabled,
  setMemoryProtectionEnabled,
} = settingsSlice.actions;
export default settingsSlice.reducer;
