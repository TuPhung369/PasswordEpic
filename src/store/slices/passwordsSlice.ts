import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  website: string;
  notes?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface PasswordsState {
  passwords: PasswordEntry[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
}

const initialState: PasswordsState = {
  passwords: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategory: 'all',
};

const passwordsSlice = createSlice({
  name: 'passwords',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setPasswords: (state, action: PayloadAction<PasswordEntry[]>) => {
      state.passwords = action.payload;
    },
    addPassword: (state, action: PayloadAction<PasswordEntry>) => {
      state.passwords.push(action.payload);
    },
    updatePassword: (state, action: PayloadAction<PasswordEntry>) => {
      const index = state.passwords.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.passwords[index] = action.payload;
      }
    },
    deletePassword: (state, action: PayloadAction<string>) => {
      state.passwords = state.passwords.filter(p => p.id !== action.payload);
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setLoading,
  setPasswords,
  addPassword,
  updatePassword,
  deletePassword,
  setSearchQuery,
  setSelectedCategory,
  setError,
} = passwordsSlice.actions;
export default passwordsSlice.reducer;