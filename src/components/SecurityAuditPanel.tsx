import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PasswordValidationService from '../services/passwordValidationService';
import { AuditHistoryService } from '../services/auditHistoryService';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { PasswordEntry } from '../types/password';
import ConfirmDialog from './ConfirmDialog';
import AuditHistoryViewer from './AuditHistoryViewer';

interface SecurityAuditData {
  id: string;
  passwordId: string;
  securityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  breachDetection: {
    isBreached: boolean;
    breachCount: number;
    sources: string[];
    lastChecked: Date;
  };
  vulnerabilities: {
    id: string;
    type:
      | 'weak_password'
      | 'common_password'
      | 'reused_password'
      | 'old_password'
      | 'no_2fa'
      | 'suspicious_activity';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    recommendation: string;
    detectedAt: Date;
  }[];
  passwordAnalysis: {
    strength: {
      score: number;
      label: string;
      factors: {
        length: number;
        hasUppercase: boolean;
        hasLowercase: boolean;
        hasNumbers: boolean;
        hasSpecialChars: boolean;
        hasCommonPatterns: boolean;
      };
    };
    entropy: number;
    crackTime: string;
    commonPatterns: string[];
  };
  domainAnalysis: {
    isKnownPhishing: boolean;
    reputation: 'trusted' | 'suspicious' | 'malicious' | 'unknown';
    sslStatus: 'valid' | 'invalid' | 'expired' | 'unknown';
    lastCheck: Date;
  };
  usagePatterns: {
    loginFrequency: number;
    lastUsed: Date;
    averageSessionDuration: number;
    suspiciousLocations: string[];
  };
  recommendations: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    actions: string[];
    estimatedImpact: string;
  };
  auditHistory: {
    date: Date;
    score: number;
    changes: string[];
  }[];
  lastAuditDate: Date;
  nextScheduledAudit: Date;
}

interface SecurityAuditPanelProps {
  passwordEntry: PasswordEntry | null;
  auditData?: SecurityAuditData;
  onRunAudit?: () => void;
  onFixVulnerability?: (vulnerabilityId: string) => void;
  onViewHistory?: () => void;
  onDecryptPassword?: () => Promise<string>; // Callback to decrypt password for audit
}

