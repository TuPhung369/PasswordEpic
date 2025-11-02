import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { CATEGORY_ICONS } from '../constants/categories';

export interface MultipleFilterOptions {
  weak: boolean;
  compromised: boolean;
  duplicate: boolean;
  favorite: boolean;
  categories: string[]; // Array of selected categories
}

interface FilterDropdownProps {
  visible: boolean;
  onClose: () => void;
  currentFilters: MultipleFilterOptions;
  onFiltersChange: (filters: MultipleFilterOptions) => void;
  anchorPosition?: { x: number; y: number };
  categories?: string[];
}

const FILTER_OPTIONS = [
  { type: 'weak' as const, label: 'Weak Passwords', icon: 'alert-outline' },
  {
    type: 'compromised' as const,
    label: 'Compromised',
    icon: 'warning-outline',
  },
  { type: 'duplicate' as const, label: 'Duplicates', icon: 'copy-outline' },
  { type: 'favorite' as const, label: 'Favorites', icon: 'heart-outline' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  visible,
  onClose,
  currentFilters,
  onFiltersChange,
  anchorPosition = { x: SCREEN_WIDTH - 200, y: 100 },
  categories = [],
}) => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const handleFilterToggle = (
    filterType: 'weak' | 'compromised' | 'duplicate' | 'favorite',
  ) => {
    const newFilters = { ...currentFilters };
    newFilters[filterType] = !currentFilters[filterType];
    onFiltersChange(newFilters);
  };

  const handleCategoryToggle = (categoryName: string) => {
    const newFilters = { ...currentFilters };
    const categoryIndex = currentFilters.categories.indexOf(categoryName);

    if (categoryIndex >= 0) {
      // Remove category
      newFilters.categories = currentFilters.categories.filter(
        cat => cat !== categoryName,
      );
    } else {
      // Add category
      newFilters.categories = [...currentFilters.categories, categoryName];
    }

    onFiltersChange(newFilters);
  };

  const isCategorySelected = (categoryName: string): boolean => {
    return currentFilters.categories.includes(categoryName);
  };

  // Get checkbox style
  const getCheckboxStyle = (isSelected: boolean) => ({
    backgroundColor: isSelected ? theme.primary : 'transparent',
    borderColor: isSelected ? theme.primary : theme.textSecondary,
  });

  // Get icon for a category
  const getCategoryIcon = (category: string): string => {
    // Try exact match first
    const exactKey = category.toLowerCase().replace(/\s+/g, '');
    let icon = CATEGORY_ICONS[exactKey as keyof typeof CATEGORY_ICONS];

    if (icon) return icon;

    // Try partial matches for common patterns
    const lowerCategory = category.toLowerCase();

    if (lowerCategory.includes('social')) return CATEGORY_ICONS.social;
    if (lowerCategory.includes('work') || lowerCategory.includes('business'))
      return CATEGORY_ICONS.work;
    if (lowerCategory.includes('bank') || lowerCategory.includes('finance'))
      return CATEGORY_ICONS.banking;
    if (lowerCategory.includes('shop') || lowerCategory.includes('store'))
      return CATEGORY_ICONS.shopping;
    if (lowerCategory.includes('game') || lowerCategory.includes('gaming'))
      return CATEGORY_ICONS.gaming;
    if (lowerCategory.includes('email') || lowerCategory.includes('mail'))
      return CATEGORY_ICONS.messaging;
    if (
      lowerCategory.includes('media') ||
      lowerCategory.includes('entertainment')
    )
      return CATEGORY_ICONS.entertainment;

    // Default fallback
    return 'folder-outline';
  };

  const renderFilterOption = (
    option: (typeof FILTER_OPTIONS)[0],
    index: number,
  ) => {
    const isSelected = currentFilters[option.type];

    const filterOptionStyle = {
      backgroundColor: isSelected ? theme.primary + '15' : 'transparent',
      borderBottomWidth: index < FILTER_OPTIONS.length - 1 ? 0.5 : 0,
      borderBottomColor: theme.border,
    };

    return (
      <TouchableOpacity
        key={option.type}
        style={[styles.filterOption, filterOptionStyle]}
        onPress={() => handleFilterToggle(option.type)}
        activeOpacity={0.7}
      >
        <View style={styles.filterOptionLeft}>
          <Ionicons
            name={option.icon}
            size={16}
            color={isSelected ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.filterOptionText,
              { color: isSelected ? theme.primary : theme.text },
            ]}
          >
            {option.label}
          </Text>
        </View>

        {/* Checkbox moved to right side */}
        <View style={[styles.checkbox, getCheckboxStyle(isSelected)]}>
          {isSelected && (
            <Ionicons name="checkmark" size={12} color={theme.background} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryOption = (category: string, index: number) => {
    const isSelected = isCategorySelected(category);

    const categoryOptionStyle = {
      backgroundColor: isSelected ? theme.primary + '15' : 'transparent',
      borderBottomWidth: index < categories.length - 1 ? 0.5 : 0,
      borderBottomColor: theme.border,
      paddingLeft: 12, // Same padding as main options
    };

    return (
      <TouchableOpacity
        key={`category-${category}`}
        style={[styles.filterOption, categoryOptionStyle]}
        onPress={() => handleCategoryToggle(category)}
        activeOpacity={0.7}
      >
        <View style={styles.filterOptionLeft}>
          <Ionicons
            name={getCategoryIcon(category)}
            size={16}
            color={isSelected ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.filterOptionText,
              styles.categoryText,
              {
                color: isSelected ? theme.primary : theme.text,
              },
            ]}
          >
            {category}
          </Text>
        </View>

        {/* Checkbox moved to right side */}
        <View style={[styles.checkbox, getCheckboxStyle(isSelected)]}>
          {isSelected && (
            <Ionicons name="checkmark" size={12} color={theme.background} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <>
      {/* Overlay to detect outside clicks */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Dropdown Container */}
        <Animated.View
          style={[
            styles.dropdown,
            styles.dropdownPosition,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.text,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              top: anchorPosition.y + 5,
              right: SCREEN_WIDTH - anchorPosition.x,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              Filter Options
            </Text>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
          >
            {/* Main Filter Options */}
            {FILTER_OPTIONS.map(renderFilterOption)}

            {/* Categories Section */}
            {categories.length > 0 && (
              <>
                <View
                  style={[
                    styles.categoryHeader,
                    { borderTopColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryTitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Categories
                  </Text>
                </View>
                {categories.map(renderCategoryOption)}
              </>
            )}

            {/* Reset Option */}
            <TouchableOpacity
              style={[styles.resetOption, { borderTopColor: theme.border }]}
              onPress={() => {
                const resetFilters: MultipleFilterOptions = {
                  weak: false,
                  compromised: false,
                  duplicate: false,
                  favorite: false,
                  categories: [],
                };
                onFiltersChange(resetFilters);
                onClose();
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={theme.textSecondary}
              />
              <Text style={[styles.resetText, { color: theme.textSecondary }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdown: {
    minWidth: 200,
    maxWidth: 250,
    maxHeight: 400,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1001,
    overflow: 'hidden',
  },
  scrollContent: {
    maxHeight: 340, // Account for header height (~60px)
    flexGrow: 0,
  },
  header: {
    padding: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  categoryHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownPosition: {
    position: 'absolute',
  },
  iconSpacing: {
    marginLeft: 8,
  },
  categoryIconSpacing: {
    marginLeft: 6,
  },
  categoryText: {
    fontSize: 13,
  },
});

export default FilterDropdown;
