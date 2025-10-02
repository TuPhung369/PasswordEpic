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
    category: '',
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
        setFormData(parsedData);
        setIsDataRestored(true);
        // Show notification that data was restored
        Alert.alert(
          'Data Restored',
          'Your previously entered data has been restored.',
          [{ text: 'OK' }],
        );
        // Clear the saved data after loading
        await AsyncStorage.removeItem('temp_add_password_form');
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    }
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [_isDataRestored, setIsDataRestored] = useState(false);

  // Check for unsaved changes
  const hasUnsavedChanges = useCallback((): boolean => {
    return !!(
      formData.title ||
      formData.username ||
      formData.password ||
      formData.website ||
      formData.notes ||
      formData.category ||
      (formData.tags && formData.tags.length > 0) ||
      (formData.customFields && formData.customFields.length > 0)
    );
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
        // Save current form data when leaving screen
        if (hasUnsavedChanges()) {
          saveFormDataToStorage(formData);
        }
      };
    }, [
      formData,
      saveFormDataToStorage,
      hasUnsavedChanges,
      loadFormDataFromStorage,
      navigation,
      route?.params?.restoreData,
    ]),
  );

  // App state listener to save form data when app goes to background
  React.useEffect(() => {
    console.log('🏗️ AddPasswordScreen mounted');

    // Set the active screen flag when component mounts
    AsyncStorage.setItem('last_active_screen', 'AddPassword').catch(
      console.error,
    );

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log(
          'AddPasswordScreen: App going to background, saving form data',
        );
        if (hasUnsavedChanges()) {
          saveFormDataToStorage(formData);
        }
        // Also save navigation state to restore properly
        AsyncStorage.setItem('last_active_screen', 'AddPassword').catch(
          console.error,
        );
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      console.log('🏗️ AddPasswordScreen unmounting');
      subscription?.remove();

      // Clear the flag when component unmounts (user is leaving voluntarily)
      AsyncStorage.removeItem('last_active_screen').catch(console.error);
    };
  }, [formData, hasUnsavedChanges, saveFormDataToStorage]);

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
