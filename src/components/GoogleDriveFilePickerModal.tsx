import React, { useEffect, useState, useCallback } from 'react';
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
import {
  listGoogleDriveBackups,
  DriveFile,
} from '../services/googleDriveService';

interface GoogleDriveFilePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (fileId: string, fileName: string) => void;
  isHidden?: boolean;
}

const GoogleDriveFilePickerModal: React.FC<
  GoogleDriveFilePickerModalProps
> = ({ visible, onClose, onConfirm, isHidden = false }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listGoogleDriveBackups(!isHidden);
      if (result.success && result.files) {
        setFiles(result.files);
      } else {
        setError(result.error || 'Failed to load files');
        setFiles([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load files',
      );
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [isHidden]);

  useEffect(() => {
    if (visible) {
      loadFiles();
    }
  }, [visible, loadFiles]);

  const handleConfirm = () => {
    if (selectedFileId) {
      const selectedFile = files.find(f => f.id === selectedFileId);
      if (selectedFile) {
        onConfirm(selectedFileId, selectedFile.name);
      }
    }
  };

  const formatFileSize = (sizeStr: string): string => {
    const size = parseInt(sizeStr, 10);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderFileItem = ({ item }: { item: DriveFile }) => (
    <TouchableOpacity
      style={[
        styles.fileItem,
        selectedFileId === item.id && styles.fileItemSelected,
      ]}
      onPress={() => setSelectedFileId(item.id)}
    >
      <View style={styles.fileIcon}>
        <Icon
          name="document-text-outline"
          size={24}
          color={selectedFileId === item.id ? theme.primary : theme.textSecondary}
        />
      </View>
      <View style={styles.fileInfo}>
        <Text
          numberOfLines={1}
          style={[
            styles.fileName,
            selectedFileId === item.id && styles.fileNameSelected,
          ]}
        >
          {item.name}
        </Text>
        <View style={styles.fileMetadata}>
          <Text style={styles.fileSize}>{formatFileSize(item.size)}</Text>
          <Text style={styles.fileSeparator}>•</Text>
          <Text style={styles.fileDate}>{formatDate(item.modifiedTime)}</Text>
        </View>
      </View>
      {selectedFileId === item.id && (
        <Icon
          name="checkmark-circle"
          size={24}
          color={theme.primary}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Icon
              name="cloud-download-outline"
              size={24}
              color={theme.primary}
            />
            <Text style={styles.title}>
              {isHidden ? 'Google Hidden Folder' : 'Google Drive'}
            </Text>
          </View>

          <Text style={styles.description}>
            Select a file to import from{' '}
            {isHidden ? 'your hidden folder' : 'Google Drive'}
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon
                name="alert-circle-outline"
                size={32}
                color={theme.error}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadFiles}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : files.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon
                name="folder-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={styles.emptyText}>No files found</Text>
            </View>
          ) : (
            <FlatList
              data={files}
              renderItem={renderFileItem}
              keyExtractor={item => item.id}
              style={styles.filesList}
              scrollEnabled={true}
              nestedScrollEnabled={true}
            />
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
                !selectedFileId && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedFileId}
            >
              <Text style={styles.confirmButtonText}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
      padding: 24,
      width: '90%',
      maxWidth: 450,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 12,
    },
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    loadingText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 12,
    },
    errorContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    errorText: {
      fontSize: 14,
      color: theme.error,
      marginTop: 12,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 8,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 12,
    },
    filesList: {
      maxHeight: 300,
      marginBottom: 16,
    },
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
      gap: 12,
    },
    fileItemSelected: {
      backgroundColor: theme.primary + '10',
      borderColor: theme.primary,
    },
    fileIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    fileNameSelected: {
      color: theme.primary,
      fontWeight: '600',
    },
    fileMetadata: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 6,
    },
    fileSize: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    fileSeparator: {
      fontSize: 12,
      color: theme.border,
    },
    fileDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
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
      fontSize: 16,
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
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

export default GoogleDriveFilePickerModal;
