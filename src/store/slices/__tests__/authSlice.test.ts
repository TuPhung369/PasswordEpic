import authReducer, {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  clearError,
  setMasterPasswordConfigured,
  setBiometricEnabled,
  setSessionExpired,
  clearSession,
} from '../authSlice';

describe('authSlice', () => {
  const initialState = {
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

  describe('loginStart', () => {
    it('should set isLoading to true and clear error', () => {
      const state = authReducer(initialState, loginStart());
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should clear error from previous state', () => {
      const stateWithError = {
        ...initialState,
        error: 'Previous error',
      };
      const state = authReducer(stateWithError, loginStart());
      expect(state.error).toBeNull();
    });
  });

  describe('loginSuccess', () => {
    it('should set user and isAuthenticated to true', () => {
      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      };
      const state = authReducer(initialState, loginSuccess(user));

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(user);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle user without optional fields', () => {
      const user = {
        uid: 'user123',
        email: null,
        displayName: null,
        photoURL: null,
      };
      const state = authReducer(initialState, loginSuccess(user));

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(user);
    });

    it('should override previous user data', () => {
      const oldUser = {
        uid: 'olduid',
        email: 'old@example.com',
        displayName: 'Old User',
        photoURL: null,
      };
      const newUser = {
        uid: 'newuid',
        email: 'new@example.com',
        displayName: 'New User',
        photoURL: 'https://example.com/new.jpg',
      };

      let state = authReducer(initialState, loginSuccess(oldUser));
      state = authReducer(state, loginSuccess(newUser));

      expect(state.user).toEqual(newUser);
      expect(state.user?.uid).toBe('newuid');
    });
  });

  describe('loginFailure', () => {
    it('should set error and clear user', () => {
      const errorMsg = 'Invalid credentials';
      const state = authReducer(initialState, loginFailure(errorMsg));

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(errorMsg);
    });

    it('should handle different error messages', () => {
      const errors = [
        'Network error',
        'Invalid password',
        'User not found',
        'Server error',
      ];

      errors.forEach(error => {
        const state = authReducer(initialState, loginFailure(error));
        expect(state.error).toBe(error);
      });
    });

    it('should clear previous user data on failure', () => {
      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      };
      let state = authReducer(initialState, loginSuccess(user));
      state = authReducer(state, loginFailure('Session expired'));

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Session expired');
    });
  });

  describe('logout', () => {
    it('should reset all auth state', () => {
      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      };
      let state = authReducer(initialState, loginSuccess(user));
      state = authReducer(state, setMasterPasswordConfigured(true));
      state = authReducer(state, setBiometricEnabled(true));

      state = authReducer(state, logout());

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.masterPasswordConfigured).toBe(false);
      expect(state.biometricEnabled).toBe(false);
    });

    it('should maintain initial session state after logout', () => {
      let state = authReducer(
        initialState,
        loginSuccess({
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: null,
        }),
      );
      state = authReducer(state, logout());

      expect(state.session).toEqual({
        expired: false,
        warning: false,
        timeRemaining: 0,
      });
    });
  });

  describe('clearError', () => {
    it('should clear error message', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error occurred',
      };
      const state = authReducer(stateWithError, clearError());
      expect(state.error).toBeNull();
    });

    it('should not affect other state', () => {
      const stateWithError = {
        ...initialState,
        isAuthenticated: true,
        error: 'Some error',
      };
      const state = authReducer(stateWithError, clearError());

      expect(state.error).toBeNull();
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('setMasterPasswordConfigured', () => {
    it('should set masterPasswordConfigured to true', () => {
      const state = authReducer(
        initialState,
        setMasterPasswordConfigured(true),
      );
      expect(state.masterPasswordConfigured).toBe(true);
    });

    it('should set masterPasswordConfigured to false', () => {
      const stateConfigured = {
        ...initialState,
        masterPasswordConfigured: true,
      };
      const state = authReducer(
        stateConfigured,
        setMasterPasswordConfigured(false),
      );
      expect(state.masterPasswordConfigured).toBe(false);
    });

    it('should toggle master password configuration', () => {
      let state = authReducer(initialState, setMasterPasswordConfigured(true));
      expect(state.masterPasswordConfigured).toBe(true);

      state = authReducer(state, setMasterPasswordConfigured(false));
      expect(state.masterPasswordConfigured).toBe(false);
    });
  });

  describe('setBiometricEnabled', () => {
    it('should enable biometric', () => {
      const state = authReducer(initialState, setBiometricEnabled(true));
      expect(state.biometricEnabled).toBe(true);
    });

    it('should disable biometric', () => {
      const stateEnabled = {
        ...initialState,
        biometricEnabled: true,
      };
      const state = authReducer(stateEnabled, setBiometricEnabled(false));
      expect(state.biometricEnabled).toBe(false);
    });

    it('should handle multiple biometric toggles', () => {
      let state = authReducer(initialState, setBiometricEnabled(true));
      expect(state.biometricEnabled).toBe(true);

      state = authReducer(state, setBiometricEnabled(false));
      expect(state.biometricEnabled).toBe(false);

      state = authReducer(state, setBiometricEnabled(true));
      expect(state.biometricEnabled).toBe(true);
    });
  });

  describe('setSessionExpired', () => {
    it('should update session expired status', () => {
      const state = authReducer(
        initialState,
        setSessionExpired({ expired: true }),
      );
      expect(state.session.expired).toBe(true);
      expect(state.session.warning).toBe(false);
      expect(state.session.timeRemaining).toBe(0);
    });

    it('should update session warning', () => {
      const state = authReducer(
        initialState,
        setSessionExpired({ warning: true, timeRemaining: 60 }),
      );
      expect(state.session.warning).toBe(true);
      expect(state.session.timeRemaining).toBe(60);
      expect(state.session.expired).toBe(false);
    });

    it('should partially update session state', () => {
      const state = authReducer(
        initialState,
        setSessionExpired({
          expired: true,
          timeRemaining: 120,
        }),
      );
      expect(state.session.expired).toBe(true);
      expect(state.session.timeRemaining).toBe(120);
      expect(state.session.warning).toBe(false);
    });

    it('should update all session properties', () => {
      const state = authReducer(
        initialState,
        setSessionExpired({
          expired: true,
          warning: true,
          timeRemaining: 30,
        }),
      );
      expect(state.session).toEqual({
        expired: true,
        warning: true,
        timeRemaining: 30,
      });
    });

    it('should handle multiple session updates', () => {
      let state = authReducer(
        initialState,
        setSessionExpired({ warning: true, timeRemaining: 120 }),
      );
      expect(state.session.warning).toBe(true);
      expect(state.session.timeRemaining).toBe(120);

      state = authReducer(
        state,
        setSessionExpired({ expired: true, warning: false }),
      );
      expect(state.session.expired).toBe(true);
      expect(state.session.warning).toBe(false);
      expect(state.session.timeRemaining).toBe(120); // Should preserve
    });
  });

  describe('clearSession', () => {
    it('should reset session to initial state', () => {
      let state = authReducer(
        initialState,
        setSessionExpired({
          expired: true,
          warning: true,
          timeRemaining: 60,
        }),
      );
      state = authReducer(state, clearSession());

      expect(state.session).toEqual({
        expired: false,
        warning: false,
        timeRemaining: 0,
      });
    });

    it('should not affect other auth state', () => {
      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      };
      let state = authReducer(initialState, loginSuccess(user));
      state = authReducer(
        state,
        setSessionExpired({ expired: true, warning: true }),
      );
      state = authReducer(state, clearSession());

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(user);
      expect(state.session).toEqual({
        expired: false,
        warning: false,
        timeRemaining: 0,
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle complete authentication flow', () => {
      let state = authReducer(initialState, loginStart());
      expect(state.isLoading).toBe(true);

      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      };
      state = authReducer(state, loginSuccess(user));
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);

      state = authReducer(state, setMasterPasswordConfigured(true));
      state = authReducer(state, setBiometricEnabled(true));
      expect(state.masterPasswordConfigured).toBe(true);
      expect(state.biometricEnabled).toBe(true);

      state = authReducer(state, logout());
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should handle failed login with recovery', () => {
      let state = authReducer(initialState, loginStart());
      state = authReducer(state, loginFailure('Invalid credentials'));

      expect(state.error).not.toBeNull();
      expect(state.isAuthenticated).toBe(false);

      state = authReducer(state, clearError());
      expect(state.error).toBeNull();

      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
      };
      state = authReducer(state, loginSuccess(user));
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle session expiration warning and timeout', () => {
      let state = authReducer(
        initialState,
        loginSuccess({
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: null,
        }),
      );

      // Session warning
      state = authReducer(
        state,
        setSessionExpired({ warning: true, timeRemaining: 60 }),
      );
      expect(state.session.warning).toBe(true);
      expect(state.session.timeRemaining).toBe(60);

      // Session expired
      state = authReducer(
        state,
        setSessionExpired({ expired: true, warning: false }),
      );
      expect(state.session.expired).toBe(true);

      // Clear session
      state = authReducer(state, clearSession());
      expect(state.session.expired).toBe(false);
    });
  });
});
