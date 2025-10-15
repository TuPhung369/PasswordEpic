import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState, persistor } from '../../store';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PasswordEntry as Password } from '../../types/password';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import { getEffectiveMasterPassword } from '../../services/staticMasterPasswordService';
import { loadPasswordsLazy } from '../../store/slices/passwordsSlice';
import { restoreSettings as restoreSettingsAction } from '../../store/slices/settingsSlice';
import PasswordEntryComponent from '../../components/PasswordEntry';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import Toast from '../../components/Toast';
import {
  recalculatePasswordStrengths,
  needsStrengthRecalculation,
} from '../../utils/passwordStrengthMigration';
import SortDropdown from '../../components/SortDropdown';
import FilterDropdown, {
  MultipleFilterOptions,
} from '../../components/FilterDropdown';
import BackupRestoreModal from '../../components/BackupRestoreModal';
import FileNameInputModal from '../../components/FileNameInputModal';
import { importExportService } from '../../services/importExportService';
import { backupService } from '../../services/backupService';
import FilePicker from '../../modules/FilePicker';
import { useActivityTracking } from '../../hooks/useActivityTracking';
import {
  deriveKeyFromPassword,
  decryptData,
} from '../../services/cryptoService';
import {
  uploadToGoogleDrive,
  isGoogleDriveAvailable,
  requestDrivePermissions,
} from '../../services/googleDriveService';
import { encryptedDatabase } from '../../services/encryptedDatabaseService';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

// Define local types for PasswordsScreen string-based filtering
type SortOption =
  | 'createdAt-desc'
  | 'createdAt-asc'
  | 'updatedAt-desc'
  | 'updatedAt-asc'
  | 'title-asc'
  | 'title-desc'
  | 'strength-asc'
  | 'strength-desc'
  | 'category-asc'
  | 'category-desc'
  | 'username-asc'
  | 'username-desc';

type NavigationProp = NativeStackNavigationProp<
  PasswordsStackParamList,
  'PasswordsList'
>;

type PasswordsScreenProps = NativeStackScreenProps<
  PasswordsStackParamList,
  'PasswordsList'
>;

