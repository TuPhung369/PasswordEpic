import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  passwordGeneratorService,
  GenerationHistory,
} from '../services/passwordGeneratorService';
import { PasswordTemplate, DEFAULT_TEMPLATES } from '../components/PasswordTemplates';
import {
  PasswordGeneratorOptions,
  PasswordStrengthResult,
} from '../types/password';
import { useAppSelector, useAppDispatch } from './redux';
import { updateGeneratorSettings } from '../store/slices/settingsSlice';
import { RootState } from '../store';

export interface UsePasswordGeneratorReturn {
  // Current generation state
  currentPassword: string;
  passwordStrength: PasswordStrengthResult | null;
  isGenerating: boolean;
  generationError: string | null;

  // Generation functions
  generatePassword: (
    options?: PasswordGeneratorOptions,
    templateId?: string,
  ) => Promise<void>;
  generateMultiple: (
    options?: PasswordGeneratorOptions,
    count?: number,
  ) => Promise<Array<{ password: string; strength: PasswordStrengthResult }>>;
  generatePronounceablePassword: (length?: number) => Promise<void>;
  generateMemorablePassword: (length?: number) => Promise<void>;
  generatePassphrase: (length?: number) => Promise<void>;
  generatePinPassword: (length?: number) => Promise<void>;
  generateBankingPassword: (length?: number) => Promise<void>;
  generateSocialPassword: (length?: number) => Promise<void>;
  generateEmailPassword: (length?: number) => Promise<void>;
  generateBusinessPassword: (length?: number) => Promise<void>;
  generateGamingPassword: (length?: number) => Promise<void>;
  generateShoppingPassword: (length?: number) => Promise<void>;
  generateWiFiPassword: (length?: number) => Promise<void>;
  generatePatternPassword: (pattern: string) => Promise<void>;
  useTemplate: (templateId: string) => Promise<void>;

  // History management
  history: GenerationHistory[];
  favorites: GenerationHistory[];
  addToFavorites: (entryId: string) => void;
  removeFromFavorites: (entryId: string) => void;
  removeFromHistory: (entryId: string) => void;
  clearHistory: () => void;

  // Templates
  templates: PasswordTemplate[];

  // Settings
  generatorOptions: PasswordGeneratorOptions;
  updateOptions: (options: Partial<PasswordGeneratorOptions>) => void;
  resetToDefaults: () => void;

  // Utilities
  copyToClipboard: (password?: string) => Promise<void>;
  reuseFromHistory: (entryId: string) => void;
  exportHistory: () => string;
  importHistory: (data: string) => boolean;
}

const defaultOptions: PasswordGeneratorOptions = {
  length: 12,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeSimilar: true,
  excludeAmbiguous: false,
  minNumbers: 2,
  minSymbols: 1,
};

