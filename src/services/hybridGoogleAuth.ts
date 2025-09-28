// Hybrid Google Auth - Tự động chọn native hoặc Expo AuthSession
import { isGoogleSignInModuleAvailable } from "./googleSignIn";
import { isExpoAuthAvailable, signInWithGoogleExpo } from "./expoGoogleAuth";

export interface HybridAuthResult {
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
  method?: "native" | "expo" | "unavailable";
}

export const signInWithGoogleHybrid = async (): Promise<HybridAuthResult> => {
  // Ưu tiên native Google Sign-In nếu có
  if (isGoogleSignInModuleAvailable()) {
    try {
      const { googleSignIn, configureGoogleSignIn } = require("./googleSignIn");

      // Configure và sign in
      configureGoogleSignIn();
      const result = await googleSignIn();

      if (result.success) {
        return {
          ...result,
          method: "native",
        };
      }
    } catch (error) {
      console.warn(
        "Native Google Sign-In failed, falling back to Expo AuthSession"
      );
    }
  }

  // Fallback sang Expo AuthSession
  if (isExpoAuthAvailable()) {
    try {
      const result = await signInWithGoogleExpo();
      return {
        ...result,
        method: "expo",
      };
    } catch (error) {
      console.error("Expo AuthSession failed:", error);
      return {
        success: false,
        error: "Both native and Expo authentication methods failed",
        method: "unavailable",
      };
    }
  }

  // Không có phương pháp nào khả dụng
  return {
    success: false,
    error: "No Google authentication method available",
    method: "unavailable",
  };
};

export const getAvailableAuthMethods = () => {
  return {
    native: isGoogleSignInModuleAvailable(),
    expo: isExpoAuthAvailable(),
  };
};
