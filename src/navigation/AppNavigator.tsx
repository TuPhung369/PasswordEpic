import React, { useEffect, useState } from 'react';
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
import { SessionTimeoutModal } from '../components/SessionTimeoutModal';
import { BiometricPrompt } from '../components/BiometricPrompt';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  console.log('🔄 AppNavigator: Component rendering...');
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const {
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    session,
  } = useAppSelector(state => state.auth);
  console.log('🔄 AppNavigator: Redux state:', {
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    session,
  });

  // Biometric and session hooks - ALWAYS call these
  const { isAvailable: biometricAvailable } = useBiometric();

  const {
    isActive: sessionActive,
    isWarning: sessionWarning,
    timeRemaining,
    startSession,
    endSession,
    extendSession,
    dismissWarning,
  } = useSession();

  // App state - ALWAYS declare these
  const [appReady, setAppReady] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [sessionTimeoutVisible, setSessionTimeoutVisible] = useState(false);
  const [biometricCancelled, setBiometricCancelled] = useState(false);
  const [hasAuthenticatedInSession, setHasAuthenticatedInSession] =
    useState(false);
  const [initialAuthComplete, setInitialAuthComplete] = useState(false);
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

  // Listen for app state changes to trigger biometric on resume
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      const currentAppState = appStateRef.current;
      console.log(`🔄 App state changed: ${currentAppState} → ${nextAppState}`);

      if (
        currentAppState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App is coming from background to foreground
        console.log(
          '📱 App resumed from background - require biometric authentication',
        );

        // Use refs to get latest values without re-registering listener
        const {
          isAuthenticated: isAuthFromRef,
          masterPasswordConfigured: masterPwFromRef,
          biometricEnabled: bioEnabledFromRef,
          biometricAvailable: bioAvailableFromRef,
          initialAuthComplete: initAuthFromRef,
        } = stateRefs.current;

        // Only handle app resume if initial auth is complete
        if (!initAuthFromRef) {
          console.log(
            '🔐 App resumed but initial auth not complete - skipping biometric',
          );
          appStateRef.current = nextAppState;
          return;
        }

        if (
          isAuthFromRef &&
          masterPwFromRef &&
          bioEnabledFromRef &&
          bioAvailableFromRef
        ) {
          console.log(
            '🔐 App resumed - reset authentication flag to require biometric',
          );
          // Reset flags to trigger biometric prompt
          setHasAuthenticatedInSession(false);
          setBiometricCancelled(false);
        } else {
          // Log why we're not requiring biometric
          if (!isAuthFromRef) {
            console.log(
              '🔐 App resumed but not authenticated - skipping biometric',
            );
          } else if (!masterPwFromRef) {
            console.log(
              '🔐 App resumed but master password not configured yet - skipping biometric',
            );
          } else if (!bioEnabledFromRef) {
            console.log(
              '🔐 App resumed but biometric not enabled - skipping biometric',
            );
          } else if (!bioAvailableFromRef) {
            console.log(
              '🔐 App resumed but biometric not available - skipping biometric',
            );
          }
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, []); // Empty deps - listener only registered once

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

    console.log('🔐 shouldShowBiometric calculated:', result, {
      isAuthenticated,
      masterPasswordConfigured,
      biometricEnabled,
      biometricAvailable,
      sessionExpired: session.expired,
      biometricCancelled,
      hasAuthenticatedInSession,
      sessionActive,
      showBiometricPrompt,
      sessionTimeoutVisible,
    });

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
    showBiometricPrompt, // Added to fix ESLint warning
  ]);

  // Handle biometric prompt display
  useEffect(() => {
    console.log(
      '🔐 useEffect triggered - showBiometricPrompt:',
      showBiometricPrompt,
      'shouldShowBiometric:',
      shouldShowBiometric,
    );

    if (shouldShowBiometric && !showBiometricPrompt) {
      // All conditions met and not already showing - show it!
      console.log('🔐 Conditions met - showing biometric prompt');
      console.log('🔐 Biometric prompt conditions:', {
        isAuthenticated,
        masterPasswordConfigured,
        biometricEnabled,
        biometricAvailable,
        sessionExpired: session.expired,
        biometricCancelled,
        hasAuthenticatedInSession,
        sessionActive,
      });
      console.log('🔐 Setting showBiometricPrompt to TRUE');
      setShowBiometricPrompt(true);
    } else if (!shouldShowBiometric && showBiometricPrompt) {
      // Conditions no longer met but prompt is showing - hide it
      console.log('🔐 Conditions no longer met - hiding biometric prompt');
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

  // Handle session timeout warning
  useEffect(() => {
    if (sessionWarning && !sessionTimeoutVisible) {
      setSessionTimeoutVisible(true);
    } else if (!sessionWarning && sessionTimeoutVisible) {
      setSessionTimeoutVisible(false);
    }
  }, [sessionWarning, sessionTimeoutVisible]);

  // Handle session expiry
  useEffect(() => {
    if (session.expired && isAuthenticated) {
      // Force logout on session expiry
      dispatch(logout());
      setShowBiometricPrompt(false);
      setSessionTimeoutVisible(false);
    }
  }, [session.expired, isAuthenticated, dispatch]);

  // Handle session timeout modal actions
  const handleExtendSession = async () => {
    console.log('🔐 AppNavigator: handleExtendSession called');
    try {
      await extendSession(15);
      dismissWarning();
      setSessionTimeoutVisible(false);
      console.log('🔐 AppNavigator: Session extended successfully');
    } catch (error) {
      console.error('Failed to extend session:', error);
      dispatch(logout());
      setSessionTimeoutVisible(false);
    }
  };

  const handleSessionLogout = async () => {
    console.log('🔐 AppNavigator: handleSessionLogout called');
    try {
      await endSession();
      dispatch(logout());
      setSessionTimeoutVisible(false);
      setShowBiometricPrompt(false);
      setBiometricCancelled(false); // Reset biometric cancelled flag
      setHasAuthenticatedInSession(false); // Reset authentication flag
      console.log('🔐 AppNavigator: Session logout completed');
    } catch (error) {
      console.error('Failed to handle session logout:', error);
      // Force cleanup anyway
      dispatch(logout());
      setSessionTimeoutVisible(false);
      setShowBiometricPrompt(false);
      setHasAuthenticatedInSession(false);
    }
  };

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

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && masterPasswordConfigured ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>

      {/* Biometric Prompt Modal */}
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={async () => {
          console.log('Biometric modal cancelled - logging out');
          setShowBiometricPrompt(false);
          setBiometricCancelled(true);
          setHasAuthenticatedInSession(false);

          try {
            // End session and clear all auth state
            await endSession();
            dispatch(logout());

            // Force clear all local state immediately
            setSessionTimeoutVisible(false);

            console.log('Logout completed after biometric cancel');
          } catch (error) {
            console.error('Error during biometric cancel logout:', error);
            dispatch(logout());
          }
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

          // End session and clear all auth state
          try {
            await endSession();
            dispatch(logout());

            // Force clear all local state immediately
            setSessionTimeoutVisible(false);

            console.log('Logout completed after biometric error');
          } catch (err) {
            console.error('Error during biometric error logout:', err);
            dispatch(logout());
          }
        }}
        title="Unlock PasswordEpic"
        subtitle="Use your biometric to unlock the app"
      />

      {/* Session Timeout Modal */}
      <SessionTimeoutModal
        visible={sessionTimeoutVisible}
        timeRemaining={timeRemaining}
        onExtend={handleExtendSession}
        onLogout={handleSessionLogout}
      />
    </>
  );
};

const styles = StyleSheet.create({
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
});
