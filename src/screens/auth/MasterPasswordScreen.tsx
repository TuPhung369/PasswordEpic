import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  BackHandler,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { BiometricService } from '../../services/biometricService';
import {
  setMasterPasswordConfigured,
  setIsInSetupFlow,
  setHasCompletedSessionAuth,
  setShouldNavigateToUnlock,
  setShouldAutoTriggerBiometric,
  logout,
} from '../../store/slices/authSlice';
import { autofillService } from '../../services/autofillService';
import {
  setupMasterPasswordWithPin,
  unlockMasterPasswordWithPin,
} from '../../services/staticMasterPasswordService';

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

type MasterPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'MasterPassword'
>;

export const MasterPasswordScreen: React.FC<{
  onUnlock?: () => void;
}> = ({ onUnlock }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const shouldAutoTriggerBiometric = useAppSelector(
    state => state.auth.shouldAutoTriggerBiometric,
  );
  const navigation = useNavigation<MasterPasswordScreenNavigationProp>();
  const route = useRoute();
  const mode = (route.params as any)?.mode || 'setup';
  const isUpdateMode = mode === 'update';
  const isUnlockMode = mode === 'unlock';

  // State for old credentials verification (update mode only)
  const [isVerified, setIsVerified] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showOldPin, setShowOldPin] = useState(false);

  // State for new credentials
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [_renderCount, setRenderCount] = useState(0);

  // Ref to force immediate UI update when loading starts
  const updateCounterRef = useRef(0);

  // Mark that user is in setup flow to prevent auto-lock
  useEffect(() => {
    if (isUnlockMode) {
      dispatch(setIsInSetupFlow(false));
      return;
    }

    dispatch(setIsInSetupFlow(true));

    // Note: We don't reset isInSetupFlow on unmount here because the MasterPasswordScreen
    // unmounts when transitioning to Main navigator (after masterPasswordConfigured is set),
    // but showFaceIDSetup() and showAutofillPrompt() may still be running asynchronously.
    // Resetting it here would allow PasswordsScreen to bypass the autofill setup flow.
    // Instead, isInSetupFlow is managed explicitly by the autofill prompt completion.
  }, [dispatch, isUnlockMode]);

  // Auto-trigger biometric on mount when in unlock mode
  const [waitingForBiometric, setWaitingForBiometric] = useState(false);
  const [autoTriggeredBiometric, setAutoTriggeredBiometric] = useState(false);

  // ===== FREEZE FIX: Defer heavy form rendering =====
  // In unlock mode, start with form NOT ready (will be ready after biometric completes)
  // In setup mode, start with form ready immediately
  const [isFormReady, setIsFormReady] = useState(!isUnlockMode);

  // Defer form rendering until after biometric completes and interactions finish
  useEffect(() => {
    // Only defer if:
    // 1. In unlock mode (isUnlockMode = true)
    // 2. Not waiting for biometric (user cancelled/failed)
    // 3. Form not ready yet
    if (isUnlockMode && !waitingForBiometric && !isFormReady) {
      console.log('🎨 [MasterPassword] Biometric completed, preparing form...');
      // Use InteractionManager to defer rendering until animations complete
      const handle = InteractionManager.runAfterInteractions(() => {
        console.log('🎨 [MasterPassword] Form ready to render');
        setIsFormReady(true);
      });
      return () => handle.cancel();
    }
  }, [isUnlockMode, waitingForBiometric, isFormReady]);

  useEffect(() => {
    if (!isUnlockMode) {
      console.log('🔍 [MasterPassword] Not in unlock mode, skipping biometric');
      return;
    }

    if (autoTriggeredBiometric) {
      console.log('🔍 [MasterPassword] Biometric already triggered, skipping');
      return;
    }

    // 🔥 FIX: Only auto-trigger biometric if shouldAutoTriggerBiometric is true
    // This flag is set by AppNavigator on cold start
    if (!shouldAutoTriggerBiometric) {
      console.log(
        '🔍 [MasterPassword] shouldAutoTriggerBiometric=false - showing form directly (biometric already tried or not cold start)',
      );
      setWaitingForBiometric(false);
      return;
    }

    console.log(
      '🔍 [MasterPassword] useEffect triggered - checking biometric...',
    );

    const checkBiometric = async () => {
      try {
        const biometricService = BiometricService.getInstance();
        console.log('🔍 [MasterPassword] Checking biometric availability...');

        const isAvailable = await biometricService.isSensorAvailable();
        console.log('🔍 [MasterPassword] isSensorAvailable:', isAvailable);

        // For unlock mode, only check if sensor is available
        // Don't check storage status - if device has biometric, allow unlock with it
        console.log(
          '🔍 [MasterPassword] Unlock mode - ignoring storage status, using sensor availability only',
        );

        if (isAvailable) {
          setAutoTriggeredBiometric(true);
          setWaitingForBiometric(true); // Show loading instead of form
          console.log(
            '🔍 [MasterPassword] ✅ Auto-triggering biometric on mount',
          );

          // Small delay to let UI settle
          setTimeout(async () => {
            try {
              const result = await biometricService.authenticateWithBiometrics(
                'Authenticate to unlock PasswordEpic',
                'any',
              );

              if (result.success) {
                // Biometric successful - unlock without waiting for master password generation
                // Master password will be generated on-demand when user views/decrypts passwords
                console.log(
                  '✅ [MasterPassword] Biometric authentication succeeded',
                );

                // Mark session as authenticated immediately (non-blocking transition)
                dispatch(setHasCompletedSessionAuth(true));
                dispatch(setShouldNavigateToUnlock(false));
                dispatch(setShouldAutoTriggerBiometric(false));
                console.log(
                  '✅ [MasterPassword] Session marked as authenticated - UI will transition now',
                );

                // Call onUnlock callback to update AppNavigator's local state
                if (onUnlock) {
                  onUnlock();
                }
              } else {
                // Biometric failed/cancelled, show form for manual input
                console.log(
                  '❌ [MasterPassword] Biometric authentication failed/cancelled',
                );
                console.log(
                  '🎨 [MasterPassword] Setting waitingForBiometric=false to show form...',
                );
                dispatch(setShouldAutoTriggerBiometric(false));
                setWaitingForBiometric(false);
                console.log(
                  '🎨 [MasterPassword] Form will render after InteractionManager completes',
                );
              }
            } catch (error) {
              console.error('Auto biometric authentication error:', error);
              console.log(
                '🎨 [MasterPassword] Error - setting waitingForBiometric=false...',
              );
              dispatch(setShouldAutoTriggerBiometric(false));
              // Show form for manual input
              setWaitingForBiometric(false);
              console.log(
                '🎨 [MasterPassword] Form will render after InteractionManager completes',
              );
            }
          }, 300);
        } else {
          console.log(
            '🔍 [MasterPassword] ❌ Biometric sensor not available on device',
          );
          console.log('🔍 [MasterPassword] Showing Master Password + PIN form');
          console.log(
            '🎨 [MasterPassword] Setting waitingForBiometric=false...',
          );
          dispatch(setShouldAutoTriggerBiometric(false));
          setWaitingForBiometric(false);
          console.log(
            '🎨 [MasterPassword] Form will render after InteractionManager completes',
          );
        }
      } catch (error) {
        console.error('❌ [MasterPassword] Auto biometric check error:', error);
        dispatch(setShouldAutoTriggerBiometric(false));
        // Show form if biometric check fails
        setWaitingForBiometric(false);
      }
    };

    checkBiometric();
  }, [
    isUnlockMode,
    autoTriggeredBiometric,
    shouldAutoTriggerBiometric,
    dispatch,
    navigation,
    onUnlock,
  ]);

  // Track if we just navigated back from Face ID setup
  const [faceIDSetupInitiated, setFaceIDSetupInitiated] = useState(false);
  const autofillPromptShownRef = useRef(false);

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
    dismissible?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    dismissible: true,
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

    let label = t('auth.master_password.strength_very_weak');
    let color = theme.error;

    if (score >= 5) {
      label = t('auth.master_password.strength_very_strong');
      color = '#00C851';
    } else if (score >= 4) {
      label = t('auth.master_password.strength_strong');
      color = '#2BBBAD';
    } else if (score >= 3) {
      label = t('auth.master_password.strength_medium');
      color = '#FF8800';
    } else if (score >= 2) {
      label = t('auth.master_password.strength_weak');
      color = '#FF4444';
    }

    return { score, label, color, requirements };
  };

  const passwordStrength = calculatePasswordStrength(password);
  const isPasswordValid = passwordStrength.score >= 4;
  const doPasswordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  // PIN validation
  const isPinValid = pin.length >= 6 && pin.length <= 8 && /^\d+$/.test(pin);
  const doPinsMatch = pin === confirmPin && confirmPin.length > 0;
  const areBothSetupsValid = isUnlockMode
    ? isPinValid
    : isPasswordValid && doPasswordsMatch && isPinValid && doPinsMatch;

  /**
   * Show Face ID setup after master password setup
   * First setup Face ID, then ask about autofill
   */
  const showFaceIDSetup = async () => {
    try {
      console.log(
        '🔐 [MasterPasswordScreen] Checking biometric capability for Face ID setup...',
      );

      const biometricService = BiometricService.getInstance();
      const capability = await biometricService.checkBiometricCapability();

      if (!capability.available) {
        console.log(
          '⚠️ [MasterPasswordScreen] Biometric not available, skipping setup',
        );
        showAutofillPrompt();
        return;
      }

      console.log(
        '✅ [MasterPasswordScreen] Biometric available, showing autofill prompt...',
      );

      // Skip BiometricSetup navigation (screen not in AuthStackParamList)
      // Go directly to autofill prompt
      showAutofillPrompt();
    } catch (error) {
      console.error(
        '❌ [MasterPasswordScreen] Error in showFaceIDSetup:',
        error,
      );
      // Continue with autofill prompt anyway
      showAutofillPrompt();
    }
  };

  /**
   * Show autofill prompt after Face ID setup is complete
   */
  const showAutofillPrompt = useCallback(async () => {
    try {
      console.log(
        '🔐 [MasterPasswordScreen] Showing autofill prompt after Face ID setup...',
      );

      // Clear any saved navigation state to prevent restoration to previous app state
      try {
        const navPersistence = await import(
          '../../services/navigationPersistenceService'
        );
        await navPersistence.default.clearNavigationState();
        console.log(
          '🔐 [MasterPasswordScreen] Cleared saved navigation state for fresh app start',
        );
      } catch (navError) {
        console.error(
          '⚠️ [MasterPasswordScreen] Failed to clear navigation state:',
          navError,
        );
      }

      // Show autofill enable dialog
      setConfirmDialog({
        visible: true,
        title: t('dialogs.enable_autofill_title'),
        message: t('dialogs.enable_autofill_message'),
        confirmText: t('common.enable_now'),
        cancelText: t('common.skip_for_now'),
        dismissible: false,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          setIsLoading(true);
          try {
            console.log(
              '🚀 [MasterPasswordScreen] User accepted autofill prompt - calling autoPromptEnableAutofill()',
            );
            await autofillService.autoPromptEnableAutofill();
            console.log(
              '✅ [MasterPasswordScreen] Autofill prompt completed - setup flow finished',
            );
          } catch (error) {
            console.error(
              '❌ [MasterPasswordScreen] Error in autoPromptEnableAutofill:',
              error,
            );
          } finally {
            setIsLoading(false);
            dispatch(setIsInSetupFlow(false));
          }
        },
        onCancel: () => {
          console.log(
            '⏭️ [MasterPasswordScreen] User skipped autofill prompt - closing dialog',
          );
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          dispatch(setIsInSetupFlow(false));
        },
      });
    } catch (error) {
      console.error(
        '❌ [MasterPasswordScreen] Error in showAutofillPrompt:',
        error,
      );
      dispatch(setIsInSetupFlow(false));
      Alert.alert(t('common.error'), t('errors.failed_show_autofill'));
    }
  }, [dispatch, t]);

  // Handle hardware back button
  // - In unlock mode: Trigger biometric authentication again
  // - In setup/update mode: Prevent back (stay on screen)
  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (isUnlockMode) {
            // User pressed back while in unlock screen - trigger biometric again
            console.log(
              '🔙 [MasterPasswordScreen] Back pressed in unlock mode - triggering biometric...',
            );

            // Trigger biometric authentication
            const triggerBiometric = async () => {
              try {
                const biometricService = BiometricService.getInstance();

                const capability =
                  await biometricService.checkBiometricCapability();
                if (capability.available) {
                  const result =
                    await biometricService.authenticateWithBiometrics(
                      'Unlock your vault',
                    );

                  if (result.success) {
                    console.log(
                      '✅ [MasterPasswordScreen] Biometric authentication successful after back press',
                    );
                    // Mark session as authenticated immediately
                    // Master password will be generated on-demand when needed
                    dispatch(setHasCompletedSessionAuth(true));
                    dispatch(setShouldNavigateToUnlock(false));
                  } else {
                    console.log(
                      '❌ [MasterPasswordScreen] Biometric failed after back press - staying on Master Password screen',
                    );
                  }
                } else {
                  console.log(
                    '⚠️ [MasterPasswordScreen] Biometric not available - staying on Master Password screen',
                  );
                }
              } catch (error) {
                console.error(
                  '❌ [MasterPasswordScreen] Error triggering biometric on back press:',
                  error,
                );
              }
            };

            triggerBiometric();
            return true; // Prevent default back behavior
          }

          // In setup/update mode, prevent back
          return true;
        },
      );

      return () => backHandler.remove();
    }, [isUnlockMode, dispatch]),
  );

  // When returning from Face ID setup, show autofill prompt
  useEffect(() => {
    if (faceIDSetupInitiated && !autofillPromptShownRef.current) {
      autofillPromptShownRef.current = true;
      console.log(
        '🔐 [MasterPasswordScreen] Returned from Face ID setup, showing autofill prompt...',
      );
      setFaceIDSetupInitiated(false);
      // Small delay to ensure dialog state is ready
      const timer = setTimeout(async () => {
        try {
          await showAutofillPrompt();
        } catch (error) {
          console.error('Error showing autofill prompt:', error);
          autofillPromptShownRef.current = false;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [faceIDSetupInitiated, showAutofillPrompt]);

  // When BiometricSetup completes and navigates back with biometricSetupComplete param
  useEffect(() => {
    const biometricSetupComplete = (route.params as any)
      ?.biometricSetupComplete;
    if (biometricSetupComplete && !autofillPromptShownRef.current) {
      autofillPromptShownRef.current = true;
      console.log(
        '🔐 [MasterPasswordScreen] BiometricSetup completed, showing autofill prompt...',
      );
      const timer = setTimeout(async () => {
        try {
          await showAutofillPrompt();
        } catch (error) {
          console.error(
            'Error showing autofill prompt after biometric setup:',
            error,
          );
          autofillPromptShownRef.current = false;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [route.params, showAutofillPrompt]);

  /**
   * Verify old credentials before allowing update
   */
  const handleVerifyOldCredentials = async () => {
    setIsLoading(true);
    try {
      // Validate old password format
      if (!oldPassword || oldPassword.length < 12) {
        setConfirmDialog({
          visible: true,
          title: t('auth.master_password.invalid_password'),
          message: t('auth.master_password.enter_current_password'),
          confirmText: t('common.ok'),
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
        setIsLoading(false);
        return;
      }

      // Validate old PIN format
      if (
        !oldPin ||
        oldPin.length < 6 ||
        oldPin.length > 8 ||
        !/^\d+$/.test(oldPin)
      ) {
        setConfirmDialog({
          visible: true,
          title: t('auth.master_password.invalid_pin'),
          message: t('auth.master_password.enter_current_pin'),
          confirmText: t('common.ok'),
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
        setIsLoading(false);
        return;
      }

      // Step 1: Unlock with PIN to get the stored Master Password
      console.log('🔐 [Verification] Attempting to unlock with PIN...');
      console.log('🔍 [DEBUG] PIN entered:', oldPin.trim().length, 'digits');

      const unlockResult = await unlockMasterPasswordWithPin(oldPin.trim());

      console.log('🔍 [DEBUG] Unlock result:', {
        success: unlockResult.success,
        hasPassword: !!unlockResult.password,
        error: unlockResult.error,
      });

      if (!unlockResult.success || !unlockResult.password) {
        console.error(
          '❌ [Verification] PIN unlock failed:',
          unlockResult.error,
        );
        // Provide more specific error message
        const errorMsg = unlockResult.error?.includes('Authentication tag')
          ? 'Incorrect PIN. Please make sure you entered your current 6-8 digit PIN correctly.'
          : unlockResult.error ||
            'Invalid PIN. Please check your PIN and try again.';
        throw new Error(errorMsg);
      }

      console.log('✅ [Verification] PIN unlock successful');
      console.log(
        '🔍 [DEBUG] Unlocked password length:',
        unlockResult.password.length,
      );

      // Step 2: Verify the entered Master Password matches the stored one
      // The unlockResult.password is the actual user's Master Password from Firebase
      // We just need to compare it directly with what the user entered

      const enteredPassword = oldPassword.trim();
      const storedPassword = unlockResult.password;

      console.log('🔍 [DEBUG] Comparing passwords:');
      console.log('  - Entered length:', enteredPassword.length);
      console.log('  - Stored length:', storedPassword.length);
      console.log('  - Match:', enteredPassword === storedPassword);

      // Direct comparison of user's Master Password
      if (enteredPassword !== storedPassword) {
        throw new Error(
          'Invalid Master Password. The Master Password you entered does not match your current password.',
        );
      }

      // Both PIN and Master Password verified successfully
      console.log('✅ Old credentials verified successfully');
      setIsVerified(true);
      setConfirmDialog({
        visible: true,
        title: t('auth.master_password.verification_successful'),
        message: t('auth.master_password.verification_successful_message'),
        confirmText: t('common.continue'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    } catch (error: any) {
      console.error('❌ Verification failed:', error);
      setConfirmDialog({
        visible: true,
        title: t('auth.master_password.verification_failed'),
        message:
          error.message || t('auth.master_password.credentials_not_match'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    } finally {
      setIsLoading(false);
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
        // Handle unlock mode
        if (isUnlockMode) {
          if (!isPinValid) {
            setConfirmDialog({
              visible: true,
              title: t('auth.master_password.invalid_pin'),
              message: t('auth.master_password.pin_6_8_digits'),
              confirmText: t('common.ok'),
              onConfirm: () =>
                setConfirmDialog(prev => ({ ...prev, visible: false })),
            });
            setIsLoading(false);
            return;
          }

          const result = await unlockMasterPasswordWithPin(pin.trim());
          if (result.success) {
            console.log(
              '✅ [MasterPasswordScreen] Unlock successful with Master Password',
            );

            // Mark session as authenticated - this will trigger AppNavigator to show Main stack
            dispatch(setHasCompletedSessionAuth(true));
            dispatch(setShouldNavigateToUnlock(false)); // Reset unlock flag

            // Call onUnlock callback to update AppNavigator's local state
            if (onUnlock) {
              onUnlock();
            }

            // Show success message
            setConfirmDialog({
              visible: true,
              title: t('common.success'),
              message: t('auth.master_password.unlock_success'),
              confirmText: t('common.continue'),
              dismissible: false,
              onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, visible: false }));
              },
            });
          } else {
            throw new Error(result.error || t('errors.failed_unlock'));
          }
          return;
        }

        // Validate password strength
        if (!isPasswordValid) {
          setConfirmDialog({
            visible: true,
            title: t('auth.master_password.weak_password'),
            message: t('auth.master_password.weak_password_message'),
            confirmText: t('common.ok'),
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
            title: t('auth.master_password.password_mismatch'),
            message: t('auth.master_password.passwords_not_match'),
            confirmText: t('common.ok'),
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
          setIsLoading(false);
          return;
        }

        // Validate PIN
        if (!isPinValid) {
          setConfirmDialog({
            visible: true,
            title: t('auth.master_password.invalid_pin'),
            message: t('auth.master_password.pin_6_8_digits'),
            confirmText: t('common.ok'),
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
          setIsLoading(false);
          return;
        }

        // Validate PINs match
        if (!doPinsMatch) {
          setConfirmDialog({
            visible: true,
            title: t('auth.master_password.pin_mismatch'),
            message: t('auth.master_password.pins_not_match'),
            confirmText: t('common.ok'),
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
          setIsLoading(false);
          return;
        }

        // Setup or update master password with PIN
        // Use same function for both initial setup and update
        // setupMasterPasswordWithPin will reuse existing salt automatically
        const result = await setupMasterPasswordWithPin(
          password.trim(),
          pin.trim(),
        );

        if (!result.success) {
          throw new Error(
            result.error || 'Failed to setup master password with PIN',
          );
        }

        // Ensure isInSetupFlow is true BEFORE changing masterPasswordConfigured
        // This prevents PasswordsScreen's autofill check from running before our prompt
        dispatch(setIsInSetupFlow(true));

        // Mark as configured in Redux store
        dispatch(setMasterPasswordConfigured(true));

        // For initial setup, mark session auth as complete so user can access app
        // (but autofill prompt will be delayed until biometric setup is done)
        if (!isUpdateMode) {
          dispatch(setHasCompletedSessionAuth(true));
        }

        setConfirmDialog({
          visible: true,
          title: t('common.success'),
          message: isUpdateMode
            ? t('auth.master_password.update_success')
            : t('auth.master_password.setup_success'),
          confirmText: t('common.continue'),
          dismissible: false,
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, visible: false }));
            if (isUpdateMode) {
              // After credential update, need to fully logout and re-authenticate
              // This ensures all caches are cleared and new credentials are used
              try {
                console.log(
                  '🔐 [MasterPasswordScreen] Logging out to apply new credentials...',
                );

                // Clear navigation state
                const navPersistence = await import(
                  '../../services/navigationPersistenceService'
                );
                await navPersistence.default.clearNavigationState();

                // End session and logout
                const sessionService = await import(
                  '../../services/sessionService'
                );
                await sessionService.SessionService.getInstance().endSession();

                // Dispatch logout to clear Redux state
                dispatch(logout());

                console.log(
                  '✅ [MasterPasswordScreen] Logout complete - please login again with new credentials',
                );
              } catch (error) {
                console.error('⚠️ [MasterPasswordScreen] Logout error:', error);
              }

              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              // Show Face ID setup after master password success (or autofill prompt if not available)
              await showFaceIDSetup();
            }
          },
        });
      } catch (error: any) {
        setConfirmDialog({
          visible: true,
          title: t('common.error'),
          message: error.message || t('errors.failed_set_master_password'),
          confirmText: t('common.ok'),
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      } finally {
        setIsLoading(false);
      }
    }, 0);
  };

  // Show loading screen while waiting for biometric in unlock mode OR form not ready
  if (isUnlockMode && (waitingForBiometric || !isFormReady)) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.content}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {waitingForBiometric
              ? t('auth.master_password.authenticating_biometric')
              : t('auth.master_password.preparing_unlock')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
              {isUnlockMode
                ? t('auth.unlock.title')
                : isUpdateMode
                ? isVerified
                  ? t('auth.master_password.update_credentials')
                  : t('auth.master_password.verify_credentials')
                : t('auth.master_password.create_title')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {isUnlockMode
                ? t('auth.unlock.enter_pin_unlock')
                : isUpdateMode
                ? isVerified
                  ? t('auth.master_password.update_subtitle')
                  : t('auth.master_password.verify_subtitle')
                : t('auth.master_password.create_subtitle')}
            </Text>
          </View>

          {/* VERIFICATION FORM - Show in update mode before verification */}
          {isUpdateMode && !isVerified ? (
            <>
              {/* Old Master Password Input */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('auth.master_password.current_password')}
                </Text>
                <View
                  style={[styles.inputContainer, { borderColor: theme.border }]}
                >
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    placeholder={t(
                      'auth.master_password.current_password_placeholder',
                    )}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showOldPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                  />
                  <TouchableOpacity
                    onPress={() => setShowOldPassword(!showOldPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showOldPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={24}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Old PIN Input */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('auth.master_password.current_pin')}
                </Text>
                <View
                  style={[styles.inputContainer, { borderColor: theme.border }]}
                >
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    value={oldPin}
                    onChangeText={text =>
                      setOldPin(text.replace(/[^0-9]/g, ''))
                    }
                    placeholder={t(
                      'auth.master_password.current_pin_placeholder',
                    )}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showOldPin}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoComplete="off"
                    importantForAutofill="no"
                  />
                  <TouchableOpacity
                    onPress={() => setShowOldPin(!showOldPin)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showOldPin ? 'eye-off-outline' : 'eye-outline'}
                      size={24}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                  (!oldPassword || !oldPin || isLoading) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleVerifyOldCredentials}
                disabled={!oldPassword || !oldPin || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#ffffff"
                    />
                    <Text style={styles.submitButtonText}>
                      {t('auth.master_password.verify_credentials_btn')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* NEW CREDENTIALS FORM - Show after verification or in setup/unlock mode */}
              {/* Password Input */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('auth.master_password.master_password_label')}
                </Text>
                <View
                  style={[styles.inputContainer, { borderColor: theme.border }]}
                >
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    value={password}
                    onChangeText={text => setPassword(text.trim())}
                    placeholder={t(
                      'auth.master_password.enter_master_password',
                    )}
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

              {/* Confirm Password Input - only show in setup/update mode */}
              {!isUnlockMode && (
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    {t('auth.master_password.confirm_password_label')}
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { borderColor: theme.border },
                    ]}
                  >
                    <TextInput
                      style={[styles.textInput, { color: theme.text }]}
                      value={confirmPassword}
                      onChangeText={text => setConfirmPassword(text.trim())}
                      placeholder={t(
                        'auth.master_password.confirm_password_placeholder',
                      )}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                      importantForAutofill="no"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={
                          showConfirmPassword
                            ? 'eye-off-outline'
                            : 'eye-outline'
                        }
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
                          ? t('auth.master_password.passwords_match')
                          : t('auth.master_password.passwords_not_match')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* PIN Input */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('auth.master_password.security_pin_label')}
                </Text>
                <View
                  style={[styles.inputContainer, { borderColor: theme.border }]}
                >
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    value={pin}
                    onChangeText={text =>
                      setPin(text.replace(/[^0-9]/g, '').slice(0, 8))
                    }
                    placeholder={t(
                      'auth.master_password.enter_pin_placeholder',
                    )}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPin}
                    keyboardType="number-pad"
                    maxLength={8}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPin(!showPin)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPin ? 'eye-off-outline' : 'eye-outline'}
                      size={24}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* PIN Length Indicator */}
                {pin.length > 0 && (
                  <View style={styles.pinLengthContainer}>
                    <Ionicons
                      name={
                        isPinValid
                          ? 'checkmark-circle-outline'
                          : 'radio-button-off-outline'
                      }
                      size={16}
                      color={isPinValid ? '#00C851' : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.pinLengthText,
                        isPinValid
                          ? styles.pinLengthTextValid
                          : { color: theme.textSecondary },
                      ]}
                    >
                      {pin.length} {t('auth.master_password.digits')} (
                      {isPinValid
                        ? t('auth.master_password.valid')
                        : t('auth.master_password.need_6_8')}
                      )
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm PIN Input - only show in setup/update mode */}
              {!isUnlockMode && (
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    {t('auth.master_password.confirm_pin_label')}
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      { borderColor: theme.border },
                    ]}
                  >
                    <TextInput
                      style={[styles.textInput, { color: theme.text }]}
                      value={confirmPin}
                      onChangeText={text =>
                        setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 6))
                      }
                      placeholder={t(
                        'auth.master_password.confirm_pin_placeholder',
                      )}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showConfirmPin}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPin(!showConfirmPin)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={
                          showConfirmPin ? 'eye-off-outline' : 'eye-outline'
                        }
                        size={24}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* PIN Match Indicator */}
                  {confirmPin.length > 0 && (
                    <View style={styles.matchContainer}>
                      <Ionicons
                        name={
                          doPinsMatch
                            ? 'checkmark-circle-outline'
                            : 'close-circle-outline'
                        }
                        size={16}
                        color={doPinsMatch ? '#00C851' : theme.error}
                      />
                      <Text
                        style={[
                          styles.matchText,
                          doPinsMatch
                            ? styles.matchTextSuccess
                            : { color: theme.error },
                        ]}
                      >
                        {doPinsMatch
                          ? t('auth.master_password.pins_match')
                          : t('auth.master_password.pins_not_match')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Password Requirements - only show in setup/update mode and after verification */}
              {!isUnlockMode && (!isUpdateMode || isVerified) && (
                <View style={styles.requirementsContainer}>
                  <Text
                    style={[styles.requirementsTitle, { color: theme.text }]}
                  >
                    {t('auth.master_password.requirements_title')}
                  </Text>
                  <RequirementItem
                    met={passwordStrength.requirements.length}
                    text={t('auth.master_password.req_12_chars')}
                    theme={theme}
                  />
                  <RequirementItem
                    met={passwordStrength.requirements.uppercase}
                    text={t('auth.master_password.req_uppercase')}
                    theme={theme}
                  />
                  <RequirementItem
                    met={passwordStrength.requirements.lowercase}
                    text={t('auth.master_password.req_lowercase')}
                    theme={theme}
                  />
                  <RequirementItem
                    met={passwordStrength.requirements.numbers}
                    text={t('auth.master_password.req_number')}
                    theme={theme}
                  />
                  <RequirementItem
                    met={passwordStrength.requirements.symbols}
                    text={t('auth.master_password.req_special')}
                    theme={theme}
                  />
                </View>
              )}
            </>
          )}

          {/* Set Password Button - only show for setup/unlock OR update mode after verification */}
          {(!isUpdateMode || isVerified) && (
            <TouchableOpacity
              style={[
                styles.setPasswordButton,
                {
                  backgroundColor: areBothSetupsValid
                    ? theme.primary
                    : theme.surface,
                },
                isLoading && styles.disabledButton,
              ]}
              onPress={handleSetMasterPassword}
              disabled={!areBothSetupsValid || isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.buttonText, styles.loadingButtonText]}>
                    {isUnlockMode
                      ? t('auth.unlock.unlocking')
                      : t('auth.master_password.setting_password')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>
                  {isUnlockMode
                    ? t('auth.unlock.unlock_vault')
                    : t('auth.master_password.complete_setup')}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Security Note - only show in setup/update mode and after verification */}
          {!isUnlockMode && (!isUpdateMode || isVerified) && (
            <View style={styles.securityNote}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={theme.primary}
              />
              <Text
                style={[styles.securityText, { color: theme.textSecondary }]}
              >
                {t('auth.master_password.security_note')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmStyle={confirmDialog.confirmStyle}
        dismissible={confirmDialog.dismissible}
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

  pinLengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  pinLengthText: {
    fontSize: 14,
    marginLeft: 6,
  },
  pinLengthTextValid: {
    color: '#00C851',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
