import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { PasswordEntry } from '../types/password';
import { SearchFilters, SearchOptions } from '../services/searchService';

interface AdvancedSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (filters: SearchFilters, options: SearchOptions) => void;
  onSaveSearch: (
    name: string,
    filters: SearchFilters,
    options: SearchOptions,
  ) => void;
  entries: PasswordEntry[];
  initialFilters?: Partial<SearchFilters>;
  savedSearches?: Array<{
    name: string;
    filters: SearchFilters;
    options: SearchOptions;
  }>;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  visible,
  onClose,
  onSearch,
  onSaveSearch,
  entries,
  initialFilters,
  savedSearches = [],
}) => {
  const { t } = useTranslation();
  // Mock theme context for now
  const theme = {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    card: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    primary: '#007AFF',
    border: '#E0E0E0',
  };
  const styles = createStyles(theme);

  // Search state
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    categories: [],
    tags: [],
    strengthLevels: [],
    hasNotes: null,
    hasCustomFields: null,
    isCompromised: null,
    isFavorite: null,
    dateRange: { start: null, end: null },
    lastUsedRange: { start: null, end: null },
    ...initialFilters,
  });

  const [options, setOptions] = useState<SearchOptions>({
    sortBy: 'name',
    sortOrder: 'asc',
    fuzzySearch: true,
    searchInNotes: true,
    searchInCustomFields: true,
  });

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    categories: false,
    tags: false,
    strength: false,
    properties: false,
    dates: false,
    advanced: false,
  });

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [searchName, setSearchName] = useState('');

  // Available options from entries
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    entries.forEach(entry => {
      if (entry.category) categories.add(entry.category);
    });
    return Array.from(categories).sort();
  }, [entries]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach(entry => {
      entry.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [entries]);

  const strengthLevels: Array<'weak' | 'fair' | 'good' | 'strong'> = [
    'weak',
    'fair',
    'good',
    'strong',
  ];

  const sortOptions = [
    { key: 'name', label: t('advanced_search.sort_name') },
    { key: 'category', label: t('categories.title') },
    { key: 'created', label: t('advanced_search.sort_created') },
    { key: 'modified', label: t('advanced_search.sort_modified') },
    { key: 'lastUsed', label: t('advanced_search.sort_used') },
    { key: 'strength', label: t('advanced_search.sort_strength') },
  ];

  const datePresets = [
    { label: t('advanced_search.last_7_days'), days: 7 },
    { label: t('advanced_search.last_30_days'), days: 30 },
    { label: t('advanced_search.last_90_days'), days: 90 },
    { label: t('advanced_search.last_year'), days: 365 },
  ];

  // Handlers
  const handleSectionToggle = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleTagToggle = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(existingTag => existingTag !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleStrengthToggle = (
    strength: 'weak' | 'fair' | 'good' | 'strong',
  ) => {
    setFilters(prev => ({
      ...prev,
      strengthLevels: prev.strengthLevels.includes(strength)
        ? prev.strengthLevels.filter(s => s !== strength)
        : [...prev.strengthLevels, strength],
    }));
  };

  const handleDatePreset = (days: number, type: 'created' | 'lastUsed') => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (type === 'created') {
      setFilters(prev => ({
        ...prev,
        dateRange: { start: startDate, end: endDate },
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        lastUsedRange: { start: startDate, end: endDate },
      }));
    }
  };

  const handleClearFilters = () => {
    setFilters({
      query: '',
      categories: [],
      tags: [],
      strengthLevels: [],
      hasNotes: null,
      hasCustomFields: null,
      isCompromised: null,
      isFavorite: null,
      dateRange: { start: null, end: null },
      lastUsedRange: { start: null, end: null },
    });
  };

  const handleSearch = () => {
    onSearch(filters, options);
    onClose();
  };

  const handleSaveSearch = () => {
    if (searchName.trim()) {
      onSaveSearch(searchName.trim(), filters, options);
      setSearchName('');
      setShowSaveModal(false);
    }
  };

  const handleLoadSavedSearch = (savedSearch: {
    name: string;
    filters: SearchFilters;
    options: SearchOptions;
  }) => {
    setFilters(savedSearch.filters);
    setOptions(savedSearch.options);
  };

  const renderSectionHeader = (
    title: string,
    icon: string,
    section: keyof typeof expandedSections,
  ) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => handleSectionToggle(section)}
    >
      <View style={styles.sectionHeaderLeft}>
        <Icon name={icon} size={20} color={theme.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Icon
        name={expandedSections[section] ? 'chevron-up' : 'chevron-down'}
        size={24}
        color={theme.textSecondary}
      />
    </TouchableOpacity>
  );

  const renderBasicSearch = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.basic_search'),
        'search',
        'basic',
      )}
      {expandedSections.basic && (
        <>
          <View style={styles.inputContainer}>
            <Icon
              name="search"
              size={20}
              color={theme.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              placeholder={t('advanced_search.search_placeholder')}
              placeholderTextColor={theme.textSecondary}
              value={filters.query}
              onChangeText={text =>
                setFilters(prev => ({ ...prev, query: text }))
              }
            />
            {filters.query.length > 0 && (
              <TouchableOpacity
                onPress={() => setFilters(prev => ({ ...prev, query: '' }))}
                style={styles.clearButton}
              >
                <Icon
                  name="close-circle"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );

  const renderCategoriesSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.categories'),
        'folder',
        'categories',
      )}
      {expandedSections.categories && (
        <View style={styles.checkboxContainer}>
          {availableCategories.map(category => (
            <TouchableOpacity
              key={category}
              style={styles.checkboxItem}
              onPress={() => handleCategoryToggle(category)}
            >
              <Icon
                name={
                  filters.categories.includes(category)
                    ? 'checkbox'
                    : 'square-outline'
                }
                size={20}
                color={
                  filters.categories.includes(category)
                    ? theme.primary
                    : theme.textSecondary
                }
              />
              <Text style={styles.checkboxLabel}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderTagsSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(t('advanced_search.tags'), 'label', 'tags')}
      {expandedSections.tags && (
        <View style={styles.tagContainer}>
          {availableTags.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagChip,
                filters.tags.includes(tag) && styles.tagChipSelected,
              ]}
              onPress={() => handleTagToggle(tag)}
            >
              <Text
                style={[
                  styles.tagChipText,
                  filters.tags.includes(tag) && styles.tagChipTextSelected,
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderStrengthSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.password_strength'),
        'security',
        'strength',
      )}
      {expandedSections.strength && (
        <View style={styles.strengthContainer}>
          {strengthLevels.map(strength => (
            <TouchableOpacity
              key={strength}
              style={[
                styles.strengthChip,
                filters.strengthLevels.includes(strength) &&
                  styles.strengthChipSelected,
                { backgroundColor: getStrengthColor(strength) + '20' },
                filters.strengthLevels.includes(strength) && {
                  backgroundColor: getStrengthColor(strength),
                },
              ]}
              onPress={() => handleStrengthToggle(strength)}
            >
              <Text
                style={[
                  styles.strengthChipText,
                  { color: getStrengthColor(strength) },
                  filters.strengthLevels.includes(strength) &&
                    styles.strengthChipTextSelected,
                ]}
              >
                {strength.charAt(0).toUpperCase() + strength.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderPropertiesSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.properties'),
        'tune',
        'properties',
      )}
      {expandedSections.properties && (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.has_notes')}
            </Text>
            <View style={styles.switchGroup}>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  filters.hasNotes === true && styles.switchOptionActive,
                ]}
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    hasNotes: prev.hasNotes === true ? null : true,
                  }))
                }
              >
                <Text
                  style={[
                    styles.switchOptionText,
                    filters.hasNotes === true && styles.switchOptionTextActive,
                  ]}
                >
                  {t('common.yes')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  filters.hasNotes === false && styles.switchOptionActive,
                ]}
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    hasNotes: prev.hasNotes === false ? null : false,
                  }))
                }
              >
                <Text
                  style={[
                    styles.switchOptionText,
                    filters.hasNotes === false && styles.switchOptionTextActive,
                  ]}
                >
                  {t('common.no')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.has_custom_fields')}
            </Text>
            <View style={styles.switchGroup}>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  filters.hasCustomFields === true && styles.switchOptionActive,
                ]}
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    hasCustomFields:
                      prev.hasCustomFields === true ? null : true,
                  }))
                }
              >
                <Text
                  style={[
                    styles.switchOptionText,
                    filters.hasCustomFields === true &&
                      styles.switchOptionTextActive,
                  ]}
                >
                  {t('common.yes')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  filters.hasCustomFields === false &&
                    styles.switchOptionActive,
                ]}
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    hasCustomFields:
                      prev.hasCustomFields === false ? null : false,
                  }))
                }
              >
                <Text
                  style={[
                    styles.switchOptionText,
                    filters.hasCustomFields === false &&
                      styles.switchOptionTextActive,
                  ]}
                >
                  {t('common.no')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.favorites_only')}
            </Text>
            <Switch
              value={filters.isFavorite === true}
              onValueChange={value =>
                setFilters(prev => ({
                  ...prev,
                  isFavorite: value ? true : null,
                }))
              }
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.compromised_only')}
            </Text>
            <Switch
              value={filters.isCompromised === true}
              onValueChange={value =>
                setFilters(prev => ({
                  ...prev,
                  isCompromised: value ? true : null,
                }))
              }
              thumbColor={
                filters.isCompromised ? '#F44336' : theme.textSecondary
              }
              trackColor={{ false: theme.border, true: '#F4433640' }}
            />
          </View>
        </>
      )}
    </View>
  );

  const renderDatesSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.date_filters'),
        'date-range',
        'dates',
      )}
      {expandedSections.dates && (
        <>
          <Text style={styles.subsectionTitle}>
            {t('advanced_search.created_date')}
          </Text>
          <View style={styles.presetContainer}>
            {datePresets.map(preset => (
              <TouchableOpacity
                key={`created-${preset.days}`}
                style={styles.presetButton}
                onPress={() => handleDatePreset(preset.days, 'created')}
              >
                <Text style={styles.presetButtonText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.subsectionTitle}>
            {t('advanced_search.last_used')}
          </Text>
          <View style={styles.presetContainer}>
            {datePresets.map(preset => (
              <TouchableOpacity
                key={`lastused-${preset.days}`}
                style={styles.presetButton}
                onPress={() => handleDatePreset(preset.days, 'lastUsed')}
              >
                <Text style={styles.presetButtonText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderAdvancedSection = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.advanced_options'),
        'settings',
        'advanced',
      )}
      {expandedSections.advanced && (
        <>
          <Text style={styles.subsectionTitle}>
            {t('advanced_search.sort_by')}
          </Text>
          <View style={styles.sortContainer}>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.sortOption,
                  options.sortBy === option.key && styles.sortOptionActive,
                ]}
                onPress={() =>
                  setOptions(prev => ({ ...prev, sortBy: option.key as any }))
                }
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    options.sortBy === option.key &&
                      styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.sort_order')}
            </Text>
            <View style={styles.switchGroup}>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  options.sortOrder === 'asc' && styles.switchOptionActive,
                ]}
                onPress={() =>
                  setOptions(prev => ({ ...prev, sortOrder: 'asc' }))
                }
              >
                <Icon
                  name="arrow-up"
                  size={16}
                  color={
                    options.sortOrder === 'asc' ? 'white' : theme.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.switchOptionText,
                    options.sortOrder === 'asc' &&
                      styles.switchOptionTextActive,
                  ]}
                >
                  {t('advanced_search.ascending')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  options.sortOrder === 'desc' && styles.switchOptionActive,
                ]}
                onPress={() =>
                  setOptions(prev => ({ ...prev, sortOrder: 'desc' }))
                }
              >
                <Icon
                  name="arrow-down"
                  size={16}
                  color={
                    options.sortOrder === 'desc' ? 'white' : theme.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.switchOptionText,
                    options.sortOrder === 'desc' &&
                      styles.switchOptionTextActive,
                  ]}
                >
                  {t('advanced_search.descending')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.fuzzy_search')}
            </Text>
            <Switch
              value={options.fuzzySearch}
              onValueChange={value =>
                setOptions(prev => ({ ...prev, fuzzySearch: value }))
              }
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.search_in_notes')}
            </Text>
            <Switch
              value={options.searchInNotes}
              onValueChange={value =>
                setOptions(prev => ({ ...prev, searchInNotes: value }))
              }
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {t('advanced_search.search_in_custom_fields')}
            </Text>
            <Switch
              value={options.searchInCustomFields}
              onValueChange={value =>
                setOptions(prev => ({ ...prev, searchInCustomFields: value }))
              }
              thumbColor={theme.primary}
              trackColor={{ false: theme.border, true: theme.primary + '40' }}
            />
          </View>
        </>
      )}
    </View>
  );

  const renderSavedSearches = () => (
    <View style={styles.section}>
      {renderSectionHeader(
        t('advanced_search.saved_searches'),
        'bookmark',
        'basic',
      )}
      {savedSearches.map((savedSearch, index) => (
        <TouchableOpacity
          key={index}
          style={styles.savedSearchItem}
          onPress={() => handleLoadSavedSearch(savedSearch)}
        >
          <Icon name="search" size={20} color={theme.primary} />
          <Text style={styles.savedSearchName}>{savedSearch.name}</Text>
          <Icon name="arrow-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak':
        return '#F44336';
      case 'fair':
        return '#FF9800';
      case 'good':
        return '#2196F3';
      case 'strong':
        return '#4CAF50';
      default:
        return theme.textSecondary;
    }
  };

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

            <Text style={styles.headerTitle}>{t('advanced_search.title')}</Text>

            <TouchableOpacity
              onPress={handleClearFilters}
              style={styles.headerButton}
            >
              <Text style={styles.clearText}>{t('advanced_search.clear')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {savedSearches.length > 0 && renderSavedSearches()}
            {renderBasicSearch()}
            {renderCategoriesSection()}
            {renderTagsSection()}
            {renderStrengthSection()}
            {renderPropertiesSection()}
            {renderDatesSection()}
            {renderAdvancedSection()}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, styles.saveButton]}
              onPress={() => setShowSaveModal(true)}
            >
              <Icon name="bookmark-outline" size={20} color={theme.primary} />
              <Text style={styles.saveButtonText}>
                {t('advanced_search.save_search')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.footerButton, styles.searchButton]}
              onPress={handleSearch}
            >
              <Icon name="search" size={20} color="white" />
              <Text style={styles.searchButtonText}>{t('common.search')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save Search Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.saveModalOverlay}>
          <View style={styles.saveModalContent}>
            <Text style={styles.saveModalTitle}>
              {t('advanced_search.save_search')}
            </Text>

            <TextInput
              style={styles.saveModalInput}
              placeholder={t('advanced_search.enter_search_name')}
              placeholderTextColor={theme.textSecondary}
              value={searchName}
              onChangeText={setSearchName}
              autoFocus
            />

            <View style={styles.saveModalActions}>
              <TouchableOpacity
                style={styles.saveModalCancel}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.saveModalCancelText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalSave}
                onPress={handleSaveSearch}
                disabled={!searchName.trim()}
              >
                <Text style={styles.saveModalSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    clearText: {
      fontSize: 16,
      color: theme.primary,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    section: {
      marginVertical: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface || theme.card,
      borderRadius: 12,
      marginBottom: 8,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 12,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface || theme.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inputIcon: {
      marginRight: 12,
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    clearButton: {
      padding: 4,
    },
    checkboxContainer: {
      gap: 8,
    },
    checkboxItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    checkboxLabel: {
      fontSize: 16,
      color: theme.text,
      marginLeft: 12,
    },
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    tagChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.surface || theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tagChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tagChipText: {
      fontSize: 14,
      color: theme.text,
    },
    tagChipTextSelected: {
      color: 'white',
    },
    strengthContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
    },
    strengthChip: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    strengthChipSelected: {
      borderColor: 'transparent',
    },
    strengthChipText: {
      fontSize: 14,
      fontWeight: '600',
    },
    strengthChipTextSelected: {
      color: 'white',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    switchLabel: {
      fontSize: 16,
      color: theme.text,
    },
    switchGroup: {
      flexDirection: 'row',
      gap: 8,
    },
    switchOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.surface || theme.card,
      borderRadius: 16,
      gap: 4,
    },
    switchOptionActive: {
      backgroundColor: theme.primary,
    },
    switchOptionText: {
      fontSize: 14,
      color: theme.text,
    },
    switchOptionTextActive: {
      color: 'white',
    },
    subsectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 16,
      marginBottom: 8,
      marginTop: 16,
    },
    presetContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
    },
    presetButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.surface || theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    presetButtonText: {
      fontSize: 14,
      color: theme.text,
    },
    sortContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sortOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.surface || theme.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sortOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    sortOptionText: {
      fontSize: 14,
      color: theme.text,
    },
    sortOptionTextActive: {
      color: 'white',
    },
    savedSearchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface || theme.card,
      borderRadius: 12,
      marginBottom: 8,
    },
    savedSearchName: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      marginLeft: 12,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 12,
      paddingBottom: 34, // Safe area
    },
    footerButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    saveButton: {
      backgroundColor: theme.surface || theme.card,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
    },
    searchButton: {
      backgroundColor: theme.primary,
    },
    searchButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
    saveModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    saveModalContent: {
      backgroundColor: theme.surface || theme.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    saveModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    saveModalInput: {
      backgroundColor: theme.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 20,
    },
    saveModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    saveModalCancel: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 12,
    },
    saveModalCancelText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    saveModalSave: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 12,
    },
    saveModalSaveText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
  });

export default AdvancedSearchModal;
