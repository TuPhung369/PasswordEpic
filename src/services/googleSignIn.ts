// Google Sign-In service for React Native
import { Platform } from 'react-native';

// Google Sign-In configuration - Client IDs from Google Cloud Console
const GOOGLE_CLIENT_IDS = {
  // Web Client ID - Used for native Google Sign-In (from google-services.json)
  WEB: '816139401561-minpjbh47bm5v274th8cj9i4qnr7tidj.apps.googleusercontent.com',
  // Android Client ID - For Android native Google Sign-In (from GoogleService-Info.plist)
  ANDROID:
    '816139401561-sjhs666ium3sc4o94u15bvttm8la1ltv.apps.googleusercontent.com',
  // iOS Client ID - For native iOS Google Sign-In (from GoogleService-Info.plist)
  IOS: '816139401561-fugf3vqjji9dvvnuc2kqj133m2tbuf2e.apps.googleusercontent.com',
};

const GOOGLE_WEB_CLIENT_ID = GOOGLE_CLIENT_IDS.WEB;
const GOOGLE_IOS_CLIENT_ID = GOOGLE_CLIENT_IDS.IOS;

// Check if Google Sign-In module is available
let isGoogleSignInAvailable = false;
let GoogleSignin: any = null;

try {
  const googleSignInModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignInModule.GoogleSignin;
  isGoogleSignInAvailable = true;
  console.log('Google Sign-In module loaded successfully');
} catch (error) {
  console.warn('Google Sign-In module not available:', error);
  isGoogleSignInAvailable = false;
}

// Lazy import Google Sign-In to avoid module loading errors
const getGoogleSignin = () => {
  if (!isGoogleSignInAvailable || !GoogleSignin) {
    console.warn('Google Sign-In module not available');
    return null;
  }
  return GoogleSignin;
};

export const configureGoogleSignIn = () => {
  try {
    const googleSigninInstance = getGoogleSignin();
    if (!googleSigninInstance) {
      throw new Error('Google Sign-In module not available');
    }

    // Check if we have valid client IDs (not placeholder values)
    if (
      GOOGLE_WEB_CLIENT_ID.includes('placeholder') ||
      GOOGLE_WEB_CLIENT_ID.includes('8j9k7l6m5n4o3p2q1r0s9t8u7v6w5x4y') ||
      !GOOGLE_WEB_CLIENT_ID.includes('816139401561')
    ) {
      console.warn(
        'Google Sign-In: Invalid client IDs. Please verify Google Cloud Console configuration.',
      );
      throw new Error('Invalid Google client configuration');
    }

    console.log('📱 NATIVE GOOGLE SIGN-IN CONFIGURATION:');
    console.log('   🌐 Web Client ID:', GOOGLE_CLIENT_IDS.WEB);
    console.log('   🤖 Android Client ID:', GOOGLE_CLIENT_IDS.ANDROID);
    console.log('   🍎 iOS Client ID:', GOOGLE_CLIENT_IDS.IOS);
    console.log('   📦 Android Package:', 'com.passwordepic.mobile');

    googleSigninInstance.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : undefined,
      offlineAccess: true,
      hostedDomain: '',
      forceCodeForRefreshToken: true,
      scopes: [
        'https://www.googleapis.com/auth/drive.file', // Access to files created by the app
        'https://www.googleapis.com/auth/drive.appdata', // Access to app data folder
      ],
    });

    console.log('Google Sign-In configured successfully');
  } catch (error) {
    console.error('Google Sign-In configuration failed:', error);
    throw error;
  }
};

export const googleSignIn = async () => {
  try {
    const googleSigninInstance = getGoogleSignin();
    if (!googleSigninInstance) {
      return {
        success: false,
        error: 'Google Sign-In module not available',
      };
    }

    // Check if device supports Google Play Services
    await googleSigninInstance.hasPlayServices();

    // Sign in with Google
    const userInfo = await googleSigninInstance.signIn();

    // Get tokens for Firebase authentication
    const tokens = await googleSigninInstance.getTokens();

    return {
      success: true,
      userInfo,
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
    };
  } catch (error: any) {
    console.error('Google Sign-In error:', error);

    let errorMessage = 'Failed to sign in with Google';

    if (error.code === 'SIGN_IN_CANCELLED') {
      errorMessage = 'Sign in was cancelled';
    } else if (error.code === 'IN_PROGRESS') {
      errorMessage = 'Sign in is already in progress';
    } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      errorMessage = 'Google Play Services not available';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const googleSignOut = async () => {
  try {
    const googleSigninInstance = getGoogleSignin();
    if (!googleSigninInstance) {
      return { success: false, error: 'Google Sign-In module not available' };
    }

    await googleSigninInstance.signOut();
    return { success: true };
  } catch (error: any) {
    console.error('Google Sign-Out error:', error);
    return { success: false, error: error.message };
  }
};

export const isSignedIn = async () => {
  try {
    const googleSigninInstance = getGoogleSignin();
    if (!googleSigninInstance) {
      return false;
    }
    return await googleSigninInstance.isSignedIn();
  } catch (error) {
    return false;
  }
};

export const getCurrentUser = async () => {
  try {
    const googleSigninInstance = getGoogleSignin();
    if (!googleSigninInstance) {
      return { success: false, error: 'Google Sign-In module not available' };
    }

    const userInfo = await googleSigninInstance.signInSilently();
    return { success: true, userInfo };
  } catch (error) {
    return { success: false, error };
  }
};

// Check if Google Sign-In is available in the current build
export const isGoogleSignInModuleAvailable = () => {
  return isGoogleSignInAvailable;
};
