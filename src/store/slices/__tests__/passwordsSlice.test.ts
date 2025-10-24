import passwordsReducer, {
  setSearchQuery,
  setSelectedCategory,
  clearError,
  clearPasswords,
  loadPasswords,
  loadPasswordsLazy,
  decryptAllAndPrepareAutofill,
  decryptPasswordField,
  savePassword,
  removePassword,
  searchPasswords,
  loadCategories,
  loadFavorites,
  loadFrequentlyUsed,
} from '../passwordsSlice';
import { configureStore } from '@reduxjs/toolkit';

// Mock the services
jest.mock('../../../services/encryptedDatabaseService');
jest.mock('../../../services/autofillService');
jest.mock('../../../utils/passwordMigration');

import { encryptedDatabase } from '../../../services/encryptedDatabaseService';
import { autofillService } from '../../../services/autofillService';
import { migratePasswordEntries } from '../../../utils/passwordMigration';

describe('passwordsSlice', () => {
  const initialState = {
    passwords: [],
    categories: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    selectedCategory: 'all',
    favorites: [],
    frequentlyUsed: [],
  };

  const mockPasswordEntry = {
    id: 'pwd1',
    domain: 'example.com',
    username: 'user@example.com',
    password: 'encrypted_password',
    isDecrypted: false,
    category: 'social',
    tags: ['important'],
    createdAt: new Date(),
    updatedAt: new Date(),
    isFavorite: false,
    frequency: 5,
    passwordHistory: [],
    auditData: {
      lastViewedAt: null,
      viewCount: 0,
      compromisedWarning: false,
    },
  };

  const mockCategory = {
    id: 'cat1',
    name: 'Social Media',
    icon: 'share-2',
    color: '#FF6B6B',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (migratePasswordEntries as jest.Mock).mockImplementation(pwd => pwd);
  });

  // Reducer Tests
  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const state = passwordsReducer(initialState, setSearchQuery('gmail'));
      expect(state.searchQuery).toBe('gmail');
    });

    it('should handle empty search query', () => {
      const stateWithQuery = { ...initialState, searchQuery: 'test' };
      const state = passwordsReducer(stateWithQuery, setSearchQuery(''));
      expect(state.searchQuery).toBe('');
    });

    it('should update search query multiple times', () => {
      let state = passwordsReducer(initialState, setSearchQuery('face'));
      expect(state.searchQuery).toBe('face');

      state = passwordsReducer(state, setSearchQuery('gmail'));
      expect(state.searchQuery).toBe('gmail');

      state = passwordsReducer(state, setSearchQuery(''));
      expect(state.searchQuery).toBe('');
    });
  });

  describe('setSelectedCategory', () => {
    it('should update selected category', () => {
      const state = passwordsReducer(initialState, setSelectedCategory('work'));
      expect(state.selectedCategory).toBe('work');
    });

    it('should handle "all" category', () => {
      let state = passwordsReducer(initialState, setSelectedCategory('social'));
      state = passwordsReducer(state, setSelectedCategory('all'));
      expect(state.selectedCategory).toBe('all');
    });

    it('should support category switching', () => {
      let state = passwordsReducer(initialState, setSelectedCategory('social'));
      expect(state.selectedCategory).toBe('social');

      state = passwordsReducer(state, setSelectedCategory('work'));
      expect(state.selectedCategory).toBe('work');
    });
  });

  describe('clearError', () => {
    it('should clear error message', () => {
      const stateWithError = {
        ...initialState,
        error: 'Failed to load passwords',
      };
      const state = passwordsReducer(stateWithError, clearError());
      expect(state.error).toBeNull();
    });

    it('should not affect other state', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error',
        searchQuery: 'test',
      };
      const state = passwordsReducer(stateWithError, clearError());
      expect(state.error).toBeNull();
      expect(state.searchQuery).toBe('test');
    });
  });

  describe('clearPasswords', () => {
    it('should clear all password data', () => {
      const fullState = {
        passwords: [mockPasswordEntry],
        categories: [mockCategory],
        isLoading: false,
        error: null,
        searchQuery: 'test',
        selectedCategory: 'social',
        favorites: [mockPasswordEntry],
        frequentlyUsed: [mockPasswordEntry],
      };
      const state = passwordsReducer(fullState, clearPasswords());

      expect(state.passwords).toEqual([]);
      expect(state.categories).toEqual([]);
      expect(state.favorites).toEqual([]);
      expect(state.frequentlyUsed).toEqual([]);
    });

    it('should preserve other state properties', () => {
      const fullState = {
        ...initialState,
        searchQuery: 'test',
        selectedCategory: 'work',
        isLoading: true,
        error: 'Some error',
      };
      const state = passwordsReducer(fullState, clearPasswords());

      expect(state.searchQuery).toBe('test');
      expect(state.selectedCategory).toBe('work');
      expect(state.isLoading).toBe(true);
      expect(state.error).toBe('Some error');
    });
  });

  // Async Thunks - loadPasswords
  describe('loadPasswords async thunk', () => {
    it('should handle pending state', () => {
      const action = {
        type: loadPasswords.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', () => {
      const passwords = [mockPasswordEntry];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      const action = {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.passwords).toEqual(passwords);
      expect(state.error).toBeNull();
    });

    it('should handle rejected state', () => {
      const error = 'Failed to decrypt passwords';
      const action = {
        type: loadPasswords.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.passwords).toEqual([]);
    });

    it('should migrate passwords on load', () => {
      const passwords = [mockPasswordEntry];
      const migratedPasswords = [{ ...mockPasswordEntry, passwordHistory: [] }];
      (migratePasswordEntries as jest.Mock).mockReturnValue(migratedPasswords);

      const action = {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      };
      const state = passwordsReducer(initialState, action);

      expect(migratePasswordEntries).toHaveBeenCalledWith(passwords);
      expect(state.passwords).toEqual(migratedPasswords);
    });
  });

  // Async Thunks - loadPasswordsLazy
  describe('loadPasswordsLazy async thunk', () => {
    it('should handle pending state', () => {
      const action = {
        type: loadPasswordsLazy.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', () => {
      const passwords = [{ ...mockPasswordEntry, password: '' }];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      const action = {
        type: loadPasswordsLazy.fulfilled.type,
        payload: passwords,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.passwords).toEqual(passwords);
    });

    it('should handle rejected state', () => {
      const error = 'Failed to load passwords';
      const action = {
        type: loadPasswordsLazy.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  // Async Thunks - decryptPasswordField
  describe('decryptPasswordField async thunk', () => {
    it('should update password when fulfilled', () => {
      const stateWithPasswords = {
        ...initialState,
        passwords: [mockPasswordEntry],
      };
      const decrypted = 'decrypted_password';

      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: decrypted },
      };
      const state = passwordsReducer(stateWithPasswords, action);

      expect(state.passwords[0].password).toBe(decrypted);
      expect(state.passwords[0].isDecrypted).toBe(true);
    });

    it('should not update non-existing password', () => {
      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'non-existing', password: 'decrypted' },
      };
      const state = passwordsReducer(initialState, action);

      expect(state.passwords).toEqual([]);
    });

    it('should handle multiple password decryptions', () => {
      const pwd1 = { ...mockPasswordEntry, id: 'pwd1', password: '' };
      const pwd2 = {
        ...mockPasswordEntry,
        id: 'pwd2',
        password: '',
      };
      const stateWithPasswords = {
        ...initialState,
        passwords: [pwd1, pwd2],
      };

      let state = passwordsReducer(stateWithPasswords, {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: 'decrypted1' },
      });
      expect(state.passwords[0].password).toBe('decrypted1');

      state = passwordsReducer(state, {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd2', password: 'decrypted2' },
      });
      expect(state.passwords[1].password).toBe('decrypted2');
    });
  });

  // Async Thunks - savePassword
  describe('savePassword async thunk', () => {
    it('should handle pending state', () => {
      const action = {
        type: savePassword.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should add new password', () => {
      const action = {
        type: savePassword.fulfilled.type,
        payload: mockPasswordEntry,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.passwords).toContainEqual(mockPasswordEntry);
    });

    it('should update existing password', () => {
      const stateWithPassword = {
        ...initialState,
        passwords: [mockPasswordEntry],
      };
      const updatedPassword = {
        ...mockPasswordEntry,
        username: 'updated@example.com',
      };

      const action = {
        type: savePassword.fulfilled.type,
        payload: updatedPassword,
      };
      const state = passwordsReducer(stateWithPassword, action);

      expect(state.passwords).toHaveLength(1);
      expect(state.passwords[0].username).toBe('updated@example.com');
    });

    it('should handle save failure', () => {
      const error = 'Failed to save password';
      const action = {
        type: savePassword.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  // Async Thunks - removePassword
  describe('removePassword async thunk', () => {
    it('should handle pending state', () => {
      const action = {
        type: removePassword.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should remove password from list', () => {
      const stateWithPasswords = {
        ...initialState,
        passwords: [mockPasswordEntry],
      };

      const action = {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      };
      const state = passwordsReducer(stateWithPasswords, action);

      expect(state.isLoading).toBe(false);
      expect(state.passwords).toHaveLength(0);
    });

    it('should remove from favorites', () => {
      const stateWithFavorite = {
        ...initialState,
        passwords: [mockPasswordEntry],
        favorites: [mockPasswordEntry],
      };

      const action = {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      };
      const state = passwordsReducer(stateWithFavorite, action);

      expect(state.favorites).toHaveLength(0);
    });

    it('should remove from frequently used', () => {
      const stateWithFrequent = {
        ...initialState,
        passwords: [mockPasswordEntry],
        frequentlyUsed: [mockPasswordEntry],
      };

      const action = {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      };
      const state = passwordsReducer(stateWithFrequent, action);

      expect(state.frequentlyUsed).toHaveLength(0);
    });

    it('should remove from all locations', () => {
      const stateWithAll = {
        ...initialState,
        passwords: [mockPasswordEntry],
        favorites: [mockPasswordEntry],
        frequentlyUsed: [mockPasswordEntry],
      };

      const action = {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      };
      const state = passwordsReducer(stateWithAll, action);

      expect(state.passwords).toHaveLength(0);
      expect(state.favorites).toHaveLength(0);
      expect(state.frequentlyUsed).toHaveLength(0);
    });

    it('should handle removal failure', () => {
      const error = 'Failed to remove password';
      const action = {
        type: removePassword.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  // Async Thunks - searchPasswords
  describe('searchPasswords async thunk', () => {
    it('should handle pending state', () => {
      const action = {
        type: searchPasswords.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should update passwords with search results', () => {
      const searchResults = [
        {
          ...mockPasswordEntry,
          domain: 'gmail.com',
        },
      ];

      const action = {
        type: searchPasswords.fulfilled.type,
        payload: searchResults,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.passwords).toEqual(searchResults);
    });

    it('should handle empty search results', () => {
      const action = {
        type: searchPasswords.fulfilled.type,
        payload: [],
      };
      const state = passwordsReducer(initialState, action);

      expect(state.passwords).toEqual([]);
    });

    it('should handle search failure', () => {
      const error = 'Search failed';
      const action = {
        type: searchPasswords.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  // Async Thunks - loadCategories
  describe('loadCategories async thunk', () => {
    it('should load categories', () => {
      const categories = [mockCategory];

      const action = {
        type: loadCategories.fulfilled.type,
        payload: categories,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.categories).toEqual(categories);
    });

    it('should handle multiple categories', () => {
      const categories = [
        mockCategory,
        { ...mockCategory, id: 'cat2', name: 'Work' },
      ];

      const action = {
        type: loadCategories.fulfilled.type,
        payload: categories,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.categories).toHaveLength(2);
    });
  });

  // Async Thunks - loadFavorites
  describe('loadFavorites async thunk', () => {
    it('should load favorites', () => {
      const favorites = [mockPasswordEntry];
      (migratePasswordEntries as jest.Mock).mockReturnValue(favorites);

      const action = {
        type: loadFavorites.fulfilled.type,
        payload: favorites,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.favorites).toEqual(favorites);
    });

    it('should migrate favorites', () => {
      const favorites = [mockPasswordEntry];
      const migratedFavorites = [{ ...mockPasswordEntry, isFavorite: true }];
      (migratePasswordEntries as jest.Mock).mockReturnValue(migratedFavorites);

      const action = {
        type: loadFavorites.fulfilled.type,
        payload: favorites,
      };
      const state = passwordsReducer(initialState, action);

      expect(migratePasswordEntries).toHaveBeenCalledWith(favorites);
      expect(state.favorites).toEqual(migratedFavorites);
    });
  });

  // Async Thunks - loadFrequentlyUsed
  describe('loadFrequentlyUsed async thunk', () => {
    it('should load frequently used', () => {
      const frequent = [mockPasswordEntry];
      (migratePasswordEntries as jest.Mock).mockReturnValue(frequent);

      const action = {
        type: loadFrequentlyUsed.fulfilled.type,
        payload: frequent,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.frequentlyUsed).toEqual(frequent);
    });

    it('should handle multiple frequently used entries', () => {
      const frequent = [
        mockPasswordEntry,
        { ...mockPasswordEntry, id: 'pwd2', domain: 'google.com' },
      ];
      (migratePasswordEntries as jest.Mock).mockReturnValue(frequent);

      const action = {
        type: loadFrequentlyUsed.fulfilled.type,
        payload: frequent,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.frequentlyUsed).toHaveLength(2);
    });
  });

  // Async Thunks - decryptAllAndPrepareAutofill
  describe('decryptAllAndPrepareAutofill async thunk', () => {
    it('should handle fulfilled state without error', () => {
      const action = {
        type: decryptAllAndPrepareAutofill.fulfilled.type,
        payload: null,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should not have extra handlers for pending and rejected states', () => {
      // Note: decryptAllAndPrepareAutofill only has a fulfilled handler in the slice
      // The pending and rejected states don't update the reducer
      const pendingAction = {
        type: decryptAllAndPrepareAutofill.pending.type,
      };
      const state = passwordsReducer(initialState, pendingAction);

      // State remains unchanged since no handler is defined
      expect(state).toEqual(initialState);
    });
  });

  // Async Thunks - loadCategories (pending/rejected)
  describe('loadCategories async thunk - extended', () => {
    it('should handle pending state', () => {
      const action = {
        type: loadCategories.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      // loadCategories.pending doesn't have a handler
      expect(state.categories).toEqual([]);
    });

    it('should handle rejected state', () => {
      const error = 'Failed to load categories';
      const action = {
        type: loadCategories.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);
      // loadCategories.rejected doesn't have a handler
      expect(state.categories).toEqual([]);
    });

    it('should replace categories on new load', () => {
      const oldCategories = [mockCategory];
      const stateWithOldCategories = {
        ...initialState,
        categories: oldCategories,
      };

      const newCategories = [
        { ...mockCategory, id: 'cat2', name: 'Work' },
        { ...mockCategory, id: 'cat3', name: 'Finance' },
      ];

      const action = {
        type: loadCategories.fulfilled.type,
        payload: newCategories,
      };
      const state = passwordsReducer(stateWithOldCategories, action);

      expect(state.categories).toEqual(newCategories);
      expect(state.categories).toHaveLength(2);
    });

    it('should handle empty categories list', () => {
      const action = {
        type: loadCategories.fulfilled.type,
        payload: [],
      };
      const state = passwordsReducer(initialState, action);

      expect(state.categories).toEqual([]);
    });
  });

  // Async Thunks - loadFavorites (pending/rejected)
  describe('loadFavorites async thunk - extended', () => {
    it('should handle pending state', () => {
      const action = {
        type: loadFavorites.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      // loadFavorites.pending doesn't have a handler
      expect(state.favorites).toEqual([]);
    });

    it('should handle rejected state', () => {
      const error = 'Failed to load favorites';
      const action = {
        type: loadFavorites.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);
      // loadFavorites.rejected doesn't have a handler
      expect(state.favorites).toEqual([]);
    });

    it('should replace existing favorites', () => {
      const oldFavorite = { ...mockPasswordEntry, id: 'pwd1' };
      const stateWithOldFavorites = {
        ...initialState,
        favorites: [oldFavorite],
      };

      const newFavorites = [
        { ...mockPasswordEntry, id: 'pwd2', domain: 'new.com' },
        { ...mockPasswordEntry, id: 'pwd3', domain: 'another.com' },
      ];
      (migratePasswordEntries as jest.Mock).mockReturnValue(newFavorites);

      const action = {
        type: loadFavorites.fulfilled.type,
        payload: newFavorites,
      };
      const state = passwordsReducer(stateWithOldFavorites, action);

      expect(state.favorites).toHaveLength(2);
      expect(state.favorites[0].id).toBe('pwd2');
    });

    it('should handle empty favorites', () => {
      (migratePasswordEntries as jest.Mock).mockReturnValue([]);

      const action = {
        type: loadFavorites.fulfilled.type,
        payload: [],
      };
      const state = passwordsReducer(initialState, action);

      expect(state.favorites).toEqual([]);
    });
  });

  // Async Thunks - loadFrequentlyUsed (pending/rejected)
  describe('loadFrequentlyUsed async thunk - extended', () => {
    it('should handle pending state', () => {
      const action = {
        type: loadFrequentlyUsed.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      // loadFrequentlyUsed.pending doesn't have a handler
      expect(state.frequentlyUsed).toEqual([]);
    });

    it('should handle rejected state', () => {
      const error = 'Failed to load frequently used';
      const action = {
        type: loadFrequentlyUsed.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);
      // loadFrequentlyUsed.rejected doesn't have a handler
      expect(state.frequentlyUsed).toEqual([]);
    });

    it('should replace existing frequently used entries', () => {
      const oldFrequent = { ...mockPasswordEntry, id: 'pwd1' };
      const stateWithOldFrequent = {
        ...initialState,
        frequentlyUsed: [oldFrequent],
      };

      const newFrequent = [
        { ...mockPasswordEntry, id: 'pwd2', frequency: 10 },
        { ...mockPasswordEntry, id: 'pwd3', frequency: 8 },
        { ...mockPasswordEntry, id: 'pwd4', frequency: 6 },
      ];
      (migratePasswordEntries as jest.Mock).mockReturnValue(newFrequent);

      const action = {
        type: loadFrequentlyUsed.fulfilled.type,
        payload: newFrequent,
      };
      const state = passwordsReducer(stateWithOldFrequent, action);

      expect(state.frequentlyUsed).toHaveLength(3);
      expect(state.frequentlyUsed[0].frequency).toBe(10);
    });

    it('should handle empty frequently used list', () => {
      (migratePasswordEntries as jest.Mock).mockReturnValue([]);

      const action = {
        type: loadFrequentlyUsed.fulfilled.type,
        payload: [],
      };
      const state = passwordsReducer(initialState, action);

      expect(state.frequentlyUsed).toEqual([]);
    });

    it('should migrate frequently used entries correctly', () => {
      const frequent = [mockPasswordEntry];
      const migratedFrequent = [
        { ...mockPasswordEntry, auditData: { viewCount: 5 } },
      ];
      (migratePasswordEntries as jest.Mock).mockReturnValue(migratedFrequent);

      const action = {
        type: loadFrequentlyUsed.fulfilled.type,
        payload: frequent,
      };
      const state = passwordsReducer(initialState, action);

      expect(migratePasswordEntries).toHaveBeenCalledWith(frequent);
      expect(state.frequentlyUsed).toEqual(migratedFrequent);
    });
  });

  // Async Thunks - decryptPasswordField (pending/rejected)
  describe('decryptPasswordField async thunk - extended', () => {
    it('should handle pending state', () => {
      const action = {
        type: decryptPasswordField.pending.type,
      };
      const state = passwordsReducer(initialState, action);
      // decryptPasswordField.pending doesn't have a handler
      expect(state.isLoading).toBe(false);
    });

    it('should handle rejected state', () => {
      const error = 'Failed to decrypt';
      const action = {
        type: decryptPasswordField.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);
      // decryptPasswordField.rejected doesn't have a handler
      expect(state.error).toBeNull();
    });

    it('should handle decryption with empty password field', () => {
      const stateWithEmptyPassword = {
        ...initialState,
        passwords: [{ ...mockPasswordEntry, password: '' }],
      };

      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: 'decrypted_value' },
      };
      const state = passwordsReducer(stateWithEmptyPassword, action);

      expect(state.passwords[0].password).toBe('decrypted_value');
      expect(state.passwords[0].isDecrypted).toBe(true);
    });

    it('should preserve other password properties during decryption', () => {
      const passwordWithMetadata = {
        ...mockPasswordEntry,
        tags: ['work', 'important'],
        category: 'business',
        isFavorite: true,
      };
      const stateWithPassword = {
        ...initialState,
        passwords: [passwordWithMetadata],
      };

      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: 'secret123' },
      };
      const state = passwordsReducer(stateWithPassword, action);

      expect(state.passwords[0].password).toBe('secret123');
      expect(state.passwords[0].tags).toEqual(['work', 'important']);
      expect(state.passwords[0].category).toBe('business');
      expect(state.passwords[0].isFavorite).toBe(true);
    });

    it('should not create new password if id not found', () => {
      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'unknown-id', password: 'decrypted' },
      };
      const state = passwordsReducer(initialState, action);

      expect(state.passwords).toHaveLength(0);
    });
  });

  // Async Thunks - loadPasswordsLazy (extended)
  describe('loadPasswordsLazy async thunk - extended', () => {
    it('should clear error on pending', () => {
      const stateWithError = {
        ...initialState,
        error: 'Previous error',
        isLoading: false,
      };

      const action = {
        type: loadPasswordsLazy.pending.type,
      };
      const state = passwordsReducer(stateWithError, action);

      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should preserve search query and category during lazy load', () => {
      const stateWithFilters = {
        ...initialState,
        searchQuery: 'gmail',
        selectedCategory: 'social',
      };

      const passwords = [{ ...mockPasswordEntry, password: '' }];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      const action = {
        type: loadPasswordsLazy.fulfilled.type,
        payload: passwords,
      };
      const state = passwordsReducer(stateWithFilters, action);

      expect(state.searchQuery).toBe('gmail');
      expect(state.selectedCategory).toBe('social');
      expect(state.passwords).toEqual(passwords);
    });

    it('should handle multiple lazy loads', () => {
      const passwords1 = [{ ...mockPasswordEntry, id: 'pwd1' }];
      const passwords2 = [{ ...mockPasswordEntry, id: 'pwd2' }];

      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords1);

      let state = passwordsReducer(initialState, {
        type: loadPasswordsLazy.fulfilled.type,
        payload: passwords1,
      });
      expect(state.passwords).toHaveLength(1);

      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords2);
      state = passwordsReducer(state, {
        type: loadPasswordsLazy.fulfilled.type,
        payload: passwords2,
      });
      expect(state.passwords).toHaveLength(1);
      expect(state.passwords[0].id).toBe('pwd2');
    });
  });

  // Edge cases and error handling
  describe('edge cases and error handling', () => {
    it('should handle rapid state changes', () => {
      let state = initialState;

      // Rapid sequence of actions
      state = passwordsReducer(state, setSearchQuery('test'));
      state = passwordsReducer(state, setSelectedCategory('work'));
      state = passwordsReducer(state, {
        type: savePassword.fulfilled.type,
        payload: mockPasswordEntry,
      });
      state = passwordsReducer(state, setSearchQuery('gmail'));
      state = passwordsReducer(state, clearError());

      expect(state.searchQuery).toBe('gmail');
      expect(state.selectedCategory).toBe('work');
      expect(state.passwords).toHaveLength(1);
      expect(state.error).toBeNull();
    });

    it('should handle removing password that exists in multiple arrays', () => {
      const allState = {
        ...initialState,
        passwords: [mockPasswordEntry],
        favorites: [mockPasswordEntry],
        frequentlyUsed: [mockPasswordEntry],
      };

      const action = {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      };
      const state = passwordsReducer(allState, action);

      expect(state.passwords).toHaveLength(0);
      expect(state.favorites).toHaveLength(0);
      expect(state.frequentlyUsed).toHaveLength(0);
    });

    it('should not mutate state during password operations', () => {
      const originalState = { ...initialState, passwords: [mockPasswordEntry] };
      const stateCopy = JSON.parse(JSON.stringify(originalState));

      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: 'new_password' },
      };
      const newState = passwordsReducer(stateCopy, action);

      // Verify immutability - original should differ from new state
      expect(newState.passwords[0].password).not.toBe(
        originalState.passwords[0].password,
      );
    });

    it('should handle state with mixed encrypted/decrypted passwords', () => {
      const mixedPasswords = [
        { ...mockPasswordEntry, id: 'pwd1', password: '', isDecrypted: false },
        {
          ...mockPasswordEntry,
          id: 'pwd2',
          password: 'visible123',
          isDecrypted: true,
        },
        { ...mockPasswordEntry, id: 'pwd3', password: '', isDecrypted: false },
      ];
      const stateWithMixed = {
        ...initialState,
        passwords: mixedPasswords,
      };

      const action = {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: 'decrypted123' },
      };
      const state = passwordsReducer(stateWithMixed, action);

      expect(state.passwords[0].password).toBe('decrypted123');
      expect(state.passwords[0].isDecrypted).toBe(true);
      expect(state.passwords[1].password).toBe('visible123'); // unchanged
      expect(state.passwords[2].password).toBe(''); // unchanged
    });

    it('should clear all password data including error state', () => {
      const fullState = {
        passwords: [mockPasswordEntry, { ...mockPasswordEntry, id: 'pwd2' }],
        categories: [mockCategory],
        isLoading: true,
        error: 'Some error',
        searchQuery: 'query',
        selectedCategory: 'work',
        favorites: [mockPasswordEntry],
        frequentlyUsed: [mockPasswordEntry],
      };

      const state = passwordsReducer(fullState, clearPasswords());

      expect(state.passwords).toEqual([]);
      expect(state.categories).toEqual([]);
      expect(state.favorites).toEqual([]);
      expect(state.frequentlyUsed).toEqual([]);
      // Error and other state should be preserved
      expect(state.isLoading).toBe(true);
      expect(state.error).toBe('Some error');
    });

    it('should handle removing non-existent password gracefully', () => {
      const stateWithPasswords = {
        ...initialState,
        passwords: [mockPasswordEntry],
      };

      const action = {
        type: removePassword.fulfilled.type,
        payload: 'non-existent-id',
      };
      const state = passwordsReducer(stateWithPasswords, action);

      expect(state.passwords).toHaveLength(1); // Still there
      expect(state.passwords[0].id).toBe('pwd1');
    });
  });

  // Additional async handler tests for better coverage
  describe('async handler - rejected states', () => {
    it('should handle loadPasswords.rejected with error message', () => {
      const error = 'Network error';
      const action = {
        type: loadPasswords.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.passwords).toEqual([]);
    });

    it('should handle loadPasswordsLazy.rejected with error', () => {
      const error = 'Optimization error';
      const action = {
        type: loadPasswordsLazy.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should handle savePassword.rejected and preserve data', () => {
      const stateWithData = {
        ...initialState,
        passwords: [mockPasswordEntry],
      };
      const error = 'Database error';
      const action = {
        type: savePassword.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(stateWithData, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.passwords).toHaveLength(1);
    });

    it('should handle removePassword.rejected', () => {
      const stateWithData = {
        ...initialState,
        passwords: [mockPasswordEntry],
      };
      const error = 'Delete error';
      const action = {
        type: removePassword.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(stateWithData, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.passwords).toHaveLength(1);
    });

    it('should handle searchPasswords.rejected', () => {
      const error = 'Search error';
      const action = {
        type: searchPasswords.rejected.type,
        payload: error,
      };
      const state = passwordsReducer(initialState, action);

      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  // State transition tests
  describe('reducer state transitions', () => {
    it('should handle multiple password updates', () => {
      let state = initialState;

      state = passwordsReducer(state, {
        type: savePassword.pending.type,
      });
      expect(state.isLoading).toBe(true);

      state = passwordsReducer(state, {
        type: savePassword.fulfilled.type,
        payload: { ...mockPasswordEntry, id: 'pwd1' },
      });
      expect(state.passwords).toHaveLength(1);

      state = passwordsReducer(state, {
        type: savePassword.pending.type,
      });

      state = passwordsReducer(state, {
        type: savePassword.fulfilled.type,
        payload: { ...mockPasswordEntry, id: 'pwd2', domain: 'google.com' },
      });
      expect(state.passwords).toHaveLength(2);

      state = passwordsReducer(state, {
        type: savePassword.fulfilled.type,
        payload: { ...mockPasswordEntry, id: 'pwd1', username: 'updated' },
      });
      expect(state.passwords).toHaveLength(2);
      expect(state.passwords[0].username).toBe('updated');
    });

    it('should handle load followed by decrypt', () => {
      const passwords = [
        { ...mockPasswordEntry, password: '', isDecrypted: false },
      ];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      let state = passwordsReducer(initialState, {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      });
      expect(state.passwords[0].isDecrypted).toBe(false);

      state = passwordsReducer(state, {
        type: decryptPasswordField.fulfilled.type,
        payload: { id: 'pwd1', password: 'decrypted123' },
      });
      expect(state.passwords[0].isDecrypted).toBe(true);
      expect(state.passwords[0].password).toBe('decrypted123');
    });

    it('should maintain filters through password operations', () => {
      let state = initialState;

      state = passwordsReducer(state, setSearchQuery('gmail'));
      state = passwordsReducer(state, setSelectedCategory('social'));

      state = passwordsReducer(state, {
        type: loadPasswords.fulfilled.type,
        payload: [mockPasswordEntry],
      });
      (migratePasswordEntries as jest.Mock).mockReturnValue([
        mockPasswordEntry,
      ]);

      expect(state.searchQuery).toBe('gmail');
      expect(state.selectedCategory).toBe('social');
      expect(state.passwords).toHaveLength(1);

      state = passwordsReducer(state, {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      });

      expect(state.searchQuery).toBe('gmail');
      expect(state.selectedCategory).toBe('social');
    });

    it('should handle clear and reload cycle', () => {
      const passwords = [mockPasswordEntry];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      let state = {
        ...initialState,
        passwords,
        favorites: [mockPasswordEntry],
        frequentlyUsed: [mockPasswordEntry],
        categories: [mockCategory],
        searchQuery: 'test',
        selectedCategory: 'work',
      };

      state = passwordsReducer(state, clearPasswords());
      expect(state.passwords).toEqual([]);
      expect(state.favorites).toEqual([]);
      expect(state.frequentlyUsed).toEqual([]);
      expect(state.categories).toEqual([]);

      state = passwordsReducer(state, {
        type: loadPasswords.pending.type,
      });
      expect(state.isLoading).toBe(true);

      state = passwordsReducer(state, {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      });
      expect(state.passwords).toHaveLength(1);
      expect(state.isLoading).toBe(false);
    });
  });

  // Complex Scenarios
  describe('complex scenarios', () => {
    it('should handle password workflow: load -> search -> remove', () => {
      const passwords = [
        mockPasswordEntry,
        { ...mockPasswordEntry, id: 'pwd2', domain: 'google.com' },
      ];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      // Load
      let state = passwordsReducer(initialState, {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      });
      expect(state.passwords).toHaveLength(2);

      // Search
      const searchResults = [mockPasswordEntry];
      state = passwordsReducer(state, {
        type: searchPasswords.fulfilled.type,
        payload: searchResults,
      });
      expect(state.passwords).toHaveLength(1);

      // Remove
      state = passwordsReducer(state, {
        type: removePassword.fulfilled.type,
        payload: 'pwd1',
      });
      expect(state.passwords).toHaveLength(0);
    });

    it('should maintain categories and filters after password operations', () => {
      const stateWithFilters = {
        ...initialState,
        categories: [mockCategory],
        selectedCategory: 'social',
        searchQuery: 'gmail',
      };

      const action = {
        type: savePassword.fulfilled.type,
        payload: mockPasswordEntry,
      };
      const state = passwordsReducer(stateWithFilters, action);

      expect(state.categories).toEqual([mockCategory]);
      expect(state.selectedCategory).toBe('social');
      expect(state.searchQuery).toBe('gmail');
    });

    it('should handle clear and reload', () => {
      const passwords = [mockPasswordEntry];
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      let state = passwordsReducer(initialState, {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      });
      expect(state.passwords).toHaveLength(1);

      state = passwordsReducer(state, clearPasswords());
      expect(state.passwords).toEqual([]);

      state = passwordsReducer(state, {
        type: loadPasswords.fulfilled.type,
        payload: passwords,
      });
      expect(state.passwords).toHaveLength(1);
    });
  });

  // Redux store integration tests (thunk execution)
  describe('Redux store integration - thunk dispatch', () => {
    it('should dispatch loadPasswords thunk and update state', async () => {
      const passwords = [mockPasswordEntry];
      (encryptedDatabase.getAllPasswordEntries as jest.Mock).mockResolvedValue(
        passwords,
      );
      (
        autofillService.prepareCredentialsForAutofill as jest.Mock
      ).mockResolvedValue(undefined);
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(loadPasswords('masterPassword123') as any);
      const state = store.getState().passwords;

      expect(state.isLoading).toBe(false);
      expect(state.passwords).toEqual(passwords);
      expect(state.error).toBeNull();
      expect(encryptedDatabase.getAllPasswordEntries).toHaveBeenCalledWith(
        'masterPassword123',
      );
    });

    it('should dispatch loadPasswordsLazy thunk', async () => {
      const passwords = [{ ...mockPasswordEntry, password: '' }];
      (
        encryptedDatabase.getAllPasswordEntriesOptimized as jest.Mock
      ).mockResolvedValue(passwords);
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(loadPasswordsLazy('masterPassword123') as any);
      const state = store.getState().passwords;

      expect(state.passwords).toEqual(passwords);
      expect(state.error).toBeNull();
    });

    it('should dispatch savePassword thunk', async () => {
      (
        encryptedDatabase.savePasswordEntryOptimized as jest.Mock
      ).mockResolvedValue(undefined);
      (
        autofillService.prepareCredentialsForAutofill as jest.Mock
      ).mockResolvedValue(undefined);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(
        savePassword({
          entry: mockPasswordEntry,
          masterPassword: 'password123',
        }) as any,
      );
      const state = store.getState().passwords;

      expect(state.passwords).toContainEqual(mockPasswordEntry);
      expect(state.error).toBeNull();
    });

    it('should dispatch removePassword thunk', async () => {
      (
        encryptedDatabase.deletePasswordEntryOptimized as jest.Mock
      ).mockResolvedValue(undefined);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      const stateWithPassword = {
        passwords: [mockPasswordEntry],
        categories: [],
        isLoading: false,
        error: null,
        searchQuery: '',
        selectedCategory: 'all',
        favorites: [],
        frequentlyUsed: [],
      };

      store.dispatch({ type: 'SET_PASSWORDS', payload: stateWithPassword });

      await store.dispatch(removePassword('pwd1') as any);
      const state = store.getState().passwords;

      expect(state.error).toBeNull();
    });

    it('should dispatch searchPasswords thunk', async () => {
      const searchResults = [mockPasswordEntry];
      (encryptedDatabase.searchPasswordEntries as jest.Mock).mockResolvedValue(
        searchResults,
      );

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(
        searchPasswords({
          query: 'gmail',
          masterPassword: 'password123',
        }) as any,
      );
      const state = store.getState().passwords;

      expect(state.passwords).toEqual(searchResults);
      expect(state.error).toBeNull();
    });

    it('should dispatch loadCategories thunk', async () => {
      const categories = [mockCategory];
      (encryptedDatabase.getAllCategories as jest.Mock).mockResolvedValue(
        categories,
      );

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(loadCategories() as any);
      const state = store.getState().passwords;

      expect(state.categories).toEqual(categories);
    });

    it('should dispatch loadFavorites thunk', async () => {
      const favorites = [mockPasswordEntry];
      (encryptedDatabase.getFavoriteEntries as jest.Mock).mockResolvedValue(
        favorites,
      );
      (migratePasswordEntries as jest.Mock).mockReturnValue(favorites);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(loadFavorites('password123') as any);
      const state = store.getState().passwords;

      expect(state.favorites).toEqual(favorites);
    });

    it('should dispatch loadFrequentlyUsed thunk', async () => {
      const frequent = [mockPasswordEntry];
      (
        encryptedDatabase.getFrequentlyUsedEntries as jest.Mock
      ).mockResolvedValue(frequent);
      (migratePasswordEntries as jest.Mock).mockReturnValue(frequent);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(loadFrequentlyUsed('password123') as any);
      const state = store.getState().passwords;

      expect(state.frequentlyUsed).toEqual(frequent);
    });

    it('should handle thunk error and set error state', async () => {
      const errorMessage = 'Network error';
      (encryptedDatabase.getAllPasswordEntries as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(loadPasswords('wrongPassword') as any);
      const state = store.getState().passwords;

      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });

    it('should dispatch decryptPasswordField thunk', async () => {
      const decryptedPassword = 'decrypted_password_123';
      (
        encryptedDatabase.decryptPasswordFieldOptimized as jest.Mock
      ).mockResolvedValue(decryptedPassword);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      // First load passwords to have something to decrypt
      await store.dispatch(
        savePassword({
          entry: mockPasswordEntry,
          masterPassword: 'password123',
        }) as any,
      );

      // Then decrypt one
      await store.dispatch(
        decryptPasswordField({
          id: 'pwd1',
          masterPassword: 'password123',
        }) as any,
      );

      const state = store.getState().passwords;
      expect(state.error).toBeNull();
    });

    it('should handle decryptPasswordField with error', async () => {
      const errorMessage = 'Decryption key invalid';
      (
        encryptedDatabase.decryptPasswordFieldOptimized as jest.Mock
      ).mockRejectedValue(new Error(errorMessage));

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      await store.dispatch(
        decryptPasswordField({
          id: 'pwd1',
          masterPassword: 'wrong_password',
        }) as any,
      );

      const state = store.getState().passwords;
      // Note: decryptPasswordField doesn't set error on rejection
      expect(state.passwords).toEqual([]);
    });

    it('should dispatch decryptAllAndPrepareAutofill thunk', async () => {
      (
        encryptedDatabase.decryptPasswordFieldOptimized as jest.Mock
      ).mockResolvedValue('decrypted123');
      (
        autofillService.prepareCredentialsForAutofill as jest.Mock
      ).mockResolvedValue(undefined);
      (migratePasswordEntries as jest.Mock).mockReturnValue([
        { ...mockPasswordEntry, password: 'decrypted123' },
      ]);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      // First load lazy passwords
      await store.dispatch(loadPasswordsLazy('password123') as any);

      // Then decrypt all and prepare autofill
      await store.dispatch(decryptAllAndPrepareAutofill('password123') as any);

      const state = store.getState().passwords;
      expect(state.error).toBeNull();
    });

    it('should handle complex workflow: load -> decrypt -> save', async () => {
      const passwords = [
        { ...mockPasswordEntry, password: '', isDecrypted: false },
      ];
      const decryptedPassword = 'super_secret_123';

      (encryptedDatabase.getAllPasswordEntries as jest.Mock).mockResolvedValue(
        passwords,
      );
      (
        autofillService.prepareCredentialsForAutofill as jest.Mock
      ).mockResolvedValue(undefined);
      (
        encryptedDatabase.decryptPasswordFieldOptimized as jest.Mock
      ).mockResolvedValue(decryptedPassword);
      (
        encryptedDatabase.savePasswordEntryOptimized as jest.Mock
      ).mockResolvedValue(undefined);
      (migratePasswordEntries as jest.Mock).mockReturnValue(passwords);

      const store = configureStore({
        reducer: { passwords: passwordsReducer },
      });

      // Load passwords
      await store.dispatch(loadPasswords('password123') as any);
      let state = store.getState().passwords;
      expect(state.passwords).toHaveLength(1);

      // Decrypt one password
      await store.dispatch(
        decryptPasswordField({
          id: 'pwd1',
          masterPassword: 'password123',
        }) as any,
      );

      // Save updated password
      await store.dispatch(
        savePassword({
          entry: { ...mockPasswordEntry, password: decryptedPassword },
          masterPassword: 'password123',
        }) as any,
      );

      state = store.getState().passwords;
      expect(state.passwords).toHaveLength(1);
      expect(state.error).toBeNull();
    });
  });
});
