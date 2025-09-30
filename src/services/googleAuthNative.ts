// Native Google Sign-In for React Native CLI (without Expo)
import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { AppState } from 'react-native';

// Google OAuth configuration - Client IDs from Google Cloud Console
const GOOGLE_CLIENT_IDS = {
  // Web Client ID - Used for Firebase authentication (from google-services.json)
  WEB: '816139401561-minpjbh47bm5v274th8cj9i4qnr7tidj.apps.googleusercontent.com',
  // Android Client ID - For native Google Sign-In (from google-services.json)
  ANDROID:
    '816139401561-at47rh069kjqrv3b2t1b8cl7b97lcuqv.apps.googleusercontent.com',
  // iOS Client ID - For native iOS Google Sign-In (from GoogleService-Info.plist)
  IOS: '816139401561-fugf3vqjji9dvvnuc2kqj133m2tbuf2e.apps.googleusercontent.com',
};

export interface GoogleAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  idToken?: string;
  accessToken?: string;
  error?: string;
}

// Track initialization state
let isGoogleSignInInitialized = false;

// Initialize Google Sign-In
export const initializeGoogleSignIn = async (): Promise<boolean> => {
  try {
    // Debug: Check if GoogleSignin is available
    console.log('GoogleSignin object available:', typeof GoogleSignin);
    console.log('GoogleSignin methods:', Object.keys(GoogleSignin));
    console.log(
      'GoogleSignin.configure available:',
      typeof GoogleSignin.configure,
    );
    console.log(
      'GoogleSignin.hasPreviousSignIn available:',
      typeof GoogleSignin.hasPreviousSignIn,
    );

    // Configure Google Sign-In with web client ID for Firebase authentication
    const config = {
      webClientId: GOOGLE_CLIENT_IDS.WEB, // Required for Firebase authentication
      offlineAccess: true, // Required to get refresh token
      hostedDomain: '', // Optional - specify a hosted domain restriction
      forceCodeForRefreshToken: true, // Force getting refresh token
    };

    console.log('Configuring Google Sign-In with:', {
      webClientId: config.webClientId,
      offlineAccess: config.offlineAccess,
      forceCodeForRefreshToken: config.forceCodeForRefreshToken,
    });

    await GoogleSignin.configure(config);

    isGoogleSignInInitialized = true;
    console.log('✅ Google Sign-In initialized successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Google Sign-In initialization failed:', error);
    isGoogleSignInInitialized = false;
    return false;
  }
};

// Check if Google Sign-In is initialized
export const isGoogleSignInReady = (): boolean => {
  return isGoogleSignInInitialized;
};

// Wait for Android activity to be ready
const waitForAndroidActivity = (): Promise<void> => {
  return new Promise(resolve => {
    // Wait for app to be active first
    if (AppState.currentState === 'active') {
      // Add additional delay for Android activity to be fully ready
      setTimeout(resolve, 1000);
      return;
    }

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        subscription.remove();
        // Add additional delay for Android activity to be fully ready
        setTimeout(resolve, 1000);
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
  });
};

// Check if Google Play Services is available (with retry logic)
const checkPlayServices = async (retries = 5): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: false, // Don't show dialog to avoid activity issues
      });
      console.log('✅ Google Play Services check successful');
      return true;
    } catch (error: any) {
      console.log(
        `Play Services check attempt ${i + 1} failed:`,
        error.message,
      );
      if (i < retries - 1) {
        // Wait progressively longer before retry
        const delay = (i + 1) * 1000; // 1s, 2s, 3s, 4s
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      } else {
        // If all retries failed, check if it's an activity issue
        if (error.message && error.message.includes('activity is null')) {
          console.warn(
            '⚠️ Activity still not ready, but continuing with sign-in attempt...',
          );
          return true; // Continue anyway, let the actual sign-in handle the error
        }
        throw error;
      }
    }
  }
  return false;
};

