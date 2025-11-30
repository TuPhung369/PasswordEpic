import React, { useState, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppState } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordForm from '../../components/PasswordForm';
import ErrorBoundary from '../../components/ErrorBoundary';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { PinPromptModal } from '../../components/PinPromptModal';
import { BiometricPrompt } from '../../components/BiometricPrompt';
import { BiometricFallbackPrompt } from '../../components/BiometricFallbackPrompt';
import { LoadingScreen } from '../../components/LoadingScreen';
import { PasswordEntry } from '../../types/password';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import { PasswordValidationService } from '../../services/passwordValidationService';
import { AuditHistoryService } from '../../services/auditHistoryService';
import { NavigationPersistenceService } from '../../services/navigationPersistenceService';
import { isValidDomain } from '../../utils/passwordUtils';
import { calculateSecurityScore } from '../../utils/passwordMigration';
import {
  unlockMasterPasswordWithPin,
  getEffectiveMasterPassword,
  clearStaticMasterPasswordData,
} from '../../services/staticMasterPasswordService';

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
  const { t } = useTranslation();
  const navigation = useNavigation<AddPasswordScreenNavigationProp>();
  const { createPassword } = usePasswordManagement();

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
    isDecrypted: true, // New passwords are always decrypted (plaintext)
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
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
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

  // PIN unlock dialog state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Omit<
    PasswordEntry,
    'id' | 'createdAt' | 'updatedAt'
  > | null>(null);

  // Biometric authentication flow states
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinPromptResolver, setPinPromptResolver] = useState<{
    resolve: (value: string) => void;
    reject: () => void;
  } | null>(null);

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
            title: t('dialogs.discard_changes_title'),
            message: t('dialogs.discard_changes_message'),
            confirmText: t('dialogs.discard'),
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
  }, [navigation, navigationPersistence, t]);

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

  const handlePinUnlock = async () => {
    if (!pin.trim() || !pendingSaveData) {
      setToastType('error');
      setToastMessage(t('auth.please_enter_pin'));
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

      console.log('✅ PIN unlock successful, creating password...');

      // Delay closing PIN dialog to let LoadingScreen settle
      setTimeout(() => {
        setShowPinDialog(false);
        setPin('');
      }, 100);

      // Now try to save the password with the unlocked master password
      await createPassword(pendingSaveData, unlockResult.password);

      // 🔒 SECURITY: Clear master password cache immediately after use
      await clearStaticMasterPasswordData();
      console.log('🔒 Master password cache cleared for security');

      // Clear temporary data after successful save
      try {
        await navigationPersistence.clearScreenData('AddPassword');
      } catch (error) {
        console.error('Failed to clear temp form data:', error);
      }

      // Hide loading screen
      setShowLoadingScreen(false);

      // Reset navigation stack to PasswordsList with success message
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'PasswordsList',
            params: { successMessage: 'Password created successfully!' },
          },
        ],
      });
    } catch (error: any) {
      console.error('PIN unlock failed:', error);
      const errorMessage = error?.message || String(error);

      setToastType('error');
      setToastMessage(
        errorMessage.includes('locked')
          ? errorMessage
          : t('dialogs.incorrect_pin'),
      );
      setShowToast(true);
      setIsSaving(false);
      setShowLoadingScreen(false);
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinCancel = () => {
    setShowPinDialog(false);
    setPin('');
    setPendingSaveData(null);
    setIsSaving(false);
    setShowLoadingScreen(false);
  };

  const handleCancel = async () => {
    if (hasUnsavedChanges()) {
      setConfirmDialog({
        visible: true,
        title: t('dialogs.discard_changes_title'),
        message: t('dialogs.discard_changes_message'),
        confirmText: t('dialogs.discard'),
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
    const hasPassword = !!(
      formData?.password && formData.password.trim().length > 0
    );
    const hasUsernameOrEmail = !!(
      (formData?.username && formData.username.trim().length > 0) ||
      (formData?.website && formData.website.trim().length > 0)
    );
    const hasDomain = isValidDomain(formData?.website);
    const isValid = hasTitle && hasPassword && hasUsernameOrEmail && hasDomain;
    return isValid;
  }, [formData]); // Depend on full formData to ensure callback stays updated

  const handleSave = async () => {
    if (!isFormValid()) {
      const hasTitle = !!(formData?.title && formData.title.trim().length > 0);
      const hasPassword = !!(
        formData?.password && formData.password.trim().length > 0
      );
      const hasUsernameOrEmail = !!(
        (formData?.username && formData.username.trim().length > 0) ||
        (formData?.website && formData.website.trim().length > 0)
      );
      const hasDomain = isValidDomain(formData?.website);

      let errorMessage = t('dialogs.fill_required_fields');
      if (!hasTitle) errorMessage += ` ${t('dialogs.field_title')},`;
      if (!hasPassword) errorMessage += ` ${t('dialogs.field_password')},`;
      if (!hasUsernameOrEmail)
        errorMessage += ` ${t('dialogs.field_username_email')},`;
      if (!hasDomain) errorMessage += ` ${t('dialogs.field_valid_domain')},`;
      errorMessage = errorMessage.replace(/,$/, '.'); // Remove trailing comma and add period

      setConfirmDialog({
        visible: true,
        title: t('dialogs.validation_error'),
        message: errorMessage,
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsSaving(true);
    setShowLoadingScreen(true);

    try {
      // 🔐 PROACTIVE PIN CHECK: Verify authentication BEFORE creating password
      console.log(
        '🔐 AddPasswordScreen: Checking authentication before creating password...',
      );
      const authCheck = await getEffectiveMasterPassword();

      if (!authCheck.success || !authCheck.password) {
        console.log(
          '🔐 AddPasswordScreen: Authentication required - showing PIN dialog',
        );

        // Prepare password entry data for retry after PIN unlock
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
          accessCount: 0,
          frequencyScore: 0,
          passwordHistory: [],
        };

        setPendingSaveData(newPasswordEntry);
        setShowPinDialog(true);
        return; // Stop here and wait for PIN
      }

      console.log(
        '✅ AddPasswordScreen: Authentication verified - proceeding with creation',
      );

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
          ? (() => {
              const strengthResult =
                PasswordValidationService.analyzePasswordStrength(
                  formData.password,
                );
              const now = new Date();
              const tempEntry: PasswordEntry = {
                ...formData,
                password: formData.password,
                createdAt: now,
                updatedAt: now,
                breachStatus: {
                  isBreached: false,
                  breachCount: 0,
                  lastChecked: now,
                  breachSources: [],
                  severity: 'low',
                },
              } as PasswordEntry;
              const securityScore = calculateSecurityScore(
                tempEntry,
                strengthResult.score,
              );

              return {
                passwordStrength: strengthResult,
                duplicateCount: 0,
                compromisedCount: 0,
                lastPasswordChange: new Date(),
                securityScore,
                recommendedAction:
                  strengthResult.score < 2 ? 'change_password' : 'none',
              };
            })()
          : undefined,
      };

      const createdPassword = await createPassword(newPasswordEntry);

      // 🔍 Run security audit and save audit result after password is created
      try {
        console.log(
          '🔍 AddPasswordScreen: Running security audit for new password...',
        );

        const securityScore = createdPassword.auditData?.securityScore || 0;
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
            score: createdPassword.auditData?.passwordStrength?.score || 0,
            label:
              createdPassword.auditData?.passwordStrength?.label || 'Unknown',
            color: '#9E9E9E',
            feedback:
              createdPassword.auditData?.passwordStrength?.feedback || [],
            crackTime:
              createdPassword.auditData?.passwordStrength?.crackTime ||
              'Unknown',
            factors: createdPassword.auditData?.passwordStrength?.factors || {
              length: false,
              hasUppercase: false,
              hasLowercase: false,
              hasNumbers: false,
              hasSpecialChars: false,
              hasCommonPatterns: false,
            },
          },
          changes: ['Password created'],
        };

        await AuditHistoryService.saveAuditResult(
          createdPassword.id,
          auditData,
        );
        console.log(
          '✅ AddPasswordScreen: Audit result saved for new password',
        );
      } catch (auditError) {
        console.warn(
          '⚠️ AddPasswordScreen: Failed to save audit result:',
          auditError,
        );
        // Don't throw - audit is a secondary feature
      }

      // Clear temporary data after successful save
      try {
        await navigationPersistence.clearScreenData('AddPassword');
      } catch (error) {
        console.error('Failed to clear temp form data:', error);
      }

      // Hide loading screen
      setShowLoadingScreen(false);

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
    } catch (error: any) {
      console.error('Error creating password:', error);

      // Check if error is due to missing master password
      const errorMessage = error?.message || String(error);
      console.log(
        '🔍 AddPasswordScreen: Checking error message:',
        errorMessage,
      );
      console.log(
        '🔍 AddPasswordScreen: Error includes "Master password":',
        errorMessage.includes('Master password required'),
      );
      console.log(
        '🔍 AddPasswordScreen: Error includes "PIN unlock":',
        errorMessage.includes('PIN unlock required'),
      );
      console.log(
        '🔍 AddPasswordScreen: Error includes "not cached":',
        errorMessage.includes('not cached'),
      );

      if (
        errorMessage.includes('Master password required') ||
        errorMessage.includes('PIN unlock required') ||
        errorMessage.includes('not cached')
      ) {
        console.log(
          '✅ AddPasswordScreen: Authentication error detected - showing PIN dialog',
        );
        console.log('✅ AddPasswordScreen: Setting showPinDialog to true');
        // Store the password data and show PIN dialog
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
          accessCount: 0,
          frequencyScore: 0,
          passwordHistory: [],
          auditData: formData.password
            ? {
                passwordStrength:
                  PasswordValidationService.analyzePasswordStrength(
                    formData.password,
                  ),
                duplicateCount: 0,
                compromisedCount: 0,
                lastPasswordChange: new Date(),
                securityScore: 0,
                recommendedAction:
                  PasswordValidationService.analyzePasswordStrength(
                    formData.password,
                  ).score < 2
                    ? 'change_password'
                    : 'none',
              }
            : undefined,
        };

        setPendingSaveData(newPasswordEntry);
        setShowPinDialog(true);
      } else {
        setShowLoadingScreen(false);
        setToastType('error');
        setToastMessage(t('passwords.create_failed'));
        setShowToast(true);
        setIsSaving(false);
      }
    }
  };

  // Authentication flow for eye icon - decrypt password
  const handleDecryptPassword = useCallback(async () => {
    console.log(
      '🔐 AddPasswordScreen: Starting biometric authentication flow...',
    );

    return new Promise<string>((resolve, reject) => {
      setPinPromptResolver({ resolve, reject });
      // Trigger biometric flow - will lead to PinPrompt or FallbackModal
      setShowBiometricPrompt(true);
    });
  }, []);

  // Biometric authentication success - proceed to PIN verification
  const handleBiometricSuccess = async () => {
    setShowBiometricPrompt(false);
    setToastMessage(t('auth.biometric_verified'));
    setToastType('success');
    setShowToast(true);

    setTimeout(() => {
      setShowPinPrompt(true);
    }, 500);
  };

  // Biometric authentication error - fallback to master password + PIN
  const handleBiometricError = (error: string) => {
    setShowBiometricPrompt(false);
    setToastMessage(error || 'Authentication failed');
    setToastType('error');
    setShowToast(true);

    setTimeout(() => {
      setShowFallbackModal(true);
    }, 500);
  };

  // Biometric prompt closed by user
  const handleBiometricClose = () => {
    setShowBiometricPrompt(false);
  };

  // Biometric fallback (Master Password + PIN) success
  const handleFallbackSuccess = async (masterPassword: string) => {
    setShowFallbackModal(false);

    if (pinPromptResolver) {
      pinPromptResolver.resolve(masterPassword);
      setPinPromptResolver(null);
    }
  };

  // Biometric fallback cancelled
  const handleFallbackCancel = () => {
    setShowFallbackModal(false);
  };

  // PIN verification success (for eye icon - view password)
  const handlePinPromptSuccess = async (masterPassword: string) => {
    setShowPinPrompt(false);

    if (pinPromptResolver) {
      pinPromptResolver.resolve(masterPassword);
      setPinPromptResolver(null);
    }
  };

  const handlePinPromptCancel = () => {
    setShowPinPrompt(false);

    if (pinPromptResolver) {
      pinPromptResolver.reject();
      setPinPromptResolver(null);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <Text style={styles.headerButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {t('passwords.add_password')}
            </Text>
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
              {t('common.save')}
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
              onDecryptPassword={handleDecryptPassword}
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
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? t('passwords.saving') : t('passwords.save_password')}
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
          onCancel={() =>
            setConfirmDialog(prev => ({ ...prev, visible: false }))
          }
        />

        {/* PIN Unlock Dialog */}
        <Modal
          visible={showPinDialog}
          transparent={true}
          animationType="none"
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
                  {t('dialogs.pin_required')}
                </Text>
                <Text
                  style={[styles.pinSubtitle, { color: theme.textSecondary }]}
                >
                  {t('dialogs.enter_pin_to_save')}
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
                    placeholder={t('dialogs.enter_pin_placeholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={pin}
                    onChangeText={setPin}
                    secureTextEntry={true}
                    keyboardType="numeric"
                    maxLength={6}
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
                    style={[
                      styles.pinButtonText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t('common.cancel')}
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
                    {pinLoading ? t('dialogs.unlocking') : t('dialogs.unlock')}
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
          title={t('passwords.authenticate_to_view')}
          subtitle={t('passwords.use_biometric_to_reveal')}
        />

        {/* Layer 1B: Biometric Fallback (Master Password + PIN when biometric fails) */}
        <BiometricFallbackPrompt
          visible={showFallbackModal}
          onSuccess={handleFallbackSuccess}
          onCancel={handleFallbackCancel}
        />

        {/* Layer 2: PIN Prompt Modal (after biometric succeeds) */}
        <PinPromptModal
          visible={showPinPrompt}
          onSuccess={handlePinPromptSuccess}
          onCancel={handlePinPromptCancel}
          title={t('auth.enter_pin')}
          subtitle={t('auth.enter_pin')}
        />
      </SafeAreaView>

      {/* Loading Screen - Outside SafeAreaView for full screen */}
      <LoadingScreen visible={showLoadingScreen} />
    </>
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
