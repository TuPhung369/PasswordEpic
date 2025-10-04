// Firebase service with Google OAuth integration and Manual Persistence
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
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

// Firebase configuration
export const firebaseConfig = {
  apiKey: 'AIzaSyAezBXf7E2IyXIKfrOLWeZe3yboFROgi9E',
  authDomain: 'passwordepic.firebaseapp.com',
  projectId: 'passwordepic',
  storageBucket: 'passwordepic.firebasestorage.app',
  messagingSenderId: '816139401561',
  appId:
    Platform.OS === 'ios'
      ? '1:816139401561:ios:54cb13ede3e05c00a8b448'
      : '1:816139401561:android:3fa8015f67b531f9a8b448',
};

// Auth state management
const AUTH_STORAGE_KEY = '@PasswordEpic:auth_state';

interface StoredAuthData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const saveAuthState = async (user: User) => {
  try {
    const authData: StoredAuthData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    console.log('💾 Auth state saved');
  } catch (error) {
    console.error('❌ Failed to save auth state:', error);
  }
};

const clearAuthState = async () => {
  try {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    console.log('🗑️ Auth state cleared');
  } catch (error) {
    console.error('❌ Failed to clear auth state:', error);
  }
};

// Initialize Firebase app once
let app: any = null;
let auth: any = null;
let firestore: any = null;

try {
  console.log('🔄 Initializing Firebase app...');
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized');
  } else {
    app = getApps()[0];
    console.log('✅ Using existing Firebase app');
  }

  // Initialize auth with AsyncStorage persistence
  if (app && !auth) {
    console.log(
      '🔐 Initializing Firebase Auth with AsyncStorage persistence...',
    );
    try {
      // Try to import the persistence function
      const {
        initializeAuth,
        getReactNativePersistence,
      } = require('firebase/auth');
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
      console.log('✅ Auth initialized with AsyncStorage persistence');
    } catch (error) {
      console.warn(
        '⚠️ Failed to initialize auth with persistence, using default:',
        error,
      );
      auth = getAuth(app);
      console.log('✅ Auth initialized with default persistence');
    }
  }

  // Initialize firestore immediately after app
  if (app && !firestore) {
    console.log('🗄️ Initializing Firestore...');
    firestore = getFirestore(app);
    console.log('✅ Firestore initialized');
  }
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

// Service getters
export const getFirebaseAuth = () => {
  return auth;
};

export const getFirebaseFirestore = () => {
  return firestore;
};

// Legacy exports
export const firebaseAuth = auth;
export const firebaseFirestore = firestore;

// Auth state listener
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    console.warn('⚠️ Auth not available');
    return () => {};
  }

  return onAuthStateChanged(authInstance, async user => {
    if (user) {
      await saveAuthState(user);
      console.log('🔐 User authenticated');
    } else {
      await clearAuthState();
      console.log('🚪 User signed out');
    }
    callback(user);
  });
};

// Google Sign-In
export const signInWithGoogle = async (
  idToken: string,
  accessToken?: string,
) => {
  try {
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      throw new Error('Firebase Auth not available');
    }

    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(authInstance, credential);

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
    console.warn('Firebase Google Sign-In error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign in with Google',
    };
  }
};

// Sign out
export const signOut = async () => {
  try {
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      return { success: false, error: 'Firebase Auth not available' };
    }
    await firebaseSignOut(authInstance);
    return { success: true };
  } catch (error: any) {
    console.warn('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Get current user
export const getCurrentUser = () => {
  const authInstance = getFirebaseAuth();
  return authInstance?.currentUser || null;
};

// Initialize Firebase (for compatibility)
export const initializeFirebase = () => {
  try {
    console.log('🚀 Starting Firebase initialization...');
    if (app && auth && firestore) {
      console.log('✅ Firebase initialization complete');
      return true;
    } else {
      console.error(
        '❌ Firebase initialization failed - services not available',
      );
      return false;
    }
  } catch (error: any) {
    console.error('❌ Firebase initialization error:', error);
    return false;
  }
};

// User interface
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
