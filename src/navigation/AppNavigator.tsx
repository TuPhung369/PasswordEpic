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
  setHasCompletedSessionAuth,
  setShouldNavigateToUnlock,
  setIsInSetupFlow,
  setShouldAutoTriggerBiometric,
} from '../store/slices/authSlice';
import { isMasterPasswordSet } from '../services/secureStorageService';
import { useBiometric } from '../hooks/useBiometric';
import { useSession } from '../hooks/useSession';
import { useTheme } from '../contexts/ThemeContext';
import { useUserActivity } from '../hooks/useUserActivity';
import { NavigationPersistenceService } from '../services/navigationPersistenceService';
import {
  cacheEncryptedMasterPasswordToAsyncStorage,
  generateStaticMasterPassword,
} from '../services/staticMasterPasswordService';
import { sessionCache } from '../utils/sessionCache';

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
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const navPersistence = NavigationPersistenceService.getInstance();
  const {
    isAuthenticated,
    masterPasswordConfigured,
    biometricEnabled,
    isInSetupFlow,
    shouldNavigateToUnlock,
  } = useAppSelector(state => state.auth);
  const { security } = useAppSelector(state => state.settings);

  const {
    isAvailable: biometricAvailable,
    authenticate: authenticateBiometric,
  } = useBiometric();
  const { startSession, endSession } = useSession();

  // 🔍 DEBUG: Log biometric availability
  React.useEffect(() => {
    console.log(
      `🔍 [AppNavigator] Biometric hardware check: biometricAvailable=${biometricAvailable}`,
    );
  }, [biometricAvailable]);

  const [appReady, setAppReady] = useState(false);
  const [hasAuthenticatedInSession, setHasAuthenticatedInSession] =
    useState(false);
  const isAuthenticatingRef = React.useRef(false); // Prevent duplicate authentication attempts
  const [initialAuthComplete, setInitialAuthComplete] = useState(false);
  const [biometricStatusChecked, setBiometricStatusChecked] = useState(false);
  const appStateRef = React.useRef(AppState.currentState);
  const prevDecisionRef = React.useRef<string>(''); // Track previous navigation decision
  const prevNeedsUnlockRef = React.useRef<boolean | null>(null); // Track previous needsUnlock state
  const isResumingFromBackgroundRef = React.useRef(false); // Track if app is resuming from background

  const { updateConfig: updateActivityConfig, panResponder } = useUserActivity(
    async () => {
      console.log('🎯 🔒 Auto-lock triggered due to user inactivity');
      if (isInSetupFlow) {
        console.log('🎯 🔒 Auto-lock: Skipping - user is in setup flow');
        return;
      }
      if (
        isAuthenticated &&
        masterPasswordConfigured &&
        biometricEnabled &&
        biometricAvailable
      ) {
        try {
          const currentState = navigationRef?.current?.getRootState();
          if (currentState) {
            await navPersistence.saveNavigationState(currentState);
          }
        } catch (error) {
          console.error(
            'Failed to save navigation state during auto-lock:',
            error,
          );
        }
        setHasAuthenticatedInSession(false);
        dispatch(setHasCompletedSessionAuth(false));
      }
    },
    {
      inactivityTimeout: security.autoLockTimeout || 5,
      trackUserInteraction: true,
    },
  );

  const stateRefs = React.useRef({
    isAuthenticated,
    masterPasswordConfigured,
    initialAuthComplete,
  });

  React.useEffect(() => {
    stateRefs.current = {
      isAuthenticated,
      masterPasswordConfigured,
      initialAuthComplete,
    };
  }, [isAuthenticated, masterPasswordConfigured, initialAuthComplete]);

  React.useEffect(() => {
    const syncActivityTimeout = async () => {
      try {
        await updateActivityConfig({
          inactivityTimeout: security.autoLockTimeout,
        });
      } catch (error) {
        console.error('Failed to update activity timeout:', error);
      }
    };
    syncActivityTimeout();
  }, [security.autoLockTimeout, updateActivityConfig]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async user => {
      if (user) {
        dispatch(
          loginSuccess({
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName,
            photoURL: user.photoURL,
          }),
        );

        if (!initialAuthComplete) {
          console.log(
            '🔐 App restart detected (cold start). Requiring authentication.',
          );
          setHasAuthenticatedInSession(false);
          dispatch(setHasCompletedSessionAuth(false));
        }

        try {
          const masterPasswordSet = await isMasterPasswordSet();
          const { getBiometricStatus } = await import(
            '../services/secureStorageService'
          );
          const biometricStatus = await getBiometricStatus();

          console.log(
            `🔐 [AppNavigator] Biometric initialization - stored value: ${biometricStatus}, setting Redux...`,
          );

          dispatch(setMasterPasswordConfigured(masterPasswordSet));
          dispatch(setBiometricEnabled(biometricStatus));
          setBiometricStatusChecked(true);

          console.log(
            `🔐 [AppNavigator] Redux biometric state set to: ${biometricStatus}`,
          );

          if (masterPasswordSet) {
            await startSession();
          }

          // 🔒 BEFORE setting initialAuthComplete: if master password is set and this is cold start, require unlock
          const wasColdStart = !initialAuthComplete;

          setInitialAuthComplete(true);

          if (wasColdStart && masterPasswordSet) {
            console.log(
              '🔒 [AppNavigator] Cold start detected - will show unlock screen with biometric auto-trigger',
            );
            dispatch(setShouldNavigateToUnlock(true));
            dispatch(setShouldAutoTriggerBiometric(true));
          }

          if (masterPasswordSet) {
            console.log(
              '🔥 [AppNavigator] Pre-warming static master password cache...',
            );
            import('../services/staticMasterPasswordService')
              .then(({ getEffectiveMasterPassword }) =>
                getEffectiveMasterPassword(),
              )
              .then(result => {
                if (result.success) {
                  console.log(
                    '✅ [AppNavigator] Static master password cached',
                  );
                } else {
                  // This is expected on cold start before PIN unlock - not a warning
                  console.log(
                    'ℹ️ [AppNavigator] Pre-warm cache skipped:',
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
          setBiometricStatusChecked(true);
          setInitialAuthComplete(true);
        }
      } else {
        // 🔥 FIX: Don't logout user if this is triggered by app resuming from background
        // Firebase onAuthStateChanged can temporarily return null when app resumes
        if (isResumingFromBackgroundRef.current) {
          console.log(
            '⚠️ [AppNavigator] onAuthStateChanged(null) detected during app resume - ignoring to prevent logout',
          );
          isResumingFromBackgroundRef.current = false; // Reset flag
          return;
        }

        console.log(
          '🔴 [AppNavigator] User logged out - clearing session and navigating to auth',
        );
        await endSession();
        dispatch(logout());
        setInitialAuthComplete(false);
        setHasAuthenticatedInSession(false);
        dispatch(setHasCompletedSessionAuth(false));
        setBiometricStatusChecked(true);
      }
      setAppReady(true);
    });
    return unsubscribe;
  }, [dispatch, startSession, endSession, initialAuthComplete]);

  useEffect(() => {
    console.log('🔍 [AppNavigator] ===== REGISTERING AppState listener =====');
    console.log(`🔍 [AppNavigator] Current AppState: ${appStateRef.current}`);
    console.log(
      `🔍 [AppNavigator] biometricAvailable at registration: ${biometricAvailable}`,
    );

    const handleAppStateChange = (nextAppState: any) => {
      console.log(
        `🔍 [AppNavigator] ===== AppState CHANGED: ${appStateRef.current} -> ${nextAppState} =====`,
      );
      console.log(
        `🔍 [AppNavigator] State check: authenticated=${stateRefs.current.isAuthenticated}, masterPwdConfig=${stateRefs.current.masterPasswordConfigured}, initialAuthComplete=${stateRefs.current.initialAuthComplete}, isInSetupFlow=${isInSetupFlow}, hasAuthInSession=${hasAuthenticatedInSession}, biometricAvailable=${biometricAvailable}`,
      );

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (
          stateRefs.current.isAuthenticated &&
          stateRefs.current.masterPasswordConfigured &&
          stateRefs.current.initialAuthComplete &&
          !isInSetupFlow
        ) {
          try {
            const currentState = navigationRef?.current?.getRootState();
            if (currentState) {
              navPersistence.saveNavigationState(currentState).catch(error => {
                console.error(
                  'Failed to save navigation on background:',
                  error,
                );
              });
            }
          } catch (error) {
            console.error('Error saving navigation on app background:', error);
          }

          // 🔒 ALWAYS clear session authentication when app goes to background
          // This ensures biometric is required every time user returns to the app
          console.log(
            '🔒 [AppNavigator] App backgrounded - clearing session auth flag',
          );
          setHasAuthenticatedInSession(false);
          dispatch(setHasCompletedSessionAuth(false));
        }
      } else if (nextAppState === 'active') {
        console.log(
          '🔍 [AppNavigator] Detected active state - checking conditions...',
        );

        // 🔍 Check if this is a RESUME (was background before) or COLD START (first time)
        const isResume =
          appStateRef.current === 'background' ||
          appStateRef.current === 'inactive';
        console.log(`🔍 [AppNavigator] Is resume from background: ${isResume}`);

        // 🔥 FIX: Set flag to prevent onAuthStateChanged from logging out user during resume
        if (isResume) {
          isResumingFromBackgroundRef.current = true;
          // Reset flag after 2 seconds (enough time for Firebase to reconnect)
          setTimeout(() => {
            isResumingFromBackgroundRef.current = false;
          }, 2000);
        }

        // 🔥 NEW: When app comes to foreground, check if we need to require unlock
        if (
          stateRefs.current.isAuthenticated &&
          stateRefs.current.masterPasswordConfigured &&
          stateRefs.current.initialAuthComplete &&
          !isInSetupFlow
        ) {
          console.log(
            '🔍 [AppNavigator] App resumed - checking if unlock is required',
          );
          // If user hasn't authenticated in this session, require unlock
          // IMPORTANT: Only trigger on RESUME, not on cold start
          if (
            !hasAuthenticatedInSession &&
            !isAuthenticatingRef.current &&
            isResume
          ) {
            console.log(
              '🔍 [AppNavigator] User needs authentication (resume from background)',
            );

            // 🔥 ALWAYS trigger biometric if hardware available (ignore storage setting)
            if (biometricAvailable) {
              console.log(
                '🔍 [AppNavigator] Biometric hardware available - triggering authentication...',
              );
              isAuthenticatingRef.current = true;

              // Small delay to ensure Activity is ready (Android requirement)
              setTimeout(async () => {
                try {
                  const result = await authenticateBiometric(
                    'Unlock your vault',
                  );
                  if (result) {
                    console.log(
                      '✅ [AppNavigator] Biometric authentication successful',
                    );

                    // 🔥 CRITICAL: Generate and cache static master password FIRST
                    // This ensures PasswordsScreen can access it for autofill prep
                    console.log(
                      '🔐 [AppNavigator] Generating static master password after biometric...',
                    );
                    try {
                      const mpResult = await generateStaticMasterPassword();
                      if (mpResult.success && mpResult.password) {
                        // Cache in sessionCache for PasswordsScreen autofill prep
                        sessionCache.set(
                          'staticMasterPassword',
                          mpResult.password,
                          30 * 60 * 1000, // 30 minutes
                        );
                        console.log(
                          '✅ [AppNavigator] Static master password cached in session',
                        );
                      } else {
                        console.warn(
                          '⚠️ [AppNavigator] Failed to generate static MP:',
                          mpResult.error,
                        );
                      }
                    } catch (mpError) {
                      console.error(
                        '❌ [AppNavigator] Error generating static MP:',
                        mpError,
                      );
                    }

                    // Update all auth flags
                    console.log(
                      '🎯 [AppNavigator] Updating auth flags to return to Main stack...',
                    );
                    setHasAuthenticatedInSession(true);
                    dispatch(setHasCompletedSessionAuth(true));
                    dispatch(setShouldNavigateToUnlock(false));
                    dispatch(setIsInSetupFlow(false));

                    // Start session (async, but auth flags already set)
                    console.log('🔄 [AppNavigator] Starting session...');
                    await startSession();
                    console.log('✅ [AppNavigator] Session started');

                    // Cache encrypted master password for Android Native Autofill
                    console.log(
                      '💾 [AppNavigator] Caching encrypted MP for autofill...',
                    );
                    const cacheResult =
                      await cacheEncryptedMasterPasswordToAsyncStorage();
                    if (cacheResult.success) {
                      console.log(
                        '✅ [AppNavigator] Encrypted MP cached successfully',
                      );
                    } else {
                      console.warn(
                        '⚠️ [AppNavigator] Failed to cache encrypted MP:',
                        cacheResult.error,
                      );
                    }
                  } else {
                    console.log(
                      '❌ [AppNavigator] Biometric authentication failed - navigating to unlock screen',
                    );
                    dispatch(setShouldNavigateToUnlock(true));
                    dispatch(setShouldAutoTriggerBiometric(false));
                  }
                } catch (error) {
                  console.error('❌ [AppNavigator] Biometric error:', error);
                  dispatch(setShouldNavigateToUnlock(true));
                  dispatch(setShouldAutoTriggerBiometric(false));
                } finally {
                  isAuthenticatingRef.current = false;
                }
              }, 300);
            } else {
              // No biometric hardware, navigate to unlock screen (PIN/Master Password)
              console.log(
                '🔍 [AppNavigator] Biometric hardware not available - setting shouldNavigateToUnlock=true',
              );
              dispatch(setShouldNavigateToUnlock(true));
              dispatch(setShouldAutoTriggerBiometric(false));
              setHasAuthenticatedInSession(false);
              dispatch(setHasCompletedSessionAuth(false));
            }
          } else if (hasAuthenticatedInSession) {
            console.log(
              '🔍 [AppNavigator] User already authenticated in session - no unlock needed',
            );
          } else if (isAuthenticatingRef.current) {
            console.log(
              '🔍 [AppNavigator] Authentication already in progress - skipping',
            );
          }
        } else {
          console.log(
            '🔍 [AppNavigator] Conditions not met for unlock check:',
            {
              isAuthenticated: stateRefs.current.isAuthenticated,
              masterPasswordConfigured:
                stateRefs.current.masterPasswordConfigured,
              initialAuthComplete: stateRefs.current.initialAuthComplete,
              isInSetupFlow,
            },
          );
        }
      }
      appStateRef.current = nextAppState;
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [
    isInSetupFlow,
    navPersistence,
    navigationRef,
    hasAuthenticatedInSession,
    biometricAvailable,
    authenticateBiometric,
    dispatch,
    startSession,
  ]);

  // Calculate needsUnlock BEFORE any early returns
  // NEW: Only require unlock if user has explicitly chosen to unlock (via CredentialOptionsScreen)
  // This prevents premature navigation to unlock screen before user makes a choice
  const needsUnlock =
    isAuthenticated &&
    masterPasswordConfigured &&
    !hasAuthenticatedInSession &&
    initialAuthComplete &&
    shouldNavigateToUnlock; // CRITICAL: Only unlock when explicitly requested

  // Clear navigation state when user needs to unlock (must be before early return)
  useEffect(() => {
    if (needsUnlock && appReady && biometricStatusChecked) {
      console.log(
        '� [DEBUG_NAV STEP 5] needsUnlock=true detected - clearing saved navigation state',
      );
      navPersistence.clearNavigationState().catch(error => {
        console.error('Failed to clear navigation state:', error);
      });
    }
  }, [needsUnlock, appReady, biometricStatusChecked, navPersistence]);

  if (!appReady || !biometricStatusChecked) {
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

  // CRITICAL: Determine if user should see Auth stack
  // Show Auth if:
  // 1. Not authenticated (!isAuthenticated)
  // 2. Master password not configured (!masterPasswordConfigured)
  // 3. Needs unlock (needsUnlock = true when shouldNavigateToUnlock = true)
  // 4. In setup/credential selection flow (isInSetupFlow = true)
  //    → This handles reinstall case: user logged in, has master password on Firebase,
  //      LoginScreen sets isInSetupFlow=true and navigates to CredentialOptions
  const shouldShowAuthStack =
    !isAuthenticated ||
    !masterPasswordConfigured ||
    needsUnlock ||
    isInSetupFlow; // ✅ FIXED: Use isInSetupFlow instead of complex condition

  // Track previous decision and only log when it changes
  const currentDecision = shouldShowAuthStack ? 'Auth' : 'Main';

  if (prevDecisionRef.current !== currentDecision) {
    console.log('🔍 [DEBUG_NAV STEP 1] AppNavigator decision CHANGED:');
    console.log('  isAuthenticated:', isAuthenticated);
    console.log('  masterPasswordConfigured:', masterPasswordConfigured);
    console.log('  hasAuthenticatedInSession:', hasAuthenticatedInSession);
    console.log('  initialAuthComplete:', initialAuthComplete);
    console.log('  isInSetupFlow:', isInSetupFlow);
    console.log('  shouldNavigateToUnlock:', shouldNavigateToUnlock);
    console.log('  needsUnlock:', needsUnlock);
    console.log('  shouldShowAuthStack:', shouldShowAuthStack);
    console.log('  decision:', currentDecision);
    console.log('  previousDecision:', prevDecisionRef.current || 'none');
    prevDecisionRef.current = currentDecision;
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
        {shouldShowAuthStack ? (
          <Stack.Screen name="Auth">
            {props => {
              // Only log when needsUnlock actually changes to prevent log spam
              if (prevNeedsUnlockRef.current !== needsUnlock) {
                console.log(
                  '🔍 [DEBUG_NAV STEP 6] Rendering AuthNavigator with needsUnlock CHANGED:',
                  {
                    previous: prevNeedsUnlockRef.current,
                    current: needsUnlock,
                  },
                );
                prevNeedsUnlockRef.current = needsUnlock;
              }
              return (
                <AuthNavigator
                  {...props}
                  needsUnlock={needsUnlock}
                  biometricEnabled={biometricEnabled}
                  onUnlock={async () => {
                    console.log(
                      '🔍 [DEBUG_NAV STEP 7] Unlock successful - setting session flags',
                    );

                    // 🔥 CRITICAL: Generate and cache static master password
                    // This ensures PasswordsScreen can access it for autofill prep
                    console.log(
                      '🔐 [AppNavigator] Generating static master password after unlock...',
                    );
                    try {
                      const mpResult = await generateStaticMasterPassword();
                      if (mpResult.success && mpResult.password) {
                        // Cache in sessionCache for PasswordsScreen autofill prep
                        sessionCache.set(
                          'staticMasterPassword',
                          mpResult.password,
                          30 * 60 * 1000, // 30 minutes
                        );
                        console.log(
                          '✅ [AppNavigator] Static master password cached in session (onUnlock)',
                        );
                      } else {
                        console.warn(
                          '⚠️ [AppNavigator] Failed to generate static MP (onUnlock):',
                          mpResult.error,
                        );
                      }
                    } catch (mpError) {
                      console.error(
                        '❌ [AppNavigator] Error generating static MP (onUnlock):',
                        mpError,
                      );
                    }

                    setHasAuthenticatedInSession(true);
                    dispatch(setHasCompletedSessionAuth(true));
                    dispatch(setShouldNavigateToUnlock(false)); // Reset navigation flag
                    dispatch(setIsInSetupFlow(false)); // Reset setup flow flag
                  }}
                />
              );
            }}
          </Stack.Screen>
        ) : (
          <Stack.Screen
            name="Main"
            component={MainNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
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
