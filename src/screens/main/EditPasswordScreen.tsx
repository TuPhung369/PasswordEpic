import React, { useState, useEffect } from 'react';
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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordForm from '../../components/PasswordForm';
import { PasswordEntry } from '../../types/password';

type EditPasswordRouteProp = RouteProp<
  { EditPassword: { passwordId: string } },
  'EditPassword'
>;

interface EditPasswordScreenProps {}

export const EditPasswordScreen: React.FC<EditPasswordScreenProps> = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<EditPasswordRouteProp>();
  const { passwordId } = route.params;

  const { passwords, updatePassword, deletePassword, isLoading } =
    usePasswordManagement();

  const [password, setPassword] = useState<PasswordEntry | null>(null);
  const [formData, setFormData] = useState<Partial<PasswordEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  useEffect(() => {
    const foundPassword = passwords.find(p => p.id === passwordId);
    if (foundPassword) {
      setPassword(foundPassword);
      setFormData(foundPassword);
    }
  }, [passwords, passwordId]);

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
      const updatedPassword: PasswordEntry = {
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
        // Update audit data if password changed
        auditData:
          formData.password !== password.password && formData.password
            ? {
                ...password.auditData,
                lastPasswordChange: new Date(),
                passwordStrength: {
                  score: 0,
                  label: 'Unknown',
                  color: theme.textSecondary,
                  feedback: [],
                  crackTime: 'Unknown',
                },
              }
            : password.auditData,
      };

      await updatePassword(password.id, updatedPassword);

      Alert.alert('Success', 'Password entry has been updated successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert(
        'Error',
        'Failed to update password entry. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!password) return;

    Alert.alert(
      'Delete Password',
      `Are you sure you want to delete "${password.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deletePassword(password.id);
              Alert.alert(
                'Deleted',
                'Password entry has been deleted successfully.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
            } catch (error) {
              console.error('Error deleting password:', error);
              Alert.alert(
                'Error',
                'Failed to delete password entry. Please try again.',
                [{ text: 'OK' }],
              );
            } finally {
              setIsDeleting(false);
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
        <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
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
            onCancel={handleCancel}
            isEditing={true}
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
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <MaterialIcons
              name={isDeleting ? 'hourglass-empty' : 'delete'}
              size={20}
              color={theme.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default EditPasswordScreen;
