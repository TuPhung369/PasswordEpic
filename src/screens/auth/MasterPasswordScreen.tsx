import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppDispatch } from '../../hooks/redux';
import useBiometric from '../../hooks/useBiometric';
import {
  setMasterPasswordConfigured,
  setIsInSetupFlow,
} from '../../store/slices/authSlice';
import { storeMasterPassword } from '../../services/secureStorageService';
import { autofillService } from '../../services/autofillService';

interface RequirementItemProps {
  met: boolean;
  text: string;
  theme: any;
}

const RequirementItem: React.FC<RequirementItemProps> = ({
  met,
  text,
  theme,
}) => (
  <View style={styles.requirementItem}>
    <Ionicons
      name={met ? 'checkmark-circle-outline' : 'radio-button-off-outline'}
      size={16}
      color={met ? '#00C851' : theme.textSecondary}
    />
    <Text
      style={[
        styles.requirementText,
        met ? styles.requirementTextMet : { color: theme.textSecondary },
      ]}
    >
      {text}
    </Text>
  </View>
);

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
}

export const MasterPasswordScreen: React.FC = () => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const biometric = useBiometric();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [_renderCount, setRenderCount] = useState(0);

  // Ref to force immediate UI update when loading starts
  const updateCounterRef = useRef(0);

  // Mark that user is in setup flow to prevent auto-lock
  useEffect(() => {
    dispatch(setIsInSetupFlow(true));

    // Cleanup: Mark setup flow as complete when unmounting
    return () => {
      dispatch(setIsInSetupFlow(false));
    };
  }, [dispatch]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: 'default' | 'destructive';
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Calculate password strength
  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    const requirements = {
      length: pwd.length >= 12,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      numbers: /\d/.test(pwd),
      symbols: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
    };

    const score = Object.values(requirements).filter(Boolean).length;

    let label = 'Very Weak';
    let color = theme.error;

    if (score >= 5) {
      label = 'Very Strong';
      color = '#00C851';
    } else if (score >= 4) {
      label = 'Strong';
      color = '#2BBBAD';
    } else if (score >= 3) {
      label = 'Medium';
      color = '#FF8800';
    } else if (score >= 2) {
      label = 'Weak';
      color = '#FF4444';
    }

    return { score, label, color, requirements };
  };

  const passwordStrength = calculatePasswordStrength(password);
  const isPasswordValid = passwordStrength.score >= 4;
  const doPasswordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  /**
   * Show autofill prompt after master password setup
   * Requires biometric verification first, then enables autofill if verified
   */
  const showAutofillPrompt = async () => {
    try {
      console.log(
        '🔐 [MasterPasswordScreen] Starting biometric verification for autofill...',
      );

      // Step 1: Request biometric verification
      const authenticated = await biometric.authenticate(
        'Verify to enable Autofill service',
      );

      if (!authenticated) {
        console.log(
          '❌ [MasterPasswordScreen] Biometric verification failed or cancelled',
        );
        Alert.alert(
          'Verification Failed',
          'Biometric verification is required to enable autofill. You can enable it later from Settings.',
          [{ text: 'OK' }],
        );
        return;
      }

      console.log(
        '✅ [MasterPasswordScreen] Biometric verification successful',
      );

      // Step 2: Show autofill enable dialog
      setConfirmDialog({
        visible: true,
        title: '📱 Enable Autofill?',
        message:
          'Would you like to enable autofill for PasswordEpic now? You can select it from your Android autofill services. You can also enable or disable this anytime from Settings.',
        confirmText: 'Enable Now',
        cancelText: 'Skip for Now',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          setIsLoading(true);
          try {
            console.log(
              '🚀 [MasterPasswordScreen] User accepted autofill prompt - calling autoPromptEnableAutofill()',
            );
            await autofillService.autoPromptEnableAutofill();
            console.log(
              '✅ [MasterPasswordScreen] Autofill prompt completed - navigation handled by AppNavigator',
            );
          } catch (error) {
            console.error(
              '❌ [MasterPasswordScreen] Error in autoPromptEnableAutofill:',
              error,
            );
          } finally {
            setIsLoading(false);
          }
        },
        onCancel: () => {
          console.log(
            '⏭️ [MasterPasswordScreen] User skipped autofill prompt - closing dialog',
          );
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          // Navigation will be handled by AppNavigator based on auth state
        },
      });
    } catch (error) {
      console.error(
        '❌ [MasterPasswordScreen] Error in showAutofillPrompt:',
        error,
      );
      Alert.alert('Error', 'Failed to verify biometric for autofill setup');
    }
  };

  const handleSetMasterPassword = async () => {
    // Update loading state and force immediate re-render for instant UI feedback
    // This ensures the "Setting Password..." button appears immediately
    updateCounterRef.current++;
    setRenderCount(prev => prev + 1); // Force re-render BEFORE any validation
    setIsLoading(true);

    // Use setTimeout with 0ms to ensure UI updates before validation
    setTimeout(async () => {
      try {
        // Validate password strength
        if (!isPasswordValid) {
          setConfirmDialog({
            visible: true,
            title: 'Weak Password',
            message:
              'Please create a stronger password with at least 4 of the 5 requirements.',
            confirmText: 'OK',
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
          setIsLoading(false);
          return;
        }

        // Validate passwords match
        if (!doPasswordsMatch) {
          setConfirmDialog({
            visible: true,
            title: 'Password Mismatch',
            message: 'Passwords do not match. Please try again.',
            confirmText: 'OK',
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
          setIsLoading(false);
          return;
        }

        // Store master password securely
        const result = await storeMasterPassword(password.trim());

        if (!result.success) {
          throw new Error(result.error || 'Failed to store master password');
        }

        // Mark as configured in Redux store
        dispatch(setMasterPasswordConfigured(true));

        setConfirmDialog({
          visible: true,
          title: 'Success',
          message:
            'Master password has been set successfully. Your passwords will now be encrypted with this key.',
          confirmText: 'Continue',
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, visible: false }));
            // Show autofill prompt after master password success (with biometric verification)
            await showAutofillPrompt();
          },
        });
      } catch (error: any) {
        setConfirmDialog({
          visible: true,
          title: 'Error',
          message: error.message || 'Failed to set master password',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      } finally {
        setIsLoading(false);
      }
    }, 0);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Create Master Password
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              This password will encrypt all your data. Make it strong and
              memorable.
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Master Password
            </Text>
            <View
              style={[styles.inputContainer, { borderColor: theme.border }]}
            >
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                value={password}
                onChangeText={text => setPassword(text.trim())}
                placeholder="Enter your master password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        backgroundColor: passwordStrength.color,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.strengthLabel,
                    { color: passwordStrength.color },
                  ]}
                >
                  {passwordStrength.label}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              Confirm Password
            </Text>
            <View
              style={[styles.inputContainer, { borderColor: theme.border }]}
            >
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                value={confirmPassword}
                onChangeText={text => setConfirmPassword(text.trim())}
                placeholder="Confirm your master password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Password Match Indicator */}
            {confirmPassword.length > 0 && (
              <View style={styles.matchContainer}>
                <Ionicons
                  name={
                    doPasswordsMatch
                      ? 'checkmark-circle-outline'
                      : 'close-circle-outline'
                  }
                  size={16}
                  color={doPasswordsMatch ? '#00C851' : theme.error}
                />
                <Text
                  style={[
                    styles.matchText,
                    doPasswordsMatch
                      ? styles.matchTextSuccess
                      : { color: theme.error },
                  ]}
                >
                  {doPasswordsMatch
                    ? 'Passwords match'
                    : 'Passwords do not match'}
                </Text>
              </View>
            )}
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={[styles.requirementsTitle, { color: theme.text }]}>
              Password Requirements:
            </Text>
            <RequirementItem
              met={passwordStrength.requirements.length}
              text="At least 12 characters"
              theme={theme}
            />
            <RequirementItem
              met={passwordStrength.requirements.uppercase}
              text="At least one uppercase letter"
              theme={theme}
            />
            <RequirementItem
              met={passwordStrength.requirements.lowercase}
              text="At least one lowercase letter"
              theme={theme}
            />
            <RequirementItem
              met={passwordStrength.requirements.numbers}
              text="At least one number"
              theme={theme}
            />
            <RequirementItem
              met={passwordStrength.requirements.symbols}
              text="At least one special character"
              theme={theme}
            />
          </View>

          {/* Set Password Button */}
          <TouchableOpacity
            style={[
              styles.setPasswordButton,
              {
                backgroundColor:
                  isPasswordValid && doPasswordsMatch
                    ? theme.primary
                    : theme.surface,
              },
              isLoading && styles.disabledButton,
            ]}
            onPress={handleSetMasterPassword}
            disabled={!isPasswordValid || !doPasswordsMatch || isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={[styles.buttonText, styles.loadingButtonText]}>
                  Setting Password...
                </Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Set Master Password</Text>
            )}
          </TouchableOpacity>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.securityText, { color: theme.textSecondary }]}>
              Your master password cannot be recovered. Make sure to remember it
              or store it in a safe place.
            </Text>
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => {
          if (confirmDialog.onCancel) {
            confirmDialog.onCancel();
          } else {
            setConfirmDialog(prev => ({ ...prev, visible: false }));
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
  },
  eyeButton: {
    padding: 4,
  },
  strengthContainer: {
    marginTop: 12,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginBottom: 8,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  matchText: {
    fontSize: 14,
    marginLeft: 6,
  },
  requirementsContainer: {
    marginBottom: 32,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    marginLeft: 8,
  },
  requirementTextMet: {
    color: '#00C851',
  },
  matchTextSuccess: {
    color: '#00C851',
  },
  loadingButtonText: {
    marginLeft: 8,
  },
  setPasswordButton: {
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
});
