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

import React, { useState, useEffect } from 'react';
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
import { domainVerificationService } from '../../services/domainVerificationService';
import AutofillSettingsPanel from '../../components/AutofillSettingsPanel';
import { AutofillStatisticsPanel } from '../../components/AutofillStatisticsPanel';
import { DEFAULT_DOMAINS } from '../../constants/defaultDomains';

interface TrustedDomain {
  domain: string;
  addedAt: number;
  lastUsed: number;
  useCount: number;
  autoApproved: boolean;
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
  const [suggestedDomainsExpanded, setSuggestedDomainsExpanded] =
    useState(false);
  const [cleanDomain, setCleanDomain] = useState('');
  const [showCleanDomainPreview, setShowCleanDomainPreview] = useState(false);

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
      const clean = domainVerificationService.extractCleanDomain(
        newDomain.trim(),
      );

      // Validate the extracted domain
      if (!clean || clean.length === 0) {
        Alert.alert(
          'Error',
          'Invalid domain format. Please enter a valid domain.',
        );
        clearInputField();
        return;
      }

      // Check if domain exists in trusted domains
      const existsInTrusted = trustedDomains.some(
        d => d.domain.toLowerCase() === clean.toLowerCase(),
      );

      if (existsInTrusted) {
        Alert.alert(
          'Already Added',
          `${clean} is already in your trusted domains`,
        );
        clearInputField();
        return;
      }

      // Check if domain exists in popular/suggested domains
      const existsInPopular = DEFAULT_DOMAINS.some(
        d => d.toLowerCase() === clean.toLowerCase(),
      );

      if (existsInPopular) {
        Alert.alert(
          'Popular Domain',
          `${clean} is already available in our suggested domains list.\n\nClick the "+" button next to it to add it.`,
        );
        clearInputField();
        return;
      }

