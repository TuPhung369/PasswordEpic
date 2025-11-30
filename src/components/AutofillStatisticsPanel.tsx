/**
 * Autofill Statistics Panel
 *
 * Comprehensive display of autofill usage, security, and performance metrics.
 * Shows real-time and historical data in an organized, visual format.
 *
 * @author PasswordEpic Team
 * @since Week 9+
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  autofillStatisticsService,
  ComprehensiveAutofillStats,
  TopDomain,
  RecentlyAddedDomain,
} from '../services/autofillStatisticsService';

interface AutofillStatisticsPanelProps {
  trustedDomainsCount?: number;
  onRefresh?: () => void;
}

export const AutofillStatisticsPanel: React.FC<
  AutofillStatisticsPanelProps
> = ({ trustedDomainsCount = 0, onRefresh }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [stats, setStats] = useState<ComprehensiveAutofillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    'overview',
  );

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const comprehensiveStats =
        await autofillStatisticsService.getComprehensiveStats(
          trustedDomainsCount,
        );
      setStats(comprehensiveStats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadStatistics();
    onRefresh?.();
  };

  if (loading || !stats) {
    return (
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={styles.loader}
        />
      </View>
    );
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return t('autofill_statistics.never');
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 minute
    if (diff < 60000) return t('autofill_statistics.just_now');
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return t('autofill_statistics.minutes_ago', { count: minutes });
    }
    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return t('autofill_statistics.hours_ago', { count: hours });
    }
    // Less than 1 week
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return t('autofill_statistics.days_ago', { count: days });
    }
    return date.toLocaleDateString();
  };

  const StatCard = ({
    title,
    value,
    icon,
    subtext,
    color = theme.primary,
  }: {
    title: string;
    value: string | number;
    icon: string;
    subtext?: string;
    color?: string;
  }) => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.background, borderColor: color },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statTitle, { color: theme.textSecondary }]}>
          {title}
        </Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        {subtext && (
          <Text style={[styles.statSubtext, { color: theme.textSecondary }]}>
            {subtext}
          </Text>
        )}
      </View>
    </View>
  );

  const ExpandableSection = ({
    title,
    icon,
    sectionId,
    children,
    defaultExpanded = false,
  }: {
    title: string;
    icon: string;
    sectionId: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
  }) => {
    const isExpanded = expandedSection === sectionId;

    return (
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(isExpanded ? null : sectionId)}
        >
          <View style={styles.sectionTitleContainer}>
            <Ionicons name={icon as any} size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {title}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
        {isExpanded && <View style={styles.sectionContent}>{children}</View>}
      </View>
    );
  };

  const renderTopDomainItem = (item: TopDomain, index: number) => (
    <View
      key={`${item.domain}-${index}`}
      style={[
        styles.listItem,
        {
          backgroundColor: index % 2 === 0 ? theme.background : theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.listItemBadge}>
        <Text style={[styles.badgeText, { color: theme.primary }]}>
          #{index + 1}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.listItemDomain, { color: theme.text }]}>
          {item.domain}
        </Text>
        <View style={styles.listItemStats}>
          <View style={styles.listItemStatBadge}>
            <Ionicons name="arrow-down" size={12} color={theme.success} />
            <Text
              style={[styles.listItemStatText, { color: theme.textSecondary }]}
            >
              {t('autofill_statistics.fills', { count: item.fillCount })}
            </Text>
          </View>
          {item.saveCount > 0 && (
            <View style={styles.listItemStatBadge}>
              <Ionicons name="arrow-up" size={12} color={theme.warning} />
              <Text
                style={[
                  styles.listItemStatText,
                  { color: theme.textSecondary },
                ]}
              >
                {t('autofill_statistics.saves', { count: item.saveCount })}
              </Text>
            </View>
          )}
          {item.autoVerified && (
            <View style={styles.listItemStatBadge}>
              <Ionicons
                name="checkmark-circle"
                size={12}
                color={theme.primary}
              />
              <Text
                style={[
                  styles.listItemStatText,
                  { color: theme.textSecondary },
                ]}
              >
                {t('autofill_statistics.auto_verified_label')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderRecentDomainItem = (item: RecentlyAddedDomain, index: number) => (
    <View
      key={`${item.domain}-${index}`}
      style={[
        styles.listItem,
        {
          backgroundColor: index % 2 === 0 ? theme.background : theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Ionicons
        name={item.autoVerified ? 'checkmark-circle' : 'shield-outline'}
        size={20}
        color={item.autoVerified ? theme.success : theme.warning}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.listItemDomain, { color: theme.text }]}>
          {item.domain}
        </Text>
        <Text style={[styles.listItemDate, { color: theme.textSecondary }]}>
          {t('autofill_statistics.added_date', {
            date: formatDate(item.addedAt),
            status: item.autoVerified
              ? t('autofill_statistics.auto_verified_label')
              : t('autofill_statistics.manual'),
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Refresh Button */}
      <TouchableOpacity
        style={[styles.refreshButton, { backgroundColor: theme.primary }]}
        onPress={handleRefresh}
      >
        <Ionicons name="refresh" size={18} color="#FFF" />
        <Text style={styles.refreshButtonText}>
          {t('autofill_statistics.refresh_stats')}
        </Text>
      </TouchableOpacity>

      {/* CORE USAGE METRICS */}
      <ExpandableSection
        title={t('autofill_statistics.core_usage_metrics')}
        icon="trending-up"
        sectionId="overview"
        defaultExpanded={true}
      >
        <View style={styles.statsGrid}>
          <StatCard
            title={t('autofill_statistics.total_fills')}
            value={stats.totalFills}
            icon="arrow-down-outline"
            subtext={t('autofill_statistics.this_month', {
              count: stats.thisMonthFills,
            })}
            color={theme.success}
          />
          <StatCard
            title={t('autofill_statistics.total_saves')}
            value={stats.totalSaves}
            icon="arrow-up-outline"
            subtext={t('autofill_statistics.this_week', {
              count: stats.thisWeekFills,
            })}
            color={theme.warning}
          />
          <StatCard
            title={t('autofill_statistics.last_used')}
            value={formatDate(stats.lastUsedTimestamp)}
            icon="time-outline"
            subtext={
              stats.lastUsedDomain || t('autofill_statistics.no_activity')
            }
            color={theme.primary}
          />
        </View>
      </ExpandableSection>

      {/* DOMAIN PERFORMANCE */}
      <ExpandableSection
        title={t('autofill_statistics.domain_performance')}
        icon="globe-outline"
        sectionId="domains"
      >
        <View style={styles.sectionStats}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text
                style={[
                  styles.sectionStatLabel,
                  { color: theme.textSecondary },
                ]}
              >
                {t('autofill_statistics.trusted_domains')}
              </Text>
              <Text style={[styles.sectionStatValue, { color: theme.primary }]}>
                {stats.totalTrustedDomains}
              </Text>
            </View>
            <View style={styles.col}>
              <Text
                style={[
                  styles.sectionStatLabel,
                  { color: theme.textSecondary },
                ]}
              >
                {t('autofill_statistics.auto_verified')}
              </Text>
              <Text style={[styles.sectionStatValue, { color: theme.success }]}>
                {stats.autoVerifiedDomainCount}
              </Text>
            </View>
          </View>

          {stats.mostUsedDomains.length > 0 && (
            <View style={[styles.subsection, { borderTopColor: theme.border }]}>
              <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                {t('autofill_statistics.top_used_domains')}
              </Text>
              {stats.mostUsedDomains.map((domain, index) =>
                renderTopDomainItem(domain, index),
              )}
            </View>
          )}

          {stats.recentlyAddedDomains.length > 0 && (
            <View style={[styles.subsection, { borderTopColor: theme.border }]}>
              <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                {t('autofill_statistics.recently_added')}
              </Text>
              {stats.recentlyAddedDomains
                .slice(0, 5)
                .map((domain, index) => renderRecentDomainItem(domain, index))}
            </View>
          )}
        </View>
      </ExpandableSection>

      {/* SECURITY METRICS */}
      <ExpandableSection
        title={t('autofill_statistics.security_metrics')}
        icon="shield-checkmark-outline"
        sectionId="security"
      >
        <View style={styles.statsGrid}>
          <StatCard
            title={t('autofill_statistics.verification_success')}
            value={`${stats.verificationSuccessRate}%`}
            icon="checkmark-circle-outline"
            color={theme.success}
          />
          <StatCard
            title={t('autofill_statistics.blocked_phishing')}
            value={stats.blockedPhishing}
            icon="warning-outline"
            color={
              stats.blockedPhishing > 0 ? theme.error : theme.textSecondary
            }
          />
          <StatCard
            title={t('autofill_statistics.biometric_auths')}
            value={stats.biometricAuthCount}
            icon="finger-print-outline"
            color={theme.primary}
          />
        </View>
      </ExpandableSection>

      {/* SERVICE HEALTH */}
      <ExpandableSection
        title={t('autofill_statistics.service_health')}
        icon="settings-outline"
        sectionId="health"
      >
        <View style={styles.healthStats}>
          <View
            style={[styles.healthItem, { backgroundColor: theme.background }]}
          >
            <View style={styles.healthItemHeader}>
              <Ionicons
                name={
                  stats.serviceEnabled ? 'checkmark-circle' : 'close-circle'
                }
                size={20}
                color={stats.serviceEnabled ? theme.success : theme.error}
              />
              <Text style={[styles.healthItemTitle, { color: theme.text }]}>
                {t('autofill_statistics.service_status')}
              </Text>
            </View>
            <Text
              style={[
                styles.healthItemValue,
                {
                  color: stats.serviceEnabled ? theme.success : theme.error,
                },
              ]}
            >
              {stats.serviceEnabled
                ? t('autofill_statistics.active')
                : t('autofill_statistics.inactive')}
            </Text>
          </View>

          <View
            style={[styles.healthItem, { backgroundColor: theme.background }]}
          >
            <View style={styles.healthItemHeader}>
              <Ionicons name="sync" size={20} color={theme.primary} />
              <Text style={[styles.healthItemTitle, { color: theme.text }]}>
                {t('autofill_statistics.last_sync')}
              </Text>
            </View>
            <Text style={[styles.healthItemValue, { color: theme.primary }]}>
              {formatDate(stats.lastSyncTimestamp)}
            </Text>
          </View>

          <View
            style={[styles.healthItem, { backgroundColor: theme.background }]}
          >
            <View style={styles.healthItemHeader}>
              <Ionicons name="flash" size={20} color={theme.warning} />
              <Text style={[styles.healthItemTitle, { color: theme.text }]}>
                {t('autofill_statistics.auto_submit_rate')}
              </Text>
            </View>
            <Text style={[styles.healthItemValue, { color: theme.warning }]}>
              {stats.autoSubmitRate}%
            </Text>
          </View>

          <View
            style={[styles.healthItem, { backgroundColor: theme.background }]}
          >
            <View style={styles.healthItemHeader}>
              <Ionicons name="layers" size={20} color={theme.primary} />
              <Text style={[styles.healthItemTitle, { color: theme.text }]}>
                {t('autofill_statistics.subdomain_matching_usage')}
              </Text>
            </View>
            <Text style={[styles.healthItemValue, { color: theme.primary }]}>
              {t('autofill_statistics.times', {
                count: stats.subdomainMatchingUsageCount,
              })}
            </Text>
          </View>
        </View>
      </ExpandableSection>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  sectionContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionStats: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  col: {
    alignItems: 'center',
    flex: 1,
  },
  sectionStatLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  sectionStatValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  subsection: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  listItemBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listItemDomain: {
    fontSize: 14,
    fontWeight: '600',
  },
  listItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  listItemStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  listItemStatText: {
    fontSize: 10,
    marginLeft: 4,
  },
  listItemDate: {
    fontSize: 11,
    marginTop: 2,
  },
  healthStats: {
    gap: 10,
  },
  healthItem: {
    padding: 12,
    borderRadius: 8,
  },
  healthItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  healthItemValue: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 42,
  },
});
