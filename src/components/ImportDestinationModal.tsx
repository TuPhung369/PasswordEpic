import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface FileItem {
  name: string;
  path: string;
  mtime?: number;
}

interface ImportDestinationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (destination: 'local' | 'google' | 'google-hidden', filePath?: string) => void;
  onSelectDestination?: (destination: 'local' | 'google' | 'google-hidden') => void;
  onDeleteFile?: (destination: 'local' | 'google' | 'google-hidden', filePath: string) => Promise<boolean>;
  localFileList?: FileItem[];
  googleFileList?: FileItem[];
  googleHiddenFileList?: FileItem[];
  isLoadingFiles?: boolean;
}

const ImportDestinationModal: React.FC<ImportDestinationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  onSelectDestination,
  onDeleteFile,
  localFileList = [],
  googleFileList = [],
  googleHiddenFileList = [],
  isLoadingFiles = false,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [selectedDestination, setSelectedDestination] = useState<
    'local' | 'google' | 'google-hidden' | null
  >(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [deletingFilePath, setDeletingFilePath] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (visible) {
      console.log('[ImportDestinationModal] Modal opened, setting destination to local');
      setSelectedDestination('local');
      setSelectedFile(null);
      if (onSelectDestination) {
        console.log('[ImportDestinationModal] Calling onSelectDestination for local');
        onSelectDestination('local');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const getFileListForDestination = () => {
    switch (selectedDestination) {
      case 'local':
        return localFileList;
      case 'google':
        return googleFileList;
      case 'google-hidden':
        return googleHiddenFileList;
      default:
        return [];
    }
  };

  const handleDestinationSelect = (destination: 'local' | 'google' | 'google-hidden') => {
    console.log('[ImportDestinationModal] handleDestinationSelect called with:', destination);
    setSelectedDestination(destination);
    setSelectedFile(null);
    if (onSelectDestination) {
      console.log('[ImportDestinationModal] Calling onSelectDestination for:', destination);
      onSelectDestination(destination);
    }
  };

  const handleConfirm = () => {
    if (!selectedDestination) return;
    
    if (selectedFile) {
      onConfirm(selectedDestination, selectedFile);
    } else {
      onConfirm(selectedDestination);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const handleDeletePress = (filePath: string) => {
    setDeletingFilePath(filePath);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingFilePath || !selectedDestination || !onDeleteFile) {
      setShowDeleteConfirm(false);
      return;
    }

    try {
      const success = await onDeleteFile(selectedDestination, deletingFilePath);
      if (success) {
        setShowDeleteConfirm(false);
        setDeletingFilePath(null);
        if (selectedFile === deletingFilePath) {
          setSelectedFile(null);
        }
      }
    } catch (error) {
      console.error('[ImportDestinationModal] Delete error:', error);
      setShowDeleteConfirm(false);
      setDeletingFilePath(null);
    }
  };

  const renderSeparator = () => (
    <View style={[styles.separator, { backgroundColor: theme.border }]} />
  );

  const renderFileItem = (item: FileItem) => {
    const isSelected = selectedFile === item.path;
    const fileDate = item.mtime 
      ? new Date(item.mtime).toLocaleDateString()
      : 'Unknown date';

    console.log('[ImportDestinationModal] renderFileItem:', { name: item.name, isSelected });

    return (
      <View
        style={[
          styles.fileItem,
          {
            backgroundColor: isSelected ? theme.primary + '10' : theme.background,
            borderColor: isSelected ? theme.primary : theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.fileItemTouchable}
          onPress={() => {
            console.log('[ImportDestinationModal] File selected:', item.name);
            handleFileSelect(item.path);
          }}
        >
          <Icon
            name="document-outline"
            size={24}
            color={isSelected ? theme.primary : theme.textSecondary}
          />
          <View style={styles.fileItemContent}>
            <Text
              style={[
                styles.fileName,
                {
                  color: isSelected ? theme.primary : theme.text,
                },
                isSelected && styles.fileNameSelected,
              ]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text style={[styles.fileDate, { color: theme.textSecondary }]}>
              {fileDate}
            </Text>
          </View>
          {isSelected && (
            <Icon
              name="checkmark-circle"
              size={20}
              color={theme.primary}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePress(item.path)}
        >
          <Icon
            name="trash-outline"
            size={18}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDestinationOption = (
    label: string,
    icon: string,
    value: 'local' | 'google' | 'google-hidden',
  ) => (
    <TouchableOpacity
      style={[
        styles.destinationOption,
        selectedDestination === value && styles.destinationOptionSelected,
      ]}
      onPress={() => handleDestinationSelect(value)}
    >
      <Icon
        name={icon}
        size={20}
        color={selectedDestination === value ? theme.primary : theme.textSecondary}
      />
      <Text
        style={[
          styles.destinationLabel,
          selectedDestination === value && styles.destinationLabelSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const fileList = getFileListForDestination();
  const showFileList = fileList.length > 0;
  const showFileLoading = isLoadingFiles;

  console.log('[ImportDestinationModal] Render state:', {
    visible,
    selectedDestination,
    fileListLength: fileList.length,
    showFileList,
    showFileLoading,
    isLoadingFiles,
    localFileListLength: localFileList.length,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, showFileList && styles.containerExpanded]}>
          <View style={styles.header}>
            <Icon
              name="arrow-down-circle-outline"
              size={20}
              color={theme.primary}
            />
            <Text style={styles.title}>Import From</Text>
          </View>

          <View style={styles.optionsContainer}>
            {renderDestinationOption(
              'Local',
              'phone-portrait-outline',
              'local',
            )}
            {renderDestinationOption(
              'Drive',
              'logo-google',
              'google',
            )}
            {renderDestinationOption(
              'Hidden',
              'folder-hidden-outline',
              'google-hidden',
            )}
          </View>

          {showFileLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading files...
              </Text>
            </View>
          )}

          {showFileList && (
            <View style={[styles.fileListContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.fileListTitle, { color: theme.text }]}>
                Select a file to import
              </Text>
              <FlatList
                data={fileList}
                renderItem={({ item }) => renderFileItem(item)}
                keyExtractor={(item) => item.path}
                scrollEnabled
                style={styles.fileList}
                ItemSeparatorComponent={renderSeparator}
                nestedScrollEnabled
              />
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (!selectedDestination || (fileList.length > 0 && !selectedFile)) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedDestination || (fileList.length > 0 && !selectedFile)}
            >
              <Text style={styles.confirmButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showDeleteConfirm && !!deletingFilePath}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmDialogTitle}>Delete File?</Text>
            <Text style={styles.confirmDialogMessage}>
              Are you sure you want to delete this file?
            </Text>
            <View style={styles.confirmDialogButtons}>
              <TouchableOpacity
                style={[styles.confirmDialogButton, styles.confirmDialogCancel]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.confirmDialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDialogButton, styles.confirmDialogDelete]}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.confirmDialogDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      width: '85%',
      maxWidth: 400,
      maxHeight: '85%',
      flexDirection: 'column',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    containerExpanded: {
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 8,
    },
    optionsContainer: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
      justifyContent: 'space-between',
    },
    destinationOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.border,
      gap: 3,
    },
    destinationOptionSelected: {
      backgroundColor: theme.primary + '10',
      borderColor: theme.primary,
    },
    destinationLabel: {
      fontSize: 9,
      fontWeight: '500',
      color: theme.text,
      textAlign: 'center',
    },
    destinationLabelSelected: {
      color: theme.primary,
      fontWeight: '600',
    },
    checkmark: {
      position: 'absolute',
      top: 4,
      right: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    button: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    confirmButton: {
      backgroundColor: theme.primary,
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    fileListContainer: {
      marginVertical: 8,
      paddingTop: 8,
      height: 250,
      borderRadius: 8,
      overflow: 'hidden',
    },
    fileListTitle: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
      color: theme.text,
    },
    fileList: {
      flex: 1,
      maxHeight: 200,
    },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 6,
      borderWidth: 1,
      minHeight: 40,
    },
    fileItemTouchable: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      gap: 8,
    },
    deleteButton: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileItemContent: {
      flex: 1,
      minWidth: 0,
    },
    fileNameScroll: {
      maxHeight: 18,
    },
    fileName: {
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 2,
    },
    fileNameSelected: {
      fontWeight: '600',
    },
    fileDate: {
      fontSize: 10,
      color: theme.textSecondary,
    },
    separator: {
      height: 1,
      marginVertical: 4,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
    },
    loadingText: {
      fontSize: 14,
      marginTop: 12,
    },
    confirmDialog: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: '75%',
      maxWidth: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    confirmDialogTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    confirmDialogMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    confirmDialogButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    confirmDialogButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmDialogCancel: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    confirmDialogCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    confirmDialogDelete: {
      backgroundColor: '#FF4444',
    },
    confirmDialogDeleteText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

export default ImportDestinationModal;