export const usePasswordGenerator = (): UsePasswordGeneratorReturn => {
  const dispatch = useAppDispatch();
  const { generator } = useAppSelector((state: RootState) => state.settings);

  // Local state
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrengthResult | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [favorites, setFavorites] = useState<GenerationHistory[]>([]);

  // Static data
  const templates = DEFAULT_TEMPLATES;

  // Current generator options from Redux store
  const generatorOptions: PasswordGeneratorOptions = useMemo(
    () => ({
      length: generator.defaultLength || defaultOptions.length,
      includeUppercase: generator.includeUppercase,
      includeLowercase: generator.includeLowercase,
      includeNumbers: generator.includeNumbers,
      includeSymbols: generator.includeSymbols,
      excludeSimilar: generator.excludeSimilar || defaultOptions.excludeSimilar,
      excludeAmbiguous:
        generator.excludeAmbiguous || defaultOptions.excludeAmbiguous,
      minNumbers: generator.minNumbers || defaultOptions.minNumbers,
      minSymbols: generator.minSymbols || defaultOptions.minSymbols,
    }),
    [generator],
  );

  // Refresh history from service
  const refreshHistory = useCallback(() => {
    const newHistory = passwordGeneratorService.getHistory();
    const newFavorites = passwordGeneratorService.getFavorites();
    setHistory(newHistory);
    setFavorites(newFavorites);
  }, []);

  // Load history on mount
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Generate password with current options
  const generatePassword = useCallback(
    async (
      options?: PasswordGeneratorOptions,
      templateId?: string,
    ): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const optionsToUse = options || generatorOptions;

        if (templateId) {
          console.log(`🎯 Generating password using template: ${templateId}`);
        } else {
          console.log('💪 Generating strong password with custom options');
        }

        console.log(`⚙️ Password options:`, {
          length: optionsToUse.length,
          includeUppercase: optionsToUse.includeUppercase,
          includeLowercase: optionsToUse.includeLowercase,
          includeNumbers: optionsToUse.includeNumbers,
          includeSymbols: optionsToUse.includeSymbols,
          excludeSimilar: optionsToUse.excludeSimilar,
          excludeAmbiguous: optionsToUse.excludeAmbiguous,
        });

        const result = await passwordGeneratorService.generatePassword(
          optionsToUse,
          templateId,
        );

        console.log(
          `✅ Generated ${templateId ? 'template' : 'strong'} password:`,
          {
            length: result.password.length,
            strength: result.strength.score,
            strengthText:
              result.strength.feedback.join(', ') || 'Strong password',
          },
        );

        setCurrentPassword(result.password);
        setPasswordStrength(result.strength);
        refreshHistory();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate password';
        setGenerationError(errorMessage);
        console.error('Error generating password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [generatorOptions, refreshHistory],
  );

  // Generate multiple passwords
  const generateMultiple = useCallback(
    async (
      options?: PasswordGeneratorOptions,
      count: number = 5,
    ): Promise<
      Array<{ password: string; strength: PasswordStrengthResult }>
    > => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const optionsToUse = options || generatorOptions;
        const results = await passwordGeneratorService.generateMultiple(
          optionsToUse,
          count,
        );
        refreshHistory();
        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate passwords';
        setGenerationError(errorMessage);
        console.error('Error generating multiple passwords:', error);
        return [];
      } finally {
        setIsGenerating(false);
      }
    },
    [generatorOptions, refreshHistory],
  );

  // Generate pronounceable password
  const generatePronounceablePassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || generatorOptions.length;
        console.log(
          `🗣️ Generating pronounceable password with length: ${targetLength}`,
        );

        const password =
          passwordGeneratorService.generatePronounceablePassword(targetLength);
        setCurrentPassword(password);

        // Calculate strength for the generated password
        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);

        console.log(`✅ Generated pronounceable password:`, {
          password: password,
          length: password.length,
          strength: strength.score,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate pronounceable password';
        setGenerationError(errorMessage);
        console.error('Error generating pronounceable password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [generatorOptions.length],
  );

  // Generate memorable password (easier to remember)
  const generateMemorablePassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || generatorOptions.length;
        console.log(
          `🧠 Generating memorable password with length: ${targetLength}`,
        );

        const password =
          passwordGeneratorService.generateMemorablePassword(targetLength);
        setCurrentPassword(password);

        // Calculate strength for the generated password
        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);

        console.log(`✅ Generated memorable password:`, {
          password: password,
          length: password.length,
          strength: strength.score,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate memorable password';
        setGenerationError(errorMessage);
        console.error('Error generating memorable password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [generatorOptions.length],
  );

  // Generate passphrase password
  const generatePassphrase = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || generatorOptions.length;
        console.log(
          `📝 Generating passphrase with length: ${targetLength}`,
        );

        const password = passwordGeneratorService.generatePassphrase(
          targetLength,
          generatorOptions.includeNumbers,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);

        console.log(`✅ Generated passphrase:`, {
          password: password,
          length: password.length,
          strength: strength.score,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate passphrase';
        setGenerationError(errorMessage);
        console.error('Error generating passphrase:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [generatorOptions.length, generatorOptions.includeNumbers],
  );

  // Generate PIN password
  const generatePinPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 6;
        console.log(
          `🔐 Generating PIN password with length: ${targetLength}`,
        );

        const password = passwordGeneratorService.generatePassword(
          {
            length: targetLength,
            includeUppercase: false,
            includeLowercase: false,
            includeNumbers: true,
            includeSymbols: false,
            excludeSimilar: true,
            excludeAmbiguous: false,
          },
          'pin',
        );

        const result = await password;
        setCurrentPassword(result.password);
        setPasswordStrength(result.strength);

        console.log(`✅ Generated PIN:`, {
          password: result.password,
          length: result.password.length,
          strength: result.strength.score,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate PIN';
        setGenerationError(errorMessage);
        console.error('Error generating PIN:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate Banking password
  const generateBankingPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 50;
        const password = passwordGeneratorService.generateBankingPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate Banking password';
        setGenerationError(errorMessage);
        console.error('Error generating Banking password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate Social password
  const generateSocialPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 40;
        const password = passwordGeneratorService.generateSocialPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate Social password';
        setGenerationError(errorMessage);
        console.error('Error generating Social password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate Email password
  const generateEmailPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 38;
        const password = passwordGeneratorService.generateEmailPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate Email password';
        setGenerationError(errorMessage);
        console.error('Error generating Email password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate Business password
  const generateBusinessPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 46;
        const password = passwordGeneratorService.generateBusinessPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate Business password';
        setGenerationError(errorMessage);
        console.error('Error generating Business password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate Gaming password
  const generateGamingPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 24;
        const password = passwordGeneratorService.generateGamingPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate Gaming password';
        setGenerationError(errorMessage);
        console.error('Error generating Gaming password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate Shopping password
  const generateShoppingPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 26;
        const password = passwordGeneratorService.generateShoppingPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate Shopping password';
        setGenerationError(errorMessage);
        console.error('Error generating Shopping password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate WiFi password
  const generateWiFiPassword = useCallback(
    async (length?: number): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const targetLength = length || 34;
        const password = passwordGeneratorService.generateWiFiPassword(
          targetLength,
        );
        setCurrentPassword(password);

        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate WiFi password';
        setGenerationError(errorMessage);
        console.error('Error generating WiFi password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Generate pattern-based password
  const generatePatternPassword = useCallback(
    async (pattern: string): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        console.log(
          `🎨 Generating pattern-based password with pattern: ${pattern}`,
        );

        const password =
          passwordGeneratorService.generatePatternPassword(pattern);
        setCurrentPassword(password);

        // Calculate strength for the generated password
        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);

        console.log(`✅ Generated pattern password:`, {
          pattern: pattern,
          password: password,
          length: password.length,
          strength: strength.score,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate pattern password';
        setGenerationError(errorMessage);
        console.error('Error generating pattern password:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // Use a template
  const useTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        console.log(
          `📋 Using password template: ${template.name} (${templateId})`,
        );
        await generatePassword(template.settings, templateId);
        // Update store with template settings
        dispatch(updateGeneratorSettings(template.settings));
      }
    },
    [templates, generatePassword, dispatch],
  );

  // History management
  const addToFavorites = useCallback(
    (entryId: string): void => {
      passwordGeneratorService.toggleFavorite(entryId);
      refreshHistory();
    },
    [refreshHistory],
  );

  const removeFromFavorites = useCallback(
    (entryId: string): void => {
      passwordGeneratorService.toggleFavorite(entryId);
      refreshHistory();
    },
    [refreshHistory],
  );

  const removeFromHistory = useCallback(
    (entryId: string): void => {
      passwordGeneratorService.removeFromHistory(entryId);
      refreshHistory();
    },
    [refreshHistory],
  );

  const clearHistory = useCallback((): void => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all password generation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            passwordGeneratorService.clearHistory();
            refreshHistory();
          },
        },
      ],
    );
  }, [refreshHistory]);

  // Settings management
  const updateOptions = useCallback(
    (options: Partial<PasswordGeneratorOptions>): void => {
      dispatch(updateGeneratorSettings(options));
    },
    [dispatch],
  );

  const resetToDefaults = useCallback((): void => {
    dispatch(updateGeneratorSettings(defaultOptions));
  }, [dispatch]);

  // Utilities
  const copyToClipboard = useCallback(
    async (password?: string): Promise<void> => {
      const passwordToCopy = password || currentPassword;
      if (!passwordToCopy) {
        console.log('❌ No password to copy');
        Alert.alert('Error', 'No password to copy');
        return;
      }

      try {
        await Clipboard.setString(passwordToCopy);
        console.log('📋 ✅ Copied to clipboard:', passwordToCopy);
        Alert.alert('Success', 'Password copied to clipboard! 📋');
      } catch (error) {
        console.error('❌ Error copying to clipboard:', error);
        Alert.alert('Error', 'Failed to copy password to clipboard');
      }
    },
    [currentPassword],
  );

  const reuseFromHistory = useCallback(
    (entryId: string): void => {
      const entry = history.find(h => h.id === entryId);
      if (entry) {
        setCurrentPassword(entry.password);
        setPasswordStrength(entry.strength);
        // Update settings to match the historical entry
        dispatch(updateGeneratorSettings(entry.options));
      }
    },
    [history, dispatch],
  );

  const exportHistory = useCallback((): string => {
    return passwordGeneratorService.exportHistory();
  }, []);

  const importHistory = useCallback(
    (data: string): boolean => {
      const success = passwordGeneratorService.importHistory(data);
      if (success) {
        refreshHistory();
      }
      return success;
    },
    [refreshHistory],
  );

  return {
    // Current generation state
    currentPassword,
    passwordStrength,
    isGenerating,
    generationError,

    // Generation functions
    generatePassword,
    generateMultiple,
    generatePronounceablePassword,
    generateMemorablePassword,
    generatePassphrase,
    generatePinPassword,
    generateBankingPassword,
    generateSocialPassword,
    generateEmailPassword,
    generateBusinessPassword,
    generateGamingPassword,
    generateShoppingPassword,
    generateWiFiPassword,
    generatePatternPassword,
    useTemplate,

    // History management
    history,
    favorites,
    addToFavorites,
    removeFromFavorites,
    removeFromHistory,
    clearHistory,

    // Templates
    templates,

    // Settings
    generatorOptions,
    updateOptions,
    resetToDefaults,

    // Utilities
    copyToClipboard,
    reuseFromHistory,
    exportHistory,
    importHistory,
  };
};

export default usePasswordGenerator;
