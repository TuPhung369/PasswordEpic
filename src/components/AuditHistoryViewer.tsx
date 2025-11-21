import React, { useState, useEffect, useMemo } from 'react';
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
import { AuditHistoryEntry } from '../types/password';
import { AuditHistoryService } from '../services/auditHistoryService';
import ConfirmDialog from './ConfirmDialog';

interface AuditHistoryViewerProps {
  visible: boolean;
  onClose: () => void;
  passwordEntryId: string;
}

export const AuditHistoryViewer: React.FC<AuditHistoryViewerProps> = ({
  visible,
  onClose,
  passwordEntryId,
}) => {
  const { theme } = useTheme();
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
    trend: 'stable' as 'improving' | 'declining' | 'stable',
    totalAudits: 0,
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    message: string;
    auditId?: string;
  }>({
    visible: false,
    message: '',
  });

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const [auditHistory, stats] = await Promise.all([
        AuditHistoryService.getAuditHistory(passwordEntryId),
        AuditHistoryService.getAuditStatistics(passwordEntryId),
      ]);
      setHistory(auditHistory);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading audit history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAudit = async (auditId: string) => {
    try {
      await AuditHistoryService.deleteAuditEntry(passwordEntryId, auditId);
      setHistory(history.filter(h => h.id !== auditId));
      setConfirmDialog({ visible: false, message: '' });
    } catch (error) {
      console.error('Error deleting audit:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await AuditHistoryService.clearAuditHistory(passwordEntryId);
      setHistory([]);
      setStatistics({
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        trend: 'stable',
        totalAudits: 0,
      });
      setConfirmDialog({ visible: false, message: '' });
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const getTrendColor = (): string => {
    switch (statistics.trend) {
      case 'improving':
        return '#4CAF50';
      case 'declining':
        return '#F44336';
      default:
        return '#FFC107';
    }
  };

  const getTrendIcon = (): string => {
    switch (statistics.trend) {
      case 'improving':
        return 'trending-up';
      case 'declining':
        return 'trending-down';
      default:
        return 'remove-outline';
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modal: {
          flex: 1,
          backgroundColor: theme.background,
        },
        header: {
          backgroundColor: theme.surface,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        headerTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: theme.text,
          flex: 1,
        },
        closeButton: {
          padding: 4,
        },
        content: {
          flex: 1,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        statsGrid: {
          flexDirection: 'row',
          marginBottom: 20,
          gap: 12,
        },
        statCard: {
          flex: 1,
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.border,
        },
        statValue: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.text,
          marginVertical: 4,
        },
        statLabel: {
          fontSize: 11,
          color: theme.textSecondary,
          textAlign: 'center',
        },
        trendCard: {
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          borderLeftWidth: 4,
          borderLeftColor: getTrendColor(),
          flexDirection: 'row',
          alignItems: 'center',
        },
        trendContent: {
          flex: 1,
          marginLeft: 12,
        },
        trendTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.text,
          marginBottom: 2,
        },
        trendValue: {
          fontSize: 12,
          color: theme.textSecondary,
        },
        trendIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${getTrendColor()}20`,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sectionTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.text,
          marginBottom: 12,
          marginTop: 16,
        },
        auditItem: {
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
          borderLeftWidth: 3,
        },
        auditItemHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        },
        auditDate: {
          fontSize: 12,
          color: theme.textSecondary,
        },
        auditScore: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.text,
        },
        auditRiskBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
        },
        auditRiskText: {
          fontSize: 11,
          fontWeight: '600',
          color: 'white',
        },
        auditDetails: {
          fontSize: 12,
          color: theme.textSecondary,
          marginBottom: 8,
        },
        auditChanges: {
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        changeItem: {
          fontSize: 11,
          color: theme.textSecondary,
          marginBottom: 4,
          paddingLeft: 8,
        },
        actionButtons: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 16,
        },
        deleteButton: {
          flex: 1,
          backgroundColor: '#F44336',
          borderRadius: 8,
          paddingVertical: 12,
          alignItems: 'center',
        },
        deleteButtonText: {
          color: 'white',
          fontWeight: '600',
          fontSize: 14,
        },
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 40,
        },
        emptyIcon: {
          marginBottom: 12,
        },
        emptyText: {
          fontSize: 14,
          color: theme.textSecondary,
          textAlign: 'center',
        },
      }),
    [theme],
  );

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#00C851';
    if (score >= 75) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    if (score >= 20) return '#FF9800';
    return '#F44336';
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'critical':
        return '#F44336';
      case 'high':
        return '#FF5722';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Audit History</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {history.length > 0 ? (
            <>
              {/* Statistics */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.primary}
                  />
                  <Text style={styles.statValue}>{statistics.averageScore}</Text>
                  <Text style={styles.statLabel}>Average</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="arrow-up" size={24} color="#4CAF50" />
                  <Text style={styles.statValue}>{statistics.highestScore}</Text>
                  <Text style={styles.statLabel}>Highest</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="arrow-down" size={24} color="#F44336" />
                  <Text style={styles.statValue}>{statistics.lowestScore}</Text>
                  <Text style={styles.statLabel}>Lowest</Text>
                </View>
              </View>

              {/* Trend */}
              <View style={styles.trendCard}>
                <View style={styles.trendIcon}>
                  <Ionicons
                    name={getTrendIcon()}
                    size={20}
                    color={getTrendColor()}
                  />
                </View>
                <View style={styles.trendContent}>
                  <Text style={styles.trendTitle}>
                    Trend: {statistics.trend.charAt(0).toUpperCase() + statistics.trend.slice(1)}
                  </Text>
                  <Text style={styles.trendValue}>
                    Based on {statistics.totalAudits} audits
                  </Text>
                </View>
              </View>

              {/* History Timeline */}
              <Text style={styles.sectionTitle}>Audit Timeline</Text>
              <FlatList
                scrollEnabled={false}
                data={history}
                keyExtractor={item => item.id}
                renderItem={({ item, index }) => {
                  const previous = index < history.length - 1 ? history[index + 1] : undefined;
                  const changes = AuditHistoryService.compareAudits(item, previous);

                  return (
                    <View
                      style={[
                        styles.auditItem,
                        {
                          borderLeftColor: getScoreColor(item.score),
                        },
                      ]}
                    >
                      <View style={styles.auditItemHeader}>
                        <Text style={styles.auditDate}>{formatDate(item.date)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.auditScore}>{item.score}</Text>
                          <View
                            style={[
                              styles.auditRiskBadge,
                              {
                                backgroundColor: getRiskColor(item.riskLevel),
                              },
                            ]}
                          >
                            <Text style={styles.auditRiskText}>
                              {item.riskLevel.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.auditDetails}>
                        {item.vulnerabilityCount} issue{item.vulnerabilityCount !== 1 ? 's' : ''} •{' '}
                        {item.passwordStrength.label}
                      </Text>

                      {changes.length > 0 && (
                        <View style={styles.auditChanges}>
                          {changes.map((change, i) => (
                            <Text key={i} style={styles.changeItem}>
                              • {change}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                }}
              />

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    setConfirmDialog({
                      visible: true,
                      message: 'Clear all audit history? This action cannot be undone.',
                    })
                  }
                >
                  <Ionicons name="trash-outline" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="shield-checkmark-outline"
                size={48}
                color={theme.textSecondary}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyText}>No audit history yet</Text>
              <Text style={styles.emptyText}>Run security audits to see history</Text>
            </View>
          )}
        </ScrollView>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          visible={confirmDialog.visible}
          title="Clear History"
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog({ visible: false, message: '' })}
          onConfirm={() => handleClearAll()}
          confirmText="Clear"
          confirmStyle="destructive"
        />
      </View>
    </Modal>
  );
};

export default AuditHistoryViewer;
