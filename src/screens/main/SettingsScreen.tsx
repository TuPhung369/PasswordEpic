import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  Modal,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { encryptedDatabase } from '../../services/encryptedDatabaseService';
import {
  deriveKeyFromPassword,
  decryptData,
} from '../../services/cryptoService';
import {
  updateSecuritySettings,
  setBiometricEnabled,
  setScreenProtectionEnabled,
  setSecurityChecksEnabled,
  setRootDetectionEnabled,
  setAntiTamperingEnabled,
  setMemoryProtectionEnabled,
  restoreSettings,
} from '../../store/slices/settingsSlice';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeSelector } from '../../components/ThemeSelector';
import { ThemeModal } from '../../components/ThemeModal';
import { AutoLockSelector } from '../../components/AutoLockSelector';
import { useTheme } from '../../contexts/ThemeContext';
import { signOut } from '../../services/authService';
import { useBiometric } from '../../hooks/useBiometric';
import BackupRestoreModal from '../../components/BackupRestoreModal';
import { backupService } from '../../services/backupService';
import { loadPasswordsLazy } from '../../store/slices/passwordsSlice';
import { getEffectiveMasterPassword } from '../../services/staticMasterPasswordService';
import { useSecurity } from '../../hooks/useSecurity';
import SecurityWarningModal from '../../components/SecurityWarningModal';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { requestStoragePermission } from '../../utils/permissionsUtils';
import {
  uploadToGoogleDrive,
  isGoogleDriveAvailable,
  requestDrivePermissions,
  ensureGoogleDriveAuthenticated,
} from '../../services/googleDriveService';
import AutofillTestService from '../../services/autofillTestService';
import FilePicker from '../../modules/FilePicker';

// Memoized SettingItem để tránh re-render
const SettingItem = React.memo<{
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  theme: any;
}>(({ icon, title, subtitle, onPress, rightElement, theme }) => (
  <TouchableOpacity
    style={[
      styles.settingItem,
      { backgroundColor: theme.card, borderColor: theme.border },
    ]}
    onPress={onPress}
  >
    <View style={[styles.settingIcon, { backgroundColor: theme.surface }]}>
      <Ionicons name={icon} size={24} color={theme.primary} />
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      )}
    </View>
    {rightElement || (
      <Ionicons
        name="chevron-forward-outline"
        size={24}
        color={theme.textSecondary}
      />
    )}
  </TouchableOpacity>
));

