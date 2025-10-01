import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, StyleSheet, AppState } from 'react-native';
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
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const {
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    session,
  } = useAppSelector(state => state.auth);

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
  const [hasAuthenticatedInSession, setHasAuthenticatedInSession] = useState(false);
  const appStateRef = React.useRef(AppState.currentState);

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
            'Fresh login detected - resetting biometric cancelled flag',
          );
          setBiometricCancelled(false);
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
            await startSession();
          }
        } catch (error) {
          console.error('Failed to check security settings:', error);
        }
      } else {
        // User is signed out
        await endSession();
        dispatch(logout());
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
      
      if (currentAppState.match(/inactive|background/) && nextAppState === 'active') {
        // App is coming from background to foreground
        console.log('📱 App resumed from background - require biometric authentication');
        if (isAuthenticated && masterPasswordConfigured && biometricEnabled && biometricAvailable) {
          console.log('🔐 Reset authentication flag - biometric required');
          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            setHasAuthenticatedInSession(false);
          }, 0);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isAuthenticated, masterPasswordConfigured, biometricEnabled, biometricAvailable]); // Add dependencies for auth state listener

  // Track when conditions change to trigger biometric authentication
  const shouldShowBiometric = React.useMemo(() => {
    return (
      isAuthenticated &&
      masterPasswordConfigured &&
      biometricEnabled &&
      biometricAvailable &&
      !session.expired &&
      !biometricCancelled &&
      !hasAuthenticatedInSession &&
      sessionActive !== undefined &&
      !showBiometricPrompt &&
      !sessionTimeoutVisible
    );
  }, [
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    biometricAvailable,
    session.expired,
    biometricCancelled,
    hasAuthenticatedInSession,
    sessionActive,
    showBiometricPrompt,
    sessionTimeoutVisible,
  ]);

  // Handle biometric prompt display
  useEffect(() => {
    if (shouldShowBiometric) {
      console.log('🔐 Conditions met - showing biometric prompt');
      setShowBiometricPrompt(true);
    } else {
      // Log why we're not showing the prompt
      if (!isAuthenticated) {
        console.log('Not showing biometric prompt - not authenticated');
      } else if (!masterPasswordConfigured) {
        console.log('Not showing biometric prompt - master password not configured');
      } else if (!biometricEnabled) {
        console.log('Not showing biometric prompt - biometric not enabled');
      } else if (!biometricAvailable) {
        console.log('Not showing biometric prompt - biometric not available');
      } else if (session.expired) {
        console.log('Not showing biometric prompt - session expired');
      } else if (biometricCancelled) {
        console.log('Not showing biometric prompt - user cancelled');
      } else if (hasAuthenticatedInSession) {
        console.log('Not showing biometric prompt - already authenticated in this session');
      }
    }
  }, [shouldShowBiometric, isAuthenticated, masterPasswordConfigured, biometricEnabled, biometricAvailable, session.expired, biometricCancelled, hasAuthenticatedInSession]);

  // Reset authentication flag when user logs in (only when transitioning to logged in state)
  const prevAuthRef = React.useRef(isAuthenticated && masterPasswordConfigured);
  useEffect(() => {
    const currentlyLoggedIn = isAuthenticated && masterPasswordConfigured;
    if (currentlyLoggedIn && !prevAuthRef.current) {
      // Just became logged in - reset for new session
      console.log('🔐 User just logged in - reset biometric authentication flag');
      setHasAuthenticatedInSession(false);
    }
    prevAuthRef.current = currentlyLoggedIn;
  }, [isAuthenticated, masterPasswordConfigured]);

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
