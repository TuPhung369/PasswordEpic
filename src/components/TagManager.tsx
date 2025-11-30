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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { PasswordEntry } from '../types/password';
import ConfirmDialog from './ConfirmDialog';

interface TagManagerProps {
  visible: boolean;
  onClose: () => void;
  entries: PasswordEntry[];
  onUpdateEntryTags: (entryId: string, tags: string[]) => void;
  _onBulkUpdateTags: (
    entryIds: string[],
    addTags: string[],
    removeTags: string[],
  ) => void;
}

interface TagStats {
  name: string;
  count: number;
  color: string;
  lastUsed?: Date;
  entries: string[];
}

const TagManager: React.FC<TagManagerProps> = ({
  visible,
  onClose,
  entries,
  onUpdateEntryTags,
  _onBulkUpdateTags,
}) => {
  const { t } = useTranslation();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [_showBulkModal, _setShowBulkModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagToRename, setTagToRename] = useState<string>('');
  const [currentView, setCurrentView] = useState<'tags' | 'entries'>('tags');
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmStyle?: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Tag colors (predefined for consistency)
  const tagColors = useMemo(
    () => [
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
    ],
    [],
  );

  // Calculate tag statistics
  const tagStats = useMemo((): TagStats[] => {
    const stats = new Map<string, TagStats>();

    entries.forEach(entry => {
      if (entry.tags) {
        entry.tags.forEach(tagName => {
          const existing = stats.get(tagName);
          if (existing) {
            existing.count++;
            existing.entries.push(entry.id);

            // Update last used
            if (entry.lastUsed) {
              const lastUsed = new Date(entry.lastUsed);
              if (!existing.lastUsed || lastUsed > existing.lastUsed) {
                existing.lastUsed = lastUsed;
              }
            }
          } else {
            stats.set(tagName, {
              name: tagName,
              count: 1,
              color: tagColors[stats.size % tagColors.length],
              lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
              entries: [entry.id],
            });
          }
        });
      }
    });

    return Array.from(stats.values()).sort((a, b) => b.count - a.count);
  }, [entries, tagColors]); // Filtered tags for search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tagStats;

    return tagStats.filter(tag =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [tagStats, searchQuery]);

  // Get entries for selected tags
  const entriesForSelectedTags = useMemo(() => {
    if (selectedTags.length === 0) return [];

    return entries.filter(
      entry =>
        entry.tags && selectedTags.every(tag => entry.tags!.includes(tag)),
    );
  }, [entries, selectedTags]);

  // Handlers
  const handleTagSelect = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(tag => tag !== tagName)
        : [...prev, tagName],
    );
  };

  const handleEntrySelect = (entryId: string) => {
    setSelectedEntries(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId],
    );
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      setDialogState({
        visible: true,
        title: t('tag_manager.error'),
        message: t('tag_manager.please_enter_tag_name'),
        confirmText: t('common.ok'),
        confirmStyle: 'destructive',
        onConfirm: () => setDialogState(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    const trimmedName = newTagName.trim();

    if (
      tagStats.some(tag => tag.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      setDialogState({
        visible: true,
        title: t('tag_manager.error'),
        message: t('tag_manager.tag_already_exists'),
        confirmText: t('common.ok'),
        confirmStyle: 'destructive',
        onConfirm: () => setDialogState(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    // For now, we'll just close the modal. In a real app, you'd create the tag
    // and probably assign it to selected entries or show a selection UI
    setNewTagName('');
    setShowCreateModal(false);

    setDialogState({
      visible: true,
      title: t('tag_manager.tag_created'),
      message: t('tag_manager.tag_created_message', { name: trimmedName }),
      confirmText: t('common.ok'),
      confirmStyle: 'default',
      onConfirm: () => setDialogState(prev => ({ ...prev, visible: false })),
    });
  };

  const handleRenameTag = () => {
    if (!newTagName.trim() || !tagToRename) {
      setDialogState({
        visible: true,
        title: t('tag_manager.error'),
        message: t('tag_manager.please_enter_tag_name'),
        confirmText: t('common.ok'),
        confirmStyle: 'destructive',
        onConfirm: () => setDialogState(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    const trimmedName = newTagName.trim();

    if (
      tagStats.some(tag => tag.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      setDialogState({
        visible: true,
        title: t('tag_manager.error'),
        message: t('tag_manager.tag_already_exists'),
        confirmText: t('common.ok'),
        confirmStyle: 'destructive',
        onConfirm: () => setDialogState(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    // Update all entries that have this tag
    const affectedEntries = entries.filter(
      entry => entry.tags && entry.tags.includes(tagToRename),
    );

    affectedEntries.forEach(entry => {
      const updatedTags = entry.tags!.map(tag =>
        tag === tagToRename ? trimmedName : tag,
      );
      onUpdateEntryTags(entry.id, updatedTags);
    });

    setNewTagName('');
    setTagToRename('');
    setShowRenameModal(false);
  };

  const handleDeleteTag = (tagName: string) => {
    const tag = tagStats.find(tagItem => tagItem.name === tagName);

    if (!tag) return;

    setDialogState({
      visible: true,
      title: t('tag_manager.delete_tag'),
      message: t('tag_manager.delete_tag_confirm', {
        name: tagName,
        count: tag.count,
      }),
      confirmText: t('common.delete'),
      confirmStyle: 'destructive',
      onConfirm: () => {
        // Remove tag from all entries
        const affectedEntries = entries.filter(
          entry => entry.tags && entry.tags.includes(tagName),
        );

        affectedEntries.forEach(entry => {
          const updatedTags = entry.tags!.filter(
            tagItem => tagItem !== tagName,
          );
          onUpdateEntryTags(entry.id, updatedTags);
        });
        setDialogState(prev => ({ ...prev, visible: false }));
      },
    });
  };

  // Bulk tag update handler (commented out as it's not currently used in UI)
  // const _handleBulkTagUpdate = async (entryIds: string[], addTags: string[], removeTags: string[]) => {
  //   if (selectedEntries.length === 0) {
  //     Alert.alert('Error', 'Please select entries to update');
  //     return;
  //   }

  //   onBulkUpdateTags(selectedEntries, addTags, removeTags);
  //   setSelectedEntries([]);
  //   _setShowBulkModal(false);
  // };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) return t('tag_manager.today');
    if (diffInDays === 1) return t('tag_manager.yesterday');
    if (diffInDays < 7) return t('tag_manager.days_ago', { count: diffInDays });
    if (diffInDays < 30)
      return t('tag_manager.weeks_ago', { count: Math.floor(diffInDays / 7) });
    return date.toLocaleDateString();
  };

  const renderTagItem = ({ item: tag }: { item: TagStats }) => (
    <TouchableOpacity
      style={[
        styles.tagItem,
        selectedTags.includes(tag.name) && styles.tagItemSelected,
      ]}
      onPress={() => handleTagSelect(tag.name)}
      onLongPress={() => handleDeleteTag(tag.name)}
    >
      <View style={styles.tagHeader}>
        <View
          style={[styles.tagColorIndicator, { backgroundColor: tag.color }]}
        />
        <Text style={styles.tagName}>{tag.name}</Text>
        <View style={styles.tagCount}>
          <Text style={styles.tagCountText}>{tag.count}</Text>
        </View>
      </View>

      {tag.lastUsed && (
        <Text style={styles.tagLastUsed}>
          {t('tag_manager.last_used', { date: formatDate(tag.lastUsed) })}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEntryItem = ({ item: entry }: { item: PasswordEntry }) => (
    <TouchableOpacity
      style={[
        styles.entryItem,
        selectedEntries.includes(entry.id) && styles.entryItemSelected,
      ]}
      onPress={() => handleEntrySelect(entry.id)}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryInfo}>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={styles.entryUsername}>{entry.username}</Text>
        </View>

        {selectedEntries.includes(entry.id) && (
          <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
        )}
      </View>

      {entry.tags && entry.tags.length > 0 && (
        <View style={styles.entryTags}>
          {entry.tags.map(tagName => {
            const tagStat = tagStats.find(tagItem => tagItem.name === tagName);
            return (
              <View
                key={tagName}
                style={[
                  styles.entryTag,
                  { backgroundColor: tagStat?.color || theme.primary },
                ]}
              >
                <Text style={styles.entryTagText}>{tagName}</Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderViewToggle = () => (
    <View style={styles.viewToggle}>
      <TouchableOpacity
        style={[
          styles.viewToggleButton,
          currentView === 'tags' && styles.viewToggleButtonActive,
        ]}
        onPress={() => setCurrentView('tags')}
      >
        <Ionicons
          name="pricetag-outline"
          size={20}
          color={currentView === 'tags' ? 'white' : theme.textSecondary}
        />
        <Text
          style={[
            styles.viewToggleText,
            currentView === 'tags' && styles.viewToggleTextActive,
          ]}
        >
          {t('tag_manager.tags_count', { count: tagStats.length })}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.viewToggleButton,
          currentView === 'entries' && styles.viewToggleButtonActive,
        ]}
        onPress={() => setCurrentView('entries')}
      >
        <Ionicons
          name="list-outline"
          size={20}
          color={currentView === 'entries' ? 'white' : theme.textSecondary}
        />
        <Text
          style={[
            styles.viewToggleText,
            currentView === 'entries' && styles.viewToggleTextActive,
          ]}
        >
          {t('tag_manager.entries_count', {
            count:
              selectedTags.length > 0
                ? entriesForSelectedTags.length
                : entries.length,
          })}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('tag_manager.create_tag')}</Text>

          <TextInput
            style={styles.modalInput}
            placeholder={t('tag_manager.tag_name')}
            placeholderTextColor={theme.textSecondary}
            value={newTagName}
            onChangeText={setNewTagName}
            autoFocus
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCreateButton}
              onPress={handleCreateTag}
            >
              <Text style={styles.modalCreateText}>
                {t('tag_manager.create_tag')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderRenameModal = () => (
    <Modal
      visible={showRenameModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowRenameModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('tag_manager.rename_tag')}</Text>
          <Text style={styles.modalSubtitle}>
            {t('tag_manager.renaming', { name: tagToRename })}
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder={t('tag_manager.new_tag_name')}
            placeholderTextColor={theme.textSecondary}
            value={newTagName}
            onChangeText={setNewTagName}
            autoFocus
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowRenameModal(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCreateButton}
              onPress={handleRenameTag}
            >
              <Text style={styles.modalCreateText}>
                {t('tag_manager.rename_tag')}
              </Text>
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
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{t('tag_manager.title')}</Text>

            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={theme.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t('tag_manager.search_tags')}
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchButton}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {renderViewToggle()}

          {selectedTags.length > 0 && (
            <View style={styles.selectedTagsContainer}>
              <Text style={styles.selectedTagsTitle}>
                {t('tag_manager.selected_tags', { count: selectedTags.length })}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.selectedTags}>
                  {selectedTags.map(tagName => {
                    const tagStat = tagStats.find(
                      tagItem => tagItem.name === tagName,
                    );
                    return (
                      <TouchableOpacity
                        key={tagName}
                        style={[
                          styles.selectedTag,
                          { backgroundColor: tagStat?.color || theme.primary },
                        ]}
                        onPress={() => handleTagSelect(tagName)}
                      >
                        <Text style={styles.selectedTagText}>{tagName}</Text>
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {currentView === 'tags' ? (
            <FlatList
              data={filteredTags}
              renderItem={renderTagItem}
              keyExtractor={item => item.name}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <FlatList
              data={selectedTags.length > 0 ? entriesForSelectedTags : entries}
              renderItem={renderEntryItem}
              keyExtractor={item => item.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}

          {selectedEntries.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {t('tag_manager.selected_count', {
                  count: selectedEntries.length,
                })}
              </Text>

              <TouchableOpacity
                style={styles.bulkActionButton}
                onPress={() => _setShowBulkModal(true)}
              >
                <Ionicons name="pricetag-outline" size={20} color="white" />
                <Text style={styles.bulkActionText}>
                  {t('tag_manager.manage_tags')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {renderCreateModal()}
      {renderRenameModal()}

      <ConfirmDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        confirmStyle={dialogState.confirmStyle}
        onConfirm={dialogState.onConfirm}
        onCancel={() => setDialogState(prev => ({ ...prev, visible: false }))}
      />
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
    viewToggle: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 4,
    },
    viewToggleButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
    },
    viewToggleButtonActive: {
      backgroundColor: theme.primary,
    },
    viewToggleText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    viewToggleTextActive: {
      color: 'white',
    },
    selectedTagsContainer: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    selectedTagsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    selectedTags: {
      flexDirection: 'row',
      gap: 8,
    },
    selectedTag: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    selectedTagText: {
      fontSize: 12,
      fontWeight: '500',
      color: 'white',
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    tagItem: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tagItemSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
    },
    tagHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    tagColorIndicator: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginRight: 12,
    },
    tagName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    tagCount: {
      backgroundColor: theme.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tagCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.primary,
    },
    tagLastUsed: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 28,
    },
    entryItem: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    entryItemSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    entryInfo: {
      flex: 1,
    },
    entryTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 2,
    },
    entryUsername: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    entryTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    entryTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    entryTagText: {
      fontSize: 11,
      fontWeight: '500',
      color: 'white',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingBottom: 34, // Safe area
    },
    footerText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    bulkActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 6,
    },
    bulkActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'white',
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
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
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

export default TagManager;
