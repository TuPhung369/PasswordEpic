import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  const googleSignInAvailable = isGoogleSignInModuleAvailable();

  const handleGoogleSignIn = async () => {
    if (!googleSignInAvailable) {
      Alert.alert(
        'Google Sign-In Unavailable',
        'Google Sign-In is not available in this build. Please use a development build that includes the Google Sign-In module.',
        [{ text: 'OK' }],
      );
      return;
    }

    if (!isGoogleSignInReady()) {
      Alert.alert(
        'Google Sign-In Not Ready',
        'Google Sign-In is still initializing. Please wait a moment and try again.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      setIsLoading(true);
      dispatch(loginStart());

      console.log('Starting Google Sign-In from LoginScreen...');
      const result = await signInWithGoogle();

      if (result.success && result.user) {
        dispatch(loginSuccess(result.user));

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
      } else {
        dispatch(loginFailure(result.error || 'Failed to sign in with Google'));
        Alert.alert(
          'Authentication Error',
          result.error || 'Failed to sign in with Google',
        );
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred';
      dispatch(loginFailure(errorMessage));
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
                ? theme.primary
                : theme.textSecondary,
            },
            (isLoading || !googleSignInAvailable) && styles.disabledButton,
          ]}
          onPress={handleGoogleSignIn}
          disabled={isLoading || !googleSignInAvailable}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={[styles.googleButtonText, { marginLeft: 8 }]}>
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
            🔧 Sử dụng Native Google Sign-In
          </Text>
        )}

        <Text style={[styles.securityNote, { color: theme.textSecondary }]}>
          🔒 Your data is encrypted end-to-end and never stored on our servers
        </Text>
      </View>
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
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
