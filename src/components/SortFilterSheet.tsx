import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

export type SortOption =
  | 'title-asc'
  | 'title-desc'
  | 'createdAt-desc'
  | 'createdAt-asc'
  | 'strength-asc'
  | 'strength-desc'
  | 'category-asc'
  | 'category-desc'
  | 'username-asc'
  | 'username-desc';

export type FilterOption =
  | 'all'
  | 'weak'
  | 'compromised'
  | 'duplicate'
  | 'strong'
  | 'category';

interface SortFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: 'sort' | 'filter';
  currentSort?: SortOption;
  currentFilter?: FilterOption;
  onSortChange?: (sort: SortOption) => void;
  onFilterChange?: (filter: FilterOption) => void;
  categories?: string[];
  selectedCategory?: string;
  onCategorySelect?: (category: string) => void;
}

const SortFilterSheet: React.FC<SortFilterSheetProps> = ({
  visible,
  onClose,
  mode,
  currentSort,
  currentFilter,
  onSortChange,
  onFilterChange,
  categories = [],
  selectedCategory,
  onCategorySelect,
}) => {
  const { theme } = useTheme();

  const sortOptions: { value: SortOption; label: string; icon: string }[] = [
    { value: 'title-asc', label: 'Name (A-Z)', icon: 'sort-by-alpha' },
    { value: 'title-desc', label: 'Name (Z-A)', icon: 'sort-by-alpha' },
    {
      value: 'createdAt-desc',
      label: 'Newest First',
      icon: 'access-time',
    },
    {
      value: 'createdAt-asc',
      label: 'Oldest First',
      icon: 'access-time',
    },
    {
      value: 'strength-asc',
      label: 'Weakest First',
      icon: 'security',
    },
    {
      value: 'strength-desc',
      label: 'Strongest First',
      icon: 'security',
    },
    {
      value: 'category-asc',
      label: 'Category (A-Z)',
      icon: 'category',
    },
    {
      value: 'category-desc',
      label: 'Category (Z-A)',
      icon: 'category',
    },
    {
      value: 'username-asc',
      label: 'Username (A-Z)',
      icon: 'person',
    },
    {
      value: 'username-desc',
      label: 'Username (Z-A)',
      icon: 'person',
    },
  ];

  const filterOptions: { value: FilterOption; label: string; icon: string }[] =
    [
      { value: 'all', label: 'All Passwords', icon: 'list' },
      { value: 'weak', label: 'Weak Passwords', icon: 'warning' },
      {
        value: 'compromised',
        label: 'Compromised',
        icon: 'error',
      },
      { value: 'duplicate', label: 'Duplicates', icon: 'content-copy' },
      { value: 'strong', label: 'Strong Passwords', icon: 'verified' },
      { value: 'category', label: 'By Category', icon: 'category' },
    ];

  const handleSortSelect = (sort: SortOption) => {
    onSortChange?.(sort);
    onClose();
  };

  const handleFilterSelect = (filter: FilterOption) => {
    onFilterChange?.(filter);
    if (filter !== 'category') {
      onClose();
    }
  };

  const handleCategorySelect = (category: string) => {
    onCategorySelect?.(category);
    onClose();
  };

  const renderSortOptions = () => (
    <View style={styles.optionsContainer}>
      {sortOptions.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionItem,
            {
              backgroundColor:
                currentSort === option.value
                  ? theme.primary + '20'
                  : theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => handleSortSelect(option.value)}
        >
          <MaterialIcons
            name={option.icon}
            size={22}
            color={
              currentSort === option.value ? theme.primary : theme.textSecondary
            }
          />
          <Text
            style={[
              styles.optionLabel,
              {
                color:
                  currentSort === option.value ? theme.primary : theme.text,
              },
            ]}
          >
            {option.label}
          </Text>
          {currentSort === option.value && (
            <MaterialIcons name="check" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFilterOptions = () => (
    <View style={styles.optionsContainer}>
      {filterOptions.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionItem,
            {
              backgroundColor:
                currentFilter === option.value
                  ? theme.primary + '20'
                  : theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => handleFilterSelect(option.value)}
        >
          <MaterialIcons
            name={option.icon}
            size={22}
            color={
              currentFilter === option.value
                ? theme.primary
                : theme.textSecondary
            }
          />
          <Text
            style={[
              styles.optionLabel,
              {
                color:
                  currentFilter === option.value ? theme.primary : theme.text,
              },
            ]}
          >
            {option.label}
          </Text>
          {currentFilter === option.value && (
            <MaterialIcons name="check" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>
      ))}

      {/* Show categories if filter is 'category' */}
      {currentFilter === 'category' && categories.length > 0 && (
        <View style={styles.categoriesContainer}>
          <Text
            style={[styles.categoriesTitle, { color: theme.textSecondary }]}
          >
            Select Category:
          </Text>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryItem,
                {
                  backgroundColor:
                    selectedCategory === category
                      ? theme.primary + '20'
                      : theme.card,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => handleCategorySelect(category)}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  {
                    color:
                      selectedCategory === category
                        ? theme.primary
                        : theme.text,
                  },
                ]}
              >
                {category}
              </Text>
              {selectedCategory === category && (
                <MaterialIcons name="check" size={18} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.container, { backgroundColor: theme.background }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              {mode === 'sort' ? '🔄 Sort By' : '🔍 Filter By'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {mode === 'sort' ? renderSortOptions() : renderFilterOptions()}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#38383A',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38383A',
    gap: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  categoriesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#38383A',
  },
  categoriesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38383A',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default SortFilterSheet;
