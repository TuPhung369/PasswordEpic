import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
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

// Google Sign-In configuration
export const configureGoogleSignIn = () => {
  const webClientId =
    Platform.OS === "ios"
      ? "816139401561-hs7tal2e7sm3ql9nisogj9bo1btlhsal.apps.googleusercontent.com" // From GoogleService-Info.plist
      : "816139401561-c4vgrr43d2aglpjbf4pf59qag3bo45of.apps.googleusercontent.com"; // From google-services.json

  GoogleSignin.configure({
    webClientId,
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

