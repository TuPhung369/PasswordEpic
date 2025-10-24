import {
  initializeAuth,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  isSignedIn,
  type AuthResult,
} from '../authService';

// Mock Firebase
jest.mock('../firebase', () => ({
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChange: jest.fn(),
  getCurrentUser: jest.fn(),
}));

// Mock Static Master Password Service
jest.mock('../staticMasterPasswordService', () => ({
  clearStaticMasterPasswordData: jest.fn(),
  generateStaticMasterPassword: jest.fn(),
  verifyStaticMasterPassword: jest.fn(),
}));

// Mock Google Auth Native
jest.mock('../googleAuthNative', () => ({
  signInWithGoogleNative: jest.fn(),
  googleSignOut: jest.fn(),
  isSignedIn: jest.fn(),
}));

describe('AuthService', () => {
  const mockFirebase = require('../firebase');
  const mockStaticMasterPassword = require('../staticMasterPasswordService');
  const mockGoogleAuthNative = require('../googleAuthNative');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Initialization ====================
  describe('initializeAuth', () => {
    it('should initialize successfully', () => {
      const result = initializeAuth();

      expect(result).toBe(true);
    });

    it('should return true on successful initialization', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = initializeAuth();

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Authentication services initialized successfully',
      );

      consoleSpy.mockRestore();
    });
  });

  // ==================== Google Sign-In ====================
  describe('signInWithGoogle', () => {
    const mockGoogleResult = {
      success: true,
      idToken: 'mock_id_token',
      accessToken: 'mock_access_token',
    };

    const mockFirebaseUser = {
      uid: 'user123',
      email: 'user@example.com',
      displayName: 'John Doe',
    };

    const mockFirebaseResult = {
      success: true,
      user: mockFirebaseUser,
    };

    it('should complete sign-in flow successfully', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue(mockFirebaseResult);
      mockStaticMasterPassword.verifyStaticMasterPassword.mockResolvedValue({
        success: false,
        valid: false,
      });
      mockStaticMasterPassword.generateStaticMasterPassword.mockResolvedValue({
        success: true,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockFirebaseUser);
    });

    it('should handle Google Sign-In failure', async () => {
      const googleError = 'Google Sign-In failed';
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue({
        success: false,
        error: googleError,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe(googleError);
    });

    it('should handle missing ID token from Google', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue({
        success: true,
        idToken: null,
        accessToken: 'token',
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No ID token');
    });

    it('should handle Firebase authentication failure', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue({
        success: false,
        error: 'Firebase auth failed',
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firebase auth failed');
    });

    it('should initialize static master password with verification', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue(mockFirebaseResult);
      mockStaticMasterPassword.verifyStaticMasterPassword.mockResolvedValue({
        success: true,
        valid: true,
      });
      mockStaticMasterPassword.generateStaticMasterPassword.mockResolvedValue({
        success: true,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(
        mockStaticMasterPassword.verifyStaticMasterPassword,
      ).toHaveBeenCalled();
      expect(
        mockStaticMasterPassword.generateStaticMasterPassword,
      ).toHaveBeenCalled();
    });

    it('should initialize new static password when none exists', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue(mockFirebaseResult);
      mockStaticMasterPassword.verifyStaticMasterPassword.mockResolvedValue({
        success: false,
      });
      mockStaticMasterPassword.generateStaticMasterPassword.mockResolvedValue({
        success: true,
      });

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(
        mockStaticMasterPassword.generateStaticMasterPassword,
      ).toHaveBeenCalled();
    });

    it('should continue sign-in even if static password initialization fails', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue(mockFirebaseResult);
      mockStaticMasterPassword.generateStaticMasterPassword.mockRejectedValue(
        new Error('Static password init failed'),
      );

      const result = await signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockFirebaseUser);
    });

    it('should handle uncaught exceptions during sign-in', async () => {
      mockGoogleAuthNative.signInWithGoogleNative.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const result = await signInWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });
  });

  // ==================== Sign Out ====================
  describe('signOut', () => {
    it('should complete sign out successfully without clearing session', async () => {
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({ success: true });
      mockFirebase.signOut.mockResolvedValue({ success: true });

      const result = await signOut({ clearSessionData: false });

      expect(result.success).toBe(true);
      expect(
        mockStaticMasterPassword.clearStaticMasterPasswordData,
      ).not.toHaveBeenCalled();
    });

    it('should clear static master password when clearSessionData is true', async () => {
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({ success: true });
      mockFirebase.signOut.mockResolvedValue({ success: true });
      mockStaticMasterPassword.clearStaticMasterPasswordData.mockResolvedValue(
        undefined,
      );

      const result = await signOut({ clearSessionData: true });

      expect(result.success).toBe(true);
      expect(
        mockStaticMasterPassword.clearStaticMasterPasswordData,
      ).toHaveBeenCalled();
    });

    it('should default to not clearing session data', async () => {
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({ success: true });
      mockFirebase.signOut.mockResolvedValue({ success: true });

      const result = await signOut();

      expect(result.success).toBe(true);
      expect(
        mockStaticMasterPassword.clearStaticMasterPasswordData,
      ).not.toHaveBeenCalled();
    });

    it('should continue sign out even if static password clear fails', async () => {
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({ success: true });
      mockFirebase.signOut.mockResolvedValue({ success: true });
      mockStaticMasterPassword.clearStaticMasterPasswordData.mockRejectedValue(
        new Error('Clear failed'),
      );

      const result = await signOut({ clearSessionData: true });

      expect(result.success).toBe(true);
    });

    it('should handle partial sign out failures', async () => {
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({
        success: false,
      });
      mockFirebase.signOut.mockResolvedValue({ success: true });

      const result = await signOut();

      expect(result.success).toBe(true);
    });

    it('should handle sign out exceptions', async () => {
      mockGoogleAuthNative.googleSignOut.mockRejectedValue(
        new Error('Google signout error'),
      );

      const result = await signOut();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google signout error');
    });
  });

  // ==================== Get Current User ====================
  describe('getCurrentUser', () => {
    it('should return current user', () => {
      const mockUser = {
        uid: 'user123',
        email: 'test@example.com',
      };

      mockFirebase.getCurrentUser.mockReturnValue(mockUser);

      const user = getCurrentUser();

      expect(user).toEqual(mockUser);
      expect(mockFirebase.getCurrentUser).toHaveBeenCalled();
    });

    it('should return null when no user is signed in', () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);

      const user = getCurrentUser();

      expect(user).toBeNull();
    });
  });

  // ==================== Is Signed In ====================
  describe('isSignedIn', () => {
    it('should return true when user is signed in', async () => {
      const mockUser = { uid: 'user123' };
      mockFirebase.getCurrentUser.mockReturnValue(mockUser);
      mockGoogleAuthNative.isSignedIn.mockResolvedValue(true);

      const result = await isSignedIn();

      expect(result).toBe(true);
    });

    it('should return false when no Firebase user', async () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);
      mockGoogleAuthNative.isSignedIn.mockResolvedValue(true);

      const result = await isSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when not signed in with Google', async () => {
      const mockUser = { uid: 'user123' };
      mockFirebase.getCurrentUser.mockReturnValue(mockUser);
      mockGoogleAuthNative.isSignedIn.mockResolvedValue(false);

      const result = await isSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when both are not signed in', async () => {
      mockFirebase.getCurrentUser.mockReturnValue(null);
      mockGoogleAuthNative.isSignedIn.mockResolvedValue(false);

      const result = await isSignedIn();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockFirebase.getCurrentUser.mockImplementation(() => {
        throw new Error('Error getting user');
      });

      const result = await isSignedIn();

      expect(result).toBe(false);
    });

    it('should return false on Google sign-in check error', async () => {
      const mockUser = { uid: 'user123' };
      mockFirebase.getCurrentUser.mockReturnValue(mockUser);
      mockGoogleAuthNative.isSignedIn.mockRejectedValue(
        new Error('Google check failed'),
      );

      const result = await isSignedIn();

      expect(result).toBe(false);
    });
  });

  // ==================== Complex Scenarios ====================
  describe('Complex Scenarios', () => {
    it('should handle rapid sign-in calls', async () => {
      const mockGoogleResult = {
        success: true,
        idToken: 'token',
        accessToken: 'access',
      };
      const mockFirebaseResult = {
        success: true,
        user: { uid: 'user123' },
      };

      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue(mockFirebaseResult);
      mockStaticMasterPassword.generateStaticMasterPassword.mockResolvedValue({
        success: true,
      });
      mockStaticMasterPassword.verifyStaticMasterPassword.mockResolvedValue({
        success: false,
      });

      const promise1 = signInWithGoogle();
      const promise2 = signInWithGoogle();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should sign out after successful sign-in', async () => {
      const mockGoogleResult = {
        success: true,
        idToken: 'token',
        accessToken: 'access',
      };
      const mockFirebaseResult = {
        success: true,
        user: { uid: 'user123' },
      };

      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValue(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValue(mockFirebaseResult);
      mockStaticMasterPassword.generateStaticMasterPassword.mockResolvedValue({
        success: true,
      });
      mockStaticMasterPassword.verifyStaticMasterPassword.mockResolvedValue({
        success: false,
      });
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({ success: true });
      mockFirebase.signOut.mockResolvedValue({ success: true });

      const signInResult = await signInWithGoogle();
      expect(signInResult.success).toBe(true);

      const signOutResult = await signOut();
      expect(signOutResult.success).toBe(true);
    });

    it('should preserve fixed salt on normal sign-out', async () => {
      mockGoogleAuthNative.googleSignOut.mockResolvedValue({ success: true });
      mockFirebase.signOut.mockResolvedValue({ success: true });

      await signOut({ clearSessionData: false });

      expect(
        mockStaticMasterPassword.clearStaticMasterPasswordData,
      ).not.toHaveBeenCalled();
    });

    it('should handle authentication recovery', async () => {
      // First attempt fails
      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      let result = await signInWithGoogle();
      expect(result.success).toBe(false);

      // Second attempt succeeds
      const mockGoogleResult = {
        success: true,
        idToken: 'token',
        accessToken: 'access',
      };
      const mockFirebaseResult = {
        success: true,
        user: { uid: 'user123' },
      };

      mockGoogleAuthNative.signInWithGoogleNative.mockResolvedValueOnce(
        mockGoogleResult,
      );
      mockFirebase.signInWithGoogle.mockResolvedValueOnce(mockFirebaseResult);
      mockStaticMasterPassword.generateStaticMasterPassword.mockResolvedValueOnce(
        { success: true },
      );
      mockStaticMasterPassword.verifyStaticMasterPassword.mockResolvedValueOnce(
        { success: false },
      );

      result = await signInWithGoogle();
      expect(result.success).toBe(true);
    });
  });

  // ==================== Interface Tests ====================
  describe('AuthResult Interface', () => {
    it('should return AuthResult with success and user', () => {
      const mockUser = { uid: 'user123', email: 'test@example.com' };
      mockFirebase.getCurrentUser.mockReturnValue(mockUser);

      const result: AuthResult = {
        success: true,
        user: mockUser,
      };

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should return AuthResult with success and error', () => {
      const result: AuthResult = {
        success: false,
        error: 'Authentication failed',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });
});
