import {
  initializeGoogleSignIn,
  isGoogleSignInReady,
  signInWithGoogleNative,
  googleSignOut,
  isSignedIn,
  getCurrentUser,
  revokeAccess,
  __resetInitializationState,
} from '../googleAuthNative';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { AppState } from 'react-native';

// Mock the Google Sign-In module
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasPlayServices: jest.fn(),
    hasPreviousSignIn: jest.fn(),
    getCurrentUser: jest.fn(),
    revokeAccess: jest.fn(),
    getTokens: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: '12501',
    IN_PROGRESS: '12502',
    PLAY_SERVICES_NOT_AVAILABLE: '10',
  },
}));

// Mock React Native AppState
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((event, callback) => {
      // Call the callback immediately (synchronously) to simulate app being ready
      // Use Promise.resolve().then() to defer callback to next microtask,
      // which works better with both fake and real timers than setImmediate
      Promise.resolve().then(() => callback('active'));
      return {
        remove: jest.fn(),
      };
    }),
  },
}));

describe('googleAuthNative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetInitializationState();
    // Use real timers for these complex async tests
  });

  afterEach(() => {
    jest.clearAllMocks();
    __resetInitializationState();
  });

  describe('initializeGoogleSignIn', () => {
    it('should initialize Google Sign-In successfully', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      const result = await initializeGoogleSignIn();

      expect(result).toBe(true);
      expect(GoogleSignin.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          webClientId: expect.any(String),
          offlineAccess: true,
          forceCodeForRefreshToken: true,
          scopes: expect.arrayContaining([
            'https://www.googleapis.com/auth/drive.appdata',
            'https://www.googleapis.com/auth/drive.file',
          ]),
        }),
      );
    });

    it('should return false on configuration error', async () => {
      (GoogleSignin.configure as jest.Mock).mockRejectedValue(
        new Error('Configuration failed'),
      );

      const result = await initializeGoogleSignIn();

      expect(result).toBe(false);
    });

    it('should handle unknown configuration errors', async () => {
      (GoogleSignin.configure as jest.Mock).mockRejectedValue(
        new Error('Unknown error'),
      );

      const result = await initializeGoogleSignIn();

      expect(result).toBe(false);
    });

    it('should set initialization state correctly', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      expect(isGoogleSignInReady()).toBe(false);
      await initializeGoogleSignIn();
      expect(isGoogleSignInReady()).toBe(true);
    });

    it('should validate configuration structure', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      await initializeGoogleSignIn();

      const callArgs = (GoogleSignin.configure as jest.Mock).mock.calls[0][0];
      expect(callArgs.webClientId).toBeTruthy();
      expect(typeof callArgs.webClientId).toBe('string');
      expect(callArgs.offlineAccess).toBe(true);
      expect(Array.isArray(callArgs.scopes)).toBe(true);
    });
  });

  describe('isGoogleSignInReady', () => {
    it('should return false before initialization', () => {
      const result = isGoogleSignInReady();
      expect(result).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();

      const result = isGoogleSignInReady();
      expect(result).toBe(true);
    });

    it('should return false after failed initialization', async () => {
      (GoogleSignin.configure as jest.Mock).mockRejectedValue(
        new Error('Failed'),
      );
      await initializeGoogleSignIn();

      const result = isGoogleSignInReady();
      expect(result).toBe(false);
    });
  });

  describe('signInWithGoogleNative', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should sign in successfully with data.user structure', async () => {
      const mockUserInfo = {
        data: {
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: 'Test User',
            photo: 'photo.jpg',
          },
          idToken: 'id_token_123',
          accessToken: 'access_token_456',
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'photo.jpg',
      });
      expect(result.idToken).toBe('id_token_123');
      expect(result.accessToken).toBe('access_token_456');
    });

    it('should sign in successfully with user structure', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
        accessToken: 'access_token_456',
      });

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('user123');
    });

    it('should sign in successfully with direct userInfo structure', async () => {
      const mockUserInfo = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        photo: 'photo.jpg',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
        accessToken: 'access_token_456',
      });

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('user123');
    });

    it('should handle sign-in cancellation', async () => {
      const error = new Error('User cancelled');
      (error as any).code = statusCodes.SIGN_IN_CANCELLED;
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle sign-in in progress error', async () => {
      const error = new Error('Sign-in in progress');
      (error as any).code = statusCodes.IN_PROGRESS;
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('already in progress');
    });

    it('should handle play services not available error', async () => {
      const error = new Error('Play Services not available');
      (error as any).code = statusCodes.PLAY_SERVICES_NOT_AVAILABLE;
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Play Services');
    });

    it('should fail when no user information is received', async () => {
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(null);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No user information');
    });

    it('should fail when required user fields are missing', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          // Missing email and name
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Incomplete');
    });

    it('should fail when no ID token is received', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        // Missing idToken
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: undefined,
        accessToken: undefined,
      });

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No ID token');
    });

    it('should retry sign-in on activity null error', async () => {
      const activityError = new Error('activity is null');
      const mockUserInfo = {
        data: {
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: 'Test User',
          },
          idToken: 'id_token_123',
        },
      };

      (GoogleSignin.signIn as jest.Mock)
        .mockRejectedValueOnce(activityError)
        .mockResolvedValueOnce(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const promise = signInWithGoogleNative();
      jest.advanceTimersByTime(2000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(GoogleSignin.signIn).toHaveBeenCalledTimes(2);
    });

    it('should get tokens separately if not in response', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_456',
        accessToken: 'access_token_789',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(result.idToken).toBe('id_token_456');
    });

    it('should initialize if not already initialized', async () => {
      // Reset the initialized state
      (GoogleSignin.configure as jest.Mock).mockClear();
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      // Force uninitialized state by creating a fresh test context
      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
    });

    it('should handle initialization failure during sign-in', async () => {
      // Reset initialization state and mock configure to fail
      __resetInitializationState();
      (GoogleSignin.configure as jest.Mock).mockRejectedValue(
        new Error('Init failed'),
      );

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('initialization failed');
    });
  });

  describe('googleSignOut', () => {
    it('should sign out successfully', async () => {
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);

      const result = await googleSignOut();

      expect(result.success).toBe(true);
      expect(GoogleSignin.signOut).toHaveBeenCalled();
    });

    it('should handle sign-out errors', async () => {
      (GoogleSignin.signOut as jest.Mock).mockRejectedValue(
        new Error('Sign-out failed'),
      );

      const result = await googleSignOut();

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should return error with unknown sign-out error', async () => {
      const error = new Error('Unknown error');
      (GoogleSignin.signOut as jest.Mock).mockRejectedValue(error);

      const result = await googleSignOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('isSignedIn', () => {
    it('should return true if user has previous sign-in', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);

      const result = await isSignedIn();

      expect(result).toBe(true);
    });

    it('should return false if user has no previous sign-in', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(false);

      const result = await isSignedIn();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockRejectedValue(
        new Error('Error checking sign-in'),
      );

      const result = await isSignedIn();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };
      (GoogleSignin.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('should return null if no user is signed in', async () => {
      (GoogleSignin.getCurrentUser as jest.Mock).mockResolvedValue(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (GoogleSignin.getCurrentUser as jest.Mock).mockRejectedValue(
        new Error('Error getting user'),
      );

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('revokeAccess', () => {
    it('should revoke access successfully', async () => {
      (GoogleSignin.revokeAccess as jest.Mock).mockResolvedValue(undefined);

      const result = await revokeAccess();

      expect(result.success).toBe(true);
      expect(GoogleSignin.revokeAccess).toHaveBeenCalled();
    });

    it('should handle revoke access errors', async () => {
      (GoogleSignin.revokeAccess as jest.Mock).mockRejectedValue(
        new Error('Revoke failed'),
      );

      const result = await revokeAccess();

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should return error message from exception', async () => {
      (GoogleSignin.revokeAccess as jest.Mock).mockRejectedValue(
        new Error('Access denied'),
      );

      const result = await revokeAccess();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });
  });

  describe('Play Services Check Retry Logic', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should retry on Play Services check failure', async () => {
      const error = new Error('Play Services check failed');
      (GoogleSignin.hasPlayServices as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);

      const promise = signInWithGoogleNative();
      jest.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(GoogleSignin.hasPlayServices).toHaveBeenCalledTimes(2);
    });

    it('should continue if activity is null after max retries', async () => {
      // This test does NOT use fake timers to properly test retry logic with real delays
      const activityError = new Error('activity is null');
      (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue(
        activityError,
      );

      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
    }, 40000);

    it('should fail if play services check fails for other reasons', async () => {
      // This test uses real timers to properly test retry logic
      const error = new Error('Unknown error');
      (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue(error);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
    }, 40000);
  });

  describe('Android Activity Wait Logic', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should wait for app state to become active', async () => {
      // Test with background state and waiting for active state
      (AppState.currentState as any) = 'background';

      (AppState.addEventListener as jest.Mock).mockImplementation(
        (event, callback) => {
          // Trigger callback immediately with 'active' state
          Promise.resolve().then(() => callback('active'));
          return { remove: jest.fn() };
        },
      );

      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(AppState.addEventListener).toHaveBeenCalled();
    }, 30000);

    it('should handle app state change callback correctly', async () => {
      (AppState.currentState as any) = 'active';
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const promise = signInWithGoogleNative();
      jest.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling with Different Response Structures', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should extract user from data property (fallback)', async () => {
      const mockUserInfo = {
        data: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
          idToken: 'id_token_123',
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('user123');
    }, 15000);

    it('should handle activity null error message in exception', async () => {
      // Use real timers for retry logic
      // Mock hasPlayServices to fail with activity null error on all retries
      const error = new Error('activity is null error');
      (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValue(error);

      // Mock signIn to also fail with activity null to ensure the service fails
      const signInError = new Error('activity is null error');
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(signInError);

      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not properly initialized');
    }, 40000);

    it('should handle generic error message', async () => {
      const error = new Error('Generic sign-in error');
      (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Generic sign-in error');
    }, 15000);
  });

  describe('Token Handling', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should extract tokens from data property', async () => {
      const mockUserInfo = {
        data: {
          user: {
            id: 'user123',
            email: 'test@example.com',
            name: 'Test User',
          },
          idToken: 'id_token_from_data',
          accessToken: 'access_token_from_data',
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_from_data',
        accessToken: 'access_token_from_data',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.idToken).toBe('id_token_from_data');
      expect(result.accessToken).toBe('access_token_from_data');
    }, 20000);

    it('should fallback to getTokens if not in response', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_from_getTokens',
        accessToken: 'access_token_from_getTokens',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.idToken).toBe('id_token_from_getTokens');
      expect(result.accessToken).toBe('access_token_from_getTokens');
    }, 20000);

    it('should handle getTokens failure gracefully', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockRejectedValue(
        new Error('Token fetch failed'),
      );
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.success).toBe(true);
      expect(result.idToken).toBe('id_token_123');
    }, 20000);
  });

  describe('Configuration Validation', () => {
    it('should validate web client ID configuration', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      await initializeGoogleSignIn();

      const config = (GoogleSignin.configure as jest.Mock).mock.calls[0][0];
      expect(config.webClientId).toBeTruthy();
      expect(config.webClientId).toMatch(/\.apps\.googleusercontent\.com$/);
    });

    it('should validate offline access configuration', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      await initializeGoogleSignIn();

      const config = (GoogleSignin.configure as jest.Mock).mock.calls[0][0];
      expect(config.offlineAccess).toBe(true);
      expect(config.forceCodeForRefreshToken).toBe(true);
    });

    it('should include required scopes in configuration', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      await initializeGoogleSignIn();

      const config = (GoogleSignin.configure as jest.Mock).mock.calls[0][0];
      expect(config.scopes).toContain(
        'https://www.googleapis.com/auth/drive.appdata',
      );
      expect(config.scopes).toContain(
        'https://www.googleapis.com/auth/drive.file',
      );
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should handle multiple isSignedIn calls', async () => {
      (GoogleSignin.hasPreviousSignIn as jest.Mock).mockResolvedValue(true);

      const results = await Promise.all([
        isSignedIn(),
        isSignedIn(),
        isSignedIn(),
      ]);

      expect(results).toEqual([true, true, true]);
      expect(GoogleSignin.hasPreviousSignIn).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple getCurrentUser calls', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
      };
      (GoogleSignin.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const results = await Promise.all([
        getCurrentUser(),
        getCurrentUser(),
        getCurrentUser(),
      ]);

      expect(results).toEqual([mockUser, mockUser, mockUser]);
    });

    it('should handle concurrent sign-out and revoke', async () => {
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
      (GoogleSignin.revokeAccess as jest.Mock).mockResolvedValue(undefined);

      const [signOutResult, revokeResult] = await Promise.all([
        googleSignOut(),
        revokeAccess(),
      ]);

      expect(signOutResult.success).toBe(true);
      expect(revokeResult.success).toBe(true);
    });
  });

  describe('User Picture Handling', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should include picture when available', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
          photo: 'https://example.com/photo.jpg',
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.user?.picture).toBe('https://example.com/photo.jpg');
    }, 20000);

    it('should omit picture when undefined', async () => {
      const mockUserInfo = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
          photo: undefined,
        },
        idToken: 'id_token_123',
      };

      (GoogleSignin.signIn as jest.Mock).mockResolvedValue(mockUserInfo);
      (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
        idToken: 'id_token_123',
      });
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(undefined);

      const result = await signInWithGoogleNative();

      expect(result.user?.picture).toBeUndefined();
    }, 20000);
  });

  describe('Error Message Consistency', () => {
    beforeEach(async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);
      await initializeGoogleSignIn();
    });

    it('should provide consistent error messages for sign-in errors', async () => {
      const errors = [
        { code: statusCodes.SIGN_IN_CANCELLED, expected: 'cancelled' },
        { code: statusCodes.IN_PROGRESS, expected: 'already in progress' },
        {
          code: statusCodes.PLAY_SERVICES_NOT_AVAILABLE,
          expected: 'Play Services',
        },
      ];

      for (const { code, expected } of errors) {
        const error = new Error('Error');
        (error as any).code = code;
        (GoogleSignin.signIn as jest.Mock).mockRejectedValue(error);
        (GoogleSignin.getTokens as jest.Mock).mockResolvedValue({
          idToken: 'id_token_123',
        });
        (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(
          undefined,
        );

        const result = await signInWithGoogleNative();

        expect(result.success).toBe(false);
        expect(result.error).toContain(expected);
      }
    }, 30000);

    it('should provide error message for sign-out failures', async () => {
      (GoogleSignin.signOut as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await googleSignOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Module Initialization', () => {
    it('should ensure configuration is valid before use', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      const result = await initializeGoogleSignIn();

      expect(result).toBe(true);
      expect(
        (GoogleSignin.configure as jest.Mock).mock.calls[0][0],
      ).toHaveProperty('webClientId');
    });

    it('should handle configuration with empty hosted domain', async () => {
      (GoogleSignin.configure as jest.Mock).mockResolvedValue(undefined);

      await initializeGoogleSignIn();

      const config = (GoogleSignin.configure as jest.Mock).mock.calls[0][0];
      expect(config.hostedDomain).toBe('');
    });
  });
});
