// Native Google Sign-In cho Development Build
import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// Google OAuth configuration
const GOOGLE_CLIENT_IDS = {
  // Web Client ID - Required for server-side verification
  WEB: "820360565362-jp5g4nqm7e4tc4sbbkbdle88f2bke0v5.apps.googleusercontent.com",
  // Android Client ID - For Android native sign-in
  ANDROID:
    "820360565362-qt0dm3so5c20i8k4aa7pvvujvquupgus.apps.googleusercontent.com",
  // iOS Client ID - For iOS native sign-in
  IOS: "820360565362-533idasv6jrtigpsadevuqph4qd8botf.apps.googleusercontent.com",
};

export interface NativeGoogleAuthResult {
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

// Configure Google Sign-In
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    // Use Web Client ID for server-side verification
    webClientId: GOOGLE_CLIENT_IDS.WEB,
    // Request offline access for refresh tokens
    offlineAccess: true,
    // Request ID token for Firebase auth
    requestIdToken: true,
    // iOS specific configuration
    iosClientId: GOOGLE_CLIENT_IDS.IOS,
    // Scopes to request
    scopes: ["openid", "profile", "email"],
  });
};

export const signInWithGoogleNative =
  async (): Promise<NativeGoogleAuthResult> => {
    try {
      console.log("🔧 Configuring Google Sign-In...");
      configureGoogleSignIn();

      console.log("🔍 Checking if Google Play Services are available...");
      await GoogleSignin.hasPlayServices();

      console.log("🚀 Starting Google Sign-In flow...");
      const userInfo = await GoogleSignin.signIn();

      console.log("✅ Google Sign-In successful:", {
        id: userInfo.user.id,
        email: userInfo.user.email,
        name: userInfo.user.name,
      });

      return {
        success: true,
        user: {
          id: userInfo.user.id,
          email: userInfo.user.email,
          name: userInfo.user.name,
          picture: userInfo.user.photo || undefined,
        },
        idToken: userInfo.idToken || undefined,
        accessToken: userInfo.serverAuthCode || undefined,
      };
    } catch (error: any) {
      console.error("❌ Google Sign-In error:", error);

      let errorMessage = "Authentication failed";

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = "User cancelled the sign-in process";
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = "Sign-in is already in progress";
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = "Google Play Services not available";
      } else {
        errorMessage = error.message || "Authentication failed";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

export const signOutGoogleNative = async (): Promise<boolean> => {
  try {
    await GoogleSignin.signOut();
    console.log("✅ Google Sign-Out successful");
    return true;
  } catch (error) {
    console.error("❌ Google Sign-Out error:", error);
    return false;
  }
};

export const getCurrentGoogleUser = async () => {
  try {
    const userInfo = await GoogleSignin.signInSilently();
    return userInfo;
  } catch (error) {
    console.log("No user currently signed in");
    return null;
  }
};

export const isGoogleSignedIn = async (): Promise<boolean> => {
  return await GoogleSignin.isSignedIn();
};
