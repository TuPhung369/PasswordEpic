import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import {
  NavigationContainer,
  type NavigationState,
} from '@react-navigation/native';
import { store, persistor } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { initializeAuth } from './src/services/authService';
import { initializeFirebase } from './src/services/firebase';
import { initializeGoogleSignIn } from './src/services/googleAuthNative';
import { restoreDynamicMasterPasswordSession } from './src/services/dynamicMasterPasswordService';
import { ActivityIndicator, View, StyleSheet, AppState } from 'react-native';
import { NavigationPersistenceService } from './src/services/navigationPersistenceService';
import { sessionManager } from './src/utils/sessionManager';
import { UserActivityService } from './src/services/userActivityService';
import { useAutofillDecryption } from './src/hooks/useAutofillDecryption';

// Import polyfills for crypto and URL
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

/**
 * 🔐 AutofillDecryptionListener
 *
 * Internal component that sets up the autofill decryption listener.
 * Must be inside the Redux Provider to access store state.
 */
const AutofillDecryptionListener: React.FC = () => {
  useAutofillDecryption();
  return null; // This component doesn't render anything
};

const App: React.FC = () => {
  const navigationRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const navigationPersistence = NavigationPersistenceService.getInstance();
  const userActivityService = UserActivityService.getInstance();

  // Save navigation state when it changes (with debounce to avoid too many saves)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleNavigationStateChange = (state: NavigationState | undefined) => {
    if (state) {
      // Record user activity on navigation change
      // This ensures that navigating between screens counts as user interaction
      userActivityService.recordUserInteraction();
      console.log('🎯 User activity recorded: Navigation state changed');

      // Log the navigation state change immediately
      const path = navigationPersistence.getNavigationPath(state);
      console.log('🗺️ Navigation state changed:', {
        timestamp: new Date().toLocaleTimeString(),
        path: path?.map(p => p.screenName).join(' -> ') || 'Unknown',
      });

      // Debounce saves to avoid performance issues
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        console.log('🗺️ Auto-saving navigation state (debounced)');
        navigationPersistence.saveNavigationState(state);
      }, 500); // Save after 500ms of no navigation changes
    }
  };

  // Also save when app goes to background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        // App is going to background - save navigation state immediately
        // Clear any pending debounced save first
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }

        const currentState = navigationRef.current?.getRootState();
        if (currentState) {
          console.log(
            '🗺️ App going to background - saving navigation state immediately',
          );

          // Extract current screen info for logging
          const path = navigationPersistence.getNavigationPath(currentState);
          console.log(
            '🗺️ Background save - navigation path:',
            path?.map(p => p.screenName).join(' -> ') || 'Unknown',
          );

          navigationPersistence.saveNavigationState(currentState);
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [navigationPersistence]);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Add a small delay to ensure React Native environment is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('🚀 Initializing services...');

        // Initialize session manager for security
        sessionManager.init();
        console.log('✅ Session manager initialized');

        // Restore dynamic master password session if exists
        const restoreResult = await restoreDynamicMasterPasswordSession();
        if (restoreResult.success && restoreResult.restored) {
          console.log(
            `✅ Dynamic master password session restored: ${restoreResult.sessionId?.substring(
              0,
              20,
            )}...`,
          );
        } else {
          console.log(
            `📭 Session restore result: ${
              restoreResult.error || 'No session to restore'
            }`,
          );
        }

        // Debug session info for troubleshooting
        if (__DEV__) {
          const { debugSessionInfo } = require('./src/utils/debugSessionInfo');
          await debugSessionInfo();
        }

        // Try Firebase initialization
        try {
          const firebaseInitialized = initializeFirebase();
          if (firebaseInitialized) {
            console.log('✅ Firebase initialized successfully');
          } else {
            console.warn('⚠️ Firebase initialization failed');
          }
        } catch (firebaseError) {
          console.warn('⚠️ Firebase initialization error:', firebaseError);
        }

        // Try Auth initialization
        try {
          const authInitialized = initializeAuth();
          if (authInitialized) {
            console.log('✅ Auth initialized successfully');
          } else {
            console.warn('⚠️ Auth initialization failed');
          }
        } catch (authError) {
          console.warn('⚠️ Auth initialization error:', authError);
        }

        // Delay Google Sign-In initialization to ensure activity is ready
        setTimeout(async () => {
          try {
            const googleSignInInitialized = await initializeGoogleSignIn();

            if (googleSignInInitialized) {
              console.log('✅ Google Sign-In initialized successfully');
            } else {
              console.warn('⚠️ Google Sign-In initialization failed');
            }
          } catch (error) {
            console.warn('⚠️ Google Sign-In initialization error:', error);
          }
        }, 3000); // Wait 3 seconds for activity to be ready

        console.log('✅ Service initialization completed');
      } catch (error) {
        console.error('❌ Service initialization error:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <Provider store={store}>
      {/* 🔐 Setup autofill decryption listener */}
      <AutofillDecryptionListener />

      <PersistGate
        loading={
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        }
        persistor={persistor}
      >
        <SafeAreaProvider>
          <ThemeProvider>
            <NavigationContainer
              ref={navigationRef}
              onStateChange={handleNavigationStateChange}
            >
              <AppNavigator navigationRef={navigationRef} />
            </NavigationContainer>
          </ThemeProvider>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
