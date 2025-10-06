import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { AuditData, BreachStatus } from '../types/password';
import { format } from 'date-fns';

interface SecurityAuditPanelProps {
  auditData?: AuditData;
  breachStatus?: BreachStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const SecurityAuditPanel: React.FC<SecurityAuditPanelProps> = ({
  auditData,
  breachStatus,
  createdAt,
  updatedAt,
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

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
    content: {
      marginTop: 16,
    },
    scoreCard: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
    },
    scoreValue: {
      fontSize: 48,
      fontWeight: '700',
      marginBottom: 4,
    },
    scoreLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    scoreDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoRowLast: {
      borderBottomWidth: 0,
    },
    infoIcon: {
      marginRight: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    strengthBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    warningCard: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 4,
    },
    warningCardCritical: {
      borderLeftColor: '#F44336',
    },
    warningCardHigh: {
      borderLeftColor: '#FF9800',
    },
    warningCardMedium: {
      borderLeftColor: '#FFC107',
    },
    warningCardLow: {
      borderLeftColor: '#4CAF50',
    },
    warningHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 8,
    },
    warningDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    actionButton: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginTop: 8,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    breachCard: {
      backgroundColor: '#FFF3E0',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#FF9800',
    },
    breachCardCritical: {
      backgroundColor: '#FFEBEE',
      borderLeftColor: '#F44336',
    },
    breachHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    breachTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#E65100',
      marginLeft: 8,
    },
    breachTitleCritical: {
      color: '#C62828',
    },
    breachInfo: {
      fontSize: 12,
      color: '#6D4C41',
      lineHeight: 18,
      marginBottom: 4,
    },
    breachSources: {
      fontSize: 11,
      color: '#8D6E63',
      fontStyle: 'italic',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
  });

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Excellent - Green
    if (score >= 60) return '#8BC34A'; // Good - Light Green
    if (score >= 40) return '#FFC107'; // Fair - Yellow
    if (score >= 20) return '#FF9800'; // Poor - Orange
    return '#F44336'; // Critical - Red
  };

  const getScoreDescription = (score: number): string => {
    if (score >= 80) return 'Excellent security posture';
    if (score >= 60) return 'Good security, minor improvements needed';
    if (score >= 40) return 'Fair security, some concerns';
    if (score >= 20) return 'Poor security, action required';
    return 'Critical security issues detected';
  };

  const getStrengthColor = (score: number): string => {
    if (score >= 4) return '#4CAF50';
    if (score >= 3) return '#8BC34A';
    if (score >= 2) return '#FFC107';
    if (score >= 1) return '#FF9800';
    return '#F44336';
  };

  const getRecommendedActionText = (
    action?: 'none' | 'change_password' | 'enable_2fa' | 'update_info',
  ): string => {
    switch (action) {
      case 'change_password':
        return 'Change password immediately';
      case 'enable_2fa':
        return 'Enable two-factor authentication';
      case 'update_info':
        return 'Update account information';
      case 'none':
      default:
        return 'No action required';
    }
  };

  const getRecommendedActionIcon = (
    action?: 'none' | 'change_password' | 'enable_2fa' | 'update_info',
  ): string => {
    switch (action) {
      case 'change_password':
        return 'lock-reset';
      case 'enable_2fa':
        return 'security';
      case 'update_info':
        return 'edit';
      case 'none':
      default:
        return 'check-circle';
    }
  };

  const securityScore = auditData?.securityScore ?? 0;
  const scoreColor = getScoreColor(securityScore);

  if (!auditData && !breachStatus) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons
              name="security"
              size={24}
              color={theme.textSecondary}
              style={styles.headerIcon}
            />
            <View>
              <Text style={styles.headerTitle}>Security Audit</Text>
              <Text style={styles.headerSubtitle}>No audit data available</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyState}>
          <MaterialIcons
            name="security"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={styles.emptyStateText}>
            Security audit will be performed when you save this password
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <MaterialIcons
            name="security"
            size={24}
            color={scoreColor}
            style={styles.headerIcon}
          />
          <View>
            <Text style={styles.headerTitle}>Security Audit</Text>
            <Text style={styles.headerSubtitle}>
              Score: {securityScore}/100 • Last checked:{' '}
              {format(new Date(updatedAt), 'MMM dd, yyyy')}
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
        <ScrollView style={styles.content} nestedScrollEnabled>
          {/* Security Score Card */}
          <View style={styles.scoreCard}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>
              {securityScore}
            </Text>
            <Text style={styles.scoreLabel}>Security Score</Text>
            <Text style={styles.scoreDescription}>
              {getScoreDescription(securityScore)}
            </Text>
          </View>

          {/* Breach Status */}
          {breachStatus && breachStatus.isBreached && (
            <View
              style={[
                styles.breachCard,
                breachStatus.severity === 'critical' &&
                  styles.breachCardCritical,
              ]}
            >
              <View style={styles.breachHeader}>
                <MaterialIcons
                  name="warning"
                  size={20}
                  color={
                    breachStatus.severity === 'critical' ? '#C62828' : '#E65100'
                  }
                />
                <Text
                  style={[
                    styles.breachTitle,
                    breachStatus.severity === 'critical' &&
                      styles.breachTitleCritical,
                  ]}
                >
                  Password Breach Detected
                </Text>
              </View>
              <Text style={styles.breachInfo}>
                This password has been found in {breachStatus.breachCount} known
                data breach{breachStatus.breachCount > 1 ? 'es' : ''}. Change it
                immediately.
              </Text>
              {breachStatus.breachSources.length > 0 && (
                <Text style={styles.breachSources}>
                  Sources: {breachStatus.breachSources.join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Password Strength */}
          {auditData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Password Strength</Text>
              <View style={styles.infoRow}>
                <MaterialIcons
                  name="shield"
                  size={20}
                  color={getStrengthColor(auditData.passwordStrength.score)}
                  style={styles.infoIcon}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Current Strength</Text>
                  <View
                    style={[
                      styles.strengthBadge,
                      {
                        backgroundColor: getStrengthColor(
                          auditData.passwordStrength.score,
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.strengthText}>
                      {auditData.passwordStrength.label}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.infoRow, styles.infoRowLast]}>
                <MaterialIcons
                  name="timer"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.infoIcon}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Time to Crack</Text>
                  <Text style={styles.infoValue}>
                    {auditData.passwordStrength.crackTime}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Security Issues */}
          {auditData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security Issues</Text>
              <View style={styles.infoRow}>
                <MaterialIcons
                  name="content-copy"
                  size={20}
                  color={
                    auditData.duplicateCount > 0
                      ? '#FF9800'
                      : theme.textSecondary
                  }
                  style={styles.infoIcon}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Duplicate Passwords</Text>
                  <Text style={styles.infoValue}>
                    {auditData.duplicateCount > 0
                      ? `${auditData.duplicateCount} duplicate${
                          auditData.duplicateCount > 1 ? 's' : ''
                        } found`
                      : 'No duplicates'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons
                  name="warning"
                  size={20}
                  color={
                    auditData.compromisedCount > 0
                      ? '#F44336'
                      : theme.textSecondary
                  }
                  style={styles.infoIcon}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Compromised Accounts</Text>
                  <Text style={styles.infoValue}>
                    {auditData.compromisedCount > 0
                      ? `${auditData.compromisedCount} compromised`
                      : 'Not compromised'}
                  </Text>
                </View>
              </View>
              <View style={[styles.infoRow, styles.infoRowLast]}>
                <MaterialIcons
                  name="update"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.infoIcon}
                />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Last Password Change</Text>
                  <Text style={styles.infoValue}>
                    {format(
                      new Date(auditData.lastPasswordChange),
                      'MMM dd, yyyy',
                    )}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Recommended Actions */}
          {auditData?.recommendedAction &&
            auditData.recommendedAction !== 'none' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended Action</Text>
                <View
                  style={[
                    styles.warningCard,
                    auditData.recommendedAction === 'change_password'
                      ? styles.warningCardCritical
                      : styles.warningCardMedium,
                  ]}
                >
                  <View style={styles.warningHeader}>
                    <MaterialIcons
                      name={getRecommendedActionIcon(
                        auditData.recommendedAction,
                      )}
                      size={20}
                      color={
                        auditData.recommendedAction === 'change_password'
                          ? '#F44336'
                          : '#FF9800'
                      }
                    />
                    <Text style={styles.warningTitle}>
                      {getRecommendedActionText(auditData.recommendedAction)}
                    </Text>
                  </View>
                  <Text style={styles.warningDescription}>
                    {auditData.recommendedAction === 'change_password' &&
                      'Your password security is compromised. Update it with a stronger, unique password.'}
                    {auditData.recommendedAction === 'enable_2fa' &&
                      'Add an extra layer of security by enabling two-factor authentication.'}
                    {auditData.recommendedAction === 'update_info' &&
                      'Some account information may be outdated. Review and update as needed.'}
                  </Text>
                </View>
              </View>
            )}

          {/* Metadata */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Metadata</Text>
            <View style={styles.infoRow}>
              <MaterialIcons
                name="add-circle"
                size={20}
                color={theme.textSecondary}
                style={styles.infoIcon}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>
                  {format(new Date(createdAt), 'MMM dd, yyyy HH:mm')}
                </Text>
              </View>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <MaterialIcons
                name="edit"
                size={20}
                color={theme.textSecondary}
                style={styles.infoIcon}
              />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Last Modified</Text>
                <Text style={styles.infoValue}>
                  {format(new Date(updatedAt), 'MMM dd, yyyy HH:mm')}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default SecurityAuditPanel;
