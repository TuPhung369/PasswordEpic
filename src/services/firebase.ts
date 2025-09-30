// Firebase service with Google OAuth integration
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Polyfills for Firebase
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Firebase configuration - From google-services.json and GoogleService-Info.plist
export const firebaseConfig = {
  apiKey: 'AIzaSyAezBXf7E2IyXIKfrOLWeZe3yboFROgi9E', // From google-services.json
  authDomain: 'passwordepic.firebaseapp.com',
  projectId: 'passwordepic',
  storageBucket: 'passwordepic.firebasestorage.app',
  messagingSenderId: '816139401561',
  appId:
    Platform.OS === 'ios'
      ? '1:816139401561:ios:54cb13ede3e05c00a8b448' // iOS app ID from GoogleService-Info.plist
      : '1:816139401561:android:3fa8015f67b531f9a8b448', // From google-services.json
};

// Initialize Firebase
let app;
let auth;
let firestore;

try {
  if (getApps().length === 0) {
    console.log('Initializing Firebase app...');
    app = initializeApp(firebaseConfig);

    console.log('Initializing Firebase Auth...');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

    console.log('Initializing Firestore...');
    firestore = getFirestore(app);

    console.log('Firebase services initialized successfully');
  } else {
    console.log('Using existing Firebase app...');
    app = getApps()[0];
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Don't throw the error, just log it and continue with null values
  app = null;
  auth = null;
  firestore = null;
}

// Firebase services
export const firebaseAuth = auth;
export const firebaseFirestore = firestore;

// Auth state listener
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!firebaseAuth) {
    console.warn(
      'Firebase Auth not initialized, cannot listen to auth state changes',
    );
    return () => {}; // Return empty unsubscribe function
  }
  return onAuthStateChanged(firebaseAuth, callback);
};

// Google Sign-In with Firebase
export const signInWithGoogle = async (
  idToken: string,
  accessToken?: string,
) => {
  try {
    console.log('Creating Google credential for Firebase...');
    console.log('Tokens received:', {
      hasIdToken: !!idToken,
      hasAccessToken: !!accessToken,
      idTokenLength: idToken?.length || 0,
      accessTokenLength: accessToken?.length || 0,
    });

    if (!firebaseAuth) {
      throw new Error('Firebase Auth is not initialized');
    }

    if (!idToken) {
      throw new Error('ID token is required for Firebase authentication');
    }

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    console.log('Google credential created successfully');

    console.log('Signing in with Firebase...');
    const result = await signInWithCredential(firebaseAuth, credential);

    console.log('Firebase sign-in successful:', {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
    });

    return {
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email || null,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
    };
  } catch (error: any) {
    // Use console.warn instead of console.error to prevent React Native error overlay
    console.warn('Firebase Google Sign-In error:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      fullError: error,
    });

    let errorMessage = 'Failed to sign in with Google';

    if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid Google credentials. Please try signing in again.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed attempts. Please try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Sign out
export const signOut = async () => {
  try {
    if (!firebaseAuth) {
      return { success: false, error: 'Firebase Auth not initialized' };
    }
    await firebaseSignOut(firebaseAuth);
    return { success: true };
  } catch (error: any) {
    console.warn('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = () => {
  if (!firebaseAuth) {
    console.warn('Firebase Auth not initialized, cannot get current user');
    return null;
  }
  return firebaseAuth.currentUser;
};

// Initialize Firebase services
export const initializeFirebase = () => {
  try {
    // Check if Firebase services are properly initialized
    if (!firebaseAuth) {
      throw new Error('Firebase Auth not initialized');
    }
    if (!firebaseFirestore) {
      throw new Error('Firebase Firestore not initialized');
    }

    console.log('Firebase services validation successful');
    console.log('Firebase Auth available:', !!firebaseAuth);
    console.log('Firebase Firestore available:', !!firebaseFirestore);
    console.log('Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
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
