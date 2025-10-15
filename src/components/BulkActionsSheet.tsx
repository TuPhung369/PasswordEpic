import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ConfirmDialog from './ConfirmDialog';
import { PasswordEntry, PasswordCategory } from '../types/password';

interface BulkActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedEntries: PasswordEntry[];
  categories: PasswordCategory[];
  onBulkDelete: (entryIds: string[]) => void;
  onBulkMove: (entryIds: string[], categoryId: string) => void;
  onBulkUpdateTags: (
    entryIds: string[],
    addTags: string[],
    removeTags: string[],
  ) => void;
  onBulkToggleFavorite: (entryIds: string[], isFavorite: boolean) => void;
  onBulkExport: (entryIds: string[]) => void;
}

interface BulkAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  destructive?: boolean;
  requiresConfirmation?: boolean;
}

const BulkActionsSheet: React.FC<BulkActionsSheetProps> = ({
  visible,
  onClose,
  selectedEntries,
  categories,
  onBulkDelete,
  onBulkMove,
  onBulkUpdateTags,
  onBulkToggleFavorite,
  onBulkExport,
}) => {
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
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [tagsToRemove, setTagsToRemove] = useState<string[]>([]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmStyle?: 'default' | 'destructive';
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Calculate statistics
  const entryCount = selectedEntries.length;
  const favoriteCount = selectedEntries.filter(
    entry => entry.isFavorite,
  ).length;
  const categoriesUsed = new Set(
    selectedEntries.map(entry => entry.category).filter(Boolean),
  );

  // Get all existing tags from selected entries
  const existingTags = Array.from(
    new Set(selectedEntries.flatMap(entry => entry.tags || []).filter(Boolean)),
  ).sort();

  // Define bulk actions
  const bulkActions: BulkAction[] = [
    {
      id: 'move',
      title: 'Move to Category',
      icon: 'folder-outline',
      color: theme.primary,
    },
    {
      id: 'tags',
      title: 'Manage Tags',
      icon: 'pricetag-outline',
      color: theme.primary,
    },
    {
      id: 'favorite',
      title:
        favoriteCount === entryCount
          ? 'Remove from Favorites'
          : 'Add to Favorites',
      icon: favoriteCount === entryCount ? 'heart' : 'heart-outline',
      color: theme.warning,
    },
    {
      id: 'export',
      title: 'Export',
      icon: 'download-outline',
      color: theme.success,
    },
    {
      id: 'delete',
      title: 'Delete',
      icon: 'trash-outline',
      color: theme.error,
      destructive: true,
      requiresConfirmation: true,
    },
  ];

  // Handlers
  const handleAction = (actionId: string) => {
    const entryIds = selectedEntries.map(entry => entry.id);

    switch (actionId) {
      case 'move':
        setShowCategoriesModal(true);
        break;

      case 'tags':
        setShowTagsModal(true);
        break;

      case 'favorite':
        const newFavoriteState = favoriteCount !== entryCount;
        onBulkToggleFavorite(entryIds, newFavoriteState);
        onClose();
        break;

      case 'export':
        onBulkExport(entryIds);
        onClose();
        break;

      case 'delete':
        handleDeleteConfirmation();
        break;
    }
  };

  const handleDeleteConfirmation = () => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Passwords',
      message: `Are you sure you want to delete ${entryCount} password${
        entryCount === 1 ? '' : 's'
      }? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmStyle: 'destructive',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        const entryIds = selectedEntries.map(entry => entry.id);
        onBulkDelete(entryIds);
        onClose();
      },
    });
  };

  const handleCategorySelect = (categoryId: string) => {
    const entryIds = selectedEntries.map(entry => entry.id);
    onBulkMove(entryIds, categoryId);
    setShowCategoriesModal(false);
    onClose();
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tagsToAdd.includes(trimmedTag)) {
      setTagsToAdd(prev => [...prev, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTagFromAdd = (tag: string) => {
    setTagsToAdd(prev => prev.filter(t => t !== tag));
  };

  const handleToggleTagForRemoval = (tag: string) => {
    setTagsToRemove(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const handleApplyTags = () => {
    const entryIds = selectedEntries.map(entry => entry.id);
    onBulkUpdateTags(entryIds, tagsToAdd, tagsToRemove);
    setShowTagsModal(false);
    setTagsToAdd([]);
    setTagsToRemove([]);
    setTagInput('');
    onClose();
  };

  const renderActionItem = ({ item: action }: { item: BulkAction }) => (
    <TouchableOpacity
      style={[
        styles.actionItem,
        action.destructive && styles.actionItemDestructive,
      ]}
      onPress={() => handleAction(action.id)}
    >
      <View
        style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}
      >
        <Icon name={action.icon} size={24} color={action.color} />
      </View>

      <View style={styles.actionContent}>
        <Text
          style={[
            styles.actionTitle,
            action.destructive && styles.actionTitleDestructive,
          ]}
        >
          {action.title}
        </Text>
      </View>

      <Icon name="chevron-forward" size={24} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  const renderCategoryItem = ({
    item: category,
  }: {
    item: PasswordCategory;
  }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => handleCategorySelect(category.id)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
        <Icon name={category.icon} size={20} color="white" />
      </View>

      <Text style={styles.categoryName}>{category.name}</Text>

      <Icon name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  const renderCategoriesModal = () => (
    <Modal
      visible={showCategoriesModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCategoriesModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity
              onPress={() => setShowCategoriesModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={item => item.id}
            style={styles.modalList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );

  const renderTagsModal = () => (
    <Modal
      visible={showTagsModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowTagsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Manage Tags</Text>
            <TouchableOpacity
              onPress={() => setShowTagsModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Add Tags Section */}
          <View style={styles.tagSection}>
            <Text style={styles.tagSectionTitle}>Add Tags</Text>

            <View style={styles.tagInputContainer}>
              <TextInput
                style={styles.tagInput}
                placeholder="Enter tag name..."
                placeholderTextColor={theme.textSecondary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={handleAddTag}
                disabled={!tagInput.trim()}
              >
                <Icon
                  name="add"
                  size={20}
                  color={tagInput.trim() ? theme.primary : theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {tagsToAdd.length > 0 && (
              <View style={styles.tagList}>
                {tagsToAdd.map(tag => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveTagFromAdd(tag)}
                    >
                      <Icon name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Remove Tags Section */}
          {existingTags.length > 0 && (
            <View style={styles.tagSection}>
              <Text style={styles.tagSectionTitle}>Remove Existing Tags</Text>

              <View style={styles.tagList}>
                {existingTags.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.existingTagChip,
                      tagsToRemove.includes(tag) &&
                        styles.existingTagChipSelected,
                    ]}
                    onPress={() => handleToggleTagForRemoval(tag)}
                  >
                    <Text
                      style={[
                        styles.existingTagChipText,
                        tagsToRemove.includes(tag) &&
                          styles.existingTagChipTextSelected,
                      ]}
                    >
                      {tag}
                    </Text>
                    {tagsToRemove.includes(tag) && (
                      <Icon name="checkmark" size={16} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowTagsModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalApplyButton}
              onPress={handleApplyTags}
              disabled={tagsToAdd.length === 0 && tagsToRemove.length === 0}
            >
              <Text style={styles.modalApplyText}>Apply Changes</Text>
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
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>Bulk Actions</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {entryCount} password{entryCount === 1 ? '' : 's'} selected
              </Text>

              {categoriesUsed.size > 0 && (
                <Text style={styles.summaryDetail}>
                  From {categoriesUsed.size} categor
                  {categoriesUsed.size === 1 ? 'y' : 'ies'}
                </Text>
              )}

              {favoriteCount > 0 && (
                <Text style={styles.summaryDetail}>
                  {favoriteCount} favorite{favoriteCount === 1 ? '' : 's'}
                </Text>
              )}
            </View>

            <FlatList
              data={bulkActions}
              renderItem={renderActionItem}
              keyExtractor={item => item.id}
              style={styles.actionsList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {renderCategoriesModal()}
      {renderTagsModal()}

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 34, // Safe area
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    summary: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      marginHorizontal: 20,
      marginVertical: 16,
      borderRadius: 12,
    },
    summaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    summaryDetail: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    actionsList: {
      paddingHorizontal: 20,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 8,
    },
    actionItemDestructive: {
      backgroundColor: theme.error + '10',
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    actionTitleDestructive: {
      color: theme.error,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 34, // Safe area
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalList: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 8,
    },
    categoryIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    categoryName: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
    },
    tagSection: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tagSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    tagInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tagInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      paddingVertical: 8,
    },
    addTagButton: {
      padding: 8,
    },
    tagList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    tagChipText: {
      fontSize: 14,
      fontWeight: '500',
      color: 'white',
    },
    existingTagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    existingTagChipSelected: {
      backgroundColor: theme.error,
      borderColor: theme.error,
    },
    existingTagChipText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    existingTagChipTextSelected: {
      color: 'white',
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalCancelText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    modalApplyButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.primary,
      borderRadius: 12,
    },
    modalApplyText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
  });

export default BulkActionsSheet;
