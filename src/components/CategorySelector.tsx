import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PasswordCategoryExtended } from '../types/password';
import { useTheme, Theme } from '../contexts/ThemeContext';
import {
  DEFAULT_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
} from '../constants/categories';
import { CategoryService } from '../services/categoryService';

interface CategorySelectorProps {
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
  allowCreate?: boolean;
  showCounts?: boolean;
  style?: any;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  onCategorySelect,
  allowCreate = true,
  showCounts = false,
  style,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [categories, setCategories] = useState<PasswordCategoryExtended[]>(
    DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      entryCount: 0,
      createdAt: new Date(),
    })),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [selectedColor, setSelectedColor] = useState('#007AFF');

  // Load categories function
  const loadCategories = async () => {
    try {
      const allCategories = await CategoryService.getAllCategories();
      // Check if categories have proper icons, if not reset to default
      const hasValidIcons = allCategories.every(
        cat => cat.icon && cat.icon !== 'undefined',
      );
      if (!hasValidIcons) {
        await CategoryService.resetToDefaultCategories();
        const resetCategories = await CategoryService.getAllCategories();
        setCategories(resetCategories);
      } else {
        setCategories(allCategories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Fallback to default categories
      const defaultCategories: PasswordCategoryExtended[] =
        DEFAULT_CATEGORIES.map(cat => ({
          ...cat,
          entryCount: 0,
          createdAt: new Date(),
        }));
      setCategories(defaultCategories);
    }
  };

  // Load categories on component mount
  React.useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenModal = () => {
    setIsModalVisible(true);
    loadCategories();
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSearchQuery('');
    setIsCreating(false);
    setNewCategoryName('');
  };

  const handleSelectCategory = (categoryName: string) => {
    onCategorySelect(categoryName);
    handleCloseModal();
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    try {
      const newCategory = await CategoryService.createCategory(
        newCategoryName.trim(),
        selectedIcon,
        selectedColor,
        '',
      );

      // Add to local list
      setCategories([
        ...categories,
        {
          ...newCategory,
          entryCount: 0,
          isCustom: true,
          sortOrder: categories.length,
        },
      ]);

      // Select the new category
      handleSelectCategory(newCategory.name);

      Alert.alert('Success', 'Category created successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to create category');
      console.error('Failed to create category:', error);
    }
  };

  const handleDeleteCategory = async (
    categoryId: string,
    categoryName: string,
  ) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CategoryService.deleteCategory(categoryId);
              setCategories(categories.filter(cat => cat.id !== categoryId));

              // If deleted category was selected, reset to Other
              if (selectedCategory === categoryName) {
                onCategorySelect('Other');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete category');
              console.error('Failed to delete category:', error);
            }
          },
        },
      ],
    );
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getSelectedCategoryDisplay = () => {
    // First try to find in loaded categories (has Ionicons), then fallback to DEFAULT_CATEGORIES
    const loadedCategory = categories.find(
      cat => cat.name === selectedCategory,
    );
    const defaultCategory = DEFAULT_CATEGORIES.find(
      cat => cat.name === selectedCategory,
    );

    const category = loadedCategory || defaultCategory;

    if (category) {
      // Get icon: prefer loaded category icon, then default category icon, then fallback
      const iconName =
        loadedCategory?.icon || defaultCategory?.icon || 'folder-outline';

      return {
        name: category.name,
        icon: iconName,
        color: category.color || theme.primary,
      };
    }

    return {
      name: selectedCategory || 'Select Category',
      icon: 'folder-outline',
      color: theme.textSecondary,
    };
  };

  const selectedDisplay = getSelectedCategoryDisplay();

  const renderCategoryItem = ({ item }: { item: PasswordCategoryExtended }) => {
    // Get icon from DEFAULT_CATEGORIES if item.icon is missing or invalid
    const defaultCategory = DEFAULT_CATEGORIES.find(
      cat => cat.name === item.name,
    );
    const iconName = item.icon || defaultCategory?.icon || 'folder';

    return (
      <View style={styles.categoryItem}>
        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => handleSelectCategory(item.name)}
        >
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: item.color + '20' },
            ]}
          >
            <Icon name={iconName} size={24} color={item.color} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>{item.name}</Text>
            {showCounts && (
              <Text style={styles.categoryCount}>
                {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
              </Text>
            )}
            {item.description && (
              <Text style={styles.categoryDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
          {selectedCategory === item.name && (
            <Icon name="checkmark" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>

        {item.isCustom && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCategory(item.id, item.name)}
          >
            <Icon name="trash" size={20} color={theme.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCreateForm = () => (
    <View style={styles.createForm}>
      <Text style={styles.createFormTitle}>Create New Category</Text>

      <TextInput
        style={styles.createInput}
        placeholder="Category name"
        value={newCategoryName}
        onChangeText={setNewCategoryName}
        placeholderTextColor={theme.textSecondary}
        autoComplete="off"
        importantForAutofill="no"
      />

      <Text style={styles.createLabel}>Icon</Text>
      <View style={styles.iconGrid}>
        {Object.entries(CATEGORY_ICONS)
          .slice(0, 12)
          .map(([_name, iconName]) => (
            <TouchableOpacity
              key={iconName}
              style={[
                styles.iconOption,
                selectedIcon === iconName && styles.selectedIconOption,
              ]}
              onPress={() => setSelectedIcon(iconName)}
            >
              <Icon name={iconName} size={24} color={theme.text} />
            </TouchableOpacity>
          ))}
      </View>

      <Text style={styles.createLabel}>Color</Text>
      <View style={styles.colorGrid}>
        {Object.values(CATEGORY_COLORS)
          .slice(0, 8)
          .map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                selectedColor === color && styles.selectedColorOption,
              ]}
              onPress={() => setSelectedColor(color)}
            />
          ))}
      </View>

      <View style={styles.createActions}>
        <TouchableOpacity
          style={styles.cancelCreateButton}
          onPress={() => setIsCreating(false)}
        >
          <Text style={styles.cancelCreateText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.confirmCreateButton}
          onPress={handleCreateCategory}
        >
          <Text style={styles.confirmCreateText}>Create</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, style]}
        onPress={handleOpenModal}
      >
        <View
          style={[
            styles.selectedIcon,
            { backgroundColor: selectedDisplay.color + '20' },
          ]}
        >
          <Icon
            name={selectedDisplay.icon}
            size={20}
            color={selectedDisplay.color}
          />
        </View>
        <Text style={styles.selectedText}>{selectedDisplay.name}</Text>
        <Icon name="chevron-down" size={24} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {!isCreating ? (
            <>
              <View style={styles.searchContainer}>
                <Icon name="search" size={20} color={theme.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={theme.textSecondary}
                  autoComplete="off"
                  importantForAutofill="no"
                />
              </View>

              <FlatList
                data={filteredCategories}
                renderItem={renderCategoryItem}
                keyExtractor={item => item.id}
                style={styles.categoriesList}
                showsVerticalScrollIndicator={false}
              />

              {allowCreate && (
                <>
                  <TouchableOpacity
                    style={styles.createNewButton}
                    onPress={() => setIsCreating(true)}
                  >
                    <Icon name="add" size={24} color={theme.primary} />
                    <Text style={styles.createNewText}>
                      Create New Category
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.createNewButton,
                      { borderColor: theme.warning },
                    ]}
                    onPress={async () => {
                      Alert.alert(
                        'Reset Categories',
                        'This will reset all categories to default with updated icons. Custom categories will be lost.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Reset',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await CategoryService.resetToDefaultCategories();
                                await loadCategories();
                                Alert.alert(
                                  'Success',
                                  'Categories have been reset with updated icons',
                                );
                              } catch (error) {
                                Alert.alert(
                                  'Error',
                                  'Failed to reset categories',
                                );
                              }
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Icon name="refresh" size={24} color={theme.warning} />
                    <Text
                      style={[styles.createNewText, { color: theme.warning }]}
                    >
                      Reset to Default
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            renderCreateForm()
          )}
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    selectedText: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    closeButton: {
      padding: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      margin: 16,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: theme.text,
    },
    categoriesList: {
      flex: 1,
      paddingHorizontal: 16,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    categoryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    categoryInfo: {
      flex: 1,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 2,
    },
    categoryCount: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    categoryDescription: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    deleteButton: {
      padding: 12,
      marginLeft: 8,
    },
    createNewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 16,
      margin: 16,
      borderWidth: 1,
      borderColor: theme.primary,
      borderStyle: 'dashed',
    },
    createNewText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.primary,
      marginLeft: 8,
    },
    createForm: {
      padding: 16,
    },
    createFormTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 20,
    },
    createInput: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },
    createLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 12,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.surface,
      margin: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedIconOption: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
    },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: 20,
      margin: 4,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedColorOption: {
      borderColor: theme.text,
    },
    createActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    cancelCreateButton: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelCreateText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
    confirmCreateButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginLeft: 8,
    },
    confirmCreateText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default CategorySelector;
