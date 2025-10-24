import 'react-native/jest/setup';

// Set up all mocks BEFORE importing rendering utilities
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#ffffff',
      surface: '#f5f5f5',
      border: '#e0e0e0',
      text: '#000000',
      textSecondary: '#666666',
      primary: '#1976d2',
      error: '#d32f2f',
      success: '#388e3c',
    },
  }),
}));

jest.mock('../../utils/passwordUtils', () => ({
  calculatePasswordStrength: jest.fn(() => ({
    score: 3,
    label: 'Strong',
    color: '#4caf50',
    feedback: ['Good password strength'],
  })),
}));

jest.mock('../../services/biometricService', () => ({
  BiometricService: {
    getInstance: jest.fn(() => ({
      authenticateWithBiometrics: jest.fn().mockResolvedValue({
        success: true,
        error: null,
      }),
    })),
  },
}));

jest.mock('../../services/userActivityService', () => ({
  UserActivityService: {
    getInstance: jest.fn(() => ({
      recordUserInteraction: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock(
  '../../components/CategorySelector',
  () =>
    function MockCategorySelector() {
      return null;
    },
);

jest.mock('../../components/QuickPasswordGenerator', () => ({
  QuickPasswordGenerator: function MockQuickPasswordGenerator() {
    return null;
  },
}));

jest.mock(
  '../../components/ConfirmDialog',
  () =>
    function MockConfirmDialog() {
      return null;
    },
);

jest.mock('../../components/TrackedTextInput', () => {
  const React = require('react');
  return {
    TrackedTextInput: React.forwardRef(({ children, ...props }, ref) =>
      React.createElement('TextInput', { ...props, ref }, children),
    ),
  };
});

// Now import testing utilities
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import PasswordForm from '../PasswordForm';
import { calculatePasswordStrength } from '../../utils/passwordUtils';

describe('PasswordForm Component', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnDataChange = jest.fn();

  const mockPasswordEntry = {
    id: 'pass-123',
    title: 'Test Password',
    username: 'testuser',
    password: 'EncryptedPasswordHash',
    website: 'https://example.com',
    notes: 'Test notes',
    category: 'Social',
    isFavorite: false,
    isDecrypted: false,
    customFields: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render without crashing', () => {
      const { getByPlaceholderText } = render(
        <PasswordForm onSave={mockOnSave} onCancel={mockOnCancel} />,
      );

      // Verify basic fields are rendered
      expect(getByPlaceholderText('Enter title')).toBeTruthy();
    });

    it('should initialize with empty form fields', () => {
      const { getByPlaceholderText } = render(
        <PasswordForm onSave={mockOnSave} onCancel={mockOnCancel} />,
      );

      expect(getByPlaceholderText('Enter title')).toHaveDisplayValue('');
      expect(getByPlaceholderText('Enter password')).toHaveDisplayValue('');
    });

    it('should load password data when provided', async () => {
      const { getByDisplayValue } = render(
        <PasswordForm
          password={mockPasswordEntry}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(getByDisplayValue('Test Password')).toBeTruthy();
      });
    });
  });

  describe('Form Field Interactions', () => {
    it('should trigger onDataChange when title is modified', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, 'New Title');

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Title',
          }),
        );
      });
    });

    it('should trigger onDataChange when password is modified', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const passwordInput = getByPlaceholderText('Enter password');
      fireEvent.changeText(passwordInput, 'MyPassword123!');

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            password: 'MyPassword123!',
          }),
        );
      });
    });

    it('should trigger onDataChange when username is modified', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const usernameInput = getByPlaceholderText('Enter username or email');
      fireEvent.changeText(usernameInput, 'user@example.com');

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'user@example.com',
          }),
        );
      });
    });

    it('should trigger onDataChange when website is modified', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const websiteInput = getByPlaceholderText('https://example.com');
      fireEvent.changeText(websiteInput, 'https://newsite.com');

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            website: 'https://newsite.com',
          }),
        );
      });
    });

    it('should trigger onDataChange when notes are modified', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const notesInput = getByPlaceholderText('Additional notes (optional)');
      fireEvent.changeText(notesInput, 'Some notes here');

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            notes: 'Some notes here',
          }),
        );
      });
    });
  });

  describe('Auto-Save Feature', () => {
    it('should call onSave after debounce period when auto-save is enabled', async () => {
      jest.useFakeTimers();

      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableAutoSave={true}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, 'Test Title');

      // Advance past the debounce delay (300ms)
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    it('should not call onSave when auto-save is disabled', async () => {
      jest.useFakeTimers();

      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableAutoSave={false}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, 'Test Title');

      jest.advanceTimersByTime(300);

      expect(mockOnSave).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should debounce rapid field changes', async () => {
      jest.useFakeTimers();

      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          enableAutoSave={true}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');

      // Make rapid changes
      fireEvent.changeText(titleInput, 'T');
      jest.advanceTimersByTime(100);
      fireEvent.changeText(titleInput, 'Te');
      jest.advanceTimersByTime(100);
      fireEvent.changeText(titleInput, 'Test');

      // Should not have called onSave yet
      expect(mockOnSave).not.toHaveBeenCalled();

      // Advance to trigger the save
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        // Should only call once with the final value
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });
  });

  describe('Password Strength Calculation', () => {
    it('should calculate strength for new passwords', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm onSave={mockOnSave} onCancel={mockOnCancel} />,
      );

      const passwordInput = getByPlaceholderText('Enter password');
      fireEvent.changeText(passwordInput, 'SecurePass123!@#');

      await waitFor(() => {
        expect(calculatePasswordStrength).toHaveBeenCalledWith(
          'SecurePass123!@#',
        );
      });
    });

    it('should not calculate strength for encrypted passwords', () => {
      const encryptedEntry = {
        ...mockPasswordEntry,
        isDecrypted: false,
      };

      render(
        <PasswordForm
          password={encryptedEntry}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      // Should not calculate strength for encrypted passwords on load
      expect(calculatePasswordStrength).not.toHaveBeenCalled();
    });
  });

  describe('Data Callback Integration', () => {
    it('should pass correct data structure to onDataChange', async () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, 'Title');

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.any(String),
            username: expect.any(String),
            password: expect.any(String),
            website: expect.any(String),
            notes: expect.any(String),
            category: expect.any(String),
            isFavorite: expect.any(Boolean),
            customFields: expect.any(Array),
            tags: expect.any(Array),
          }),
        );
      });
    });

    it('should handle missing onDataChange callback gracefully', () => {
      const { getByPlaceholderText } = render(
        <PasswordForm onSave={mockOnSave} onCancel={mockOnCancel} />,
      );

      const titleInput = getByPlaceholderText('Enter title');

      expect(() => {
        fireEvent.changeText(titleInput, 'Title');
      }).not.toThrow();
    });
  });

  describe('Props Handling', () => {
    it('should work with minimal required props', () => {
      const { getByPlaceholderText } = render(
        <PasswordForm onSave={mockOnSave} onCancel={mockOnCancel} />,
      );

      expect(getByPlaceholderText('Enter title')).toBeTruthy();
    });

    it('should work with all optional props', () => {
      const { getByPlaceholderText } = render(
        <PasswordForm
          password={mockPasswordEntry}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
          isEditing={true}
          enableAutoSave={true}
          onDecryptPassword={jest.fn()}
        />,
      );

      expect(getByPlaceholderText('Enter title')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle long input text', async () => {
      const longText = 'A'.repeat(1000);

      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, longText);

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            title: longText,
          }),
        );
      });
    });

    it('should handle special characters', async () => {
      const specialText = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';

      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, specialText);

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            title: specialText,
          }),
        );
      });
    });

    it('should handle unicode characters', async () => {
      const unicodeText = '你好世界🌍مرحبا';

      const { getByPlaceholderText } = render(
        <PasswordForm
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onDataChange={mockOnDataChange}
        />,
      );

      const titleInput = getByPlaceholderText('Enter title');
      fireEvent.changeText(titleInput, unicodeText);

      await waitFor(() => {
        expect(mockOnDataChange).toHaveBeenCalledWith(
          expect.objectContaining({
            title: unicodeText,
          }),
        );
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should unmount cleanly', () => {
      const { unmount } = render(
        <PasswordForm onSave={mockOnSave} onCancel={mockOnCancel} />,
      );

      expect(() => unmount()).not.toThrow();
    });

    it('should handle prop updates', async () => {
      const { rerender, getByDisplayValue } = render(
        <PasswordForm
          password={mockPasswordEntry}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(getByDisplayValue('Test Password')).toBeTruthy();
      });

      const newPassword = {
        ...mockPasswordEntry,
        id: 'pass-456', // Change ID to trigger component sync
        title: 'Updated Password',
      };

      rerender(
        <PasswordForm
          password={newPassword}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(getByDisplayValue('Updated Password')).toBeTruthy();
      });
    });
  });
});
