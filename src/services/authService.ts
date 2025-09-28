// Authentication service combining Firebase and Google Sign-In
import {
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  onAuthStateChange,
  getCurrentUser as getFirebaseCurrentUser,
  FirebaseUser,
} from "./firebase";

// Initialize authentication services (chỉ Firebase, không cần Google Sign-In ngay)
export const initializeAuth = () => {
  try {
    // Chỉ log rằng auth service đã sẵn sàng
    // Google Sign-In sẽ được khởi tạo khi user thực sự cần đăng nhập
    console.log("Authentication services initialized successfully");
    return true;
  } catch (error) {
    console.error("Authentication initialization failed:", error);
    return false;
  }
};

// Complete Google Sign-In flow with Firebase
export const signInWithGoogle = async () => {
  try {
    // Sử dụng hybrid approach: Native hoặc Expo AuthSession
    const { signInWithGoogleHybrid } = require("./hybridGoogleAuth");

    // Step 1: Sign in with Google (tự động chọn phương pháp tốt nhất)
    const googleResult = await signInWithGoogleHybrid();

    console.log(`Google Sign-In method used: ${googleResult.method}`);

    if (!googleResult.success) {
      return {
        success: false,
        error: googleResult.error,
      };
    }

    // Step 2: Authenticate with Firebase using Google tokens
    const firebaseResult = await firebaseSignInWithGoogle(
      googleResult.idToken!,
      googleResult.accessToken!
    );

    if (!firebaseResult.success) {
      return {
        success: false,
        error: firebaseResult.error,
      };
    }

    return {
      success: true,
      user: firebaseResult.user,
    };
  } catch (error: any) {
    console.error("Complete sign-in flow error:", error);
    return {
      success: false,
      error: error.message || "Authentication failed",
    };
  }
};

// Complete sign out flow
export const signOut = async () => {
  try {
    // Lazy import Google Sign-In functions
    const { googleSignOut } = require("./googleSignIn");

    // Sign out from both Google and Firebase
    const [googleResult, firebaseResult] = await Promise.all([
      googleSignOut(),
      firebaseSignOut(),
    ]);

    if (!googleResult.success || !firebaseResult.success) {
      console.warn("Partial sign out - some services may still be signed in");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Sign out error:", error);
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

    // Lazy import Google Sign-In functions
    const { isSignedIn: isGoogleSignedIn } = require("./googleSignIn");
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

export { FirebaseUser } from "./firebase";

