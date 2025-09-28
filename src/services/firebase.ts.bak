// Note: Using Firebase Web SDK for Expo Go compatibility
// For production builds, switch to @react-native-firebase
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Firebase configuration - From google-services.json and GoogleService-Info.plist
export const firebaseConfig = {
  apiKey:
    Platform.OS === "ios"
      ? "AIzaSyBKqLBzJoH8IGOuARa9p3WfqguXJWSUavM"
      : "AIzaSyAezBXf7E2IyXIKfrOLWeZe3yboFROgi9E",
  authDomain: "passwordepic.firebaseapp.com",
  projectId: "passwordepic",
  storageBucket: "passwordepic.firebasestorage.app",
  messagingSenderId: "816139401561",
  appId:
    Platform.OS === "ios"
      ? "1:816139401561:ios:180e47251209203ea8b448"
      : "1:816139401561:android:7a1f670d56a141c9a8b448",
};

// Initialize Firebase
let app;
let auth;
let firestore;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  firestore = getFirestore(app);
} else {
  app = getApps()[0];
  auth = getAuth(app);
  firestore = getFirestore(app);
}

// Google Sign-In configuration (placeholder for now)
export const configureGoogleSignIn = () => {
  // Note: Google Sign-In requires native modules
  // For Expo Go testing, we'll skip this for now
  console.log("Google Sign-In configuration skipped in Expo Go");
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
  return firebaseAuth.currentUser;
};

export const signOut = async () => {
  try {
    // Skip Google Sign-In signout in Expo Go
    await firebaseAuth.signOut();
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error };
  }
};

