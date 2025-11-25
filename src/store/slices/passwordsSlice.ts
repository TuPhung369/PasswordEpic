import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { PasswordEntry, PasswordCategory } from '../../types/password';
import { encryptedDatabase } from '../../services/encryptedDatabaseService';
import {
  migratePasswordEntries,
  migratePasswordEntry,
} from '../../utils/passwordMigration';
import { autofillService } from '../../services/autofillService';
import { AuditHistoryService } from '../../services/auditHistoryService';
import { sessionCache } from '../../utils/sessionCache';

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

      // Load latest audit data for each password
      const passwordsWithAudit = await Promise.all(
        passwords.map(async password => {
          try {
            const latestAudit = await AuditHistoryService.getLatestAudit(
              password.id,
            );
            if (latestAudit) {
              return {
                ...password,
                auditData: {
                  ...password.auditData,
                  securityScore: latestAudit.score,
                  lastAuditDate: latestAudit.date,
                  passwordStrength: latestAudit.passwordStrength,
                  duplicateCount: password.auditData?.duplicateCount ?? 0,
                  compromisedCount: password.auditData?.compromisedCount ?? 0,
                  lastPasswordChange:
                    password.auditData?.lastPasswordChange ?? latestAudit.date,
                },
              };
            }
          } catch (auditError) {
            console.warn(
              `⚠️ Failed to load audit data for password ${password.id}:`,
              auditError,
            );
          }
          return password;
        }),
      );

      // Prepare autofill credentials when passwords are fully loaded and decrypted
      try {
        console.log('🔄 Preparing autofill credentials on full load...');
        await autofillService.prepareCredentialsForAutofill(
          passwordsWithAudit,
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

      return passwordsWithAudit;
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

      // Load latest audit data for each password
      const passwordsWithAudit = await Promise.all(
        passwords.map(async password => {
          try {
            const latestAudit = await AuditHistoryService.getLatestAudit(
              password.id,
            );
            if (latestAudit) {
              return {
                ...password,
                auditData: {
                  ...password.auditData,
                  securityScore: latestAudit.score,
                  lastAuditDate: latestAudit.date,
                  passwordStrength: latestAudit.passwordStrength,
                  duplicateCount: password.auditData?.duplicateCount ?? 0,
                  compromisedCount: password.auditData?.compromisedCount ?? 0,
                  lastPasswordChange:
                    password.auditData?.lastPasswordChange ?? latestAudit.date,
                },
              };
            }
          } catch (auditError) {
            console.warn(
              `⚠️ Failed to load audit data for password ${password.id}:`,
              auditError,
            );
          }
          return password;
        }),
      );

      // Note: Don't prepare autofill here since passwords are loaded lazily
      // (only metadata loaded, actual passwords not decrypted yet)
      // Autofill prep will happen after all passwords are decrypted

      return passwordsWithAudit;
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
      const hasValidMasterPassword =
        masterPassword && masterPassword.length > 0;
      console.log('💾 [Redux] Saving password', {
        hasMasterPassword: hasValidMasterPassword,
        isMetadataOnly: !hasValidMasterPassword,
      });

      const encryptionMetadata =
        await encryptedDatabase.savePasswordEntryOptimized(
          entry,
          masterPassword,
        );

      // 🔐 Create savedEntry with IV/TAG from returned metadata
      // No need to reload from database - we already have the encryption metadata
      const savedEntry: PasswordEntry = {
        ...entry,
        passwordIv: encryptionMetadata.iv,
        passwordTag: encryptionMetadata.tag,
        passwordSalt: encryptionMetadata.salt,
        isDecrypted: entry.isDecrypted ?? true,
      };
      console.log(
        `✅ Saved entry with IV=${!!savedEntry.passwordIv} TAG=${!!savedEntry.passwordTag}`,
      );

      // ⚠️ NOTE: auditData is already in entry (from AddPasswordScreen calculation)
      // Do NOT load from AuditHistoryService here because:
      // 1. For new passwords: audit history hasn't been saved yet (race condition)
      // 2. For updates: we want to preserve the audit data passed in
      // Audit history will be saved separately by AddPasswordScreen after this function returns
      if (!savedEntry.auditData && entry.auditData) {
        Object.assign(savedEntry, {
          auditData: entry.auditData,
        });
        console.log(
          `✅ Preserved auditData from entry: score=${entry.auditData.securityScore}`,
        );
      } else if (savedEntry.auditData) {
        console.log(
          `✅ auditData preserved from entry spread: score=${savedEntry.auditData.securityScore}`,
        );
      }

      // Prepare credentials for autofill after saving
      // Always update autofill to ensure metadata changes (username, website, title) are synced
      try {
        console.log('🔄 Preparing autofill credentials...');
        // Clear old autofill cache first to ensure updated entry replaces old cached value
        try {
          await autofillService.clearCache();
          console.log('✅ Autofill cache cleared');
        } catch (cacheClrError) {
          console.warn('⚠️ Failed to clear autofill cache:', cacheClrError);
          // Continue anyway - not critical
        }

        // Get master password for autofill - use provided or get from session cache
        let autofillMasterPassword = masterPassword;
        if (!hasValidMasterPassword) {
          console.log(
            '🔐 [Autofill] No master password provided, getting from session cache...',
          );
          try {
            // Try to get from session cache (set after PIN/biometric unlock)
            const cachedStaticMP = sessionCache.get<string>(
              'staticMasterPassword',
            );
            const cachedDynamicMP = sessionCache.get<string>(
              'dynamicMasterPassword',
            );

            if (cachedStaticMP) {
              autofillMasterPassword = cachedStaticMP;
              console.log(
                '✅ [Autofill] Got master password from static session cache',
              );
            } else if (cachedDynamicMP) {
              autofillMasterPassword = cachedDynamicMP;
              console.log(
                '✅ [Autofill] Got master password from dynamic session cache',
              );
            } else {
              console.log(
                '⚠️ [Autofill] No cached master password available, skipping autofill update',
              );
            }
          } catch (mpError) {
            console.warn(
              '⚠️ [Autofill] Failed to get master password from cache:',
              mpError,
            );
          }
        }

        if (autofillMasterPassword && autofillMasterPassword.length > 0) {
          const state = getState() as any;
          const allPasswords = state.passwords.passwords || [];
          // Include the newly saved entry with full IV/TAG context
          const allPasswordsWithNew = allPasswords.filter(
            (p: PasswordEntry) => p.id !== entry.id,
          );
          allPasswordsWithNew.push(savedEntry);
          await autofillService.prepareCredentialsForAutofill(
            allPasswordsWithNew,
            autofillMasterPassword,
          );
          console.log('✅ Autofill credentials prepared');
        }
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
    updatePasswordAuditData: (
      state,
      action: PayloadAction<{
        passwordId: string;
        auditData: PasswordEntry['auditData'];
      }>,
    ) => {
      const { passwordId, auditData } = action.payload;
      const passwordEntry = state.passwords.find(p => p.id === passwordId);
      if (passwordEntry && auditData) {
        console.log(
          '🔄 [Redux] Updating auditData for password:',
          passwordId,
          'securityScore:',
          auditData.securityScore,
        );
        passwordEntry.auditData = auditData;
        console.log(
          '✅ [Redux] Updated. securityScore is now:',
          auditData.securityScore,
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
        const payload = action.payload;

        // Only migrate if necessary (old data without auditData)
        // If payload has auditData, it was already calculated from plaintext during create/update
        const finalPayload = payload.auditData
          ? payload
          : migratePasswordEntry(payload);

        const existingIndex = state.passwords.findIndex(
          p => p.id === finalPayload.id,
        );
        if (existingIndex !== -1) {
          state.passwords[existingIndex] = finalPayload;
        } else {
          state.passwords.push(finalPayload);
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
  updatePasswordAuditData,
} = passwordsSlice.actions;

export default passwordsSlice.reducer;
