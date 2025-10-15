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
import ConfirmDialog from '../components/ConfirmDialog';
import { useUserActivity } from '../hooks/useUserActivity';
import { NavigationPersistenceService } from '../services/navigationPersistenceService';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  navigationRef?: React.RefObject<any>;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
  navigationRef,
}) => {
  // console.log('🔄 AppNavigator: Component rendering...');
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const navPersistence = NavigationPersistenceService.getInstance();
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
    async () => {
      // Auto-lock callback when user is inactive
      console.log('🎯 Auto-lock triggered due to user inactivity');
      if (
        isAuthenticated &&
        masterPasswordConfigured &&
        biometricEnabled &&
        biometricAvailable
      ) {
        // Save navigation state immediately to restore after unlock
        try {
          const currentState = navigationRef?.current?.getRootState();
          if (currentState) {
            console.log('🎯 Auto-lock: Saving navigation state for restore');
            const path = navPersistence.getNavigationPath(currentState);
            console.log(
              '🎯 Auto-lock navigation path:',
              path?.map(p => p.screenName).join(' -> ') || 'Unknown',
            );
            await navPersistence.saveNavigationState(currentState);
            console.log('🎯 Auto-lock: Navigation state saved successfully');
          }
        } catch (error) {
          console.error(
            'Failed to save navigation state during auto-lock:',
            error,
          );
        }

        // Trigger biometric authentication requirement (no session extension needed)
        // Session remains valid (7 days), only user interaction is locked
        console.log('🎯 Auto-lock: Requiring biometric authentication');
        setHasAuthenticatedInSession(false);
        setBiometricCancelled(false);
      }
    },
    {
      inactivityTimeout: security.autoLockTimeout || 5, // Use setting value, default to 5 minutes
      trackUserInteraction: true,
    },
  );

  // App state - ALWAYS declare these
  const [appReady, setAppReady] = useState(true);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [sessionTimeoutVisible, setSessionTimeoutVisible] = useState(false);
  const [biometricCancelled, setBiometricCancelled] = useState(false);
  // Start with hasAuthenticatedInSession = true on app start to prevent biometric prompt on restart
  // This will be set to false when user explicitly logs in (fresh login)
  const [hasAuthenticatedInSession, setHasAuthenticatedInSession] =
    useState(true);
  const [initialAuthComplete, setInitialAuthComplete] = useState(false);
  const [showMasterPasswordPrompt, setShowMasterPasswordPrompt] =
    useState(false);
  const [isCheckingSessionOnResume, setIsCheckingSessionOnResume] =
    useState(false);

  // Track biometric authentication failure attempts
  // Each session allows ~5 fingerprint attempts + 1 PIN attempt = ~6 total attempts
  // 2 sessions = ~12 total attempts before forcing master password
  const [biometricFailCount, setBiometricFailCount] = useState(0);
  const MAX_BIOMETRIC_ATTEMPTS = 2;
  const appStateRef = React.useRef(AppState.currentState);

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmStyle?: 'default' | 'destructive';
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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

  // Load initial auto-lock timeout from UserActivityService on first mount
  // This ensures we preserve any existing user preference before Redux Persist was added
  React.useEffect(() => {
    const loadInitialTimeout = async () => {
      try {
        const AsyncStorage = (
          await import('@react-native-async-storage/async-storage')
        ).default;
        const configStr = await AsyncStorage.getItem('user_activity_config');

        if (configStr) {
          const savedConfig = JSON.parse(configStr);
          const savedTimeout = savedConfig.inactivityTimeout;

          // If saved timeout differs from Redux default, update Redux to match
          if (savedTimeout && savedTimeout !== security.autoLockTimeout) {
            // console.log(
            //   '🎯 Loading existing auto-lock timeout from UserActivityService:',
            //   savedTimeout,
            //   'minutes (Redux has:',
            //   security.autoLockTimeout,
            //   'minutes)',
            // );

            // Import updateSecuritySettings dynamically to avoid circular dependency
            const { updateSecuritySettings } = await import(
              '../store/slices/settingsSlice'
            );
            dispatch(updateSecuritySettings({ autoLockTimeout: savedTimeout }));

            // console.log(
            //   '🎯 Updated Redux to match UserActivityService:',
            //   savedTimeout,
            //   'minutes',
            // );
          }
        }
      } catch (error) {
        console.error('Failed to load initial activity timeout:', error);
      }
    };

    loadInitialTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Sync auto-lock timeout from settings to user activity service
  React.useEffect(() => {
    const syncActivityTimeout = async () => {
      try {
        // console.log(
        //   '🎯 Syncing activity timeout from settings:',
        //   security.autoLockTimeout,
        //   'minutes',
        // );
        await updateActivityConfig({
          inactivityTimeout: security.autoLockTimeout,
        });
        // console.log(
        //   '🎯 Updated activity timeout to:',
        //   security.autoLockTimeout,
        //   'minutes',
        // );
      } catch (error) {
        console.error('Failed to update activity timeout:', error);
      }
    };

    syncActivityTimeout();
  }, [security.autoLockTimeout, updateActivityConfig]);

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
        // We detect this by checking if the user was previously not authenticated AND initial auth was already complete
        // This prevents triggering biometric on app restart when Firebase restores the session
        if (!isAuthenticated && initialAuthComplete) {
          // console.log(
          //   '🔐 Fresh login detected - resetting biometric cancelled flag and requiring biometric',
          // );
          setBiometricCancelled(false);
          setHasAuthenticatedInSession(false); // Require biometric authentication after fresh login
        } else if (!isAuthenticated && !initialAuthComplete) {
          // On app restart, ALWAYS require biometric authentication
          // This provides better security and immediate user verification
          console.log('🔐 App restart: Requiring biometric authentication');
          setHasAuthenticatedInSession(false);
        } else {
          // console.log(
          //   '🔐 Auth state change while already authenticated - keeping biometric state',
          // );
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

          // console.log(
          //   'Login initialized - biometric status from storage:',
          //   biometricStatus,
          // );

          // Start session after successful authentication
          if (masterPasswordSet) {
            // console.log('🔐 Starting session after login...');
            await startSession();
            // console.log('🔐 Session started, sessionActive should be set now');
          } else {
            // console.log('🔐 Master password not set - skipping session start');
          }

          // Mark initial auth as complete IMMEDIATELY to show biometric prompt
          // Don't wait for password cache warming
          // console.log('🔐 Marking initial auth as complete');
          setInitialAuthComplete(true);

          // Pre-warm static master password cache in background (non-blocking)
          // This avoids delay when PasswordsScreen loads
          if (masterPasswordSet) {
            console.log(
              '🔥 [AppNavigator] Pre-warming static master password cache...',
            );

            // Import and generate in background (don't await - let it run async)
            import('../services/staticMasterPasswordService')
              .then(({ getEffectiveMasterPassword }) => {
                // Start timing AFTER import completes
                const startTime = Date.now();
                return getEffectiveMasterPassword().then(result => ({
                  result,
                  startTime,
                }));
              })
              .then(({ result, startTime }) => {
                const duration = Date.now() - startTime;
                if (result.success) {
                  console.log(
                    `✅ [AppNavigator] Static master password cached (${duration}ms)`,
                  );
                } else {
                  console.warn(
                    '⚠️ [AppNavigator] Failed to pre-warm cache:',
                    result.error,
                  );
                }
              })
              .catch(error => {
                console.error('❌ [AppNavigator] Pre-warm error:', error);
              });
          }
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
    initialAuthComplete,
  ]);

  // Simple app state tracking (no auto-lock logic here)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      // console.log(
      //   `� App state changed: ${appStateRef.current} → ${nextAppState}`,
      // );

      // Just track app state, actual auto-lock is handled by UserActivityService
      if (nextAppState === 'active' && appStateRef.current !== 'active') {
        // console.log(
        //   '� App became active - user activity will handle auto-lock logic',
        // );
        // Don't record interaction here - let UserActivityService handle it
        // This prevents resetting the timer when app comes from background
        // The service will check if enough time has passed and trigger lock if needed
      }

      // When app goes to background, prepare for session check on resume
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (
          stateRefs.current.isAuthenticated &&
          stateRefs.current.masterPasswordConfigured &&
          stateRefs.current.initialAuthComplete
        ) {
          setIsCheckingSessionOnResume(true);
        }
      }

      // Clear checking flag when app becomes active
      if (nextAppState === 'active' && appStateRef.current !== 'active') {
        setTimeout(() => {
          setIsCheckingSessionOnResume(false);
        }, 500);
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
      !sessionTimeoutVisible &&
      initialAuthComplete; // Only show biometric after Firebase auth is initialized

    console.log('🔐 shouldShowBiometric calculated:', {
      result,
      isAuthenticated,
      masterPasswordConfigured,
      biometricEnabled,
      biometricAvailable,
      sessionExpired: session.expired,
      biometricCancelled,
      hasAuthenticatedInSession,
      sessionActive,
      sessionTimeoutVisible,
      initialAuthComplete,
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
    initialAuthComplete,
  ]);

  // Handle biometric prompt display
  useEffect(() => {
    console.log('🔐 Biometric prompt effect triggered:', {
      shouldShowBiometric,
      showBiometricPrompt,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (shouldShowBiometric && !showBiometricPrompt) {
      // Show modal immediately using synchronous state update
      console.log('🔐 [AppNavigator] Showing biometric prompt immediately');

      // Use requestAnimationFrame to ensure modal shows on next frame (faster than setTimeout)
      requestAnimationFrame(() => {
        setShowBiometricPrompt(true);
      });

      // Move async operations to background (non-blocking)
      (async () => {
        try {
          const currentState = navigationRef?.current?.getRootState();
          if (currentState) {
            await navPersistence.saveNavigationState(currentState);
          }
        } catch (error) {
          console.error('Failed to save navigation state:', error);
        }
      })();
    } else if (!shouldShowBiometric && showBiometricPrompt) {
      // Conditions no longer met but prompt is showing - hide it
      // console.log('❌ Hiding biometric prompt - conditions no longer met');
      setShowBiometricPrompt(false);
    } else if (showBiometricPrompt) {
      // console.log('Not showing biometric prompt - already showing');
    } else {
      // Log why we're not showing the prompt
      if (!isAuthenticated) {
        console.log('❌ Not showing biometric prompt - user not authenticated');
        return;
      }
      // if (!masterPasswordConfigured) {
      //   console.log(
      //     'Not showing biometric prompt - master password not configured',
      //   );
      // } else if (!biometricEnabled) {
      //   console.log('Not showing biometric prompt - biometric not enabled');
      // } else if (!biometricAvailable) {
      //   console.log('Not showing biometric prompt - biometric not available');
      // } else if (session.expired) {
      //   console.log('Not showing biometric prompt - session expired');
      // } else if (biometricCancelled) {
      //   console.log('Not showing biometric prompt - user cancelled');
      // } else if (hasAuthenticatedInSession) {
      //   console.log(
      //     'Not showing biometric prompt - already authenticated in this session',
      //   );
      // } else if (sessionActive === undefined) {
      //   console.log('Not showing biometric prompt - session not initialized');
      // } else if (sessionTimeoutVisible) {
      //   console.log('Not showing biometric prompt - session timeout visible');
      // } else if (!initialAuthComplete) {
      //   console.log('Not showing biometric prompt - initial auth not complete');
      // }
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
    showBiometricPrompt,
    initialAuthComplete,
    navPersistence,
    navigationRef,
  ]);

  // Reset authentication flag when user logs in (only when transitioning to logged in state)
  const prevAuthRef = React.useRef(isAuthenticated && masterPasswordConfigured);
  useEffect(() => {
    const currentlyLoggedIn = isAuthenticated && masterPasswordConfigured;
    if (currentlyLoggedIn && !prevAuthRef.current && initialAuthComplete) {
      // Just became logged in AFTER initial auth - this is a fresh login/setup
      // Don't trigger on app restart (when initialAuthComplete is still false)
      console.log(
        '🔐 User just logged in (fresh) - require biometric authentication',
      );

      // Reset biometric cancelled flag on fresh login
      setBiometricCancelled(false);
      setHasAuthenticatedInSession(false);

      // Start session if not already started
      if (!sessionActive) {
        // console.log('🔐 Starting session after master password setup');
        startSession().catch(error => {
          console.error('Failed to start session:', error);
        });
      }
    }
    prevAuthRef.current = currentlyLoggedIn;
  }, [
    isAuthenticated,
    masterPasswordConfigured,
    sessionActive,
    startSession,
    initialAuthComplete,
  ]);

  // Handle session expiry - Auto logout without warning modal
  useEffect(() => {
    if (session.expired && isAuthenticated) {
      // console.log('🔐 Session expired - Auto logout without warning');
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
  // Show overlay immediately when authentication is required, even before prompts are shown
  // This prevents the flash of content when session expires or app resumes from background
  const shouldBlockMainAccess =
    isAuthenticated &&
    masterPasswordConfigured &&
    !hasAuthenticatedInSession &&
    initialAuthComplete && // Only block after initial auth is complete
    (showBiometricPrompt ||
      showMasterPasswordPrompt ||
      shouldShowBiometric ||
      isCheckingSessionOnResume);

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

      {/* Authentication Overlay - Blocks all content behind with opaque overlay */}
      {shouldBlockMainAccess && (
        <View style={styles.authOverlay}>
          <View style={styles.authOverlayContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.authOverlayText}>Authentication Required</Text>
          </View>
        </View>
      )}

      {/* Biometric Prompt Modal */}
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={async () => {
          console.log('🔐 Biometric cancelled by user');

          // Increment fail count
          const newFailCount = biometricFailCount + 1;
          setBiometricFailCount(newFailCount);
          console.log(
            `🔐 Biometric fail count: ${newFailCount}/${MAX_BIOMETRIC_ATTEMPTS}`,
          );

          setShowBiometricPrompt(false);
          setBiometricCancelled(true);
          setHasAuthenticatedInSession(false);

          // Check if max attempts reached
          if (newFailCount >= MAX_BIOMETRIC_ATTEMPTS) {
            console.log(
              '🔐 Max biometric attempts reached - forcing master password',
            );
            setConfirmDialog({
              visible: true,
              title: 'Too Many Failed Attempts',
              message:
                'For security reasons, please authenticate using your master password.',
              confirmText: 'OK',
              onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, visible: false }));
                setBiometricFailCount(0); // Reset counter
                setShowMasterPasswordPrompt(true);
              },
            });
          } else {
            // Show master password prompt as fallback
            setShowMasterPasswordPrompt(true);
          }
        }}
        onSuccess={async () => {
          console.log('🔐 Biometric authentication successful');

          // Reset fail counter on success
          setBiometricFailCount(0);

          setShowBiometricPrompt(false);
          setBiometricCancelled(false); // Reset flag on success
          setHasAuthenticatedInSession(true); // Mark as authenticated in this session
          setIsCheckingSessionOnResume(false); // Clear resume checking flag

          // Update master password last verified timestamp
          try {
            const { updateMasterPasswordLastVerified } = await import(
              '../services/secureStorageService'
            );
            await updateMasterPasswordLastVerified();
          } catch (error) {
            console.error('Failed to update master password timestamp:', error);
          }

          // Restart session after successful biometric authentication
          // This ensures the session timer is reset and synchronized
          startSession().catch(error => {
            console.error('Failed to restart session:', error);
          });

          // Re-sync auto-lock timeout from settings after unlock
          // This ensures the timer uses the current user setting and restarts the timer
          try {
            await updateActivityConfig({
              inactivityTimeout: security.autoLockTimeout,
              trackUserInteraction: true, // Ensure tracking is enabled
            });
            console.log(
              '🎯 Re-synced auto-lock timeout after unlock:',
              security.autoLockTimeout,
              'minutes',
            );
          } catch (error) {
            console.error(
              'Failed to re-sync activity timeout after unlock:',
              error,
            );
          }

          // Trigger navigation restoration using the new service
          try {
            await navPersistence.markForRestore();
            // console.log('🗺️ Biometric success - restoring navigation');

            // Delay restoration to allow navigation tree to stabilize
            // This prevents conflict with default navigation behavior
            setTimeout(async () => {
              try {
                if (navigationRef?.current) {
                  // console.log('🗺️ Starting delayed navigation restoration...');
                  await navPersistence.restoreNavigation(navigationRef);
                } else {
                  // console.log(
                  //   '🗺️ navigationRef not available for delayed restoration',
                  // );
                }
              } catch (error) {
                console.error('Failed to restore navigation (delayed):', error);
              }
            }, 1000); // 1 second delay to allow navigation to settle
          } catch (error) {
            console.error('Failed to prepare navigation restoration:', error);
          }
        }}
        onError={async _error => {
          console.error('🔐 Biometric authentication error:', _error);

          // Increment fail count
          const newFailCount = biometricFailCount + 1;
          setBiometricFailCount(newFailCount);
          console.log(
            `🔐 Biometric fail count: ${newFailCount}/${MAX_BIOMETRIC_ATTEMPTS}`,
          );

          setShowBiometricPrompt(false);
          setBiometricCancelled(true);
          setHasAuthenticatedInSession(false);

          // Check if max attempts reached
          if (newFailCount >= MAX_BIOMETRIC_ATTEMPTS) {
            console.log(
              '🔐 Max biometric attempts reached - forcing master password',
            );
            setConfirmDialog({
              visible: true,
              title: 'Too Many Failed Attempts',
              message:
                'For security reasons, please authenticate using your master password.',
              confirmText: 'OK',
              onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, visible: false }));
                setBiometricFailCount(0); // Reset counter
                setShowMasterPasswordPrompt(true);
              },
            });
          } else {
            // Show master password prompt as fallback
            setShowMasterPasswordPrompt(true);
          }
        }}
        title="Unlock PasswordEpic"
        subtitle="Use your biometric to unlock the app"
      />

      {/* Master Password Prompt Modal */}
      <MasterPasswordPrompt
        visible={showMasterPasswordPrompt}
        onSuccess={async () => {
          console.log('🔐 Master password authentication successful');

          // Reset biometric fail counter on successful master password entry
          setBiometricFailCount(0);

          setShowMasterPasswordPrompt(false);
          setBiometricCancelled(false);
          setHasAuthenticatedInSession(true);
          setIsCheckingSessionOnResume(false); // Clear resume checking flag
          // Restart session after successful master password entry
          startSession().catch(error => {
            console.error('Failed to restart session:', error);
          });

          // Re-sync auto-lock timeout from settings after unlock
          // This ensures the timer uses the current user setting and restarts the timer
          try {
            await updateActivityConfig({
              inactivityTimeout: security.autoLockTimeout,
              trackUserInteraction: true, // Ensure tracking is enabled
            });
            console.log(
              '🎯 Re-synced auto-lock timeout after unlock:',
              security.autoLockTimeout,
              'minutes',
            );
          } catch (error) {
            console.error(
              'Failed to re-sync activity timeout after unlock:',
              error,
            );
          }

          // Trigger navigation restoration using the new service
          try {
            await navPersistence.markForRestore();
            // console.log('🗺️ Master password success - restoring navigation');

            // Delay restoration to allow navigation tree to stabilize
            // This prevents conflict with default navigation behavior
            setTimeout(async () => {
              try {
                if (navigationRef?.current) {
                  // console.log('🗺️ Starting delayed navigation restoration...');
                  await navPersistence.restoreNavigation(navigationRef);
                } else {
                  // console.log(
                  //   '🗺️ navigationRef not available for delayed restoration',
                  // );
                }
              } catch (error) {
                console.error('Failed to restore navigation (delayed):', error);
              }
            }, 1000); // 1 second delay to allow navigation to settle
          } catch (error) {
            console.error('Failed to prepare navigation restoration:', error);
          }
        }}
        onCancel={async () => {
          // console.log('Master password cancelled - logging out');
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
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
    // Semi-transparent overlay to completely block content behind
    opacity: 1,
  },
  authOverlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    // Completely opaque black to fully block content behind
    backgroundColor: '#000000', // Solid black (100% opaque)
  },
  authOverlayText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
