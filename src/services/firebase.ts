// Firebase service with Google OAuth integration
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
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

// Firebase services
export const firebaseAuth = auth;
export const firebaseFirestore = firestore;

// Auth state listener
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(firebaseAuth, callback);
};

// Google Sign-In with Firebase
export const signInWithGoogle = async (
  idToken: string,
  accessToken: string
) => {
  try {
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(firebaseAuth, credential);

    return {
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
    };
  } catch (error: any) {
    console.error("Firebase Google Sign-In error:", error);
    return {
      success: false,
      error: error.message || "Failed to sign in with Google",
    };
  }
};

// Sign out
export const signOut = async () => {
  try {
    await firebaseSignOut(firebaseAuth);
    return { success: true };
  } catch (error: any) {
    console.error("Sign out error:", error);
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = () => {
  return firebaseAuth.currentUser;
};

// Initialize Firebase services
export const initializeFirebase = () => {
  try {
    console.log("Firebase initialized successfully");
    return true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return false;
  }
};

// User data interface
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
