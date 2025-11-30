import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  InputAccessoryView,
  FlatList,
  Modal,
  TextInput as RNTextInput,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import {
  PasswordEntry,
  CustomField, // Keep for backward compatibility with state typing
  PasswordStrengthResult,
} from '../types/password';
import { useTheme, Theme } from '../contexts/ThemeContext';
import {
  calculatePasswordStrength,
  // generateSecurePassword, // Moved to QuickPasswordGenerator component
} from '../utils/passwordUtils';
// import { PasswordValidationService } from '../services/passwordValidationService'; // Unused - real-time validation removed
import { TrackedTextInput as TextInput } from './TrackedTextInput';
import CategorySelector from './CategorySelector';
import { QuickPasswordGenerator } from './QuickPasswordGenerator';
import ConfirmDialog from './ConfirmDialog';
import { useInstalledApps, AppInfo } from '../hooks/useInstalledApps';
import { getDomainType } from '../utils/domainUtils';

interface PasswordFormProps {
  password?: PasswordEntry;
  onSave: (password: Partial<PasswordEntry>) => void;
  onCancel: () => void;
  onDataChange?: (password: Partial<PasswordEntry>) => void; // Real-time updates for parent
  isEditing?: boolean;
  enableAutoSave?: boolean; // Default true, set to false to disable auto-save
  onDecryptPassword?: () => Promise<string>; // Called to handle authentication (biometric -> fallback -> PIN)
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
  onDataChange,
  isEditing = false,
  enableAutoSave = true,
  onDecryptPassword,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);

  // Form state
  const [title, setTitle] = useState(password?.title || '');
  const [username, setUsername] = useState(password?.username || '');
  const [passwordValue, setPasswordValue] = useState(password?.password || '');
  const [website, setWebsite] = useState(password?.website || '');
  const [notes, setNotes] = useState(password?.notes || '');
  const [category, setCategory] = useState(password?.category || 'Other');
  const [isFavorite, setIsFavorite] = useState(password?.isFavorite || false);
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

  // Domain Type state (Web or Mobile App)
  const [domainType, setDomainType] = useState<'web' | 'mobile'>('web');
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null);
  const [showAppSelector, setShowAppSelector] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [filteredApps, setFilteredApps] = useState<AppInfo[]>([]);

  // Use installed apps hook
  const {
    apps,
    loading: appsLoading,
    error: appsError,
    searchApps,
    refetch: refetchApps,
  } = useInstalledApps();

  // Password generator options - DEPRECATED: Now using QuickPasswordGenerator component
  // const [generatorOptions, setGeneratorOptions] = useState({
  //   length: 16,
  //   includeUppercase: true,
  //   includeLowercase: true,
  //   includeNumbers: true,
  //   includeSymbols: false,
  //   excludeSimilar: true,
  // });

  // Use ref to track if form has been initialized to avoid overwriting user input
  const isInitializedRef = React.useRef(false);
  const lastPasswordIdRef = React.useRef<string | undefined>(undefined);
  // Track if password has been decrypted (when user clicks eye icon)
  const isPasswordDecryptedRef = React.useRef(false);
  // Track original values for reset functionality
  const originalValuesRef = React.useRef({
    title: '',
    username: '',
    password: '',
    website: '',
    notes: '',
    category: 'Other',
    isFavorite: false,
  });

  // Sync form state with password prop ONLY on initial load or when password ID changes
  useEffect(() => {
    // console.log('🔍 PasswordForm useEffect triggered:', {
    //   hasPassword: !!password,
    //   passwordId: password?.id,
    //   passwordValue: password?.isDecrypted
    //     ? '[DECRYPTED]'
    //     : password?.password
    //     ? '[ENCRYPTED]'
    //     : '[EMPTY]',
    //   currentPasswordValue: passwordValue ? '[HAS_VALUE]' : '[EMPTY]',
    //   isInitialized: isInitializedRef.current,
    //   lastPasswordId: lastPasswordIdRef.current,
    //   isPasswordVisible,
    // });

    // Sync if:
    // 1. First time initialization, OR
    // 2. Password ID changed (editing different password), OR
    // 3. Password value changed when creating new entry (no ID yet), OR
    // 4. Password was decrypted (isDecrypted flag changed to true)
    const shouldSync =
      password &&
      (!isInitializedRef.current ||
        password.id !== lastPasswordIdRef.current ||
        (!password.id &&
          password.password &&
          password.password !== passwordValue) ||
        (password.isDecrypted &&
          password.password &&
          password.password !== passwordValue));

    // console.log('🔍 PasswordForm shouldSync:', shouldSync, {
    //   condition1_firstTime: !isInitializedRef.current,
    //   condition2_idChanged: password?.id !== lastPasswordIdRef.current,
    //   condition3_newEntry:
    //     !password?.id &&
    //     password?.password &&
    //     password?.password !== passwordValue,
    //   condition4_decrypted:
    //     password?.isDecrypted &&
    //     password?.password &&
    //     password?.password !== passwordValue,
    // });

    if (shouldSync) {
      console.log('🔄 PasswordForm: Syncing with password prop:', {
        ...password,
        password: password.isDecrypted
          ? '[DECRYPTED]'
          : password.password
          ? '[ENCRYPTED]'
          : '[EMPTY]',
      });
      setTitle(password.title || '');
      setUsername(password.username || '');
      setPasswordValue(password.password || '');
      setWebsite(password.website || '');
      setNotes(password.notes || '');
      setCategory(password.category || 'Other');
      setIsFavorite(password.isFavorite || false);

      // Detect domain type based on website field
      if (password.website) {
        const detectedType = getDomainType(password.website);
        setDomainType(detectedType);

        if (detectedType === 'mobile') {
          setSelectedApp({
            name: password.website,
            packageName: password.website,
          });
        } else {
          setSelectedApp(null);
        }
      }

      isInitializedRef.current = true;
      lastPasswordIdRef.current = password.id;

      // Update decryption flag based on password state
      // Mark password as decrypted if:
      // 1. It's coming from generator (plain text, no ID), OR
      // 2. It's an existing password that has been decrypted (isDecrypted = true)
      if (password.password && password.isDecrypted) {
        isPasswordDecryptedRef.current = true;
      } else {
        // Only reset to false if password is actually encrypted
        isPasswordDecryptedRef.current = false;
      }

      // Store original values for reset functionality
      originalValuesRef.current = {
        title: password.title || '',
        username: password.username || '',
        password: password.password || '',
        website: password.website || '',
        notes: password.notes || '',
        category: password.category || 'Other',
        isFavorite: password.isFavorite || false,
      };
    }
  }, [password, passwordValue]); // Re-run when password prop or current passwordValue changes (not visibility - toggling visibility should not reset form)

  // Initialize filtered apps when app selector opens
  useEffect(() => {
    if (showAppSelector) {
      console.log(
        `📱 [PasswordForm] App selector opened, total apps: ${apps.length}`,
      );
      setFilteredApps(apps);
      setAppSearchQuery('');
      console.log(`📱 [PasswordForm] Filtered apps set: ${apps.length} items`);
    }
  }, [showAppSelector, apps]);

  // Helper function to notify parent of form changes - use ref to avoid re-renders
  const notifyDataChangeRef = React.useRef<typeof onDataChange>(onDataChange);
  React.useEffect(() => {
    notifyDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const notifyDataChange = useCallback(
    (
      overrides: Partial<{
        title: string;
        username: string;
        passwordValue: string;
        website: string;
        notes: string;
        category: string;
        isFavorite: boolean;
      }> = {},
    ) => {
      if (notifyDataChangeRef.current) {
        const currentFormData = {
          title: overrides.title ?? title,
          username: overrides.username ?? username,
          password: overrides.passwordValue ?? passwordValue,
          website: overrides.website ?? website,
          notes: overrides.notes ?? notes,
          category: overrides.category ?? category,
          // Include other fields that parent might need
          isFavorite: overrides.isFavorite ?? isFavorite,
          customFields: [], // Disabled feature
          tags: [], // Default empty
        };
        notifyDataChangeRef.current(currentFormData);
      }
    },
    [title, username, passwordValue, website, notes, category, isFavorite],
  );

  // Handle app search
  const handleAppSearch = useCallback(
    async (query: string) => {
      setAppSearchQuery(query);
      if (!query.trim()) {
        setFilteredApps(apps);
        return;
      }

      try {
        const results = await searchApps(query);
        setFilteredApps(results);
      } catch (err) {
        console.error('❌ Error searching apps:', err);
        setFilteredApps([]);
      }
    },
    [apps, searchApps],
  );

  // Handle app selection
  const handleAppSelect = useCallback(
    (app: AppInfo) => {
      console.log('📱 Selected app:', app.packageName);
      setSelectedApp(app);
      setWebsite(app.packageName); // Set website to package name
      setShowAppSelector(false);
      notifyDataChange({ website: app.packageName });
    },
    [notifyDataChange],
  );

  // Calculate password strength when password changes
  useEffect(() => {
    // Only calculate strength for decrypted passwords
    if (passwordValue && (password?.isDecrypted || !password?.id)) {
      const strength = calculatePasswordStrength(passwordValue);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [passwordValue, password?.isDecrypted, password?.id]);

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
          password: passwordValue.trim(),
          website,
          notes,
          category,
          isFavorite,
          customFields: [], // Empty array since custom fields removed
          tags: password?.tags || [], // Preserve tags from parent
        });
      }, 200); // Reduced from 300ms to 200ms for faster input response

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    username,
    passwordValue,
    website,
    notes,
    // Removed category - not used in auto-save detection
    // Removed isFavorite and customFields - no longer used in UI
    // DON'T include onSave in dependencies - it causes infinite loop
    // onSave is stable and doesn't need to be tracked
  ]);

  // Handle category selection without triggering autofill
  const handleCategorySelect = useCallback(
    (selectedCategory: string) => {
      console.log('📋 [Category] Category selected:', selectedCategory);
      setCategory(selectedCategory);
      notifyDataChange({ category: selectedCategory });
    },
    [notifyDataChange],
  );

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
          password: passwordValue.trim(),
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
          category: category,
          isFavorite,
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
    isFavorite,
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

  // DEPRECATED: Now using QuickPasswordGenerator component
  // const handleGeneratePassword = () => {
  //   try {
  //     const newPassword = generateSecurePassword(generatorOptions);
  //     setPasswordValue(newPassword);
  //     setShowPasswordGenerator(false);
  //   } catch (error) {
  //     Alert.alert('Error', 'Failed to generate password');
  //   }
  // };

  // Custom field handlers removed - custom fields functionality removed

  // handleSave function removed - no longer needed since manual Save button was removed
  // Form now relies on auto-save functionality

  const renderPasswordStrength = () => {
    if (!passwordStrength) return null;

    return (
      <View style={styles.strengthContainer}>
        <View style={styles.strengthHeader}>
          <Text style={styles.strengthLabel}>
            {t('password_form.password_strength')}
          </Text>
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

  // DEPRECATED: Now using QuickPasswordGenerator component
  // const renderPasswordGenerator = () => {
  //   if (!showPasswordGenerator) return null;
  //   return (
  //     <View style={styles.generatorContainer}>
  //       ... old generator UI ...
  //     </View>
  //   );
  // };

  // renderCustomFields function removed - custom fields functionality removed

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Title Field */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t('password_form.title_required')}
            </Text>
            <TextInput
              style={[
                styles.input,
                validationErrors.some(e => e.includes('Title')) &&
                  styles.inputError,
              ]}
              placeholder={t('password_form.enter_title')}
              value={title}
              onChangeText={text => {
                setTitle(text);
                notifyDataChange({ title: text });
              }}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              autoComplete="off"
              importantForAutofill="no"
              {...getCleanKeyboardProps(theme, 'text')}
            />
          </View>

          {/* Username Field */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t('password_form.username_email')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('password_form.enter_username_email')}
              value={username}
              onChangeText={text => {
                const trimmedText = text.trim();
                setUsername(trimmedText);
                notifyDataChange({ username: trimmedText });
              }}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              autoComplete="off"
              importantForAutofill="no"
              {...getCleanKeyboardProps(theme)}
            />
          </View>

          {/* Password Field */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {t('password_form.password_required')}
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  validationErrors.some(e => e.includes('Password')) &&
                    styles.inputError,
                ]}
                placeholder={t('password_form.enter_password')}
                value={passwordValue}
                onChangeText={text => {
                  const trimmedText = text.trim();
                  setPasswordValue(trimmedText);
                  notifyDataChange({ passwordValue: trimmedText });
                }}
                onFocus={() => {
                  if (
                    isEditing &&
                    !isPasswordDecryptedRef.current &&
                    passwordValue
                  ) {
                    console.log(
                      '🔄 PasswordForm: Password field focused with encrypted password, clearing...',
                    );
                    setPasswordValue('');
                    notifyDataChange({ passwordValue: '' });
                  }
                }}
                // onBlur={handlePasswordBlur} // 🚫 Temporarily disabled - causing Google autofill modal
                secureTextEntry={!isPasswordVisible}
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                autoComplete="off"
                importantForAutofill="no"
                {...getCleanKeyboardProps(theme, 'password')}
              />
              <TouchableOpacity
                onPress={async () => {
                  console.log(
                    '👁️ [PasswordForm] Eye icon pressed, isPasswordVisible:',
                    isPasswordVisible,
                    'isEditing:',
                    isEditing,
                  );
                  // If trying to show password, require authentication
                  if (!isPasswordVisible) {
                    // For new passwords (isEditing=false), no authentication needed
                    if (!isEditing) {
                      console.log(
                        '👁️ [PasswordForm] New password - no authentication needed, showing directly',
                      );
                      setIsPasswordVisible(true);
                      return;
                    }

                    console.log(
                      '👁️ [PasswordForm] Requesting authentication to view password',
                    );

                    if (
                      onDecryptPassword &&
                      !isPasswordDecryptedRef.current &&
                      !password?.isDecrypted
                    ) {
                      console.log(
                        '🔓 PasswordForm: Calling parent onDecryptPassword (biometric + PIN flow)...',
                      );
                      try {
                        const decrypted = await onDecryptPassword();
                        console.log(
                          '🔓 PasswordForm: onDecryptPassword returned:',
                          decrypted ? '[VALUE]' : '[EMPTY]',
                        );
                        if (decrypted) {
                          console.log(
                            '✅ PasswordForm: Password decrypted after parent authentication',
                          );
                          isPasswordDecryptedRef.current = true;
                          setIsPasswordVisible(true);
                        } else {
                          console.log(
                            '👁️ [PasswordForm] onDecryptPassword returned empty value',
                          );
                        }
                      } catch (error) {
                        console.log(
                          '🔐 PasswordForm: Authentication cancelled or failed, keeping password hidden',
                          error,
                        );
                        return;
                      }
                    } else {
                      console.log(
                        '👁️ [PasswordForm] Password already decrypted, showing directly',
                      );
                      setIsPasswordVisible(true);
                    }
                  } else {
                    // Hiding password doesn't require authentication
                    setIsPasswordVisible(false);
                  }
                }}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  // Reset ALL fields to original values
                  // Password reset based on visibility state:
                  // - If password is hidden (eye closed) → reset to encrypted original
                  // - If password is visible (eye open) → reset to decrypted original
                  const resetPasswordValue = isPasswordVisible
                    ? originalValuesRef.current.password
                    : password?.password || '';

                  console.log(
                    '🔄 PasswordForm: Resetting all fields to original values',
                    {
                      isPasswordVisible,
                      resetPasswordTo: isPasswordVisible
                        ? '[DECRYPTED]'
                        : '[ENCRYPTED]',
                    },
                  );

                  // Reset all form fields
                  setTitle(originalValuesRef.current.title);
                  setUsername(originalValuesRef.current.username);
                  setPasswordValue(resetPasswordValue);
                  setWebsite(originalValuesRef.current.website);
                  setNotes(originalValuesRef.current.notes);
                  setCategory(originalValuesRef.current.category);
                  setIsFavorite(originalValuesRef.current.isFavorite);

                  // Notify parent of all changes
                  notifyDataChange({
                    title: originalValuesRef.current.title,
                    username: originalValuesRef.current.username,
                    passwordValue: resetPasswordValue,
                    website: originalValuesRef.current.website,
                    notes: originalValuesRef.current.notes,
                    category: originalValuesRef.current.category,
                    isFavorite: originalValuesRef.current.isFavorite,
                  });
                }}
                style={styles.generateToggle}
              >
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={theme.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPasswordGenerator(true)}
                style={styles.quickGenerateIcon}
                accessibilityLabel="Quick Generate Password"
              >
                <Ionicons
                  name={'flash-outline'}
                  size={22}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>
            {renderPasswordStrength()}
          </View>

          {/* Domain Type Toggle */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('password_form.domain_type')}</Text>
            <View style={styles.domainTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.domainTypeButton,
                  domainType === 'web' && styles.domainTypeButtonActive,
                  {
                    backgroundColor:
                      domainType === 'web' ? theme.primary : theme.background,
                  },
                ]}
                onPress={() => {
                  setDomainType('web');
                  setSelectedApp(null);
                  setWebsite('');
                  notifyDataChange({ website: '' });
                }}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={domainType === 'web' ? '#fff' : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.domainTypeButtonText,
                    domainType === 'web' && styles.domainTypeButtonTextActive,
                  ]}
                >
                  {t('password_form.web')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.domainTypeButton,
                  domainType === 'mobile' && styles.domainTypeButtonActive,
                  {
                    backgroundColor:
                      domainType === 'mobile'
                        ? theme.primary
                        : theme.background,
                  },
                ]}
                onPress={() => {
                  setDomainType('mobile');
                  setWebsite('');
                  setSelectedApp(null);
                  notifyDataChange({ website: '' });
                }}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={domainType === 'mobile' ? '#fff' : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.domainTypeButtonText,
                    domainType === 'mobile' &&
                      styles.domainTypeButtonTextActive,
                  ]}
                >
                  {t('password_form.mobile_app')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Website Field - Web Type */}
          {domainType === 'web' && (
            <View style={styles.field}>
              <Text style={styles.label}>
                {t('password_form.website_domain')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  validationErrors.some(e => e.includes('URL')) &&
                    styles.inputError,
                ]}
                placeholder={t('password_form.website_placeholder')}
                value={website}
                onChangeText={text => {
                  setWebsite(text);
                  notifyDataChange({ website: text });
                }}
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                autoComplete="off"
                importantForAutofill="no"
                {...getCleanKeyboardProps(theme, 'url')}
              />
            </View>
          )}

          {/* App Selector - Mobile Type */}
          {domainType === 'mobile' && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('password_form.select_app')}</Text>
              <TouchableOpacity
                style={styles.appSelectorButton}
                onPress={async () => {
                  await refetchApps(); // Refresh app list before opening modal
                  setShowAppSelector(true);
                }}
              >
                {selectedApp ? (
                  <>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={18}
                      color={theme.primary}
                    />
                    <View style={styles.appSelectorContent}>
                      <Text style={styles.appSelectorName}>
                        {selectedApp.name}
                      </Text>
                      <Text style={styles.appSelectorPackage}>
                        {selectedApp.packageName}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="add-circle-outline"
                      size={18}
                      color={theme.textSecondary}
                    />
                    <Text style={styles.appSelectorPlaceholder}>
                      {t('password_form.tap_to_select_app')}
                    </Text>
                  </>
                )}
                <Ionicons
                  name="chevron-forward-outline"
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {/* Auto-filled domain info */}
              {selectedApp && (
                <View style={styles.domainInfoContainer}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text style={styles.domainInfoText}>
                    {t('password_form.domain_set_to')}{' '}
                    <Text style={styles.domainInfoBold}>
                      {selectedApp.packageName}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Category Field */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('password_form.category')}</Text>
            <CategorySelector
              selectedCategory={category}
              onCategorySelect={handleCategorySelect}
              allowCreate={true}
            />
          </View>

          {/* Favorite Toggle */}
          <View style={styles.field}>
            <View style={styles.favoriteRow}>
              <Text style={styles.label}>
                {t('password_form.add_to_favorites')}
              </Text>
              <Switch
                value={isFavorite}
                onValueChange={value => {
                  setIsFavorite(value);
                  notifyDataChange({ isFavorite: value });
                }}
                trackColor={{
                  false: theme.textSecondary + '30',
                  true: theme.primary + '40',
                }}
                thumbColor={isFavorite ? theme.primary : theme.textSecondary}
              />
            </View>
          </View>

          {/* Notes Field */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('password_form.notes')}</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder={t('password_form.notes_placeholder')}
              value={notes}
              onChangeText={text => {
                setNotes(text);
                notifyDataChange({ notes: text });
              }}
              multiline
              numberOfLines={3}
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              autoComplete="off"
              importantForAutofill="no"
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

      {/* Quick Password Generator Modal */}
      <QuickPasswordGenerator
        visible={showPasswordGenerator}
        onClose={() => setShowPasswordGenerator(false)}
        onSelectPassword={generatedPassword => {
          setPasswordValue(generatedPassword);
          notifyDataChange({ passwordValue: generatedPassword });
        }}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />

      {/* App Selector Modal */}
      <Modal
        visible={showAppSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAppSelector(false)}
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          {/* Header */}
          <View
            style={[styles.modalHeader, { backgroundColor: theme.surface }]}
          >
            <TouchableOpacity onPress={() => setShowAppSelector(false)}>
              <Ionicons name="close-outline" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {t('password_form.select_app')}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          {/* Search Bar */}
          <View
            style={[styles.searchContainer, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={theme.textSecondary}
            />
            <RNTextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t('password_form.search_apps')}
              placeholderTextColor={theme.textSecondary}
              value={appSearchQuery}
              onChangeText={handleAppSearch}
            />
          </View>

          {/* Apps List */}
          {appsLoading && !apps.length ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text
                style={[styles.loadingText, { color: theme.textSecondary }]}
              >
                {t('password_form.loading_apps')}
              </Text>
            </View>
          ) : filteredApps.length > 0 ? (
            <View style={styles.appsListContainer}>
              <Text
                style={[styles.appsCountText, { color: theme.textSecondary }]}
              >
                {t('password_form.apps_available', {
                  count: filteredApps.length,
                })}
              </Text>
              <FlatList
                data={filteredApps}
                keyExtractor={item => item.packageName}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.appListItem,
                      { backgroundColor: theme.surface },
                    ]}
                    onPress={() => handleAppSelect(item)}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={24}
                      color={theme.primary}
                    />
                    <View style={styles.appListItemContent}>
                      <Text style={styles.appListItemName}>{item.name}</Text>
                      <Text
                        style={[
                          styles.appListItemPackage,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {item.packageName}
                      </Text>
                    </View>
                    {selectedApp?.packageName === item.packageName && (
                      <Ionicons
                        name="checkmark-done-outline"
                        size={20}
                        color={theme.primary}
                      />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.appsList}
                contentContainerStyle={styles.appsListContent}
                scrollEnabled={true}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={20}
                updateCellsBatchingPeriod={50}
                initialNumToRender={20}
                windowSize={10}
              />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="search-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {appsError
                  ? t('password_form.error_loading_apps')
                  : appSearchQuery
                  ? t('password_form.no_apps_found')
                  : t('password_form.no_apps_available')}
              </Text>
            </View>
          )}
        </View>
      </Modal>
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
    favoriteRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    quickGenerateIcon: {
      padding: 8,
      marginLeft: 2,
      justifyContent: 'center',
      alignItems: 'center',
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

    // Domain Type Toggle Styles
    domainTypeContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    domainTypeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: theme.border,
      gap: 8,
    },
    domainTypeButtonActive: {
      borderColor: theme.primary,
    },
    domainTypeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    domainTypeButtonTextActive: {
      color: '#FFFFFF',
    },

    // App Selector Styles
    appSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    appSelectorContent: {
      flex: 1,
    },
    appSelectorName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    appSelectorPackage: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    appSelectorPlaceholder: {
      fontSize: 14,
      color: theme.textSecondary,
      flex: 1,
    },

    // Domain Info Container
    domainInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.primary + '15',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 6,
      marginTop: 8,
    },
    domainInfoText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    domainInfoBold: {
      fontWeight: '600',
      color: theme.text,
    },

    // Modal Styles
    modalContainer: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? 0 : 50,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalHeaderSpacer: {
      width: 24,
    },

    // Search Container
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
    },

    // App List Container
    appsListContainer: {
      flex: 1,
    },
    appsCountText: {
      padding: 8,
      fontSize: 12,
    },
    appsList: {
      flex: 1,
    },
    appsListContent: {
      paddingBottom: 20,
    },

    // App List Item
    appListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    appListItemContent: {
      flex: 1,
    },
    appListItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    appListItemPackage: {
      fontSize: 12,
      color: theme.textSecondary,
    },

    // Loading & Empty States
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '500',
    },
  });

export default PasswordForm;
