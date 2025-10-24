import settingsReducer, {
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
  restoreSettings,
} from '../settingsSlice';

describe('settingsSlice', () => {
  const initialState = {
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
    theme: 'system' as const,
    language: 'en',
  };

  // updateSecuritySettings Tests
  describe('updateSecuritySettings', () => {
    it('should update a single security setting', () => {
      const state = settingsReducer(
        initialState,
        updateSecuritySettings({ autoLockTimeout: 10 }),
      );
      expect(state.security.autoLockTimeout).toBe(10);
      expect(state.security.biometricEnabled).toBe(true);
    });

    it('should update multiple security settings', () => {
      const state = settingsReducer(
        initialState,
        updateSecuritySettings({
          autoLockTimeout: 15,
          requireBiometricForAutoFill: false,
        }),
      );
      expect(state.security.autoLockTimeout).toBe(15);
      expect(state.security.requireBiometricForAutoFill).toBe(false);
      expect(state.security.biometricEnabled).toBe(true);
    });

    it('should update biometric type', () => {
      const state = settingsReducer(
        initialState,
        updateSecuritySettings({ biometricType: 'Face ID' }),
      );
      expect(state.security.biometricType).toBe('Face ID');
    });

    it('should update all security settings at once', () => {
      const newSettings = {
        biometricEnabled: false,
        biometricType: 'Fingerprint',
        autoLockTimeout: 30,
        requireBiometricForAutoFill: false,
        screenProtectionEnabled: false,
        securityChecksEnabled: false,
        rootDetectionEnabled: false,
        antiTamperingEnabled: false,
        memoryProtectionEnabled: false,
      };
      const state = settingsReducer(
        initialState,
        updateSecuritySettings(newSettings),
      );
      expect(state.security).toEqual(newSettings);
    });

    it('should preserve unchanged settings', () => {
      const state = settingsReducer(
        initialState,
        updateSecuritySettings({ autoLockTimeout: 20 }),
      );
      expect(state.security.biometricEnabled).toBe(
        initialState.security.biometricEnabled,
      );
      expect(state.security.screenProtectionEnabled).toBe(
        initialState.security.screenProtectionEnabled,
      );
    });

    it('should handle partial updates correctly', () => {
      let state = settingsReducer(
        initialState,
        updateSecuritySettings({ autoLockTimeout: 10 }),
      );
      expect(state.security.autoLockTimeout).toBe(10);

      state = settingsReducer(
        state,
        updateSecuritySettings({ requireBiometricForAutoFill: false }),
      );
      expect(state.security.autoLockTimeout).toBe(10);
      expect(state.security.requireBiometricForAutoFill).toBe(false);
    });
  });

  // updateGeneratorSettings Tests
  describe('updateGeneratorSettings', () => {
    it('should update password length', () => {
      const state = settingsReducer(
        initialState,
        updateGeneratorSettings({ defaultLength: 24 }),
      );
      expect(state.generator.defaultLength).toBe(24);
      expect(state.generator.includeUppercase).toBe(true);
    });

    it('should update character inclusion settings', () => {
      const state = settingsReducer(
        initialState,
        updateGeneratorSettings({
          includeUppercase: false,
          includeSymbols: false,
        }),
      );
      expect(state.generator.includeUppercase).toBe(false);
      expect(state.generator.includeSymbols).toBe(false);
      expect(state.generator.includeLowercase).toBe(true);
      expect(state.generator.includeNumbers).toBe(true);
    });

    it('should update exclusion settings', () => {
      const state = settingsReducer(
        initialState,
        updateGeneratorSettings({
          excludeSimilar: true,
          excludeAmbiguous: true,
        }),
      );
      expect(state.generator.excludeSimilar).toBe(true);
      expect(state.generator.excludeAmbiguous).toBe(true);
    });

    it('should update minimum requirements', () => {
      const state = settingsReducer(
        initialState,
        updateGeneratorSettings({
          minNumbers: 3,
          minSymbols: 2,
        }),
      );
      expect(state.generator.minNumbers).toBe(3);
      expect(state.generator.minSymbols).toBe(2);
    });

    it('should update all generator settings at once', () => {
      const newSettings = {
        defaultLength: 32,
        includeUppercase: false,
        includeLowercase: true,
        includeNumbers: false,
        includeSymbols: true,
        excludeSimilar: true,
        excludeAmbiguous: true,
        minNumbers: 0,
        minSymbols: 3,
      };
      const state = settingsReducer(
        initialState,
        updateGeneratorSettings(newSettings),
      );
      expect(state.generator).toEqual(newSettings);
    });

    it('should handle incremental generator setting updates', () => {
      let state = settingsReducer(
        initialState,
        updateGeneratorSettings({ defaultLength: 20 }),
      );
      expect(state.generator.defaultLength).toBe(20);

      state = settingsReducer(
        state,
        updateGeneratorSettings({ minNumbers: 4 }),
      );
      expect(state.generator.defaultLength).toBe(20);
      expect(state.generator.minNumbers).toBe(4);
    });
  });

  // setTheme Tests
  describe('setTheme', () => {
    it('should set theme to light', () => {
      const state = settingsReducer(initialState, setTheme('light'));
      expect(state.theme).toBe('light');
    });

    it('should set theme to dark', () => {
      const state = settingsReducer(initialState, setTheme('dark'));
      expect(state.theme).toBe('dark');
    });

    it('should set theme to system', () => {
      let state = settingsReducer(initialState, setTheme('light'));
      state = settingsReducer(state, setTheme('system'));
      expect(state.theme).toBe('system');
    });

    it('should support theme switching', () => {
      let state = settingsReducer(initialState, setTheme('light'));
      expect(state.theme).toBe('light');

      state = settingsReducer(state, setTheme('dark'));
      expect(state.theme).toBe('dark');

      state = settingsReducer(state, setTheme('system'));
      expect(state.theme).toBe('system');
    });

    it('should not affect other settings', () => {
      const state = settingsReducer(initialState, setTheme('dark'));
      expect(state.language).toBe('en');
      expect(state.security.biometricEnabled).toBe(true);
      expect(state.generator.defaultLength).toBe(16);
    });
  });

  // setLanguage Tests
  describe('setLanguage', () => {
    it('should set language to English', () => {
      const state = settingsReducer(initialState, setLanguage('en'));
      expect(state.language).toBe('en');
    });

    it('should set language to other languages', () => {
      const languages = ['es', 'fr', 'de', 'ja', 'vi', 'zh'];
      languages.forEach(lang => {
        const state = settingsReducer(initialState, setLanguage(lang));
        expect(state.language).toBe(lang);
      });
    });

    it('should support language switching', () => {
      let state = settingsReducer(initialState, setLanguage('es'));
      expect(state.language).toBe('es');

      state = settingsReducer(state, setLanguage('fr'));
      expect(state.language).toBe('fr');

      state = settingsReducer(state, setLanguage('en'));
      expect(state.language).toBe('en');
    });

    it('should not affect other settings', () => {
      const state = settingsReducer(initialState, setLanguage('de'));
      expect(state.theme).toBe('system');
      expect(state.security.biometricEnabled).toBe(true);
    });
  });

  // setBiometricEnabled Tests
  describe('setBiometricEnabled', () => {
    it('should enable biometric', () => {
      let state = settingsReducer(initialState, setBiometricEnabled(false));
      expect(state.security.biometricEnabled).toBe(false);

      state = settingsReducer(state, setBiometricEnabled(true));
      expect(state.security.biometricEnabled).toBe(true);
    });

    it('should disable biometric', () => {
      const state = settingsReducer(initialState, setBiometricEnabled(false));
      expect(state.security.biometricEnabled).toBe(false);
    });

    it('should toggle biometric multiple times', () => {
      let state = settingsReducer(initialState, setBiometricEnabled(false));
      expect(state.security.biometricEnabled).toBe(false);

      state = settingsReducer(state, setBiometricEnabled(true));
      expect(state.security.biometricEnabled).toBe(true);

      state = settingsReducer(state, setBiometricEnabled(false));
      expect(state.security.biometricEnabled).toBe(false);
    });

    it('should not affect other security settings', () => {
      const state = settingsReducer(initialState, setBiometricEnabled(false));
      expect(state.security.screenProtectionEnabled).toBe(true);
      expect(state.security.autoLockTimeout).toBe(5);
    });
  });

  // setBiometricType Tests
  describe('setBiometricType', () => {
    it('should set biometric type to Face ID', () => {
      const state = settingsReducer(initialState, setBiometricType('Face ID'));
      expect(state.security.biometricType).toBe('Face ID');
    });

    it('should set biometric type to Touch ID', () => {
      const state = settingsReducer(initialState, setBiometricType('Touch ID'));
      expect(state.security.biometricType).toBe('Touch ID');
    });

    it('should set biometric type to Fingerprint', () => {
      const state = settingsReducer(
        initialState,
        setBiometricType('Fingerprint'),
      );
      expect(state.security.biometricType).toBe('Fingerprint');
    });

    it('should support biometric type switching', () => {
      let state = settingsReducer(initialState, setBiometricType('Face ID'));
      expect(state.security.biometricType).toBe('Face ID');

      state = settingsReducer(state, setBiometricType('Fingerprint'));
      expect(state.security.biometricType).toBe('Fingerprint');
    });
  });

  // setScreenProtectionEnabled Tests
  describe('setScreenProtectionEnabled', () => {
    it('should enable screen protection', () => {
      let state = settingsReducer(
        initialState,
        setScreenProtectionEnabled(false),
      );
      expect(state.security.screenProtectionEnabled).toBe(false);

      state = settingsReducer(state, setScreenProtectionEnabled(true));
      expect(state.security.screenProtectionEnabled).toBe(true);
    });

    it('should disable screen protection', () => {
      const state = settingsReducer(
        initialState,
        setScreenProtectionEnabled(false),
      );
      expect(state.security.screenProtectionEnabled).toBe(false);
    });
  });

  // setSecurityChecksEnabled Tests
  describe('setSecurityChecksEnabled', () => {
    it('should enable security checks', () => {
      let state = settingsReducer(
        initialState,
        setSecurityChecksEnabled(false),
      );
      expect(state.security.securityChecksEnabled).toBe(false);

      state = settingsReducer(state, setSecurityChecksEnabled(true));
      expect(state.security.securityChecksEnabled).toBe(true);
    });

    it('should disable security checks', () => {
      const state = settingsReducer(
        initialState,
        setSecurityChecksEnabled(false),
      );
      expect(state.security.securityChecksEnabled).toBe(false);
    });
  });

  // setRootDetectionEnabled Tests
  describe('setRootDetectionEnabled', () => {
    it('should enable root detection', () => {
      let state = settingsReducer(initialState, setRootDetectionEnabled(false));
      expect(state.security.rootDetectionEnabled).toBe(false);

      state = settingsReducer(state, setRootDetectionEnabled(true));
      expect(state.security.rootDetectionEnabled).toBe(true);
    });

    it('should disable root detection', () => {
      const state = settingsReducer(
        initialState,
        setRootDetectionEnabled(false),
      );
      expect(state.security.rootDetectionEnabled).toBe(false);
    });
  });

  // setAntiTamperingEnabled Tests
  describe('setAntiTamperingEnabled', () => {
    it('should enable anti-tampering', () => {
      let state = settingsReducer(initialState, setAntiTamperingEnabled(false));
      expect(state.security.antiTamperingEnabled).toBe(false);

      state = settingsReducer(state, setAntiTamperingEnabled(true));
      expect(state.security.antiTamperingEnabled).toBe(true);
    });

    it('should disable anti-tampering', () => {
      const state = settingsReducer(
        initialState,
        setAntiTamperingEnabled(false),
      );
      expect(state.security.antiTamperingEnabled).toBe(false);
    });
  });

  // setMemoryProtectionEnabled Tests
  describe('setMemoryProtectionEnabled', () => {
    it('should enable memory protection', () => {
      let state = settingsReducer(
        initialState,
        setMemoryProtectionEnabled(false),
      );
      expect(state.security.memoryProtectionEnabled).toBe(false);

      state = settingsReducer(state, setMemoryProtectionEnabled(true));
      expect(state.security.memoryProtectionEnabled).toBe(true);
    });

    it('should disable memory protection', () => {
      const state = settingsReducer(
        initialState,
        setMemoryProtectionEnabled(false),
      );
      expect(state.security.memoryProtectionEnabled).toBe(false);
    });
  });

  // restoreSettings Tests
  describe('restoreSettings', () => {
    it('should restore security settings', () => {
      const backupSettings = {
        security: {
          biometricEnabled: false,
          biometricType: 'Face ID',
          autoLockTimeout: 10,
          requireBiometricForAutoFill: false,
          screenProtectionEnabled: false,
          securityChecksEnabled: false,
          rootDetectionEnabled: false,
          antiTamperingEnabled: false,
          memoryProtectionEnabled: false,
        },
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.security).toEqual(backupSettings.security);
    });

    it('should restore generator settings', () => {
      const backupSettings = {
        generator: {
          defaultLength: 32,
          includeUppercase: false,
          includeLowercase: true,
          includeNumbers: false,
          includeSymbols: true,
          excludeSimilar: true,
          excludeAmbiguous: true,
          minNumbers: 1,
          minSymbols: 2,
        },
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.generator).toEqual(backupSettings.generator);
    });

    it('should restore theme', () => {
      const backupSettings = {
        theme: 'dark' as const,
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.theme).toBe('dark');
    });

    it('should restore language', () => {
      const backupSettings = {
        language: 'es',
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.language).toBe('es');
    });

    it('should restore all settings at once', () => {
      const backupSettings = {
        security: {
          biometricEnabled: false,
          biometricType: 'Fingerprint',
          autoLockTimeout: 15,
          requireBiometricForAutoFill: false,
          screenProtectionEnabled: false,
          securityChecksEnabled: true,
          rootDetectionEnabled: true,
          antiTamperingEnabled: true,
          memoryProtectionEnabled: false,
        },
        generator: {
          defaultLength: 20,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false,
          excludeSimilar: true,
          excludeAmbiguous: false,
          minNumbers: 2,
          minSymbols: 0,
        },
        theme: 'dark' as const,
        language: 'fr',
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.security).toEqual(backupSettings.security);
      expect(state.generator).toEqual(backupSettings.generator);
      expect(state.theme).toBe('dark');
      expect(state.language).toBe('fr');
    });

    it('should partially restore settings', () => {
      const backupSettings = {
        security: {
          biometricEnabled: false,
          biometricType: 'Face ID',
          autoLockTimeout: 20,
          requireBiometricForAutoFill: true,
          screenProtectionEnabled: true,
          securityChecksEnabled: true,
          rootDetectionEnabled: true,
          antiTamperingEnabled: true,
          memoryProtectionEnabled: true,
        },
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.security).toEqual(backupSettings.security);
      expect(state.generator).toEqual(initialState.generator);
      expect(state.theme).toBe('system');
      expect(state.language).toBe('en');
    });

    it('should merge partial security restore', () => {
      const backupSettings = {
        security: {
          biometricEnabled: false,
          biometricType: 'Touch ID',
          autoLockTimeout: 25,
          requireBiometricForAutoFill: false,
          screenProtectionEnabled: false,
          securityChecksEnabled: false,
          rootDetectionEnabled: false,
          antiTamperingEnabled: false,
          memoryProtectionEnabled: false,
        },
      };
      const state = settingsReducer(
        initialState,
        restoreSettings(backupSettings),
      );

      expect(state.security.biometricEnabled).toBe(false);
      expect(state.security.biometricType).toBe('Touch ID');
      expect(state.security.autoLockTimeout).toBe(25);
    });
  });

  // Complex Scenarios
  describe('complex scenarios', () => {
    it('should handle security settings workflow', () => {
      let state = settingsReducer(initialState, setBiometricEnabled(false));
      expect(state.security.biometricEnabled).toBe(false);

      state = settingsReducer(state, setBiometricType('Face ID'));
      expect(state.security.biometricType).toBe('Face ID');

      state = settingsReducer(
        state,
        updateSecuritySettings({
          autoLockTimeout: 10,
          screenProtectionEnabled: false,
        }),
      );
      expect(state.security.autoLockTimeout).toBe(10);
      expect(state.security.screenProtectionEnabled).toBe(false);
      expect(state.security.biometricEnabled).toBe(false);
    });

    it('should handle generator settings workflow', () => {
      let state = settingsReducer(
        initialState,
        updateGeneratorSettings({ defaultLength: 24 }),
      );
      expect(state.generator.defaultLength).toBe(24);

      state = settingsReducer(
        state,
        updateGeneratorSettings({
          includeSymbols: false,
          excludeSimilar: true,
        }),
      );
      expect(state.generator.defaultLength).toBe(24);
      expect(state.generator.includeSymbols).toBe(false);
      expect(state.generator.excludeSimilar).toBe(true);
    });

    it('should handle preference settings workflow', () => {
      let state = settingsReducer(initialState, setTheme('dark'));
      expect(state.theme).toBe('dark');

      state = settingsReducer(state, setLanguage('es'));
      expect(state.language).toBe('es');

      expect(state.security.biometricEnabled).toBe(true);
      expect(state.generator.defaultLength).toBe(16);
    });

    it('should handle backup and restore workflow', () => {
      let state = settingsReducer(initialState, setTheme('dark'));
      state = settingsReducer(state, setBiometricEnabled(false));
      state = settingsReducer(
        state,
        updateGeneratorSettings({ defaultLength: 32 }),
      );

      // Simulate restore from backup
      const backupSettings = {
        theme: 'light' as const,
        security: {
          biometricEnabled: true,
          biometricType: 'Touch ID',
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
      };

      state = settingsReducer(state, restoreSettings(backupSettings));

      // Verify the restored settings
      expect(state.theme).toBe(backupSettings.theme);
      expect(state.security).toEqual(backupSettings.security);
      expect(state.generator).toEqual(backupSettings.generator);
      expect(state.language).toBe('en'); // language not in backup, should stay as is
    });

    it('should preserve settings across independent updates', () => {
      let state = settingsReducer(initialState, setBiometricEnabled(false));
      const biometricValue = state.security.biometricEnabled;

      state = settingsReducer(state, setTheme('dark'));
      expect(state.security.biometricEnabled).toBe(biometricValue);

      state = settingsReducer(state, setLanguage('fr'));
      expect(state.security.biometricEnabled).toBe(biometricValue);
      expect(state.theme).toBe('dark');

      state = settingsReducer(
        state,
        updateGeneratorSettings({ defaultLength: 20 }),
      );
      expect(state.security.biometricEnabled).toBe(biometricValue);
      expect(state.theme).toBe('dark');
      expect(state.language).toBe('fr');
    });

    it('should handle multiple security toggles', () => {
      let state = settingsReducer(
        initialState,
        setScreenProtectionEnabled(false),
      );
      state = settingsReducer(state, setSecurityChecksEnabled(false));
      state = settingsReducer(state, setRootDetectionEnabled(false));

      expect(state.security.screenProtectionEnabled).toBe(false);
      expect(state.security.securityChecksEnabled).toBe(false);
      expect(state.security.rootDetectionEnabled).toBe(false);

      state = settingsReducer(state, setScreenProtectionEnabled(true));
      expect(state.security.screenProtectionEnabled).toBe(true);
      expect(state.security.securityChecksEnabled).toBe(false);
    });
  });

  // Edge Cases
  describe('edge cases', () => {
    it('should handle empty restore settings', () => {
      const state = settingsReducer(initialState, restoreSettings({}));
      expect(state).toEqual(initialState);
    });

    it('should handle boolean toggles correctly', () => {
      let state = settingsReducer(initialState, setBiometricEnabled(true));
      expect(state.security.biometricEnabled).toBe(true);

      state = settingsReducer(state, setBiometricEnabled(true));
      expect(state.security.biometricEnabled).toBe(true);

      state = settingsReducer(state, setBiometricEnabled(false));
      expect(state.security.biometricEnabled).toBe(false);
    });

    it('should handle extreme generator settings', () => {
      let state = settingsReducer(
        initialState,
        updateGeneratorSettings({ defaultLength: 128 }),
      );
      expect(state.generator.defaultLength).toBe(128);

      state = settingsReducer(
        state,
        updateGeneratorSettings({ defaultLength: 1 }),
      );
      expect(state.generator.defaultLength).toBe(1);
    });

    it('should maintain state immutability', () => {
      const originalState = { ...initialState };
      const newState = settingsReducer(
        originalState,
        setBiometricEnabled(false),
      );

      expect(originalState).toEqual(initialState);
      expect(originalState.security.biometricEnabled).toBe(true);
      expect(newState.security.biometricEnabled).toBe(false);
    });
  });
});
