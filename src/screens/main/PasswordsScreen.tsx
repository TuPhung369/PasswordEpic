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
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState } from '../../store';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PasswordEntry as Password } from '../../types/password';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordManagement } from '../../hooks/usePasswordManagement';
import PasswordEntryComponent from '../../components/PasswordEntry';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';
import { loadPasswords } from '../../store/slices/passwordsSlice';
import { getEffectiveMasterPassword } from '../../services/dynamicMasterPasswordService';
import Toast from '../../components/Toast';
import {
  recalculatePasswordStrengths,
  needsStrengthRecalculation,
} from '../../utils/passwordStrengthMigration';
import SortFilterSheet, {
  SortOption,
  FilterOption,
} from '../../components/SortFilterSheet';

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
  const { deletePassword, updatePassword } = usePasswordManagement();

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
  const [currentFilter, setCurrentFilter] = useState<FilterOption>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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
        try {
          setIsLoadingPasswords(true);
          // console.log('🔐 PasswordsScreen: Loading passwords...');

          // Add small delay to ensure Firebase auth is ready
          await new Promise(resolve => setTimeout(resolve, 100));

          // Get the master password (dynamic or biometric)
          const result = await getEffectiveMasterPassword();

          if (result.success && result.password) {
            // console.log(
            //   '✅ PasswordsScreen: Master password obtained, loading passwords...',
            // );
            await dispatch(loadPasswords(result.password)).unwrap();
            // console.log('✅ PasswordsScreen: Passwords loaded successfully');
          } else {
            console.warn(
              '⚠️ PasswordsScreen: Failed to get master password:',
              result.error,
            );
            // If failed, try again after a short delay (auth might not be ready)
            // console.log('🔄 PasswordsScreen: Retrying after 500ms...');
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryResult = await getEffectiveMasterPassword();
            if (retryResult.success && retryResult.password) {
              // console.log(
              //   '✅ PasswordsScreen: Master password obtained on retry, loading passwords...',
              // );
              await dispatch(loadPasswords(retryResult.password)).unwrap();
              // console.log('✅ PasswordsScreen: Passwords loaded successfully');
            } else {
              console.error(
                '❌ PasswordsScreen: Failed to get master password after retry:',
                retryResult.error,
              );
            }
          }
        } catch (error) {
          console.error('❌ PasswordsScreen: Failed to load passwords:', error);
        } finally {
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

    // Apply filter
    switch (currentFilter) {
      case 'weak':
        result = result.filter(
          p =>
            p.auditData?.passwordStrength &&
            p.auditData.passwordStrength.score < 2,
        );
        break;
      case 'compromised':
        result = result.filter(p => p.breachStatus?.isBreached);
        break;
      case 'duplicate':
        result = result.filter(
          p => p.auditData?.duplicateCount && p.auditData.duplicateCount > 0,
        );
        break;
      case 'strong':
        result = result.filter(
          p =>
            p.auditData?.passwordStrength &&
            p.auditData.passwordStrength.score >= 3,
        );
        break;
      case 'category':
        if (selectedCategory) {
          result = result.filter(p => p.category === selectedCategory);
        }
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    // Apply sort
    const sorted = [...result];
    switch (currentSort) {
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'createdAt-asc':
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case 'createdAt-desc':
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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

    return sorted;
  }, [passwords, searchQuery, currentFilter, currentSort, selectedCategory]);

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
    Alert.alert(
      'Delete Password',
      `Are you sure you want to delete "${password.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // console.log('Delete password:', password.id);
              await deletePassword(password.id);
              // console.log('✅ Password deleted successfully:', password.id);
            } catch (error) {
              console.error('❌ Failed to delete password:', error);
              Alert.alert('Error', 'Failed to delete password');
            }
          },
        },
      ],
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

    Alert.alert(
      'Delete Passwords',
      `Are you sure you want to delete ${selectedPasswords.length} password(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
              Alert.alert('Error', 'Failed to delete passwords');
            }
          },
        },
      ],
    );
  };

  // Sort and Filter handlers
  const handleSortChange = (sort: SortOption) => {
    setCurrentSort(sort);
  };

  const handleFilterChange = (filter: FilterOption) => {
    setCurrentFilter(filter);
    if (filter !== 'category') {
      setSelectedCategory('');
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const handleResetFilters = () => {
    setCurrentFilter('all');
    setSelectedCategory('');
    setCurrentSort('createdAt-desc');
  };

  const renderPasswordItem = ({ item }: { item: Password }) => (
    <PasswordEntryComponent
      password={item}
      onPress={() => handlePasswordPress(item)}
      onEdit={() => handlePasswordEdit(item)}
      onDelete={() => handlePasswordDelete(item)}
      selectable={bulkMode}
      selected={selectedPasswords.includes(item.id)}
      onSelect={_selected => togglePasswordSelection(item.id)}
      showActions={!bulkMode}
    />
  );

  const renderSearchBar = () => {
    if (!showSearch) return null;

    return (
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <MaterialIcons name="search" size={20} color={theme.textSecondary} />
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
          <MaterialIcons name="close" size={20} color={theme.textSecondary} />
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
          <MaterialIcons name="select-all" size={20} color={theme.primary} />
          <Text style={[styles.bulkButtonText, { color: theme.primary }]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBulkDelete}
          style={styles.bulkButton}
          disabled={selectedPasswords.length === 0}
        >
          <MaterialIcons name="delete" size={20} color={theme.error} />
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
      currentFilter !== 'all' || currentSort !== 'createdAt-desc';

    if (!hasActiveFilters) return null;

    const getFilterLabel = () => {
      switch (currentFilter) {
        case 'weak':
          return 'Weak Passwords';
        case 'compromised':
          return 'Compromised';
        case 'duplicate':
          return 'Duplicates';
        case 'strong':
          return 'Strong Passwords';
        case 'category':
          return selectedCategory
            ? `Category: ${selectedCategory}`
            : 'By Category';
        default:
          return null;
      }
    };

    const getSortLabel = () => {
      switch (currentSort) {
        case 'title-asc':
          return 'Name (A-Z)';
        case 'title-desc':
          return 'Name (Z-A)';
        case 'createdAt-asc':
          return 'Oldest First';
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

    const filterLabel = getFilterLabel();
    const sortLabel = getSortLabel();

    return (
      <View
        style={[
          styles.activeFilters,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeFiltersContent}
        >
          {filterLabel && (
            <View
              style={[
                styles.filterChip,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <MaterialIcons
                name="filter-list"
                size={14}
                color={theme.primary}
              />
              <Text style={[styles.filterChipText, { color: theme.primary }]}>
                {filterLabel}
              </Text>
            </View>
          )}
          {sortLabel && (
            <View
              style={[
                styles.filterChip,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <MaterialIcons name="sort" size={14} color={theme.primary} />
              <Text style={[styles.filterChipText, { color: theme.primary }]}>
                {sortLabel}
              </Text>
            </View>
          )}
        </ScrollView>
        <TouchableOpacity
          onPress={handleResetFilters}
          style={styles.resetButton}
        >
          <Text style={[styles.resetButtonText, { color: theme.primary }]}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <View style={styles.headerLeft}>
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
      <View style={styles.headerRight}>
        {!bulkMode && (
          <>
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              style={[styles.headerButton, { backgroundColor: theme.surface }]}
            >
              <MaterialIcons
                name="search"
                size={22}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSortSheet(true)}
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
              <MaterialIcons
                name="sort"
                size={22}
                color={
                  currentSort !== 'createdAt-desc'
                    ? theme.primary
                    : theme.textSecondary
                }
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowFilterSheet(true)}
              style={[
                styles.headerButton,
                {
                  backgroundColor:
                    currentFilter !== 'all'
                      ? theme.primary + '30'
                      : theme.surface,
                },
              ]}
            >
              <MaterialIcons
                name="filter-list"
                size={22}
                color={
                  currentFilter !== 'all' ? theme.primary : theme.textSecondary
                }
              />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={toggleBulkMode}
          style={[
            styles.headerButton,
            { backgroundColor: bulkMode ? theme.primary : theme.surface },
          ]}
        >
          <MaterialIcons
            name="checklist"
            size={22}
            color={bulkMode ? '#FFFFFF' : theme.textSecondary}
          />
        </TouchableOpacity>

        {!bulkMode && (
          <TouchableOpacity
            onPress={handleAddPassword}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <MaterialIcons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

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
          <MaterialIcons name="lock" size={48} color={theme.primary} />
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
          <MaterialIcons name="add" size={20} color={theme.primary} />
          <Text style={[styles.emptyButtonText, { color: theme.primary }]}>
            Add Password
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {renderHeader()}
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

      {/* Sort Sheet */}
      <SortFilterSheet
        visible={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        mode="sort"
        currentSort={currentSort}
        onSortChange={handleSortChange}
      />

      {/* Filter Sheet */}
      <SortFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        mode="filter"
        currentFilter={currentFilter}
        onFilterChange={handleFilterChange}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
      />
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
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
