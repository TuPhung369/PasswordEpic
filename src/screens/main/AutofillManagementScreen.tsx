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
  const [cleanDomain, setCleanDomain] = useState('');
  const [showCleanDomainPreview, setShowCleanDomainPreview] = useState(false);
  const [popularDomainsExpanded, setPopularDomainsExpanded] = useState(false);
  const [userAddedDomainsExpanded, setUserAddedDomainsExpanded] = useState(true);

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

  const initializeAndLoadDomains = async () => {
    try {
      await domainVerificationService.initializePopularDomains();
      await loadTrustedDomains();
    } catch (error) {
      console.error('Error initializing popular domains:', error);
      await loadTrustedDomains();
    }
  };

  useEffect(() => {
    initializeAndLoadDomains();
  }, []);

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



  const getPopularDomains = () => {
    return trustedDomains.filter(d => d.autoApproved);
  };

  const getUserAddedDomains = () => {
    return trustedDomains.filter(d => !d.autoApproved);
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
      {/* Compact Input Section */}
      <View style={[styles.compactSection, { backgroundColor: theme.surface }]}>
        {/* Search and Add Row */}
        <View style={styles.inputRowContainer}>
          {/* Search Input */}
          <View style={[styles.searchContainer, { flex: 1 }]}>
            <Ionicons
              name="search-outline"
              size={16}
              color={theme.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search..."
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
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Add Domain Input */}
          <View style={[styles.addDomainContainer, { flex: 1, marginLeft: 8 }]}>
            <Ionicons name="add-outline" size={16} color={theme.primary} />
            <TextInput
              style={[
                styles.addDomainInput,
                {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                  flex: 1,
                },
              ]}
              placeholder="domain.com"
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
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview of clean domain */}
        {showCleanDomainPreview && cleanDomain && (
          <View
            style={[
              styles.compactPreview,
              { backgroundColor: theme.background, borderColor: theme.primary },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={14}
              color={theme.success}
            />
            <Text style={[styles.previewDomain, { color: theme.text, flex: 1, marginLeft: 6, fontSize: 12 }]}>
              {cleanDomain}
            </Text>
          </View>
        )}
      </View>



      {/* Trusted Domains */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" size={24} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Trusted Domains ({trustedDomains.length})
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
        ) : trustedDomains.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={48}
              color={theme.textSecondary}
            />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No trusted domains yet
            </Text>
          </View>
        ) : (
          <>
            {/* Popular Domains Section */}
            {getPopularDomains().length > 0 && (
              <View style={styles.domainsSectionGroup}>
                <TouchableOpacity
                  style={styles.domainSectionHeader}
                  onPress={() => setPopularDomainsExpanded(!popularDomainsExpanded)}
                >
                  <Ionicons
                    name="star-outline"
                    size={18}
                    color={theme.primary}
                  />
                  <Text style={[styles.domainSectionTitle, { color: theme.text }]}>
                    Popular ({getPopularDomains().length})
                  </Text>
                  <Ionicons
                    name={
                      popularDomainsExpanded
                        ? 'chevron-up-outline'
                        : 'chevron-down-outline'
                    }
                    size={18}
                    color={theme.textSecondary}
                    style={styles.expandButton}
                  />
                </TouchableOpacity>

                {popularDomainsExpanded && (
                  <View>
                    <Text style={[styles.subsectionHint, { color: theme.textSecondary }]}>
                      Pre-approved domains (already verified as safe)
                    </Text>
                    <FlatList
                      data={getPopularDomains().filter(d =>
                        d.domain.toLowerCase().includes(searchQuery.toLowerCase()),
                      )}
                      renderItem={renderDomainItem}
                      keyExtractor={item => item.domain}
                      scrollEnabled={false}
                    />
                  </View>
                )}
              </View>
            )}

            {/* User Added Domains Section */}
            {getUserAddedDomains().length > 0 && (
              <View style={styles.domainsSectionGroup}>
                <TouchableOpacity
                  style={styles.domainSectionHeader}
                  onPress={() => setUserAddedDomainsExpanded(!userAddedDomainsExpanded)}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={theme.primary}
                  />
                  <Text style={[styles.domainSectionTitle, { color: theme.text }]}>
                    User Added ({getUserAddedDomains().length})
                  </Text>
                  <Ionicons
                    name={
                      userAddedDomainsExpanded
                        ? 'chevron-up-outline'
                        : 'chevron-down-outline'
                    }
                    size={18}
                    color={theme.textSecondary}
                    style={styles.expandButton}
                  />
                </TouchableOpacity>

                {userAddedDomainsExpanded && (
                  <View>
                    <Text style={[styles.subsectionHint, { color: theme.textSecondary }]}>
                      Domains you manually added
                    </Text>
                    <FlatList
                      data={getUserAddedDomains().filter(d =>
                        d.domain.toLowerCase().includes(searchQuery.toLowerCase()),
                      )}
                      renderItem={renderDomainItem}
                      keyExtractor={item => item.domain}
                      scrollEnabled={false}
                    />
                  </View>
                )}
              </View>
            )}
          </>
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
  compactSection: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: 6,
  },
  inputRowContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addDomainInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
  },
  compactPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
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
    padding: 12,
  },
  section: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  addDomainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  domainInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  domainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  domainInfo: {
    flex: 1,
  },
  domainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  domainText: {
    fontSize: 15,
    fontWeight: '500',
  },
  domainDate: {
    fontSize: 11,
    marginLeft: 24,
  },
  domainActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    padding: 3,
  },
  exportButton: {
    padding: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 10,
  },
  helpText: {
    fontSize: 11,
    lineHeight: 16,
  },
  domainsSectionGroup: {
    marginBottom: 12,
  },
  domainSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 6,
  },
  domainSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  subsectionHint: {
    fontSize: 11,
    marginBottom: 6,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  suggestedDomainsList: {
    marginBottom: 12,
  },
  suggestedDomainListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  suggestedDomainListText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
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
