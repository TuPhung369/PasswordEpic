import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface SecuritySettings {
  biometricEnabled: boolean;
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
      state.security = {...state.security, ...action.payload};
    },
    updateGeneratorSettings: (
      state,
      action: PayloadAction<Partial<GeneratorSettings>>,
    ) => {
      state.generator = {...state.generator, ...action.payload};
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
  },
});

export const {
  updateSecuritySettings,
  updateGeneratorSettings,
  setTheme,
  setLanguage,
} = settingsSlice.actions;
export default settingsSlice.reducer;