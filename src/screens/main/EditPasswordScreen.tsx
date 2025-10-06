import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordForm from '../../components/PasswordForm';
import PasswordHistoryViewer from '../../components/PasswordHistoryViewer';
import SecurityAuditPanel from '../../components/SecurityAuditPanel';
import Toast from '../../components/Toast';
import { PasswordEntry, PasswordHistoryEntry } from '../../types/password';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import { PasswordValidationService } from '../../services/passwordValidationService';
import { calculateSecurityScore } from '../../utils/passwordUtils';

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
        '🔍 EditPasswordScreen: Initial loading password:',
        foundPassword,
      );
      setPassword(foundPassword);
      setFormData(foundPassword);
      setIsPasswordLoaded(true);
      console.log('🔍 EditPasswordScreen: FormData set to:', foundPassword);
    }
  }, [passwords, passwordId, isPasswordLoaded]);

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          {
            text: 'Keep Editing',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  const hasUnsavedChanges = (): boolean => {
    if (!password) return false;

    return (
      formData.title !== password.title ||
      formData.username !== password.username ||
      formData.password !== password.password ||
      formData.website !== password.website ||
      formData.notes !== password.notes ||
      formData.category !== password.category ||
      JSON.stringify(formData.tags) !== JSON.stringify(password.tags) ||
      formData.isFavorite !== password.isFavorite
    );
  };

  const isFormValid = (): boolean => {
    return !!(formData.title && formData.title.trim().length > 0);
  };

  const handleRestorePassword = (restoredPassword: string) => {
    setFormData(prev => ({ ...prev, password: restoredPassword }));
  };

  const handleSave = async () => {
    if (!password || !isFormValid()) {
      Alert.alert(
        'Validation Error',
        'Please enter at least a title for the password entry.',
      );
      return;
    }

    setIsSaving(true);

    try {
      // Check if password changed to update history
      const passwordChanged = formData.password !== password.password;

      // Create new password history entry if password changed
      let updatedPasswordHistory = password.passwordHistory || [];
      if (passwordChanged && password.password) {
        const historyEntry: PasswordHistoryEntry = {
          id: `history_${Date.now()}`,
          password: password.password,
          createdAt: password.updatedAt || password.createdAt,
          strength:
            password.auditData?.passwordStrength ||
            PasswordValidationService.analyzePasswordStrength(
              password.password,
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
        password: formData.password || '',
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
          passwordChanged && formData.password
            ? {
                ...password.auditData,
                lastPasswordChange: new Date(),
                passwordStrength:
                  PasswordValidationService.analyzePasswordStrength(
                    formData.password,
                  ),
                duplicateCount: password.auditData?.duplicateCount || 0,
                compromisedCount: password.auditData?.compromisedCount || 0,
                securityScore: calculateSecurityScore(tempPassword),
                recommendedAction:
                  PasswordValidationService.analyzePasswordStrength(
                    formData.password,
                  ).score < 2
                    ? 'change_password'
                    : 'none',
              }
            : password.auditData,
      };

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

    Alert.alert(
      'Delete Password',
      `Are you sure you want to delete "${password.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setIsDeleteDialogShowing(false);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
              Alert.alert(
                'Error',
                'Failed to delete password entry. Please try again.',
                [{ text: 'OK' }],
              );
              setIsDeleting(false); // Only reset loading state on error
            }
          },
        },
      ],
    );
  };

  // Loading state
  if (isLoading || isSaving || isDeleting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isDeleting ? 'Deleting...' : 'Edit Password'}
          </Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialIcons
            name={isDeleting ? 'delete' : 'edit'}
            size={48}
            color={theme.primary}
          />
          <Text style={styles.loadingText}>
            {isDeleting
              ? 'Deleting password...'
              : isSaving
              ? 'Saving changes...'
              : 'Loading...'}
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
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Password</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons
            name="error-outline"
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
            style={[
              styles.deleteButtonText,
              (isDeleteDialogShowing || isDeleting) && { opacity: 0.5 },
            ]}
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
          />

          {/* Password History Section - Always show */}
          <PasswordHistoryViewer
            history={password.passwordHistory || []}
            currentPassword={formData.password || ''}
            onRestorePassword={handleRestorePassword}
          />

          {/* Security Audit Section - Always show */}
          <SecurityAuditPanel
            auditData={password.auditData}
            breachStatus={password.breachStatus}
            createdAt={password.createdAt}
            updatedAt={password.updatedAt}
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
            <MaterialIcons
              name={isSaving ? 'hourglass-empty' : 'save'}
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              (isDeleteDialogShowing || isDeleting) && { opacity: 0.5 },
            ]}
            onPress={handleDelete}
            disabled={isDeleteDialogShowing || isDeleting}
          >
            <MaterialIcons
              name={isDeleting ? 'hourglass-empty' : 'delete'}
              size={20}
              color={theme.error}
            />
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
    </SafeAreaView>
  );
};

export default EditPasswordScreen;
