import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { PasswordEntry, PasswordCategory } from "../../types/password";
import { encryptedDatabase } from "../../services/encryptedDatabaseService";

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
  "passwords/loadPasswords",
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      const passwords = await encryptedDatabase.getAllPasswordEntries(
        masterPassword
      );
      return passwords;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const savePassword = createAsyncThunk(
  "passwords/savePassword",
  async (
    { entry, masterPassword }: { entry: PasswordEntry; masterPassword: string },
    { rejectWithValue }
  ) => {
    try {
      await encryptedDatabase.savePasswordEntry(entry, masterPassword);
      return entry;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const removePassword = createAsyncThunk(
  "passwords/removePassword",
  async (id: string, { rejectWithValue }) => {
    try {
      await encryptedDatabase.deletePasswordEntry(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const searchPasswords = createAsyncThunk(
  "passwords/searchPasswords",
  async (
    { query, masterPassword }: { query: string; masterPassword: string },
    { rejectWithValue }
  ) => {
    try {
      const passwords = await encryptedDatabase.searchPasswordEntries(
        query,
        masterPassword
      );
      return passwords;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const loadCategories = createAsyncThunk(
  "passwords/loadCategories",
  async (_, { rejectWithValue }) => {
    try {
      const categories = await encryptedDatabase.getAllCategories();
      return categories;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const loadFavorites = createAsyncThunk(
  "passwords/loadFavorites",
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      const favorites = await encryptedDatabase.getFavoriteEntries(
        masterPassword
      );
      return favorites;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const loadFrequentlyUsed = createAsyncThunk(
  "passwords/loadFrequentlyUsed",
  async (masterPassword: string, { rejectWithValue }) => {
    try {
      const frequentlyUsed = await encryptedDatabase.getFrequentlyUsedEntries(
        masterPassword
      );
      return frequentlyUsed;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState: PasswordsState = {
  passwords: [],
  categories: [],
  isLoading: false,
  error: null,
  searchQuery: "",
  selectedCategory: "all",
  favorites: [],
  frequentlyUsed: [],
};

const passwordsSlice = createSlice({
  name: "passwords",
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearPasswords: (state) => {
      state.passwords = [];
      state.favorites = [];
      state.frequentlyUsed = [];
      state.categories = [];
    },
  },
  extraReducers: (builder) => {
    // Load passwords
    builder
      .addCase(loadPasswords.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadPasswords.fulfilled, (state, action) => {
        state.isLoading = false;
        state.passwords = action.payload;
      })
      .addCase(loadPasswords.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Save password
    builder
      .addCase(savePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(savePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        const existingIndex = state.passwords.findIndex(
          (p) => p.id === action.payload.id
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
      .addCase(removePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.passwords = state.passwords.filter(
          (p) => p.id !== action.payload
        );
        state.favorites = state.favorites.filter(
          (p) => p.id !== action.payload
        );
        state.frequentlyUsed = state.frequentlyUsed.filter(
          (p) => p.id !== action.payload
        );
      })
      .addCase(removePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Search passwords
    builder
      .addCase(searchPasswords.pending, (state) => {
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
      state.favorites = action.payload;
    });

    // Load frequently used
    builder.addCase(loadFrequentlyUsed.fulfilled, (state, action) => {
      state.frequentlyUsed = action.payload;
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
