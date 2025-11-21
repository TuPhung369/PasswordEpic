import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import { useBiometric } from '../../hooks/useBiometric';
import PasswordForm from '../../components/PasswordForm';
import PasswordHistoryViewer, {
  PasswordHistoryItem,
} from '../../components/PasswordHistoryViewer';
import SecurityAuditPanel from '../../components/SecurityAuditPanel';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PinPromptModal } from '../../components/PinPromptModal';
import { BiometricPrompt } from '../../components/BiometricPrompt';
import { BiometricFallbackPrompt } from '../../components/BiometricFallbackPrompt';
import { PasswordEntry, PasswordHistoryEntry } from '../../types/password';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import { PasswordValidationService } from '../../services/passwordValidationService';
import { AuditHistoryService } from '../../services/auditHistoryService';
import {
  calculateSecurityScore,
  isValidDomain,
} from '../../utils/passwordUtils';
import { useAppDispatch } from '../../hooks/redux';
import { decryptPasswordField } from '../../store/slices/passwordsSlice';
import {
  getEffectiveMasterPassword,
  unlockMasterPasswordWithPin,
} from '../../services/staticMasterPasswordService';

type EditPasswordRouteProp = RouteProp<PasswordsStackParamList, 'EditPassword'>;

type EditPasswordNavigationProp = NativeStackNavigationProp<
  PasswordsStackParamList,
  'EditPassword'
>;

interface EditPasswordScreenProps {}