export const PasswordsScreen: React.FC<PasswordsScreenProps> = ({ route }) => {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { passwords } = useAppSelector((state: RootState) => state.passwords);
  const settings = useAppSelector((state: RootState) => state.settings);
  const { deletePassword, updatePassword } = usePasswordManagement();
  const { onScroll: trackScrollActivity } = useActivityTracking();

  // Confirm dialog hook
  const { confirmDialog, showAlert, showDestructive, hideConfirm } =
    useConfirmDialog();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPasswords, setSelectedPasswords] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [isLoadingPasswords, setIsLoadingPasswords] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Sort and Filter state
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption>('createdAt-desc');
  const [currentFilters, setCurrentFilters] = useState<MultipleFilterOptions>({
    weak: false,
    compromised: false,
    duplicate: false,
    favorite: false,
    categories: [],
  });
  const [sortButtonPosition, setSortButtonPosition] = useState({ x: 0, y: 0 });
  const [filterButtonPosition, setFilterButtonPosition] = useState({
    x: 0,
    y: 0,
  });

  // Export and Backup state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showFileNameModal, setShowFileNameModal] = useState(false);
  const [availableBackups, setAvailableBackups] = useState([]);
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [pendingExport, setPendingExport] = useState<{
    entries: any;
    format: any;
    options: any;
  } | null>(null);

  // Import state
  const [isImportLoading, setIsImportLoading] = useState(false);

  // Track recalculated password IDs to prevent infinite loop
  const recalculatedPasswordIds = useRef<Set<string>>(new Set());

  // Memoize toast hide callback to prevent re-renders from resetting the timer
  const handleHideToast = useCallback(() => {
    setShowToast(false);
  }, []);

  // Handle success message from navigation params
  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.successMessage) {
        setToastMessage(route.params.successMessage);
        setToastType('success');
        setShowToast(true);

        // Clear the success message from params to prevent showing again
        navigation.setParams({ successMessage: undefined });
      }
    }, [route.params?.successMessage, navigation]),
  );

  // Load passwords when screen mounts or comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const loadPasswordsData = async () => {
        const screenStartTime = Date.now();
        console.log('🔐 [PasswordsScreen] Starting password load...');

        try {
          setIsLoadingPasswords(true);

          // Remove initial delay - rely on pre-warmed cache from AppNavigator
          // await new Promise(resolve => setTimeout(resolve, 300));

          // Get the master password (should be cached from AppNavigator pre-warming)
          const mpStartTime = Date.now();
          const result = await getEffectiveMasterPassword();
          const mpDuration = Date.now() - mpStartTime;

          // Debug log to see what we got
          console.log('🔍 [PasswordsScreen] Master password result:', {
            success: result.success,
            hasPassword: !!result.password,
            passwordLength: result.password?.length || 0,
            duration: `${mpDuration}ms`,
            error: result.error,
          });

          if (result.success && result.password) {
            const loadStartTime = Date.now();
            await dispatch(loadPasswordsLazy(result.password)).unwrap();
            const loadDuration = Date.now() - loadStartTime;
            const totalDuration = Date.now() - screenStartTime;
            console.log(
              `✅ [PasswordsScreen] Passwords loaded (load: ${loadDuration}ms, total: ${totalDuration}ms)`,
            );
          } else {
            // Don't show warning yet - auth might not be ready, try retry first
            console.log(
              '🔄 [PasswordsScreen] First attempt failed, retrying after 500ms...',
            );
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryResult = await getEffectiveMasterPassword();
            if (retryResult.success && retryResult.password) {
              const loadStartTime = Date.now();
              await dispatch(loadPasswordsLazy(retryResult.password)).unwrap();
              const loadDuration = Date.now() - loadStartTime;
              const totalDuration = Date.now() - screenStartTime;
              console.log(
                `✅ [PasswordsScreen] Passwords loaded on retry (load: ${loadDuration}ms, total: ${totalDuration}ms)`,
              );
            } else {
              // Only show warning if both attempts failed
              console.warn(
                '⚠️ PasswordsScreen: Failed to get master password after retry:',
                retryResult.error,
              );
            }
          }
        } catch (error) {
          console.error('❌ PasswordsScreen: Failed to load passwords:', error);
        } finally {
          const finalDuration = Date.now() - screenStartTime;
          console.log(
            `🏁 [PasswordsScreen] Load complete (${finalDuration}ms)`,
          );
          setIsLoadingPasswords(false);
        }
      };

      loadPasswordsData();
    }, [dispatch]),
  );

  // Recalculate password strengths when passwords change
  useEffect(() => {
    const recalculateStrengths = async () => {
      if (passwords.length === 0) return;

      // Filter out passwords that need recalculation AND haven't been recalculated yet
      const passwordsNeedingUpdate = passwords.filter(
        p =>
          needsStrengthRecalculation(p) &&
          !recalculatedPasswordIds.current.has(p.id),
      );

      if (passwordsNeedingUpdate.length > 0) {
        // console.log(
        //   `🔄 PasswordsScreen: Recalculating strength for ${passwordsNeedingUpdate.length} passwords...`,
        // );

        // Mark these passwords as being recalculated
        passwordsNeedingUpdate.forEach(p =>
          recalculatedPasswordIds.current.add(p.id),
        );

        const updatedPasswords = recalculatePasswordStrengths(
          passwordsNeedingUpdate,
        );

        // Update passwords with recalculated strengths (in background)
        for (const updatedPassword of updatedPasswords) {
          await updatePassword(updatedPassword.id, updatedPassword);
        }
        // console.log('✅ PasswordsScreen: Password strengths recalculated');
      }
    };

    recalculateStrengths();
  }, [passwords, updatePassword]);

  // Load available backups on mount
  useEffect(() => {
    loadAvailableBackups();
  }, []);

  // Reload backups when modal opens
  useEffect(() => {
    console.log(
      '🔍 [PasswordsScreen] showBackupModal changed:',
      showBackupModal,
    );
    if (showBackupModal) {
      console.log(
        '🔄 [PasswordsScreen] Backup modal opened, reloading backups...',
      );
      loadAvailableBackups();
    }
  }, [showBackupModal]);

  // Get unique categories from passwords
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    passwords.forEach(password => {
      if (password.category) {
        uniqueCategories.add(password.category);
      }
    });
    return Array.from(uniqueCategories).sort();
  }, [passwords]);

  // Filter passwords based on search query and filters
  const filteredPasswords = useMemo(() => {
    let result = passwords;

    // Apply search query
    if (searchQuery.trim()) {
      result = result.filter(
        password =>
          password.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (password.username &&
            password.username
              .toLowerCase()
              .includes(searchQuery.toLowerCase())) ||
          (password.website &&
            password.website.toLowerCase().includes(searchQuery.toLowerCase())),
      );
    }

    // Apply multiple filters (AND logic - all selected filters must pass)
    // If any filters are active, apply them with AND logic
    const hasActiveFilters =
      currentFilters.weak ||
      currentFilters.compromised ||
      currentFilters.duplicate ||
      currentFilters.favorite ||
      currentFilters.categories.length > 0;

    if (hasActiveFilters) {
      result = result.filter(p => {
        const passesWeakFilter =
          !currentFilters.weak ||
          (p.auditData?.passwordStrength &&
            p.auditData.passwordStrength.score < 2);

        const passesCompromisedFilter =
          !currentFilters.compromised || p.breachStatus?.isBreached;

        const passesDuplicateFilter =
          !currentFilters.duplicate ||
          (p.auditData?.duplicateCount && p.auditData.duplicateCount > 0);

        const passesFavoriteFilter = !currentFilters.favorite || p.isFavorite;

        const passesCategoryFilter =
          currentFilters.categories.length === 0 ||
          currentFilters.categories.includes(p.category || '');

        return (
          passesWeakFilter &&
          passesCompromisedFilter &&
          passesDuplicateFilter &&
          passesFavoriteFilter &&
          passesCategoryFilter
        );
      });
    }

    // Apply sort
    const sorted = [...result];
    console.log(
      '🔄 Applying sort:',
      currentSort,
      'to',
      result.length,
      'passwords',
    );

    switch (currentSort) {
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'createdAt-asc':
        console.log('📅 Sorting by createdAt ASC');
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case 'createdAt-desc':
        console.log('📅 Sorting by createdAt DESC');
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case 'updatedAt-asc':
        sorted.sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        );
        break;
      case 'updatedAt-desc':
        sorted.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        break;
      case 'strength-asc':
        sorted.sort(
          (a, b) =>
            (a.auditData?.passwordStrength?.score || 0) -
            (b.auditData?.passwordStrength?.score || 0),
        );
        break;
      case 'strength-desc':
        sorted.sort(
          (a, b) =>
            (b.auditData?.passwordStrength?.score || 0) -
            (a.auditData?.passwordStrength?.score || 0),
        );
        break;
      case 'category-asc':
        sorted.sort((a, b) =>
          (a.category || '').localeCompare(b.category || ''),
        );
        break;
      case 'category-desc':
        sorted.sort((a, b) =>
          (b.category || '').localeCompare(a.category || ''),
        );
        break;
      case 'username-asc':
        sorted.sort((a, b) =>
          (a.username || '').localeCompare(b.username || ''),
        );
        break;
      case 'username-desc':
        sorted.sort((a, b) =>
          (b.username || '').localeCompare(a.username || ''),
        );
        break;
      default:
        break;
    }

    console.log('🔍 [Filter Debug] Final result:', {
      totalPasswords: passwords.length,
      afterSearch: result.length,
      afterFilter: sorted.length,
      searchQuery,
      hasActiveFilters,
      currentFilters,
    });

    return sorted;
  }, [passwords, searchQuery, currentFilters, currentSort]);

  // Calculate statistics
  const statistics = useMemo(() => {
    // console.log('🔍 Password Statistics Debug:');

    // const passwordsWithAudit = filteredPasswords.filter(
    //   p => p.auditData?.passwordStrength,
    // );
    // const passwordsWithoutAudit = filteredPasswords.filter(
    //   p => !p.auditData?.passwordStrength,
    // );

    // console.log('📊 Total passwords:', filteredPasswords.length);
    // console.log('✅ With audit data:', passwordsWithAudit.length);
    // console.log('❌ Without audit data:', passwordsWithoutAudit.length);

    // Log each password's strength
    // filteredPasswords.forEach((p, index) => {
    //   console.log(`Password ${index + 1}:`, {
    //     title: p.title,
    //     hasAuditData: !!p.auditData?.passwordStrength,
    //     score: p.auditData?.passwordStrength?.score || 'N/A',
    //     label: p.auditData?.passwordStrength?.label || 'N/A',
    //   });
    // });

    const weakPasswords = filteredPasswords.filter(
      p =>
        p.auditData?.passwordStrength && p.auditData.passwordStrength.score < 2,
    ).length;

    const compromisedPasswords = filteredPasswords.filter(
      p => p.breachStatus?.isBreached,
    ).length;

    const duplicatePasswords = filteredPasswords.filter(
      p => p.auditData?.duplicateCount && p.auditData.duplicateCount > 0,
    ).length;

    // console.log('📈 Final stats:', {
    //   weakPasswords,
    //   compromisedPasswords,
    //   duplicatePasswords,
    // });

    return {
      weakPasswords,
      compromisedPasswords,
      duplicatePasswords,
    };
  }, [filteredPasswords]);

  // Handlers
  const handlePasswordPress = (password: Password) => {
    if (bulkMode) {
      togglePasswordSelection(password.id);
    } else {
      // Navigate to password details
      // navigation.navigate('PasswordDetails', { passwordId: password.id });
    }
  };

  const handlePasswordEdit = (password: Password) => {
    navigation.navigate('EditPassword', { passwordId: password.id });
  };

  const handlePasswordDelete = async (password: Password) => {
    showDestructive(
      'Delete Password',
      `Are you sure you want to delete "${password.title}"?`,
      async () => {
        try {
          // console.log('Delete password:', password.id);
          await deletePassword(password.id);
          // console.log('✅ Password deleted successfully:', password.id);
        } catch (error) {
          console.error('❌ Failed to delete password:', error);
          showAlert('Error', 'Failed to delete password');
        }
      },
      'Delete',
    );
  };

  const togglePasswordSelection = (passwordId: string) => {
    setSelectedPasswords(prev =>
      prev.includes(passwordId)
        ? prev.filter(id => id !== passwordId)
        : [...prev, passwordId],
    );
  };

  const selectAllPasswords = () => {
    setSelectedPasswords(filteredPasswords.map(p => p.id));
  };

  const clearSelection = () => {
    setSelectedPasswords([]);
  };

  const handleAddPassword = () => {
    navigation.navigate('AddPassword');
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (!bulkMode) {
      clearSelection();
    }
  };

  const handleBulkDelete = () => {
    if (selectedPasswords.length === 0) return;

    showDestructive(
      'Delete Passwords',
      `Are you sure you want to delete ${selectedPasswords.length} password(s)?`,
      async () => {
        try {
          // console.log('🗑️ Bulk deleting passwords:', selectedPasswords);

          // Delete all selected passwords
          const deletePromises = selectedPasswords.map(passwordId =>
            deletePassword(passwordId),
          );

          await Promise.all(deletePromises);

          // console.log('✅ Bulk delete completed successfully');

          // Show success toast
          setToastMessage(
            `Successfully deleted ${selectedPasswords.length} password(s)`,
          );
          setToastType('success');
          setShowToast(true);

          // Exit bulk mode and clear selection
          setBulkMode(false);
          clearSelection();
        } catch (error) {
          console.error('❌ Failed to bulk delete passwords:', error);
          showAlert('Error', 'Failed to delete passwords');
        }
      },
      'Delete',
    );
  };

  // Toggle favorite handler
  const handleToggleFavorite = async (password: Password) => {
    try {
      const updatedPassword = {
        ...password,
        isFavorite: !password.isFavorite,
      };
      await updatePassword(password.id, updatedPassword);
      setToastMessage(
        password.isFavorite ? 'Removed from favorites' : 'Added to favorites',
      );
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error);
      setToastMessage('Failed to update favorite status');
      setToastType('error');
      setShowToast(true);
    }
  };

  // Sort and Filter handlers
  const handleSortChange = (sort: SortOption | any) => {
    // If sort is object from SortDropdown, convert to string format
    if (typeof sort === 'object' && sort.field && sort.direction) {
      const fieldMap: Record<string, string> = {
        name: 'title',
        dateModified: 'updatedAt', // Map to updatedAt for last modified
        dateCreated: 'createdAt', // Map to createdAt for creation date
        category: 'category',
        strength: 'strength',
      };

      const mappedField = fieldMap[sort.field] || sort.field;
      const sortString = `${mappedField}-${sort.direction}` as SortOption;
      setCurrentSort(sortString);
    } else {
      // If sort is already string format
      setCurrentSort(sort as SortOption);
    }
  };

  const handleFiltersChange = (filters: MultipleFilterOptions) => {
    setCurrentFilters(filters);
  };

  // Convert string-based sort to object format for SortSheet
  const convertSortToObject = (sortString: SortOption) => {
    const [field, direction] = sortString.split('-') as [
      string,
      'asc' | 'desc',
    ];

    const fieldMap: Record<
      string,
      'name' | 'dateModified' | 'dateCreated' | 'category' | 'strength'
    > = {
      title: 'name',
      createdAt: 'dateCreated', // createdAt maps to dateCreated
      updatedAt: 'dateModified', // updatedAt maps to dateModified
      category: 'category',
      strength: 'strength',
      username: 'name', // Map username to name for now
    };

    return {
      field: fieldMap[field] || 'name',
      direction: direction,
    };
  };

  const handleResetFilters = () => {
    setCurrentFilters({
      weak: false,
      compromised: false,
      duplicate: false,
      favorite: false,
      categories: [],
    });
    setCurrentSort('createdAt-desc');
  };

  // Toggle sort direction when clicking on sort chip
  const handleToggleSort = () => {
    const [field, direction] = currentSort.split('-') as [
      string,
      'asc' | 'desc',
    ];
    const newDirection = direction === 'asc' ? 'desc' : 'asc';
    const newSort = `${field}-${newDirection}` as SortOption;
    setCurrentSort(newSort);
  };

  // Export and Backup handlers
  const handleFileNameConfirm = async (fileName: string) => {
    if (!pendingExport) return;

    const { entries, format, options } = pendingExport;

    try {
      setIsExportLoading(true);
      setShowFileNameModal(false);

      const exportOptions = {
        format: format.id,
        includePasswords: true,
        includeNotes: options.includeNotes,
        includeCustomFields: true,
        categories: options.includeCategories ? undefined : [],
        tags: options.includeTags ? undefined : [],
        encryptionPassword: options.encrypt
          ? options.encryptionPassword
          : undefined,
        fileName: `${fileName}.${format.extension}`,
      };

      const result = await importExportService.exportPasswords(
        entries,
        exportOptions,
      );

      if (result.success) {
        // Show success toast and auto-hide
        setToastMessage(
          `Successfully exported ${result.exportedCount} passwords`,
        );
        setToastType('success');
        setShowToast(true);
      } else {
        const errorMsg =
          result.errors && result.errors.length > 0
            ? result.errors.join(', ')
            : 'Export operation failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      setToastMessage(`Export failed: ${errorMessage}`);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsExportLoading(false);
      setPendingExport(null);
    }
  };

  const handleImport = async () => {
    try {
      setIsImportLoading(true);

      // Open native file picker
      const filePath = await FilePicker.pickFile();

      if (!filePath) {
        setIsImportLoading(false);
        return;
      }

      console.log('🔍 [Import] Selected file:', filePath);

      // Get current master password for decryption
      const masterPasswordResult = await getEffectiveMasterPassword();
      if (!masterPasswordResult.success) {
        setToastMessage(
          'Master password not found. Please log out and log back in.',
        );
        setToastType('error');
        setShowToast(true);
        setIsImportLoading(false);
        return;
      }

      // Extract filename for display
      const fileName = filePath.split('/').pop() || 'selected file';
      setToastMessage(`Importing from ${fileName}...`);
      setToastType('success');
      setShowToast(true);

      const importResult = await importExportService.importPasswords(
        filePath,
        passwords,
        {
          format: 'json',
          encryptionPassword: masterPasswordResult.password,
          mergeStrategy: 'skip',
        },
      );

      if (importResult.success) {
        // Refresh the passwords list - MUST await to ensure UI updates
        await dispatch(
          loadPasswordsLazy(masterPasswordResult.password),
        ).unwrap();

        setToastMessage(
          `Import successful! ${importResult.importedCount} passwords imported, ${importResult.skippedCount} skipped (duplicates)`,
        );
        setToastType('success');
        setShowToast(true);
      } else {
        const errorMsg =
          importResult.errors && importResult.errors.length > 0
            ? importResult.errors.map(e => e.error).join(', ')
            : `Failed to import from ${fileName}. File might be corrupted or encrypted with different password.`;
        setToastMessage(errorMsg);
        setToastType('error');
        setShowToast(true);
      }
    } catch (error: any) {
      console.error('Import error:', error);

      // Handle user cancellation gracefully
      if (error.code === 'FILE_PICKER_CANCELLED') {
        setToastMessage('File selection cancelled');
        setToastType('success');
      } else {
        setToastMessage(
          error.message || 'An unexpected error occurred during import',
        );
        setToastType('error');
      }
      setShowToast(true);
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleBackup = async (options: any) => {
    console.log('🟢 [PasswordsScreen] handleBackup called');
    console.log('🟢 [PasswordsScreen] Options received:', options);

    try {
      setIsExportLoading(true);

      // Get master password for encryption
      console.log('🟢 [PasswordsScreen] Getting master password...');
      const masterPasswordResult = await getEffectiveMasterPassword();
      if (!masterPasswordResult.success || !masterPasswordResult.password) {
        console.log('❌ [PasswordsScreen] Failed to get master password');
        setToastMessage('Failed to get master password for encryption');
        setToastType('error');
        setShowToast(true);
        return;
      }
      console.log('✅ [PasswordsScreen] Master password retrieved');

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

      console.log(
        '🟢 [PasswordsScreen] Backup options prepared (cloud-only):',
        { ...backupOptions, encryptionPassword: '[REDACTED]' },
      );

      // Get categories for backup
      const backupCategories = Array.from(
        new Set(passwords.map(p => p.category).filter(Boolean)),
      ).map(categoryName => ({
        id: categoryName,
        name: categoryName,
        icon: 'folder',
        color: '#007AFF',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Debug: Log settings before backup
      console.log(
        '🔍 [PasswordsScreen] Settings to backup:',
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
          '🔵 [PasswordsScreen] Backup created, uploading to Google Drive...',
        );
        console.log('🔵 [PasswordsScreen] File path:', result.filePath);
        console.log('🔵 [PasswordsScreen] File name:', options.filename);

        try {
          // Check if Google Drive is available
          let isDriveAvailable = await isGoogleDriveAvailable();
          console.log(
            '🔵 [PasswordsScreen] Google Drive available:',
            isDriveAvailable,
          );

          // If not available, try to request permissions
          if (!isDriveAvailable) {
            console.log('🔵 [PasswordsScreen] Requesting Drive permissions...');
            const permissionResult = await requestDrivePermissions();

            if (permissionResult.success) {
              console.log('✅ [PasswordsScreen] Drive permissions granted');
              isDriveAvailable = true;
            } else {
              console.log(
                '❌ [PasswordsScreen] Failed to get Drive permissions',
              );
              showAlert(
                'Google Drive Permission Required',
                'Please grant Google Drive access to upload backups. You may need to sign out and sign in again.',
              );
              return;
            }
          }

          if (isDriveAvailable) {
            console.log('🔵 [PasswordsScreen] Starting upload...');
            const uploadResult = await uploadToGoogleDrive(
              result.filePath,
              options.filename || 'backup',
              'application/octet-stream',
            );

            if (uploadResult.success) {
              console.log(
                '✅ [PasswordsScreen] Uploaded to Google Drive successfully',
              );
              console.log('✅ [PasswordsScreen] File ID:', uploadResult.fileId);

              // Delete local temporary file after successful upload
              try {
                const RNFS = require('react-native-fs');
                await RNFS.unlink(result.filePath);
                console.log(
                  '🗑️ [PasswordsScreen] Temporary backup file deleted',
                );
              } catch (deleteError) {
                console.warn(
                  '⚠️ [PasswordsScreen] Failed to delete temp file:',
                  deleteError,
                );
              }

              setToastMessage(
                '✅ Backup uploaded to Google Drive successfully',
              );
              setToastType('success');
              setShowToast(true);

              // Close the modal
              setShowBackupModal(false);

              // Refresh available backups
              loadAvailableBackups();
            } else {
              throw new Error(uploadResult.error || 'Upload failed');
            }
          }
        } catch (error: any) {
          console.error(
            '❌ [PasswordsScreen] Google Drive upload error:',
            error,
          );
          setToastMessage(
            `Failed to upload to Google Drive: ${error.message || error}`,
          );
          setToastType('error');
          setShowToast(true);
        }
      } else {
        throw new Error('Backup creation failed');
      }
    } catch (error: any) {
      console.error('❌ Backup failed:', error);
      setToastMessage(`Failed to create backup: ${error.message || error}`);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsExportLoading(false);
    }
  };

  const handleRestore = async (backupId: string, options: any) => {
    let tempFilePath: string | null = null; // Declare outside try block for cleanup

    try {
      setIsExportLoading(true);

      // Get master password for decryption
      console.log(
        '🟢 [PasswordsScreen] Getting master password for restore...',
      );
      const masterPasswordResult = await getEffectiveMasterPassword();
      if (!masterPasswordResult.success || !masterPasswordResult.password) {
        console.log('❌ [PasswordsScreen] Failed to get master password');
        setToastMessage('Failed to get master password for decryption');
        setToastType('error');
        setShowToast(true);
        return;
      }
      console.log('✅ [PasswordsScreen] Master password retrieved for restore');

      // Find the backup file path
      const backup = availableBackups.find((b: any) => b.id === backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      console.log('🔵 [PasswordsScreen] Backup object:', backup);

      // Check if this is a Google Drive backup (no filePath, only id)
      let filePath = (backup as any).filePath;

      if (!filePath) {
        // This is a Google Drive backup, download it first
        console.log('🔵 [PasswordsScreen] Downloading from Google Drive...');
        const { downloadFromGoogleDrive } = await import(
          '../../services/googleDriveService'
        );

        // Create temp file path
        const RNFS = await import('react-native-fs');
        tempFilePath = `${
          RNFS.default.CachesDirectoryPath
        }/temp_restore_${Date.now()}.bak`;

        const downloadResult = await downloadFromGoogleDrive(
          backup.id,
          tempFilePath,
        );

        if (!downloadResult.success) {
          throw new Error(
            `Failed to download backup: ${
              downloadResult.error || 'Unknown error'
            }`,
          );
        }

        console.log('✅ [PasswordsScreen] Downloaded to:', tempFilePath);
        filePath = tempFilePath;
      }

      const restoreOptions = {
        mergeStrategy: options.mergeWithExisting
          ? ('merge' as const)
          : ('replace' as const),
        decryptionPassword: masterPasswordResult.password, // Use master password
        restoreSettings: options.restoreSettings,
        restoreCategories: options.restoreCategories,
        overwriteDuplicates: options.overwriteDuplicates,
      };

      console.log(
        '🔵 [PasswordsScreen] Restoring backup with master password...',
      );
      console.log('🔵 [PasswordsScreen] Restore options:', restoreOptions);

      const result = await backupService.restoreFromBackup(
        filePath,
        restoreOptions,
      );

      console.log('🔵 [PasswordsScreen] Restore result:', result);

      if (result.result.success) {
        console.log('✅ [PasswordsScreen] Restore successful');

        // If replace strategy, clear existing passwords first
        if (restoreOptions.mergeStrategy === 'replace') {
          console.log(
            '🗑️ [PasswordsScreen] Replace mode: clearing existing passwords...',
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
                `❌ [PasswordsScreen] Failed to delete entry ${existingEntry.id}:`,
                deleteError,
              );
            }
          }
          console.log('✅ [PasswordsScreen] Existing passwords cleared');
        }

        // Save restored entries to database
        if (
          result.data &&
          result.data.entries &&
          result.data.entries.length > 0
        ) {
          console.log(
            `💾 [PasswordsScreen] Saving ${result.data.entries.length} restored entries to database...`,
          );

          // Get existing passwords for duplicate detection (only in merge mode)
          let existingPasswords: any[] = [];
          if (restoreOptions.mergeStrategy === 'merge') {
            existingPasswords = await encryptedDatabase.getAllPasswordEntries(
              masterPasswordResult.password,
            );
            console.log(
              `🔍 [PasswordsScreen] Found ${existingPasswords.length} existing passwords for duplicate detection`,
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
                  `🔓 [PasswordsScreen] Decrypting backed up entry: ${entry.title}`,
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
                    `✅ [PasswordsScreen] Successfully decrypted: ${entry.title}`,
                  );
                } catch (decryptError) {
                  console.error(
                    `❌ [PasswordsScreen] Failed to decrypt entry ${entry.title}:`,
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
                      `🔄 [PasswordsScreen] Overwriting duplicate: ${entryToSave.title}`,
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
                    `⏭️ [PasswordsScreen] Skipping duplicate: ${entryToSave.title}`,
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
                `❌ [PasswordsScreen] Failed to save entry ${entry.id}:`,
                saveError,
              );
            }
          }

          console.log(
            `✅ [PasswordsScreen] Restore complete: ${savedCount} new, ${overwrittenCount} overwritten, ${skippedCount} skipped`,
          );

          // Store counts for toast message
          var restoreSummary = {
            saved: savedCount,
            overwritten: overwrittenCount,
            skipped: skippedCount,
          };
        } else {
          console.log('⚠️ [PasswordsScreen] No entries to save from restore');
          var restoreSummary = { saved: 0, overwritten: 0, skipped: 0 };
        }

        // Restore settings if enabled
        if (restoreOptions.restoreSettings && result.data?.settings) {
          console.log('⚙️ [PasswordsScreen] Restoring settings from backup...');
          console.log(
            '🔍 [PasswordsScreen] Settings from backup:',
            JSON.stringify(result.data.settings, null, 2),
          );
          dispatch(restoreSettingsAction(result.data.settings));
          console.log('✅ [PasswordsScreen] Settings restored to Redux state');

          // Force persist to AsyncStorage immediately
          console.log(
            '💾 [PasswordsScreen] Flushing persistor to AsyncStorage...',
          );
          await persistor.flush();
          console.log('✅ [PasswordsScreen] Persistor flushed successfully');
        } else {
          console.log('⚠️ [PasswordsScreen] Settings not restored:', {
            restoreSettingsEnabled: restoreOptions.restoreSettings,
            hasSettings: !!result.data?.settings,
          });
        }

        // Build detailed toast message
        const totalRestored = restoreSummary.saved + restoreSummary.overwritten;
        let toastMsg = `✅ Restored ${totalRestored} password${
          totalRestored !== 1 ? 's' : ''
        }`;
        if (restoreSummary.overwritten > 0) {
          toastMsg += ` (${restoreSummary.overwritten} overwritten)`;
        }
        if (restoreSummary.skipped > 0) {
          toastMsg += `, ${restoreSummary.skipped} skipped (duplicates)`;
        }

        setToastMessage(toastMsg);
        setToastType('success');
        setShowToast(true);

        // Reload passwords after restore
        await dispatch(
          loadPasswordsLazy(masterPasswordResult.password),
        ).unwrap();

        // Close the modal
        setShowBackupModal(false);
      } else {
        // Log the actual errors
        console.error(
          '❌ [PasswordsScreen] Restore failed with errors:',
          result.result.errors,
        );
        console.error(
          '❌ [PasswordsScreen] Restore warnings:',
          result.result.warnings,
        );

        // Throw error with actual details
        const errorMessage = result.result.errors?.length
          ? result.result.errors.join(', ')
          : 'Restore failed';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('❌ Restore failed:', error);
      setToastMessage(`Failed to restore backup: ${error.message || error}`);
      setToastType('error');
      setShowToast(true);
    } finally {
      // Clean up temporary file if it was created
      if (tempFilePath) {
        try {
          const RNFS = await import('react-native-fs');
          if (await RNFS.default.exists(tempFilePath)) {
            await RNFS.default.unlink(tempFilePath);
            console.log('🗑️ [PasswordsScreen] Cleaned up temp file');
          }
        } catch (cleanupError) {
          console.warn(
            '⚠️ [PasswordsScreen] Failed to cleanup temp file:',
            cleanupError,
          );
        }
      }
      setIsExportLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      console.log('🗑️ [PasswordsScreen] Deleting backup:', backupId);

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

      console.log('✅ [PasswordsScreen] Backup deleted successfully');

      // Reload available backups
      await loadAvailableBackups();
    } catch (error: any) {
      console.error('❌ Delete backup failed:', error);
      throw error; // Re-throw to be handled by the modal
    }
  };

  const loadAvailableBackups = async () => {
    console.log('🔵 [PasswordsScreen] loadAvailableBackups called!');
    try {
      console.log('📂 [PasswordsScreen] Loading available backups...');

      // Check if Google Drive is available
      const isDriveAvailable = await isGoogleDriveAvailable();
      console.log(
        '🔵 [PasswordsScreen] Google Drive available:',
        isDriveAvailable,
      );

      if (isDriveAvailable) {
        // Load backups from Google Drive
        console.log('🔵 [PasswordsScreen] Importing listGoogleDriveBackups...');
        const { listGoogleDriveBackups } = await import(
          '../../services/googleDriveService'
        );
        console.log('🔵 [PasswordsScreen] Calling listGoogleDriveBackups...');
        const driveResult = await listGoogleDriveBackups();
        console.log('🔵 [PasswordsScreen] Drive result:', driveResult);

        if (driveResult.success && driveResult.files) {
          console.log(
            '✅ [PasswordsScreen] Loaded Google Drive backups:',
            driveResult.files.length,
            'items',
          );

          // Convert Google Drive files to BackupInfo format
          const backups = driveResult.files
            .filter(
              file =>
                file.name.endsWith('.bak') || file.name.endsWith('.backup'),
            )
            .map(file => ({
              id: file.id,
              filename: file.name,
              createdAt: new Date(file.createdTime),
              size: parseInt(file.size || '0', 10),
              entryCount: 0, // Will be populated when backup is selected
              categoryCount: 0, // Will be populated when backup is selected
              encrypted: true, // Assume all backups are encrypted
              version: '1.0',
              appVersion: '1.0.0',
            }));

          console.log(
            '🔵 [PasswordsScreen] Converted backups:',
            backups.length,
            'items',
          );
          setAvailableBackups(backups as any);
          console.log('✅ [PasswordsScreen] State updated successfully');
        } else {
          console.log('⚠️ [PasswordsScreen] No backups found on Google Drive');
          setAvailableBackups([]);
        }
      } else {
        // Fallback to local backups if Google Drive is not available
        console.log('📂 [PasswordsScreen] Loading local backups...');
        const backups = await backupService.listBackups();
        console.log(
          '✅ [PasswordsScreen] Loaded local backups:',
          backups?.length || 0,
          'items',
        );
        setAvailableBackups(backups as any);
      }
    } catch (error) {
      console.error('❌ [PasswordsScreen] Failed to load backups:', error);
      setAvailableBackups([]); // Set empty array on error
    }
    console.log('🔵 [PasswordsScreen] loadAvailableBackups completed');
  };

  const renderPasswordItem = ({ item }: { item: Password }) => {
    console.log('🎯 [FlatList] Rendering item:', item.id, item.title);
    return (
      <PasswordEntryComponent
        password={item}
        onPress={() => handlePasswordPress(item)}
        onEdit={() => handlePasswordEdit(item)}
        onDelete={() => handlePasswordDelete(item)}
        onToggleFavorite={() => handleToggleFavorite(item)}
        selectable={bulkMode}
        selected={selectedPasswords.includes(item.id)}
        onSelect={_selected => togglePasswordSelection(item.id)}
        showActions={!bulkMode}
      />
    );
  };

  const renderSearchBar = () => {
    if (!showSearch) return null;

    return (
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search passwords..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.textSecondary}
          autoFocus
        />
        <TouchableOpacity
          onPress={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
          style={styles.searchClose}
        >
          <Ionicons
            name="close-outline"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderBulkActions = () => {
    if (!bulkMode) return null;

    return (
      <View
        style={[
          styles.bulkActions,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={selectAllPasswords}
          style={styles.bulkButton}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={[styles.bulkButtonText, { color: theme.primary }]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBulkDelete}
          style={styles.bulkButton}
          disabled={selectedPasswords.length === 0}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error} />
          <Text style={[styles.bulkButtonText, { color: theme.error }]}>
            Delete
          </Text>
        </TouchableOpacity>

        <Text style={[styles.selectionCount, { color: theme.textSecondary }]}>
          {selectedPasswords.length} selected
        </Text>
      </View>
    );
  };

  const renderActiveFilters = () => {
    const hasActiveFilters =
      currentFilters.weak ||
      currentFilters.compromised ||
      currentFilters.duplicate ||
      currentFilters.favorite ||
      currentFilters.categories.length > 0 ||
      currentSort !== 'createdAt-desc';

    if (!hasActiveFilters) return null;

    const getActiveFilterLabels = () => {
      const labels = [];

      if (currentFilters.weak) labels.push('Weak');
      if (currentFilters.compromised) labels.push('Compromised');
      if (currentFilters.duplicate) labels.push('Duplicates');
      if (currentFilters.favorite) labels.push('Favorites');

      currentFilters.categories.forEach(category => {
        labels.push(`${category}`);
      });

      return labels;
    };

    const getSortLabel = () => {
      switch (currentSort) {
        case 'title-asc':
          return 'Name (A-Z)';
        case 'title-desc':
          return 'Name (Z-A)';
        case 'createdAt-asc':
          return 'Date Created (Oldest First)';
        case 'createdAt-desc':
          return 'Date Created (Newest First)';
        case 'updatedAt-asc':
          return 'Date Modified (Oldest First)';
        case 'updatedAt-desc':
          return 'Date Modified (Newest First)';
        case 'strength-asc':
          return 'Weakest First';
        case 'strength-desc':
          return 'Strongest First';
        case 'category-asc':
          return 'Category (A-Z)';
        case 'category-desc':
          return 'Category (Z-A)';
        case 'username-asc':
          return 'Username (A-Z)';
        case 'username-desc':
          return 'Username (Z-A)';
        default:
          return null;
      }
    };

    const filterLabels = getActiveFilterLabels();
    const sortLabel = getSortLabel();

    return (
      <View
        style={[
          styles.activeFilters,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.activeFiltersContent}>
          {/* Sort chip always first */}
          {sortLabel && (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: theme.primary + '20' },
              ]}
              onPress={handleToggleSort}
              activeOpacity={0.7}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={14}
                color={theme.primary}
              />
              <Text style={[styles.filterChipText, { color: theme.primary }]}>
                {sortLabel}
              </Text>
            </TouchableOpacity>
          )}
          {/* Filter chips after sort */}
          {filterLabels.map((label, index) => (
            <View
              key={index}
              style={[
                styles.filterChip,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <Ionicons name="funnel-outline" size={14} color={theme.primary} />
              <Text style={[styles.filterChipText, { color: theme.primary }]}>
                {label}
              </Text>
            </View>
          ))}
          {/* Reset button at the end */}
          <TouchableOpacity
            onPress={handleResetFilters}
            style={[
              styles.resetButton,
              { backgroundColor: theme.primary + '10' },
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={theme.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderVaultHeader = () => (
    <View
      style={[styles.vaultHeaderContainer, { borderBottomColor: theme.border }]}
    >
      {/* Column 1: Vault Title */}
      <View style={styles.vaultTitleColumn}>
        <Text style={[styles.title, { color: theme.text }]}>🔐 Vault</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {filteredPasswords.length} passwords
          {statistics.weakPasswords > 0 && (
            <Text style={{ color: theme.warning }}>
              {' '}
              • {statistics.weakPasswords} weak
            </Text>
          )}
          {statistics.compromisedPasswords > 0 && (
            <Text style={{ color: theme.error }}>
              {' '}
              • {statistics.compromisedPasswords} compromised
            </Text>
          )}
        </Text>
      </View>

      {/* Column 2: Action Buttons */}
      <View style={styles.actionButtonsColumn}>{renderActionButtons()}</View>
    </View>
  );

  const renderActionButtons = () =>
    [
      // Search button
      !bulkMode && (
        <TouchableOpacity
          key="search"
          onPress={() => setShowSearch(!showSearch)}
          style={[styles.headerButton, { backgroundColor: theme.surface }]}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      ),

      // Sort button
      !bulkMode && (
        <TouchableOpacity
          key="sort"
          onPress={event => {
            // Measure button position before showing dropdown
            event.currentTarget.measure((x, y, width, height, pageX, pageY) => {
              setSortButtonPosition({ x: pageX + width, y: pageY + height });
              setShowSortSheet(true);
            });
          }}
          style={[
            styles.headerButton,
            {
              backgroundColor:
                currentSort !== 'createdAt-desc'
                  ? theme.primary + '30'
                  : theme.surface,
            },
          ]}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={20}
            color={
              currentSort !== 'createdAt-desc'
                ? theme.primary
                : theme.textSecondary
            }
          />
        </TouchableOpacity>
      ),

      // Filter button
      !bulkMode && (
        <TouchableOpacity
          key="filter"
          onPress={event => {
            // Measure button position before showing dropdown
            event.currentTarget.measure((x, y, width, height, pageX, pageY) => {
              setFilterButtonPosition({ x: pageX + width, y: pageY + height });
              setShowFilterSheet(true);
            });
          }}
          style={[
            styles.headerButton,
            {
              backgroundColor:
                currentFilters.weak ||
                currentFilters.compromised ||
                currentFilters.duplicate ||
                currentFilters.favorite ||
                currentFilters.categories.length > 0
                  ? theme.primary + '30'
                  : theme.surface,
            },
          ]}
        >
          <Ionicons
            name="funnel-outline"
            size={20}
            color={
              currentFilters.weak ||
              currentFilters.compromised ||
              currentFilters.duplicate ||
              currentFilters.favorite ||
              currentFilters.categories.length > 0
                ? theme.primary
                : theme.textSecondary
            }
          />
        </TouchableOpacity>
      ),

      // Add button
      !bulkMode && (
        <TouchableOpacity
          key="add"
          onPress={handleAddPassword}
          style={[styles.headerButton, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="add-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      ),

      // Export button
      !bulkMode && (
        <TouchableOpacity
          key="export"
          onPress={() => {
            // Skip ExportOptionsModal and go directly to file name input with default options
            const defaultFormat = {
              id: 'json',
              extension: 'json',
              name: 'JSON',
            };
            const defaultOptions = {
              includeNotes: true,
              includeCategories: true,
              includeTags: true,
              encrypt: false,
              encryptionPassword: '',
            };
            setPendingExport({
              entries: filteredPasswords,
              format: defaultFormat,
              options: defaultOptions,
            });
            setShowFileNameModal(true);
          }}
          style={[styles.headerButton, { backgroundColor: theme.surface }]}
        >
          <Ionicons
            name="share-outline"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      ),

      // Import button
      !bulkMode && (
        <TouchableOpacity
          key="import"
          onPress={handleImport}
          style={[
            styles.headerButton,
            { backgroundColor: theme.surface },
            isImportLoading && styles.importButtonLoading,
          ]}
          disabled={isImportLoading}
        >
          {isImportLoading ? (
            <ActivityIndicator size={20} color={theme.textSecondary} />
          ) : (
            <Ionicons
              name="download-outline"
              size={20}
              color={theme.textSecondary}
            />
          )}
        </TouchableOpacity>
      ),

      // Backup button
      !bulkMode && (
        <TouchableOpacity
          key="backup"
          onPress={() => setShowBackupModal(true)}
          style={[styles.headerButton, { backgroundColor: theme.surface }]}
        >
          <Ionicons
            name="cloud-outline"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      ),

      // Bulk mode button
      <TouchableOpacity
        key="bulk"
        onPress={toggleBulkMode}
        style={[
          styles.headerButton,
          { backgroundColor: bulkMode ? theme.primary : theme.surface },
        ]}
      >
        <Ionicons
          name="checkmark-done-outline"
          size={20}
          color={bulkMode ? '#FFFFFF' : theme.textSecondary}
        />
      </TouchableOpacity>,
    ].filter(Boolean);

  const renderEmptyState = () => {
    // Show loading indicator while passwords are being loaded
    if (isLoadingPasswords) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[
              styles.emptySubtitle,
              styles.loadingText,
              { color: theme.textSecondary },
            ]}
          >
            Loading your passwords...
          </Text>
        </View>
      );
    }

    // Show empty state when no passwords exist
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
          <Ionicons
            name="lock-closed-outline"
            size={48}
            color={theme.primary}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          Your Vault is Empty
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Add your first password to get started with secure storage
        </Text>
        <TouchableOpacity
          onPress={handleAddPassword}
          style={[
            styles.emptyButton,
            { backgroundColor: theme.card, borderColor: theme.primary },
          ]}
        >
          <Ionicons name="add-outline" size={20} color={theme.primary} />
          <Text style={[styles.emptyButtonText, { color: theme.primary }]}>
            Add Password
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  console.log('🎨 [Render] Rendering PasswordsScreen:', {
    passwordsCount: passwords.length,
    filteredCount: filteredPasswords.length,
    isLoadingPasswords,
    showEmptyState: filteredPasswords.length === 0,
  });

  // Debug: Log filtered passwords data
  console.log('📋 [FlatList Debug] Filtered passwords:', {
    count: filteredPasswords.length,
    firstItem: filteredPasswords[0]
      ? {
          id: filteredPasswords[0].id,
          title: filteredPasswords[0].title,
          hasPassword: !!filteredPasswords[0].password,
        }
      : null,
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {renderVaultHeader()}
      {renderSearchBar()}
      {renderActiveFilters()}
      {renderBulkActions()}

      {filteredPasswords.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredPasswords}
          renderItem={renderPasswordItem}
          keyExtractor={item => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={trackScrollActivity}
          scrollEventThrottle={400}
        />
      )}

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        visible={showToast}
        onHide={handleHideToast}
        duration={3000}
      />

      {/* Sort Dropdown */}
      <SortDropdown
        visible={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        currentSort={convertSortToObject(currentSort)}
        onSortChange={handleSortChange}
        anchorPosition={sortButtonPosition}
      />

      {/* Filter Dropdown */}
      <FilterDropdown
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        currentFilters={currentFilters}
        onFiltersChange={handleFiltersChange}
        categories={categories}
        anchorPosition={filterButtonPosition}
      />

      {/* Export Options Modal - DISABLED: Now using direct export with default options */}
      {/* <ExportOptionsModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        entries={filteredPasswords}
        onExport={handleExport}
      /> */}

      {/* File Name Input Modal */}
      <FileNameInputModal
        visible={showFileNameModal}
        onClose={() => {
          setShowFileNameModal(false);
          setPendingExport(null);
        }}
        onConfirm={handleFileNameConfirm}
        defaultFileName={`PasswordEpic_Export_${
          new Date().toISOString().split('T')[0]
        }`}
        fileExtension={pendingExport?.format?.extension || 'json'}
        title="Export File Name"
        description="Enter a name for your export file"
      />

      {/* Backup & Restore Modal */}
      <BackupRestoreModal
        visible={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onBackup={handleBackup}
        onRestore={handleRestore}
        onDeleteBackup={handleDeleteBackup}
        availableBackups={availableBackups}
        isLoading={isExportLoading}
        onShowToast={(message: string, type: 'success' | 'error') => {
          setToastMessage(message);
          setToastType(type);
          setShowToast(true);
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog {...confirmDialog} onCancel={hideConfirm} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  searchClose: {
    padding: 4,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 16,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectionCount: {
    fontSize: 14,
    marginLeft: 'auto',
  },
  list: {
    flex: 1,
    paddingTop: 8,
  },
  passwordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  passwordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  passwordInfo: {
    flex: 1,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  passwordWebsite: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  loadingText: {
    marginTop: 16,
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#38383A',
  },
  activeFiltersContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultTitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  actionButtonsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  // New 2-column layout styles
  vaultHeaderContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
    alignItems: 'flex-start',
  },
  vaultTitleColumn: {
    flex: 1,
    paddingRight: 16,
  },
  actionButtonsColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '60%',
  },
  importButtonLoading: {
    opacity: 0.6,
  },
});
