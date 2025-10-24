/**
 * AutofillManagementScreen
 *
 * Comprehensive screen for managing autofill functionality.
 * Provides settings, trusted domains management, and statistics.
 *
 * Features:
 * - Autofill settings panel
 * - Trusted domains list and management
 * - Domain verification controls
 * - Phishing protection settings
 * - Usage statistics
 * - Help and documentation
 *
 * @author PasswordEpic Team
 * @since Week 9 - Phase 4
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { autofillService } from '../../services/autofillService';
import { domainVerificationService } from '../../services/domainVerificationService';
import AutofillSettingsPanel from '../../components/AutofillSettingsPanel';

interface TrustedDomain {
  domain: string;
  addedAt: string;
  verified: boolean;
}

type TabType = 'settings' | 'domains' | 'statistics';

export const AutofillManagementScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [trustedDomains, setTrustedDomains] = useState<TrustedDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTrustedDomains();
  }, []);

  const loadTrustedDomains = async () => {
    try {
      setLoading(true);
      const domains = await domainVerificationService.getTrustedDomains();
      setTrustedDomains(domains);
    } catch (error) {
      console.error('Error loading trusted domains:', error);
      Alert.alert('Error', 'Failed to load trusted domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      Alert.alert('Error', 'Please enter a domain');
      return;
    }

    try {
      const success = await domainVerificationService.addTrustedDomain(
        newDomain.trim(),
      );
      if (success) {
        setNewDomain('');
        loadTrustedDomains();
        Alert.alert('Success', 'Domain added to trusted list');
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      Alert.alert('Error', 'Failed to add domain');
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    Alert.alert('Remove Domain', `Remove ${domain} from trusted domains?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const success = await domainVerificationService.removeTrustedDomain(
              domain,
            );
            if (success) {
              loadTrustedDomains();
              Alert.alert('Success', 'Domain removed');
            }
          } catch (error) {
            console.error('Error removing domain:', error);
            Alert.alert('Error', 'Failed to remove domain');
          }
        },
      },
    ]);
  };

  const handleVerifyDomain = async (domain: string) => {
    try {
      const isValid = await domainVerificationService.verifyDomain(domain);
      Alert.alert(
        'Domain Verification',
        isValid
          ? `${domain} is a valid and trusted domain`
          : `${domain} could not be verified or is suspicious`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error verifying domain:', error);
      Alert.alert('Error', 'Failed to verify domain');
    }
  };

  const handleExportDomains = async () => {
    try {
      const exported = await domainVerificationService.exportTrustedDomains();
      Alert.alert(
        'Export Successful',
        `Exported ${exported.domains.length} domains`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error exporting domains:', error);
      Alert.alert('Error', 'Failed to export domains');
    }
  };

  const filteredDomains = trustedDomains.filter(domain =>
    domain.domain.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderDomainItem = ({ item }: { item: TrustedDomain }) => (
    <View style={[styles.domainItem, { backgroundColor: theme.surface }]}>
      <View style={styles.domainInfo}>
        <View style={styles.domainHeader}>
          <Ionicons
            name={item.verified ? 'shield-checkmark' : 'shield-outline'}
            size={20}
            color={item.verified ? theme.success : theme.warning}
          />
          <Text style={[styles.domainText, { color: theme.text }]}>
            {item.domain}
          </Text>
        </View>
        <Text style={[styles.domainDate, { color: theme.textSecondary }]}>
          Added: {new Date(item.addedAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.domainActions}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleVerifyDomain(item.domain)}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={24}
            color={theme.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleRemoveDomain(item.domain)}
        >
          <Ionicons name="trash-outline" size={24} color={theme.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSettingsTab = () => (
    <AutofillSettingsPanel
      onSettingsChange={settings => {
        console.log('Settings changed:', settings);
      }}
    />
  );

  const renderDomainsTab = () => (
    <View style={styles.tabContent}>
      {/* Add Domain Section */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Add Trusted Domain
          </Text>
        </View>
        <View style={styles.addDomainContainer}>
          <TextInput
            style={[
              styles.domainInput,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="example.com"
            placeholderTextColor={theme.textSecondary}
            value={newDomain}
            onChangeText={setNewDomain}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={handleAddDomain}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          Add domains you trust to allow autofill without verification prompts.
        </Text>
      </View>

      {/* Search Section */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={theme.textSecondary}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search domains..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Domains List */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" size={24} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Trusted Domains ({filteredDomains.length})
          </Text>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportDomains}
          >
            <Ionicons name="download-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : filteredDomains.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={48}
              color={theme.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {searchQuery
                ? 'No domains match your search'
                : 'No trusted domains yet'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDomains}
            renderItem={renderDomainItem}
            keyExtractor={item => item.domain}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );

  const renderStatisticsTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="stats-chart-outline"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Autofill Statistics
          </Text>
        </View>
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          Detailed statistics are available in the Settings tab.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color={theme.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Autofill Management
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: theme.textSecondary }]}
            >
              Configure autofill settings and trusted domains
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'settings' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={
              activeTab === 'settings' ? theme.primary : theme.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'settings'
                    ? theme.primary
                    : theme.textSecondary,
              },
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'domains' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('domains')}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={
              activeTab === 'domains' ? theme.primary : theme.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'domains' ? theme.primary : theme.textSecondary,
              },
            ]}
          >
            Domains
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'statistics' && {
              borderBottomColor: theme.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('statistics')}
        >
          <Ionicons
            name="stats-chart-outline"
            size={20}
            color={
              activeTab === 'statistics' ? theme.primary : theme.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === 'statistics'
                    ? theme.primary
                    : theme.textSecondary,
              },
            ]}
          >
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.scrollView}>
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'domains' && renderDomainsTab()}
        {activeTab === 'statistics' && renderStatisticsTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  addDomainContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  domainInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  domainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  domainInfo: {
    flex: 1,
  },
  domainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  domainText: {
    fontSize: 16,
    fontWeight: '500',
  },
  domainDate: {
    fontSize: 12,
    marginLeft: 28,
  },
  domainActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  exportButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
  },
});

export default AutofillManagementScreen;