// Native Google Sign-In
export const signInWithGoogleNative = async (): Promise<GoogleAuthResult> => {
  try {
    // Check if Google Sign-In is initialized
    if (!isGoogleSignInInitialized) {
      console.log(
        'Google Sign-In not initialized, attempting to initialize...',
      );
      const initialized = await initializeGoogleSignIn();
      if (!initialized) {
        return {
          success: false,
          error: 'Google Sign-In initialization failed',
        };
      }
    }

    // Wait for Android activity to be ready
    console.log('Waiting for Android activity to be ready...');
    await waitForAndroidActivity();

    // Check if device supports Google Play Services with retry logic
    console.log('Checking Google Play Services...');
    await checkPlayServices();

    // Skip the isSignedIn check for now and proceed directly to sign-in
    console.log('Proceeding with fresh Google Sign-In...');

    // Sign in with Google - with additional retry for activity issues
    console.log('Starting Google Sign-In...');
    let userInfo;

    try {
      console.log('Calling GoogleSignin.signIn()...');
      userInfo = await GoogleSignin.signIn();
      console.log('GoogleSignin.signIn() completed successfully');
    } catch (signInError: any) {
      console.log('GoogleSignin.signIn() failed:', signInError.message);
      // If it's an activity issue, wait a bit more and try once more
      if (
        signInError.message &&
        signInError.message.includes('activity is null')
      ) {
        console.log(
          '⚠️ Activity issue during sign-in, waiting and retrying...',
        );
        await new Promise<void>(resolve => setTimeout(resolve, 2000));
        console.log('Retrying GoogleSignin.signIn()...');
        userInfo = await GoogleSignin.signIn();
        console.log('Retry GoogleSignin.signIn() completed successfully');
      } else {
        throw signInError;
      }
    }

    // Log the raw userInfo structure for debugging
    console.log('Raw userInfo structure:', {
      type: typeof userInfo,
      hasType: 'type' in (userInfo || {}),
      hasData: 'data' in (userInfo || {}),
      hasUser: 'user' in (userInfo || {}),
      hasIdToken: 'idToken' in (userInfo || {}),
      keys: userInfo ? Object.keys(userInfo) : [],
    });

    // Validate userInfo structure
    if (!userInfo) {
      console.error('❌ No user information received from Google');
      return {
        success: false,
        error: 'No user information received from Google',
      };
    }

    // Handle different response structures
    let user: any;
    const userInfoAny = userInfo as any;

    // Check if response has 'data.user' property (v16+ structure)
    if (userInfoAny.data && userInfoAny.data.user) {
      console.log('Using userInfo.data.user structure');
      user = userInfoAny.data.user;
    }
    // Check if response has 'user' property
    else if (userInfoAny.user) {
      console.log('Using userInfo.user structure');
      user = userInfoAny.user;
    }
    // Check if response has 'data' property (fallback)
    else if (userInfoAny.data) {
      console.log('Using userInfo.data structure (fallback)');
      user = userInfoAny.data;
    }
    // Otherwise, assume userInfo is the user object directly
    else {
      console.log('Using direct userInfo structure');
      user = userInfoAny;
    }

    console.log('Extracted user object:', {
      hasId: !!user?.id,
      hasEmail: !!user?.email,
      hasName: !!user?.name,
      hasPhoto: !!user?.photo,
      userKeys: user ? Object.keys(user) : [],
      userType: typeof user,
    });

    // Debug: Log the full structure if user is missing required fields
    if (!user || !user.id || !user.email || !user.name) {
      console.log(
        '🔍 Full userInfo for debugging:',
        JSON.stringify(userInfo, null, 2),
      );
    }

    // Validate required user fields
    if (!user || !user.id || !user.email || !user.name) {
      console.error('❌ Missing required user fields:', {
        hasUser: !!user,
        id: user?.id,
        email: user?.email,
        name: user?.name,
      });
      return {
        success: false,
        error: 'Incomplete user information received from Google',
      };
    }

    console.log('🎉 Google Sign-In successful:', {
      email: user.email,
      name: user.name,
    });

    // Get tokens from the response data
    let idToken: string | undefined;
    let accessToken: string | undefined;

    if (userInfoAny.data) {
      idToken = userInfoAny.data.idToken;
      accessToken = userInfoAny.data.accessToken;
    } else {
      // Fallback: try to get tokens separately
      try {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
        accessToken = tokens.accessToken;
      } catch (error) {
        console.warn('Could not get tokens separately:', error);
      }
    }

    console.log('🎉 Google Sign-In tokens:', {
      hasIdToken: !!idToken,
      hasAccessToken: !!accessToken,
    });

    // Validate that we have the required ID token for Firebase
    if (!idToken) {
      console.error('❌ No ID token received from Google Sign-In');
      return {
        success: false,
        error: 'No ID token received from Google. Please try again.',
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.photo || undefined,
      },
      idToken: idToken,
      accessToken: accessToken || undefined,
    };
  } catch (error: any) {
    console.error('❌ Google Sign-In error:', error);

    let errorMessage = 'Authentication failed';

    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      errorMessage = 'User cancelled the sign-in process';
    } else if (error.code === statusCodes.IN_PROGRESS) {
      errorMessage = 'Sign-in is already in progress';
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      errorMessage = 'Google Play Services not available';
    } else if (error.message && error.message.includes('activity is null')) {
      errorMessage =
        'Google Sign-In not properly initialized. Please restart the app.';
    } else {
      errorMessage = error.message || 'Authentication failed';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Sign out from Google
export const googleSignOut = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    await GoogleSignin.signOut();
    console.log('✅ Google Sign-Out successful');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Google Sign-Out error:', error);
    return {
      success: false,
      error: error.message || 'Sign out failed',
    };
  }
};

// Check if user is signed in to Google
export const isSignedIn = async (): Promise<boolean> => {
  try {
    // Use hasPreviousSignIn instead of isSignedIn for v16+
    return await GoogleSignin.hasPreviousSignIn();
  } catch (error) {
    console.error('❌ Error checking Google sign-in status:', error);
    return false;
  }
};

// Get current Google user
export const getCurrentUser = async () => {
  try {
    const userInfo = await GoogleSignin.getCurrentUser();
    return userInfo;
  } catch (error) {
    console.error('❌ Error getting current Google user:', error);
    return null;
  }
};

// Revoke access (complete sign out)
export const revokeAccess = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    await GoogleSignin.revokeAccess();
    console.log('✅ Google access revoked successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Google revoke access error:', error);
    return {
      success: false,
      error: error.message || 'Revoke access failed',
    };
  }
};

// Export Google Sign-In Button component
export { GoogleSigninButton };
export { statusCodes };
