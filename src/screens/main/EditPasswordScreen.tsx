import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordForm from '../../components/PasswordForm';
import PasswordHistoryViewer, {
  PasswordHistoryItem,
} from '../../components/PasswordHistoryViewer';
import SecurityAuditPanel from '../../components/SecurityAuditPanel';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PasswordEntry, PasswordHistoryEntry } from '../../types/password';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import { PasswordValidationService } from '../../services/passwordValidationService';
import { calculateSecurityScore, isValidDomain } from '../../utils/passwordUtils';
import { useAppDispatch } from '../../hooks/redux';
import { decryptPasswordField } from '../../store/slices/passwordsSlice';
import { getEffectiveMasterPassword } from '../../services/staticMasterPasswordService';

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

  const [password, setPassword] = useState<PasswordEntry | null>(null);
  const [formData, setFormData] = useState<Partial<PasswordEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
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

  // Memoize toast hide callback to prevent re-renders from resetting the timer
  const handleHideToast = useCallback(() => {
    setShowToast(false);
  }, []);

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

  // Decrypt password on-demand when user wants to view it
  const handleDecryptPassword = useCallback(async () => {
    if (isPasswordDecrypted || !password) {
      return decryptedPassword;
    }

    try {
      console.log('🔓 EditPasswordScreen: Decrypting password on-demand...');
      const masterPasswordResult = await getEffectiveMasterPassword();

      if (!masterPasswordResult.success || !masterPasswordResult.password) {
        throw new Error('Failed to get master password');
      }

      const result = await dispatch(
        decryptPasswordField({
          id: password.id,
          masterPassword: masterPasswordResult.password,
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
  }, [password, isPasswordDecrypted, decryptedPassword, dispatch]);

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
    // 1. If password hasn't been decrypted -> no change (still encrypted)
    // 2. If password has been decrypted and modified -> has change
    const passwordChanged =
      isPasswordDecrypted && formData.password !== decryptedPassword;

    return metadataChanged || passwordChanged;
  };

  const isFormValid = (): boolean => {
    const hasTitle = !!(formData.title && formData.title.trim().length > 0);
    const hasPassword = !!(formData.password && formData.password.trim().length > 0);
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

  const handleSave = async () => {
    if (!password || !isFormValid()) {
      const hasTitle = !!(formData.title && formData.title.trim().length > 0);
      const hasPassword = !!(formData.password && formData.password.trim().length > 0);
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
        // Password was never decrypted, keep the original encrypted value
        // No need to decrypt - just pass encrypted password to save
        console.log(
          '💾 EditPasswordScreen: Password not modified, keeping encrypted',
        );
        finalPassword = password.password; // Keep encrypted password
        passwordChanged = false;
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
      await updatePassword(password.id, updatedPassword);

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
    } catch (error) {
      console.error('Error updating password:', error);
      setToastType('error');
      setToastMessage('Failed to update password entry. Please try again.');
      setShowToast(true);
      setIsSaving(false); // Only reset loading state on error
    }
  };

  const handleDelete = () => {
    if (!password || isDeleteDialogShowing || isDeleting) return;

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
            onPress={handleSave}
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
        duration={2000}
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
    </SafeAreaView>
  );
};

export default EditPasswordScreen;
