// Google OAuth với Expo AuthSession (hoạt động với Expo Go)
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// Google OAuth configuration - Client IDs from Google Cloud Console
const GOOGLE_CLIENT_IDS = {
  // Web Client ID - Used for Expo AuthSession (all platforms)
  WEB: "820360565362-jp5g4nqm7e4tc4sbbkbdle88f2bke0v5.apps.googleusercontent.com",
  // Android Client ID - For native Google Sign-In (if needed)
  ANDROID:
    "820360565362-qt0dm3so5c20i8k4aa7pvvujvquupgus.apps.googleusercontent.com",
  // iOS Client ID - For native iOS Google Sign-In
  IOS: "820360565362-533idasv6jrtigpsadevuqph4qd8botf.apps.googleusercontent.com",
};

// Use Web Client ID for Expo AuthSession (works on all platforms)
const GOOGLE_CLIENT_ID = GOOGLE_CLIENT_IDS.WEB;

// OAuth endpoints
const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export interface ExpoGoogleAuthResult {
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

export const signInWithGoogleExpo = async (): Promise<ExpoGoogleAuthResult> => {
  try {
    // Tạo code verifier cho PKCE (sử dụng random string an toàn)
    const codeVerifier = Array.from(
      { length: 43 },
      () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[
          Math.floor(Math.random() * 66)
        ]
    ).join("");

    // Tạo code challenge từ code verifier (BASE64 -> BASE64URL)
    const codeChallengeBase64 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    // Chuyển đổi BASE64 thành BASE64URL (PKCE yêu cầu)
    const codeChallenge = codeChallengeBase64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Tạo redirect URI - Sử dụng custom scheme cho Development Build
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: "passwordepic", // Custom scheme từ app.json
      useProxy: false, // Không dùng proxy cho dev build
    });

    console.log("🔗 Redirect URI:", redirectUri);
    console.log("📱 GOOGLE OAUTH CONFIGURATION:");
    console.log("   🌐 Web Client ID:", GOOGLE_CLIENT_IDS.WEB);
    console.log("   🤖 Android Client ID:", GOOGLE_CLIENT_IDS.ANDROID);
    console.log("   🍎 iOS Client ID:", GOOGLE_CLIENT_IDS.IOS);
    console.log("   📦 Android Package:", "com.passwordepic.mobile");
    console.log("📍 REDIRECT URIs IN GOOGLE CONSOLE:");
    console.log("   ✅ passwordepic://oauth/redirect");
    console.log("   ✅ passwordepic://auth");
    console.log("   ✅ http://localhost:19006 (for development)");
    console.log("   ❌ Remove https://auth.expo.io (not needed for dev build)");

    // Cấu hình OAuth request
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      additionalParameters: {},
      extraParams: {
        access_type: "offline",
      },
    });

    // Thực hiện OAuth flow
    const result = await request.promptAsync(discovery);

    if (result.type === "success") {
      // Đổi authorization code lấy tokens
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_CLIENT_ID,
          code: result.params.code,
          redirectUri,
          codeVerifier: codeVerifier,
        },
        discovery
      );

      // Lấy thông tin user từ Google
      const userInfoResponse = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenResult.accessToken}`
      );
      const userInfo = await userInfoResponse.json();

      return {
        success: true,
        user: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        },
        idToken: tokenResult.idToken,
        accessToken: tokenResult.accessToken,
      };
    } else if (result.type === "cancel") {
      return {
        success: false,
        error: "User cancelled the sign-in process",
      };
    } else {
      return {
        success: false,
        error: "Authentication failed",
      };
    }
  } catch (error: any) {
    console.error("Expo Google Auth error:", error);
    return {
      success: false,
      error: error.message || "Authentication failed",
    };
  }
};

// Kiểm tra xem Expo AuthSession có sẵn không
export const isExpoAuthAvailable = (): boolean => {
  try {
    return !!AuthSession && !!Crypto;
  } catch {
    return false;
  }
};

