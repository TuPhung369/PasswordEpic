import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface FileNameInputModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (fileName: string) => void;
  defaultFileName: string;
  fileExtension: string;
  title?: string;
  description?: string;
}

const FileNameInputModal: React.FC<FileNameInputModalProps> = ({
  visible,
  onClose,
  onConfirm,
  defaultFileName,
  fileExtension,
  title = 'Export File Name',
  description = 'Enter a name for your export file',
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [fileName, setFileName] = useState(defaultFileName);

  // Reset to default when modal opens
  useEffect(() => {
    if (visible) {
      setFileName(defaultFileName);
    }
  }, [visible, defaultFileName]);

  const handleConfirm = () => {
    const trimmedName = fileName.trim();
    if (trimmedName) {
      onConfirm(trimmedName);
    }
  };

  const handleCancel = () => {
    setFileName(defaultFileName);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Icon
              name="document-text-outline"
              size={24}
              color={theme.primary}
            />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Text style={styles.description}>{description}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={fileName}
              onChangeText={setFileName}
              placeholder="Enter file name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              selectTextOnFocus
            />
            <Text style={styles.extension}>.{fileExtension}</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                !fileName.trim() && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!fileName.trim()}
            >
              <Text style={styles.confirmButtonText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
      width: '85%',
      maxWidth: 400,
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
      marginBottom: 20,
      lineHeight: 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      marginBottom: 24,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      paddingVertical: 12,
    },
    extension: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: '500',
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
      backgroundColor: theme.border,
      opacity: 0.5,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

export default FileNameInputModal;
