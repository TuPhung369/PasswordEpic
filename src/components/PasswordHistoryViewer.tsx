import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { PasswordEntry } from '../types/password';

export interface PasswordHistoryItem {
  id: string;
  password: string;
  strength: number;
  strengthLabel: string;
  timestamp: Date;
  reason: 'manual' | 'generated' | 'policy' | 'breach' | 'imported';
  reasonLabel: string;
  metadata?: {
    generatorSettings?: any;
    breachSource?: string;
    importSource?: string;
  };
}

interface PasswordHistoryViewerProps {
  visible: boolean;
  onClose: () => void;
  passwordEntry: PasswordEntry | null;
  onRestorePassword?: (historyItem: PasswordHistoryItem) => void;
}

const PasswordHistoryViewer: React.FC<PasswordHistoryViewerProps> = ({
  visible,
  onClose,
  passwordEntry,
  onRestorePassword,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<PasswordHistoryItem | null>(null);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState<{
    [key: string]: boolean;
  }>({});

  const styles = useMemo(() => createStyles(theme), [theme]);

  // Sample password history data
  const passwordHistory = useMemo(
    (): PasswordHistoryItem[] => [
      {
        id: '1',
        password: 'MyStr0ngP@ssw0rd2024!',
        strength: 95,
        strengthLabel: 'Very Strong',
        timestamp: new Date('2024-10-07T10:00:00'),
        reason: 'manual',
        reasonLabel: 'Manual Update',
      },
      {
        id: '2',
        password: 'TempP@ss123',
        strength: 72,
        strengthLabel: 'Good',
        timestamp: new Date('2024-09-15T14:30:00'),
        reason: 'generated',
        reasonLabel: 'Generated',
        metadata: {
          generatorSettings: {
            length: 12,
            includeSymbols: true,
            includeNumbers: true,
          },
        },
      },
      {
        id: '3',
        password: 'password123',
        strength: 25,
        strengthLabel: 'Very Weak',
        timestamp: new Date('2024-08-20T09:15:00'),
        reason: 'breach',
        reasonLabel: 'Breach Detection',
        metadata: {
          breachSource: 'HaveIBeenPwned',
        },
      },
      {
        id: '4',
        password: 'InitialPass2024',
        strength: 68,
        strengthLabel: 'Fair',
        timestamp: new Date('2024-07-10T16:45:00'),
        reason: 'imported',
        reasonLabel: 'Imported',
        metadata: {
          importSource: '1Password',
        },
      },
    ],
    [],
  );

  const togglePasswordVisibility = useCallback((itemId: string) => {
    setShowPasswordText(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }, []);

  const handleComparePassword = useCallback((item: PasswordHistoryItem) => {
    setSelectedHistoryItem(item);
    setShowCompareView(true);
  }, []);

  const handleRestorePassword = useCallback(
    (item: PasswordHistoryItem) => {
      if (onRestorePassword) {
        onRestorePassword(item);
        onClose();
      }
    },
    [onRestorePassword, onClose],
  );

  const getStrengthColor = useCallback((strength: number) => {
    if (strength >= 90) return '#00C851';
    if (strength >= 75) return '#4CAF50';
    if (strength >= 60) return '#FF9800';
    if (strength >= 40) return '#FF5722';
    return '#F44336';
  }, []);

  const getReasonIcon = useCallback((reason: string) => {
    switch (reason) {
      case 'manual':
        return 'create-outline';
      case 'generated':
        return 'sparkles-outline';
      case 'policy':
        return 'document-text-outline';
      case 'breach':
        return 'shield-checkmark-outline';
      case 'imported':
        return 'download-outline';
      default:
        return 'help-circle-outline';
    }
  }, []);

  const formatTimestamp = useCallback(
    (timestamp: Date) => {
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        return t('password_history.time_ago.just_now');
      } else if (days === 1) {
        return t('password_history.time_ago.days_ago', { count: 1 });
      } else if (days < 7) {
        return t('password_history.time_ago.days_ago', { count: days });
      } else if (days < 30) {
        return t('password_history.time_ago.days_ago', { count: days });
      } else if (days < 365) {
        const months = Math.floor(days / 30);
        return t('password_history.time_ago.months_ago', { count: months });
      } else {
        const years = Math.floor(days / 365);
        return t('password_history.time_ago.years_ago', { count: years });
      }
    },
    [t],
  );

  const renderHistoryItem = ({
    item,
    index,
  }: {
    item: PasswordHistoryItem;
    index: number;
  }) => {
    const isPasswordVisible = showPasswordText[item.id] || false;
    const strengthColor = getStrengthColor(item.strength);
    const isCurrent = index === 0;

    return (
      <View
        style={[styles.historyItem, isCurrent && styles.currentHistoryItem]}
      >
        {/* Header */}
        <View style={styles.historyItemHeader}>
          <View style={styles.historyItemInfo}>
            <View style={styles.reasonContainer}>
              <Ionicons
                name={getReasonIcon(item.reason)}
                size={16}
                color={isCurrent ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.reasonText,
                  isCurrent && styles.currentReasonText,
                ]}
              >
                {item.reasonLabel}
              </Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>
                    {t('password_history.current')}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.timestampText}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.historyItemActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleComparePassword(item)}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={18}
                color={theme.primary}
              />
            </TouchableOpacity>

            {!isCurrent && onRestorePassword && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRestorePassword(item)}
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={theme.success || theme.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Password Display */}
        <View style={styles.passwordContainer}>
          <View style={styles.passwordRow}>
            <Text style={styles.passwordText}>
              {isPasswordVisible
                ? item.password
                : '•'.repeat(item.password.length)}
            </Text>
            <TouchableOpacity
              style={styles.visibilityButton}
              onPress={() => togglePasswordVisibility(item.id)}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Strength Indicator */}
        <View style={styles.strengthContainer}>
          <View style={styles.strengthBar}>
            <View
              style={[
                styles.strengthFill,
                {
                  width: `${item.strength}%`,
                  backgroundColor: strengthColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.strengthText, { color: strengthColor }]}>
            {item.strengthLabel} ({item.strength}%)
          </Text>
        </View>

        {/* Metadata */}
        {item.metadata && (
          <View style={styles.metadataContainer}>
            {item.metadata.generatorSettings && (
              <Text style={styles.metadataText}>
                Generated: {item.metadata.generatorSettings.length} chars,
                {item.metadata.generatorSettings.includeSymbols
                  ? ' symbols,'
                  : ''}
                {item.metadata.generatorSettings.includeNumbers
                  ? ' numbers'
                  : ''}
              </Text>
            )}
            {item.metadata.breachSource && (
              <Text style={[styles.metadataText, styles.breachText]}>
                Detected in breach: {item.metadata.breachSource}
              </Text>
            )}
            {item.metadata.importSource && (
              <Text style={styles.metadataText}>
                Imported from: {item.metadata.importSource}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderCompareView = () => {
    if (!selectedHistoryItem) return null;

    const currentPassword = passwordHistory[0];

    return (
      <Modal
        visible={showCompareView}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompareView(false)}
      >
        <View style={styles.compareOverlay}>
          <View style={styles.compareModal}>
            <View style={styles.compareHeader}>
              <Text style={styles.compareTitle}>
                {t('password_history.comparison_title')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCompareView(false)}
                style={styles.compareCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.compareContent}>
              {/* Current Password */}
              <View style={styles.compareSection}>
                <Text style={styles.compareSectionTitle}>Current Password</Text>
                <View style={styles.comparePasswordContainer}>
                  <Text style={styles.comparePassword}>
                    {showPasswordText.current
                      ? currentPassword.password
                      : '•'.repeat(currentPassword.password.length)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => togglePasswordVisibility('current')}
                    style={styles.compareVisibilityButton}
                  >
                    <Ionicons
                      name={
                        showPasswordText.current
                          ? 'eye-off-outline'
                          : 'eye-outline'
                      }
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.compareStrengthRow}>
                  <Text style={styles.compareStrengthLabel}>Strength:</Text>
                  <Text
                    style={[
                      styles.compareStrengthValue,
                      { color: getStrengthColor(currentPassword.strength) },
                    ]}
                  >
                    {currentPassword.strengthLabel} ({currentPassword.strength}
                    %)
                  </Text>
                </View>
              </View>

              {/* Historical Password */}
              <View style={styles.compareSection}>
                <Text style={styles.compareSectionTitle}>
                  Historical Password (
                  {formatTimestamp(selectedHistoryItem.timestamp)})
                </Text>
                <View style={styles.comparePasswordContainer}>
                  <Text style={styles.comparePassword}>
                    {showPasswordText.historical
                      ? selectedHistoryItem.password
                      : '•'.repeat(selectedHistoryItem.password.length)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => togglePasswordVisibility('historical')}
                    style={styles.compareVisibilityButton}
                  >
                    <Ionicons
                      name={
                        showPasswordText.historical
                          ? 'eye-off-outline'
                          : 'eye-outline'
                      }
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.compareStrengthRow}>
                  <Text style={styles.compareStrengthLabel}>Strength:</Text>
                  <Text
                    style={[
                      styles.compareStrengthValue,
                      { color: getStrengthColor(selectedHistoryItem.strength) },
                    ]}
                  >
                    {selectedHistoryItem.strengthLabel} (
                    {selectedHistoryItem.strength}%)
                  </Text>
                </View>
              </View>

              {/* Strength Comparison */}
              <View style={styles.compareSection}>
                <Text style={styles.compareSectionTitle}>
                  Security Improvement
                </Text>
                <View style={styles.strengthComparisonContainer}>
                  <View style={styles.strengthComparisonRow}>
                    <Text style={styles.strengthComparisonLabel}>
                      Strength Change:
                    </Text>
                    <View style={styles.strengthComparisonValue}>
                      {currentPassword.strength >
                      selectedHistoryItem.strength ? (
                        <>
                          <Ionicons
                            name="trending-up"
                            size={16}
                            color={theme.success || '#00C851'}
                          />
                          <Text
                            style={[
                              styles.strengthComparisonText,
                              styles.strengthImprovementText,
                            ]}
                          >
                            +
                            {currentPassword.strength -
                              selectedHistoryItem.strength}
                            % Stronger
                          </Text>
                        </>
                      ) : currentPassword.strength <
                        selectedHistoryItem.strength ? (
                        <>
                          <Ionicons
                            name="trending-down"
                            size={16}
                            color={theme.error || '#F44336'}
                          />
                          <Text
                            style={[
                              styles.strengthComparisonText,
                              styles.strengthDecllineText,
                            ]}
                          >
                            -
                            {selectedHistoryItem.strength -
                              currentPassword.strength}
                            % Weaker
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons
                            name="remove"
                            size={16}
                            color={theme.textSecondary}
                          />
                          <Text
                            style={[
                              styles.strengthComparisonText,
                              styles.strengthNoChangeText,
                            ]}
                          >
                            No Change
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {onRestorePassword && (
              <View style={styles.compareActions}>
                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => {
                    handleRestorePassword(selectedHistoryItem);
                    setShowCompareView(false);
                  }}
                >
                  <Ionicons name="refresh-outline" size={20} color="white" />
                  <Text style={styles.restoreButtonText}>
                    {t('password_history.restore')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (!passwordEntry) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('password_history.title')}</Text>
          <View style={styles.headerButton} />
        </View>

        {/* Entry Info */}
        <View style={styles.entryInfo}>
          <Text style={styles.entryTitle}>{passwordEntry.title}</Text>
          <Text style={styles.entrySubtitle}>
            {passwordHistory.length} password
            {passwordHistory.length !== 1 ? 's' : ''} in history
          </Text>
        </View>

        {/* History List */}
        <FlatList
          data={passwordHistory}
          keyExtractor={item => item.id}
          renderItem={renderHistoryItem}
          style={styles.historyList}
          contentContainerStyle={styles.historyListContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Compare Modal */}
        {renderCompareView()}
      </View>
    </Modal>
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
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    entryInfo: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    entryTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    entrySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    historyList: {
      flex: 1,
    },
    historyListContent: {
      padding: 20,
    },
    historyItem: {
      backgroundColor: theme.surface || theme.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    currentHistoryItem: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '10',
    },
    historyItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    historyItemInfo: {
      flex: 1,
    },
    reasonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    reasonText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginLeft: 8,
    },
    currentReasonText: {
      color: theme.primary,
      fontWeight: '600',
    },
    currentBadge: {
      backgroundColor: theme.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 8,
    },
    currentBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'white',
    },
    timestampText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    historyItemActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    passwordContainer: {
      marginBottom: 12,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    passwordText: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      letterSpacing: 1,
      fontFamily: 'monospace',
    },
    visibilityButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    strengthContainer: {
      marginBottom: 8,
    },
    strengthBar: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginBottom: 4,
      overflow: 'hidden',
    },
    strengthFill: {
      height: '100%',
      borderRadius: 2,
    },
    strengthText: {
      fontSize: 14,
      fontWeight: '500',
    },
    metadataContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    metadataText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    breachText: {
      color: theme.error || '#F44336',
    },
    compareOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    compareModal: {
      backgroundColor: theme.surface || theme.card,
      borderRadius: 16,
      width: '100%',
      maxWidth: 500,
      maxHeight: '80%',
    },
    compareHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    compareTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    compareCloseButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compareContent: {
      flex: 1,
      paddingHorizontal: 20,
    },
    compareSection: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    compareSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    comparePasswordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    comparePassword: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      letterSpacing: 1,
      fontFamily: 'monospace',
    },
    compareVisibilityButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compareStrengthRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    compareStrengthLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginRight: 8,
    },
    compareStrengthValue: {
      fontSize: 14,
      fontWeight: '500',
    },
    strengthComparisonContainer: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    strengthComparisonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    strengthComparisonLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    strengthComparisonValue: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    strengthComparisonText: {
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 4,
    },
    strengthImprovementText: {
      color: theme.success || '#00C851',
    },
    strengthDecllineText: {
      color: theme.error || '#F44336',
    },
    strengthNoChangeText: {
      color: theme.textSecondary,
    },
    compareActions: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    restoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.success || theme.primary,
      paddingVertical: 12,
      borderRadius: 12,
    },
    restoreButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
      marginLeft: 8,
    },
  });

export default PasswordHistoryViewer;