export const SecurityAuditPanel: React.FC<SecurityAuditPanelProps> = ({
  passwordEntry,
  auditData,
  onRunAudit,
  onFixVulnerability,
  onViewHistory,
  onDecryptPassword,
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [_selectedVulnerability, _setSelectedVulnerability] = useState<
    string | null
  >(null);
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

  // State to track decrypted password for audit
  const [decryptedPasswordForAudit, setDecryptedPasswordForAudit] = useState<
    string | null
  >(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showHistoryViewer, setShowHistoryViewer] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);
  const [shouldSaveAudit, setShouldSaveAudit] = useState(false);

  // Sample audit data if none provided
  // Tính auditData thực tế từ passwordEntry
  const currentAuditData: SecurityAuditData | null = useMemo(() => {
    if (!passwordEntry) return null;

    // Use decrypted password if available, otherwise use the password from entry
    const passwordToAnalyze =
      decryptedPasswordForAudit || passwordEntry.password;
    const canAnalyze = passwordEntry.isDecrypted || decryptedPasswordForAudit;

    if (!canAnalyze) {
      // Return minimal audit data when password is encrypted and not yet decrypted
      return {
        id: passwordEntry.id || 'audit-1',
        passwordId: passwordEntry.id || 'audit-1',
        securityScore: 0,
        riskLevel: 'low',
        breachDetection: {
          isBreached: false,
          breachCount: 0,
          sources: [],
          lastChecked: new Date(),
        },
        vulnerabilities: [],
        passwordAnalysis: {
          strength: {
            score: 0,
            label: 'Not analyzed',
            factors: {
              length: 0,
              hasUppercase: false,
              hasLowercase: false,
              hasNumbers: false,
              hasSpecialChars: false,
              hasCommonPatterns: false,
            },
          },
          entropy: 0,
          crackTime: 'Unknown',
          commonPatterns: [],
        },
        domainAnalysis: {
          isKnownPhishing: false,
          reputation: 'unknown',
          sslStatus: 'unknown',
          lastCheck: new Date(),
        },
        usagePatterns: {
          loginFrequency: 0,
          lastUsed: passwordEntry.updatedAt || new Date(),
          averageSessionDuration: 0,
          suspiciousLocations: [],
        },
        recommendations: {
          priority: 'low',
          actions: ['Click "Run Security Audit" to analyze password security'],
          estimatedImpact: 'Analysis not available',
        },
        auditHistory: [],
        lastAuditDate: new Date(),
        nextScheduledAudit: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    // Tính strength using the password to analyze (decrypted or plain)
    const strengthResult =
      PasswordValidationService.analyzePasswordStrength(passwordToAnalyze);
    // Xác định vulnerabilities
    const vulnerabilities: SecurityAuditData['vulnerabilities'] = [];
    if (strengthResult.score < 3) {
      vulnerabilities.push({
        id: 'vuln-weak',
        type: 'weak_password',
        severity: 'medium',
        title: 'Password Strength Could Be Improved',
        description: strengthResult.feedback.join(', '),
        recommendation:
          'Use at least 12 characters with uppercase, lowercase, numbers, and symbols',
        detectedAt: new Date(),
      });
    }
    // Kiểm tra mật khẩu cũ
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (passwordEntry.updatedAt && passwordEntry.updatedAt < sixMonthsAgo) {
      vulnerabilities.push({
        id: 'vuln-old',
        type: 'old_password',
        severity: 'low',
        title: 'Password Not Changed Recently',
        description: "This password hasn't been updated in over 6 months",
        recommendation: 'Consider updating your password every 3-6 months',
        detectedAt: new Date(),
      });
    }
    // Tính điểm
    const securityScore = Math.round((strengthResult.score / 4) * 100);
    // Risk level
    let riskLevel: SecurityAuditData['riskLevel'] = 'low';
    if (securityScore < 40) riskLevel = 'critical';
    else if (securityScore < 60) riskLevel = 'high';
    else if (securityScore < 75) riskLevel = 'medium';
    // Trả về auditData
    return {
      id: passwordEntry.id || 'audit-1',
      passwordId: passwordEntry.id || 'audit-1',
      securityScore,
      riskLevel,
      breachDetection: {
        isBreached: false,
        breachCount: 0,
        sources: [],
        lastChecked: new Date(),
      },
      vulnerabilities,
      passwordAnalysis: {
        strength: {
          score: securityScore,
          label: strengthResult.label,
          factors: {
            length: passwordToAnalyze.length,
            hasUppercase: /[A-Z]/.test(passwordToAnalyze),
            hasLowercase: /[a-z]/.test(passwordToAnalyze),
            hasNumbers: /\d/.test(passwordToAnalyze),
            hasSpecialChars: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(
              passwordToAnalyze,
            ),
            hasCommonPatterns: false,
          },
        },
        entropy: 0,
        crackTime: strengthResult.crackTime || '',
        commonPatterns: [],
      },
      domainAnalysis: {
        isKnownPhishing: false,
        reputation: 'trusted',
        sslStatus: 'valid',
        lastCheck: new Date(),
      },
      usagePatterns: {
        loginFrequency: 0,
        lastUsed: passwordEntry.updatedAt || new Date(),
        averageSessionDuration: 0,
        suspiciousLocations: [],
      },
      recommendations: {
        priority: vulnerabilities.length > 0 ? 'medium' : 'low',
        actions: vulnerabilities.map(v => v.recommendation),
        estimatedImpact:
          vulnerabilities.length > 0
            ? 'Security improvement needed'
            : 'No action needed',
      },
      auditHistory: [],
      lastAuditDate: new Date(),
      nextScheduledAudit: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }, [passwordEntry, decryptedPasswordForAudit]);

  // Nếu có auditData prop thì ưu tiên, còn không lấy từ tính toán
  const auditDataToShow = auditData && currentAuditData
    ? {
        ...currentAuditData,
        securityScore: (auditData as any).score || currentAuditData.securityScore,
        riskLevel: (auditData as any).riskLevel || currentAuditData.riskLevel,
        vulnerabilities: (auditData as any).vulnerabilities || currentAuditData.vulnerabilities,
        lastAuditDate: (auditData as any).date || currentAuditData.lastAuditDate,
        auditHistory: (auditData as any).auditHistory || [],
      }
    : currentAuditData;

  const getScoreColor = useCallback((score: number): string => {
    if (score >= 90) return '#00C851'; // Excellent - Green
    if (score >= 75) return '#4CAF50'; // Good - Light Green
    if (score >= 60) return '#8BC34A'; // Fair - Light Green
    if (score >= 40) return '#FFC107'; // Poor - Yellow
    if (score >= 20) return '#FF9800'; // Weak - Orange
    return '#F44336'; // Critical - Red
  }, []);

  const getScoreDescription = useCallback((score: number): string => {
    if (score >= 90) return 'Excellent security posture';
    if (score >= 75) return 'Good security, minor improvements needed';
    if (score >= 60) return 'Fair security, some concerns to address';
    if (score >= 40) return 'Poor security, multiple issues detected';
    if (score >= 20) return 'Weak security, immediate action required';
    return 'Critical security vulnerabilities detected';
  }, []);

  const getVulnerabilityIcon = useCallback((type: string): string => {
    switch (type) {
      case 'weak_password':
        return 'lock-closed-outline';
      case 'common_password':
        return 'warning-outline';
      case 'reused_password':
        return 'copy-outline';
      case 'old_password':
        return 'time-outline';
      case 'no_2fa':
        return 'shield-checkmark-outline';
      case 'suspicious_activity':
        return 'eye-outline';
      default:
        return 'information-circle-outline';
    }
  }, []);

  const getSeverityColor = useCallback((severity: string): string => {
    switch (severity) {
      case 'critical':
        return '#F44336';
      case 'high':
        return '#FF5722';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#FFC107';
      default:
        return '#9E9E9E';
    }
  }, []);

  const saveAuditResult = useCallback(async () => {
    if (!passwordEntry || !currentAuditData) return;

    try {
      const vulnerabilities = currentAuditData.vulnerabilities.map(v => ({
        type: v.type,
        severity: v.severity,
        title: v.title,
      }));

      const scoreColor = currentAuditData.securityScore >= 90
        ? '#00C851'
        : currentAuditData.securityScore >= 75
          ? '#4CAF50'
          : currentAuditData.securityScore >= 60
            ? '#8BC34A'
            : currentAuditData.securityScore >= 40
              ? '#FFC107'
              : currentAuditData.securityScore >= 20
                ? '#FF9800'
                : '#F44336';

      await AuditHistoryService.saveAuditResult(passwordEntry.id, {
        date: new Date(),
        score: currentAuditData.securityScore,
        riskLevel: currentAuditData.riskLevel,
        vulnerabilityCount: vulnerabilities.length,
        vulnerabilities,
        passwordStrength: {
          score: currentAuditData.passwordAnalysis.strength.score,
          label: currentAuditData.passwordAnalysis.strength.label,
          color: scoreColor,
          feedback: [],
          crackTime: currentAuditData.passwordAnalysis.crackTime,
        },
        changes: [],
      });

      console.log('✅ SecurityAuditPanel: Audit result saved');
    } catch (error) {
      console.error('❌ SecurityAuditPanel: Failed to save audit result:', error);
    }
  }, [passwordEntry, currentAuditData]);

  useEffect(() => {
    if (shouldSaveAudit && currentAuditData && currentAuditData.securityScore > 0) {
      saveAuditResult();
      setShouldSaveAudit(false);
    }
  }, [shouldSaveAudit, currentAuditData, saveAuditResult]);

  const handleRunAudit = useCallback(async () => {
    // Check if password needs to be decrypted for audit
    const isPasswordEncrypted = !passwordEntry?.isDecrypted;

    if (
      isPasswordEncrypted &&
      !decryptedPasswordForAudit &&
      onDecryptPassword
    ) {
      // Need to decrypt password first
      setIsDecrypting(true);

      try {
        // Decrypt password - onDecryptPassword handles authentication internally
        console.log('🔓 SecurityAuditPanel: Decrypting password for audit...');
        const decrypted = await onDecryptPassword();

        if (decrypted) {
          setDecryptedPasswordForAudit(decrypted);
          setShouldSaveAudit(true);
          console.log(
            '✅ SecurityAuditPanel: Password decrypted, audit will save automatically',
          );

          // Show success message
          setConfirmDialog({
            visible: true,
            title: 'Security Audit Complete',
            message:
              'Password security analysis has been completed successfully.',
            confirmText: 'OK',
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
        } else {
          throw new Error('Failed to decrypt password');
        }
      } catch (error) {
        console.error(
          '❌ SecurityAuditPanel: Failed to decrypt password:',
          error,
        );
        setConfirmDialog({
          visible: true,
          title: 'Decryption Failed',
          message: 'Could not decrypt password for security analysis.',
          confirmText: 'OK',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      } finally {
        setIsDecrypting(false);
      }
    } else if (onRunAudit) {
      // Custom audit handler provided
      onRunAudit();
    } else {
      // Password already decrypted or not encrypted, save audit result
      saveAuditResult();
      setConfirmDialog({
        visible: true,
        title: 'Security Audit',
        message: 'Security analysis is up to date.',
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    }
  }, [onRunAudit, passwordEntry, decryptedPasswordForAudit, onDecryptPassword, saveAuditResult]);

  const handleFixVulnerability = useCallback(
    (vulnerabilityId: string) => {
      if (onFixVulnerability) {
        onFixVulnerability(vulnerabilityId);
      } else {
        setConfirmDialog({
          visible: true,
          title: 'Fix Vulnerability',
          message: 'This will help you resolve the identified security issue.',
          confirmText: 'Continue',
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      }
    },
    [onFixVulnerability],
  );

  const handleViewHistory = useCallback(() => {
    if (onViewHistory) {
      onViewHistory();
    } else {
      setShowHistoryViewer(true);
    }
  }, [onViewHistory]);

  const formatTimestamp = useCallback((date: Date): string => {
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    if (diffInHours < 720) return `${Math.floor(diffInHours / 168)}w ago`;
    return `${Math.floor(diffInHours / 720)}mo ago`;
  }, []);

  const scoreColor = getScoreColor(auditDataToShow?.securityScore || 0);
  const hasVulnerabilities = (auditDataToShow?.vulnerabilities.length || 0) > 0;
  const criticalVulnerabilities = (auditDataToShow?.vulnerabilities || []).filter(
    v => v.severity === 'critical',
  );

  if (!passwordEntry) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={theme.textSecondary}
              style={styles.headerIcon}
            />
            <View>
              <Text style={styles.headerTitle}>Security Audit</Text>
              <Text style={styles.headerSubtitle}>No password selected</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Ionicons
            name="shield-checkmark-outline"
            size={48}
            color={theme.textSecondary}
          />
          <Text style={styles.emptyStateText}>
            Select a password entry to view security analysis
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Security Audit</Text>
          <Text style={styles.headerSubtitle}>
            Score: {auditDataToShow?.securityScore}/100 •
            {auditDataToShow?.vulnerabilities?.length
              ? ` ${auditDataToShow.vulnerabilities.length} issue${
                  auditDataToShow.vulnerabilities.length > 1 ? 's' : ''
                }`
              : ' All clear'}{' '}
            • Last:{' '}
            {formatTimestamp(auditDataToShow?.lastAuditDate || new Date())}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setExpanded(!expanded)}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>


          {/* Security Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreMain}>
                <Text style={[styles.scoreValue, { color: scoreColor }]}>
                  {auditDataToShow?.securityScore || 0}
                </Text>
                <Text style={styles.scoreLabel}>Security Score</Text>
              </View>
              <View style={styles.riskBadge}>
                <View
                  style={[
                    styles.riskIndicator,
                    { backgroundColor: scoreColor },
                  ]}
                >
                  <Text style={styles.riskText}>
                    {(auditDataToShow?.riskLevel || 'low').toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.scoreDescription}>
              {getScoreDescription(auditDataToShow?.securityScore || 0)}
            </Text>
          </View>

          {/* Breach Detection */}
          {auditDataToShow?.breachDetection.isBreached && (
            <View style={[styles.alertCard, styles.alertCardCritical]}>
              <View style={styles.alertHeader}>
                <Ionicons name="warning" size={20} color="#F44336" />
                <Text style={styles.alertTitle}>Password Breach Detected</Text>
              </View>
              <Text style={styles.alertDescription}>
                This password has been found in{' '}
                {auditDataToShow?.breachDetection.breachCount} known data breach
                {(auditDataToShow?.breachDetection.breachCount || 0) > 1 ? 'es' : ''}.
                Change it immediately.
              </Text>
              {(auditDataToShow?.breachDetection.sources.length || 0) > 0 && (
                <Text style={styles.alertSources}>
                  Sources: {auditDataToShow?.breachDetection.sources.join(', ')}
                </Text>
              )}
              <TouchableOpacity
                style={styles.alertAction}
                onPress={() =>
                  setConfirmDialog({
                    visible: true,
                    title: 'Change Password',
                    message: 'Redirect to password change form',
                    confirmText: 'OK',
                    onConfirm: () =>
                      setConfirmDialog(prev => ({ ...prev, visible: false })),
                  })
                }
              >
                <Text style={styles.alertActionText}>Change Password Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Vulnerabilities */}
          {hasVulnerabilities && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Security Issues ({auditDataToShow?.vulnerabilities.length || 0})
                </Text>
                {criticalVulnerabilities.length > 0 && (
                  <View style={styles.criticalBadge}>
                    <Text style={styles.criticalBadgeText}>
                      {criticalVulnerabilities.length} Critical
                    </Text>
                  </View>
                )}
              </View>

              {(auditDataToShow?.vulnerabilities || []).map(vulnerability => (
                <View
                  key={vulnerability.id}
                  style={[
                    styles.vulnerabilityCard,
                    {
                      borderLeftColor: getSeverityColor(vulnerability.severity),
                    },
                  ]}
                >
                  <View style={styles.vulnerabilityHeader}>
                    <View style={styles.vulnerabilityInfo}>
                      <Ionicons
                        name={getVulnerabilityIcon(vulnerability.type)}
                        size={18}
                        color={getSeverityColor(vulnerability.severity)}
                        style={styles.vulnerabilityIcon}
                      />
                      <View>
                        <Text style={styles.vulnerabilityTitle}>
                          {vulnerability.title}
                        </Text>
                        <Text
                          style={[
                            styles.vulnerabilitySeverity,
                            { color: getSeverityColor(vulnerability.severity) },
                          ]}
                        >
                          {vulnerability.severity.toUpperCase()} •{' '}
                          {formatTimestamp(vulnerability.detectedAt)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.fixButton}
                      onPress={() => handleFixVulnerability(vulnerability.id)}
                    >
                      <Ionicons
                        name="construct-outline"
                        size={16}
                        color={theme.primary}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.vulnerabilityDescription}>
                    {vulnerability.description}
                  </Text>
                  <Text style={styles.vulnerabilityRecommendation}>
                    💡 {vulnerability.recommendation}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Password Analysis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Password Analysis</Text>

            {/* Strength */}
            <View style={styles.analysisCard}>
              <View style={styles.analysisHeader}>
                <Ionicons
                  name="shield-outline"
                  size={20}
                  color={getScoreColor(
                    auditDataToShow?.passwordAnalysis.strength.score || 0,
                  )}
                />
                <Text style={styles.analysisTitle}>Strength Assessment</Text>
              </View>
              <View style={styles.strengthRow}>
                <View
                  style={[
                    styles.strengthBadge,
                    {
                      backgroundColor: getScoreColor(
                        auditDataToShow?.passwordAnalysis.strength.score || 0,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.strengthText}>
                    {auditDataToShow?.passwordAnalysis.strength.label || 'Not analyzed'}
                  </Text>
                </View>
                <Text style={styles.strengthScore}>
                  {auditDataToShow?.passwordAnalysis.strength.score || 0}/100
                </Text>
              </View>
              <View style={styles.factorsGrid}>
                {Object.entries(
                  auditDataToShow?.passwordAnalysis.strength.factors || {},
                ).map(([key, value]) => (
                  <View key={key} style={styles.factorItem}>
                    <Ionicons
                      name={value ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={value ? '#4CAF50' : '#F44336'}
                    />
                    <Text style={styles.factorText}>
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Entropy</Text>
                  <Text style={styles.metricValue}>
                    {auditDataToShow?.passwordAnalysis.entropy || 0} bits
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Crack Time</Text>
                  <Text style={styles.metricValue}>
                    {auditDataToShow?.passwordAnalysis.crackTime || 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Domain Analysis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Domain Security</Text>
            <View style={styles.analysisCard}>
              <View style={styles.domainRow}>
                <View style={styles.domainStatus}>
                  <Ionicons
                    name={
                      auditDataToShow?.domainAnalysis.isKnownPhishing
                        ? 'alert-circle'
                        : 'checkmark-circle'
                    }
                    size={20}
                    color={
                      auditDataToShow?.domainAnalysis.isKnownPhishing
                        ? '#F44336'
                        : '#4CAF50'
                    }
                  />
                  <Text style={styles.domainLabel}>
                    {auditDataToShow?.domainAnalysis.isKnownPhishing
                      ? 'Phishing Risk'
                      : 'Safe Domain'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.reputationBadge,
                    {
                      backgroundColor: getSeverityColor(
                        (auditDataToShow?.domainAnalysis.reputation === 'trusted')
                          ? 'low'
                          : 'high',
                      ),
                    },
                  ]}
                >
                  <Text style={styles.reputationText}>
                    {(auditDataToShow?.domainAnalysis.reputation || 'unknown').toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.sslRow}>
                <Ionicons
                  name={
                    (auditDataToShow?.domainAnalysis.sslStatus === 'valid')
                      ? 'lock-closed'
                      : 'lock-open'
                  }
                  size={16}
                  color={
                    (auditDataToShow?.domainAnalysis.sslStatus === 'valid')
                      ? '#4CAF50'
                      : '#F44336'
                  }
                />
                <Text style={styles.sslText}>
                  SSL: {auditDataToShow?.domainAnalysis.sslStatus || 'unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* Usage Patterns */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usage Analysis</Text>
            <View style={styles.analysisCard}>
              <View style={styles.usageGrid}>
                <View style={styles.usageItem}>
                  <Text style={styles.usageValue}>
                    {auditDataToShow?.usagePatterns.loginFrequency || 0}
                  </Text>
                  <Text style={styles.usageLabel}>Logins/Month</Text>
                </View>
                <View style={styles.usageItem}>
                  <Text style={styles.usageValue}>
                    {formatTimestamp(auditDataToShow?.usagePatterns.lastUsed || new Date())}
                  </Text>
                  <Text style={styles.usageLabel}>Last Used</Text>
                </View>
                <View style={styles.usageItem}>
                  <Text style={styles.usageValue}>
                    {auditDataToShow?.usagePatterns.averageSessionDuration || 0}m
                  </Text>
                  <Text style={styles.usageLabel}>Avg Session</Text>
                </View>
              </View>
              {(auditDataToShow?.usagePatterns.suspiciousLocations.length || 0) >
                0 && (
                <View style={styles.suspiciousLocations}>
                  <Ionicons name="location" size={16} color="#FF9800" />
                  <Text style={styles.suspiciousText}>
                    Suspicious locations:{' '}
                    {(auditDataToShow?.usagePatterns.suspiciousLocations || []).join(
                      ', ',
                    )}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Recommendations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <View
              style={[
                styles.recommendationCard,
                {
                  borderLeftColor: getSeverityColor(
                    auditDataToShow?.recommendations.priority || 'low',
                  ),
                },
              ]}
            >
              <View style={styles.recommendationHeader}>
                <Ionicons
                  name="bulb-outline"
                  size={20}
                  color={getSeverityColor(
                    auditDataToShow?.recommendations.priority || 'low',
                  )}
                />
                <Text style={styles.recommendationTitle}>
                  {(auditDataToShow?.recommendations.priority || 'low').toUpperCase()}{' '}
                  Priority Actions
                </Text>
              </View>
              {(auditDataToShow?.recommendations.actions || []).map((action, index) => (
                <View key={index} style={styles.actionItem}>
                  <Text style={styles.actionText}>• {action}</Text>
                </View>
              ))}
              <Text style={styles.impactText}>
                Expected Impact:{' '}
                {auditDataToShow?.recommendations.estimatedImpact || 'Analysis not available'}
              </Text>
            </View>
          </View>

          {/* Audit History */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Audit History</Text>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={handleViewHistory}
              >
                <Text style={styles.historyButtonText}>View All</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>

            {(auditDataToShow?.auditHistory || []).slice(0, 3).map((audit, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyDate}>
                  <Text style={styles.historyDateText}>
                    {formatTimestamp(audit.date)}
                  </Text>
                  <Text
                    style={[
                      styles.historyScore,
                      { color: getScoreColor(audit.score) },
                    ]}
                  >
                    {audit.score}/100
                  </Text>
                </View>
                <View style={styles.historyChanges}>
                  {(audit.changes || []).map((change, changeIndex) => (
                    <Text key={changeIndex} style={styles.historyChangeText}>
                      • {change}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />

      {passwordEntry && (
        <AuditHistoryViewer
          visible={showHistoryViewer}
          onClose={() => setShowHistoryViewer(false)}
          passwordEntryId={passwordEntry.id}
        />
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.surface || theme.card,
      borderRadius: 16,
      margin: 16,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: 16,
      gap: 12,
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
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    headerContent: {
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    auditButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      borderRadius: 18,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    expandButton: {
      padding: 4,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    scoreCard: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      alignItems: 'center',
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 12,
    },
    scoreMain: {
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
    },
    riskBadge: {
      alignItems: 'flex-end',
    },
    riskIndicator: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    riskText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'white',
    },
    scoreDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: 20,
    },
    sectionLast: {
      marginBottom: 0,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    criticalBadge: {
      backgroundColor: '#F44336',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    criticalBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: 'white',
    },
    alertCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
    },
    alertCardCritical: {
      backgroundColor: '#FFEBEE',
      borderLeftColor: '#F44336',
    },
    alertCardPrimary: {
      borderWidth: 1,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    alertTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#F44336',
      marginLeft: 8,
    },
    alertDescription: {
      fontSize: 14,
      color: '#D32F2F',
      lineHeight: 20,
      marginBottom: 8,
    },
    alertSources: {
      fontSize: 12,
      color: '#B71C1C',
      fontStyle: 'italic',
      marginBottom: 12,
    },
    alertAction: {
      flexDirection: 'row',
      backgroundColor: '#F44336',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'white',
    },
    alertActionIcon: {
      marginRight: 8,
    },
    vulnerabilityCard: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    vulnerabilityHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    vulnerabilityInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
    },
    vulnerabilityIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    vulnerabilityTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    vulnerabilitySeverity: {
      fontSize: 11,
      fontWeight: '500',
    },
    vulnerabilityDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    vulnerabilityRecommendation: {
      fontSize: 12,
      color: theme.primary,
      fontStyle: 'italic',
      lineHeight: 16,
    },
    fixButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary + '20',
      borderRadius: 16,
    },
    analysisCard: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
    },
    analysisHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    analysisTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 8,
    },
    strengthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    strengthBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'white',
    },
    strengthScore: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    factorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    factorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '50%',
      marginBottom: 8,
    },
    factorText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    metric: {
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    domainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    domainStatus: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    domainLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginLeft: 8,
    },
    reputationBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    reputationText: {
      fontSize: 11,
      fontWeight: '600',
      color: 'white',
    },
    sslRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sslText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    usageGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 12,
    },
    usageItem: {
      alignItems: 'center',
    },
    usageValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    usageLabel: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    suspiciousLocations: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    suspiciousText: {
      fontSize: 12,
      color: '#FF9800',
      marginLeft: 6,
      flex: 1,
    },
    recommendationCard: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
    },
    recommendationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    recommendationTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 8,
    },
    actionItem: {
      marginBottom: 6,
    },
    actionText: {
      fontSize: 13,
      color: theme.text,
      lineHeight: 18,
    },
    impactText: {
      fontSize: 12,
      color: theme.primary,
      fontStyle: 'italic',
      marginTop: 8,
    },
    historyButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    historyButtonText: {
      fontSize: 14,
      color: theme.primary,
      marginRight: 4,
    },
    historyItem: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
    },
    historyDate: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    historyDateText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    historyScore: {
      fontSize: 13,
      fontWeight: '600',
    },
    historyChanges: {
      paddingLeft: 8,
    },
    historyChangeText: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    nextAuditCard: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    nextAuditInfo: {
      flex: 1,
      marginLeft: 12,
    },
    nextAuditTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 2,
    },
    nextAuditDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    nextAuditButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
    },
    nextAuditButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'white',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 16,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

export default SecurityAuditPanel;
