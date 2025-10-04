import React, { useState, useEffect, useCallback } from 'react';
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
  CustomField, // Keep for backward compatibility with state typing
  PasswordStrengthResult,
} from '../types/password';
import { useTheme, Theme } from '../contexts/ThemeContext';
import {
  calculatePasswordStrength,
  generateSecurePassword,
} from '../utils/passwordUtils';
// import { PasswordValidationService } from '../services/passwordValidationService'; // Unused - real-time validation removed
import { TrackedTextInput as TextInput } from './TrackedTextInput';
import CategorySelector from './CategorySelector';

interface PasswordFormProps {
  password?: PasswordEntry;
  onSave: (password: Partial<PasswordEntry>) => void;
  onCancel: () => void;
  isEditing?: boolean;
  enableAutoSave?: boolean; // Default true, set to false to disable auto-save
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
  onCancel: _onCancel, // Marked as unused since we removed Cancel button
  isEditing: _isEditing = false, // Marked as unused since we removed Save button
  enableAutoSave = true,
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
  const [_isFavorite, _setIsFavorite] = useState(password?.isFavorite || false); // Marked as unused
  const [_customFields, _setCustomFields] = useState<CustomField[]>( // Marked as unused
    password?.customFields || [],
  );

  // Auto-encrypt states
  const [_isPasswordEncrypted, _setIsPasswordEncrypted] = useState(false);
  const [_encryptedPasswordData, _setEncryptedPasswordData] =
    useState<any>(null);

  // UI state
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrengthResult | null>(null);
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
  const [_showCustomFields, _setShowCustomFields] = useState(false); // Marked as unused
  const [_isValidating, _setIsValidating] = useState(false); // Marked as unused
  const [validationErrors, _setValidationErrors] = useState<string[]>([]); // Keep validationErrors for display, but don't set it

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
      // setIsFavorite and setCustomFields removed - features disabled
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
    // Skip auto-save if disabled
    if (!enableAutoSave) return;

    // Only auto-save if there's actual data (not initial empty state)
    const hasData = title || username || passwordValue || website || notes;
    // Removed customFields.length check since custom fields are disabled

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
          isFavorite: false, // Default value since favorite toggle removed
          customFields: [], // Empty array since custom fields removed
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
    // Removed isFavorite and customFields - no longer used in UI
    // DON'T include onSave in dependencies - it causes infinite loop
    // onSave is stable and doesn't need to be tracked
  ]);

  // Handle category selection without triggering autofill
  const handleCategorySelect = useCallback((selectedCategory: string) => {
    console.log('📋 [Category] Category selected:', selectedCategory);
    setCategory(selectedCategory);
  }, []);

  // 🚫 TEMPORARILY DISABLED - Auto-encrypt password when user finishes entering (blur event)
  // This was causing Google autofill modal to appear after category selection
  /*
  const handlePasswordBlur = useCallback(async () => {
    console.log(
      '🔍 [AutoEncrypt] Password blur detected, checking requirements...',
    );

    // Check if password meets basic requirements for auto-encrypt
    const isValidForEncrypt =
      passwordValue.trim().length > 0 &&
      title.trim().length > 0 &&
      validationErrors.length === 0;

    if (isValidForEncrypt) {
      console.log(
        '✅ [AutoEncrypt] Requirements met, triggering auto-encrypt...',
      );
      try {
        onSave({
          title: title.trim(),
          username: username.trim(),
          password: passwordValue,
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
          category: category,
          isFavorite: false, // Default value since favorite removed
          customFields: [], // Empty since custom fields removed
          tags: password?.tags || [],
        });

        console.log('✅ [AutoEncrypt] Auto-encryption triggered successfully');
      } catch (error) {
        console.error('❌ [AutoEncrypt] Auto-encryption failed:', error);
      }
    } else {
      console.log(
        '⚠️ [AutoEncrypt] Password does not meet requirements for auto-encrypt',
      );
    }
  }, [
    passwordValue,
    title,
    username,
    website,
    notes,
    category,
    // isFavorite and customFields removed from dependencies
    onSave,
    password?.tags,
    validationErrors.length,
  ]);
  */

  // 🚫 DISABLED - Real-time validation removed per user request
  // Validation will only occur when user actually tries to save
  /*
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
  */

  // Remove the separate validateForm function since it's now inline in useEffect

  // isValidUrl function removed - no longer needed without real-time validation

  const handleGeneratePassword = () => {
    try {
      const newPassword = generateSecurePassword(generatorOptions);
      setPasswordValue(newPassword);
      setShowPasswordGenerator(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate password');
    }
  };

  // Custom field handlers removed - custom fields functionality removed

  // handleSave function removed - no longer needed since manual Save button was removed
  // Form now relies on auto-save functionality

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

  // renderCustomFields function removed - custom fields functionality removed

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
              autoComplete="off"
              importantForAutofill="no"
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
                // onBlur={handlePasswordBlur} // 🚫 Temporarily disabled - causing Google autofill modal
                secureTextEntry={!isPasswordVisible}
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                autoComplete="off"
                importantForAutofill="no"
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
            <CategorySelector
              selectedCategory={category}
              onCategorySelect={handleCategorySelect}
              allowCreate={true}
            />
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

          {/* Favorite Toggle and Custom Fields - REMOVED: User requested to remove these features */}

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

          {/* Action Buttons - REMOVED: User requested to remove Cancel and Save buttons */}
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
    // switchField style removed - no longer used
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
    // Removed unused custom field styles: customFieldsContainer, customFieldsHeader,
    // customFieldsTitle, addFieldButton, customField, customFieldRow, customFieldName,
    // removeFieldButton, customFieldOptions, fieldTypeContainer, fieldTypeLabel
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
    // Removed unused button styles: actions, cancelButton, cancelButtonText,
    // saveButton, saveButtonText, disabledButton - no longer needed
    emptyAccessoryView: {
      height: 0,
    },
  });

export default PasswordForm;