export const EditPasswordScreen: React.FC<EditPasswordScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<EditPasswordNavigationProp>();
  const route = useRoute<EditPasswordRouteProp>();
  const { passwordId } = route.params;
  const dispatch = useAppDispatch();

  const { passwords, updatePassword, deletePassword, isLoading } =
    usePasswordManagement();
  const { authenticate: authenticateBiometric } = useBiometric();

  const [password, setPassword] = useState<PasswordEntry | null>(null);
  const [formData, setFormData] = useState<Partial<PasswordEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastDuration, setToastDuration] = useState(2000);
  const [isDeleteDialogShowing, setIsDeleteDialogShowing] = useState(false);

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

  // Track if password has been decrypted
  const [isPasswordDecrypted, setIsPasswordDecrypted] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string>('');

  // PIN unlock dialog state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] =
    useState<PasswordEntry | null>(null);
  const [isPasswordChanged, setIsPasswordChanged] = useState(false); // Track if password changed
  const [unlockedMasterPassword, setUnlockedMasterPassword] = useState<
    string | undefined
  >(undefined);

  // Audit data state
  const [latestAudit, setLatestAudit] = useState<any>(null);

  // Biometric authentication flow states
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinPromptResolver, setPinPromptResolver] = useState<{
    resolve: (password: string) => void;
    reject: () => void;
  } | null>(null);

  // Memoize toast hide callback to prevent re-renders from resetting the timer
  const handleHideToast = useCallback(() => {
    setShowToast(false);
  }, []);

  const showToastNotification = useCallback(
    ({
      message,
      type,
      duration,
    }: {
      message: string;
      type: 'success' | 'error';
      duration?: number;
    }) => {
      setToastMessage(message);
      setToastType(type);
      setToastDuration(duration ?? 2000);
      setShowToast(true);
    },
    [],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 16,
    },
    headerButton: {
      padding: 8,
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.primary,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.error,
    },
    content: {
      flex: 1,
    },
    formContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    actionButtons: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 12,
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    saveButtonDisabled: {
      backgroundColor: theme.textSecondary,
    },
    deleteButton: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    deleteButtonTextStyle: {
      color: theme.error,
      fontSize: 16,
      fontWeight: '600',
    },
    deleteButtonTextDisabled: {
      color: theme.error,
      fontSize: 16,
      fontWeight: '600',
      opacity: 0.5,
    },
    deleteButtonDisabled: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.5,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: theme.textSecondary,
      marginTop: 16,
      fontSize: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    errorIcon: {
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    // PIN Dialog Styles
    pinOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    pinContainer: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 16,
      paddingHorizontal: 24,
      paddingVertical: 32,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    pinHeader: {
      alignItems: 'center',
      marginBottom: 32,
    },
    pinIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    pinTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    pinSubtitle: {
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 22,
    },
    pinInputSection: {
      marginBottom: 32,
    },
    pinInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    pinInput: {
      flex: 1,
      fontSize: 16,
      marginLeft: 12,
      marginRight: 8,
    },
    pinButtonSection: {
      flexDirection: 'row',
      gap: 12,
    },
    pinButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinCancelButton: {
      borderWidth: 1,
    },
    pinUnlockButton: {
      // backgroundColor set dynamically
    },
    pinButtonDisabled: {
      opacity: 0.6,
    },
    pinButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });

  // Load password data
  // Track if password has been loaded to prevent overwriting user edits
  const [isPasswordLoaded, setIsPasswordLoaded] = useState(false);

  useEffect(() => {
    const foundPassword = passwords.find(p => p.id === passwordId);
    if (foundPassword && !isPasswordLoaded) {
      console.log(
        '🔍 EditPasswordScreen: Initial loading password (metadata only):',
        { ...foundPassword, password: '[ENCRYPTED]' },
      );
      setPassword(foundPassword);

      // Load formData with encrypted password (will be decrypted on-demand)
      setFormData({
        ...foundPassword,
        password: foundPassword.password, // Keep encrypted password
        isDecrypted: false, // ✅ Mark as encrypted initially
      });

      setIsPasswordLoaded(true);
      console.log(
        '🔍 EditPasswordScreen: FormData set with encrypted password',
      );
    }
  }, [passwords, passwordId, isPasswordLoaded]);

  // Sync password state with Redux when isDecrypted flag changes
  useEffect(() => {
    const foundPassword = passwords.find(p => p.id === passwordId);
    if (foundPassword && isPasswordLoaded) {
      // Update password state to reflect Redux changes (e.g., after decrypt)
      setPassword(foundPassword);

      // If password was decrypted in Redux, update formData
      if (foundPassword.isDecrypted && !isPasswordDecrypted) {
        console.log(
          '🔄 EditPasswordScreen: Syncing decrypted password from Redux',
        );
        setFormData(prev => ({
          ...prev,
          password: foundPassword.password,
          isDecrypted: true, // ✅ Set isDecrypted flag so PasswordForm knows it's plaintext
        }));
        setDecryptedPassword(foundPassword.password);
        setIsPasswordDecrypted(true);
      }
    }
  }, [passwords, passwordId, isPasswordLoaded, isPasswordDecrypted]);

  // Fetch audit history
  useEffect(() => {
    if (!password) return;

    const fetchAuditData = async () => {
      try {
        const history = await AuditHistoryService.getAuditHistory(password.id);
        if (history.length > 0) {
          setLatestAudit({
            ...history[0],
            auditHistory: history,
          });
          console.log('✅ EditPasswordScreen: Audit history loaded for:', password.id, 'Total:', history.length, 'Latest Score:', history[0]?.score);
        }
      } catch (error) {
        console.error('❌ EditPasswordScreen: Failed to load audit history:', error);
      }
    };

    fetchAuditData();
  }, [password]);

  // Decrypt password on-demand when user wants to view it
  const performDecryption = useCallback(
    async (masterPassword: string) => {
      if (!password) return '';

      try {
        console.log(
          '🔓 EditPasswordScreen: Decrypting password with master password...',
        );

        const result = await dispatch(
          decryptPasswordField({
            id: password.id,
            masterPassword: masterPassword,
          }),
        ).unwrap();

        if (result.password) {
          setDecryptedPassword(result.password);
          setIsPasswordDecrypted(true);
          // Update formData with decrypted password so PasswordForm can display it
          setFormData(prev => {
            const updated = { ...prev, password: result.password };
            console.log(
              '✅ EditPasswordScreen: Password decrypted, updating formData:',
              {
                before: '[ENCRYPTED]',
                after: '[DECRYPTED]',
                actualPassword: updated.password.substring(0, 3) + '***',
              },
            );
            return updated;
          });
          console.log('✅ EditPasswordScreen: Password decrypted successfully');
          return result.password;
        }

        throw new Error('Failed to decrypt password');
      } catch (error) {
        console.error(
          '❌ EditPasswordScreen: Failed to decrypt password:',
          error,
        );
        setToastType('error');
        setToastMessage('Failed to decrypt password');
        setShowToast(true);
        return '';
      }
    },
    [password, dispatch],
  );

  const handleDecryptPassword = useCallback(async () => {
    if (isPasswordDecrypted || !password) {
      return decryptedPassword;
    }

    console.log(
      '🔐 EditPasswordScreen: Starting biometric authentication flow...',
    );

    // Return a promise that resolves when authentication completes
    return new Promise<string>((resolve, reject) => {
      setPinPromptResolver({ resolve, reject });
      // Trigger biometric flow - will lead to PinPrompt or FallbackModal
      setShowBiometricPrompt(true);
    });
  }, [password, isPasswordDecrypted, decryptedPassword]);

  // Layer 2: PIN verification (after successful biometric)
  const handlePinPromptSuccess = async (masterPassword: string) => {
    setShowPinPrompt(false);
    await performDecryption(masterPassword);

    // Resolve the promise from handleDecryptPassword with the master password
    if (pinPromptResolver) {
      pinPromptResolver.resolve(masterPassword);
      setPinPromptResolver(null);
    }
  };

  const handlePinPromptCancel = () => {
    setShowPinPrompt(false);

    // Reject the promise from handleDecryptPassword
    if (pinPromptResolver) {
      pinPromptResolver.reject();
      setPinPromptResolver(null);
    }
  };

  // Biometric authentication success - proceed to PIN verification
  const handleBiometricSuccess = async () => {
    setShowBiometricPrompt(false);
    showToastNotification({
      message: 'Biometric verified',
      type: 'success',
      duration: 1500,
    });

    setTimeout(() => {
      setShowPinPrompt(true);
    }, 500);
  };

  // Biometric authentication error - fallback to master password + PIN
  const handleBiometricError = (error: string) => {
    setShowBiometricPrompt(false);
    showToastNotification({
      message: error || 'Authentication failed',
      type: 'error',
      duration: 1500,
    });

    setTimeout(() => {
      setShowFallbackModal(true);
    }, 500);
  };

  // Biometric prompt closed by user - show fallback modal
  const handleBiometricClose = () => {
    setShowBiometricPrompt(false);
    setTimeout(() => {
      setShowFallbackModal(true);
    }, 500);
  };

  // Biometric fallback (Master Password + PIN) success
  const handleFallbackSuccess = async (masterPassword: string) => {
    setShowFallbackModal(false);

    try {
      console.log(
        '🔓 EditPasswordScreen: Fallback verified - decrypting password',
      );
      const decrypted = await performDecryption(masterPassword);

      if (!decrypted) {
        throw new Error('Decryption returned empty password');
      }

      showToastNotification({
        message: 'Authentication successful',
        type: 'success',
        duration: 1500,
      });

      if (pinPromptResolver) {
        pinPromptResolver.resolve(masterPassword);
        setPinPromptResolver(null);
      }
    } catch (error) {
      console.error(
        '❌ EditPasswordScreen: Failed to decrypt password:',
        error,
      );
      showToastNotification({
        message: 'Failed to decrypt password',
        type: 'error',
        duration: 1500,
      });

      if (pinPromptResolver) {
        pinPromptResolver.reject();
        setPinPromptResolver(null);
      }
    }
  };

  // Biometric fallback cancelled
  const handleFallbackCancel = () => {
    setShowFallbackModal(false);

    if (pinPromptResolver) {
      pinPromptResolver.reject();
      setPinPromptResolver(null);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setConfirmDialog({
        visible: true,
        title: 'Discard Changes?',
        message:
          'You have unsaved changes. Are you sure you want to discard them?',
        confirmText: 'Discard',
        confirmStyle: 'destructive',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          navigation.goBack();
        },
      });
    } else {
      navigation.goBack();
    }
  };

  const hasUnsavedChanges = (): boolean => {
    if (!password) return false;

    // Check metadata changes
    const metadataChanged =
      formData.title !== password.title ||
      formData.username !== password.username ||
      formData.website !== password.website ||
      formData.notes !== password.notes ||
      formData.category !== password.category ||
      JSON.stringify(formData.tags) !== JSON.stringify(password.tags) ||
      formData.isFavorite !== password.isFavorite;

    // Check password changes:
    // Compare current password with original password value
    // This works for both encrypted and decrypted states
    const passwordChanged = formData.password !== password.password;

    return metadataChanged || passwordChanged;
  };

  const isFormValid = (): boolean => {
    const hasTitle = !!(formData.title && formData.title.trim().length > 0);
    const hasPassword = !!(
      formData.password && formData.password.trim().length > 0
    );
    const hasUsernameOrEmail = !!(
      (formData.username && formData.username.trim().length > 0) ||
      (formData.website && formData.website.trim().length > 0)
    );
    const hasDomain = isValidDomain(formData.website);
    return hasTitle && hasPassword && hasUsernameOrEmail && hasDomain;
  };

  const handleRestorePassword = (historyItem: PasswordHistoryItem) => {
    setFormData(prev => ({ ...prev, password: historyItem.password }));
  };

  const handleSave = async (masterPassword?: string) => {
    if (!password || !isFormValid()) {
      const hasTitle = !!(formData.title && formData.title.trim().length > 0);
      const hasPassword = !!(
        formData.password && formData.password.trim().length > 0
      );
      const hasUsernameOrEmail = !!(
        (formData.username && formData.username.trim().length > 0) ||
        (formData.website && formData.website.trim().length > 0)
      );
      const hasDomain = isValidDomain(formData.website);

      let errorMessage = 'Please fill in all required fields:';
      if (!hasTitle) errorMessage += ' Title,';
      if (!hasPassword) errorMessage += ' Password,';
      if (!hasUsernameOrEmail) errorMessage += ' Username/Email,';
      if (!hasDomain) errorMessage += ' Valid Domain (URL or App Package),';
      errorMessage = errorMessage.replace(/,$/, '.'); // Remove trailing comma and add period

      setConfirmDialog({
        visible: true,
        title: 'Validation Error',
        message: errorMessage,
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsSaving(true);

    try {
      // Determine the final password value to save
      let finalPassword: string;
      let passwordChanged = false;

      if (isPasswordDecrypted && formData.password) {
        // User has viewed and possibly modified the password
        finalPassword = formData.password;
        passwordChanged = formData.password !== decryptedPassword;
        console.log(
          '💾 EditPasswordScreen: Password was decrypted and modified:',
          passwordChanged,
        );
      } else if (isPasswordDecrypted && !formData.password) {
        // User decrypted but cleared the password field
        // In this case, keep the original password
        console.log(
          '💾 EditPasswordScreen: Password field cleared, keeping original',
        );
        const originalPassword = await handleDecryptPassword();
        finalPassword = originalPassword;
        passwordChanged = false;
      } else {
        // Password was never decrypted
        // Check if user directly edited the password field (compare with original encrypted value)
        const userEditedPassword = formData.password !== password.password;

        if (userEditedPassword && formData.password) {
          // User directly typed a new password without decrypting
          finalPassword = formData.password;
          passwordChanged = true;
          console.log(
            '💾 EditPasswordScreen: Password changed without decryption (direct edit)',
          );
        } else {
          // Password not modified, keep the original encrypted value
          console.log(
            '💾 EditPasswordScreen: Password not modified, keeping encrypted',
          );
          finalPassword = password.password; // Keep encrypted password
          passwordChanged = false;
        }
      }

      // Store password changed status for error handling
      setIsPasswordChanged(passwordChanged);

      // 🔐 PROACTIVE PIN CHECK: If password changed and no masterPassword provided, verify authentication BEFORE saving
      if (passwordChanged && !masterPassword) {
        console.log(
          '🔐 EditPasswordScreen: Password changed - checking authentication...',
        );
        const authCheck = await getEffectiveMasterPassword();

        if (!authCheck.success || !authCheck.password) {
          console.log(
            '🔐 EditPasswordScreen: Authentication required - showing PIN dialog',
          );
          // Store the current form data to retry after PIN unlock
          setPendingUpdateData(password);
          setIsSaving(false);
          setShowPinDialog(true);
          return; // Stop here and wait for PIN
        }

        console.log(
          '✅ EditPasswordScreen: Authentication verified - proceeding with save',
        );
      } else if (passwordChanged && masterPassword) {
        console.log(
          '✅ EditPasswordScreen: Password changed but masterPassword already provided (from PIN unlock) - proceeding with save',
        );
      }

      // Create new password history entry if password changed
      let updatedPasswordHistory = password.passwordHistory || [];
      if (passwordChanged && decryptedPassword) {
        const historyEntry: PasswordHistoryEntry = {
          id: `history_${Date.now()}`,
          password: decryptedPassword, // Save the OLD password to history
          createdAt: password.updatedAt || password.createdAt,
          strength:
            password.auditData?.passwordStrength ||
            PasswordValidationService.analyzePasswordStrength(
              decryptedPassword,
            ),
        };
        updatedPasswordHistory = [
          historyEntry,
          ...updatedPasswordHistory,
        ].slice(0, 10); // Keep last 10
      }

      // Create temporary password entry for security score calculation
      const tempPassword: PasswordEntry = {
        ...password,
        ...formData,
        title: formData.title!.trim(),
        username: formData.username || '',
        password: finalPassword,
        website: formData.website || '',
        notes: formData.notes || '',
        category: formData.category || '',
        tags: formData.tags || [],
        updatedAt: new Date(),
        passwordHistory: updatedPasswordHistory,
      };

      const updatedPassword: PasswordEntry = {
        ...tempPassword,
        // Update audit data if password changed
        auditData:
          passwordChanged && finalPassword
            ? {
                ...password.auditData,
                lastPasswordChange: new Date(),
                passwordStrength:
                  PasswordValidationService.analyzePasswordStrength(
                    finalPassword,
                  ),
                duplicateCount: password.auditData?.duplicateCount || 0,
                compromisedCount: password.auditData?.compromisedCount || 0,
                securityScore: calculateSecurityScore(tempPassword),
                recommendedAction:
                  PasswordValidationService.analyzePasswordStrength(
                    finalPassword,
                  ).score < 2
                    ? 'change_password'
                    : 'none',
              }
            : password.auditData,
      };

      console.log(
        '💾 EditPasswordScreen: Saving password entry (password will be encrypted by updatePassword)',
      );
      await updatePassword(
        password.id,
        updatedPassword,
        masterPassword || unlockedMasterPassword,
      );

      // 🔍 Run security audit and save audit result after password is saved
      try {
        console.log('🔍 EditPasswordScreen: Running security audit...');
        
        const securityScore = updatedPassword.auditData?.securityScore || 0;
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (securityScore < 40) riskLevel = 'critical';
        else if (securityScore < 60) riskLevel = 'high';
        else if (securityScore < 75) riskLevel = 'medium';
        
        const auditData = {
          date: new Date(),
          score: securityScore,
          riskLevel,
          vulnerabilityCount: 0,
          vulnerabilities: [],
          passwordStrength: {
            score: updatedPassword.auditData?.passwordStrength?.score || 0,
            label: updatedPassword.auditData?.passwordStrength?.label || 'Unknown',
            color: '#9E9E9E',
            feedback: updatedPassword.auditData?.passwordStrength?.feedback || [],
            crackTime: updatedPassword.auditData?.passwordStrength?.crackTime || 'Unknown',
          },
          changes: passwordChanged ? ['Password changed'] : [],
        };

        await AuditHistoryService.saveAuditResult(password.id, auditData);
        console.log('✅ EditPasswordScreen: Audit result saved');
      } catch (auditError) {
        console.warn('⚠️ EditPasswordScreen: Failed to save audit result:', auditError);
        // Don't throw - audit is a secondary feature
      }

      // Reset navigation stack to PasswordsList with success message
      // Don't set isSaving(false) here as navigation.reset will unmount the component
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'PasswordsList',
            params: { successMessage: 'Password updated successfully!' },
          },
        ],
      });
    } catch (error: any) {
      console.error('Error updating password:', error);

      // Check if error is due to missing master password
      const errorMessage = error?.message || String(error);
      const isAuthError =
        errorMessage.includes('Master password required') ||
        errorMessage.includes('PIN unlock required') ||
        errorMessage.includes('not cached');

      // Only show PIN dialog if password was changed and authentication is required
      if (isAuthError && isPasswordChanged) {
        console.log(
          '🔐 EditPasswordScreen: Password changed - requiring PIN authentication',
        );
        // Store the current form data to retry after PIN unlock
        setPendingUpdateData(password);
        setIsSaving(false);
        setShowPinDialog(true);
      } else if (isAuthError && !isPasswordChanged) {
        // Password not changed, but auth error occurred (shouldn't happen for metadata-only changes)
        // Try to save anyway without master password requirement
        console.log(
          '⚠️ EditPasswordScreen: Auth error but password not changed - saving metadata only',
        );
        setToastType('error');
        setToastMessage(
          'Authentication required. Please try again or contact support.',
        );
        setShowToast(true);
        setIsSaving(false);
      } else {
        setToastType('error');
        setToastMessage('Failed to update password entry. Please try again.');
        setShowToast(true);
        setIsSaving(false);
      }
    }
  };

  const handlePinUnlock = async () => {
    if (!pin.trim() || !pendingUpdateData) {
      setToastType('error');
      setToastMessage('Please enter your PIN');
      setShowToast(true);
      return;
    }

    setPinLoading(true);
    try {
      // Unlock with PIN
      const unlockResult = await unlockMasterPasswordWithPin(pin.trim());

      if (!unlockResult.success || !unlockResult.password) {
        throw new Error(unlockResult.error || 'Failed to unlock with PIN');
      }

      console.log('✅ PIN unlock successful, updating password...');

      // Close PIN dialog
      setShowPinDialog(false);
      setPin('');

      // Now retry handleSave with the unlocked master password passed directly
      // (Not using state to avoid React async timing issues)
      await handleSave(unlockResult.password);
    } catch (error: any) {
      console.error('PIN unlock failed:', error);
      const errorMessage = error?.message || String(error);

      setToastType('error');
      setToastMessage(
        errorMessage.includes('locked')
          ? errorMessage
          : 'Incorrect PIN. Please try again.',
      );
      setShowToast(true);
    } finally {
      setPinLoading(false);
      // Ensure unlocked master password is cleared
      setUnlockedMasterPassword(undefined);
    }
  };

  const handlePinCancel = () => {
    setShowPinDialog(false);
    setPin('');
    setPendingUpdateData(null);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!password || isDeleteDialogShowing || isDeleting) return;

    // 🔐 SECURITY: Require biometric authentication before delete
    // 🔑 IMPORTANT: Enable PIN fallback (allowDeviceCredentials=true) for delete operations
    try {
      console.log('🔒 [Delete] Requesting biometric authentication...');
      const biometricResult = await authenticateBiometric(
        'Authenticate to delete password',
      );

      if (!biometricResult) {
        console.log('❌ [Delete] Biometric authentication failed or cancelled');
        setConfirmDialog({
          visible: true,
          title: 'Authentication Failed',
          message: 'Biometric authentication is required to delete passwords',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
        return;
      }

      console.log('✅ [Delete] Biometric authentication successful');

      // Show confirmation dialog after biometric success
      setIsDeleteDialogShowing(true);

      setConfirmDialog({
        visible: true,
        title: 'Delete Password',
        message: `Are you sure you want to delete "${password.title}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmStyle: 'destructive',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          setIsDeleting(true);
          try {
            await deletePassword(password.id);

            // Reset navigation stack to PasswordsList with success message
            // Don't set isDeleting(false) here as navigation.reset will unmount the component
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'PasswordsList',
                  params: {
                    successMessage: 'Password deleted successfully!',
                  },
                },
              ],
            });
          } catch (error) {
            console.error('Error deleting password:', error);
            setIsDeleteDialogShowing(false);
            setConfirmDialog({
              visible: true,
              title: 'Error',
              message: 'Failed to delete password entry. Please try again.',
              confirmText: 'OK',
              onConfirm: () =>
                setConfirmDialog(prev => ({ ...prev, visible: false })),
            });
            setIsDeleting(false); // Only reset loading state on error
          }
        },
      });
    } catch (error) {
      console.error('❌ [Delete] Biometric authentication error:', error);
      setConfirmDialog({
        visible: true,
        title: 'Error',
        message: 'Failed to authenticate. Please try again.',
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    }
  };

  // Loading state
  if (isLoading || isSaving) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <Ionicons name="close-outline" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Password</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="create-outline" size={48} color={theme.primary} />
          <Text style={styles.loadingText}>
            {isSaving ? 'Saving changes...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - password not found
  if (!password) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Password</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={theme.error}
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>Password Not Found</Text>
          <Text style={styles.errorMessage}>
            The password entry you're trying to edit could not be found. It may
            have been deleted or moved.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Password</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDelete}
          disabled={isDeleteDialogShowing || isDeleting}
        >
          <Text
            style={
              isDeleteDialogShowing || isDeleting
                ? styles.deleteButtonTextDisabled
                : styles.deleteButtonText
            }
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <ScrollView
          style={styles.formContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PasswordForm
            password={formData as PasswordEntry}
            onSave={updatedData => {
              setFormData(prev => ({ ...prev, ...updatedData }));
            }}
            onDataChange={updatedData => {
              console.log('🔄 EditPasswordScreen onDataChange:', updatedData);
              setFormData(prev => {
                const newData = { ...prev, ...updatedData };
                console.log('🔄 EditPasswordScreen new formData:', newData);
                return newData;
              });
            }}
            onCancel={handleCancel}
            isEditing={true}
            onDecryptPassword={handleDecryptPassword}
          />

          {/* Password History Section - Always show */}
          <PasswordHistoryViewer
            visible={false}
            onClose={() => {}}
            passwordEntry={password}
            onRestorePassword={handleRestorePassword}
          />

          {/* Security Audit Section - Always show */}
          <SecurityAuditPanel
            passwordEntry={password}
            auditData={latestAudit}
            onDecryptPassword={handleDecryptPassword}
          />
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!isFormValid() || isSaving || !hasUnsavedChanges()) &&
                styles.saveButtonDisabled,
            ]}
            onPress={() => handleSave()}
            disabled={!isFormValid() || isSaving || !hasUnsavedChanges()}
          >
            <Ionicons
              name={isSaving ? 'hourglass-outline' : 'save-outline'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={handleHideToast}
        duration={toastDuration}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          setIsDeleteDialogShowing(false);
        }}
      />

      {/* PIN Unlock Dialog */}
      <Modal
        visible={showPinDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={handlePinCancel}
      >
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={[styles.pinContainer, { backgroundColor: theme.surface }]}
          >
            <View style={styles.pinHeader}>
              <View
                style={[
                  styles.pinIconContainer,
                  { backgroundColor: theme.primary + '20' },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={32}
                  color={theme.primary}
                />
              </View>
              <Text style={[styles.pinTitle, { color: theme.text }]}>
                PIN Required
              </Text>
              <Text
                style={[styles.pinSubtitle, { color: theme.textSecondary }]}
              >
                Enter your PIN to update this password
              </Text>
            </View>

            <View style={styles.pinInputSection}>
              <View
                style={[
                  styles.pinInputContainer,
                  { borderColor: theme.border },
                ]}
              >
                <Ionicons
                  name="keypad-outline"
                  size={24}
                  color={theme.textSecondary}
                />
                <TextInput
                  style={[styles.pinInput, { color: theme.text }]}
                  placeholder="Enter PIN"
                  placeholderTextColor={theme.textSecondary}
                  value={pin}
                  onChangeText={setPin}
                  secureTextEntry={true}
                  keyboardType="numeric"
                  maxLength={8}
                  autoFocus={true}
                  onSubmitEditing={handlePinUnlock}
                />
              </View>
            </View>

            <View style={styles.pinButtonSection}>
              <TouchableOpacity
                style={[
                  styles.pinButton,
                  styles.pinCancelButton,
                  { borderColor: theme.border },
                ]}
                onPress={handlePinCancel}
                disabled={pinLoading}
              >
                <Text
                  style={[styles.pinButtonText, { color: theme.textSecondary }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pinButton,
                  styles.pinUnlockButton,
                  { backgroundColor: theme.primary },
                  (pinLoading || !pin.trim()) && styles.pinButtonDisabled,
                ]}
                onPress={handlePinUnlock}
                disabled={pinLoading || !pin.trim()}
              >
                <Text
                  style={[styles.pinButtonText, { color: theme.background }]}
                >
                  {pinLoading ? 'Unlocking...' : 'Unlock'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Layer 1: Biometric Authentication */}
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={handleBiometricClose}
        onSuccess={handleBiometricSuccess}
        onError={handleBiometricError}
        title="Authenticate to view password"
        subtitle="Use biometric authentication to reveal password"
      />

      {/* Layer 1B: Biometric Fallback (Master Password + PIN when biometric fails) */}
      <BiometricFallbackPrompt
        visible={showFallbackModal}
        onSuccess={handleFallbackSuccess}
        onCancel={handleFallbackCancel}
      />

      {/* Layer 2: PIN Prompt (after successful biometric) */}
      <PinPromptModal
        visible={showPinPrompt}
        onSuccess={handlePinPromptSuccess}
        onCancel={handlePinPromptCancel}
        title="Unlock to View Password"
        subtitle="Enter your PIN to decrypt and view this password"
      />
    </SafeAreaView>
  );
};

export default EditPasswordScreen;
