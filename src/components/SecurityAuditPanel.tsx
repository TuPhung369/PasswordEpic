import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PasswordValidationService from '../services/passwordValidationService';
import { AuditHistoryService } from '../services/auditHistoryService';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { PasswordEntry } from '../types/password';
import ConfirmDialog from './ConfirmDialog';
import AuditHistoryViewer from './AuditHistoryViewer';
import { useAppDispatch } from '../hooks/redux';
import { updatePasswordAuditData } from '../store/slices/passwordsSlice';

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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [expanded, setExpanded] = useState(true); // ✅ Default expanded to show Security Audit
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

    // ✅ FIX: Use stored audit data from passwordEntry.auditData if password is encrypted
    // This allows showing audit results without decrypting the password
    const canAnalyze = passwordEntry.isDecrypted || decryptedPasswordForAudit;

    if (!canAnalyze && passwordEntry.auditData) {
      // ✅ Use stored audit data when password is encrypted
      const storedStrength = passwordEntry.auditData.passwordStrength;
      const storedScore = passwordEntry.auditData.securityScore || 0;

      console.log('📊 [SecurityAuditPanel] Using stored audit data:', {
        score: storedScore,
        strengthScore: storedStrength?.score,
        strengthLabel: storedStrength?.label,
      });

      // Build vulnerabilities from stored data
      const vulnerabilities: SecurityAuditData['vulnerabilities'] = [];
      if (storedStrength && storedStrength.score < 3) {
        vulnerabilities.push({
          id: 'vuln-weak',
          type: 'weak_password',
          severity: 'medium',
          title: 'Password Strength Could Be Improved',
          description:
            storedStrength.feedback?.join(', ') || 'Password could be stronger',
          recommendation:
            'Use at least 12 characters with uppercase, lowercase, numbers, and symbols',
          detectedAt: new Date(),
        });
      }

      // Check password age
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

      // Use stored security score directly from auditData
      const securityScore = storedScore;

      // Determine risk level
      let riskLevel: SecurityAuditData['riskLevel'] = 'low';
      if (securityScore < 40) riskLevel = 'critical';
      else if (securityScore < 60) riskLevel = 'high';
      else if (securityScore < 75) riskLevel = 'medium';

      return {
        id: passwordEntry.id || 'audit-1',
        passwordId: passwordEntry.id || 'audit-1',
        securityScore,
        riskLevel,
        breachDetection: {
          isBreached: passwordEntry.breachStatus?.isBreached || false,
          breachCount: passwordEntry.breachStatus?.breachCount || 0,
          sources: [], // sources not available in BreachStatus type
          lastChecked: passwordEntry.breachStatus?.lastChecked || new Date(),
        },
        vulnerabilities,
        passwordAnalysis: {
          strength: {
            score: securityScore,
            label: storedStrength?.label || 'Unknown',
            factors: (storedStrength?.factors as any) || {
              length: 0,
              hasUppercase: false,
              hasLowercase: false,
              hasNumbers: false,
              hasSpecialChars: false,
              hasCommonPatterns: false,
            },
          },
          entropy: 0,
          crackTime: storedStrength?.crackTime || 'Unknown',
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
          lastUsed:
            passwordEntry.lastUsed || passwordEntry.updatedAt || new Date(),
          averageSessionDuration: 0,
          suspiciousLocations: [],
        },
        recommendations: {
          priority:
            riskLevel === 'critical' || riskLevel === 'high' ? 'high' : 'low',
          actions:
            vulnerabilities.length > 0
              ? vulnerabilities.map(v => v.recommendation)
              : ['Password security looks good'],
          estimatedImpact:
            vulnerabilities.length > 0
              ? 'Improving password strength reduces breach risk'
              : 'No immediate action needed',
        },
        auditHistory: [],
        lastAuditDate: passwordEntry.auditData.lastPasswordChange || new Date(),
        nextScheduledAudit: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    // Use decrypted password if available, otherwise use the password from entry
    const passwordToAnalyze =
      decryptedPasswordForAudit || passwordEntry.password;

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

    // Use stored security score if available, otherwise calculate from strength
    let securityScore = passwordEntry.auditData?.securityScore;

    if (securityScore === undefined || securityScore === null) {
      // Fallback: Calculate from strength if no stored score
      const strengthScore = strengthResult.score;
      securityScore = Math.round((strengthScore / 4) * 70);

      const lastChange =
        passwordEntry.auditData?.lastPasswordChange ||
        passwordEntry.updatedAt ||
        passwordEntry.createdAt;
      if (lastChange) {
        const monthsSinceChange = Math.floor(
          (new Date().getTime() - new Date(lastChange).getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        );
        if (monthsSinceChange === 0) securityScore += 20;
        else if (monthsSinceChange < 6) securityScore += 15;
        else if (monthsSinceChange < 12) securityScore += 10;
        else if (monthsSinceChange < 24) securityScore += 5;
      }

      if ((passwordEntry.auditData?.duplicateCount || 0) > 0) {
        securityScore -= 10;
      }

      if (passwordEntry.breachStatus?.isBreached || false) {
        securityScore -= 15;
      }

      securityScore = Math.max(0, Math.min(100, securityScore));
    }

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
  const auditDataToShow =
    auditData && currentAuditData
      ? {
          ...currentAuditData,
          securityScore:
            (auditData as any).score || currentAuditData.securityScore,
          riskLevel: (auditData as any).riskLevel || currentAuditData.riskLevel,
          vulnerabilities:
            (auditData as any).vulnerabilities ||
            currentAuditData.vulnerabilities,
          lastAuditDate:
            (auditData as any).date || currentAuditData.lastAuditDate,
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

  const getScoreLabel = useCallback(
    (score: number): string => {
      if (score >= 90) return t('security_audit.score_excellent');
      if (score >= 75) return t('security_audit.score_good');
      if (score >= 60) return t('security_audit.score_fair');
      if (score >= 40) return t('security_audit.score_poor');
      if (score >= 20) return t('security_audit.score_weak');
      return t('security_audit.score_critical');
    },
    [t],
  );

  const getScoreDescription = useCallback(
    (score: number): string => {
      if (score >= 90) return t('security_audit.desc_excellent');
      if (score >= 75) return t('security_audit.desc_good');
      if (score >= 60) return t('security_audit.desc_fair');
      if (score >= 40) return t('security_audit.desc_poor');
      if (score >= 20) return t('security_audit.desc_weak');
      return t('security_audit.desc_critical');
    },
    [t],
  );

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

      const scoreColor =
        currentAuditData.securityScore >= 90
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
          factors: currentAuditData.passwordAnalysis.strength.factors,
        },
        changes: [],
      });

      console.log('✅ SecurityAuditPanel: Audit result saved');

      // Update Redux with new audit data
      dispatch(
        updatePasswordAuditData({
          passwordId: passwordEntry.id,
          auditData: {
            securityScore: currentAuditData.securityScore,
            lastAuditDate: new Date(),
            passwordStrength: {
              score: currentAuditData.passwordAnalysis.strength.score,
              label: currentAuditData.passwordAnalysis.strength.label,
              color: scoreColor,
              feedback: [],
              crackTime: currentAuditData.passwordAnalysis.crackTime,
              factors: currentAuditData.passwordAnalysis.strength.factors,
            },
            duplicateCount: passwordEntry.auditData?.duplicateCount ?? 0,
            compromisedCount: passwordEntry.auditData?.compromisedCount ?? 0,
            lastPasswordChange:
              passwordEntry.auditData?.lastPasswordChange ?? new Date(),
          },
        }),
      );
      console.log('✅ SecurityAuditPanel: Redux updated with new audit data');
    } catch (error) {
      console.error(
        '❌ SecurityAuditPanel: Failed to save audit result:',
        error,
      );
    }
  }, [passwordEntry, currentAuditData, dispatch]);

  useEffect(() => {
    if (
      shouldSaveAudit &&
      currentAuditData &&
      currentAuditData.securityScore > 0
    ) {
      saveAuditResult();
      setShouldSaveAudit(false);
    }
  }, [shouldSaveAudit, currentAuditData, saveAuditResult]);

  const handleRunAudit = useCallback(async () => {
    // Check if password needs to be decrypted for audit
    const passwordIsEncrypted = !passwordEntry?.isDecrypted;

    if (
      passwordIsEncrypted &&
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
  }, [
    onRunAudit,
    passwordEntry,
    decryptedPasswordForAudit,
    onDecryptPassword,
    saveAuditResult,
  ]);

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
  const criticalVulnerabilities = (
    auditDataToShow?.vulnerabilities || []
  ).filter(v => v.severity === 'critical');

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
              <Text style={styles.headerTitle}>
                {t('security_audit.title')}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t('security_audit.no_password_selected')}
              </Text>
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
            {t('security_audit.select_password_to_analyze')}
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
          <Text style={styles.headerTitle}>{t('security_audit.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('security_audit.security_score')}:{' '}
            {auditDataToShow?.securityScore}/100 •
            {auditDataToShow?.vulnerabilities?.length
              ? ` ${auditDataToShow.vulnerabilities.length} ${t(
                  'security_audit.security_issues',
                ).toLowerCase()}`
              : ` ${t('security_audit.no_vulnerabilities')}`}{' '}
            • Last:{' '}
            {formatTimestamp(auditDataToShow?.lastAuditDate || new Date())}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.auditButton}
            onPress={handleRunAudit}
            disabled={isDecrypting}
          >
            <Ionicons
              name={isDecrypting ? 'refresh' : 'refresh-outline'}
              size={20}
              color={theme.primary}
            />
          </TouchableOpacity>
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
                <Text style={styles.scoreLabel}>
                  {t('security_audit.security_score')}
                </Text>
              </View>
              <View style={styles.riskBadge}>
                <View
                  style={[
                    styles.riskIndicator,
                    { backgroundColor: scoreColor },
                  ]}
                >
                  <Text style={styles.riskText}>
                    {getScoreLabel(auditDataToShow?.securityScore || 0)}
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
                <Text style={styles.alertTitle}>
                  {t('security_audit.breach_detected')}
                </Text>
              </View>
              <Text style={styles.alertDescription}>
                {t('security_audit.breach_description')}
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
                    title: t('security_audit.change_password_now'),
                    message: 'Redirect to password change form',
                    confirmText: t('common.ok'),
                    onConfirm: () =>
                      setConfirmDialog(prev => ({ ...prev, visible: false })),
                  })
                }
              >
                <Text style={styles.alertActionText}>
                  {t('security_audit.change_password_now')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Vulnerabilities */}
          {hasVulnerabilities && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('security_audit.security_issues')} (
                  {auditDataToShow?.vulnerabilities.length || 0})
                </Text>
                {criticalVulnerabilities.length > 0 && (
                  <View style={styles.criticalBadge}>
                    <Text style={styles.criticalBadgeText}>
                      {criticalVulnerabilities.length}{' '}
                      {t('security_audit.priority_critical')}
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
            <Text style={styles.sectionTitle}>
              {t('security_audit.password_analysis')}
            </Text>

            {/* Strength */}
            <View style={styles.analysisCard}>
              <View style={styles.analysisHeader}>
                <Ionicons
                  name="shield-outline"
                  size={20}
                  color={getScoreColor(auditDataToShow?.securityScore || 0)}
                />
                <Text style={styles.analysisTitle}>
                  {t('security_audit.strength_assessment')}
                </Text>
              </View>
              <View style={styles.strengthRow}>
                <View
                  style={[
                    styles.strengthBadge,
                    {
                      backgroundColor: getScoreColor(
                        auditDataToShow?.securityScore || 0,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.strengthText}>
                    {auditDataToShow?.passwordAnalysis.strength.label ||
                      'Not analyzed'}
                  </Text>
                </View>
              </View>
              <View style={styles.factorsGrid}>
                {(() => {
                  const factors =
                    auditDataToShow?.passwordAnalysis.strength.factors || {};
                  const factorLabels: Record<string, string> = {
                    length: t('security_audit.factor_length_12'),
                    hasUppercase: t('security_audit.factor_uppercase'),
                    hasLowercase: t('security_audit.factor_lowercase'),
                    hasNumbers: t('security_audit.factor_numbers'),
                    hasSpecialChars: t('security_audit.factor_special'),
                    hasCommonPatterns: t('security_audit.factor_no_patterns'),
                  };

                  return Object.entries(factors).map(([key, value]) => (
                    <View key={key} style={styles.factorItem}>
                      <Ionicons
                        name={value ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={value ? '#4CAF50' : '#F44336'}
                      />
                      <Text style={styles.factorText}>
                        {factorLabels[key] ||
                          key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())}
                      </Text>
                    </View>
                  ));
                })()}
              </View>
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Entropy</Text>
                  <Text style={styles.metricValue}>
                    {auditDataToShow?.passwordAnalysis.entropy || 0} bits
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>
                    {t('security_audit.crack_time')}
                  </Text>
                  <Text style={styles.metricValue}>
                    {auditDataToShow?.passwordAnalysis.crackTime || 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Domain Analysis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('security_audit.domain_security')}
            </Text>
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
                        auditDataToShow?.domainAnalysis.reputation === 'trusted'
                          ? 'low'
                          : 'high',
                      ),
                    },
                  ]}
                >
                  <Text style={styles.reputationText}>
                    {(
                      auditDataToShow?.domainAnalysis.reputation || 'unknown'
                    ).toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.sslRow}>
                <Ionicons
                  name={
                    auditDataToShow?.domainAnalysis.sslStatus === 'valid'
                      ? 'lock-closed'
                      : 'lock-open'
                  }
                  size={16}
                  color={
                    auditDataToShow?.domainAnalysis.sslStatus === 'valid'
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
            <Text style={styles.sectionTitle}>
              {t('security_audit.usage_analysis')}
            </Text>
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
                    {formatTimestamp(
                      auditDataToShow?.usagePatterns.lastUsed || new Date(),
                    )}
                  </Text>
                  <Text style={styles.usageLabel}>
                    {t('security_audit.last_accessed')}
                  </Text>
                </View>
                <View style={styles.usageItem}>
                  <Text style={styles.usageValue}>
                    {auditDataToShow?.usagePatterns.averageSessionDuration || 0}
                    m
                  </Text>
                  <Text style={styles.usageLabel}>Avg Session</Text>
                </View>
              </View>
              {(auditDataToShow?.usagePatterns.suspiciousLocations.length ||
                0) > 0 && (
                <View style={styles.suspiciousLocations}>
                  <Ionicons name="location" size={16} color="#FF9800" />
                  <Text style={styles.suspiciousText}>
                    Suspicious locations:{' '}
                    {(
                      auditDataToShow?.usagePatterns.suspiciousLocations || []
                    ).join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Recommendations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('security_audit.recommendations')}
            </Text>
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
                  {(
                    auditDataToShow?.recommendations.priority || 'low'
                  ).toUpperCase()}{' '}
                  Priority Actions
                </Text>
              </View>
              {(auditDataToShow?.recommendations.actions || []).map(
                (action, index) => (
                  <View key={index} style={styles.actionItem}>
                    <Text style={styles.actionText}>• {action}</Text>
                  </View>
                ),
              )}
              <Text style={styles.impactText}>
                Expected Impact:{' '}
                {auditDataToShow?.recommendations.estimatedImpact ||
                  'Analysis not available'}
              </Text>
            </View>
          </View>

          {/* Audit History */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('security_audit.audit_history')}
              </Text>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={handleViewHistory}
              >
                <Text style={styles.historyButtonText}>
                  {t('security_audit.view_all')}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={theme.primary}
                />
              </TouchableOpacity>
            </View>

            {(auditDataToShow?.auditHistory || [])
              .slice(0, 3)
              .map((audit, index) => (
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
