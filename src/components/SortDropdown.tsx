import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export interface SortOptions {
  field: 'name' | 'dateModified' | 'dateCreated' | 'category' | 'strength';
  direction: 'asc' | 'desc';
}

interface SortDropdownProps {
  visible: boolean;
  onClose: () => void;
  currentSort: SortOptions;
  onSortChange: (sort: SortOptions) => void;
  anchorPosition?: { x: number; y: number };
}

const SORT_OPTIONS = [
  {
    field: 'name' as const,
    labelKey: 'sort_dropdown.name_asc',
    icon: 'text-outline',
  },
  {
    field: 'dateModified' as const,
    labelKey: 'sort_dropdown.date_newest',
    icon: 'calendar-outline',
  },
  {
    field: 'dateCreated' as const,
    labelKey: 'sort_dropdown.date_oldest',
    icon: 'time-outline',
  },
  {
    field: 'category' as const,
    labelKey: 'filter_dropdown.categories',
    icon: 'folder-outline',
  },
  {
    field: 'strength' as const,
    labelKey: 'sort_dropdown.strength',
    icon: 'shield-outline',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SortDropdown: React.FC<SortDropdownProps> = ({
  visible,
  onClose,
  currentSort,
  onSortChange,
  anchorPosition = { x: SCREEN_WIDTH - 200, y: 100 },
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
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

  const handleSortSelect = (field: SortOptions['field']) => {
    const newSort: SortOptions = {
      field,
      direction:
        currentSort.field === field && currentSort.direction === 'asc'
          ? 'desc'
          : 'asc',
    };

    onSortChange(newSort);
    onClose();
  };

  const renderSortOption = (
    option: (typeof SORT_OPTIONS)[0],
    index: number,
  ) => {
    const isSelected = currentSort.field === option.field;
    const isAsc = currentSort.direction === 'asc';

    const sortOptionStyle = {
      backgroundColor: isSelected ? theme.primary + '15' : 'transparent',
      borderBottomWidth: index < SORT_OPTIONS.length - 1 ? 0.5 : 0,
      borderBottomColor: theme.border,
    };

    return (
      <TouchableOpacity
        key={option.field}
        style={[styles.sortOption, sortOptionStyle]}
        onPress={() => handleSortSelect(option.field)}
        activeOpacity={0.7}
      >
        <View style={styles.sortOptionLeft}>
          <Ionicons
            name={option.icon}
            size={16}
            color={isSelected ? theme.primary : theme.textSecondary}
          />
          <Text
            style={[
              styles.sortOptionText,
              { color: isSelected ? theme.primary : theme.text },
            ]}
          >
            {t(option.labelKey)}
          </Text>
        </View>

        {isSelected && (
          <Ionicons
            name={isAsc ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.primary}
          />
        )}
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
              top: anchorPosition.y + 5, // Offset nhỏ để sát icon
              right: SCREEN_WIDTH - anchorPosition.x,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('sort_dropdown.title')}
            </Text>
          </View>

          {/* Options */}
          {SORT_OPTIONS.map(renderSortOption)}

          {/* Reset Option */}
          <TouchableOpacity
            style={[styles.resetOption, { borderTopColor: theme.border }]}
            onPress={() => {
              onSortChange({ field: 'dateModified', direction: 'desc' });
              onClose();
            }}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.resetText, { color: theme.textSecondary }]}>
              {t('common.refresh')}
            </Text>
          </TouchableOpacity>
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
    minWidth: 180,
    maxWidth: 220,
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
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
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
  dropdownPosition: {
    position: 'absolute',
  },
});

export default SortDropdown;
