import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { PasswordEntry, PasswordCategory } from '../../types/password';
import { encryptedDatabase } from '../../services/encryptedDatabaseService';
import { migratePasswordEntries } from '../../utils/passwordMigration';
import { autofillService } from '../../services/autofillService';

interface PasswordsState {
  passwords: PasswordEntry[];
  categories: PasswordCategory[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
  favorites: PasswordEntry[];
  frequentlyUsed: PasswordEntry[];
}

// Async thunks for encrypted database operations
export const loadPasswords = createAsyncThunk(
  'passwords/loadPasswords',
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      console.log('📖 [Redux] Loading passwords (fully decrypted)');
      const passwords = await encryptedDatabase.getAllPasswordEntries(
        masterPassword,
      );

      // Prepare autofill credentials when passwords are fully loaded and decrypted
      try {
        console.log('🔄 Preparing autofill credentials on full load...');
        await autofillService.prepareCredentialsForAutofill(
          passwords,
          masterPassword,
        );
        console.log('✅ Autofill credentials prepared on full load');
      } catch (autofillError) {
        console.warn(
          '⚠️ Non-critical: Failed to prepare autofill on load:',
          autofillError,
        );
        // Don't fail password load if autofill prep fails
      }

      return passwords;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Load passwords with lazy decryption (password field not decrypted until needed)
export const loadPasswordsLazy = createAsyncThunk(
  'passwords/loadPasswordsLazy',
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      console.log('📖 [Redux] Loading passwords (optimized format)');
      const passwords =
        await encryptedDatabase.getAllPasswordEntriesOptimized();

      // Note: Don't prepare autofill here since passwords are loaded lazily
      // (only metadata loaded, actual passwords not decrypted yet)
      // Autofill prep will happen after all passwords are decrypted

      return passwords;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Decrypt all lazy-loaded passwords and prepare autofill
// Call this after loadPasswordsLazy to populate autofill with all credentials
export const decryptAllAndPrepareAutofill = createAsyncThunk(
  'passwords/decryptAllAndPrepareAutofill',
  async (masterPassword: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const lazyPasswords = state.passwords.passwords || [];

      console.log(
        `🔐 [Redux] Preparing autofill with ${lazyPasswords.length} passwords (encrypted format)...`,
      );

      // 🔐 SECURITY: Do NOT decrypt passwords in Redux!
      // Instead, send lazy-loaded encrypted passwords directly to autofill.
      // autofillService.prepareCredentialsForAutofill will:
      // - If password is encrypted (isDecrypted=false): use as-is
      // - If password is plaintext (isDecrypted=true): encrypt it
      // This way, all credentials sent to Android are encrypted and require
      // biometric verification + decryption in React Native before use.

      try {
        console.log('🔄 Preparing autofill with encrypted passwords...');
        await autofillService.prepareCredentialsForAutofill(
          lazyPasswords,
          masterPassword,
        );
        console.log(
          '✅ Autofill credentials prepared successfully (all encrypted)',
        );
      } catch (autofillError) {
        console.warn(
          '⚠️ Non-critical: Failed to prepare autofill credentials:',
          autofillError,
        );
        // Don't fail the operation if autofill prep fails
      }

      return null;
    } catch (error: any) {
      console.error('❌ Error preparing autofill:', error);
      return rejectWithValue(error.message);
    }
  },
);

// Decrypt a single password field on-demand
export const decryptPasswordField = createAsyncThunk(
  'passwords/decryptPasswordField',
  async (
    { id, masterPassword }: { id: string; masterPassword: string },
    { rejectWithValue },
  ) => {
    try {
      console.log(`🔓 [Redux] Decrypting password for ${id}`);
      const password = await encryptedDatabase.decryptPasswordFieldOptimized(
        id,
        masterPassword,
      );

      return { id, password };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const savePassword = createAsyncThunk(
  'passwords/savePassword',
  async (
    { entry, masterPassword }: { entry: PasswordEntry; masterPassword: string },
    { rejectWithValue, getState },
  ) => {
    try {
      console.log('💾 [Redux] Saving password');
      await encryptedDatabase.savePasswordEntryOptimized(entry, masterPassword);

      // 🔐 CRITICAL: Reload entry from database to get IV/TAG for autofill
      // The entry we saved has IV/TAG in database, but the `entry` object
      // passed in doesn't have those fields populated yet.
      console.log('🔄 Loading saved entry from database to get IV/TAG...');
      const allEntries = await encryptedDatabase.getAllPasswordEntries(
        masterPassword,
      );
      const savedEntry = allEntries.find(e => e.id === entry.id);
      if (!savedEntry) {
        throw new Error('Failed to reload saved password entry');
      }
      console.log(
        `✅ Reloaded entry with IV=${!!savedEntry.passwordIv} TAG=${!!savedEntry.passwordTag}`,
      );

      // Prepare credentials for autofill after saving
      try {
        console.log('🔄 Preparing autofill credentials...');
        // Clear old autofill cache first to ensure updated password replaces old cached value
        try {
          await autofillService.clearCache();
          console.log('✅ Autofill cache cleared');
        } catch (clearError) {
          console.warn('⚠️ Failed to clear autofill cache:', clearError);
          // Continue anyway - not critical
        }
        const state = getState() as any;
        const allPasswords = state.passwords.passwords || [];
        // Include the newly saved entry with full IV/TAG context
        const allPasswordsWithNew = allPasswords.filter(p => p.id !== entry.id);
        allPasswordsWithNew.push(savedEntry);
        await autofillService.prepareCredentialsForAutofill(
          allPasswordsWithNew,
          masterPassword,
        );
        console.log('✅ Autofill credentials prepared');
      } catch (autofillError) {
        console.warn(
          '⚠️ Non-critical: Failed to prepare autofill:',
          autofillError,
        );
        // Don't fail password save if autofill prep fails
      }

      return savedEntry;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const removePassword = createAsyncThunk(
  'passwords/removePassword',
  async (id: string, { rejectWithValue }) => {
    try {
      console.log(`🗑️ [Redux] Deleting password ${id}`);
      await encryptedDatabase.deletePasswordEntryOptimized(id);

      return id;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const searchPasswords = createAsyncThunk(
  'passwords/searchPasswords',
  async (
    { query, masterPassword }: { query: string; masterPassword: string },
    { rejectWithValue },
  ) => {
    try {
      const passwords = await encryptedDatabase.searchPasswordEntries(
        query,
        masterPassword,
      );
      return passwords;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const loadCategories = createAsyncThunk(
  'passwords/loadCategories',
  async (_, { rejectWithValue }) => {
    try {
      const categories = await encryptedDatabase.getAllCategories();
      return categories;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const loadFavorites = createAsyncThunk(
  'passwords/loadFavorites',
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      const favorites = await encryptedDatabase.getFavoriteEntries(
        masterPassword,
      );
      return favorites;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const loadFrequentlyUsed = createAsyncThunk(
  'passwords/loadFrequentlyUsed',
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      const frequentlyUsed = await encryptedDatabase.getFrequentlyUsedEntries(
        masterPassword,
      );
      return frequentlyUsed;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const initialState: PasswordsState = {
  passwords: [],
  categories: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategory: 'all',
  favorites: [],
  frequentlyUsed: [],
};

const passwordsSlice = createSlice({
  name: 'passwords',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
    },
    clearError: state => {
      state.error = null;
    },
    clearPasswords: state => {
      state.passwords = [];
      state.favorites = [];
      state.frequentlyUsed = [];
      state.categories = [];
    },
    updatePasswordLastUsed: (state, action: PayloadAction<string>) => {
      const passwordId = action.payload;
      const passwordEntry = state.passwords.find(p => p.id === passwordId);
      if (passwordEntry) {
        console.log(
          '🔄 [Redux] Updating lastUsed for password:',
          passwordId,
          'to',
          new Date(),
        );
        passwordEntry.lastUsed = new Date();
        console.log(
          '✅ [Redux] Updated. lastUsed is now:',
          passwordEntry.lastUsed,
        );
      } else {
        console.warn('⚠️ [Redux] Password not found:', passwordId);
      }
    },
  },
  extraReducers: builder => {
    // Load passwords
    builder
      .addCase(loadPasswords.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadPasswords.fulfilled, (state, action) => {
        state.isLoading = false;
        // Migrate passwords to include passwordHistory and auditData
        state.passwords = migratePasswordEntries(action.payload);
      })
      .addCase(loadPasswords.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Load passwords lazy (password field not decrypted)
    builder
      .addCase(loadPasswordsLazy.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadPasswordsLazy.fulfilled, (state, action) => {
        state.isLoading = false;
        // Migrate passwords to include passwordHistory and auditData
        state.passwords = migratePasswordEntries(action.payload);
      })
      .addCase(loadPasswordsLazy.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Decrypt password field on-demand
    builder.addCase(decryptPasswordField.fulfilled, (state, action) => {
      const { id, password } = action.payload;
      const passwordEntry = state.passwords.find(p => p.id === id);
      if (passwordEntry && password) {
        passwordEntry.password = password;
        passwordEntry.isDecrypted = true; // Mark as decrypted
      }
    });

    // Save password
    builder
      .addCase(savePassword.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(savePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        const existingIndex = state.passwords.findIndex(
          p => p.id === action.payload.id,
        );
        if (existingIndex !== -1) {
          state.passwords[existingIndex] = action.payload;
        } else {
          state.passwords.push(action.payload);
        }
      })
      .addCase(savePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Remove password
    builder
      .addCase(removePassword.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.passwords = state.passwords.filter(p => p.id !== action.payload);
        state.favorites = state.favorites.filter(p => p.id !== action.payload);
        state.frequentlyUsed = state.frequentlyUsed.filter(
          p => p.id !== action.payload,
        );
      })
      .addCase(removePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Search passwords
    builder
      .addCase(searchPasswords.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchPasswords.fulfilled, (state, action) => {
        state.isLoading = false;
        state.passwords = action.payload;
      })
      .addCase(searchPasswords.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Load categories
    builder.addCase(loadCategories.fulfilled, (state, action) => {
      state.categories = action.payload;
    });

    // Load favorites
    builder.addCase(loadFavorites.fulfilled, (state, action) => {
      state.favorites = migratePasswordEntries(action.payload);
    });

    // Load frequently used
    builder.addCase(loadFrequentlyUsed.fulfilled, (state, action) => {
      state.frequentlyUsed = migratePasswordEntries(action.payload);
    });
  },
});

export const {
  setSearchQuery,
  setSelectedCategory,
  clearError,
  clearPasswords,
  updatePasswordLastUsed,
} = passwordsSlice.actions;

export default passwordsSlice.reducer;
