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
        `🔐 [Redux] Decrypting all ${lazyPasswords.length} passwords for autofill...`,
      );

      // Decrypt all passwords
      const fullyDecryptedPasswords = await Promise.all(
        lazyPasswords.map(async (pwd: PasswordEntry) => {
          if (pwd.password && pwd.password.length > 0) {
            // Already decrypted or has a value
            return pwd;
          }
          // Decrypt the password field
          const decrypted =
            await encryptedDatabase.decryptPasswordFieldOptimized(
              pwd.id,
              masterPassword,
            );
          return { ...pwd, password: decrypted };
        }),
      );

      console.log(`✅ All passwords decrypted for autofill`);

      // Prepare autofill with fully decrypted passwords
      try {
        console.log('🔄 Preparing autofill with decrypted passwords...');
        await autofillService.prepareCredentialsForAutofill(
          fullyDecryptedPasswords,
          masterPassword,
        );
        console.log('✅ Autofill credentials prepared successfully');
      } catch (autofillError) {
        console.warn(
          '⚠️ Non-critical: Failed to prepare autofill after decryption:',
          autofillError,
        );
        // Don't fail the operation if autofill prep fails
      }

      return null;
    } catch (error: any) {
      console.error('❌ Error decrypting passwords for autofill:', error);
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

      // Prepare credentials for autofill after saving
      try {
        console.log('🔄 Preparing autofill credentials...');
        const state = getState() as any;
        const allPasswords = state.passwords.passwords || [];
        await autofillService.prepareCredentialsForAutofill(
          allPasswords,
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

      return entry;
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
} = passwordsSlice.actions;

export default passwordsSlice.reducer;