      // Show confirmation if user entered something different from clean domain
      // (e.g., URL with protocol, path, port)
      const userInput = newDomain.trim();
      if (userInput !== clean) {
        // Show confirmation dialog showing what was entered vs what will be saved
        Alert.alert(
          'Confirm Domain',
          `You entered: ${userInput}\n\nWill save as: ${clean}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add',
              onPress: async () => {
                await performAddDomain(clean);
              },
            },
          ],
        );
      } else {
        // User entered exactly what we'll save, no confirmation needed
        await performAddDomain(clean);
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      Alert.alert('Error', 'Failed to add domain');
      clearInputField();
    }
  };

  const clearInputField = () => {
    setNewDomain('');
    setCleanDomain('');
    setShowCleanDomainPreview(false);
  };

  const performAddDomain = async (domainToAdd: string) => {
    try {
      const success = await domainVerificationService.addTrustedDomain(
        domainToAdd,
      );
      if (success) {
        clearInputField();
        loadTrustedDomains();
        Alert.alert('Success', `${domainToAdd} added to trusted list`);
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      Alert.alert('Error', 'Failed to add domain');
      clearInputField();
    }
  };

  const handleDomainInputChange = (text: string) => {
    setNewDomain(text);
    if (text.trim()) {
      const clean = domainVerificationService.extractCleanDomain(text.trim());
      setCleanDomain(clean);
      setShowCleanDomainPreview(text.trim() !== clean);
    } else {
      setCleanDomain('');
      setShowCleanDomainPreview(false);
    }
  };

  const handleAddSuggestedDomain = async (domain: string) => {
    // Check if domain already exists
    const alreadyExists = trustedDomains.some(
      d => d.domain.toLowerCase() === domain.toLowerCase(),
    );

    if (alreadyExists) {
      Alert.alert(
        'Already Added',
        `${domain} is already in your trusted domains`,
      );
      return;
    }

    try {
      const success = await domainVerificationService.addTrustedDomain(domain);
      if (success) {
        loadTrustedDomains();
        Alert.alert('Success', `${domain} added to trusted list`);
      }
    } catch (error) {
      console.error('Error adding suggested domain:', error);
      Alert.alert('Error', `Failed to add ${domain}`);
    }
  };

  // Get suggested domains that haven't been added yet
  const getAvailableSuggestedDomains = () => {
    const addedDomains = trustedDomains.map(d => d.domain.toLowerCase());
    return DEFAULT_DOMAINS.filter(
      domain => !addedDomains.includes(domain.toLowerCase()),
    );
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
      await domainVerificationService.exportTrustedDomains();
      Alert.alert(
        'Export Successful',
        `Exported ${trustedDomains.length} domains`,
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
            name={item.autoApproved ? 'shield-checkmark' : 'shield-outline'}
            size={20}
            color={item.autoApproved ? theme.success : theme.warning}
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
            placeholder="example.com or https://example.com/login"
            placeholderTextColor={theme.textSecondary}
            value={newDomain}
            onChangeText={handleDomainInputChange}
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

        {/* Preview of clean domain */}
        {showCleanDomainPreview && cleanDomain && (
          <View
            style={[
              styles.cleanDomainPreview,
              { backgroundColor: theme.background, borderColor: theme.primary },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={theme.success}
              style={styles.iconMargin}
            />
            <View style={styles.flexOne}>
              <Text
                style={[styles.previewLabel, { color: theme.textSecondary }]}
              >
                Will save as:
              </Text>
              <Text style={[styles.previewDomain, { color: theme.text }]}>
                {cleanDomain}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          Add domains you trust to allow autofill without verification prompts.
          Path, port, and protocol are automatically removed.
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

      {/* Suggested Domains Section */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setSuggestedDomainsExpanded(!suggestedDomainsExpanded)}
        >
          <Ionicons name="sparkles-outline" size={24} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Popular Domains
          </Text>
          <Ionicons
            name={
              suggestedDomainsExpanded
                ? 'chevron-up-outline'
                : 'chevron-down-outline'
            }
            size={20}
            color={theme.textSecondary}
            style={styles.expandButton}
          />
        </TouchableOpacity>

        {suggestedDomainsExpanded && (
          <>
            <Text
              style={[
                styles.helpText,
                styles.helpTextMargin,
                { color: theme.textSecondary },
              ]}
            >
              Click to quickly add popular domains from major companies and
              services
            </Text>
            <View style={styles.suggestedDomainsGrid}>
              {getAvailableSuggestedDomains().map(domain => (
                <TouchableOpacity
                  key={domain}
                  style={[
                    styles.suggestedDomainTag,
                    { borderColor: theme.primary },
                  ]}
                  onPress={() => handleAddSuggestedDomain(domain)}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={14}
                    color={theme.primary}
                  />
                  <Text
                    style={[
                      styles.suggestedDomainText,
                      { color: theme.primary },
                    ]}
                  >
                    {domain}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text
              style={[
                styles.suggestedDomainsCount,
                { color: theme.textSecondary },
              ]}
            >
              {getAvailableSuggestedDomains().length} domains available
            </Text>
          </>
        )}
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
            keyExtractor={item => `${item.domain}-${item.addedAt}`}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );

  const renderStatisticsTab = () => (
    <View style={styles.tabContent}>
      <AutofillStatisticsPanel
        trustedDomainsCount={trustedDomains.length}
        onRefresh={() => {
          console.log('Statistics refreshed');
        }}
      />
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
            activeTab === 'settings' && [
              styles.tabIndicator,
              { borderBottomColor: theme.primary },
            ],
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
            activeTab === 'domains' && [
              styles.tabIndicator,
              { borderBottomColor: theme.primary },
            ],
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
            activeTab === 'statistics' && [
              styles.tabIndicator,
              { borderBottomColor: theme.primary },
            ],
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
  suggestedDomainsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  suggestedDomainTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  suggestedDomainText: {
    fontSize: 12,
    fontWeight: '500',
  },
  suggestedDomainsCount: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  cleanDomainPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  previewDomain: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconMargin: {
    marginRight: 8,
  },
  flexOne: {
    flex: 1,
  },
  tabIndicator: {
    borderBottomWidth: 2,
  },
  expandButton: {
    marginLeft: 'auto' as any,
  },
  helpTextMargin: {
    marginBottom: 12,
  },
});

export default AutofillManagementScreen;
