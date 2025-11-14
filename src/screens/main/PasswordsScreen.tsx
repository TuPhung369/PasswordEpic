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
  Share,
  Platform,
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
import {
  loadPasswordsLazy,
  decryptAllAndPrepareAutofill,
  updatePasswordLastUsed,
} from '../../store/slices/passwordsSlice';
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
import ImportDestinationModal from '../../components/ImportDestinationModal';
import GoogleDriveFilePickerModal from '../../components/GoogleDriveFilePickerModal';
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
  downloadFromGoogleDrive,
  listGoogleDriveBackups,
  deleteFromGoogleDrive,
  ensureGoogleDriveAuthenticated,
} from '../../services/googleDriveService';
import { encryptedDatabase } from '../../services/encryptedDatabaseService';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { autofillService } from '../../services/autofillService';
import { setIsInSetupFlow } from '../../store/slices/authSlice';
import RNFS from 'react-native-fs';

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

  // Autofill setup tracking - only check once on first load
  const autofillPromptShownRef = React.useRef(false);

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

  // Decryption password state for failed restores
  const [showDecryptionPasswordDialog, setShowDecryptionPasswordDialog] =
    useState(false);
  const [decryptionPassword, setDecryptionPassword] = useState('');
  const [pendingRestore, setPendingRestore] = useState<{
    backupId: string;
    options: any;
  } | null>(null);
  const [decryptionAttempts, setDecryptionAttempts] = useState(0);

  // Import state
  const [isImportLoading, setIsImportLoading] = useState(false);

  // Export destination state
  const [showExportDestinationModal, setShowExportDestinationModal] =
    useState(false);
  const [exportDestination, setExportDestination] = useState<
    'local' | 'drive' | 'drive-hidden' | null
  >(null);
  const [selectedExportFolder, setSelectedExportFolder] = useState<
    string | null
  >(null);

  // Import destination state
  const [showImportDestinationModal, setShowImportDestinationModal] =
    useState(false);
  const [selectedImportFolder, _setSelectedImportFolder] = useState<
    string | null
  >(null);

  // Google Drive file picker state
  const [showGoogleDriveFilePicker, setShowGoogleDriveFilePicker] =
    useState(false);
  const [googleDrivePickerIsHidden, setGoogleDrivePickerIsHidden] =
    useState(false);

  // Export success state
  const [showExportSuccessModal, setShowExportSuccessModal] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState('');
  const [exportedFileName, setExportedFileName] = useState('');

  // Import file confirmation state
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
  const [importedFilePath, setImportedFilePath] = useState('');
  const [importedFileName, setImportedFileName] = useState('');

  // Import file list state
  const [showImportFileListModal, setShowImportFileListModal] = useState(false);
  const [importFileList, setImportFileList] = useState<Array<{path: string; name: string; mtime?: number}>>([]);
  const [googleFileList, setGoogleFileList] = useState<Array<{path: string; name: string; mtime?: number}>>([]);
  const [googleHiddenFileList, setGoogleHiddenFileList] = useState<Array<{path: string; name: string; mtime?: number}>>([]);
  const [isLoadingImportFiles, setIsLoadingImportFiles] = useState(false);

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
        //console.log('🔐 [PasswordsScreen] Starting password load...');

        try {
          setIsLoadingPasswords(true);

          // Remove initial delay - rely on pre-warmed cache from AppNavigator
          // await new Promise(resolve => setTimeout(resolve, 300));

          // Get the master password (should be cached from AppNavigator pre-warming)
          //const mpStartTime = Date.now();
          const result = await getEffectiveMasterPassword();
          //const mpDuration = Date.now() - mpStartTime;

          // Debug log to see what we got
          // console.log('🔍 [PasswordsScreen] Master password result:', {
          //   success: result.success,
          //   hasPassword: !!result.password,
          //   passwordLength: result.password?.length || 0,
          //   duration: `${mpDuration}ms`,
          //   error: result.error,
          // });

          if (result.success && result.password) {
            //const loadStartTime = Date.now();
            await dispatch(loadPasswordsLazy(result.password)).unwrap();
            //const loadDuration = Date.now() - loadStartTime;
            //const totalDuration = Date.now() - screenStartTime;
            // console.log(
            //   `✅ [PasswordsScreen] Passwords loaded (load: ${loadDuration}ms, total: ${totalDuration}ms)`,
            // );

            // Decrypt all passwords and prepare autofill in background (non-blocking)
            // console.log(
            //   '🔄 [PasswordsScreen] Starting background autofill preparation...',
            // );
            dispatch(decryptAllAndPrepareAutofill(result.password))
              .unwrap()
              .then(() =>
                console.log(
                  '✅ [PasswordsScreen] Autofill preparation completed',
                ),
              )
              .catch((err: any) =>
                console.warn(
                  '⚠️ [PasswordsScreen] Autofill preparation failed:',
                  err,
                ),
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

              // Decrypt all passwords and prepare autofill in background (non-blocking)
              console.log(
                '🔄 [PasswordsScreen] Starting background autofill preparation on retry...',
              );
              dispatch(decryptAllAndPrepareAutofill(retryResult.password))
                .unwrap()
                .then(() =>
                  console.log(
                    '✅ [PasswordsScreen] Autofill preparation completed on retry',
                  ),
                )
                .catch((err: any) =>
                  console.warn(
                    '⚠️ [PasswordsScreen] Autofill preparation failed on retry:',
                    err,
                  ),
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

  // Check autofill status on first load and navigate to setup if needed
  useFocusEffect(
    React.useCallback(() => {
      const checkAndPromptAutofillSetup = async () => {
        // Only check once, and only on Android
        if (autofillPromptShownRef.current || Platform.OS !== 'android') {
          return;
        }

        autofillPromptShownRef.current = true;

        try {
          console.log('🔍 Checking autofill status on first login...');
          const isEnabled = await autofillService.isEnabled();

          if (!isEnabled) {
            console.log(
              '⚠️ Autofill not enabled - navigating directly to setup',
            );
            // Mark that user is in setup flow to prevent auto-lock during autofill configuration
            dispatch(setIsInSetupFlow(true));

            // Add a small delay to let the UI settle
            await new Promise(resolve => setTimeout(resolve, 500));

            // Navigate directly to Autofill Management screen (skip the prompt)
            (navigation as any).navigate('Settings', {
              screen: 'AutofillManagement',
            });
          } else {
            console.log('✅ Autofill already enabled - no setup needed');
          }
        } catch (error) {
          console.warn('⚠️ Failed to check autofill status:', error);
        }
      };

      checkAndPromptAutofillSetup();
    }, [dispatch, navigation]),
  );

  // Initialize export folder on mount
  useEffect(() => {
    const initializeExportFolder = async () => {
      try {
        const appDir =
          Platform.OS === 'android'
            ? RNFS.ExternalDirectoryPath
            : RNFS.DocumentDirectoryPath;
        console.log('📁 [PasswordsScreen] Initializing export folder:', appDir);
        setSelectedExportFolder(appDir);
      } catch (error) {
        console.error('❌ [PasswordsScreen] Failed to initialize export folder:', error);
      }
    };
    
    initializeExportFolder();
  }, []);

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
  const handleFileNameConfirm = async (
    fileName: string,
    destination?: 'local' | 'google' | 'google-hidden',
  ) => {
    console.log('🟢 [Export] handleFileNameConfirm called with:', {
      fileName,
      destination,
      currentExportDestination: exportDestination,
    });

    if (!pendingExport) return;

    // Convert modal destination to internal naming
    const destMap: Record<
      'local' | 'google' | 'google-hidden',
      'local' | 'drive' | 'drive-hidden'
    > = {
      local: 'local',
      google: 'drive',
      'google-hidden': 'drive-hidden',
    };

    // Use the provided destination or the current state
    const finalDestination = destination
      ? destMap[destination]
      : exportDestination;

    console.log('🟢 [Export] Final export destination:', {
      provided: destination,
      mapped: destination ? destMap[destination] : 'none',
      current: exportDestination,
      final: finalDestination,
    });

    if (!finalDestination) {
      console.log('❌ [Export] Aborting: No destination specified');
      return;
    }

    // Update state with the new destination
    if (destination) {
      setExportDestination(destMap[destination]);
    }

    const { entries, format, options } = pendingExport;

    try {
      setIsExportLoading(true);
      setShowFileNameModal(false);

      const exportOptions: any = {
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

      // Add destination folder for local exports
      if (exportDestination === 'local' && selectedExportFolder) {
        exportOptions.destinationFolder = selectedExportFolder;
        console.log('📁 [Export] Setting export folder:', {
          destinationFolder: selectedExportFolder,
          exportDestination,
        });
      } else if (exportDestination === 'local') {
        console.warn('⚠️ [Export] Local export selected but no folder set!');
      }

      const result = await importExportService.exportPasswords(
        entries,
        exportOptions,
      );

      console.log('🟢 [Export] Export completed:', {
        success: result.success,
        filePath: result.filePath,
        exportedCount: result.exportedCount,
        exportDestination,
        destinationFolderUsed: exportOptions.destinationFolder,
      });

      if (result.success) {
        let successMsg = `Successfully exported ${result.exportedCount} passwords`;

        // Check if export went to internal storage (fallback)
        if (
          finalDestination === 'local' &&
          selectedExportFolder &&
          result.filePath.includes('/data/user/')
        ) {
          successMsg += ' to internal storage';
        } else if (finalDestination === 'local') {
          successMsg += ' to selected folder';
        }

        // Handle destination
        if (
          finalDestination === 'drive' ||
          finalDestination === 'drive-hidden'
        ) {
          console.log('🟢 [Export] Starting Google Drive upload with:', {
            finalDestination,
            isPublic: finalDestination === 'drive',
            filePath: result.filePath,
          });
          // Check if Google Drive is available
          let isDriveAvailable = await isGoogleDriveAvailable();

          if (!isDriveAvailable) {
            const permissionResult = await requestDrivePermissions();
            if (permissionResult.success) {
              isDriveAvailable = true;
            } else {
              showAlert(
                'Google Drive Permission Required',
                'Please grant Google Drive access to upload exports. You may need to sign out and sign in again.',
              );
              // Fallback to local storage
              setToastMessage(successMsg + ' to local storage');
              setToastType('success');
              setShowToast(true);
              return;
            }
          }

          if (isDriveAvailable) {
            // Ensure authentication before uploading
            const authResult = await ensureGoogleDriveAuthenticated();
            if (!authResult.success) {
              showAlert(
                'Google Drive Permission Required',
                authResult.error || 'Please grant Google Drive access to upload exports.',
              );
              // Fallback to local storage
              setToastMessage(successMsg + ' to local storage');
              setToastType('success');
              setShowToast(true);
              return;
            }

            const isPublic = finalDestination === 'drive';
            console.log('🟢 [Export] Uploading to Google Drive:', {
              finalDestination,
              isPublic,
              filePath: result.filePath,
            });

            const uploadResult = await uploadToGoogleDrive(
              result.filePath,
              exportOptions.fileName || 'export',
              'application/octet-stream',
              isPublic,
            );

            console.log('🟢 [Export] Upload result:', {
              success: uploadResult.success,
              fileId: uploadResult.fileId,
              error: uploadResult.error,
            });

            if (uploadResult.success) {
              console.log('✅ [Export] Upload successful, deleting temp file:', result.filePath);
              // Delete local temporary file after successful upload
              try {
                await RNFS.unlink(result.filePath);
                console.log('✅ [Export] Temporary file deleted successfully');
              } catch (deleteError) {
                console.warn('⚠️ [Export] Failed to delete temp file:', deleteError);
              }

              const driveMsg = isPublic
                ? 'Google Drive (My Drive)'
                : 'Google Drive (Automatic Backup)';
              console.log('✅ [Export] Setting success message for:', driveMsg);
              setToastMessage(
                `Successfully exported ${result.exportedCount} passwords to ${driveMsg}`,
              );
              setToastType('success');
              setShowToast(true);
            } else {
              console.error('❌ [Export] Upload failed:', uploadResult.error);
              throw new Error(
                uploadResult.error || 'Failed to upload to Google Drive',
              );
            }
          }
        } else {
          // Local storage (default)
          setExportedFilePath(result.filePath);
          setExportedFileName(exportOptions.fileName);
          setShowExportSuccessModal(true);
        }
      } else {
        const errorMsg =
          result.errors && result.errors.length > 0
            ? result.errors.join(', ')
            : 'Export operation failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
      let errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      if (
        errorMessage.includes('scoped storage') ||
        errorMessage.includes('storage restrictions')
      ) {
        errorMessage =
          'Cannot write to selected folder. Try selecting a different folder or use internal storage.';
      } else if (
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('EACCES')
      ) {
        errorMessage =
          'Permission denied. Please ensure the folder has write permissions or try a different location.';
      }

      setToastMessage(`Export failed: ${errorMessage}`);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsExportLoading(false);
      setPendingExport(null);
      setExportDestination(null);
      setSelectedExportFolder(null);
    }
  };

  const handleImportDestinationConfirm = async (
    destination: 'local' | 'google' | 'google-hidden',
    filePath?: string,
  ) => {
    console.log('🚀 [DEBUG] handleImportDestinationConfirm called with:', {
      destination,
      filePath,
    });

    setShowImportDestinationModal(false);

    if (filePath) {
      const fileName = filePath.split('/').pop() || 'selected file';
      
      if (destination === 'local') {
        handleSelectImportFile(filePath, fileName);
      } else if (destination === 'google') {
        setGoogleDrivePickerIsHidden(false);
        handleGoogleDriveFileSelected(filePath, fileName);
      } else if (destination === 'google-hidden') {
        setGoogleDrivePickerIsHidden(true);
        handleGoogleDriveFileSelected(filePath, fileName);
      }
      return;
    }

    if (destination === 'google') {
      setGoogleDrivePickerIsHidden(false);
      setShowGoogleDriveFilePicker(true);
      return;
    }

    if (destination === 'google-hidden') {
      setGoogleDrivePickerIsHidden(true);
      setShowGoogleDriveFilePicker(true);
      return;
    }

    await handleImport(destination);
  };

  const handleLoadImportFiles = async (destination: 'local' | 'google' | 'google-hidden') => {
    console.log('🚀 [DEBUG] handleLoadImportFiles called with destination:', destination);
    setIsLoadingImportFiles(true);

    // Clear other destinations' file lists to prevent stale data display
    if (destination === 'local') {
      setGoogleFileList([]);
      setGoogleHiddenFileList([]);
    } else if (destination === 'google') {
      setImportFileList([]);
      setGoogleHiddenFileList([]);
    } else if (destination === 'google-hidden') {
      setImportFileList([]);
      setGoogleFileList([]);
    }

    try {
      if (destination === 'local') {
        console.log('📂 [Local Import] Listing files from app directory');
        
        try {
          // Use app-specific external directory (same as where exports are saved)
          // This is: /storage/emulated/0/Android/data/com.passwordepic.mobile/files/
          const filesDir = Platform.OS === 'android' 
            ? RNFS.ExternalDirectoryPath 
            : RNFS.DocumentDirectoryPath;
          console.log('📁 [Local Import] Files directory:', filesDir);

          // Check if directory exists
          const dirExists = await RNFS.exists(filesDir);
          if (!dirExists) {
            console.log('ℹ️ [Local Import] Files directory does not exist');
            setImportFileList([]);
            setIsLoadingImportFiles(false);
            return;
          }

          // List all files in the directory
          const filenames = await RNFS.readdir(filesDir);
          console.log('📋 [Local Import] Found files:', filenames.length);

          // Filter for JSON files and get metadata
          const jsonFilesWithStats = await Promise.all(
            filenames
              .filter(filename => filename.endsWith('.json'))
              .map(async filename => {
                const filePath = `${filesDir}/${filename}`;
                const stats = await RNFS.stat(filePath);
                return {
                  name: filename,
                  path: filePath,
                  mtime: stats.mtime.getTime(),
                };
              })
          );

          // Sort by modification time, newest first
          jsonFilesWithStats.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

          console.log('📋 [Local Import] JSON files found:', jsonFilesWithStats.length);

          const fileEntries = jsonFilesWithStats;

          console.log('📋 [Local Import] File entries:', fileEntries);
          setImportFileList(fileEntries);
        } catch (pickerError) {
          console.error('❌ [Local Import] File listing error:', pickerError);
          setToastMessage('Failed to list files. Please try again.');
          setToastType('error');
          setShowToast(true);
          setImportFileList([]);
        }
      } else if (destination === 'google' || destination === 'google-hidden') {
        // Ensure authentication before calling Google Drive API
        const authResult = await ensureGoogleDriveAuthenticated();
        if (!authResult.success) {
          console.warn(
            '⚠️ [PasswordsScreen] Authentication failed:',
            authResult.error,
          );
          const isPublic = destination === 'google';
          if (isPublic) {
            setGoogleFileList([]);
          } else {
            setGoogleHiddenFileList([]);
          }
          return;
        }

        const isPublic = destination === 'google';
        const result = await listGoogleDriveBackups(isPublic);

        if (result.success && result.files) {
          const driveFiles = result.files
            .filter(file => file.name.endsWith('.json'))
            .map((file) => ({
              name: file.name,
              path: file.id,
              mtime: new Date(file.modifiedTime).getTime(),
            }));

          const sortedFiles = driveFiles.sort(
            (a, b) => (b.mtime || 0) - (a.mtime || 0)
          );

          console.log(`📋 Found ${sortedFiles.length} files in ${isPublic ? 'Google Drive' : 'Google Hidden'}`);
          console.log('📋 Google files to set:', sortedFiles.map(f => ({ name: f.name, path: f.path })));

          if (isPublic) {
            setGoogleFileList(sortedFiles);
          } else {
            setGoogleHiddenFileList(sortedFiles);
          }
        } else {
          console.error('❌ Failed to list Google Drive files:', result.error);
          if (destination === 'google') {
            setGoogleFileList([]);
          } else {
            setGoogleHiddenFileList([]);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to load import files:', error);
      setToastMessage('Failed to load import files. Please try again.');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsLoadingImportFiles(false);
    }
  };

  const handleDeleteFile = async (
    destination: 'local' | 'google' | 'google-hidden',
    filePath: string,
  ): Promise<boolean> => {
    try {
      if (destination === 'local') {
        console.log('🔵 [Delete] Deleting local file:', filePath);
        await RNFS.unlink(filePath);
        setImportFileList(prev => prev.filter(f => f.path !== filePath));
        console.log('✅ [Delete] Local file deleted successfully');
        return true;
      } else if (destination === 'google') {
        console.log('🔵 [Delete] Deleting Google Drive file:', filePath);
        const result = await deleteFromGoogleDrive(filePath);
        if (result.success) {
          setGoogleFileList(prev => prev.filter(f => f.path !== filePath));
          console.log('✅ [Delete] Google Drive file deleted successfully');
          return true;
        } else {
          console.error('❌ [Delete] Failed to delete from Google Drive:', result.error);
          setToastMessage(`Failed to delete file: ${result.error}`);
          setToastType('error');
          setShowToast(true);
          return false;
        }
      } else if (destination === 'google-hidden') {
        console.log('🔵 [Delete] Deleting Google Hidden file:', filePath);
        const result = await deleteFromGoogleDrive(filePath);
        if (result.success) {
          setGoogleHiddenFileList(prev => prev.filter(f => f.path !== filePath));
          console.log('✅ [Delete] Google Hidden file deleted successfully');
          return true;
        } else {
          console.error('❌ [Delete] Failed to delete from Google Hidden:', result.error);
          setToastMessage(`Failed to delete file: ${result.error}`);
          setToastType('error');
          setShowToast(true);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('❌ [Delete] Error deleting file:', error);
      setToastMessage(error instanceof Error ? error.message : 'Failed to delete file');
      setToastType('error');
      setShowToast(true);
      return false;
    }
  };

  const handleGoogleDriveFileSelected = async (
    fileId: string,
    fileName: string,
  ) => {
    try {
      setShowGoogleDriveFilePicker(false);
      setIsImportLoading(true);

      let isDriveAvailable = await isGoogleDriveAvailable();
      if (!isDriveAvailable) {
        const permissionResult = await requestDrivePermissions();
        if (!permissionResult.success) {
          setToastMessage(
            'Google Drive authentication failed. Please try again.',
          );
          setToastType('error');
          setShowToast(true);
          setIsImportLoading(false);
          return;
        }
      }

      // Create a temporary file path for downloading
      const tempFilePath = `${
        RNFS.DocumentDirectoryPath
      }/temp_import_${Date.now()}.json`;

      // Download the file from Google Drive
      console.log('🔵 [Import] Downloading from Google Drive:', fileName);
      const downloadResult = await downloadFromGoogleDrive(
        fileId,
        tempFilePath,
      );

      if (!downloadResult.success) {
        throw new Error(
          downloadResult.error || 'Failed to download file from Google Drive',
        );
      }

      console.log('✅ [Import] File downloaded successfully');

      // Get current master password for decryption
      const masterPasswordResult = await getEffectiveMasterPassword();
      if (!masterPasswordResult.success) {
        setToastMessage(
          'Master password not found. Please log out and log back in.',
        );
        setToastType('error');
        setShowToast(true);
        setIsImportLoading(false);

        // Clean up temp file
        try {
          await RNFS.unlink(tempFilePath);
        } catch (e) {
          console.warn('Failed to delete temp file:', e);
        }
        return;
      }

      const importResult = await importExportService.importPasswords(
        tempFilePath,
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
          `✅ Import successful! ${importResult.importedCount} passwords imported${importResult.skippedCount > 0 ? `, ${importResult.skippedCount} duplicates skipped` : ''}`,
        );
        setToastType('success');
        setShowToast(true);
      } else {
        const errorMsg =
          importResult.errors && importResult.errors.length > 0
            ? `Failed to import: ${importResult.errors[0].error}`
            : `Failed to import from ${fileName}. File might be corrupted or encrypted with different password.`;
        setToastMessage(errorMsg);
        setToastType('error');
        setShowToast(true);
      }

      // Clean up temp file
      try {
        await RNFS.unlink(tempFilePath);
      } catch (e) {
        console.warn('Failed to delete temp file:', e);
      }
    } catch (error: any) {
      console.error('❌ [Import] Google Drive import error:', error);
      setToastMessage(error?.message || 'Failed to import from Google Drive');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleImportWithFolder = async (folderPath: string) => {
    try {
      setIsImportLoading(true);
      console.log('🚀 [DEBUG] handleImportWithFolder called with path:', folderPath);

      // List .json files from the folder
      try {
        console.log('📂 Attempting to read directory:', folderPath);
        // List files in folder
        const fileNames = await RNFS.readdir(folderPath);
        console.log('📂 Raw files from RNFS.readdir:', fileNames);
        
        // Get metadata for each JSON file
        const filesWithMetadata = await Promise.all(
          fileNames
            .filter(name => name.endsWith('.json'))
            .map(async (name) => {
              const filePath = `${folderPath}/${name}`;
              try {
                const stat = await RNFS.stat(filePath);
                return {
                  name,
                  path: filePath,
                  mtime: stat.mtime.getTime(),
                };
              } catch {
                return {
                  name,
                  path: filePath,
                  mtime: 0,
                };
              }
            })
        );
        
        const jsonFiles = filesWithMetadata.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
        
        console.log(`📋 Found ${jsonFiles.length} .json files in folder`);
        console.log('📋 Filtered JSON files:', jsonFiles.map(f => ({ name: f.name, path: f.path })));
        
        if (jsonFiles.length === 0) {
          console.log('❌ [DEBUG] No JSON files found');
          setToastMessage('No .json files found. Please export passwords first.');
          setToastType('error');
          setShowToast(true);
          setIsImportLoading(false);
          return;
        }
        
        // Show the file list modal
        setImportFileList(jsonFiles);
        setShowImportFileListModal(true);
        console.log('✅ [DEBUG] Showing file list modal with', jsonFiles.length, 'files');
      } catch (readError: any) {
        console.error('❌ Failed to read folder:', readError);
        console.error('❌ [DEBUG] Error details:', readError.message);
        setToastMessage('Failed to read import folder. Please try again.');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error: any) {
      console.error('❌ [Import] File selection error:', error);

      setToastMessage(
        error?.message || 'An error occurred while selecting the file',
      );
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleSelectImportFile = (filePath: string, fileName: string) => {
    console.log('✅ [DEBUG] File selected from list:', filePath);
    setShowImportFileListModal(false);
    setShowImportDestinationModal(false);
    setImportedFilePath(filePath);
    setImportedFileName(fileName);
    setShowImportConfirmModal(true);
  };

  const handleImport = async (
    _source?: 'local' | 'google' | 'google-hidden',
  ) => {
    try {
      setIsImportLoading(true);
      console.log('🚀 [DEBUG] handleImport called, selectedImportFolder:', selectedImportFolder);

      let filePath: string;

      // For local import from app files directory
      if (selectedImportFolder) {
        console.log('✅ [DEBUG] selectedImportFolder is set, reading from:', selectedImportFolder);
        await handleImportWithFolder(selectedImportFolder);
        return;
      }

      // Fallback to system file picker if no folder selected
      console.log('⚠️ [DEBUG] selectedImportFolder is empty/null, using FilePicker fallback');
      filePath = await FilePicker.pickFileWithOptions({ 
        fileType: 'application/json',
      });

      // Handle user cancellation (returns empty string)
      if (!filePath || filePath.trim() === '') {
        console.log('ℹ️ [Import] File selection cancelled by user');
        setIsImportLoading(false);
        return;
      }

      console.log('🔍 [Import] Selected file:', filePath);

      // Extract filename for display
      const fileName = filePath.split('/').pop() || 'selected file';

      // Set the file path and show confirmation modal instead of immediately importing
      setImportedFilePath(filePath);
      setImportedFileName(fileName);
      setShowImportConfirmModal(true);
    } catch (error: any) {
      console.error('❌ [Import] File selection error:', error);

      setToastMessage(
        error?.message || 'An error occurred while selecting the file',
      );
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsImportLoading(false);
    }
  };

  const handleImportConfirmed = async () => {
    try {
      setShowImportConfirmModal(false);
      setIsImportLoading(true);

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

      const importResult = await importExportService.importPasswords(
        importedFilePath,
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
          `✅ Import successful! ${importResult.importedCount} passwords imported${importResult.skippedCount > 0 ? `, ${importResult.skippedCount} duplicates skipped` : ''}`,
        );
        setToastType('success');
        setShowToast(true);

        // Clear import state
        setImportedFilePath('');
        setImportedFileName('');
      } else {
        const errorMsg =
          importResult.errors && importResult.errors.length > 0
            ? `Failed to import: ${importResult.errors[0].error}`
            : `Failed to import from ${importedFileName}. File might be corrupted or encrypted with different password.`;
        setToastMessage(errorMsg);
        setToastType('error');
        setShowToast(true);
      }
    } catch (error: any) {
      console.error('❌ [Import] Unexpected error:', error);

      setToastMessage(
        error?.message || 'An unexpected error occurred during import',
      );
      setToastType('error');
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
            // Ensure authentication before uploading
            const authResult = await ensureGoogleDriveAuthenticated();
            if (!authResult.success) {
              showAlert(
                'Google Drive Permission Required',
                authResult.error || 'Please grant Google Drive access to upload backups.',
              );
              return;
            }

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

        let isDriveAvailable = await isGoogleDriveAvailable();
        if (!isDriveAvailable) {
          const permissionResult = await requestDrivePermissions();
          if (!permissionResult.success) {
            throw new Error('Failed to authenticate with Google Drive for backup download');
          }
        }

        // Create temp file path
        tempFilePath = `${
          RNFS.CachesDirectoryPath
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
        restoreDomains: options.restoreDomains,
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

        // Restore trusted domains if requested
        if (
          options.restoreDomains &&
          result.data?.domains &&
          result.data.domains.length > 0
        ) {
          console.log(
            `🔵 [PasswordsScreen] Restoring ${result.data.domains.length} trusted domains...`,
          );
          const domainRestored = await backupService.restoreTrustedDomains(
            result.data.domains,
          );
          if (domainRestored) {
            console.log(
              '✅ [PasswordsScreen] Trusted domains restored successfully',
            );
          } else {
            console.warn(
              '⚠️ [PasswordsScreen] Failed to restore trusted domains',
            );
          }
        }

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
      const errorMsg = error.message || String(error);

      // Check if it's a decryption password error
      if (
        errorMsg.includes('Invalid decryption password') ||
        errorMsg.includes('Authentication tag verification failed')
      ) {
        console.log(
          '🔐 [PasswordsScreen] Decryption failed, asking for password...',
        );
        // Save pending restore and show decryption password dialog
        setPendingRestore({ backupId, options });
        setDecryptionPassword('');
        setDecryptionAttempts(0);
        setShowDecryptionPasswordDialog(true);

        // Still clean up temp file if needed
        if (tempFilePath) {
          try {
            if (await RNFS.exists(tempFilePath)) {
              await RNFS.unlink(tempFilePath);
            }
          } catch (cleanupError) {
            console.warn(
              '⚠️ [PasswordsScreen] Failed to cleanup temp file:',
              cleanupError,
            );
          }
        }
      } else {
        setToastMessage(`Failed to restore backup: ${errorMsg}`);
        setToastType('error');
        setShowToast(true);
      }
    } finally {
      // Clean up temporary file if it was created (if not already cleaned)
      if (tempFilePath) {
        try {
          if (await RNFS.exists(tempFilePath)) {
            await RNFS.unlink(tempFilePath);
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

  // Handle restore with custom decryption password
  const handleRestoreWithPassword = async () => {
    if (!pendingRestore || !decryptionPassword.trim()) {
      setToastMessage('Please enter a decryption password');
      setToastType('error');
      setShowToast(true);
      return;
    }

    let tempFilePath: string | null = null;

    try {
      setIsExportLoading(true);
      setDecryptionAttempts(prev => prev + 1);

      // Get the backup
      const backup = availableBackups.find(
        (b: any) => b.id === pendingRestore.backupId,
      );
      if (!backup) {
        throw new Error('Backup not found');
      }

      let filePath = (backup as any).filePath;

      if (!filePath) {
        // This is a Google Drive backup, download it first
        console.log('🔵 [PasswordsScreen] Downloading from Google Drive...');

        let isDriveAvailable = await isGoogleDriveAvailable();
        if (!isDriveAvailable) {
          const permissionResult = await requestDrivePermissions();
          if (!permissionResult.success) {
            throw new Error('Failed to authenticate with Google Drive for backup download');
          }
        }

        tempFilePath = `${
          RNFS.CachesDirectoryPath
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

        filePath = tempFilePath;
      }

      // Create restore options with custom decryption password
      const restoreOptions = {
        mergeStrategy: pendingRestore.options.mergeWithExisting
          ? ('merge' as const)
          : ('replace' as const),
        decryptionPassword: decryptionPassword,
        restoreSettings: pendingRestore.options.restoreSettings,
        restoreCategories: pendingRestore.options.restoreCategories,
        restoreDomains: pendingRestore.options.restoreDomains,
        overwriteDuplicates: pendingRestore.options.overwriteDuplicates,
      };

      console.log(
        '🔵 [PasswordsScreen] Retrying restore with custom password...',
      );

      const result = await backupService.restoreFromBackup(
        filePath,
        restoreOptions,
      );

      if (result.result.success) {
        console.log('✅ [PasswordsScreen] Restore successful');

        // Get master password for reloading passwords
        const masterPasswordResult = await getEffectiveMasterPassword();
        if (masterPasswordResult.success && masterPasswordResult.password) {
          await dispatch(
            loadPasswordsLazy(masterPasswordResult.password),
          ).unwrap();
        }

        setToastMessage('Backup restored successfully');
        setToastType('success');
        setShowToast(true);

        // Close dialogs
        setShowDecryptionPasswordDialog(false);
        setShowBackupModal(false);
        setPendingRestore(null);
      } else {
        const errorMsg = result.result.errors?.length
          ? result.result.errors.join(', ')
          : 'Restore failed';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Restore with password failed:', error);

      if (decryptionAttempts < 3) {
        setToastMessage(
          `Incorrect password. Attempts: ${decryptionAttempts}/3`,
        );
      } else {
        setToastMessage('Max password attempts reached');
        setShowDecryptionPasswordDialog(false);
        setPendingRestore(null);
      }

      setToastType('error');
      setShowToast(true);
    } finally {
      // Clean up temporary file if it was created
      if (tempFilePath) {
        try {
          if (await RNFS.exists(tempFilePath)) {
            await RNFS.unlink(tempFilePath);
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

  const handleShareExportPath = async () => {
    try {
      await Share.share({
        message: `File location:\n${exportedFilePath}\n\nFile: ${exportedFileName}`,
        title: 'Export File Location',
      });
    } catch (error) {
      console.warn('Failed to share path:', error);
      setToastMessage('Failed to share path');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      console.log('🗑️ [PasswordsScreen] Deleting backup:', backupId);

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

  const handleSelectExportFolder = async () => {
    try {
      const appDir =
        Platform.OS === 'android'
          ? RNFS.ExternalDirectoryPath
          : RNFS.DocumentDirectoryPath;
      
      console.log('📁 Using app default export folder:', appDir);
      setSelectedExportFolder(appDir);
      setExportDestination('local');
    } catch (error) {
      console.error('❌ Failed to set folder:', error);
      setToastMessage('Failed to set export folder. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  const getFolderDisplayName = (folderUri: string | null): string => {
    if (!folderUri) return 'App Storage';

    const appDir =
      Platform.OS === 'android'
        ? RNFS.ExternalDirectoryPath
        : RNFS.DocumentDirectoryPath;
    
    if (folderUri === appDir) {
      return 'App Storage (Default)';
    }

    if (folderUri.startsWith('content://')) {
      const parts = folderUri.split('/');
      const treeIndex = parts.indexOf('tree');
      if (treeIndex !== -1 && treeIndex + 1 < parts.length) {
        const encoded = parts[treeIndex + 1];
        const decoded = decodeURIComponent(encoded);
        return decoded.split(':').pop() || decoded;
      }
    } else {
      return folderUri.split('/').pop() || folderUri;
    }

    return folderUri;
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
        // Ensure authentication before calling Google Drive API
        const authResult = await ensureGoogleDriveAuthenticated();
        if (!authResult.success) {
          console.warn(
            '⚠️ [PasswordsScreen] Authentication failed:',
            authResult.error,
          );
          setAvailableBackups([]);
          return;
        }

        // Load backups from Google Drive
        console.log('🔵 [PasswordsScreen] Calling listGoogleDriveBackups...');
        const driveResult = await listGoogleDriveBackups(true);
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
        onPasswordUsed={async () => {
          console.log(
            '👁️ [PasswordsScreen] onPasswordUsed callback triggered for:',
            item.id,
          );

          // 1️⃣ Update Redux state immediately
          dispatch(updatePasswordLastUsed(item.id));

          // 2️⃣ Also persist to storage
          try {
            const masterPasswordResult = await getEffectiveMasterPassword();
            if (
              !masterPasswordResult.success ||
              !masterPasswordResult.password
            ) {
              console.warn(
                '⚠️ [PasswordsScreen] Cannot get master password for persistence',
              );
              return;
            }

            // Update the item directly (it's already in memory)
            const updatedPassword = {
              ...item,
              lastUsed: new Date(),
            };

            console.log(
              '💾 [PasswordsScreen] Saving password with updated lastUsed to storage...',
            );
            await encryptedDatabase.savePasswordEntry(
              updatedPassword,
              masterPasswordResult.password,
            );
            console.log(
              '✅ [PasswordsScreen] Password with lastUsed saved to storage',
            );
          } catch (error) {
            console.error(
              '❌ [PasswordsScreen] Failed to persist password usage:',
              error,
            );
          }
        }}
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
        <Text style={[styles.title, { color: theme.text }]}>Vault</Text>
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
            // Show destination selector first
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
            setExportDestination(null);
            setSelectedExportFolder(null);
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
          onPress={() => {
            setShowImportDestinationModal(true);
            handleLoadImportFiles('local');
          }}
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
          contentContainerStyle={styles.listContentContainer}
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

      {/* Export Destination Modal */}
      <ConfirmDialog
        visible={showExportDestinationModal}
        title="Export Destination"
        message="Where would you like to save your export?"
        onConfirm={() => {
          if (
            exportDestination === 'drive' ||
            exportDestination === 'drive-hidden'
          ) {
            setShowExportDestinationModal(false);
            setShowFileNameModal(true);
          } else if (exportDestination === 'local' && selectedExportFolder) {
            setShowExportDestinationModal(false);
            setShowFileNameModal(true);
          } else if (exportDestination === 'local' && !selectedExportFolder) {
            setToastMessage('Please select a folder first');
            setToastType('error');
            setShowToast(true);
          }
        }}
        onCancel={() => {
          setShowExportDestinationModal(false);
          setPendingExport(null);
          setExportDestination(null);
          setSelectedExportFolder(null);
        }}
        confirmText="Continue"
        cancelText="Cancel"
        confirmStyle="default"
      >
        <View style={styles.exportModalContainer}>
          <TouchableOpacity
            onPress={handleSelectExportFolder}
            style={[
              styles.destinationOption,
              {
                backgroundColor:
                  exportDestination === 'local'
                    ? theme.primary + '20'
                    : theme.surface,
                borderColor:
                  exportDestination === 'local' ? theme.primary : theme.border,
              },
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={24}
              color={theme.text}
              style={styles.destinationOptionIcon}
            />
            <View style={styles.destinationOptionContent}>
              <Text
                style={[styles.destinationOptionTitle, { color: theme.text }]}
              >
                Local Storage
              </Text>
              <Text
                style={[
                  styles.destinationOptionSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                {getFolderDisplayName(selectedExportFolder)}
              </Text>
            </View>
            {exportDestination === 'local' && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.primary}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setExportDestination('drive')}
            style={[
              styles.destinationOption,
              {
                backgroundColor:
                  exportDestination === 'drive'
                    ? theme.primary + '20'
                    : theme.surface,
                borderColor:
                  exportDestination === 'drive' ? theme.primary : theme.border,
              },
            ]}
          >
            <Ionicons
              name="cloud-outline"
              size={24}
              color={theme.text}
              style={styles.destinationOptionIcon}
            />
            <View style={styles.destinationOptionContent}>
              <Text
                style={[styles.destinationOptionTitle, { color: theme.text }]}
              >
                Google Drive (My Drive)
              </Text>
              <Text
                style={[
                  styles.destinationOptionSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                Visible in your Google Drive
              </Text>
            </View>
            {exportDestination === 'drive' && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.primary}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setExportDestination('drive-hidden')}
            style={[
              styles.destinationOption,
              {
                backgroundColor:
                  exportDestination === 'drive-hidden'
                    ? theme.primary + '20'
                    : theme.surface,
                borderColor:
                  exportDestination === 'drive-hidden'
                    ? theme.primary
                    : theme.border,
              },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={24}
              color={theme.text}
              style={styles.destinationOptionIcon}
            />
            <View style={styles.destinationOptionContent}>
              <Text
                style={[styles.destinationOptionTitle, { color: theme.text }]}
              >
                Google Drive (Automatic)
              </Text>
              <Text
                style={[
                  styles.destinationOptionSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                Hidden backup folder (auto-restore)
              </Text>
            </View>
            {exportDestination === 'drive-hidden' && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.primary}
              />
            )}
          </TouchableOpacity>
        </View>
      </ConfirmDialog>

      {/* File Name Input Modal */}
      <FileNameInputModal
        visible={showFileNameModal}
        onClose={() => {
          setShowFileNameModal(false);
          setPendingExport(null);
          setExportDestination(null);
          setSelectedExportFolder(null);
        }}
        onConfirm={handleFileNameConfirm}
        defaultFileName={`PasswordEpic_Export_${
          new Date().toISOString().split('T')[0]
        }`}
        fileExtension={pendingExport?.format?.extension || 'json'}
        title="Export File Name"
        description="Enter a name for your export file"
        showDestinationSelector={true}
        isImport={false}
      />

      {/* Import Destination Modal */}
      <ImportDestinationModal
        visible={showImportDestinationModal}
        onClose={() => {
          setShowImportDestinationModal(false);
          setImportFileList([]);
          setGoogleFileList([]);
          setGoogleHiddenFileList([]);
        }}
        onConfirm={handleImportDestinationConfirm}
        onSelectDestination={handleLoadImportFiles}
        onDeleteFile={handleDeleteFile}
        localFileList={importFileList}
        googleFileList={googleFileList}
        googleHiddenFileList={googleHiddenFileList}
        isLoadingFiles={isLoadingImportFiles}
      />

      {/* Google Drive File Picker Modal */}
      <GoogleDriveFilePickerModal
        visible={showGoogleDriveFilePicker}
        onClose={() => setShowGoogleDriveFilePicker(false)}
        onConfirm={handleGoogleDriveFileSelected}
        isHidden={googleDrivePickerIsHidden}
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

      {/* Decryption Password Dialog */}
      <ConfirmDialog
        visible={showDecryptionPasswordDialog}
        title="Enter Decryption Password"
        message="The backup is encrypted with a different password. Please enter the password used when creating this backup."
        onConfirm={handleRestoreWithPassword}
        onCancel={() => {
          setShowDecryptionPasswordDialog(false);
          setPendingRestore(null);
          setDecryptionPassword('');
        }}
        confirmText="Restore"
        confirmStyle="default"
      >
        <TextInput
          style={[
            styles.decryptionPasswordInput,
            { borderColor: theme.border, color: theme.text },
          ]}
          placeholder="Enter backup decryption password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={decryptionPassword}
          onChangeText={setDecryptionPassword}
          editable={!isExportLoading}
        />
      </ConfirmDialog>

      {/* Export Success Modal */}
      <ConfirmDialog
        visible={showExportSuccessModal}
        title="✓ Export Successful"
        message={`Your passwords have been exported as:\n\n${exportedFileName}`}
        onConfirm={() => {
          setShowExportSuccessModal(false);
          setExportedFilePath('');
          setExportedFileName('');
        }}
        onCancel={() => {
          setShowExportSuccessModal(false);
          setExportedFilePath('');
          setExportedFileName('');
        }}
        confirmText="Done"
        cancelText=""
        confirmStyle="default"
      >
        <View style={styles.exportSuccessContainer}>
          <View
            style={[
              styles.exportPathBox,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="document-outline"
              size={20}
              color={theme.primary}
              style={styles.exportPathIcon}
            />
            <Text
              style={[styles.exportPathText, { color: theme.textSecondary }]}
              numberOfLines={3}
            >
              {exportedFilePath}
            </Text>
            <TouchableOpacity
              onPress={handleShareExportPath}
              style={styles.shareIconButton}
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ConfirmDialog>

      {/* Import File List Modal */}
      <ConfirmDialog
        visible={showImportFileListModal}
        title="Select Export File"
        message="Choose which export file to import:"
        onConfirm={() => setShowImportFileListModal(false)}
        onCancel={() => setShowImportFileListModal(false)}
        confirmText="Cancel"
        cancelText=""
        confirmStyle="default"
      >
        <View style={[styles.fileListContainer, { backgroundColor: theme.surface }]}>
          <FlatList
            data={importFileList}
            keyExtractor={(item) => item.path}
            scrollEnabled
            nestedScrollEnabled
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.fileListItem,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => handleSelectImportFile(item.path, item.name)}
              >
                <View style={styles.fileListItemContent}>
                  <Ionicons
                    name="document-outline"
                    size={20}
                    color={theme.primary}
                    style={styles.fileListItemIcon}
                  />
                  <View style={styles.fileListItemText}>
                    <Text
                      style={[styles.fileListItemName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.mtime && (
                      <Text
                        style={[styles.fileListItemDate, { color: theme.textSecondary }]}
                      >
                        {new Date(item.mtime).toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          />
        </View>
      </ConfirmDialog>

      {/* Import Confirmation Modal */}
      <ConfirmDialog
        visible={showImportConfirmModal}
        title="Import from File"
        message={`You are about to import from:\n\n${importedFileName}`}
        onConfirm={handleImportConfirmed}
        onCancel={() => {
          setShowImportConfirmModal(false);
          setImportedFilePath('');
          setImportedFileName('');
        }}
        confirmText="Import"
        cancelText="Cancel"
        confirmStyle="default"
      >
        <View style={styles.importConfirmContainer}>
          <View
            style={[
              styles.importPathBox,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="document-outline"
              size={20}
              color={theme.primary}
              style={styles.importPathIcon}
            />
            <Text
              style={[styles.importPathText, { color: theme.textSecondary }]}
              numberOfLines={3}
            >
              {importedFilePath}
            </Text>
          </View>
        </View>
      </ConfirmDialog>
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
  listContentContainer: {
    paddingBottom: 30,
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
  // Vault header layout styles
  vaultHeaderContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
    alignItems: 'center',
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
  decryptionPasswordInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  destinationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38383A',
  },
  exportModalContainer: {
    gap: 12,
    marginVertical: 12,
  },
  destinationOptionIcon: {
    marginRight: 12,
  },
  destinationOptionContent: {
    flex: 1,
  },
  destinationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  destinationOptionSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  exportSuccessContainer: {
    gap: 12,
    marginVertical: 12,
  },
  exportPathBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  exportPathIcon: {
    marginRight: 8,
  },
  exportPathText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  shareIconButton: {
    padding: 6,
    marginLeft: 8,
  },
  exportActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exportActionIcon: {
    marginRight: 6,
  },
  exportActionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  importConfirmContainer: {
    gap: 12,
    marginVertical: 12,
  },
  importPathBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  importPathIcon: {
    marginRight: 8,
  },
  importPathText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  fileListContainer: {
    maxHeight: 300,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fileListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  fileListItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileListItemIcon: {
    marginRight: 12,
  },
  fileListItemText: {
    flex: 1,
  },
  fileListItemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileListItemDate: {
    fontSize: 12,
  },
});
