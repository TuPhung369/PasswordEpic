import React, { useEffect, useState } from 'react';
// @ts-ignore - Type declarations exist but TypeScript can't find them
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  AppState,
} from 'react-native';

import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { onAuthStateChanged } from '../services/authService';
import {
  loginSuccess,
  logout,
  setMasterPasswordConfigured,
  setBiometricEnabled,
} from '../store/slices/authSlice';
import { isMasterPasswordSet } from '../services/secureStorageService';
import { useBiometric } from '../hooks/useBiometric';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../contexts/ThemeContext';
import { BiometricPrompt } from '../components/BiometricPrompt';
import { MasterPasswordPrompt } from '../components/MasterPasswordPrompt';
import { useUserActivity } from '../hooks/useUserActivity';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  // console.log('🔄 AppNavigator: Component rendering...');
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const {
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    session,
  } = useAppSelector(state => state.auth);
  const { security } = useAppSelector(state => state.settings);
  // console.log('🔄 AppNavigator: Redux state:', {
  //   isAuthenticated,
  //   masterPasswordConfigured,
  //   biometricEnabled,
  //   session,
  // });

  // Biometric and session hooks - ALWAYS call these
  const { isAvailable: biometricAvailable } = useBiometric();

  const { isActive: sessionActive, startSession, endSession } = useSession();

  // User activity tracking for proper auto-lock based on interaction
  const { updateConfig: updateActivityConfig, panResponder } = useUserActivity(
    () => {
      // Auto-lock callback when user is inactive
      console.log('🎯 Auto-lock triggered due to user inactivity');
      if (
        isAuthenticated &&
        masterPasswordConfigured &&
        biometricEnabled &&
        biometricAvailable
      ) {
        setHasAuthenticatedInSession(false);
        setBiometricCancelled(false);
      }
    },
    {
      inactivityTimeout: 5, // Will be updated from settings
      trackUserInteraction: true,
    },
  );

  // App state - ALWAYS declare these
  const [appReady, setAppReady] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [sessionTimeoutVisible, setSessionTimeoutVisible] = useState(false);
  const [biometricCancelled, setBiometricCancelled] = useState(false);
  const [hasAuthenticatedInSession, setHasAuthenticatedInSession] =
    useState(false);
  const [initialAuthComplete, setInitialAuthComplete] = useState(false);
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] =
    useState(false);
  const appStateRef = React.useRef(AppState.currentState);

  // Use refs to track latest values without causing re-renders
  const stateRefs = React.useRef({
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    biometricAvailable,
    initialAuthComplete,
  });

  // Update refs when values change
  React.useEffect(() => {
    stateRefs.current = {
      isAuthenticated,
      masterPasswordConfigured,
      biometricEnabled,
      biometricAvailable,
      initialAuthComplete,
    };
  }, [
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    biometricAvailable,
    initialAuthComplete,
  ]);

  // Sync auto-lock timeout from settings to user activity service
  React.useEffect(() => {
    const syncActivityTimeout = async () => {
      try {
        console.log(
          '🎯 Syncing activity timeout from settings:',
          security.autoLockTimeout,
          'minutes',
        );
        await updateActivityConfig({
          inactivityTimeout: security.autoLockTimeout,
        });
        console.log(
          '🎯 Updated activity timeout to:',
          security.autoLockTimeout,
          'minutes',
        );
      } catch (error) {
        console.error('Failed to update activity timeout:', error);
      }
    };

    syncActivityTimeout();
  }, [security.autoLockTimeout, updateActivityConfig]);

  // Initialize app (no dependencies, runs once)
  useEffect(() => {
    setAppReady(true);
  }, []);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(async user => {
      if (user) {
        // User is signed in
        dispatch(
          loginSuccess({
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName,
            photoURL: user.photoURL,
          }),
        );

        // Only reset biometric cancelled flag if this is a fresh login (not auto-restore)
        // We detect this by checking if the user was previously not authenticated
        if (!isAuthenticated) {
          console.log(
            'Fresh login detected - resetting biometric cancelled flag and requiring biometric',
          );
          setBiometricCancelled(false);
          setHasAuthenticatedInSession(false); // Require biometric authentication after fresh login
        } else {
          console.log('Auth state restored - keeping biometric cancelled flag');
        }

        // Check master password and biometric status
        try {
          const masterPasswordSet = await isMasterPasswordSet();

          // Check actual biometric status from storage
          const { getBiometricStatus } = await import(
            '../services/secureStorageService'
          );
          const biometricStatus = await getBiometricStatus();

          dispatch(setMasterPasswordConfigured(masterPasswordSet));
          dispatch(setBiometricEnabled(biometricStatus));

          console.log(
            'Login initialized - biometric status from storage:',
            biometricStatus,
          );

          // Start session after successful authentication
          if (masterPasswordSet) {
            console.log('🔐 Starting session after login...');
            await startSession();
            console.log('🔐 Session started, sessionActive should be set now');
          } else {
            console.log('🔐 Master password not set - skipping session start');
          }

          // Mark initial auth as complete
          console.log('🔐 Marking initial auth as complete');
          setInitialAuthComplete(true);
        } catch (error) {
          console.error('Failed to check security settings:', error);
          setInitialAuthComplete(true);
        }
      } else {
        // User is signed out
        await endSession();
        dispatch(logout());
        setInitialAuthComplete(false);
        setBiometricCancelled(false);
        setHasAuthenticatedInSession(false);
      }

      setAppReady(true);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [
    dispatch,
    startSession,
    endSession,
    biometricEnabled,
    biometricCancelled,
    isAuthenticated,
  ]);

  // Simple app state tracking (no auto-lock logic here)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      console.log(
        `� App state changed: ${appStateRef.current} → ${nextAppState}`,
      );

      // Just track app state, actual auto-lock is handled by UserActivityService
      if (nextAppState === 'active' && appStateRef.current !== 'active') {
        console.log(
          '� App became active - user activity will handle auto-lock logic',
        );
        // Don't record interaction here - let UserActivityService handle it
        // This prevents resetting the timer when app comes from background
        // The service will check if enough time has passed and trigger lock if needed
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, []);

  // Add delay state to prevent immediate biometric prompt on app resume
  const [_biometricPromptDelay, _setBiometricPromptDelay] = useState(false);

  // Track if user is in sensitive operations (like adding/editing passwords)
  const [_isInSensitiveOperation, _setIsInSensitiveOperation] = useState(false);

  // Track when conditions change to trigger biometric authentication
  const shouldShowBiometric = React.useMemo(() => {
    const result =
      isAuthenticated &&
      masterPasswordConfigured &&
      biometricEnabled &&
      biometricAvailable &&
      !session.expired &&
      !biometricCancelled &&
      !hasAuthenticatedInSession &&
      sessionActive !== undefined &&
      !sessionTimeoutVisible;

    // Biometric prompt decision calculated

    return result;
  }, [
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    biometricAvailable,
    session.expired,
    biometricCancelled,
    hasAuthenticatedInSession,
    sessionActive,
    sessionTimeoutVisible,
  ]);

  // Save current navigation state before showing authentication
  const saveNavigationState = async () => {
    try {
      // Navigation state is already being saved by App.tsx and MainNavigator
      console.log('💾 Navigation state will be preserved by MainNavigator...');
    } catch (error) {
      console.error('Failed to save navigation state:', error);
    }
  };

  // Handle biometric prompt display
  useEffect(() => {
    // Biometric prompt effect triggered

    if (shouldShowBiometric && !showBiometricPrompt) {
      // Save navigation state before showing prompt
      saveNavigationState();

      // All conditions met and not already showing - show it!
      // Showing biometric prompt
      setShowBiometricPrompt(true);
    } else if (!shouldShowBiometric && showBiometricPrompt) {
      // Conditions no longer met but prompt is showing - hide it
      // Hiding biometric prompt - conditions no longer met
      setShowBiometricPrompt(false);
    } else if (showBiometricPrompt) {
      console.log('Not showing biometric prompt - already showing');
    } else {
      // Log why we're not showing the prompt
      if (!isAuthenticated) {
        console.log('Not showing biometric prompt - not authenticated');
      } else if (!masterPasswordConfigured) {
        console.log(
          'Not showing biometric prompt - master password not configured',
        );
      } else if (!biometricEnabled) {
        console.log('Not showing biometric prompt - biometric not enabled');
      } else if (!biometricAvailable) {
        console.log('Not showing biometric prompt - biometric not available');
      } else if (session.expired) {
        console.log('Not showing biometric prompt - session expired');
      } else if (biometricCancelled) {
        console.log('Not showing biometric prompt - user cancelled');
      } else if (hasAuthenticatedInSession) {
        console.log(
          'Not showing biometric prompt - already authenticated in this session',
        );
      } else if (sessionActive === undefined) {
        console.log('Not showing biometric prompt - session not initialized');
      } else if (sessionTimeoutVisible) {
        console.log('Not showing biometric prompt - session timeout visible');
      }
    }
  }, [
    shouldShowBiometric,
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    biometricAvailable,
    session.expired,
    biometricCancelled,
    hasAuthenticatedInSession,
    sessionActive,
    sessionTimeoutVisible,
    showBiometricPrompt, // Added to fix ESLint warning
  ]);

  // Reset authentication flag when user logs in (only when transitioning to logged in state)
  const prevAuthRef = React.useRef(isAuthenticated && masterPasswordConfigured);
  useEffect(() => {
    const currentlyLoggedIn = isAuthenticated && masterPasswordConfigured;
    if (currentlyLoggedIn && !prevAuthRef.current) {
      // Just became logged in - require biometric authentication
      console.log('🔐 User just logged in - require biometric authentication');

      // Reset biometric cancelled flag on fresh login
      setBiometricCancelled(false);
      setHasAuthenticatedInSession(false);

      // Start session if not already started
      if (!sessionActive) {
        console.log('🔐 Starting session after master password setup');
        startSession().catch(error => {
          console.error('Failed to start session:', error);
        });
      }
    }
    prevAuthRef.current = currentlyLoggedIn;
  }, [isAuthenticated, masterPasswordConfigured, sessionActive, startSession]);

  // Handle session expiry - Auto logout without warning modal
  useEffect(() => {
    if (session.expired && isAuthenticated) {
      console.log('🔐 Session expired - Auto logout without warning');
      // Force logout immediately on session expiry
      dispatch(logout());
      setShowBiometricPrompt(false);
      setSessionTimeoutVisible(false);
    }
  }, [session.expired, isAuthenticated, dispatch]);

  // Loading screen while app initializes
  if (!appReady) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Initializing PasswordEpic...
        </Text>
      </View>
    );
  }

  // Determine if we should block main navigator access
  const shouldBlockMainAccess =
    isAuthenticated &&
    masterPasswordConfigured &&
    !hasAuthenticatedInSession &&
    (showBiometricPrompt || showMasterPasswordPrompt);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
        {!isAuthenticated || !masterPasswordConfigured ? (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        ) : (
          <Stack.Screen
            name="Main"
            component={MainNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>

      {/* Authentication Overlay */}
      {shouldBlockMainAccess && (
        <View
          style={[styles.authOverlay, { backgroundColor: theme.background }]}
        >
          <View style={styles.authOverlayContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.authOverlayText, { color: theme.text }]}>
              Authentication Required
            </Text>
          </View>
        </View>
      )}

      {/* Biometric Prompt Modal */}
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={async () => {
          console.log('Biometric modal cancelled - requiring master password');
          setShowBiometricPrompt(false);
          setBiometricCancelled(true);
          setHasAuthenticatedInSession(false);

          // Show master password prompt instead of logging out
          setShowMasterPasswordPrompt(true);
        }}
        onSuccess={() => {
          console.log('Biometric authentication successful');
          setShowBiometricPrompt(false);
          setBiometricCancelled(false); // Reset flag on success
          setHasAuthenticatedInSession(true); // Mark as authenticated in this session
        }}
        onError={async error => {
          console.error('Biometric authentication failed:', error);
          setShowBiometricPrompt(false);
          setBiometricCancelled(true);
          setHasAuthenticatedInSession(false);

          // Show master password prompt instead of logging out
          setShowMasterPasswordPrompt(true);
        }}
        title="Unlock PasswordEpic"
        subtitle="Use your biometric to unlock the app"
      />

      {/* Master Password Prompt Modal */}
      <MasterPasswordPrompt
        visible={showMasterPasswordPrompt}
        onSuccess={() => {
          console.log('Master password authentication successful');
          setShowMasterPasswordPrompt(false);
          setBiometricCancelled(false);
          setHasAuthenticatedInSession(true);
          // Restart session after successful master password entry
          startSession().catch(error => {
            console.error('Failed to restart session:', error);
          });
        }}
        onCancel={async () => {
          console.log('Master password cancelled - logging out');
          setShowMasterPasswordPrompt(false);

          try {
            // Only logout completely if user cancels master password
            await endSession();
            dispatch(logout());
            setBiometricCancelled(false);
            setHasAuthenticatedInSession(false);
          } catch (error) {
            console.error('Error during master password cancel logout:', error);
            dispatch(logout());
          }
        }}
        title="Authentication Required"
        subtitle="Enter your master password to continue using the app"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  authOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  authOverlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  authOverlayText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
