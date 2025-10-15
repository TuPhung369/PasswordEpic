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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Auto-select latest backup when switching to restore tab
  React.useEffect(() => {
    console.log('🔵 [BackupModal] Active tab changed to:', activeTab);

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
    } else if (activeTab === 'backup') {
      // Clear selection when switching to backup tab
      setSelectedBackup(null);
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
    console.log('🔵 [BackupModal] handleCreateBackup called');
    console.log('🔵 [BackupModal] Backup options:', backupOptions);

    // Validation - no need to check encryption password (will use master password)
    if (!backupOptions.filename?.trim()) {
      console.log('❌ [BackupModal] Validation failed: Missing filename');
      setConfirmDialog({
        visible: true,
        title: 'Error',
        message: 'Please enter a backup filename.',
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    console.log('✅ [BackupModal] Validation passed, calling onBackup');
    onBackup(backupOptions);
  };

  const handleRestoreBackup = () => {
    if (!selectedBackup) {
      setConfirmDialog({
        visible: true,
        title: 'Error',
        message: 'Please select a backup to restore.',
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    // No need to check encryption password - will use master password automatically

    setConfirmDialog({
      visible: true,
      title: 'Restore Backup',
      message: `Are you sure you want to restore the backup "${
        selectedBackup.filename
      }"? ${
        restoreOptions.mergeWithExisting
          ? 'This will merge with your existing data.'
          : 'This will replace all your current data.'
      }`,
      confirmText: 'Restore',
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
      title: 'Delete Backup',
      message: `Are you sure you want to delete "${backup.filename}"? This action cannot be undone.`,
      confirmText: 'Delete',
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
          setToastMessage(`Backup "${backup.filename}" deleted successfully`);
          setToastType('success');
          setShowToast(true);
        } catch (error) {
          console.error('Failed to delete backup:', error);

          // Show error via internal toast
          setToastMessage('Failed to delete backup. Please try again.');
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
      title: 'Delete Multiple Backups',
      message: `Are you sure you want to delete ${count} backup${
        count > 1 ? 's' : ''
      }? This action cannot be undone.`,
      confirmText: 'Delete',
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
            `${count} backup${count > 1 ? 's' : ''} deleted successfully`,
          );
          setToastType('success');
          setShowToast(true);
        } catch (error) {
          console.error('Failed to delete backups:', error);

          // Show error via internal toast
          setToastMessage('Failed to delete some backups. Please try again.');
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

  const formatDate = (date: Date): string => {
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
          size={20}
          color={activeTab === 'backup' ? theme.primary : theme.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'backup' && styles.activeTabText,
          ]}
        >
          Backup
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'restore' && styles.activeTab]}
        onPress={() => setActiveTab('restore')}
      >
        <Icon
          name="cloud-download-outline"
          size={20}
          color={activeTab === 'restore' ? theme.primary : theme.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'restore' && styles.activeTabText,
          ]}
        >
          Restore
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

  const renderBackupTab = () => {
    console.log('🔵 [BackupModal] renderBackupTab called');
    console.log('🔵 [BackupModal] Backup options:', backupOptions);
    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup to Google Drive</Text>
          <Text style={styles.optionSubtitleWithMargin}>
            Your backup will be encrypted with your master password and uploaded
            securely to Google Drive.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Backup Filename</Text>
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

          <View style={styles.infoBox}>
            <Icon
              name="information-circle-outline"
              size={20}
              color={theme.primary}
            />
            <Text style={styles.infoText}>
              Backup includes: All passwords, metadata, attachments, history,
              and settings.
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.actionButton, styles.backupButton]}
          onPress={() => {
            console.log('🔵 [BackupModal] Backup button onPress!');
            handleCreateBackup();
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Icon name="cloud-upload-outline" size={20} color="white" />
          )}
          <Text style={styles.actionButtonText}>
            {isLoading
              ? 'Backing up to Google Drive...'
              : 'Backup to Google Drive'}
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
          <Text style={styles.backupStatText}>{backup.entryCount} entries</Text>
        </View>

        <View style={styles.backupStat}>
          <Icon name="folder-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.backupStatText}>
            {backup.categoryCount} categories
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
                  <Icon name="checkmark" size={16} color="white" />
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
              {backup.entryCount} entries
            </Text>
          </View>

          <View style={styles.backupStat}>
            <Icon name="folder-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.backupStatText}>
              {backup.categoryCount} categories
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {showBackupList ? 'Select Backup' : 'Selected Backup'}
            </Text>
            {selectedBackup && !showBackupList && (
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setShowBackupList(true)}
              >
                <Icon name="swap-horizontal" size={16} color={theme.primary} />
                <Text
                  style={[styles.changeButtonText, { color: theme.primary }]}
                >
                  Change
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {availableBackups.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon
                name="cloud-upload-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={styles.emptyStateTitle}>No Backups Found</Text>
              <Text style={styles.emptyStateSubtitle}>
                Create a backup first to restore from it later.
              </Text>
            </View>
          ) : showBackupList ? (
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
                        size={18}
                        color={theme.primary}
                      />
                      <Text style={styles.multiSelectButtonText}>
                        Select Multiple
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.multiSelectActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelMultiSelect}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
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
                        <Icon name="trash-outline" size={18} color="white" />
                        <Text style={styles.deleteSelectedButtonText}>
                          Delete Selected ({selectedBackupsForDeletion.size})
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
              <Text style={styles.sectionTitle}>Restore Options</Text>

              {renderSwitchOption(
                'Merge with Existing Data',
                selectedBackup.encrypted
                  ? 'Add backup data to current data'
                  : 'Replace all current data with backup',
                restoreOptions.mergeWithExisting,
                value => handleRestoreOptionChange('mergeWithExisting', value),
              )}

              {restoreOptions.mergeWithExisting &&
                renderSwitchOption(
                  'Overwrite Duplicates',
                  'Replace existing entries with backup versions',
                  restoreOptions.overwriteDuplicates,
                  value =>
                    handleRestoreOptionChange('overwriteDuplicates', value),
                )}

              {renderSwitchOption(
                'Restore Categories',
                'Restore category settings and organization',
                restoreOptions.restoreCategories,
                value => handleRestoreOptionChange('restoreCategories', value),
              )}

              {renderSwitchOption(
                'Restore App Settings',
                'Restore application preferences and settings',
                restoreOptions.restoreSettings,
                value => handleRestoreOptionChange('restoreSettings', value),
              )}
            </View>

            {selectedBackup.encrypted && (
              <View style={styles.section}>
                <View style={styles.infoBox}>
                  <Icon
                    name="lock-closed-outline"
                    size={20}
                    color={theme.primary}
                  />
                  <Text style={styles.infoText}>
                    This backup is encrypted with your master password. It will
                    be decrypted automatically.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.restoreButton]}
              onPress={handleRestoreBackup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="cloud-download-outline" size={20} color="white" />
              )}
              <Text style={styles.actionButtonText}>
                {isLoading ? 'Restoring...' : 'Restore Backup'}
              </Text>
            </TouchableOpacity>
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
            <Text style={styles.modalTitle}>Backup Details</Text>
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
                <Text style={styles.detailLabel}>Filename</Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.filename}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedBackup.createdAt)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>File Size</Text>
                <Text style={styles.detailValue}>
                  {formatFileSize(selectedBackup.size)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Entries</Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.entryCount}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Categories</Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.categoryCount}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Encryption</Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.encrypted ? 'Encrypted' : 'Not Encrypted'}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>App Version</Text>
                <Text style={styles.detailValue}>
                  {selectedBackup.appVersion}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Backup Version</Text>
                <Text style={styles.detailValue}>{selectedBackup.version}</Text>
              </View>

              {selectedBackup.deviceInfo && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Device</Text>
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
              <Text style={styles.title}>Backup & Restore</Text>
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
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      margin: 20,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 8,
      gap: 8,
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
      fontSize: 16,
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
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    optionSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    optionSubtitleWithMargin: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
      marginBottom: 16,
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
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
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
      borderRadius: 12,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
      marginTop: 16,
    },
    backupButton: {
      backgroundColor: theme.success,
    },
    restoreButton: {
      backgroundColor: theme.warning,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
    backupList: {
      gap: 12,
    },
    backupItem: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
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
      marginBottom: 12,
    },
    backupItemIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    backupItemContent: {
      flex: 1,
    },
    backupItemName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    backupItemNameSelected: {
      color: theme.primary,
    },
    backupItemDate: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    backupItemDetails: {
      padding: 4,
    },
    deleteButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.error + '10',
    },
    backupItemStats: {
      flexDirection: 'row',
      gap: 16,
    },
    backupStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    backupStatText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    emptyStateSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 32,
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
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalBody: {
      padding: 20,
    },
    detailSection: {
      marginBottom: 16,
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 16,
      color: theme.text,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    changeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.surface,
    },
    changeButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    selectedBackupContainer: {
      marginBottom: 8,
    },
    // Multi-select styles
    multiSelectControls: {
      marginBottom: 16,
    },
    multiSelectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      gap: 8,
    },
    multiSelectButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.primary,
    },
    multiSelectActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    deleteSelectedButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.error,
      borderRadius: 8,
      gap: 8,
    },
    deleteSelectedButtonDisabled: {
      backgroundColor: theme.textSecondary,
      opacity: 0.5,
    },
    deleteSelectedButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'white',
    },
    checkboxContainer: {
      marginRight: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
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
  });

export default BackupRestoreModal;
