import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PasswordEntry, PasswordCategory } from '../types/password';
import ConfirmDialog from './ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

interface CategoryManagerProps {
  visible: boolean;
  onClose: () => void;
  categories: PasswordCategory[];
  entries: PasswordEntry[];
  onCreateCategory: (
    category: Omit<PasswordCategory, 'id' | 'createdAt'>,
  ) => void;
  onUpdateCategory: (id: string, updates: Partial<PasswordCategory>) => void;
  onDeleteCategory: (id: string) => void;
  onMoveEntries: (
    fromCategoryId: string,
    toCategoryId: string,
    entryIds: string[],
  ) => void;
}

interface CategoryStats {
  id: string;
  name: string;
  entryCount: number;
  weakPasswords: number;
  strongPasswords: number;
  lastUsed?: Date;
  isDefault: boolean;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
  visible,
  onClose,
  categories,
  entries,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onMoveEntries,
}) => {
  // Confirm dialog hook
  const {
    confirmDialog,
    showAlert,
    showDestructive,
    showConfirm,
    hideConfirm,
  } = useConfirmDialog();

  // Mock theme context
  const theme = {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    card: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    primary: '#007AFF',
    border: '#E0E0E0',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
  };
  const styles = createStyles(theme);

  // State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<PasswordCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('folder-outline');
  const [newCategoryColor, setNewCategoryColor] = useState('#007AFF');
  const [searchQuery, setSearchQuery] = useState('');

  // Category statistics
  const categoryStats = useMemo((): CategoryStats[] => {
    const stats = new Map<string, CategoryStats>();

    // Initialize with existing categories
    categories.forEach(category => {
      stats.set(category.id, {
        id: category.id,
        name: category.name,
        entryCount: 0,
        weakPasswords: 0,
        strongPasswords: 0,
        isDefault: ['General', 'Work', 'Personal', 'Finance'].includes(
          category.name,
        ),
      });
    });

    // Add uncategorized
    stats.set('uncategorized', {
      id: 'uncategorized',
      name: 'Uncategorized',
      entryCount: 0,
      weakPasswords: 0,
      strongPasswords: 0,
      isDefault: true,
    });

    // Calculate stats from entries
    entries.forEach(entry => {
      const categoryId = entry.category || 'uncategorized';
      const stat = stats.get(categoryId);

      if (stat) {
        stat.entryCount++;

        // Calculate password strength (mock implementation)
        const strength = calculatePasswordStrength(entry.password);
        if (strength === 'weak' || strength === 'fair') {
          stat.weakPasswords++;
        } else if (strength === 'strong') {
          stat.strongPasswords++;
        }

        // Update last used
        if (entry.lastUsed) {
          const lastUsed = new Date(entry.lastUsed);
          if (!stat.lastUsed || lastUsed > stat.lastUsed) {
            stat.lastUsed = lastUsed;
          }
        }
      }
    });

    return Array.from(stats.values()).sort(
      (a, b) => b.entryCount - a.entryCount,
    );
  }, [categories, entries]);

  // Filtered categories for search
  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return categoryStats;

    return categoryStats.filter(stat =>
      stat.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [categoryStats, searchQuery]);

  // Available icons
  const availableIcons = [
    'folder-outline',
    'briefcase-outline',
    'home-outline',
    'business-outline',
    'cart-outline',
    'school-outline',
    'medical-outline',
    'restaurant-outline',
    'airplane-outline',
    'game-controller-outline',
    'fitness-outline',
    'library-outline',
    'musical-notes-outline',
    'camera-outline',
    'desktop-outline',
    'phone-portrait-outline',
    'wifi-outline',
    'cloud-outline',
    'shield-checkmark-outline',
    'key-outline',
  ];

  // Available colors
  const availableColors = [
    '#007AFF',
    '#FF3B30',
    '#FF9500',
    '#FFCC00',
    '#34C759',
    '#5AC8FA',
    '#AF52DE',
    '#FF2D92',
    '#A2845E',
    '#8E8E93',
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
  ];

  // Handlers
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      showAlert('Error', 'Please enter a category name');
      return;
    }

    if (
      categories.some(
        cat => cat.name.toLowerCase() === newCategoryName.toLowerCase(),
      )
    ) {
      showAlert('Error', 'A category with this name already exists');
      return;
    }

    onCreateCategory({
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      color: newCategoryColor,
    });

    setNewCategoryName('');
    setNewCategoryIcon('folder-outline');
    setNewCategoryColor('#007AFF');
    setShowCreateModal(false);
  };

  const handleEditCategory = (category: PasswordCategory) => {
    setSelectedCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryIcon(category.icon);
    setNewCategoryColor(category.color);
    setShowEditModal(true);
  };

  const handleUpdateCategory = () => {
    if (!selectedCategory || !newCategoryName.trim()) {
      showAlert('Error', 'Please enter a category name');
      return;
    }

    const existingCategory = categories.find(
      cat =>
        cat.id !== selectedCategory.id &&
        cat.name.toLowerCase() === newCategoryName.toLowerCase(),
    );

    if (existingCategory) {
      showAlert('Error', 'A category with this name already exists');
      return;
    }

    onUpdateCategory(selectedCategory.id, {
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      color: newCategoryColor,
    });

    setSelectedCategory(null);
    setShowEditModal(false);
  };

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    const stat = categoryStats.find(s => s.id === categoryId);

    if (stat?.isDefault) {
      showAlert('Cannot Delete', 'Default categories cannot be deleted');
      return;
    }

    if (stat && stat.entryCount > 0) {
      // Category has entries - show options dialog
      showConfirm({
        title: 'Delete Category',
        message: `This category contains ${stat.entryCount} password(s). Do you want to move them to Uncategorized or delete everything?`,
        confirmText: 'Move to Uncategorized',
        onConfirm: () => {
          const categoryEntries = entries
            .filter(entry => entry.category === categoryId)
            .map(entry => entry.id);

          onMoveEntries(categoryId, 'uncategorized', categoryEntries);
          onDeleteCategory(categoryId);
        },
      });
    } else {
      // Empty category - simple delete confirmation
      showDestructive(
        'Delete Category',
        `Are you sure you want to delete "${categoryName}"?`,
        () => onDeleteCategory(categoryId),
        'Delete',
      );
    }
  };

  const calculatePasswordStrength = (
    password: string,
  ): 'weak' | 'fair' | 'good' | 'strong' => {
    if (!password) return 'weak';

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    if (score <= 2) return 'weak';
    if (score <= 3) return 'fair';
    if (score <= 4) return 'good';
    return 'strong';
  };

  const renderCategoryItem = ({ item: stat }: { item: CategoryStats }) => {
    const category = categories.find(cat => cat.id === stat.id);
    const isUncategorized = stat.id === 'uncategorized';

    return (
      <View style={styles.categoryItem}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryInfo}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: category?.color || theme.textSecondary },
              ]}
            >
              <Icon
                name={category?.icon || 'folder-open-outline'}
                size={24}
                color="white"
              />
            </View>

            <View style={styles.categoryDetails}>
              <Text style={styles.categoryName}>{stat.name}</Text>
              <Text style={styles.categoryCount}>
                {stat.entryCount}{' '}
                {stat.entryCount === 1 ? 'password' : 'passwords'}
              </Text>
            </View>
          </View>

          {!isUncategorized && !stat.isDefault && (
            <View style={styles.categoryActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleEditCategory(category!)}
              >
                <Icon name="create-outline" size={20} color={theme.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteCategory(stat.id, stat.name)}
              >
                <Icon name="trash-outline" size={20} color={theme.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {stat.entryCount > 0 && (
          <View style={styles.categoryStats}>
            <View style={styles.statItem}>
              <Icon
                name="shield-checkmark-outline"
                size={16}
                color={theme.success}
              />
              <Text style={styles.statText}>{stat.strongPasswords} strong</Text>
            </View>

            <View style={styles.statItem}>
              <Icon name="warning" size={16} color={theme.warning} />
              <Text style={styles.statText}>{stat.weakPasswords} weak</Text>
            </View>

            {stat.lastUsed && (
              <View style={styles.statItem}>
                <Icon
                  name="time-outline"
                  size={16}
                  color={theme.textSecondary}
                />
                <Text style={styles.statText}>{formatDate(stat.lastUsed)}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create Category</Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Category name"
            placeholderTextColor={theme.textSecondary}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            autoFocus
          />

          <Text style={styles.sectionLabel}>Icon</Text>
          <ScrollView
            horizontal
            style={styles.iconSelector}
            showsHorizontalScrollIndicator={false}
          >
            {availableIcons.map(iconName => (
              <TouchableOpacity
                key={iconName}
                style={[
                  styles.iconOption,
                  newCategoryIcon === iconName && styles.iconOptionSelected,
                ]}
                onPress={() => setNewCategoryIcon(iconName)}
              >
                <Icon
                  name={iconName}
                  size={24}
                  color={
                    newCategoryIcon === iconName ? 'white' : theme.textSecondary
                  }
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Color</Text>
          <View style={styles.colorSelector}>
            {availableColors.map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  newCategoryColor === color && styles.colorOptionSelected,
                ]}
                onPress={() => setNewCategoryColor(color)}
              >
                {newCategoryColor === color && (
                  <Icon name="checkmark" size={16} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCreateButton}
              onPress={handleCreateCategory}
            >
              <Text style={styles.modalCreateText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowEditModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Category</Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Category name"
            placeholderTextColor={theme.textSecondary}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            autoFocus
          />

          <Text style={styles.sectionLabel}>Icon</Text>
          <ScrollView
            horizontal
            style={styles.iconSelector}
            showsHorizontalScrollIndicator={false}
          >
            {availableIcons.map(iconName => (
              <TouchableOpacity
                key={iconName}
                style={[
                  styles.iconOption,
                  newCategoryIcon === iconName && styles.iconOptionSelected,
                ]}
                onPress={() => setNewCategoryIcon(iconName)}
              >
                <Icon
                  name={iconName}
                  size={24}
                  color={
                    newCategoryIcon === iconName ? 'white' : theme.textSecondary
                  }
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Color</Text>
          <View style={styles.colorSelector}>
            {availableColors.map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  newCategoryColor === color && styles.colorOptionSelected,
                ]}
                onPress={() => setNewCategoryColor(color)}
              >
                {newCategoryColor === color && (
                  <Icon name="checkmark" size={16} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCreateButton}
              onPress={handleUpdateCategory}
            >
              <Text style={styles.modalCreateText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Manage Categories</Text>

            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={styles.headerButton}
            >
              <Icon name="add" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Icon
              name="search"
              size={20}
              color={theme.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
              >
                <Icon
                  name="close-circle"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredStats}
            renderItem={renderCategoryItem}
            keyExtractor={item => item.id}
            style={styles.categoryList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.categoryListContent}
          />
        </View>
      </Modal>

      {renderCreateModal()}
      {renderEditModal()}

      {/* Confirm Dialog */}
      <ConfirmDialog {...confirmDialog} onCancel={hideConfirm} />
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
      paddingTop: 44, // Safe area
    },
    headerButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      margin: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    clearSearchButton: {
      padding: 4,
    },
    categoryList: {
      flex: 1,
    },
    categoryListContent: {
      paddingHorizontal: 16,
      paddingBottom: 34, // Safe area
    },
    categoryItem: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    categoryInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    categoryIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    categoryDetails: {
      flex: 1,
    },
    categoryName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    categoryCount: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    categoryActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    modalInput: {
      backgroundColor: theme.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    iconSelector: {
      marginBottom: 20,
    },
    iconOption: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      borderRadius: 24,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconOptionSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    colorSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    colorOption: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: theme.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalCancelText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    modalCreateButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 12,
    },
    modalCreateText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
  });

export default CategoryManager;
