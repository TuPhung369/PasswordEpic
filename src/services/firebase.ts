import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Firebase configuration - Replace with your actual config
export const firebaseConfig = {
  // TODO: Replace with your Firebase configuration from Firebase Console
  // You'll get these values when you add your app to Firebase project
  apiKey: "your-api-key-here",
  authDomain: "passwordepic-mobile.firebaseapp.com",
  projectId: "passwordepic-mobile",
  storageBucket: "passwordepic-mobile.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
};

// Google Sign-In configuration
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: "your-web-client-id-from-google-services.json", // From Firebase Console
    offlineAccess: true,
  });
};

// Firebase services
export const firebaseAuth = auth;
export const firebaseFirestore = firestore;

// Initialize Firebase services
export const initializeFirebase = () => {
  try {
    configureGoogleSignIn();
    console.log("Firebase initialized successfully");
    return true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return false;
  }
};

// Auth helper functions
export const getCurrentUser = () => {
  return firebaseAuth().currentUser;
};

export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    await firebaseAuth().signOut();
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error };
  }
};
