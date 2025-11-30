import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from './ConfirmDialog';
import { PasswordEntry } from '../types/password';

interface ExportOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  entries: PasswordEntry[];
  onExport: (
    entries: PasswordEntry[],
    format: ExportFormat,
    options: ExportOptions,
  ) => void;
}

export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  icon: string;
  description: string;
  supportsEncryption: boolean;
  supportsAttachments: boolean;
}

export interface ExportOptions {
  includeMetadata: boolean;
  includeAttachments: boolean;
  includeCategories: boolean;
  includeTags: boolean;
  includeNotes: boolean;
  includeHistory: boolean;
  encrypt: boolean;
  encryptionPassword?: string;
  groupByCategory: boolean;
  dateFormat: 'iso' | 'local' | 'timestamp';
  fieldDelimiter: ',' | ';' | '\t' | '|';
}

const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  visible,
  onClose,
  entries,
  onExport,
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

  // Available export formats
  const exportFormats: ExportFormat[] = [
    {
      id: 'json',
      name: 'JSON',
      extension: 'json',
      icon: 'code-slash-outline',
      description: 'Structured data format with full feature support',
      supportsEncryption: true,
      supportsAttachments: true,
    },
    {
      id: 'csv',
      name: 'CSV',
      extension: 'csv',
      icon: 'grid-outline',
      description: 'Spreadsheet format for easy viewing and editing',
      supportsEncryption: false,
      supportsAttachments: false,
    },
    {
      id: 'xml',
      name: 'XML',
      extension: 'xml',
      icon: 'document-text-outline',
      description: 'Structured markup format',
      supportsEncryption: true,
      supportsAttachments: false,
    },
    {
      id: 'bitwarden',
      name: 'Bitwarden JSON',
      extension: 'json',
      icon: 'shield-checkmark-outline',
      description: 'Compatible with Bitwarden password manager',
      supportsEncryption: false,
      supportsAttachments: false,
    },
    {
      id: 'lastpass',
      name: 'LastPass CSV',
      extension: 'csv',
      icon: 'key-outline',
      description: 'Compatible with LastPass password manager',
      supportsEncryption: false,
      supportsAttachments: false,
    },
    {
      id: 'keepass',
      name: 'KeePass XML',
      extension: 'xml',
      icon: 'lock-closed',
      description: 'Compatible with KeePass password manager',
      supportsEncryption: true,
      supportsAttachments: false,
    },
  ];

  // Date format options
  const dateFormats = [
    { id: 'iso', name: 'ISO 8601', example: '2024-01-15T10:30:00Z' },
    { id: 'local', name: 'Local Format', example: '1/15/2024 10:30 AM' },
    { id: 'timestamp', name: 'Unix Timestamp', example: '1705316600' },
  ];

  // Field delimiter options
  const fieldDelimiters = [
    { id: ',', name: 'Comma (,)', description: 'Standard CSV format' },
    { id: ';', name: 'Semicolon (;)', description: 'European CSV format' },
    { id: '\t', name: 'Tab', description: 'Tab-separated values' },
    { id: '|', name: 'Pipe (|)', description: 'Pipe-separated values' },
  ];

  // State
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(
    exportFormats[0],
  );
  const [showFormatDetails, setShowFormatDetails] = useState(false);
  const [_showDateFormatOptions, _setShowDateFormatOptions] = useState(false);
  const [_showDelimiterOptions, _setShowDelimiterOptions] = useState(false);

  const [options, setOptions] = useState<ExportOptions>({
    includeMetadata: true,
    includeAttachments: false,
    includeCategories: true,
    includeTags: true,
    includeNotes: true,
    includeHistory: false,
    encrypt: true, // Default to encrypted for security - using master password
    encryptionPassword: undefined, // Not needed - will use master password
    groupByCategory: false,
    dateFormat: 'iso',
    fieldDelimiter: ',',
  });

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

  // Statistics
  const entriesWithAttachments = entries.filter(
    e => e.attachments && e.attachments.length > 0,
  );
  const entriesWithNotes = entries.filter(
    e => e.notes && e.notes.trim().length > 0,
  );
  const entriesWithTags = entries.filter(e => e.tags && e.tags.length > 0);
  const categoriesCount = new Set(entries.map(e => e.category).filter(Boolean))
    .size;

  // Handlers
  const handleOptionChange = (key: keyof ExportOptions, value: any) => {
    setOptions(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFormatSelect = (format: ExportFormat) => {
    setSelectedFormat(format);
    setShowFormatDetails(false);

    // Update options based on format capabilities
    setOptions(prev => ({
      ...prev,
      includeAttachments: format.supportsAttachments
        ? prev.includeAttachments
        : false,
      encrypt: format.supportsEncryption ? prev.encrypt : false,
      encryptionPassword: format.supportsEncryption
        ? prev.encryptionPassword
        : undefined,
    }));
  };

  const handleExport = () => {
    // Note: No need to validate encryption password as we use master password

    // Warning for unencrypted export
    if (!options.encrypt) {
      setConfirmDialog({
        visible: true,
        title: t('export_options.security_warning_title'),
        message: t('export_options.security_warning_message'),
        confirmText: t('export_options.export_anyway'),
        confirmStyle: 'destructive',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          proceedWithExport();
        },
      });
      return;
    }

    proceedWithExport();
  };

  const proceedWithExport = () => {
    if (options.includeAttachments && entriesWithAttachments.length === 0) {
      setConfirmDialog({
        visible: true,
        title: t('export_options.no_attachments_title'),
        message: t('export_options.no_attachments_message'),
        confirmText: t('common.continue'),
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          setOptions(prev => ({ ...prev, includeAttachments: false }));
          finishExportProcess();
        },
      });
      return;
    }

    finishExportProcess();
  };

  const finishExportProcess = () => {
    onExport(entries, selectedFormat, options);
    onClose();
  };

  const renderOptionRow = (
    title: string,
    subtitle: string,
    value: boolean,
    onToggle: (value: boolean) => void,
    disabled: boolean = false,
  ) => (
    <View style={[styles.optionRow, disabled && styles.optionRowDisabled]}>
      <View style={styles.optionContent}>
        <Text
          style={[styles.optionTitle, disabled && styles.optionTitleDisabled]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.optionSubtitle,
            disabled && styles.optionSubtitleDisabled,
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{
          false: theme.border,
          true: theme.primary + '40',
        }}
        thumbColor={value ? theme.primary : theme.textSecondary}
      />
    </View>
  );

  const renderFormatSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('export_options.format')}</Text>

      <TouchableOpacity
        style={styles.formatSelector}
        onPress={() => setShowFormatDetails(true)}
      >
        <View style={styles.formatSelectorContent}>
          <Icon name={selectedFormat.icon} size={24} color={theme.primary} />
          <View style={styles.formatSelectorText}>
            <Text style={styles.formatName}>{selectedFormat.name}</Text>
            <Text style={styles.formatDescription}>
              {selectedFormat.description}
            </Text>
          </View>
        </View>
        <Icon name="chevron-down" size={24} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={showFormatDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFormatDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('export_options.select_format')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowFormatDetails(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formatList}
              showsVerticalScrollIndicator={false}
            >
              {exportFormats.map(format => (
                <TouchableOpacity
                  key={format.id}
                  style={[
                    styles.formatItem,
                    selectedFormat.id === format.id &&
                      styles.formatItemSelected,
                  ]}
                  onPress={() => handleFormatSelect(format)}
                >
                  <Icon
                    name={format.icon}
                    size={24}
                    color={
                      selectedFormat.id === format.id
                        ? theme.primary
                        : theme.textSecondary
                    }
                  />

                  <View style={styles.formatItemContent}>
                    <Text
                      style={[
                        styles.formatItemName,
                        selectedFormat.id === format.id &&
                          styles.formatItemNameSelected,
                      ]}
                    >
                      {format.name}
                    </Text>
                    <Text style={styles.formatItemDescription}>
                      {format.description}
                    </Text>

                    <View style={styles.formatCapabilities}>
                      {format.supportsEncryption && (
                        <View style={styles.capability}>
                          <Icon
                            name="lock-closed"
                            size={12}
                            color={theme.success}
                          />
                          <Text style={styles.capabilityText}>
                            {t('export_options.encryption')}
                          </Text>
                        </View>
                      )}
                      {format.supportsAttachments && (
                        <View style={styles.capability}>
                          <Icon name="attach" size={12} color={theme.success} />
                          <Text style={styles.capabilityText}>
                            {t('export_options.attachments')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {selectedFormat.id === format.id && (
                    <Icon
                      name="checkmark-circle"
                      size={24}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderStatistics = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('export_options.statistics')}</Text>

      <View style={styles.statisticsGrid}>
        <View style={styles.statisticItem}>
          <Icon name="key-outline" size={20} color={theme.primary} />
          <Text style={styles.statisticNumber}>{entries.length}</Text>
          <Text style={styles.statisticLabel}>
            {t('export_options.entries')}
          </Text>
        </View>

        <View style={styles.statisticItem}>
          <Icon name="folder-outline" size={20} color={theme.warning} />
          <Text style={styles.statisticNumber}>{categoriesCount}</Text>
          <Text style={styles.statisticLabel}>
            {t('export_options.categories')}
          </Text>
        </View>

        <View style={styles.statisticItem}>
          <Icon name="pricetag-outline" size={20} color={theme.success} />
          <Text style={styles.statisticNumber}>{entriesWithTags.length}</Text>
          <Text style={styles.statisticLabel}>
            {t('export_options.with_tags')}
          </Text>
        </View>

        <View style={styles.statisticItem}>
          <Icon
            name="document-text-outline"
            size={20}
            color={theme.textSecondary}
          />
          <Text style={styles.statisticNumber}>{entriesWithNotes.length}</Text>
          <Text style={styles.statisticLabel}>
            {t('export_options.with_notes')}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('export_options.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {renderFormatSelector()}
            {renderStatistics()}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('export_options.content_options')}
              </Text>

              {renderOptionRow(
                t('export_options.include_metadata'),
                t('export_options.include_metadata_desc'),
                options.includeMetadata,
                value => handleOptionChange('includeMetadata', value),
              )}

              {renderOptionRow(
                t('export_options.include_categories'),
                t('export_options.include_categories_desc', {
                  count: categoriesCount,
                }),
                options.includeCategories,
                value => handleOptionChange('includeCategories', value),
              )}

              {renderOptionRow(
                t('export_options.include_tags'),
                t('export_options.include_tags_desc', {
                  count: entriesWithTags.length,
                }),
                options.includeTags,
                value => handleOptionChange('includeTags', value),
              )}

              {renderOptionRow(
                t('export_options.include_notes'),
                t('export_options.include_notes_desc', {
                  count: entriesWithNotes.length,
                }),
                options.includeNotes,
                value => handleOptionChange('includeNotes', value),
              )}

              {renderOptionRow(
                t('export_options.include_history'),
                t('export_options.include_history_desc'),
                options.includeHistory,
                value => handleOptionChange('includeHistory', value),
              )}

              {renderOptionRow(
                t('export_options.include_attachments'),
                t('export_options.include_attachments_desc', {
                  count: entriesWithAttachments.length,
                }),
                options.includeAttachments,
                value => handleOptionChange('includeAttachments', value),
                !selectedFormat.supportsAttachments,
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('export_options.security_options')}
              </Text>

              {renderOptionRow(
                t('export_options.encrypt_export'),
                t('export_options.encrypt_export_desc'),
                options.encrypt,
                value => handleOptionChange('encrypt', value),
                !selectedFormat.supportsEncryption,
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('export_options.formatting_options')}
              </Text>

              {renderOptionRow(
                t('export_options.group_by_category'),
                t('export_options.group_by_category_desc'),
                options.groupByCategory,
                value => handleOptionChange('groupByCategory', value),
              )}

              {/* Date Format Selector */}
              <View style={styles.optionRow}>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>
                    {t('export_options.date_format')}
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    {t('export_options.date_format_desc')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => _setShowDateFormatOptions(true)}
                >
                  <Text style={styles.selectButtonText}>
                    {dateFormats.find(f => f.id === options.dateFormat)?.name}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={16}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* CSV Delimiter Selector */}
              {selectedFormat.id === 'csv' && (
                <View style={styles.optionRow}>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>
                      {t('export_options.field_delimiter')}
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      {t('export_options.field_delimiter_desc')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => _setShowDelimiterOptions(true)}
                  >
                    <Text style={styles.selectButtonText}>
                      {
                        fieldDelimiters.find(
                          d => d.id === options.fieldDelimiter,
                        )?.name
                      }
                    </Text>
                    <Icon
                      name="chevron-down"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExport}
            >
              <Icon name="download-outline" size={20} color="white" />
              <Text style={styles.exportButtonText}>
                {t('export_options.export')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Confirm Dialog */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
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
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    formatSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
    },
    formatSelectorContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    formatSelectorText: {
      marginLeft: 12,
    },
    formatName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    formatDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    statisticsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statisticItem: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
    },
    statisticNumber: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginTop: 4,
    },
    statisticLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
    },
    optionRowDisabled: {
      opacity: 0.5,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    optionTitleDisabled: {
      color: theme.textSecondary,
    },
    optionSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    optionSubtitleDisabled: {
      color: theme.border,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
    },
    selectButtonText: {
      fontSize: 14,
      color: theme.text,
    },
    actions: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 16,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelButtonText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    exportButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      backgroundColor: theme.primary,
      borderRadius: 12,
      gap: 8,
    },
    exportButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
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
      paddingBottom: 34,
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
    formatList: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    formatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 8,
    },
    formatItemSelected: {
      backgroundColor: theme.primary + '10',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    formatItemContent: {
      flex: 1,
      marginLeft: 12,
    },
    formatItemName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
    },
    formatItemNameSelected: {
      color: theme.primary,
    },
    formatItemDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    formatCapabilities: {
      flexDirection: 'row',
      marginTop: 8,
      gap: 12,
    },
    capability: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    capabilityText: {
      fontSize: 12,
      color: theme.success,
    },
  });

export default ExportOptionsModal;
