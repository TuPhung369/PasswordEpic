import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
  InputAccessoryView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PasswordEntry,
  CustomField,
  PasswordStrengthResult,
} from '../types/password';
import { useTheme, Theme } from '../contexts/ThemeContext';
import {
  calculatePasswordStrength,
  generateSecurePassword,
} from '../utils/passwordUtils';
import { PasswordValidationService } from '../services/passwordValidationService';
import { TrackedTextInput as TextInput } from './TrackedTextInput';
// import CategorySelector from './CategorySelector'; // Will be implemented next

interface PasswordFormProps {
  password?: PasswordEntry;
  onSave: (password: Partial<PasswordEntry>) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

// Unique ID for empty input accessory view to hide toolbar
const EMPTY_INPUT_ACCESSORY_VIEW_ID = 'emptyInputAccessory';

// Helper to get clean keyboard props without toolbar
const getCleanKeyboardProps = (
  theme: Theme,
  fieldType?: 'url' | 'password' | 'text',
) => {
  // iOS-specific props to disable toolbar
  if (Platform.OS === 'ios') {
    return {
      autoCorrect: false,
      spellCheck: false,
      keyboardAppearance:
        theme.background === '#000000' ? ('dark' as const) : ('light' as const),
      autoCapitalize: 'none' as const,
      keyboardType:
        fieldType === 'url'
          ? ('url' as const)
          : fieldType === 'password'
          ? ('default' as const)
          : ('ascii-capable' as const),
      // Use empty input accessory view to hide toolbar
      inputAccessoryViewID: EMPTY_INPUT_ACCESSORY_VIEW_ID,
    };
  }

  // Android - use MINIMAL props to match native EditText behavior
  if (Platform.OS === 'android') {
    return {
      // Only essential props - let Android handle the rest naturally
      keyboardAppearance:
        theme.background === '#000000' ? ('dark' as const) : ('light' as const),
      autoCapitalize: 'none' as const,
      keyboardType:
        fieldType === 'url' ? ('url' as const) : ('default' as const),
    };
  }

  return {
    autoCorrect: false,
    spellCheck: false,
    keyboardAppearance:
      theme.background === '#000000' ? ('dark' as const) : ('light' as const),
    autoCapitalize: 'none' as const,
    keyboardType: fieldType === 'url' ? ('url' as const) : ('default' as const),
  };
};

const PasswordForm: React.FC<PasswordFormProps> = ({
  password,
  onSave,
  onCancel,
  isEditing = false,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Form state
  const [title, setTitle] = useState(password?.title || '');
  const [username, setUsername] = useState(password?.username || '');
  const [passwordValue, setPasswordValue] = useState(password?.password || '');
  const [website, setWebsite] = useState(password?.website || '');
  const [notes, setNotes] = useState(password?.notes || '');
  const [category, setCategory] = useState(password?.category || 'General');
  const [isFavorite, setIsFavorite] = useState(password?.isFavorite || false);
  const [customFields, setCustomFields] = useState<CustomField[]>(
    password?.customFields || [],
  );

  // UI state
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrengthResult | null>(null);
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [_isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Password generator options
  const [generatorOptions, setGeneratorOptions] = useState({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false,
    excludeSimilar: true,
  });

  // Use ref to track previous password prop to avoid infinite loops
  const prevPasswordRef = React.useRef(password);

  // Sync form state with password prop when it changes (for data restoration)
  useEffect(() => {
    // Only sync if password prop actually changed (not form state changes)
    if (password && password !== prevPasswordRef.current) {
      // console.log(
      //   '🔄 PasswordForm: Syncing with updated password prop:',
      //   password,
      // );
      setTitle(password.title || '');
      setUsername(password.username || '');
      setPasswordValue(password.password || '');
      setWebsite(password.website || '');
      setNotes(password.notes || '');
      setCategory(password.category || 'General');
      setIsFavorite(password.isFavorite || false);
      setCustomFields(password.customFields || []);
      prevPasswordRef.current = password;
    }
  }, [password]); // Only depend on password prop, not form state

  // Calculate password strength when password changes
  useEffect(() => {
    if (passwordValue) {
      const strength = calculatePasswordStrength(passwordValue);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [passwordValue]);

  // Debounced auto-save to prevent excessive calls
  useEffect(() => {
    // Only auto-save if there's actual data (not initial empty state)
    const hasData =
      title ||
      username ||
      passwordValue ||
      website ||
      notes ||
      customFields.length > 0;

    if (hasData) {
      // Debounce auto-save to prevent rapid successive calls
      const timeoutId = setTimeout(() => {
        // console.log('💾 Auto-saving form data...');
        onSave({
          title,
          username,
          password: passwordValue,
          website,
          notes,
          category,
          isFavorite,
          customFields,
          tags: password?.tags || [], // Preserve tags from parent
        });
      }, 300); // 300ms debounce

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    username,
    passwordValue,
    website,
    notes,
    category,
    isFavorite,
    customFields,
    // DON'T include onSave in dependencies - it causes infinite loop
    // onSave is stable and doesn't need to be tracked
  ]);

  // Validate form when fields change
  useEffect(() => {
    const validate = async () => {
      setIsValidating(true);
      const errors: string[] = [];

      // Required field validation
      if (!title.trim()) {
        errors.push('Title is required');
      }

      if (!passwordValue.trim()) {
        errors.push('Password is required');
      }

      // URL validation
      if (website && !isValidUrl(website)) {
        errors.push('Please enter a valid URL');
      }

      // Password validation
      if (passwordValue) {
        const validation =
          PasswordValidationService.validatePassword(passwordValue);
        if (!validation.isValid) {
          errors.push(...validation.errors);
        }
      }

      setValidationErrors(errors);
      setIsValidating(false);
    };

    validate();
  }, [title, username, passwordValue, website]);

  // Remove the separate validateForm function since it's now inline in useEffect

  const isValidUrl = (url: string): boolean => {
    try {
      const validUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      return !!validUrl;
    } catch {
      return false;
    }
  };

  const handleGeneratePassword = () => {
    try {
      const newPassword = generateSecurePassword(generatorOptions);
      setPasswordValue(newPassword);
      setShowPasswordGenerator(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate password');
    }
  };

  const handleAddCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      name: '',
      value: '',
      type: 'text',
      isHidden: false,
      createdAt: new Date(),
    };
    setCustomFields([...customFields, newField]);
  };

  const handleUpdateCustomField = (id: string, field: Partial<CustomField>) => {
    setCustomFields(
      customFields.map(f => (f.id === id ? { ...f, ...field } : f)),
    );
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleSave = () => {
    if (validationErrors.length > 0) {
      Alert.alert('Validation Error', validationErrors.join('\n'));
      return;
    }

    const passwordData: Partial<PasswordEntry> = {
      title: title.trim(),
      username: username.trim(),
      password: passwordValue,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
      category: category,
      isFavorite,
      customFields: customFields.filter(f => f.name.trim() && f.value.trim()),
      updatedAt: new Date(),
    };

    if (!isEditing) {
      passwordData.createdAt = new Date();
    }

    onSave(passwordData);
  };

  const renderPasswordStrength = () => {
    if (!passwordStrength) return null;

    return (
      <View style={styles.strengthContainer}>
        <View style={styles.strengthHeader}>
          <Text style={styles.strengthLabel}>Password Strength</Text>
          <Text
            style={[styles.strengthScore, { color: passwordStrength.color }]}
          >
            {passwordStrength.label}
          </Text>
        </View>
        <View style={styles.strengthBar}>
          <View
            style={[
              styles.strengthFill,
              {
                width: `${(passwordStrength.score / 4) * 100}%`,
                backgroundColor: passwordStrength.color,
              },
            ]}
          />
        </View>
        {passwordStrength.feedback.length > 0 && (
          <View style={styles.feedbackContainer}>
            {passwordStrength.feedback.map((feedback, index) => (
              <Text key={index} style={styles.feedbackText}>
                • {feedback}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPasswordGenerator = () => {
    if (!showPasswordGenerator) return null;

    return (
      <View style={styles.generatorContainer}>
        <View style={styles.generatorHeader}>
          <Text style={styles.generatorTitle}>Password Generator</Text>
          <TouchableOpacity
            onPress={() => setShowPasswordGenerator(false)}
            style={styles.closeButton}
          >
            <Icon name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.generatorOption}>
          <Text style={styles.optionLabel}>
            Length: {generatorOptions.length}
          </Text>
          {/* Note: In a real app, you'd use a Slider component here */}
          <View style={styles.lengthControls}>
            <TouchableOpacity
              onPress={() =>
                setGeneratorOptions({
                  ...generatorOptions,
                  length: Math.max(4, generatorOptions.length - 1),
                })
              }
              style={styles.lengthButton}
            >
              <Icon name="remove" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setGeneratorOptions({
                  ...generatorOptions,
                  length: Math.min(50, generatorOptions.length + 1),
                })
              }
              style={styles.lengthButton}
            >
              <Icon name="add" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {Object.entries({
          includeUppercase: 'Uppercase (A-Z)',
          includeLowercase: 'Lowercase (a-z)',
          includeNumbers: 'Numbers (0-9)',
          includeSymbols: 'Symbols (!@#$)',
          excludeSimilar: 'Exclude similar characters',
        }).map(([key, label]) => (
          <View key={key} style={styles.generatorOption}>
            <Text style={styles.optionLabel}>{label}</Text>
            <Switch
              value={
                generatorOptions[
                  key as keyof typeof generatorOptions
                ] as boolean
              }
              onValueChange={value =>
                setGeneratorOptions({ ...generatorOptions, [key]: value })
              }
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>
        ))}

        <TouchableOpacity
          onPress={handleGeneratePassword}
          style={styles.generateButton}
        >
          <Icon name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.generateButtonText}>Generate Password</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCustomFields = () => {
    if (!showCustomFields) return null;

    return (
      <View style={styles.customFieldsContainer}>
        <View style={styles.customFieldsHeader}>
          <Text style={styles.customFieldsTitle}>Custom Fields</Text>
          <TouchableOpacity
            onPress={handleAddCustomField}
            style={styles.addFieldButton}
          >
            <Icon name="add" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {customFields.map(field => (
          <View key={field.id} style={styles.customField}>
            <View style={styles.customFieldRow}>
              <TextInput
                style={[styles.input, styles.customFieldName]}
                placeholder="Field name"
                value={field.name}
                onChangeText={text =>
                  handleUpdateCustomField(field.id, { name: text })
                }
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                {...getCleanKeyboardProps(theme)}
              />
              <TouchableOpacity
                onPress={() => handleRemoveCustomField(field.id)}
                style={styles.removeFieldButton}
              >
                <Icon name="delete" size={20} color={theme.error} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Field value"
              value={field.value}
              onChangeText={text =>
                handleUpdateCustomField(field.id, { value: text })
              }
              secureTextEntry={field.isHidden}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              {...getCleanKeyboardProps(theme)}
            />
            <View style={styles.customFieldOptions}>
              <View style={styles.fieldTypeContainer}>
                <Text style={styles.fieldTypeLabel}>Hidden:</Text>
                <Switch
                  value={field.isHidden}
                  onValueChange={value =>
                    handleUpdateCustomField(field.id, { isHidden: value })
                  }
                  thumbColor={theme.primary}
                  trackColor={{
                    false: theme.border,
                    true: theme.primary + '40',
                  }}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Title Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[
                styles.input,
                validationErrors.some(e => e.includes('Title')) &&
                  styles.inputError,
              ]}
              placeholder="Enter title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              {...getCleanKeyboardProps(theme, 'text')}
            />
          </View>

          {/* Username Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Username / Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter username or email"
              value={username}
              onChangeText={setUsername}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              {...getCleanKeyboardProps(theme)}
            />
          </View>

          {/* Password Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  validationErrors.some(e => e.includes('Password')) &&
                    styles.inputError,
                ]}
                placeholder="Enter password"
                value={passwordValue}
                onChangeText={setPasswordValue}
                secureTextEntry={!isPasswordVisible}
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                {...getCleanKeyboardProps(theme, 'password')}
              />
              <TouchableOpacity
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                style={styles.passwordToggle}
              >
                <Icon
                  name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPasswordGenerator(!showPasswordGenerator)}
                style={styles.generateToggle}
              >
                <Icon name="refresh" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {renderPasswordStrength()}
          </View>

          {/* Password Generator */}
          {renderPasswordGenerator()}

          {/* Website Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={[
                styles.input,
                validationErrors.some(e => e.includes('URL')) &&
                  styles.inputError,
              ]}
              placeholder="https://example.com"
              value={website}
              onChangeText={setWebsite}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              {...getCleanKeyboardProps(theme, 'url')}
            />
          </View>

          {/* Category Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              placeholder="Select category"
              value={category}
              onChangeText={setCategory}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              {...getCleanKeyboardProps(theme)}
            />
            {/* TODO: Replace with CategorySelector component when implemented */}
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Additional notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              {...getCleanKeyboardProps(theme)}
            />
          </View>

          {/* Favorite Toggle */}
          <View style={styles.switchField}>
            <Text style={styles.label}>Add to Favorites</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>

          {/* Custom Fields Toggle */}
          <View style={styles.switchField}>
            <Text style={styles.label}>Custom Fields</Text>
            <Switch
              value={showCustomFields}
              onValueChange={setShowCustomFields}
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>

          {/* Custom Fields */}
          {renderCustomFields()}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <View style={styles.errorsContainer}>
              {validationErrors.map((error, index) => (
                <Text key={index} style={styles.errorText}>
                  • {error}
                </Text>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.saveButton,
                validationErrors.length > 0 && styles.disabledButton,
              ]}
              disabled={validationErrors.length > 0}
            >
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Update' : 'Save'} Password
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Empty InputAccessoryView to hide iOS keyboard toolbar */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={EMPTY_INPUT_ACCESSORY_VIEW_ID}>
          <View style={styles.emptyAccessoryView} />
        </InputAccessoryView>
      )}
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    form: {
      padding: 16,
    },
    field: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputError: {
      borderColor: theme.error,
      borderWidth: 2,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
      marginRight: 8,
    },
    passwordToggle: {
      padding: 8,
    },
    generateToggle: {
      padding: 8,
    },
    notesInput: {
      height: 80,
      textAlignVertical: 'top',
    },
    switchField: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    strengthContainer: {
      marginTop: 12,
    },
    strengthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    strengthLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    strengthScore: {
      fontSize: 14,
      fontWeight: '600',
    },
    strengthBar: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginBottom: 8,
    },
    strengthFill: {
      height: '100%',
      borderRadius: 2,
    },
    feedbackContainer: {
      marginTop: 4,
    },
    feedbackText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    generatorContainer: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    generatorHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    generatorTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    generatorOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    optionLabel: {
      fontSize: 14,
      color: theme.text,
    },
    lengthControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    lengthButton: {
      padding: 8,
      marginHorizontal: 4,
    },
    generateButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    generateButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    customFieldsContainer: {
      marginTop: 12,
    },
    customFieldsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    customFieldsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    addFieldButton: {
      padding: 8,
    },
    customField: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    customFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    customFieldName: {
      flex: 1,
      marginRight: 8,
    },
    removeFieldButton: {
      padding: 8,
    },
    customFieldOptions: {
      marginTop: 8,
    },
    fieldTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fieldTypeLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginRight: 8,
    },
    errorsContainer: {
      backgroundColor: theme.error + '20',
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      marginBottom: 2,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      paddingBottom: 20,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelButtonText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginLeft: 8,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    disabledButton: {
      backgroundColor: theme.textSecondary,
      opacity: 0.6,
    },
    emptyAccessoryView: {
      height: 0,
    },
  });

export default PasswordForm;
