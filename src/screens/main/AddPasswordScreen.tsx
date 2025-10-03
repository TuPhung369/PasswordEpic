import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordForm from '../../components/PasswordForm';
import ErrorBoundary from '../../components/ErrorBoundary';
import { PasswordEntry } from '../../types/password';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';

type AddPasswordScreenNavigationProp = NativeStackNavigationProp<
  PasswordsStackParamList,
  'AddPassword'
>;

interface AddPasswordScreenProps {
  route?: {
    params?: {
      restoreData?: boolean;
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
    category: 'General', // Match default value in PasswordForm
    tags: [],
    customFields: [],
    isFavorite: false,
  });

  // Save form data to prevent loss during navigation interruptions
  const saveFormDataToStorage = useCallback(
    async (data: Partial<PasswordEntry>) => {
      try {
        await AsyncStorage.setItem(
          'temp_add_password_form',
          JSON.stringify(data),
        );
      } catch (error) {
        console.error('Failed to save form data:', error);
      }
    },
    [],
  );

  // Load saved form data
  const loadFormDataFromStorage = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('temp_add_password_form');
      if (saved) {
        const parsedData = JSON.parse(saved);
        console.log('📦 Loaded form data from storage:', parsedData);
        setFormData(parsedData);
        setIsDataRestored(true);
        console.log('✅ Form data restored from storage');
        // DON'T clear the saved data here - keep it until user saves or cancels
        // This allows data to persist through multiple lock/unlock cycles
      } else {
        console.log('📦 No saved form data found in storage');
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    }
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [_isDataRestored, setIsDataRestored] = useState(false);

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
      (formData.category && formData.category !== 'General') ||
      (formData.tags && formData.tags.length > 0) ||
      (formData.customFields && formData.customFields.length > 0)
    );

    console.log('🔍 hasUnsavedChanges check:', {
      hasChanges,
      title: formData.title,
      username: formData.username,
      password: formData.password,
      website: formData.website,
      notes: formData.notes,
      category: formData.category,
      tags: formData.tags,
      customFields: formData.customFields,
    });

    return hasChanges;
  }, [formData]);

  // Load saved data on component mount
  React.useEffect(() => {
    loadFormDataFromStorage();
  }, [loadFormDataFromStorage]);

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
        // Clear the navigation flag when user presses back
        try {
          await AsyncStorage.removeItem('last_active_screen');
        } catch (error) {
          console.error('Failed to clear last_active_screen on back:', error);
        }

        // Check for unsaved changes
        const currentFormData = formDataRef.current;
        const currentHasChanges = !!(
          currentFormData.title ||
          currentFormData.username ||
          currentFormData.password ||
          currentFormData.website ||
          currentFormData.notes ||
          (currentFormData.category &&
            currentFormData.category !== 'General') ||
          (currentFormData.tags && currentFormData.tags.length > 0) ||
          (currentFormData.customFields &&
            currentFormData.customFields.length > 0)
        );

        if (currentHasChanges) {
          // Show confirmation dialog
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
                onPress: async () => {
                  try {
                    await AsyncStorage.removeItem('temp_add_password_form');
                  } catch (error) {
                    console.error('Failed to clear temp form data:', error);
                  }
                  navigation.navigate('PasswordsList');
                },
              },
            ],
          );
        } else {
          // No changes, just go back
          navigation.navigate('PasswordsList');
        }

        return true; // Prevent default back behavior
      },
    );

    return () => backHandler.remove();
  }, [navigation]);

  // Focus effect to handle screen focus/blur events
  useFocusEffect(
    useCallback(() => {
      console.log('AddPasswordScreen: Screen focused');

      // Load saved form data when screen gains focus
      loadFormDataFromStorage();

      // Check if we should restore data after authentication
      if (route?.params?.restoreData) {
        console.log(
          '🔄 Detected data restoration request after authentication',
        );
        // Reset navigation params to clear the flag
        setTimeout(() => {
          navigation.setOptions({});
        }, 100);
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
          (currentFormData.category &&
            currentFormData.category !== 'General') ||
          (currentFormData.tags && currentFormData.tags.length > 0) ||
          (currentFormData.customFields &&
            currentFormData.customFields.length > 0)
        );

        // Always save navigation state when user is on AddPassword screen
        // This ensures we restore to AddPassword even if form is empty
        console.log(
          '💾 AddPasswordScreen: Saving last_active_screen = AddPassword',
        );
        AsyncStorage.setItem('last_active_screen', 'AddPassword').catch(
          console.error,
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

      // DON'T save on unmount - it causes mount/unmount loop
      // Data is already saved by auto-save in PasswordForm
      // Only save navigation flag when app goes to background (handled above)
    };
  }, [saveFormDataToStorage]);

  // Memoize styles to prevent recreation on every render
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Memoized callback for form save
  const handleFormSave = useCallback(
    (updatedData: Partial<PasswordEntry>) => {
      const newData = { ...formData, ...updatedData };
      setFormData(newData);
      // Save to storage to prevent data loss
      saveFormDataToStorage(newData);
    },
    [formData, saveFormDataToStorage],
  );

  const handleCancel = async () => {
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
            onPress: async () => {
              // Clear temporary data when discarding
              try {
                await AsyncStorage.removeItem('temp_add_password_form');
                await AsyncStorage.removeItem('last_active_screen');
              } catch (error) {
                console.error('Failed to clear temp form data:', error);
              }
              // Navigate back to PasswordsList specifically
              navigation.navigate('PasswordsList');
            },
          },
        ],
      );
    } else {
      // Clear any temporary data
      try {
        await AsyncStorage.removeItem('temp_add_password_form');
        await AsyncStorage.removeItem('last_active_screen');
      } catch (error) {
        console.error('Failed to clear temp form data:', error);
      }
      // Navigate back to PasswordsList specifically
      navigation.navigate('PasswordsList');
    }
  };

  const isFormValid = useCallback((): boolean => {
    return !!(formData.title && formData.title.trim().length > 0);
  }, [formData.title]);

  const handleSave = async () => {
    if (!isFormValid()) {
      Alert.alert(
        'Validation Error',
        'Please enter at least a title for the password entry.',
      );
      return;
    }

    setIsSaving(true);

    try {
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
        // Initialize audit data if password is provided
        auditData: formData.password
          ? {
              passwordStrength: {
                score: 0,
                label: 'Unknown',
                color: theme.textSecondary,
                feedback: [],
                crackTime: 'Unknown',
              },
              duplicateCount: 0,
              compromisedCount: 0,
              lastPasswordChange: new Date(),
              securityScore: 0,
            }
          : undefined,
      };

      await createPassword(newPasswordEntry);

      // Clear temporary data after successful save
      try {
        await AsyncStorage.removeItem('temp_add_password_form');
        await AsyncStorage.removeItem('last_active_screen');
      } catch (error) {
        console.error('Failed to clear temp form data:', error);
      }

      Alert.alert('Success', 'Password entry has been created successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error creating password:', error);
      Alert.alert(
        'Error',
        'Failed to create password entry. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isSaving) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Add Password</Text>
          </View>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="lock" size={48} color={theme.primary} />
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
            isEditing={false}
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
          <MaterialIcons
            name={isSaving ? 'hourglass-empty' : 'save'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Password'}
          </Text>
        </TouchableOpacity>
      </View>
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
