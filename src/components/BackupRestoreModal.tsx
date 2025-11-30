import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { useTheme } from '../contexts/ThemeContext';

interface BackupInfo {
  id: string;
  filename: string;
  createdAt: Date;
  size: number;
  entryCount: number;
  categoryCount: number;
  encrypted: boolean;
  version: string;
  appVersion: string;
  deviceInfo?: {
    platform: string;
    version: string;
  };
}

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
  onBackup: (options: BackupOptions) => void;
  onRestore: (backupId: string, options: RestoreOptions) => void;
  onDeleteBackup?: (backupId: string) => Promise<void>;
  availableBackups: BackupInfo[];
  isLoading?: boolean;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  onRefreshBackups?: () => void;
  onRequestAuth?: (mode: 'backup' | 'restore') => void;
}

export interface BackupOptions {
  includeMetadata: boolean;
  includeAttachments: boolean;
  includeHistory: boolean;
  encrypt: boolean;
  encryptionPassword?: string;
  compression: boolean;
  filename?: string;
  uploadToGoogleDrive?: boolean;
}

export interface RestoreOptions {
  mergeWithExisting: boolean;
  overwriteDuplicates: boolean;
  restoreCategories: boolean;
  restoreSettings: boolean;
  restoreDomains: boolean;
  encryptionPassword?: string;
}

type TabType = 'backup' | 'restore';