export const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { user } = useAppSelector((state: RootState) => state.auth);
  const { security, theme: themeMode } = useAppSelector(
    (state: RootState) => state.settings,
  );
  const { theme, isDarkMode } = useTheme();
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [securityWarningVisible, setSecurityWarningVisible] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [availableBackups, setAvailableBackups] = useState([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Icon Report Modal state
  const [showIconReportModal, setShowIconReportModal] = useState(false);
  const [iconReportData, setIconReportData] = useState<{
    summary: string;
    details: string[];
    isValid: boolean;
  }>({ summary: '', details: [], isValid: false });

  // Autofill state
  const [isCheckingAutofill, setIsCheckingAutofill] = useState(false);

  // Avatar state
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState('😊');
  const [avatarImageUri, setAvatarImageUri] = useState<string | null>(null);
  const [avatarTab, setAvatarTab] = useState<'emoji' | 'image'>('emoji');

  // Confirm dialog hook
  const { confirmDialog, showAlert, showDestructive, hideConfirm } =
    useConfirmDialog();

  // Biometric and session hooks
  const {
    isAvailable: biometricAvailable,
    biometryType,
    setupBiometric,
    disableBiometric: disableBiometricService,
  } = useBiometric();

  // Security hooks
  const {
    security: securityState,
    checkSecurity,
    enableScreenProtection,
    disableScreenProtection,
    getSecuritySummary,
  } = useSecurity();

  // Debug backup modal state
  useEffect(() => {
    console.log('🔍 showBackupModal state changed:', showBackupModal);
  }, [showBackupModal]);

  // Debug Redux state changes
  useEffect(() => {
    console.log('⚙️ [SettingsScreen] Redux security state changed:', {
      biometricEnabled: security.biometricEnabled,
      screenProtectionEnabled: security.screenProtectionEnabled,
      securityChecksEnabled: security.securityChecksEnabled,
      rootDetectionEnabled: security.rootDetectionEnabled,
      antiTamperingEnabled: security.antiTamperingEnabled,
      memoryProtectionEnabled: security.memoryProtectionEnabled,
    });
  }, [security]);

  // Force re-render when screen gains focus (to ensure UI reflects latest Redux state)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 [SettingsScreen] Screen focused, current Redux state:');
      console.log('   - biometricEnabled:', security.biometricEnabled);
      console.log(
        '   - screenProtectionEnabled:',
        security.screenProtectionEnabled,
      );
      // The component will automatically re-render because we're reading from Redux
      // This ensures the UI always reflects the latest state when user returns to this screen
    }, [security.biometricEnabled, security.screenProtectionEnabled]),
  );

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
      // console.log('⚙️ SettingsScreen: Cleaning up...');
      // Clear any pending timeouts or intervals
      // Cancel any ongoing async operations
    };
  }, []);

  // Load available backups on mount
  useEffect(() => {
    loadAvailableBackups();
  }, [loadAvailableBackups]);

  // Reload backups when modal opens
  useEffect(() => {
    console.log(
      '🔍 [SettingsScreen] showBackupModal changed:',
      showBackupModal,
    );
    if (showBackupModal) {
      console.log(
        '🔄 [SettingsScreen] Backup modal opened, reloading backups...',
      );
      console.log(
        '🔵 [SettingsScreen] About to call loadAvailableBackups()...',
      );
      try {
        loadAvailableBackups();
        console.log(
          '✅ [SettingsScreen] loadAvailableBackups() called successfully',
        );
      } catch (error) {
        console.error(
          '❌ [SettingsScreen] Error calling loadAvailableBackups():',
          error,
        );
      }
    }
  }, [showBackupModal, loadAvailableBackups]);

  useEffect(() => {
    const syncBiometricStatus = async () => {
      try {
        const { storeBiometricStatus } = await import(
          '../../services/secureStorageService'
        );
        await storeBiometricStatus(security.biometricEnabled);
        console.log(
          '✅ [SettingsScreen] Synced biometric status to SecureStorage:',
          security.biometricEnabled,
        );
      } catch (error) {
        console.error(
          '❌ [SettingsScreen] Failed to sync biometric status:',
          error,
        );
      }
    };

    syncBiometricStatus();
  }, [security.biometricEnabled]);

  useEffect(() => {
    const syncBiometricPreference = async () => {
      try {
        const AsyncStorage = (
          await import('@react-native-async-storage/async-storage')
        ).default;
        await AsyncStorage.setItem(
          'biometric_preference',
          security.biometricPreference,
        );
        console.log(
          '✅ [SettingsScreen] Synced biometric preference:',
          security.biometricPreference,
        );
      } catch (error) {
        console.error(
          '❌ [SettingsScreen] Failed to sync biometric preference:',
          error,
        );
      }
    };

    syncBiometricPreference();
  }, [security.biometricPreference]);

  // Handler functions
  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!biometricAvailable) {
        showAlert(
          'Biometric Not Available',
          'Biometric authentication is not available on this device.',
        );
        return;
      }

      try {
        // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
        // console.log('⚙️ SettingsScreen: Starting biometric setup...');
        const success = await setupBiometric();
        // console.log('⚙️ SettingsScreen: Setup result:', success);

        if (success) {
          // console.log('⚙️ SettingsScreen: Setup successful, updating Redux...');
          dispatch(setBiometricEnabled(true));
          dispatch(updateSecuritySettings({ biometricEnabled: true }));
          // console.log('⚙️ SettingsScreen: Redux states updated');
        } else {
          // console.log('⚙️ SettingsScreen: Setup failed');
        }
      } catch (error) {
        // console.error('⚙️ SettingsScreen: Setup error:', error);
        showAlert(
          'Setup Failed',
          'Failed to setup biometric authentication. Please try again.',
        );
      }
    } else {
      showDestructive(
        'Disable Biometric',
        'Are you sure you want to disable biometric authentication?',
        async () => {
          try {
            await disableBiometricService();
            dispatch(setBiometricEnabled(false));
            dispatch(updateSecuritySettings({ biometricEnabled: false }));
          } catch (error) {
            console.error('Failed to disable biometric:', error);
          }
        },
        'Disable',
      );
    }
  };

  const handleScreenProtectionToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await enableScreenProtection();
      if (success) {
        dispatch(setScreenProtectionEnabled(true));

        // Show warning if on emulator (Android only)
        if (Platform.OS === 'android') {
          showAlert(
            'Screen Protection Enabled',
            '⚠️ NOTE: Screenshot blocking does NOT work on Android emulators.\n\n' +
              'FLAG_SECURE is set correctly, but emulators bypass it for development.\n\n' +
              '✅ To test: Use a real Android device.',
          );
        }
      } else {
        showAlert(
          'Screen Protection',
          'Screen protection requires native module implementation. Feature will be available in production build.',
        );
      }
    } else {
      await disableScreenProtection();
      dispatch(setScreenProtectionEnabled(false));
    }
  };

  const handleSecurityChecksToggle = (enabled: boolean) => {
    dispatch(setSecurityChecksEnabled(enabled));
    if (enabled) {
      checkSecurity(true);
    }
  };

  const handleRootDetectionToggle = (enabled: boolean) => {
    dispatch(setRootDetectionEnabled(enabled));
  };

  const handleAntiTamperingToggle = (enabled: boolean) => {
    dispatch(setAntiTamperingEnabled(enabled));
  };

  const handleMemoryProtectionToggle = (enabled: boolean) => {
    dispatch(setMemoryProtectionEnabled(enabled));
  };

  // Autofill handlers
  const checkAutofillStatus = async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    setIsCheckingAutofill(true);
    try {
      const enabled = await AutofillTestService.isAutofillEnabled();

      if (enabled) {
        console.log(`✅ Autofill enabled: ${enabled}`);
      } else {
        console.log(`❌ Autofill disabled - suggest enabling`);
        // Show toast suggesting to enable autofill (non-intrusive)
        setToastMessage(
          '💡 Tip: Enable PasswordEpic as autofill service in Settings',
        );
        setToastType('success');
        setShowToast(true);
      }
    } catch (error) {
      console.error('❌ Error checking autofill status:', error);
    } finally {
      setIsCheckingAutofill(false);
    }
  };

  const handleLaunchAutofillTest = async () => {
    try {
      console.log('🚀 Launching autofill test with theme...');
      console.log(`📱 Current theme: ${themeMode}, isDarkMode: ${isDarkMode}`);

      // Pass theme data to native activity
      const success = await AutofillTestService.launchTestActivity(
        themeMode,
        isDarkMode,
      );
      if (success) {
        setToastMessage('✅ Test activity launched');
        setToastType('success');
        setShowToast(true);
      } else {
        setToastMessage('❌ Failed to launch test activity');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      console.error('❌ Error launching test:', error);
      setToastMessage('❌ Error launching test');
      setToastType('error');
      setShowToast(true);
    }
  };

  // Check autofill status on mount and when screen gains focus
  useEffect(() => {
    if (Platform.OS === 'android') {
      checkAutofillStatus();
    }
  }, []);

  // Refresh autofill status every time screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        console.log(
          '🔄 [SettingsScreen] Screen focused - checking autofill status...',
        );
        checkAutofillStatus();
      }
    }, []),
  );

  const handleViewSecurityStatus = async () => {
    await checkSecurity(true);
    if (securityState.threats.length > 0) {
      setSecurityWarningVisible(true);
    } else {
      const summary = await getSecuritySummary();
      showAlert('Security Status', summary);
    }
  };

  // Backup handlers
  const handleBackup = async (options: any) => {
    try {
      setIsBackupLoading(true);

      // Get master password for encryption
      console.log('🟢 [SettingsScreen] Getting master password...');
      const masterPasswordResult = await getEffectiveMasterPassword();
      if (!masterPasswordResult.success || !masterPasswordResult.password) {
        console.log('❌ [SettingsScreen] Failed to get master password');
        showAlert('Error', 'Failed to get master password for encryption');
        return;
      }
      console.log('✅ [SettingsScreen] Master password retrieved');

      // Get passwords and settings from store
      const store = require('../../store').store;
      const { passwords } = store.getState().passwords;
      const settings = store.getState().settings;

      // Prepare backup data with master password encryption
      const backupOptions = {
        includeSettings: true,
        includePasswords: true,
        includeAttachments: options.includeAttachments,
        encryptBackup: true, // Always encrypt
        compressBackup: options.compression,
        encryptionPassword: masterPasswordResult.password, // Use master password
        filename: options.filename,
      };

      console.log('🟢 [SettingsScreen] Backup options prepared (cloud-only):', {
        ...backupOptions,
        encryptionPassword: '[REDACTED]',
      });

      // Get categories for backup
      const backupCategories = Array.from(
        new Set(passwords.map((p: any) => p.category).filter(Boolean)),
      ).map((categoryName: string) => ({
        id: categoryName,
        name: categoryName,
        icon: 'folder',
        color: '#007AFF',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Debug: Log settings before backup
      console.log(
        '🔍 [SettingsScreen] Settings to backup:',
        JSON.stringify(settings, null, 2),
      );

      // Create backup in memory (temporary file for upload)
      const result = await backupService.createBackup(
        passwords,
        backupCategories,
        settings, // Use actual settings from Redux store
        backupOptions,
      );

      if (result.success && result.filePath) {
        console.log(
          '🔵 [SettingsScreen] Backup created, uploading to Google Drive...',
        );

        try {
          // Ensure Google Drive authentication
          const authResult = await ensureGoogleDriveAuthenticated();
          if (!authResult.success) {
            showAlert(
              'Google Drive Authentication Failed',
              authResult.error || 'Please sign in to Google Drive in Settings first.',
            );
            return;
          }

          // Upload to Google Drive
          const uploadResult = await uploadToGoogleDrive(
            result.filePath,
            options.filename || 'backup',
            'application/octet-stream',
          );

          if (uploadResult.success) {
            console.log(
              '✅ [SettingsScreen] Uploaded to Google Drive successfully',
            );

            // Delete local temporary file after successful upload
            try {
              const RNFS = require('react-native-fs');
              await RNFS.unlink(result.filePath);
              console.log('🗑️ [SettingsScreen] Temporary backup file deleted');
            } catch (deleteError) {
              console.warn(
                '⚠️ [SettingsScreen] Failed to delete temp file:',
                deleteError,
              );
            }

            setToastMessage('✅ Backup uploaded to Google Drive successfully');
            setToastType('success');
            setShowToast(true);

            // Close the modal
            setShowBackupModal(false);

            loadAvailableBackups();
          } else {
            throw new Error(uploadResult.error || 'Upload failed');
          }
        } catch (error: any) {
          console.error(
            '❌ [SettingsScreen] Google Drive upload error:',
            error,
          );
          showAlert(
            'Error',
            `Failed to upload to Google Drive: ${error.message || error}`,
          );
        }
      } else {
        throw new Error('Backup creation failed');
      }
    } catch (error: any) {
      console.error('❌ Backup failed:', error);
      showAlert('Error', `Failed to create backup: ${error.message || error}`);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleRestore = async (backupId: string, options: any) => {
    try {
      setIsBackupLoading(true);

      // Get master password for decryption
      console.log('🟢 [SettingsScreen] Getting master password for restore...');
      const masterPasswordResult = await getEffectiveMasterPassword();
      if (!masterPasswordResult.success || !masterPasswordResult.password) {
        console.log('❌ [SettingsScreen] Failed to get master password');
        showAlert('Error', 'Failed to get master password for decryption');
        return;
      }
      console.log('✅ [SettingsScreen] Master password retrieved for restore');

      const backup = availableBackups.find((b: any) => b.id === backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      let filePath = (backup as any).filePath;

      // If backup doesn't have a filePath, it's from Google Drive - download it first
      if (!filePath) {
        console.log(
          '🔵 [SettingsScreen] Downloading backup from Google Drive...',
        );

        let isDriveAvailable = await isGoogleDriveAvailable();
        if (!isDriveAvailable) {
          const permissionResult = await requestDrivePermissions();
          if (!permissionResult.success) {
            throw new Error('Failed to authenticate with Google Drive for backup download');
          }
        }

        const { downloadFromGoogleDrive } = await import(
          '../../services/googleDriveService'
        );
        const RNFS = await import('react-native-fs');

        // Create temporary file path
        const tempPath = `${RNFS.default.CachesDirectoryPath}/${
          (backup as any).filename
        }`;

        const downloadResult = await downloadFromGoogleDrive(
          backupId,
          tempPath,
        );

        if (!downloadResult.success) {
          throw new Error(
            downloadResult.error ||
              'Failed to download backup from Google Drive',
          );
        }

        filePath = tempPath;
        console.log('✅ [SettingsScreen] Backup downloaded to:', filePath);
      }

      const restoreOptions = {
        mergeStrategy: options.mergeWithExisting
          ? ('merge' as const)
          : ('replace' as const),
        decryptionPassword: masterPasswordResult.password, // Use master password
        restoreSettings: options.restoreSettings,
        restoreCategories: options.restoreCategories,
        restoreDomains: options.restoreDomains || false,
        overwriteDuplicates: options.overwriteDuplicates || false,
      };

      console.log(
        '🔵 [SettingsScreen] Restoring backup with master password...',
      );

      const result = await backupService.restoreFromBackup(
        filePath,
        restoreOptions,
      );

      if (result.result.success) {
        console.log('✅ [SettingsScreen] Restore successful');

        // Restore settings if requested and available
        if (options.restoreSettings && result.data?.settings) {
          console.log(
            '🔵 [SettingsScreen] Restoring settings from backup...',
            JSON.stringify(result.data.settings, null, 2),
          );
          dispatch(restoreSettings(result.data.settings));
          console.log('✅ [SettingsScreen] Settings restored');
        }

        // Restore trusted domains if requested and available
        if (options.restoreDomains && result.data?.domains) {
          console.log(
            '🔵 [SettingsScreen] Restoring trusted domains from backup...',
            `${result.data.domains.length} domains found`,
          );
          const domainsRestored = await backupService.restoreTrustedDomains(
            result.data.domains,
          );
          if (domainsRestored) {
            console.log(
              '✅ [SettingsScreen] Trusted domains restored successfully',
            );
          } else {
            console.warn(
              '⚠️ [SettingsScreen] Failed to restore trusted domains',
            );
          }
        }

        // If replace strategy, clear existing passwords first
        if (restoreOptions.mergeStrategy === 'replace') {
          console.log(
            '🗑️ [SettingsScreen] Replace mode: clearing existing passwords...',
          );
          const existingPasswords =
            await encryptedDatabase.getAllPasswordEntries(
              masterPasswordResult.password,
            );
          for (const existingEntry of existingPasswords) {
            try {
              await encryptedDatabase.deletePasswordEntry(existingEntry.id);
            } catch (deleteError) {
              console.error(
                `❌ [SettingsScreen] Failed to delete entry ${existingEntry.id}:`,
                deleteError,
              );
            }
          }
          console.log('✅ [SettingsScreen] Existing passwords cleared');
        }

        // Save restored entries to database
        if (
          result.data &&
          result.data.entries &&
          result.data.entries.length > 0
        ) {
          console.log(
            `💾 [SettingsScreen] Saving ${result.data.entries.length} restored entries to database...`,
          );

          // Get existing passwords for duplicate detection (only in merge mode)
          let existingPasswords: any[] = [];
          if (restoreOptions.mergeStrategy === 'merge') {
            existingPasswords = await encryptedDatabase.getAllPasswordEntries(
              masterPasswordResult.password,
            );
            console.log(
              `🔍 [SettingsScreen] Found ${existingPasswords.length} existing passwords for duplicate detection`,
            );
          }

          let savedCount = 0;
          let skippedCount = 0;
          let overwrittenCount = 0;

          for (const entry of result.data.entries) {
            try {
              // Check if this entry has encrypted password data from backup
              let entryToSave = entry;
              if (
                (entry as any).salt &&
                (entry as any).iv &&
                (entry as any).authTag &&
                (entry as any).isPasswordEncrypted
              ) {
                // This is an encrypted entry from backup
                // We need to decrypt it first, then re-encrypt with current format
                console.log(
                  `🔓 [SettingsScreen] Decrypting backed up entry: ${entry.title}`,
                );

                try {
                  // Decrypt the password using the master password
                  const derivedKey = deriveKeyFromPassword(
                    masterPasswordResult.password,
                    (entry as any).salt,
                  );
                  const decryptedPassword = decryptData(
                    entry.password,
                    derivedKey,
                    (entry as any).iv,
                    (entry as any).authTag,
                  );

                  // Create entry with decrypted password (remove encryption metadata)
                  entryToSave = {
                    ...entry,
                    password: decryptedPassword,
                  };
                  // Remove encryption metadata fields
                  delete (entryToSave as any).salt;
                  delete (entryToSave as any).iv;
                  delete (entryToSave as any).authTag;
                  delete (entryToSave as any).isPasswordEncrypted;

                  console.log(
                    `✅ [SettingsScreen] Successfully decrypted: ${entry.title}`,
                  );
                } catch (decryptError) {
                  console.error(
                    `❌ [SettingsScreen] Failed to decrypt entry ${entry.title}:`,
                    decryptError,
                  );
                  // Skip this entry if decryption fails
                  skippedCount++;
                  continue;
                }
              }

              // Check for duplicates (same title and username)
              const isDuplicate = existingPasswords.some(
                existing =>
                  existing.title?.toLowerCase() ===
                    entryToSave.title?.toLowerCase() &&
                  existing.username?.toLowerCase() ===
                    entryToSave.username?.toLowerCase(),
              );

              if (isDuplicate) {
                if (restoreOptions.overwriteDuplicates) {
                  // Find and delete the existing entry, then save the new one
                  const existingEntry = existingPasswords.find(
                    existing =>
                      existing.title?.toLowerCase() ===
                        entryToSave.title?.toLowerCase() &&
                      existing.username?.toLowerCase() ===
                        entryToSave.username?.toLowerCase(),
                  );
                  if (existingEntry) {
                    await encryptedDatabase.deletePasswordEntry(
                      existingEntry.id,
                    );
                    console.log(
                      `🔄 [SettingsScreen] Overwriting duplicate: ${entryToSave.title}`,
                    );
                  }
                  await encryptedDatabase.savePasswordEntry(
                    entryToSave,
                    masterPasswordResult.password,
                  );
                  overwrittenCount++;
                } else {
                  // Skip duplicate
                  console.log(
                    `⏭️ [SettingsScreen] Skipping duplicate: ${entryToSave.title}`,
                  );
                  skippedCount++;
                  continue;
                }
              } else {
                // Not a duplicate, save normally
                await encryptedDatabase.savePasswordEntry(
                  entryToSave,
                  masterPasswordResult.password,
                );
                savedCount++;
              }
            } catch (saveError) {
              console.error(
                `❌ [SettingsScreen] Failed to save entry ${entry.id}:`,
                saveError,
              );
            }
          }

          console.log(
            `✅ [SettingsScreen] Restore complete: ${savedCount} new, ${overwrittenCount} overwritten, ${skippedCount} skipped`,
          );
        }

        // Reload passwords after restore
        await dispatch(
          loadPasswordsLazy(masterPasswordResult.password),
        ).unwrap();

        const restoreInfo = [
          `${result.result.restoredEntries} passwords`,
          options.restoreSettings && result.data?.settings && 'settings',
          options.restoreDomains &&
            result.data?.domains &&
            `${result.data.domains.length} trusted domains`,
        ]
          .filter(Boolean)
          .join(', ');

        showAlert('Success', `✅ Successfully restored ${restoreInfo}`);

        // Close the modal
        setShowBackupModal(false);
      } else {
        throw new Error('Restore failed');
      }
    } catch (error: any) {
      console.error('❌ Restore failed:', error);
      showAlert('Error', `Failed to restore backup: ${error.message || error}`);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      console.log('🗑️ [SettingsScreen] Deleting backup:', backupId);

      // Import Google Drive service
      const { deleteFromGoogleDrive } = await import(
        '../../services/googleDriveService'
      );

      // Delete from Google Drive
      const deleteResult = await deleteFromGoogleDrive(backupId);

      if (!deleteResult.success) {
        throw new Error(
          deleteResult.error || 'Failed to delete backup from Google Drive',
        );
      }

      console.log('✅ [SettingsScreen] Backup deleted successfully');

      // Reload available backups
      await loadAvailableBackups();
    } catch (error: any) {
      console.error('❌ Delete backup failed:', error);
      throw error; // Re-throw to be handled by the modal
    }
  };

  const loadAvailableBackups = useCallback(async () => {
    console.log('🔵 [loadAvailableBackups] Function called!');
    try {
      console.log('📂 [loadAvailableBackups] Loading available backups...');

      // Check if Google Drive is available
      const isDriveAvailable = await isGoogleDriveAvailable();
      console.log(
        '🔵 [loadAvailableBackups] Google Drive available:',
        isDriveAvailable,
      );

      if (isDriveAvailable) {
        // Ensure authentication before calling Google Drive API
        const authResult = await ensureGoogleDriveAuthenticated();
        if (!authResult.success) {
          console.warn(
            '⚠️ [loadAvailableBackups] Authentication failed:',
            authResult.error,
          );
          setAvailableBackups([]);
          return;
        }

        // Load backups from Google Drive
        console.log(
          '🔵 [loadAvailableBackups] Importing listGoogleDriveBackups...',
        );
        const { listGoogleDriveBackups } = await import(
          '../../services/googleDriveService'
        );
        console.log(
          '🔵 [loadAvailableBackups] Calling listGoogleDriveBackups...',
        );
        const driveResult = await listGoogleDriveBackups();
        console.log('🔵 [loadAvailableBackups] Drive result:', driveResult);

        if (driveResult.success && driveResult.files) {
          console.log(
            '✅ [loadAvailableBackups] Loaded Google Drive backups:',
            driveResult.files.length,
            'items',
          );
          console.log(
            '🔵 [loadAvailableBackups] Files:',
            JSON.stringify(driveResult.files, null, 2),
          );

          // Convert Google Drive files to BackupInfo format
          const backups = await Promise.all(
            driveResult.files
              .filter(
                file =>
                  file.name.endsWith('.bak') || file.name.endsWith('.backup'),
              )
              .map(async file => {
                try {
                  // Download file to extract metadata
                  const { downloadFromGoogleDrive } = await import(
                    '../../services/googleDriveService'
                  );
                  const RNFS = await import('react-native-fs').then(m => m.default);
                  
                  const tempPath = RNFS.CachesDirectoryPath || RNFS.TemporaryDirectoryPath;
                  const tempFile = `${tempPath}/backup_${file.id}.tmp`;
                  
                  const downloadResult = await downloadFromGoogleDrive(
                    file.id,
                    tempFile,
                  );

                  if (!downloadResult.success) {
                    console.warn(`Failed to download backup metadata for ${file.name}`);
                    return {
                      id: file.id,
                      filename: file.name,
                      createdAt: new Date(file.createdTime),
                      size: parseInt(file.size || '0', 10),
                      entryCount: 0,
                      categoryCount: 0,
                      encrypted: true,
                      version: '1.0',
                      appVersion: '1.0.0',
                    };
                  }

                  // Extract metadata from downloaded file
                  const fileContent = await RNFS.readFile(tempFile, 'utf8');
                  const metadata = await backupService.extractBackupMetadata(fileContent);
                  
                  // Clean up temp file
                  try {
                    await RNFS.unlink(tempFile);
                  } catch (e) {
                    console.warn('Failed to cleanup temp file:', e);
                  }

                  return {
                    id: file.id,
                    filename: file.name,
                    createdAt: new Date(file.createdTime),
                    size: parseInt(file.size || '0', 10),
                    entryCount: metadata?.entryCount || 0,
                    categoryCount: metadata?.categoryCount || 0,
                    encrypted: true,
                    version: metadata?.appVersion || '1.0',
                    appVersion: metadata?.appVersion || '1.0.0',
                  };
                } catch (error) {
                  console.error(`Error processing backup ${file.name}:`, error);
                  return {
                    id: file.id,
                    filename: file.name,
                    createdAt: new Date(file.createdTime),
                    size: parseInt(file.size || '0', 10),
                    entryCount: 0,
                    categoryCount: 0,
                    encrypted: true,
                    version: '1.0',
                    appVersion: '1.0.0',
                  };
                }
              }),
          );

          console.log(
            '🔵 [loadAvailableBackups] Converted backups:',
            backups.length,
            'items',
          );
          console.log(
            '🔵 [loadAvailableBackups] Setting availableBackups state...',
          );
          setAvailableBackups(backups as any);
          console.log('✅ [loadAvailableBackups] State updated successfully');
        } else {
          console.log(
            '⚠️ [loadAvailableBackups] No backups found on Google Drive',
          );
          console.log('🔵 [loadAvailableBackups] Drive result details:', {
            success: driveResult.success,
            hasFiles: !!driveResult.files,
            filesLength: driveResult.files?.length,
            error: driveResult.error,
          });
          setAvailableBackups([]);
        }
      } else {
        // Fallback to local backups if Google Drive is not available
        console.log('📂 [loadAvailableBackups] Loading local backups...');
        const backups = await backupService.listBackups();
        console.log(
          '✅ [loadAvailableBackups] Loaded local backups:',
          backups?.length || 0,
          'items',
        );
        setAvailableBackups(backups as any);
      }
    } catch (error) {
      console.error('❌ [loadAvailableBackups] Failed to load backups:', error);
      setAvailableBackups([]); // Set empty array on error
    }
    console.log('🔵 [loadAvailableBackups] Function completed');
  }, []);

  const handleClearCorruptedData = async () => {
    showDestructive(
      '🧹 Clean Corrupted Entries',
      'This will remove only the password entries that cannot be decrypted due to encryption inconsistencies.\n\nValid entries will be preserved. This should fix your "Authentication tag verification failed" errors.',
      async () => {
        try {
          // Import the cleanup function
          const { runCleanupProcess } = await import(
            '../../scripts/cleanCorruptedEntries'
          );

          console.log('🧹 Starting corrupted entries cleanup...');
          const report = await runCleanupProcess();

          showAlert(
            '✅ Cleanup Complete',
            'Corrupted entries have been removed. Your app should now work normally without decryption errors.',
          );

          console.log('📋 Cleanup Report:', report);
        } catch (error: any) {
          console.error('Failed to clear corrupted data:', error);
          showAlert('❌ Error', `An error occurred: ${error.message}`);
        }
      },
      'Clean Now',
    );
  };

  const handleResetCategories = async () => {
    showDestructive(
      '🔄 Reset Categories with Fixed Icons',
      'This will reset all categories to default settings with corrected Ionicons names. Custom categories will be removed.\n\nYour passwords will NOT be affected.\n\nThis fixes the missing icons issue in Category selector.',
      async () => {
        try {
          console.log('🔄 User requested to reset categories with fixed icons');

          // Import and run the comprehensive reset script
          const { ResetCategoriesScript } = await import(
            '../../scripts/resetCategoriesWithFixedIcons'
          );

          // Create backup first
          await ResetCategoriesScript.backupCurrentCategories();

          // Execute reset with fixed icons
          const result = await ResetCategoriesScript.execute();

          if (result.success) {
            showAlert(
              '✅ Success',
              `Categories reset successfully!\n\n${result.message}\n\nCategories updated: ${result.categoriesReset}`,
            );
          } else {
            showAlert(
              '⚠️ Partial Success',
              `Reset completed but with issues:\n\n${
                result.message
              }\n\nErrors: ${result.errors.join(', ')}`,
            );
          }
        } catch (error: any) {
          console.error('Failed to reset categories:', error);
          showAlert('❌ Error', `An error occurred: ${error.message}`);
        }
      },
      'Reset & Fix Icons',
    );
  };

  const handleLogout = async () => {
    try {
      // Sign out from Firebase and Google
      await signOut();
      // Redux state will be updated automatically via auth state listener
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: dispatch logout action directly
      dispatch(logout());
    }
  };

  // Image picker handler
  const handlePickImage = async () => {
    try {
      if (Platform.OS === 'android') {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          showAlert(
            'Permission Denied',
            'Storage permission is required to pick images.',
          );
          return;
        }
      }

      const filePath = await FilePicker.pickFile();
      if (filePath) {
        console.log('📸 Image picked:', filePath);
        setAvatarImageUri(filePath);
        // Don't close modal, let user see the preview
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      showAlert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Camera capture handler (for future implementation with react-native-camera)
  const handleCapturePhoto = () => {
    Alert.alert(
      'Coming Soon',
      'Camera capture feature will be available in a future update.',
      [{ text: 'OK' }],
    );
  };

  // Clear avatar handler
  const handleClearAvatar = () => {
    setAvatarImageUri(null);
    setAvatarEmoji('😊');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>⚙️ Settings</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Manage your security preferences
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.settingsContentContainer}
      >
        {/* User Profile */}
        <View style={styles.section}>
          <View
            style={[
              styles.userProfile,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => setShowAvatarModal(true)}
              style={[styles.avatar, { backgroundColor: theme.surface }]}
              activeOpacity={0.7}
            >
              {avatarImageUri ? (
                <Image
                  source={{ uri: avatarImageUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
              )}
              <View
                style={[styles.cameraIcon, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="camera" size={9} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {user?.displayName || 'User'}
              </Text>
              <Text
                style={[styles.userEmail, { color: theme.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {user?.email || 'No email available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Security
          </Text>

          <SettingItem
            icon="finger-print"
            title="Biometric Authentication"
            subtitle={
              biometricAvailable
                ? `Use ${biometryType.toLowerCase()}`
                : 'Not available on this device'
            }
            theme={theme}
            rightElement={
              <Switch
                key={`biometric-${security.biometricEnabled}`}
                value={security.biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.biometricEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          {security.biometricEnabled && biometricAvailable && Platform.OS === 'ios' && (
            <View
              style={[
                styles.settingItem,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View
                style={[styles.settingIcon, { backgroundColor: theme.surface }]}
              >
                <Ionicons name="options-outline" size={24} color={theme.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  Biometric Preference
                </Text>
                <Text
                  style={[styles.settingSubtitle, { color: theme.textSecondary }]}
                >
                  {security.biometricPreference === 'fingerprint'
                    ? 'Prefer Fingerprint'
                    : security.biometricPreference === 'face'
                    ? 'Prefer Face ID'
                    : 'Use Any Available'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const currentIndex =
                    security.biometricPreference === 'fingerprint'
                      ? 1
                      : security.biometricPreference === 'face'
                      ? 2
                      : 0;
                  const nextIndex = (currentIndex + 1) % 3;
                  const nextPref =
                    nextIndex === 1
                      ? 'fingerprint'
                      : nextIndex === 2
                      ? 'face'
                      : 'any';
                  dispatch(
                    updateSecuritySettings({ biometricPreference: nextPref }),
                  );
                }}
                style={styles.preferenceButton}
              >
                <Text style={[styles.preferenceButtonText, { color: theme.primary }]}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <SettingItem
            icon="key-outline"
            title="Autofill Management"
            subtitle="Configure autofill settings and trusted domains"
            theme={theme}
            onPress={() => {
              // Navigate to Autofill Management Screen
              // @ts-ignore - Navigation will be added
              navigation.navigate('AutofillManagement');
            }}
          />

          {/* Auto Lock Selector */}
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.settingIcon, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="time-outline" size={24} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                Auto-Lock
              </Text>
              <Text
                style={[styles.settingSubtitle, { color: theme.textSecondary }]}
              >
                Automatically lock app after inactivity
              </Text>
            </View>
            <AutoLockSelector
              currentValue={security.autoLockTimeout}
              onValueChange={value => {
                dispatch(updateSecuritySettings({ autoLockTimeout: value }));
                // Note: Session timeout is fixed at 7 days, this only affects biometric auto-lock
              }}
            />
          </View>

          <SettingItem
            icon="shield-checkmark-outline"
            title="Screen Protection"
            subtitle="Prevent screenshots and screen recording"
            theme={theme}
            rightElement={
              <Switch
                key={`screen-protection-${security.screenProtectionEnabled}`}
                value={security.screenProtectionEnabled}
                onValueChange={handleScreenProtectionToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.screenProtectionEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />
        </View>

        {/* Advanced Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Advanced Security
          </Text>

          <SettingItem
            icon="shield-checkmark-outline"
            title="Security Checks"
            subtitle="Detect root, jailbreak, and tampering"
            theme={theme}
            rightElement={
              <Switch
                key={`security-checks-${security.securityChecksEnabled}`}
                value={security.securityChecksEnabled}
                onValueChange={handleSecurityChecksToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.securityChecksEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="phone-portrait-outline"
            title="Root Detection"
            subtitle="Block app on rooted/jailbroken devices"
            theme={theme}
            rightElement={
              <Switch
                key={`root-detection-${security.rootDetectionEnabled}`}
                value={security.rootDetectionEnabled}
                onValueChange={handleRootDetectionToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.rootDetectionEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="shield-outline"
            title="Anti-Tampering"
            subtitle="Detect app modifications and hooks"
            theme={theme}
            rightElement={
              <Switch
                key={`anti-tampering-${security.antiTamperingEnabled}`}
                value={security.antiTamperingEnabled}
                onValueChange={handleAntiTamperingToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.antiTamperingEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="hardware-chip-outline"
            title="Memory Protection"
            subtitle="Secure sensitive data in memory"
            theme={theme}
            rightElement={
              <Switch
                key={`memory-protection-${security.memoryProtectionEnabled}`}
                value={security.memoryProtectionEnabled}
                onValueChange={handleMemoryProtectionToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.memoryProtectionEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="information-circle-outline"
            title="Security Status"
            subtitle={
              securityState.isSecure
                ? '✅ Secure'
                : `⚠️ ${securityState.threats.length} threat(s)`
            }
            theme={theme}
            onPress={handleViewSecurityStatus}
          />
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            General
          </Text>

          <ThemeSelector onPress={() => setThemeModalVisible(true)} />

          <SettingItem
            icon="language-outline"
            title="Language"
            subtitle="English"
            theme={theme}
            onPress={() => {}}
          />

          <SettingItem
            icon="cloud-upload-outline"
            title="Backup & Restore"
            subtitle="Manage your encrypted backups"
            theme={theme}
            onPress={() => {
              console.log('🚀 Backup & Restore button pressed!');
              console.log('📊 Current state:', {
                showBackupModal,
                availableBackups: availableBackups.length,
                isBackupLoading,
              });
              setShowBackupModal(true);
              console.log('✅ Modal should now be visible');
            }}
          />
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Support
          </Text>

          <SettingItem
            icon="help-circle-outline"
            title="Help & Support"
            theme={theme}
            onPress={() => {}}
          />

          <SettingItem
            icon="eye-off-outline"
            title="Privacy Policy"
            theme={theme}
            onPress={() => {}}
          />

          <SettingItem
            icon="information-circle-outline"
            title="About"
            subtitle="Version 1.0.0"
            theme={theme}
            onPress={() => {}}
          />
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.error }]}>
            Danger Zone
          </Text>

          <SettingItem
            icon="refresh-outline"
            title="Fix Category Icons"
            subtitle="Reset categories with corrected Ionicons (fixes missing icons)"
            theme={theme}
            onPress={handleResetCategories}
            rightElement={
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={theme.primary}
              />
            }
          />

          {__DEV__ && (
            <SettingItem
              icon="bug-outline"
              title="Test Category Icons"
              subtitle="Debug: Test if category icons are valid"
              theme={theme}
              onPress={async () => {
                try {
                  const { CompleteIconFixScript } = await import(
                    '../../scripts/completeIconFixScript'
                  );
                  await CompleteIconFixScript.testAllCategoryIcons();
                  const report =
                    await CompleteIconFixScript.generateCompactReport();
                  setIconReportData(report);
                  setShowIconReportModal(true);
                } catch (error: any) {
                  showAlert('❌ Error', `Debug failed: ${error.message}`);
                }
              }}
              rightElement={
                <Ionicons name="bug-outline" size={24} color={theme.primary} />
              }
            />
          )}

          <SettingItem
            icon="trash-outline"
            title="Clear Corrupted Data"
            subtitle="Delete all encrypted passwords (use if decryption fails)"
            theme={theme}
            onPress={handleClearCorruptedData}
            rightElement={
              <Ionicons
                name="warning-outline"
                size={24}
                color={theme.warning}
              />
            }
          />
        </View>

        {/* Autofill Settings - Android Only */}
        {Platform.OS === 'android' && (
          <View style={styles.section}>
            <SettingItem
              icon="flask-outline"
              title="Test Autofill"
              subtitle="Open test screen with login form to verify autofill works"
              onPress={handleLaunchAutofillTest}
              theme={theme}
              rightElement={
                <Ionicons
                  name="play-outline"
                  size={24}
                  color={
                    isCheckingAutofill ? theme.textSecondary : theme.primary
                  }
                />
              }
            />
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: theme.card, borderColor: theme.error },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color={theme.error} />
          <Text style={[styles.logoutText, { color: theme.error }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ThemeModal
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
      />

      <SecurityWarningModal
        visible={securityWarningVisible}
        threats={securityState.threats}
        onClose={() => setSecurityWarningVisible(false)}
        allowContinue={true}
        onContinueAnyway={() => setSecurityWarningVisible(false)}
      />

      <BackupRestoreModal
        visible={showBackupModal}
        onClose={() => {
          console.log('🔴 Backup modal close requested');
          setShowBackupModal(false);
        }}
        onBackup={handleBackup}
        onRestore={handleRestore}
        onDeleteBackup={handleDeleteBackup}
        availableBackups={availableBackups}
        isLoading={isBackupLoading}
        onRefreshBackups={loadAvailableBackups}
        onShowToast={(message: string, type: 'success' | 'error') => {
          setToastMessage(message);
          setToastType(type);
          setShowToast(true);
        }}
      />

      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        onHide={() => setShowToast(false)}
      />

      <ConfirmDialog {...confirmDialog} onCancel={hideConfirm} />

      {/* Icon Report Modal */}
      <Modal
        visible={showIconReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowIconReportModal(false)}
      >
        <View style={[styles.modalOverlay, styles.modalOverlayDark]}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {/* Header */}
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                📋 Category Icons Status
              </Text>
              <TouchableOpacity onPress={() => setShowIconReportModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Summary */}
            <View
              style={[
                styles.summarySectionModal,
                {
                  backgroundColor: iconReportData.isValid
                    ? theme.success
                    : theme.error,
                },
              ]}
            >
              <Text style={[styles.summaryText, styles.summaryTextWhite]}>
                {iconReportData.summary}
              </Text>
            </View>

            {/* Details List */}
            <FlatList
              data={iconReportData.details}
              keyExtractor={(item, index) => `icon-${index}`}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.detailItem,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.detailText, { color: theme.text }]}>
                    {item}
                  </Text>
                </View>
              )}
              scrollEnabled={true}
              style={styles.detailsList}
            />

            {/* Footer */}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowIconReportModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={[styles.modalOverlay, styles.modalOverlayDark]}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {/* Header */}
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                👤 Choose Avatar
              </Text>
              <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                <Ionicons
                  name="close-outline"
                  size={24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Tab Buttons */}
            <View
              style={[styles.tabContainer, { borderBottomColor: theme.border }]}
            >
              <TouchableOpacity
                onPress={() => setAvatarTab('emoji')}
                style={[
                  styles.tabButton,
                  avatarTab === 'emoji' && {
                    backgroundColor: theme.primary + '20',
                    borderBottomColor: theme.primary,
                  },
                  avatarTab === 'emoji' && styles.tabButtonActiveBorder,
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        avatarTab === 'emoji'
                          ? theme.primary
                          : theme.textSecondary,
                    },
                  ]}
                >
                  😊 Emoji
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAvatarTab('image')}
                style={[
                  styles.tabButton,
                  avatarTab === 'image' && {
                    backgroundColor: theme.primary + '20',
                    borderBottomColor: theme.primary,
                  },
                  avatarTab === 'image' && styles.tabButtonActiveBorder,
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        avatarTab === 'image'
                          ? theme.primary
                          : theme.textSecondary,
                    },
                  ]}
                >
                  🖼️ Photo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Emoji Tab Content */}
            {avatarTab === 'emoji' && (
              <View style={styles.emojiGridContainer}>
                <FlatList
                  data={[
                    '😊',
                    '😎',
                    '🤓',
                    '😍',
                    '🥰',
                    '😂',
                    '🤔',
                    '😜',
                    '🧠',
                    '💪',
                    '🚀',
                    '⭐',
                    '🎓',
                    '👨‍💼',
                    '👩‍💼',
                    '🐱',
                    '🐶',
                    '🦊',
                    '🌟',
                    '💎',
                    '🔥',
                    '🎨',
                    '🎭',
                    '🎵',
                  ]}
                  numColumns={6}
                  scrollEnabled={true}
                  nestedScrollEnabled={true}
                  keyExtractor={(item, index) => `emoji-${index}`}
                  renderItem={({ item: emoji }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setAvatarEmoji(emoji);
                        setAvatarImageUri(null); // Clear image when selecting emoji
                        setShowAvatarModal(false);
                      }}
                      style={[
                        styles.emojiItem,
                        avatarEmoji === emoji &&
                          avatarImageUri === null && {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          },
                      ]}
                    >
                      <Text style={styles.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Image Tab Content */}
            {avatarTab === 'image' && (
              <View style={styles.imageTabContainer}>
                {avatarImageUri && (
                  <View style={styles.imagePreviewContainer}>
                    <Text style={[styles.previewLabel, { color: theme.text }]}>
                      Preview:
                    </Text>
                    <Image
                      source={{ uri: avatarImageUri }}
                      style={[
                        styles.imagePreview,
                        { borderColor: theme.border },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.imageButtonsContainer}>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    style={[
                      styles.imageActionButton,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <Ionicons name="image-outline" size={20} color="#fff" />
                    <Text style={styles.imageActionButtonText}>
                      Choose from Gallery
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCapturePhoto}
                    style={[
                      styles.imageActionButton,
                      { backgroundColor: theme.primary + '70' },
                    ]}
                  >
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={styles.imageActionButtonText}>Take Photo</Text>
                  </TouchableOpacity>

                  {avatarImageUri && (
                    <TouchableOpacity
                      onPress={handleClearAvatar}
                      style={[styles.imageActionButton, styles.clearButton]}
                    >
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.imageActionButtonText}>
                        Clear Avatar
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowAvatarModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiGridContainer: {
    flex: 1,
    padding: 16,
  },
  emojiItem: {
    flex: 1 / 6,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emoji: {
    fontSize: 28,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  debugModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 1000,
  },
  debugModalContent: {
    flex: 1,
    marginTop: 50,
  },
  debugCloseButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 1001,
    borderRadius: 20,
    padding: 8,
  },
  // Icon Report Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    flex: 1,
    minHeight: 500,
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  summarySectionModal: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailsList: {
    maxHeight: 300,
    marginTop: 12,
  },
  detailItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  closeButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Avatar Image Styles
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    resizeMode: 'cover',
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Image Tab Styles
  imageTabContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  preferenceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  preferenceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    resizeMode: 'cover',
  },
  imageButtonsContainer: {
    gap: 12,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  imageActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Settings Content Container
  settingsContentContainer: {
    paddingBottom: 10,
  },
  // Modal Overlay with dark background
  modalOverlayDark: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  // Summary text white
  summaryTextWhite: {
    color: '#fff',
  },
  // Tab button active border
  tabButtonActiveBorder: {
    borderBottomWidth: 2,
  },
  // Clear button red background
  clearButton: {
    backgroundColor: '#EF4444',
  },
});
