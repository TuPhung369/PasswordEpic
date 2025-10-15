import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAppDispatch } from '../../hooks/redux';
import {
  loginStart,
  loginSuccess,
  loginFailure,
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
  const [isLoading, setIsLoading] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);
  const googleSignInAvailable = isGoogleSignInModuleAvailable();

  // Use ref to track loading state immediately
  const isLoadingRef = React.useRef(false);
  const buttonPressedRef = React.useRef(false);

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

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Reset all refs when component unmounts
      isLoadingRef.current = false;
      buttonPressedRef.current = false;
      console.log('🔄 LoginScreen unmounted - refs reset');
    };
  }, []);

  const handleGoogleSignIn = React.useCallback(async () => {
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
        setConfirmDialog({
          visible: true,
          title: 'Google Sign-In Unavailable',
          message:
            'Google Sign-In is not available in this build. Please use a development build that includes the Google Sign-In module.',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
        return;
      }

      if (!isGoogleSignInReady()) {
        setConfirmDialog({
          visible: true,
          title: 'Google Sign-In Not Ready',
          message:
            'Google Sign-In is still initializing. Please wait a moment and try again.',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
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
          onPress={
            isLoading || buttonPressed || !googleSignInAvailable
              ? () => {}
              : handleGoogleSignIn
          }
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
});
