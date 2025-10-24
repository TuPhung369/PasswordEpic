import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import usePasswordGenerator from '../usePasswordGenerator';
import {
  passwordGeneratorService,
  GenerationHistory,
  PasswordTemplate,
  GeneratorPreset,
} from '../../services/passwordGeneratorService';
import { useAppDispatch, useAppSelector } from '../redux';

// Mock react-native manually to ensure Alert is defined
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@react-native-clipboard/clipboard');
jest.mock('../../services/passwordGeneratorService');
jest.mock('../redux');

// Mock console
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

// Mock data
const mockGeneratorOptions = {
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

const mockPasswordStrength = {
  score: 4,
  feedback: ['Strong password'],
};

const mockHistoryEntry: GenerationHistory = {
  id: 'hist-1',
  password: 'TestPassword123!',
  strength: mockPasswordStrength,
  options: mockGeneratorOptions,
  createdAt: new Date(),
  isFavorite: false,
};

const mockTemplates: PasswordTemplate[] = [
  {
    id: 'template-1',
    name: 'Strong Alphanumeric',
    category: 'General',
    options: { ...mockGeneratorOptions, includeSymbols: false },
  },
  {
    id: 'template-2',
    name: 'Alphanumeric Only',
    category: 'General',
    options: { ...mockGeneratorOptions, length: 16 },
  },
];

const mockPresets: GeneratorPreset[] = [
  {
    id: 'memorable',
    name: 'Memorable',
    options: { ...mockGeneratorOptions, length: 10 },
  },
  {
    id: 'passphrase',
    name: 'Passphrase',
    options: { ...mockGeneratorOptions, length: 15 },
  },
  {
    id: 'wifi',
    name: 'WiFi Password',
    options: { ...mockGeneratorOptions, length: 12 },
  },
  {
    id: 'pin',
    name: 'PIN',
    options: { ...mockGeneratorOptions, length: 6 },
  },
];

// Helper function to setup mocks for each test
function setupMocks(generatorOptions = mockGeneratorOptions) {
  jest.clearAllMocks();
  consoleLogSpy.mockClear();
  consoleErrorSpy.mockClear();

  const mockDispatch = jest.fn();
  (useAppDispatch as jest.Mock).mockReturnValue(mockDispatch);
  (useAppSelector as jest.Mock).mockImplementation(selector => {
    // Mock the selector to return store state
    return selector({
      settings: {
        generator: generatorOptions,
      },
    });
  });

  (passwordGeneratorService.getTemplates as jest.Mock).mockReturnValue(
    mockTemplates,
  );
  (passwordGeneratorService.getPresets as jest.Mock).mockReturnValue(
    mockPresets,
  );
  (passwordGeneratorService.getHistory as jest.Mock).mockReturnValue([
    mockHistoryEntry,
  ]);
  (passwordGeneratorService.getFavorites as jest.Mock).mockReturnValue([
    mockHistoryEntry,
  ]);

  (Clipboard.setString as jest.Mock).mockResolvedValue(undefined);
  (Alert.alert as jest.Mock).mockImplementation();

  return { mockDispatch };
}

describe('usePasswordGenerator', () => {
  beforeEach(() => {
    setupMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state and load history', () => {
      const { result } = renderHook(() => usePasswordGenerator());

      expect(result.current.currentPassword).toBe('');
      expect(result.current.passwordStrength).toBeNull();
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generationError).toBeNull();
      expect(result.current.history).toEqual([mockHistoryEntry]);
      expect(result.current.favorites).toEqual([mockHistoryEntry]);
      expect(passwordGeneratorService.getHistory).toHaveBeenCalled();
      expect(passwordGeneratorService.getFavorites).toHaveBeenCalled();
    });

    it('should return all required functions and properties', () => {
      const { result } = renderHook(() => usePasswordGenerator());

      // Generation functions
      expect(typeof result.current.generatePassword).toBe('function');
      expect(typeof result.current.generateMultiple).toBe('function');
      expect(typeof result.current.generatePronounceablePassword).toBe(
        'function',
      );
      expect(typeof result.current.generateMemorablePassword).toBe('function');
      expect(typeof result.current.generatePatternPassword).toBe('function');
      expect(typeof result.current.usePreset).toBe('function');
      expect(typeof result.current.useTemplate).toBe('function');

      // History functions
      expect(typeof result.current.addToFavorites).toBe('function');
      expect(typeof result.current.removeFromFavorites).toBe('function');
      expect(typeof result.current.removeFromHistory).toBe('function');
      expect(typeof result.current.clearHistory).toBe('function');

      // Settings functions
      expect(typeof result.current.updateOptions).toBe('function');
      expect(typeof result.current.resetToDefaults).toBe('function');

      // Utility functions
      expect(typeof result.current.copyToClipboard).toBe('function');
      expect(typeof result.current.reuseFromHistory).toBe('function');
      expect(typeof result.current.exportHistory).toBe('function');
      expect(typeof result.current.importHistory).toBe('function');
    });

    it('should load templates and presets', () => {
      const { result } = renderHook(() => usePasswordGenerator());

      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.presets).toEqual(mockPresets);
    });
  });

  describe('Password Generation', () => {
    it('should generate password with default options', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'GeneratedPass123!',
        strength: mockPasswordStrength,
      });

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword();
      });

      expect(result.current.currentPassword).toBe('GeneratedPass123!');
      expect(result.current.passwordStrength).toEqual(mockPasswordStrength);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generationError).toBeNull();
    });

    it('should generate password with custom options', async () => {
      const customOptions = { ...mockGeneratorOptions, length: 20 };
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'CustomLongPassword123!',
        strength: mockPasswordStrength,
      });

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword(customOptions);
      });

      expect(passwordGeneratorService.generatePassword).toHaveBeenCalledWith(
        customOptions,
        undefined,
      );
      expect(result.current.currentPassword).toBe('CustomLongPassword123!');
    });

    it('should generate password using template', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'TemplatePassword123',
        strength: mockPasswordStrength,
      });

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword(undefined, 'template-1');
      });

      expect(passwordGeneratorService.generatePassword).toHaveBeenCalledWith(
        result.current.generatorOptions,
        'template-1',
      );
    });

    it('should handle generation error', async () => {
      const errorMessage = 'Generation failed';
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword();
      });

      expect(result.current.generationError).toBe(errorMessage);
      expect(result.current.isGenerating).toBe(false);
    });

    it('should refresh history after generation', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'NewPassword123!',
        strength: mockPasswordStrength,
      });

      const { result } = renderHook(() => usePasswordGenerator());

      const initialHistoryCalls = (
        passwordGeneratorService.getHistory as jest.Mock
      ).mock.calls.length;

      await act(async () => {
        await result.current.generatePassword();
      });

      expect(passwordGeneratorService.getHistory).toHaveBeenCalledTimes(
        initialHistoryCalls + 1,
      );
    });
  });

  describe('Generate Multiple Passwords', () => {
    it('should generate multiple passwords with default count', async () => {
      const passwords = [
        { password: 'Pass1234!', strength: mockPasswordStrength },
        { password: 'Pass5678!', strength: mockPasswordStrength },
        { password: 'Pass9012!', strength: mockPasswordStrength },
      ];

      (
        passwordGeneratorService.generateMultiple as jest.Mock
      ).mockResolvedValue(passwords);

      const { result } = renderHook(() => usePasswordGenerator());

      let generatedPasswords: any[] = [];

      await act(async () => {
        generatedPasswords = await result.current.generateMultiple();
      });

      expect(passwordGeneratorService.generateMultiple).toHaveBeenCalledWith(
        result.current.generatorOptions,
        5,
      );
      expect(generatedPasswords).toEqual(passwords);
    });

    it('should generate multiple passwords with custom count', async () => {
      const passwords = Array(10)
        .fill(null)
        .map((_, i) => ({
          password: `Pass${i}123!`,
          strength: mockPasswordStrength,
        }));

      (
        passwordGeneratorService.generateMultiple as jest.Mock
      ).mockResolvedValue(passwords);

      const { result } = renderHook(() => usePasswordGenerator());

      let generatedPasswords: any[] = [];

      await act(async () => {
        generatedPasswords = await result.current.generateMultiple(
          undefined,
          10,
        );
      });

      expect(passwordGeneratorService.generateMultiple).toHaveBeenCalledWith(
        result.current.generatorOptions,
        10,
      );
      expect(generatedPasswords.length).toBe(10);
    });

    it('should handle error in multiple generation', async () => {
      (
        passwordGeneratorService.generateMultiple as jest.Mock
      ).mockRejectedValue(new Error('Batch generation failed'));

      const { result } = renderHook(() => usePasswordGenerator());

      let generatedPasswords: any[] = [];

      await act(async () => {
        generatedPasswords = await result.current.generateMultiple();
      });

      expect(result.current.generationError).toBe('Batch generation failed');
      expect(generatedPasswords).toEqual([]);
    });

    it('should return empty array on error', async () => {
      (
        passwordGeneratorService.generateMultiple as jest.Mock
      ).mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => usePasswordGenerator());

      let result_passwords: any[] = [];

      await act(async () => {
        result_passwords = await result.current.generateMultiple(undefined, 5);
      });

      expect(result_passwords).toEqual([]);
    });
  });

  describe('Pronounceable Password Generation', () => {
    it('should generate pronounceable password', async () => {
      (
        passwordGeneratorService.generatePronounceablePassword as jest.Mock
      ).mockReturnValue('PronounceablePass123');

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePronounceablePassword();
      });

      expect(result.current.currentPassword).toBe('PronounceablePass123');
      expect(result.current.isGenerating).toBe(false);
    });

    it('should generate pronounceable password with custom length', async () => {
      (
        passwordGeneratorService.generatePronounceablePassword as jest.Mock
      ).mockReturnValue('CustomLengthPass');

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePronounceablePassword(16);
      });

      expect(
        passwordGeneratorService.generatePronounceablePassword,
      ).toHaveBeenCalledWith(16);
    });

    it('should handle error in pronounceable generation', async () => {
      (
        passwordGeneratorService.generatePronounceablePassword as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Pronounceable generation error');
      });

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePronounceablePassword();
      });

      expect(result.current.generationError).toBe(
        'Pronounceable generation error',
      );
    });
  });

  describe('Memorable Password Generation', () => {
    it('should generate memorable password', async () => {
      (
        passwordGeneratorService.generateMemorablePassword as jest.Mock
      ).mockReturnValue('MemorablePass123');

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generateMemorablePassword();
      });

      expect(result.current.currentPassword).toBe('MemorablePass123');
      expect(result.current.isGenerating).toBe(false);
    });

    it('should generate memorable password with custom length', async () => {
      (
        passwordGeneratorService.generateMemorablePassword as jest.Mock
      ).mockReturnValue('CustomMemPass');

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generateMemorablePassword(14);
      });

      expect(
        passwordGeneratorService.generateMemorablePassword,
      ).toHaveBeenCalledWith(14);
    });

    it('should handle error in memorable generation', async () => {
      (
        passwordGeneratorService.generateMemorablePassword as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Memorable generation error');
      });

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generateMemorablePassword();
      });

      expect(result.current.generationError).toBe('Memorable generation error');
    });
  });

  describe('Pattern Password Generation', () => {
    it('should generate pattern password', async () => {
      (
        passwordGeneratorService.generatePatternPassword as jest.Mock
      ).mockReturnValue('PatternPass123');

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePatternPassword('WZN');
      });

      expect(
        passwordGeneratorService.generatePatternPassword,
      ).toHaveBeenCalledWith('WZN');
      expect(result.current.currentPassword).toBe('PatternPass123');
      expect(result.current.isGenerating).toBe(false);
    });

    it('should handle error in pattern generation', async () => {
      (
        passwordGeneratorService.generatePatternPassword as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Pattern generation error');
      });

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePatternPassword('WWW');
      });

      expect(result.current.generationError).toBe('Pattern generation error');
    });
  });

  describe('Preset Usage', () => {
    it('should use memorable preset', async () => {
      (
        passwordGeneratorService.generateMemorablePassword as jest.Mock
      ).mockReturnValue('MemorablePreset');

      const { mockDispatch } = setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.usePreset('memorable');
      });

      expect(
        passwordGeneratorService.generateMemorablePassword,
      ).toHaveBeenCalledWith(10);
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should use passphrase preset', async () => {
      (
        passwordGeneratorService.generatePatternPassword as jest.Mock
      ).mockReturnValue('PassphrasePattern');

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.usePreset('passphrase');
      });

      expect(
        passwordGeneratorService.generatePatternPassword,
      ).toHaveBeenCalledWith('WwYW');
    });

    it('should use wifi preset', async () => {
      (
        passwordGeneratorService.generatePatternPassword as jest.Mock
      ).mockReturnValue('WiFiPassword');

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.usePreset('wifi');
      });

      expect(
        passwordGeneratorService.generatePatternPassword,
      ).toHaveBeenCalledWith('WZY');
    });

    it('should use pin preset', async () => {
      (
        passwordGeneratorService.generatePatternPassword as jest.Mock
      ).mockReturnValue('123456');

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.usePreset('pin');
      });

      expect(
        passwordGeneratorService.generatePatternPassword,
      ).toHaveBeenCalledWith('NNNNNN');
    });

    it('should not crash if preset not found', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.usePreset('non-existent-preset');
      });

      // Should not throw, just not execute generation
      expect(result.current.currentPassword).toBe('');
    });
  });

  describe('Template Usage', () => {
    it('should use template', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'TemplatePassword123',
        strength: mockPasswordStrength,
      });

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.useTemplate('template-1');
      });

      expect(passwordGeneratorService.generatePassword).toHaveBeenCalledWith(
        mockTemplates[0].options,
        'template-1',
      );
    });

    it('should not crash if template not found', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.useTemplate('non-existent-template');
      });

      expect(result.current.currentPassword).toBe('');
    });
  });

  describe('History Management', () => {
    it('should add to favorites', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        result.current.addToFavorites('hist-1');
      });

      expect(passwordGeneratorService.toggleFavorite).toHaveBeenCalledWith(
        'hist-1',
      );
      expect(passwordGeneratorService.getFavorites).toHaveBeenCalled();
    });

    it('should remove from favorites', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        result.current.removeFromFavorites('hist-1');
      });

      expect(passwordGeneratorService.toggleFavorite).toHaveBeenCalledWith(
        'hist-1',
      );
    });

    it('should remove from history', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        result.current.removeFromHistory('hist-1');
      });

      expect(passwordGeneratorService.removeFromHistory).toHaveBeenCalledWith(
        'hist-1',
      );
    });

    it('should clear history with confirmation dialog', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        result.current.clearHistory();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Clear History',
        expect.stringContaining('clear all password generation history'),
        expect.any(Array),
      );
    });

    it('should execute clear when user confirms', async () => {
      const { result } = renderHook(() => usePasswordGenerator());

      // Set up Alert to call the onPress handler
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, buttons) => {
          const clearButton = buttons.find((b: any) => b.text === 'Clear');
          if (clearButton?.onPress) {
            clearButton.onPress();
          }
        },
      );

      await act(async () => {
        result.current.clearHistory();
      });

      expect(passwordGeneratorService.clearHistory).toHaveBeenCalled();
    });
  });

  describe('Settings Management', () => {
    it('should update generator options', () => {
      const { mockDispatch } = setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      act(() => {
        result.current.updateOptions({ length: 20 });
      });

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should reset to default options', () => {
      const { mockDispatch } = setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      act(() => {
        result.current.resetToDefaults();
      });

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('Clipboard Operations', () => {
    it('should copy current password to clipboard', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'CopyThisPassword123!',
        strength: mockPasswordStrength,
      });

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      // Generate password first
      await act(async () => {
        await result.current.generatePassword();
      });

      // Copy to clipboard
      await act(async () => {
        await result.current.copyToClipboard();
      });

      expect(Clipboard.setString).toHaveBeenCalledWith('CopyThisPassword123!');
    });

    it('should copy provided password to clipboard', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.copyToClipboard('ProvidedPassword123!');
      });

      expect(Clipboard.setString).toHaveBeenCalledWith('ProvidedPassword123!');
    });

    it('should show error when no password to copy', async () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.copyToClipboard();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'No password to copy');
      expect(Clipboard.setString).not.toHaveBeenCalled();
    });

    it('should handle clipboard error gracefully', async () => {
      // Setup before mocking clipboard error
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'TestPassword123!',
        strength: mockPasswordStrength,
      });

      // Mock clipboard to reject on first call
      (Clipboard.setString as jest.Mock).mockRejectedValueOnce(
        new Error('Clipboard error'),
      );

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      // Generate password first
      await act(async () => {
        await result.current.generatePassword();
      });

      // Now attempt to copy when clipboard is mocked to fail
      await act(async () => {
        await result.current.copyToClipboard();
      });

      // Should show error alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to copy password to clipboard',
      );
    });
  });

  describe('History Reuse', () => {
    it('should reuse password from history', () => {
      const { mockDispatch } = setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      act(() => {
        result.current.reuseFromHistory('hist-1');
      });

      expect(result.current.currentPassword).toBe(mockHistoryEntry.password);
      expect(result.current.passwordStrength).toEqual(
        mockHistoryEntry.strength,
      );
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should not crash if history entry not found', () => {
      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      act(() => {
        result.current.reuseFromHistory('non-existent-id');
      });

      expect(result.current.currentPassword).toBe('');
    });
  });

  describe('History Export/Import', () => {
    it('should export history', () => {
      const exportedData = 'exported-history-data';
      (passwordGeneratorService.exportHistory as jest.Mock).mockReturnValue(
        exportedData,
      );

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      const exported = result.current.exportHistory();

      expect(exported).toBe(exportedData);
      expect(passwordGeneratorService.exportHistory).toHaveBeenCalled();
    });

    it('should import history successfully', async () => {
      const importData = 'import-data';
      (passwordGeneratorService.importHistory as jest.Mock).mockReturnValue(
        true,
      );

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      let importResult = false;

      act(() => {
        importResult = result.current.importHistory(importData);
      });

      expect(importResult).toBe(true);
      expect(passwordGeneratorService.importHistory).toHaveBeenCalledWith(
        importData,
      );
    });

    it('should handle import failure', () => {
      const importData = 'invalid-data';
      (passwordGeneratorService.importHistory as jest.Mock).mockReturnValue(
        false,
      );

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      let importResult = false;

      act(() => {
        importResult = result.current.importHistory(importData);
      });

      expect(importResult).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle generic error with fallback message', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockRejectedValue('Unknown error');

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword();
      });

      expect(result.current.generationError).toBe(
        'Failed to generate password',
      );
    });

    it('should clear generation error on new successful attempt', async () => {
      (passwordGeneratorService.generatePassword as jest.Mock)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({
          password: 'SuccessPassword123!',
          strength: mockPasswordStrength,
        });

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      // First call fails
      await act(async () => {
        await result.current.generatePassword();
      });

      expect(result.current.generationError).not.toBeNull();

      // Second call succeeds
      await act(async () => {
        await result.current.generatePassword();
      });

      expect(result.current.generationError).toBeNull();
      expect(result.current.currentPassword).toBe('SuccessPassword123!');
    });
  });

  describe('Console Logging', () => {
    it('should log password generation', async () => {
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockResolvedValue({
        password: 'LoggedPassword123!',
        strength: mockPasswordStrength,
      });

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword();
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log errors', async () => {
      const errorMsg = 'Test error';
      (
        passwordGeneratorService.generatePassword as jest.Mock
      ).mockRejectedValue(new Error(errorMsg));

      setupMocks();

      const { result } = renderHook(() => usePasswordGenerator());

      await act(async () => {
        await result.current.generatePassword();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should maintain separate state for multiple hook instances', () => {
      setupMocks();

      const { result: result1 } = renderHook(() => usePasswordGenerator());
      const { result: result2 } = renderHook(() => usePasswordGenerator());

      expect(result1.current.currentPassword).toBe('');
      expect(result2.current.currentPassword).toBe('');

      // Each instance should be independent
      expect(result1).not.toBe(result2);
    });
  });
});
