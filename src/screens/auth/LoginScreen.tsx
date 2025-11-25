import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  loginStart,
  loginSuccess,
  loginFailure,
  setShouldNavigateToUnlock,
  setIsInSetupFlow,
} from '../../store/slices/authSlice';
import { useTheme } from '../../contexts/ThemeContext';
import { signInWithGoogle } from '../../services/authService';
import { isGoogleSignInModuleAvailable } from '../../services/googleSignIn';
import { isGoogleSignInReady } from '../../services/googleAuthNative';
import { isMasterPasswordSet } from '../../services/secureStorageService';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

export const LoginScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { theme } = useTheme();
  const authState = useAppSelector(state => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [cachedUsername, setCachedUsername] = useState<string | null>(null);
  const [googleSignInAvailable, setGoogleSignInAvailable] = useState(
    isGoogleSignInModuleAvailable(),
  );

  // Use ref to track loading state immediately
  const isLoadingRef = React.useRef(false);
  const buttonPressedRef = React.useRef(false);
  const autoLoginAttemptedRef = React.useRef(false);

  // Reset button state on focus (critical for hot reload fix)
  // useFocusEffect runs even after hot reload when component is in focus
  useFocusEffect(
    useCallback(() => {
      console.log(
        '✅ LoginScreen focused - resetting button state for hot reload',
      );

      // CRITICAL: Reset all button state immediately on focus
      isLoadingRef.current = false;
      buttonPressedRef.current = false;
      setIsLoading(false);
      setButtonPressed(false);
      setIsAutoLoggingIn(false);

      // Re-check Google Sign-In availability on focus
      const available = isGoogleSignInModuleAvailable();
      setGoogleSignInAvailable(available);
      console.log('🔄 GoogleSignInAvailable on focus:', available);

      // CRITICAL: Reset Google Sign-In initialization on focus
      // This handles hot reload case where native module state becomes stale
      (async () => {
        try {
          const { __resetInitializationState, initializeGoogleSignIn } =
            await import('../../services/googleAuthNative');
          __resetInitializationState();
          await initializeGoogleSignIn();
          console.log('🔄 Google Sign-In re-initialized on focus');
        } catch (error) {
          console.log('⚠️ Failed to reset Google Sign-In on focus:', error);
        }
      })();

      return () => {
        // Cleanup on unfocus if needed
      };
    }, []),
  );

  // Log button state changes for debugging
  useEffect(() => {
    const isDisabled = isLoading || buttonPressed || !googleSignInAvailable;
    console.log('📋 [LoginScreen] Button state updated:', {
      isLoading,
      buttonPressed,
      googleSignInAvailable,
      isDisabled,
    });
  }, [isLoading, buttonPressed, googleSignInAvailable]);

  // Confirm dialog state
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

  const checkFirebaseCredentials = useCallback(async (): Promise<boolean> => {
    try {
      const { getCurrentUser, getFirebaseFirestore } = await import(
        '../../services/firebase'
      );
      const { doc, getDoc } = await import('firebase/firestore');

      const currentUser = getCurrentUser();
      if (!currentUser?.uid) {
        return false;
      }

      const firestore = getFirebaseFirestore();
      if (!firestore) {
        return false;
      }

      const userDocRef = doc(firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return false;
      }

      const data = userDoc.data();
      return !!data?.encryptedMasterPassword;
    } catch (error) {
      console.error('Error checking Firebase credentials:', error);
      return false;
    }
  }, []);

  const checkExistingSession = useCallback(async () => {
    // Only attempt auto-login once per mount or focus
    if (autoLoginAttemptedRef.current) {
      console.log('✓ Auto-login already attempted, skipping');
      return;
    }
    autoLoginAttemptedRef.current = true;

    // If user is already logged in, start navigation flow
    if (authState.user) {
      console.log(
        `✅ [LoginScreen] User already logged in: ${authState.user.email}`,
      );
      setCachedUsername(
        authState.user.displayName || authState.user.email || 'User',
      );

      setIsAutoLoggingIn(true);
      isLoadingRef.current = true;

      try {
        const masterPasswordSet = await isMasterPasswordSet();
        if (!masterPasswordSet) {
          console.log(
            '🔐 [LoginScreen] Master password not set - navigating to MasterPassword',
          );
          navigation.navigate('MasterPassword', { mode: 'setup' });
        } else {
          console.log(
            '✓ [LoginScreen] Master password set - checking if update needed',
          );
          // Master password is set, check if credentials exist in Firebase
          // If they do, show credential options (keep or update)
          const hasFirebaseCredentials = await checkFirebaseCredentials();
          if (hasFirebaseCredentials) {
            console.log(
              '🔐 [LoginScreen] Existing credentials found - showing options',
            );

            // CRITICAL: Check if already on CredentialOptions to prevent navigation loop
            const currentRoute =
              navigation.getState()?.routes[navigation.getState()?.index || 0];
            if (currentRoute?.name === 'CredentialOptions') {
              console.log(
                '🔍 [LoginScreen] Already on CredentialOptions - skipping navigation',
              );
              setIsAutoLoggingIn(false);
              return;
            }

            // Set isInSetupFlow=true to keep Auth stack visible
            // and reset shouldNavigateToUnlock to prevent auto-navigation to unlock
            console.log(
              '🔍 [DEBUG_NAV PRE-STEP 2] LoginScreen setting isInSetupFlow=true, shouldNavigateToUnlock=false',
            );
            dispatch(setIsInSetupFlow(true)); // Keep Auth stack visible
            dispatch(setShouldNavigateToUnlock(false)); // Don't auto-navigate to unlock
            setIsAutoLoggingIn(false);
            navigation.navigate('CredentialOptions');
          } else {
            console.log(
              '✓ [LoginScreen] No Firebase credentials - AppNavigator will handle',
            );
            setIsAutoLoggingIn(false);
          }
        }
      } catch (error) {
        console.error('Failed to check master password status:', error);
        navigation.navigate('MasterPassword', { mode: 'setup' });
      }
    } else {
      console.log(
        '📋 [LoginScreen] No existing session found - showing login UI',
      );
      // Reset auto-login state if there's no user
      setIsAutoLoggingIn(false);
    }
  }, [authState.user, navigation, checkFirebaseCredentials, dispatch]);

  // This effect runs when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('LoginScreen focused');
      autoLoginAttemptedRef.current = false; // Reset on focus
      checkExistingSession();

      return () => {
        console.log('LoginScreen unfocused');
        // Optional: Cleanup when the screen is unfocused
        // Resetting refs here might be too aggressive if navigation is pending
      };
    }, [checkExistingSession]),
  );

  // This effect handles AppState changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('App has come to the foreground!');
        // Reset and re-check, as user might need to unlock again
        autoLoginAttemptedRef.current = false;
        checkExistingSession();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [checkExistingSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset all refs when component unmounts
      isLoadingRef.current = false;
      buttonPressedRef.current = false;
      console.log('🔄 LoginScreen unmounted - refs reset');
    };
  }, []);

  const handleGoogleSignIn = React.useCallback(async () => {
    console.log('📲 [LoginScreen] handleGoogleSignIn called - start', {
      isLoading,
      isLoadingRef: isLoadingRef.current,
      buttonPressed,
      buttonPressedRef: buttonPressedRef.current,
      googleSignInAvailable,
    });

    // Triple protection: check state, ref, and button pressed
    if (
      isLoading ||
      isLoadingRef.current ||
      buttonPressed ||
      buttonPressedRef.current
    ) {
      console.log('Google Sign-In already in progress, ignoring click');
      return;
    }

    // Set all protection flags immediately
    buttonPressedRef.current = true;
    setButtonPressed(true);
    isLoadingRef.current = true;
    setIsLoading(true);

    console.log(
      '🔄 Google Sign-In button disabled - starting authentication...',
    );

    try {
      if (!googleSignInAvailable) {
        console.log('❌ Google Sign-In not available, showing error dialog');
        setConfirmDialog({
          visible: true,
          title: 'Google Sign-In Unavailable',
          message:
            'Google Sign-In is not available in this build. Please use a development build that includes the Google Sign-In module.',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
        buttonPressedRef.current = false;
        setButtonPressed(false);
        isLoadingRef.current = false;
        setIsLoading(false);
        return;
      }

      // CRITICAL: Always attempt reinitialize on button click to handle hot reload
      // Hot reload doesn't unmount the component, so we need to reset initialization state
      try {
        console.log('🔄 Attempting to reinitialize Google Sign-In...');
        const googleAuthModule = await import(
          '../../services/googleAuthNative'
        );
        googleAuthModule.__resetInitializationState();
        const initialized = await googleAuthModule.initializeGoogleSignIn();
        console.log('✅ Google Sign-In reinitialized:', initialized);
      } catch (error) {
        console.log('⚠️ Failed to reinitialize Google Sign-In:', error);
      }

      // Now check if it's ready
      let readyCheck = isGoogleSignInReady();
      if (!readyCheck) {
        console.log('❌ Google Sign-In still not ready after reinit attempt');
        setConfirmDialog({
          visible: true,
          title: 'Google Sign-In Not Ready',
          message:
            'Google Sign-In is still initializing. Please wait a moment and try again.',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
        buttonPressedRef.current = false;
        setButtonPressed(false);
        isLoadingRef.current = false;
        setIsLoading(false);
        return;
      }

      dispatch(loginStart());

      console.log('Starting Google Sign-In from LoginScreen...');
      const result = await signInWithGoogle();

      if (result.success && result.user) {
        dispatch(loginSuccess(result.user));

        // Don't reset button state - keep it disabled during navigation
        console.log(
          '🔄 Authentication successful - keeping button disabled during navigation',
        );

        // Check if master password is configured by querying secure storage directly
        try {
          const masterPasswordSet = await isMasterPasswordSet();
          if (!masterPasswordSet) {
            // Navigate to master password setup
            navigation.navigate('MasterPassword');
          }
          // If master password is configured, AppNavigator will handle navigation to Main
        } catch (error) {
          console.error('Failed to check master password status:', error);
          // If we can't check, assume it's not set and let user set it
          navigation.navigate('MasterPassword');
        }

        // Don't reset loading states here - let the component unmount naturally
        return;
      } else {
        dispatch(loginFailure(result.error || 'Failed to sign in with Google'));
        setConfirmDialog({
          visible: true,
          title: 'Authentication Error',
          message: result.error || 'Failed to sign in with Google',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });

        buttonPressedRef.current = false;
        setButtonPressed(false);
        isLoadingRef.current = false;
        setIsLoading(false);
        console.log(
          '🔄 Google Sign-In cancelled or failed - button re-enabled',
        );
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred';
      dispatch(loginFailure(errorMessage));
      setConfirmDialog({
        visible: true,
        title: 'Error',
        message: errorMessage,
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });

      // Only reset states on error - not on success
      buttonPressedRef.current = false;
      setButtonPressed(false);
      isLoadingRef.current = false;
      setIsLoading(false);
      console.log('🔄 Google Sign-In failed - button re-enabled');
    }
  }, [isLoading, buttonPressed, googleSignInAvailable, dispatch, navigation]);

  // Show loading screen while auto-logging in
  if (isAutoLoggingIn) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Gradient overlay */}
        <View
          style={[
            styles.gradientOverlay,
            { backgroundColor: theme.primary },
            styles.gradientOverlayOpacity,
          ]}
        />

        <View style={styles.autoLoginContent}>
          {/* Top spacer */}
          <View style={styles.topSpacer} />

          {/* Logo/Icon container with animation */}
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.primary },
                styles.iconCircleOpacity,
              ]}
            >
              <MaterialCommunityIcons
                name="vault"
                size={64}
                color={theme.primary}
              />
            </View>
          </View>

          {/* Welcome text */}
          <Text style={[styles.welcomeTitle, { color: theme.text }]}>
            Welcome back,
          </Text>
          <Text
            style={[styles.usernameLarge, { color: theme.primary }]}
            numberOfLines={1}
          >
            {cachedUsername || 'User'}
          </Text>

          {/* Subtitle */}
          <Text style={[styles.preparingText, { color: theme.textSecondary }]}>
            Unlocking your vault...
          </Text>

          {/* Loading indicator */}
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <View style={styles.dots}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: theme.primary },
                  styles.dotOpacity1,
                ]}
              />
              <View
                style={[
                  styles.dot,
                  { backgroundColor: theme.primary },
                  styles.dotOpacity2,
                ]}
              />
              <View
                style={[
                  styles.dot,
                  { backgroundColor: theme.primary },
                  styles.dotOpacity3,
                ]}
              />
            </View>
          </View>

          {/* Bottom security note */}
          <View style={styles.bottomSpacer} />
          <Text style={[styles.secureNote, { color: theme.textSecondary }]}>
            🔒 Your vault is encrypted end-to-end
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>
          Welcome Back{cachedUsername ? `, ${cachedUsername}` : ''}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Sign in to access your secure password vault
        </Text>

        <TouchableOpacity
          style={[
            styles.googleButton,
            {
              backgroundColor: googleSignInAvailable
                ? isLoading || buttonPressed
                  ? theme.textSecondary
                  : theme.primary
                : theme.textSecondary,
            },
            (isLoading || buttonPressed || !googleSignInAvailable) &&
              styles.disabledButton,
          ]}
          onPress={() => {
            console.log('🔘 [LoginScreen] Button onPress fired', {
              isLoading,
              buttonPressed,
              googleSignInAvailable,
            });
            handleGoogleSignIn();
          }}
          disabled={isLoading || buttonPressed || !googleSignInAvailable}
          activeOpacity={
            isLoading || buttonPressed || !googleSignInAvailable ? 1 : 0.7
          }
        >
          {isLoading || buttonPressed ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={[styles.googleButtonText, styles.loadingText]}>
                Signing in...
              </Text>
            </View>
          ) : (
            <Text style={styles.googleButtonText}>
              {googleSignInAvailable
                ? 'Continue with Google'
                : 'Google Sign-In Unavailable'}
            </Text>
          )}
        </TouchableOpacity>

        {!googleSignInAvailable && (
          <Text
            style={[styles.warningText, { color: theme.error || '#ff6b6b' }]}
          >
            ⚠️ Google Sign-In không khả dụng.{'\n'}
            Vui lòng sử dụng Development Build hoặc kiểm tra cấu hình.
          </Text>
        )}

        {googleSignInAvailable && (
          <Text style={[styles.methodText, { color: theme.textSecondary }]}>
            🔧 Using Native Google Sign-In
          </Text>
        )}

        <Text style={[styles.securityNote, { color: theme.textSecondary }]}>
          🔒 Your data is encrypted end-to-end and never stored on our servers
        </Text>
      </View>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 48,
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 250,
    marginBottom: 32,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  securityNote: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  methodText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  mt20: {
    marginTop: 20,
  },
  // ========== AUTO-LOGIN SCREEN STYLES ==========
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  autoLoginContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  topSpacer: {
    flex: 0.5,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  usernameLarge: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  preparingText: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomSpacer: {
    flex: 0.5,
  },
  secureNote: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
  },
  gradientOverlayOpacity: {
    opacity: 0.05,
  },
  iconCircleOpacity: {
    opacity: 0.1,
  },
  dotOpacity1: {
    opacity: 0.3,
  },
  dotOpacity2: {
    opacity: 0.5,
  },
  dotOpacity3: {
    opacity: 0.7,
  },
});
