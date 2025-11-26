// Authentication service for React Native CLI (without Expo)
import {
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  onAuthStateChange,
  getCurrentUser as getFirebaseCurrentUser,
  FirebaseUser,
} from './firebase';
import {
  clearStaticMasterPasswordData,
  generateStaticMasterPassword,
  verifyStaticMasterPassword,
} from './staticMasterPasswordService';

// Initialize authentication services
export const initializeAuth = () => {
  try {
    console.log('Authentication services initialized successfully');
    return true;
  } catch (error) {
    console.error('Authentication initialization failed:', error);
    return false;
  }
};

// Complete Google Sign-In flow with Firebase and Dynamic Master Password
export const signInWithGoogle = async () => {
  try {
    console.log(
      '🚀 [Auth] Starting Google Sign-In with Dynamic Master Password...',
    );

    // Use Native Google Sign-In only (no Expo)
    const { signInWithGoogleNative } = require('./googleAuthNative');

    // Step 1: Sign in with Google Native
    const googleResult = await signInWithGoogleNative();

    console.log('Google Sign-In method used: Native');

    if (!googleResult.success) {
      return {
        success: false,
        error: googleResult.error,
      };
    }

    // Validate that we have the required ID token
    if (!googleResult.idToken) {
      return {
        success: false,
        error: 'No ID token received from Google Sign-In. Please try again.',
      };
    }

    // Step 2: Authenticate with Firebase using Google tokens
    const firebaseResult = await firebaseSignInWithGoogle(
      googleResult.idToken,
      googleResult.accessToken,
    );

    if (!firebaseResult.success) {
      return {
        success: false,
        error: firebaseResult.error,
      };
    }

    // Step 3: Initialize Static Master Password
    console.log('🔐 [Auth] Initializing static master password...');
    try {
      // Check if static password already exists
      const verifyResult = await verifyStaticMasterPassword();

      if (verifyResult.success && verifyResult.valid) {
        console.log('🔄 [Auth] Valid static password found - using existing');
        // Just generate password from existing fixed salt
        const staticResult = await generateStaticMasterPassword();
        if (staticResult.success) {
          console.log('✅ [Auth] Static password verified and ready');
        }
      } else {
        console.log('🆕 [Auth] No valid static password - initializing new');
        // Initialize new static password with fixed salt
        const initResult = await generateStaticMasterPassword();

        if (initResult.success) {
          console.log('✅ [Auth] Static password initialized successfully');
        } else {
          console.warn(
            `⚠️ [Auth] Static password initialization warning: ${initResult.error}`,
          );
          // Don't fail the login, just log the warning
        }
      }
    } catch (staticError) {
      console.error(
        '❌ [Auth] Static master password initialization failed:',
        staticError,
      );
      // Don't fail the login process for static password issues
    }

    console.log('✅ [Auth] Google Sign-In completed successfully');
    return {
      success: true,
      user: firebaseResult.user,
    };
  } catch (error: any) {
    console.error('Complete sign-in flow error:', error);
    return {
      success: false,
      error: error.message || 'Authentication failed',
    };
  }
};

// Complete sign out flow with Static Master Password cleanup
export const signOut = async (options?: { clearSessionData?: boolean }) => {
  try {
    const clearSession = options?.clearSessionData ?? false; // Default: DON'T clear session
    console.log(
      `🚪 [Auth] Starting sign out (clearSession: ${clearSession})...`,
    );

    // Import Google Sign-In functions
    const { googleSignOut } = require('./googleAuthNative');

    // Step 1: Invalidate master password set cache to force re-check on next login
    try {
      const { invalidateMasterPasswordCache } = await import(
        './secureStorageService'
      );
      await invalidateMasterPasswordCache();
      console.log('🧹 [Auth] Master password cache invalidated');
    } catch (cacheError) {
      console.warn('⚠️ [Auth] Failed to invalidate cache:', cacheError);
    }

    // Step 2: Optionally clear static master password data
    // ⚠️ IMPORTANT: Only clear if explicitly requested (e.g., "Delete Account")
    // For normal logout, preserve fixed salt to allow re-login with same passwords
    if (clearSession) {
      try {
        await clearStaticMasterPasswordData();
        console.log('🗑️ [Auth] Static master password data cleared');
      } catch (staticError) {
        console.warn(
          '⚠️ [Auth] Failed to clear static master password data:',
          staticError,
        );
        // Don't fail the sign out process
      }
    } else {
      console.log(
        '🔒 [Auth] Preserving fixed salt for re-login (passwords will remain accessible)',
      );
    }

    // Step 3: Sign out from both Google and Firebase
    const [googleResult, firebaseResult] = await Promise.all([
      googleSignOut(),
      firebaseSignOut(),
    ]);

    if (!googleResult.success || !firebaseResult.success) {
      console.warn('Partial sign out - some services may still be signed in');
    }

    console.log('✅ [Auth] Sign out completed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Get current authenticated user
export const getCurrentUser = (): FirebaseUser | null => {
  return getFirebaseCurrentUser();
};

// Check if user is signed in
export const isSignedIn = async (): Promise<boolean> => {
  try {
    const firebaseUser = getCurrentUser();

    // Import Google Sign-In functions
    const { isSignedIn: isGoogleSignedIn } = require('./googleAuthNative');
    const googleSignedIn = await isGoogleSignedIn();

    return firebaseUser !== null && googleSignedIn;
  } catch (error) {
    return false;
  }
};

// Auth state listener
export const onAuthStateChanged = onAuthStateChange;

// Auth result interface
export interface AuthResult {
  success: boolean;
  user?: FirebaseUser;
  error?: string;
}

export type { FirebaseUser } from './firebase';
