import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface SessionState {
  expired: boolean;
  warning: boolean;
  timeRemaining: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  masterPasswordConfigured: boolean;
  biometricEnabled: boolean;
  session: SessionState;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,
  masterPasswordConfigured: false,
  biometricEnabled: false,
  session: {
    expired: false,
    warning: false,
    timeRemaining: 0,
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: state => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<User>) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isAuthenticated = false;
      state.user = null;
      state.isLoading = false;
      state.error = action.payload;
    },
    logout: state => {
      state.isAuthenticated = false;
      state.user = null;
      state.isLoading = false;
      state.error = null;
      state.masterPasswordConfigured = false;
      state.biometricEnabled = false;
    },
    clearError: state => {
      state.error = null;
    },
    setMasterPasswordConfigured: (state, action: PayloadAction<boolean>) => {
      state.masterPasswordConfigured = action.payload;
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },
    setSessionExpired: (
      state,
      action: PayloadAction<Partial<SessionState>>,
    ) => {
      state.session = { ...state.session, ...action.payload };
    },
    clearSession: state => {
      state.session = {
        expired: false,
        warning: false,
        timeRemaining: 0,
      };
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  clearError,
  setMasterPasswordConfigured,
  setBiometricEnabled,
  setSessionExpired,
  clearSession,
} = authSlice.actions;
export default authSlice.reducer;