const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  visible,
  onClose,
  onBackup,
  onRestore,
  onDeleteBackup,
  availableBackups,
  isLoading = false,
  onRefreshBackups,
  onRequestAuth,
}) => {
  // Debug logging
  React.useEffect(() => {
    console.log('🔍 BackupRestoreModal props:', {
      visible,
      availableBackupsCount: availableBackups.length,
      isLoading,
    });
  }, [visible, availableBackups.length, isLoading]);

  // Use theme from context
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(theme);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('backup');
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [showBackupDetails, setShowBackupDetails] = useState(false);
  const [showBackupList, setShowBackupList] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedBackupsForDeletion, setSelectedBackupsForDeletion] = useState<
    Set<string>
  >(new Set());
  const [localBackupLoading, setLocalBackupLoading] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Confirm dialog state
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

  // Backup options - simplified (all features enabled by default)
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    includeMetadata: true,
    includeAttachments: true,
    includeHistory: true,
    encrypt: true,
    encryptionPassword: '', // Will be set to master password automatically
    compression: true,
    filename: '',
    uploadToGoogleDrive: true, // Default to true since we only backup to cloud
  });

  // Restore options
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    mergeWithExisting: true,
    overwriteDuplicates: false,
    restoreCategories: true,
    restoreSettings: true, // Enable by default to restore app settings
    restoreDomains: true, // Enable by default to restore trusted domains
    encryptionPassword: '',
  });

  // Generate default filename when modal opens or tab changes to backup
  useEffect(() => {
    if (visible && activeTab === 'backup') {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
      setBackupOptions(prev => ({
        ...prev,
        filename: `PasswordEpic_${dateStr}_${timeStr}.bak`,
      }));
    }
  }, [visible, activeTab]);

  // Reset to backup tab when modal opens
  React.useEffect(() => {
    if (visible) {
      console.log('✅ BackupRestoreModal is now visible!');
      console.log('🔵 [BackupModal] Active tab:', activeTab);
      // Reset to backup tab ONLY when modal first opens
      setActiveTab('backup');
    } else {
      console.log('❌ BackupRestoreModal is hidden');
      setLocalBackupLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Sync local backup loading state with parent isLoading prop
  useEffect(() => {
    setLocalBackupLoading(isLoading);
  }, [isLoading]);

  // Handle tab changes
  React.useEffect(() => {
    console.log('🔵 [BackupModal] Active tab changed to:', activeTab);

    if (activeTab === 'restore') {
      // Refresh backups when switching to restore tab
      if (onRefreshBackups) {
        console.log('🔄 [BackupModal] Refreshing backups for restore tab');
        onRefreshBackups();
      }
      if (typeof onRequestAuth === 'function') {
        onRequestAuth('restore');
      }
    } else if (activeTab === 'backup') {
      // Clear selection when switching to backup tab
      setSelectedBackup(null);
      if (typeof onRequestAuth === 'function') {
        onRequestAuth('backup');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-select latest backup when availableBackups updates
  React.useEffect(() => {
    if (activeTab === 'restore' && availableBackups.length > 0) {
      // Sort backups by createdAt (newest first)
      const sortedBackups = [...availableBackups].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const latestBackup = sortedBackups[0];

      console.log(
        '🔵 [BackupModal] Auto-selecting latest backup:',
        latestBackup.filename,
      );
      setSelectedBackup(latestBackup);
    }
  }, [activeTab, availableBackups]);

  // Reset multi-select mode when backup list is closed
  React.useEffect(() => {
    if (!showBackupList) {
      setMultiSelectMode(false);
      setSelectedBackupsForDeletion(new Set());
    }
  }, [showBackupList]);

  // Handlers
  const handleBackupOptionChange = (key: keyof BackupOptions, value: any) => {
    setBackupOptions(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRestoreOptionChange = (key: keyof RestoreOptions, value: any) => {
    setRestoreOptions(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleCreateBackup = () => {
    if (typeof onRequestAuth === 'function') {
      onRequestAuth('backup');
    }
    console.log('🔵 [BackupModal] handleCreateBackup called');
    console.log('🔵 [BackupModal] Backup options:', backupOptions);

    // Validation - no need to check encryption password (will use master password)
    if (!backupOptions.filename?.trim()) {
      console.log('❌ [BackupModal] Validation failed: Missing filename');
      setConfirmDialog({
        visible: true,
        title: t('backup_restore.error'),
        message: t('backup_restore.enter_filename'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    console.log('✅ [BackupModal] Validation passed, calling onBackup');
    setLocalBackupLoading(true);
    onBackup(backupOptions);
  };

  const handleRestoreBackup = () => {
    if (typeof onRequestAuth === 'function') {
      onRequestAuth('restore');
    }
    if (!selectedBackup) {
      setConfirmDialog({
        visible: true,
        title: t('backup_restore.error'),
        message: t('backup_restore.select_backup_error'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    // No need to check encryption password - will use master password automatically

    setConfirmDialog({
      visible: true,
      title: t('backup_restore.restore_backup_title'),
      message: t('backup_restore.restore_backup_confirm', {
        filename: selectedBackup.filename,
        mergeInfo: restoreOptions.mergeWithExisting
          ? t('backup_restore.merge_info')
          : t('backup_restore.replace_info'),
      }),
      confirmText: t('backup_restore.restore'),
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        onRestore(selectedBackup.id, restoreOptions);
      },
    });
  };

  const handleDeleteBackup = async (backup: BackupInfo) => {
    if (!onDeleteBackup) return;

    setConfirmDialog({
      visible: true,
      title: t('backup_restore.delete_backup'),
      message: t('backup_restore.delete_backup_confirm', {
        filename: backup.filename,
      }),
      confirmText: t('common.delete'),
      confirmStyle: 'destructive',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        try {
          setDeletingBackupId(backup.id);
          await onDeleteBackup(backup.id);

          // If deleted backup was selected, clear selection
          if (selectedBackup?.id === backup.id) {
            setSelectedBackup(null);
          }

          // Show success notification via internal toast
          setToastMessage(
            t('backup_restore.delete_success', { filename: backup.filename }),
          );
          setToastType('success');
          setShowToast(true);
        } catch (error) {
          console.error('Failed to delete backup:', error);

          // Show error via internal toast
          setToastMessage(t('backup_restore.delete_failed'));
          setToastType('error');
          setShowToast(true);
        } finally {
          setDeletingBackupId(null);
        }
      },
    });
  };

  const handleToggleBackupSelection = (backupId: string) => {
    setSelectedBackupsForDeletion(prev => {
      const newSet = new Set(prev);
      if (newSet.has(backupId)) {
        newSet.delete(backupId);
      } else {
        newSet.add(backupId);
      }
      return newSet;
    });
  };

  const handleDeleteMultipleBackups = async () => {
    if (!onDeleteBackup || selectedBackupsForDeletion.size === 0) return;

    const count = selectedBackupsForDeletion.size;
    setConfirmDialog({
      visible: true,
      title: t('backup_restore.delete_multiple_title'),
      message: t('backup_restore.delete_multiple_confirm', { count }),
      confirmText: t('common.delete'),
      confirmStyle: 'destructive',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        // Close backup list immediately for better UX
        setShowBackupList(false);

        try {
          const backupIds = Array.from(selectedBackupsForDeletion);

          // Delete all selected backups
          for (const backupId of backupIds) {
            setDeletingBackupId(backupId);
            await onDeleteBackup(backupId);

            // If deleted backup was selected, clear selection
            if (selectedBackup?.id === backupId) {
              setSelectedBackup(null);
            }
          }

          // Clear multi-select state
          setSelectedBackupsForDeletion(new Set());
          setMultiSelectMode(false);

          // Show success notification via internal toast
          setToastMessage(
            t('backup_restore.delete_multiple_success', { count }),
          );
          setToastType('success');
          setShowToast(true);
        } catch (error) {
          console.error('Failed to delete backups:', error);

          // Show error via internal toast
          setToastMessage(t('backup_restore.delete_multiple_failed'));
          setToastType('error');
          setShowToast(true);
        } finally {
          setDeletingBackupId(null);
        }
      },
    });
  };

  const handleCancelMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedBackupsForDeletion(new Set());
    setShowBackupList(false); // Close the backup list and return to selected backup view
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | undefined | null): string => {
    if (!date || typeof date.toLocaleDateString !== 'function') return '';
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'backup' && styles.activeTab]}
        onPress={() => setActiveTab('backup')}
      >
        <Icon
          name="cloud-upload-outline"
          size={18}
          color={activeTab === 'backup' ? theme.primary : theme.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'backup' && styles.activeTabText,
          ]}
        >
          {t('backup_restore.backup')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'restore' && styles.activeTab]}
        onPress={() => setActiveTab('restore')}
      >
        <Icon
          name="cloud-download-outline"
          size={18}
          color={activeTab === 'restore' ? theme.primary : theme.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'restore' && styles.activeTabText,
          ]}
        >
          {t('backup_restore.restore')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSwitchOption = (
    title: string,
    subtitle: string,
    value: boolean,
    onToggle: (value: boolean) => void,
  ) => (
    <View style={styles.optionRow}>
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity
        style={[styles.switch, value && styles.switchActive]}
        onPress={() => onToggle(!value)}
      >
        <View style={[styles.switchThumb, value && styles.switchThumbActive]} />
      </TouchableOpacity>
    </View>
  );

  const renderBackupFeatureItem = (
    icon: string,
    title: string,
    subtitle: string,
  ) => (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Icon name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
      <Icon name="checkmark-circle" size={20} color={theme.success} />
    </View>
  );

  const renderBackupTab = () => {
    console.log('🔵 [BackupModal] renderBackupTab called');
    console.log('🔵 [BackupModal] Backup options:', backupOptions);
    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backupHeaderSection}>
          <View style={styles.backupHeaderIcon}>
            <Icon name="cloud-upload-outline" size={32} color={theme.primary} />
          </View>
          <Text style={styles.backupHeaderTitle}>
            {t('backup_restore.backup_to_google_drive')}
          </Text>
          <Text style={styles.backupHeaderSubtitle}>
            {t('backup_restore.secure_data_description')}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t('backup_restore.backup_filename')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={backupOptions.filename}
              onChangeText={value =>
                handleBackupOptionChange('filename', value)
              }
              placeholder="PasswordEpic_YYYY-MM-DD_HHMMSS.bak"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('backup_restore.whats_included')}
          </Text>
          <View style={styles.featuresList}>
            {renderBackupFeatureItem(
              'key-outline',
              t('backup_restore.all_passwords'),
              t('backup_restore.complete_password_vault'),
            )}
            {renderBackupFeatureItem(
              'folder-outline',
              t('backup_restore.categories_tags'),
              t('backup_restore.custom_organization'),
            )}
            {renderBackupFeatureItem(
              'document-text-outline',
              t('backup_restore.metadata_notes'),
              t('backup_restore.details_additional_info'),
            )}
            {renderBackupFeatureItem(
              'image-outline',
              t('backup_restore.attachments'),
              t('backup_restore.files_images'),
            )}
            {renderBackupFeatureItem(
              'time-outline',
              t('backup_restore.change_history'),
              t('backup_restore.complete_modification_records'),
            )}
            {renderBackupFeatureItem(
              'settings-outline',
              t('backup_restore.app_settings'),
              t('backup_restore.preferences_configuration'),
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.securityBadges}>
            <View style={styles.securityBadge}>
              <Icon
                name="lock-closed-outline"
                size={16}
                color={theme.success}
              />
              <Text style={styles.securityBadgeText}>
                {t('backup_restore.aes256_encrypted')}
              </Text>
            </View>
            <View style={styles.securityBadge}>
              <Icon
                name="shield-checkmark-outline"
                size={16}
                color={theme.success}
              />
              <Text style={styles.securityBadgeText}>
                {t('backup_restore.zero_knowledge')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.infoBox}>
            <Icon
              name="information-circle-outline"
              size={20}
              color={theme.primary}
            />
            <Text style={styles.infoText}>
              {t('backup_restore.encryption_info')}
            </Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.actionButton,
            styles.backupButton,
            localBackupLoading && styles.actionButtonLoading,
          ]}
          onPress={() => {
            console.log('🔵 [BackupModal] Backup button onPress!');
            handleCreateBackup();
          }}
          disabled={localBackupLoading}
        >
          {localBackupLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Icon name="cloud-upload-outline" size={20} color="white" />
          )}
          <Text style={styles.actionButtonText}>
            {localBackupLoading
              ? t('backup_restore.backing_up')
              : t('backup_restore.backup_now')}
          </Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderBackupItem = (backup: BackupInfo) => (
    <TouchableOpacity
      key={backup.id}
      style={[
        styles.backupItem,
        selectedBackup?.id === backup.id && styles.backupItemSelected,
      ]}
      onPress={() => setSelectedBackup(backup)}
    >
      <View style={styles.backupItemHeader}>
        <View style={styles.backupItemIcon}>
          <Icon
            name={backup.encrypted ? 'lock-closed' : 'folder'}
            size={24}
            color={
              selectedBackup?.id === backup.id
                ? theme.primary
                : theme.textSecondary
            }
          />
        </View>

        <View style={styles.backupItemContent}>
          <Text
            style={[
              styles.backupItemName,
              selectedBackup?.id === backup.id && styles.backupItemNameSelected,
            ]}
          >
            {backup.filename}
          </Text>
          <Text style={styles.backupItemDate}>
            {formatDate(backup.createdAt)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backupItemDetails}
          onPress={() => {
            setSelectedBackup(backup);
            setShowBackupDetails(true);
          }}
        >
          <Icon
            name="information-circle-outline"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.backupItemStats}>
        <View style={styles.backupStat}>
          <Icon name="key-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.backupStatText}>
            {t('backup_restore.entries', { count: backup.entryCount })}
          </Text>
        </View>

        <View style={styles.backupStat}>
          <Icon name="folder-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.backupStatText}>
            {t('backup_restore.categories', { count: backup.categoryCount })}
          </Text>
        </View>

        <View style={styles.backupStat}>
          <Icon name="server-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.backupStatText}>
            {formatFileSize(backup.size)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderBackupItemInList = (backup: BackupInfo) => {
    const isSelected = selectedBackupsForDeletion.has(backup.id);

    return (
      <View
        key={backup.id}
        style={[
          styles.backupItem,
          selectedBackup?.id === backup.id &&
            !multiSelectMode &&
            styles.backupItemSelected,
          isSelected && multiSelectMode && styles.backupItemSelectedForDeletion,
        ]}
      >
        <View style={styles.backupItemHeader}>
          {multiSelectMode && (
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleToggleBackupSelection(backup.id)}
            >
              <View
                style={[styles.checkbox, isSelected && styles.checkboxChecked]}
              >
                {isSelected && (
                  <Icon name="checkmark" size={12} color="white" />
                )}
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.backupItemIcon}>
            <Icon
              name={backup.encrypted ? 'lock-closed' : 'folder'}
              size={24}
              color={
                selectedBackup?.id === backup.id && !multiSelectMode
                  ? theme.primary
                  : theme.textSecondary
              }
            />
          </View>

          <View style={styles.backupItemContent}>
            <Text
              style={[
                styles.backupItemName,
                selectedBackup?.id === backup.id &&
                  !multiSelectMode &&
                  styles.backupItemNameSelected,
              ]}
            >
              {backup.filename}
            </Text>
            <Text style={styles.backupItemDate}>
              {formatDate(backup.createdAt)}
            </Text>
          </View>

          {!multiSelectMode && onDeleteBackup && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={e => {
                e.stopPropagation();
                handleDeleteBackup(backup);
              }}
              disabled={deletingBackupId === backup.id}
            >
              {deletingBackupId === backup.id ? (
                <ActivityIndicator size="small" color={theme.error} />
              ) : (
                <Icon name="trash-outline" size={20} color={theme.error} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.backupItemStats}>
          <View style={styles.backupStat}>
            <Icon name="key-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.backupStatText}>
              {t('backup_restore.entries', { count: backup.entryCount })}
            </Text>
          </View>

          <View style={styles.backupStat}>
            <Icon name="folder-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.backupStatText}>
              {t('backup_restore.categories', { count: backup.categoryCount })}
            </Text>
          </View>

          <View style={styles.backupStat}>
            <Icon name="server-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.backupStatText}>
              {formatFileSize(backup.size)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRestoreTab = () => {
    console.log('🔵 [BackupModal] renderRestoreTab called');
    console.log('🔵 [BackupModal] availableBackups:', availableBackups);
    console.log(
      '🔵 [BackupModal] availableBackups.length:',
      availableBackups.length,
    );

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {availableBackups.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyState}>
              <Icon
                name="cloud-upload-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={styles.emptyStateTitle}>
                {t('backup_restore.no_backups_found')}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {t('backup_restore.create_backup_first')}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.restoreHeaderSection}>
              <View style={styles.backupHeaderIcon}>
                <Icon
                  name="cloud-download-outline"
                  size={32}
                  color={theme.primary}
                />
              </View>
              <Text style={styles.backupHeaderTitle}>
                {t('backup_restore.restore_from_backup')}
              </Text>
              <Text style={styles.backupHeaderSubtitle}>
                {t('backup_restore.recover_data_description')}
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {showBackupList
                    ? t('backup_restore.select_backup')
                    : t('backup_restore.selected_backup')}
                </Text>
                {selectedBackup && !showBackupList && (
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={() => setShowBackupList(true)}
                  >
                    <Icon
                      name="swap-horizontal"
                      size={14}
                      color={theme.primary}
                    />
                    <Text
                      style={[
                        styles.changeButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      {t('backup_restore.change')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {showBackupList ? (
                <>
                  {/* Multi-select controls */}
                  {onDeleteBackup && (
                    <View style={styles.multiSelectControls}>
                      {!multiSelectMode ? (
                        <TouchableOpacity
                          style={styles.multiSelectButton}
                          onPress={() => setMultiSelectMode(true)}
                        >
                          <Icon
                            name="checkmark-circle-outline"
                            size={16}
                            color={theme.primary}
                          />
                          <Text style={styles.multiSelectButtonText}>
                            {t('backup_restore.select_multiple')}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.multiSelectActions}>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleCancelMultiSelect}
                          >
                            <Text style={styles.cancelButtonText}>
                              {t('backup_restore.cancel')}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.deleteSelectedButton,
                              selectedBackupsForDeletion.size === 0 &&
                                styles.deleteSelectedButtonDisabled,
                            ]}
                            onPress={handleDeleteMultipleBackups}
                            disabled={selectedBackupsForDeletion.size === 0}
                          >
                            <Icon
                              name="trash-outline"
                              size={16}
                              color="white"
                            />
                            <Text style={styles.deleteSelectedButtonText}>
                              {t('backup_restore.delete_count', {
                                count: selectedBackupsForDeletion.size,
                              })}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  <ScrollView
                    style={styles.backupList}
                    showsVerticalScrollIndicator={false}
                  >
                    {availableBackups.map(backup => (
                      <TouchableOpacity
                        key={backup.id}
                        onPress={() => {
                          if (multiSelectMode) {
                            handleToggleBackupSelection(backup.id);
                          } else {
                            setSelectedBackup(backup);
                            setShowBackupList(false);
                          }
                        }}
                        disabled={deletingBackupId === backup.id}
                      >
                        {renderBackupItemInList(backup)}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : selectedBackup ? (
                <View style={styles.selectedBackupContainer}>
                  {renderBackupItem(selectedBackup)}
                </View>
              ) : null}
            </View>

            {selectedBackup && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t('backup_restore.will_restore')}
                  </Text>
                  <View style={styles.featuresList}>
                    {renderBackupFeatureItem(
                      'key-outline',
                      t('backup_restore.all_passwords'),
                      t('backup_restore.entries', {
                        count: selectedBackup.entryCount,
                      }),
                    )}
                    {renderBackupFeatureItem(
                      'folder-outline',
                      t('backup_restore.categories_tags'),
                      t('backup_restore.categories', {
                        count: selectedBackup.categoryCount,
                      }),
                    )}
                    {renderBackupFeatureItem(
                      'document-text-outline',
                      t('backup_restore.metadata_notes'),
                      t('backup_restore.all_additional_info'),
                    )}
                    {renderBackupFeatureItem(
                      'image-outline',
                      t('backup_restore.attachments'),
                      t('backup_restore.files_and_images'),
                    )}
                    {renderBackupFeatureItem(
                      'time-outline',
                      t('backup_restore.change_history'),
                      t('backup_restore.backup_from', {
                        date: formatDate(selectedBackup.createdAt),
                      }),
                    )}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t('backup_restore.restore_options')}
                  </Text>

                  {renderSwitchOption(
                    t('backup_restore.merge_with_existing'),
                    t('backup_restore.merge_description'),
                    restoreOptions.mergeWithExisting,
                    value =>
                      handleRestoreOptionChange('mergeWithExisting', value),
                  )}

                  {restoreOptions.mergeWithExisting &&
                    renderSwitchOption(
                      t('backup_restore.overwrite_duplicates'),
                      t('backup_restore.overwrite_description'),
                      restoreOptions.overwriteDuplicates,
                      value =>
                        handleRestoreOptionChange('overwriteDuplicates', value),
                    )}

                  {renderSwitchOption(
                    t('backup_restore.restore_categories'),
                    t('backup_restore.restore_categories_desc'),
                    restoreOptions.restoreCategories,
                    value =>
                      handleRestoreOptionChange('restoreCategories', value),
                  )}

                  {renderSwitchOption(
                    t('backup_restore.restore_app_settings'),
                    t('backup_restore.restore_app_settings_desc'),
                    restoreOptions.restoreSettings,
                    value =>
                      handleRestoreOptionChange('restoreSettings', value),
                  )}

                  {renderSwitchOption(
                    t('backup_restore.restore_trusted_domains'),
                    t('backup_restore.restore_trusted_domains_desc'),
                    restoreOptions.restoreDomains,
                    value => handleRestoreOptionChange('restoreDomains', value),
                  )}
                </View>

                {selectedBackup.encrypted && (
                  <View style={styles.section}>
                    <View style={styles.infoBox}>
                      <Icon
                        name="lock-closed-outline"
                        size={18}
                        color={theme.primary}
                      />
                      <Text style={styles.infoText}>
                        {t('backup_restore.encrypted_backup_info')}
                      </Text>
                    </View>
                  </View>
                )}

                <Pressable
                  style={[
                    styles.actionButton,
                    styles.restoreButton,
                    isLoading && styles.actionButtonLoading,
                  ]}
                  onPress={handleRestoreBackup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Icon
                      name="cloud-download-outline"
                      size={20}
                      color="white"
                    />
                  )}
                  <Text style={styles.actionButtonText}>
                    {isLoading
                      ? t('backup_restore.restoring')
                      : t('backup_restore.restore_now')}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderBackupDetailsModal = () => (
    <Modal
      visible={showBackupDetails}
      transparent
      animationType="slide"
      onRequestClose={() => setShowBackupDetails(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('backup_restore.backup_details')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowBackupDetails(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {selectedBackup && (
            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.filename')}
                </Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.filename}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.created')}
                </Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedBackup.createdAt)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.file_size')}
                </Text>
                <Text style={styles.detailValue}>
                  {formatFileSize(selectedBackup.size)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.entries_label')}
                </Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.entryCount}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.categories_label')}
                </Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.categoryCount}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.encryption')}
                </Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.encrypted
                    ? t('backup_restore.encrypted')
                    : t('backup_restore.not_encrypted')}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.app_version')}
                </Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.appVersion}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {t('backup_restore.backup_version')}
                </Text>
                <Text style={styles.detailValue}>{selectedBackup.version}</Text>
              </View>

              {selectedBackup.deviceInfo && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>
                    {t('backup_restore.device')}
                  </Text>
                  <Text style={styles.detailValue}>
                    {selectedBackup.deviceInfo.platform}{' '}
                    {selectedBackup.deviceInfo.version}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={styles.container}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{t('backup_restore.title')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {renderTabBar()}

            <View style={styles.tabContentWrapper}>
              {activeTab === 'backup' ? renderBackupTab() : renderRestoreTab()}
            </View>
          </View>

          {/* Toast notification inside modal */}
          <Toast
            visible={showToast}
            message={toastMessage}
            type={toastType}
            onHide={() => setShowToast(false)}
          />
        </View>
      </Modal>

      {renderBackupDetailsModal()}

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle || 'default'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    overlayTouchable: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    container: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: '90%',
      paddingBottom: 34, // Safe area
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 6,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      margin: 12,
      marginBottom: 8,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    activeTab: {
      backgroundColor: theme.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    activeTabText: {
      color: theme.primary,
    },
    tabContentWrapper: {
      flex: 1,
    },
    tabContent: {
      flex: 1,
    },
    tabContentContainer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
    },
    section: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    optionSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    optionSubtitleWithMargin: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
      marginBottom: 12,
    },
    switch: {
      width: 50,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.border,
      justifyContent: 'center',
      padding: 2,
    },
    switchActive: {
      backgroundColor: theme.primary,
    },
    switchThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    switchThumbActive: {
      transform: [{ translateX: 20 }],
    },
    inputGroup: {
      marginBottom: 12,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
      marginTop: 12,
    },
    backupButton: {
      backgroundColor: theme.success,
    },
    restoreButton: {
      backgroundColor: theme.warning,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: 'white',
    },
    backupList: {
      gap: 8,
    },
    backupItem: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    backupItemSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
    },
    backupItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    backupItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    backupItemContent: {
      flex: 1,
    },
    backupItemName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    backupItemNameSelected: {
      color: theme.primary,
    },
    backupItemDate: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    backupItemDetails: {
      padding: 4,
    },
    deleteButton: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: theme.error + '10',
    },
    backupItemStats: {
      flexDirection: 'row',
      gap: 12,
    },
    backupStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    backupStatText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyStateTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginTop: 12,
    },
    emptyStateSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      paddingHorizontal: 24,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 34,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalBody: {
      padding: 16,
    },
    detailSection: {
      marginBottom: 12,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textSecondary,
      marginBottom: 3,
    },
    detailValue: {
      fontSize: 14,
      color: theme.text,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    changeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: theme.surface,
    },
    changeButtonText: {
      fontSize: 12,
      fontWeight: '500',
    },
    selectedBackupContainer: {
      marginBottom: 4,
    },
    // Multi-select styles
    multiSelectControls: {
      marginBottom: 0,
    },
    multiSelectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      gap: 6,
      marginBottom: 8,
    },
    multiSelectButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.primary,
    },
    multiSelectActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    deleteSelectedButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.error,
      borderRadius: 8,
      gap: 6,
    },
    deleteSelectedButtonDisabled: {
      backgroundColor: theme.textSecondary,
      opacity: 0.5,
    },
    deleteSelectedButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'white',
    },
    checkboxContainer: {
      marginRight: 10,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    checkboxChecked: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    backupItemSelectedForDeletion: {
      borderColor: theme.error,
      backgroundColor: theme.error + '10',
    },
    backupHeaderSection: {
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 12,
    },
    backupHeaderIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    backupHeaderTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 2,
      textAlign: 'center',
    },
    backupHeaderSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    featuresList: {
      gap: 8,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    featureIcon: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 1,
    },
    featureSubtitle: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    securityBadges: {
      flexDirection: 'row',
      gap: 8,
    },
    securityBadge: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success + '15',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.success + '30',
    },
    securityBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.success,
      marginLeft: 4,
    },
    actionButtonLoading: {
      opacity: 0.8,
    },
    restoreHeaderSection: {
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 12,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 400,
    },
  });

export default BackupRestoreModal;
