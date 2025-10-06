import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { PasswordHistoryEntry } from '../types/password';
import { format } from 'date-fns';
import Clipboard from '@react-native-clipboard/clipboard';
import { BiometricService } from '../services/biometricService';

interface PasswordHistoryViewerProps {
  history: PasswordHistoryEntry[];
  currentPassword: string;
  onRestorePassword?: (password: string) => void;
}

export const PasswordHistoryViewer: React.FC<PasswordHistoryViewerProps> = ({
  history,
  currentPassword,
  onRestorePassword,
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(
    new Set(),
  );

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerIcon: {
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    expandButton: {
      padding: 4,
    },
    historyList: {
      marginTop: 16,
    },
    historyItem: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    currentItem: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    historyItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    historyItemDate: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    currentBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    currentBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    passwordText: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'monospace',
      color: theme.text,
    },
    passwordHidden: {
      color: theme.textSecondary,
    },
    iconButton: {
      padding: 4,
      marginLeft: 8,
    },
    strengthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    strengthLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginRight: 8,
    },
    strengthBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    strengthText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    restoreButton: {
      borderColor: theme.primary,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.text,
      marginLeft: 4,
    },
    restoreButtonText: {
      color: theme.primary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      width: '85%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    modalPassword: {
      backgroundColor: theme.background,
      padding: 16,
      borderRadius: 8,
      marginBottom: 16,
    },
    modalPasswordText: {
      fontSize: 16,
      fontFamily: 'monospace',
      color: theme.text,
      textAlign: 'center',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: theme.primary,
    },
    modalButtonSecondary: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    modalButtonTextSecondary: {
      color: theme.text,
    },
  });

  const getStrengthColor = (score: number): string => {
    if (score >= 4) return '#4CAF50'; // Strong - Green
    if (score >= 3) return '#8BC34A'; // Good - Light Green
    if (score >= 2) return '#FFC107'; // Fair - Yellow
    if (score >= 1) return '#FF9800'; // Weak - Orange
    return '#F44336'; // Very Weak - Red
  };

  const togglePasswordVisibility = async (passwordId: string) => {
    // If password is hidden, require biometric authentication to reveal
    if (!revealedPasswords.has(passwordId)) {
      const biometricService = BiometricService.getInstance();
      const result = await biometricService.authenticateWithBiometrics(
        'Authenticate to view password history',
      );

      if (!result.success) {
        if (result.error && !result.error.includes('cancelled')) {
          Alert.alert(
            'Authentication Failed',
            result.error || 'Could not verify your identity',
          );
        }
        return;
      }
    }

    // Toggle visibility after successful authentication (or when hiding)
    setRevealedPasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(passwordId)) {
        newSet.delete(passwordId);
      } else {
        newSet.add(passwordId);
      }
      return newSet;
    });
  };

  const handleCopyPassword = async (password: string) => {
    // Require biometric authentication to copy password
    const biometricService = BiometricService.getInstance();
    const result = await biometricService.authenticateWithBiometrics(
      'Authenticate to copy password',
    );

    if (result.success) {
      Clipboard.setString(password);
      Alert.alert('Copied', 'Password copied to clipboard');
    } else if (result.error && !result.error.includes('cancelled')) {
      Alert.alert(
        'Authentication Failed',
        result.error || 'Could not verify your identity',
      );
    }
  };

  const handleRestorePassword = async (password: string) => {
    // Require biometric authentication to restore password
    const biometricService = BiometricService.getInstance();
    const result = await biometricService.authenticateWithBiometrics(
      'Authenticate to restore password',
    );

    if (result.success) {
      setSelectedPassword(password);
      setShowPasswordModal(true);
    } else if (result.error && !result.error.includes('cancelled')) {
      Alert.alert(
        'Authentication Failed',
        result.error || 'Could not verify your identity',
      );
    }
  };

  const confirmRestore = () => {
    if (selectedPassword && onRestorePassword) {
      onRestorePassword(selectedPassword);
      setShowPasswordModal(false);
      setSelectedPassword(null);
      Alert.alert('Success', 'Password restored successfully');
    }
  };

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (!history || history.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons
              name="history"
              size={24}
              color={theme.textSecondary}
              style={styles.headerIcon}
            />
            <View>
              <Text style={styles.headerTitle}>Password History</Text>
              <Text style={styles.headerSubtitle}>No history available</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyState}>
          <MaterialIcons name="history" size={48} color={theme.textSecondary} />
          <Text style={styles.emptyStateText}>
            No password changes recorded yet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <View style={styles.headerLeft}>
            <MaterialIcons
              name="history"
              size={24}
              color={theme.primary}
              style={styles.headerIcon}
            />
            <View>
              <Text style={styles.headerTitle}>Password History</Text>
              <Text style={styles.headerSubtitle}>
                {history.length} previous{' '}
                {history.length === 1 ? 'version' : 'versions'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setExpanded(!expanded)}
          >
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {expanded && (
          <ScrollView style={styles.historyList} nestedScrollEnabled>
            {/* Current Password */}
            <View style={[styles.historyItem, styles.currentItem]}>
              <View style={styles.historyItemHeader}>
                <Text style={styles.historyItemDate}>Current Password</Text>
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>ACTIVE</Text>
                </View>
              </View>

              <View style={styles.passwordRow}>
                <Text
                  style={[
                    styles.passwordText,
                    !revealedPasswords.has('current') && styles.passwordHidden,
                  ]}
                >
                  {revealedPasswords.has('current')
                    ? currentPassword
                    : '••••••••••••'}
                </Text>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => togglePasswordVisibility('current')}
                >
                  <MaterialIcons
                    name={
                      revealedPasswords.has('current')
                        ? 'visibility-off'
                        : 'visibility'
                    }
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleCopyPassword(currentPassword)}
                >
                  <MaterialIcons
                    name="content-copy"
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Historical Passwords */}
            {sortedHistory.map((entry, index) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyItemHeader}>
                  <Text style={styles.historyItemDate}>
                    {format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm')}
                  </Text>
                </View>

                <View style={styles.passwordRow}>
                  <Text
                    style={[
                      styles.passwordText,
                      !revealedPasswords.has(entry.id) && styles.passwordHidden,
                    ]}
                  >
                    {revealedPasswords.has(entry.id)
                      ? entry.password
                      : '••••••••••••'}
                  </Text>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => togglePasswordVisibility(entry.id)}
                  >
                    <MaterialIcons
                      name={
                        revealedPasswords.has(entry.id)
                          ? 'visibility-off'
                          : 'visibility'
                      }
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => handleCopyPassword(entry.password)}
                  >
                    <MaterialIcons
                      name="content-copy"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.strengthRow}>
                  <Text style={styles.strengthLabel}>Strength:</Text>
                  <View
                    style={[
                      styles.strengthBadge,
                      {
                        backgroundColor: getStrengthColor(entry.strength.score),
                      },
                    ]}
                  >
                    <Text style={styles.strengthText}>
                      {entry.strength.label}
                    </Text>
                  </View>
                </View>

                {onRestorePassword && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.restoreButton]}
                      onPress={() => handleRestorePassword(entry.password)}
                    >
                      <MaterialIcons
                        name="restore"
                        size={16}
                        color={theme.primary}
                      />
                      <Text
                        style={[
                          styles.actionButtonText,
                          styles.restoreButtonText,
                        ]}
                      >
                        Restore
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Restore Confirmation Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Restore Password?</Text>
            <Text
              style={[
                styles.headerSubtitle,
                { textAlign: 'center', marginBottom: 16 },
              ]}
            >
              This will replace your current password with the selected one.
            </Text>
            <View style={styles.modalPassword}>
              <Text style={styles.modalPasswordText}>{selectedPassword}</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setSelectedPassword(null);
                }}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.modalButtonTextSecondary,
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmRestore}
              >
                <Text style={styles.modalButtonText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default PasswordHistoryViewer;
