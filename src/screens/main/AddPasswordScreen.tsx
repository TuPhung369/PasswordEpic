import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppState } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordForm from '../../components/PasswordForm';
import ErrorBoundary from '../../components/ErrorBoundary';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PasswordEntry } from '../../types/password';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import { PasswordValidationService } from '../../services/passwordValidationService';
import { NavigationPersistenceService } from '../../services/navigationPersistenceService';
import { calculateSecurityScore } from '../../utils/passwordUtils';

type AddPasswordScreenNavigationProp = NativeStackNavigationProp<
  PasswordsStackParamList,
  'AddPassword'
>;

interface AddPasswordScreenProps {
  route?: {
    params?: {
      restoreData?: boolean;
      generatedPassword?: string;
    };
  };
}

export const AddPasswordScreen: React.FC<AddPasswordScreenProps> = ({
  route,
}) => {
  const { theme } = useTheme();
  const navigation = useNavigation<AddPasswordScreenNavigationProp>();
  const { createPassword, isLoading } = usePasswordManagement();

  const [formData, setFormData] = useState<Partial<PasswordEntry>>({
    title: '',
    username: '',
    password: '',
    website: '',
    notes: '',
    category: 'Other', // Match default value in PasswordForm
    tags: [],
    customFields: [],
    isFavorite: false,
  });

  const navigationPersistence = NavigationPersistenceService.getInstance();

  // Save form data to prevent loss during navigation interruptions
  const saveFormDataToStorage = useCallback(
    async (data: Partial<PasswordEntry>) => {
      try {
        await navigationPersistence.saveScreenData('AddPassword', data);
        // console.log('💾 Form data auto-saved to storage');
      } catch (error) {
        console.error('Failed to save form data:', error);
      }
    },
    [navigationPersistence],
  );

  // Load saved form data
  const loadFormDataFromStorage = useCallback(async () => {
    try {
      const saved = await navigationPersistence.getScreenData<
        Partial<PasswordEntry>
      >('AddPassword');
      if (saved) {
        // console.log('📦 Loaded form data from storage:', saved);
        setFormData(saved);
        setIsDataRestored(true);
        // console.log('✅ Form data restored from storage');
        // DON'T clear the saved data here - keep it until user saves or cancels
        // This allows data to persist through multiple lock/unlock cycles
      } else {
        console.log('📦 No saved form data found in storage');
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    }
  }, [navigationPersistence]);

  const [isSaving, setIsSaving] = useState(false);
  const [_isDataRestored, setIsDataRestored] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

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

  // Use ref to track latest formData without causing re-renders
  const formDataRef = React.useRef(formData);
  React.useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback((): boolean => {
    const hasChanges = !!(
      formData.title ||
      formData.username ||
      formData.password ||
      formData.website ||
      formData.notes ||
      // Don't count default category value as unsaved change
      (formData.category && formData.category !== 'Other') ||
      (formData.tags && formData.tags.length > 0) ||
      (formData.customFields && formData.customFields.length > 0)
    );

    // Reduced logging for performance
    // console.log('🔍 hasUnsavedChanges check:', { hasChanges });

    return hasChanges;
  }, [
    formData?.title,
    formData?.username,
    formData?.password,
    formData?.website,
    formData?.notes,
    formData?.category,
    formData?.tags,
    formData?.customFields,
  ]); // Only depend on actual data fields

  // Load saved data only when restoring after unlock
  React.useEffect(() => {
    // Only load from storage if this is a restore request after authentication
    if (route?.params?.restoreData) {
      console.log('🔄 Loading form data due to restore request');
      loadFormDataFromStorage();
    } else {
      console.log('🆕 Fresh Add Password screen - starting with blank form');
      // Clear any previously saved data when starting fresh
      navigationPersistence.clearScreenData('AddPassword').catch(error => {
        console.error('Failed to clear previous form data:', error);
      });
    }
  }, [
    loadFormDataFromStorage,
    route?.params?.restoreData,
    navigationPersistence,
  ]);

  // Cleanup function to prevent memory leaks
  React.useEffect(() => {
    return () => {
      // Cleanup any ongoing operations
      console.log('AddPasswordScreen: Cleaning up...');
    };
  }, []);

  // Handle hardware back button on Android
  React.useEffect(() => {
    const { BackHandler } = require('react-native');

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      async () => {
        // Check for unsaved changes
        const currentFormData = formDataRef.current;
        const currentHasChanges = !!(
          currentFormData.title ||
          currentFormData.username ||
          currentFormData.password ||
          currentFormData.website ||
          currentFormData.notes ||
          (currentFormData.category && currentFormData.category !== 'Other') ||
          (currentFormData.tags && currentFormData.tags.length > 0) ||
          (currentFormData.customFields &&
            currentFormData.customFields.length > 0)
        );

        if (currentHasChanges) {
          // Show confirmation dialog
          setConfirmDialog({
            visible: true,
            title: 'Discard Changes?',
            message:
              'You have unsaved changes. Are you sure you want to discard them?',
            confirmText: 'Discard',
            confirmStyle: 'destructive',
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, visible: false }));
              try {
                await navigationPersistence.clearScreenData('AddPassword');
              } catch (error) {
                console.error('Failed to clear temp form data:', error);
              }
              navigation.navigate('PasswordsList');
            },
          });
        } else {
          // No changes, just go back
          navigation.navigate('PasswordsList');
        }

        return true; // Prevent default back behavior
      },
    );

    return () => backHandler.remove();
  }, [navigation, navigationPersistence]);

  // Focus effect to handle screen focus/blur events
  useFocusEffect(
    useCallback(() => {
      console.log('AddPasswordScreen: Screen focused');

      // Check if we have a generated password from the Generator screen
      if (route?.params?.generatedPassword) {
        console.log('🔑 Received generated password from Generator screen');
        setFormData(prev => ({
          ...prev,
          password: route.params.generatedPassword,
        }));

        // Clear the parameter to prevent re-applying on subsequent focuses
        navigation.setParams({ generatedPassword: undefined });
      }
      // Only load saved form data when this is a restore request after authentication
      else if (route?.params?.restoreData) {
        console.log(
          '🔄 Detected data restoration request after authentication - loading saved data',
        );
        loadFormDataFromStorage();

        // Reset navigation params to clear the flag
        setTimeout(() => {
          navigation.setOptions({});
        }, 100);
      } else {
        console.log(
          'AddPasswordScreen: Normal focus - keeping current form state',
        );
      }

      return () => {
        console.log('AddPasswordScreen: Screen blurred');
        // DON'T clear last_active_screen here - it will be cleared by:
        // 1. handleSave() when user saves successfully
        // 2. handleCancel() when user cancels
        // 3. PasswordsNavigator after successful restoration
        // This ensures the flag persists through lock/unlock cycles
      };
    }, [
      // Only depend on stable functions and navigation params
      // DON'T include formData, hasUnsavedChanges - they cause re-render loop
      loadFormDataFromStorage,
      navigation,
      route?.params?.restoreData,
      route?.params?.generatedPassword,
    ]),
  );

  // App state listener to save form data when app goes to background
  React.useEffect(() => {
    console.log('🏗️ AddPasswordScreen mounted');

    // DON'T set flag on mount - only set it when user has unsaved changes
    // This prevents unwanted navigation restoration when user is on other screens

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log(
          'AddPasswordScreen: App going to background, saving form data',
        );
        // Check if there are unsaved changes at the time of background
        // Use current formData from ref
        const currentFormData = formDataRef.current;
        const currentHasChanges = !!(
          currentFormData.title ||
          currentFormData.username ||
          currentFormData.password ||
          currentFormData.website ||
          currentFormData.notes ||
          (currentFormData.category && currentFormData.category !== 'Other') ||
          (currentFormData.tags && currentFormData.tags.length > 0) ||
          (currentFormData.customFields &&
            currentFormData.customFields.length > 0)
        );

        // Only save form data if there are actual changes
        if (currentHasChanges) {
          saveFormDataToStorage(currentFormData);
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      console.log('🏗️ AddPasswordScreen unmounting');
      subscription?.remove();

      // Clear any pending save operations
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // DON'T save on unmount - it causes mount/unmount loop
      // Data is already saved by auto-save in PasswordForm
      // Only save navigation flag when app goes to background (handled above)
    };
  }, [saveFormDataToStorage]);

  // Memoize styles to prevent recreation on every render
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Debounced save timeout ref
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Memoized callback for form save with debounce to prevent rapid saves
  const handleFormSave = useCallback(
    (updatedData: Partial<PasswordEntry>) => {
      setFormData(prevFormData => {
        const newData = { ...prevFormData, ...updatedData };

        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Debounce the save operation
        saveTimeoutRef.current = setTimeout(() => {
          saveFormDataToStorage(newData);
        }, 500); // 500ms debounce

        return newData;
      });
    },
    [saveFormDataToStorage],
  );

  const handleCancel = async () => {
    if (hasUnsavedChanges()) {
      setConfirmDialog({
        visible: true,
        title: 'Discard Changes?',
        message:
          'You have unsaved changes. Are you sure you want to discard them?',
        confirmText: 'Discard',
        confirmStyle: 'destructive',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          // Clear temporary data when discarding
          try {
            await navigationPersistence.clearScreenData('AddPassword');
          } catch (error) {
            console.error('Failed to clear temp form data:', error);
          }
          // Navigate back to PasswordsList specifically
          navigation.navigate('PasswordsList');
        },
      });
    } else {
      // Clear any temporary data
      try {
        await navigationPersistence.clearScreenData('AddPassword');
      } catch (error) {
        console.error('Failed to clear temp form data:', error);
      }
      // Navigate back to PasswordsList specifically
      navigation.navigate('PasswordsList');
    }
  };

  // Memoize form validation to prevent excessive re-renders
  const isFormValid = useCallback((): boolean => {
    const hasTitle = !!(formData?.title && formData.title.trim().length > 0);
    const hasPassword = !!(formData?.password && formData.password.trim().length > 0);
    const hasUsernameOrEmail = !!(
      (formData?.username && formData.username.trim().length > 0) ||
      (formData?.website && formData.website.trim().length > 0)
    );
    const isValid = hasTitle && hasPassword && hasUsernameOrEmail;
    // Only log validation errors in development/debug
    // console.log('🔍 isFormValid check:', { hasTitle, hasPassword, hasUsernameOrEmail, isValid });
    return isValid;
  }, [formData]); // Depend on full formData to ensure callback stays updated

  const handleSave = async () => {
    if (!isFormValid()) {
      setConfirmDialog({
        visible: true,
        title: 'Validation Error',
        message: 'Please fill in all required fields: Title, Password, and Username/Email.',
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsSaving(true);

    try {
      // Create temporary password entry for security score calculation
      const tempPasswordEntry: PasswordEntry = {
        id: 'temp',
        title: formData.title!.trim(),
        username: formData.username || '',
        password: formData.password || '',
        website: formData.website || '',
        notes: formData.notes || '',
        category: formData.category || '',
        tags: formData.tags || [],
        customFields: formData.customFields || [],
        isFavorite: formData.isFavorite || false,
        accessCount: 0,
        frequencyScore: 0,
        passwordHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: undefined, // 🔥 Initialize lastUsed for new passwords
      };

      const newPasswordEntry: Omit<
        PasswordEntry,
        'id' | 'createdAt' | 'updatedAt'
      > = {
        title: formData.title!.trim(),
        username: formData.username || '',
        password: formData.password || '',
        website: formData.website || '',
        notes: formData.notes || '',
        category: formData.category || '',
        tags: formData.tags || [],
        customFields: formData.customFields || [],
        isFavorite: formData.isFavorite || false,
        // Initialize tracking fields
        accessCount: 0,
        frequencyScore: 0,
        // Initialize password history (empty for new entries)
        passwordHistory: [],
        // Initialize audit data if password is provided
        auditData: formData.password
          ? {
              passwordStrength:
                PasswordValidationService.analyzePasswordStrength(
                  formData.password,
                ),
              duplicateCount: 0,
              compromisedCount: 0,
              lastPasswordChange: new Date(),
              securityScore: calculateSecurityScore(tempPasswordEntry),
              recommendedAction:
                PasswordValidationService.analyzePasswordStrength(
                  formData.password,
                ).score < 2
                  ? 'change_password'
                  : 'none',
            }
          : undefined,
      };

      await createPassword(newPasswordEntry);

      // Clear temporary data after successful save
      try {
        await navigationPersistence.clearScreenData('AddPassword');
      } catch (error) {
        console.error('Failed to clear temp form data:', error);
      }

      // Reset navigation stack to PasswordsList with success message
      // Don't set isSaving(false) here as navigation.reset will unmount the component
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'PasswordsList',
            params: { successMessage: 'Password created successfully!' },
          },
        ],
      });
    } catch (error) {
      console.error('Error creating password:', error);
      setToastType('error');
      setToastMessage('Failed to create password entry. Please try again.');
      setShowToast(true);
      setIsSaving(false); // Only reset loading state on error
    }
  };

  if (isLoading || isSaving) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <Ionicons name="close-outline" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Add Password</Text>
          </View>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={48}
            color={theme.primary}
          />
          <Text style={styles.loadingText}>
            {isSaving ? 'Saving password...' : 'Loading...'}
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Add Password</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleSave}
          disabled={!isFormValid() || isSaving}
        >
          <Text
            style={[
              styles.headerButtonText,
              (!isFormValid() || isSaving) && { color: theme.textSecondary },
            ]}
          >
            Save
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
            onSave={handleFormSave}
            onCancel={handleCancel}
            onDataChange={handleFormSave}
            isEditing={false}
            enableAutoSave={false}
          />
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!isFormValid() || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!isFormValid() || isSaving}
        >
          <Ionicons
            name={isSaving ? 'timer-outline' : 'save-outline'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Password'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={() => setShowToast(false)}
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
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
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
    headerTitleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    headerButton: {
      padding: 8,
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.primary,
    },
    content: {
      flex: 1,
    },
    formContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    saveButton: {
      backgroundColor: theme.primary,
      marginHorizontal: 16,
      marginVertical: 16,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    saveButtonDisabled: {
      backgroundColor: theme.textSecondary,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
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
  });

// Wrap with ErrorBoundary for better error handling
const AddPasswordScreenWithErrorBoundary: React.FC<
  AddPasswordScreenProps
> = props => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('AddPasswordScreen Error:', error, errorInfo);
        // Could send to crash reporting service here
      }}
    >
      <AddPasswordScreen {...props} />
    </ErrorBoundary>
  );
};

export default AddPasswordScreenWithErrorBoundary;
