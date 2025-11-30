import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import {
  NavigationContainer,
  type NavigationState,
} from '@react-navigation/native';
import { store, persistor } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { BiometricProvider } from './src/contexts/BiometricContext';
import { initializeAuth } from './src/services/authService';
import { initializeFirebase } from './src/services/firebase';
import { initializeGoogleSignIn } from './src/services/googleAuthNative';
import { AppState } from 'react-native';
import { NavigationPersistenceService } from './src/services/navigationPersistenceService';
import { sessionManager } from './src/utils/sessionManager';
import { UserActivityService } from './src/services/userActivityService';
import { useAutofillDecryption } from './src/hooks/useAutofillDecryption';
import { setShouldNavigateToUnlock } from './src/store/slices/authSlice';
import { LoadingScreen } from './src/components/LoadingScreen';
import { LoadingOverlayProvider } from './src/contexts/LoadingOverlayContext';
import LanguageSynchronizer from './src/components/LanguageSynchronizer';

// Import polyfills for crypto and URL
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Initialize i18n
import './src/services/i18n';

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

  const isCurrentScreenAutofillManagement = (
    state: NavigationState | undefined,
  ): boolean => {
    if (!state) return false;

    let currentState: any = state;
    while (currentState.routes && currentState.index !== undefined) {
      const activeRoute = currentState.routes[currentState.index];
      if (activeRoute.name === 'AutofillManagement') {
        return true;
      }
      if (activeRoute.state) {
        currentState = activeRoute.state;
      } else {
        break;
      }
    }
    return false;
  };

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

      // Check if we're on AutofillManagement - if so, don't persist the state
      // This prevents getting stuck on AutofillManagement when tapping Settings tab
      if (isCurrentScreenAutofillManagement(state)) {
        console.log(
          '🗺️ ⚠️ Currently on AutofillManagement - skipping navigation state persistence to prevent tab navigation issues',
        );
        // Clear any pending save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        return;
      }

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
    console.log(
      '🔍 [App.tsx] ===== REGISTERING AppState listener (MAIN) =====',
    );

    const handleAppStateChange = async (nextAppState: any) => {
      console.log(
        `🔍 [App.tsx] ===== AppState CHANGED: ${appStateRef.current} -> ${nextAppState} =====`,
      );

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
          // Don't save if we're currently on AutofillManagement
          if (isCurrentScreenAutofillManagement(currentState)) {
            console.log(
              '🗺️ ⚠️ App going to background but on AutofillManagement - skipping save',
            );
            appStateRef.current = nextAppState;
            return;
          }

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
      // 🔥 NEW: Handle app resume - trigger biometric
      // ✅ REMOVED: Biometric on app resume
      // AppNavigator now handles biometric authentication via AppState listener
      // This prevents duplicate biometric prompts

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
        // 🔥 CRITICAL: Set unlock flag immediately on cold start to prevent showing Main stack
        // This ensures Auth stack (with Master Password or Biometric) is shown first
        console.log(
          '🔍 [App.tsx] Checking if app needs unlock on cold start...',
        );
        const auth = store.getState().auth;
        if (
          auth.isAuthenticated &&
          auth.masterPasswordConfigured &&
          !auth.hasCompletedSessionAuth
        ) {
          console.log(
            '🔐 [App.tsx] Cold start detected - setting shouldNavigateToUnlock=true',
          );
          store.dispatch(setShouldNavigateToUnlock(true));
        }

        // Add a small delay to ensure React Native environment is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('🚀 Initializing services...');

        // Initialize session manager for security
        sessionManager.init();
        console.log('✅ Session manager initialized');

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
            // Reset initialization state in case of hot reload
            const { __resetInitializationState } = await import(
              './src/services/googleAuthNative'
            );
            __resetInitializationState();

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

        // 🔥 REMOVED: Premature biometric on cold start
        // AppNavigator now handles all biometric authentication properly:
        // - On app RESUME (background → active): AppNavigator triggers biometric via AppState listener
        // - On COLD START: AppNavigator sets needsUnlock=true, MasterPasswordScreen auto-triggers biometric
        // This prevents duplicate, conflicting biometric attempts and ensures proper fallback navigation
      } catch (error) {
        console.error('❌ Service initialization error:', error);
      }
    };

    initializeServices();
  }, []);

  const styles = StyleSheet.create({
    flex1: {
      flex: 1,
    },
  });

  return (
    <GestureHandlerRootView style={styles.flex1}>
      <Provider store={store}>
        {/* 🔐 Setup autofill decryption listener */}
        <AutofillDecryptionListener />

        <PersistGate
          loading={<LoadingScreen visible={true} />}
          persistor={persistor}
        >
          {/* 🌍 Sync i18n language with Redux store after rehydration */}
          <LanguageSynchronizer />

          <LoadingOverlayProvider>
            <BiometricProvider>
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
            </BiometricProvider>
          </LoadingOverlayProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;
