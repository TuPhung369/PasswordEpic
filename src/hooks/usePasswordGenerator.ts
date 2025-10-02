import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import {
  passwordGeneratorService,
  GenerationHistory,
  PasswordTemplate,
  GeneratorPreset,
} from '../services/passwordGeneratorService';
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
  generatePatternPassword: (pattern: string) => Promise<void>;
  usePreset: (presetId: string) => Promise<void>;
  useTemplate: (templateId: string) => Promise<void>;

  // History management
  history: GenerationHistory[];
  favorites: GenerationHistory[];
  addToFavorites: (entryId: string) => void;
  removeFromFavorites: (entryId: string) => void;
  removeFromHistory: (entryId: string) => void;
  clearHistory: () => void;

  // Templates and presets
  templates: PasswordTemplate[];
  presets: GeneratorPreset[];

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
  const templates = passwordGeneratorService.getTemplates();
  const presets = passwordGeneratorService.getPresets();

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
        const result = await passwordGeneratorService.generatePassword(
          optionsToUse,
          templateId,
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
        const password = passwordGeneratorService.generatePronounceablePassword(
          length || generatorOptions.length,
        );
        setCurrentPassword(password);

        // Calculate strength for the generated password
        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
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

  // Generate pattern-based password
  const generatePatternPassword = useCallback(
    async (pattern: string): Promise<void> => {
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const password =
          passwordGeneratorService.generatePatternPassword(pattern);
        setCurrentPassword(password);

        // Calculate strength for the generated password
        const { calculatePasswordStrength } = await import(
          '../utils/passwordUtils'
        );
        const strength = calculatePasswordStrength(password);
        setPasswordStrength(strength);
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

  // Use a preset
  const usePreset = useCallback(
    async (presetId: string): Promise<void> => {
      const preset = presets.find(p => p.id === presetId);
      if (preset) {
        await generatePassword(preset.options);
        // Update store with preset options
        dispatch(updateGeneratorSettings(preset.options));
      }
    },
    [presets, generatePassword, dispatch],
  );

  // Use a template
  const useTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        await generatePassword(template.options, templateId);
        // Update store with template options
        dispatch(updateGeneratorSettings(template.options));
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
        Alert.alert('Error', 'No password to copy');
        return;
      }

      try {
        // TODO: Implement actual clipboard functionality
        // await Clipboard.setString(passwordToCopy);
        console.log('Copied to clipboard:', passwordToCopy);
        Alert.alert('Success', 'Password copied to clipboard');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
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
    generatePatternPassword,
    usePreset,
    useTemplate,

    // History management
    history,
    favorites,
    addToFavorites,
    removeFromFavorites,
    removeFromHistory,
    clearHistory,

    // Templates and presets
    templates,
    presets,

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
