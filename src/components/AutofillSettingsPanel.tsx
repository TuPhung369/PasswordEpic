/**
 * AutofillSettingsPanel Component
 *
 * Settings panel for managing autofill functionality.
 * Provides controls for enabling/disabling autofill, configuring security options,
 * and managing trusted domains.
 *
 * Features:
 * - Enable/disable autofill service
 * - Biometric authentication toggle
 * - Subdomain matching settings
 * - Auto-submit configuration
 * - Trusted domains management
 * - Autofill statistics display
 *
 * @author PasswordEpic Team
 * @since Week 9 - Phase 4
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  AppState,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { autofillService } from '../services/autofillService';
import { domainVerificationService } from '../services/domainVerificationService';

interface AutofillSettings {
  enabled: boolean;
  requireBiometric: boolean;
  allowSubdomains: boolean;
  autoSubmit: boolean;
}

interface AutofillStatistics {
  totalFills: number;
  totalSaves: number;
  blockedPhishing: number;
  lastUsed: string;
}

interface AutofillSettingsPanelProps {
  onSettingsChange?: (settings: AutofillSettings) => void;
}

export const AutofillSettingsPanel: React.FC<AutofillSettingsPanelProps> = ({
  onSettingsChange,
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [settings, setSettings] = useState<AutofillSettings>({
    enabled: true,
    requireBiometric: true,
    allowSubdomains: true,
    autoSubmit: false,
  });
  const [statistics, setStatistics] = useState<AutofillStatistics>({
    totalFills: 0,
    totalSaves: 0,
    blockedPhishing: 0,
    lastUsed: '',
  });
  const [trustedDomainsCount, setTrustedDomainsCount] = useState(0);

  // Track app state to detect when user returns from settings
  const appStateRef = useRef(AppState.currentState);
  const isCheckingAutofillRef = useRef(false);

  // Load initial data
  useEffect(() => {
    loadAutofillData();
  }, []);

  // Listen for app state changes to detect when user returns from settings
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [isEnabled]);

  const handleAppStateChange = async (state: string) => {
    if (state === 'active' && isCheckingAutofillRef.current) {
      console.log('📱 App returned to foreground - checking autofill status');
      // Give system a moment to process the settings change
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const enabled = await autofillService.isEnabled();
        if (enabled !== isEnabled) {
          console.log(
            `✅ Autofill status changed: ${enabled ? 'Enabled' : 'Disabled'}`,
          );
          setIsEnabled(enabled);

          if (enabled) {
            Alert.alert(
              '✅ Success',
              'Autofill has been enabled! You can now use PasswordEpic to fill credentials.',
            );
          }
        }
      } catch (error) {
        console.error('Error checking autofill status on app return:', error);
      } finally {
        isCheckingAutofillRef.current = false;
      }
    }
  };

  const loadAutofillData = async () => {
    try {
      setLoading(true);

      // Check if autofill is supported
      const supported = await autofillService.isSupported();
      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      // Check if autofill is enabled
      const enabled = await autofillService.isEnabled();
      setIsEnabled(enabled);

      // Load settings
      const loadedSettings = await autofillService.getSettings();
      setSettings(loadedSettings);

      // Load statistics
      const stats = await autofillService.getStatistics();
      setStatistics(stats);

      // Load trusted domains count
      const domains = await domainVerificationService.getTrustedDomains();
      setTrustedDomainsCount(domains.length);
    } catch (error) {
      console.error('Error loading autofill data:', error);
      Alert.alert('Error', 'Failed to load autofill settings');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableAutofill = async () => {
    try {
      if (isEnabled) {
        // Disable autofill
        Alert.alert(
          'Disable Autofill',
          'To disable autofill, open your Phone Settings.\n\nFor Pixel phones:\nSettings > System > Languages & input > Advanced > Input assistance > Autofill service\n\nFor other devices:\nSettings > System > Languages & input > Autofill service',
          [{ text: 'OK' }],
        );
      } else {
        // Enable autofill - open settings
        console.log('🎯 Opening autofill settings...');
        const success = await autofillService.requestEnable();

        if (success) {
          // Mark that we're waiting for user to return from settings
          isCheckingAutofillRef.current = true;

          // Show user-friendly message with instructions
          Alert.alert(
            '📱 Settings Opened',
            'Please select "PasswordEpic" as your Autofill service in Settings.\n\nWhen done, return to the app and we\'ll verify the setting.',
            [
              {
                text: "I've enabled it",
                onPress: async () => {
                  console.log('👤 User confirmed they enabled autofill');
                  // Wait a bit then check status with retries
                  await checkAutofillStatusWithRetry();
                },
              },
              {
                text: 'Cancel',
                onPress: () => {
                  isCheckingAutofillRef.current = false;
                },
                style: 'cancel',
              },
            ],
            { cancelable: false },
          );
        } else {
          console.warn('⚠️ Failed to open autofill settings');
          Alert.alert(
            'Error',
            'Failed to open autofill settings. Please try again.',
          );
        }
      }
    } catch (error) {
      console.error('Error toggling autofill:', error);
      Alert.alert('Error', 'Failed to toggle autofill service');
      isCheckingAutofillRef.current = false;
    }
  };

  const checkAutofillStatusWithRetry = async () => {
    try {
      // Retry up to 3 times with increasing delays
      for (let attempt = 1; attempt <= 3; attempt++) {
        // Wait longer on each retry
        const delayMs = attempt * 1500;
        console.log(
          `⏳ Autofill check attempt ${attempt}/3 (waiting ${delayMs}ms)...`,
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const enabled = await autofillService.isEnabled();
        console.log(`   Result: ${enabled ? 'Enabled ✅' : 'Disabled ❌'}`);

        if (enabled) {
          setIsEnabled(true);
          Alert.alert(
            '✅ Success!',
            'Autofill has been enabled successfully. You can now use PasswordEpic to automatically fill credentials in apps and websites.',
          );
          return;
        }
      }

      // If still not enabled after retries, show help message
      console.warn('⚠️ Autofill still not enabled after 3 attempts');
      Alert.alert(
        '⏳ Still Checking',
        'Autofill hasn\'t been enabled yet. Please make sure to select "PasswordEpic" in Settings > System > Autofill service and return to the app.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error during autofill status retry:', error);
      Alert.alert('Error', 'Failed to verify autofill status');
    }
  };

  const handleSettingChange = async (
    key: keyof AutofillSettings,
    value: boolean,
  ) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      // Update settings
      await autofillService.updateSettings(newSettings);

      // Notify parent
      onSettingsChange?.(newSettings);
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting');
      // Revert change
      setSettings(settings);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Autofill Cache',
      'This will clear all cached autofill data. You will need to prepare credentials again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await autofillService.clearCache();
              Alert.alert('Success', 'Autofill cache cleared');
              loadAutofillData();
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ],
    );
  };

  const handleManageTrustedDomains = () => {
    // Navigate to trusted domains management screen
    Alert.alert(
      'Trusted Domains',
      `You have ${trustedDomainsCount} trusted domains configured.`,
      [{ text: 'OK' }],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!isSupported) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.unsupportedContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          <Text style={[styles.unsupportedTitle, { color: theme.text }]}>
            Autofill Not Supported
          </Text>
          <Text
            style={[styles.unsupportedText, { color: theme.textSecondary }]}
          >
            Autofill requires Android 8.0 (API 26) or higher.
          </Text>
          <Text
            style={[styles.unsupportedText, { color: theme.textSecondary }]}
          >
            Your device is running Android {Platform.Version}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Status Section */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name={isEnabled ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color={isEnabled ? theme.success : theme.error}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Autofill Status
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>
            Service Status
          </Text>
          <View style={styles.statusBadge}>
            <Text
              style={[
                styles.statusText,
                { color: isEnabled ? theme.success : theme.error },
              ]}
            >
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: isEnabled ? theme.error : theme.primary,
            },
          ]}
          onPress={handleEnableAutofill}
        >
          <Text style={styles.buttonText}>
            {isEnabled ? 'Disable Autofill' : 'Enable Autofill'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Section */}
      {isEnabled && (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Autofill Settings
            </Text>
          </View>

          {/* Require Biometric */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Require Biometric
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: theme.textSecondary },
                ]}
              >
                Require biometric authentication before autofill
              </Text>
            </View>
            <Switch
              value={settings.requireBiometric}
              onValueChange={value =>
                handleSettingChange('requireBiometric', value)
              }
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.surface}
            />
          </View>

          {/* Allow Subdomains */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Allow Subdomains
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: theme.textSecondary },
                ]}
              >
                Match credentials for subdomains (e.g., mail.example.com)
              </Text>
            </View>
            <Switch
              value={settings.allowSubdomains}
              onValueChange={value =>
                handleSettingChange('allowSubdomains', value)
              }
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.surface}
            />
          </View>

          {/* Auto Submit */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>
                Auto Submit
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: theme.textSecondary },
                ]}
              >
                Automatically submit forms after autofill
              </Text>
            </View>
            <Switch
              value={settings.autoSubmit}
              onValueChange={value => handleSettingChange('autoSubmit', value)}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.surface}
            />
          </View>
        </View>
      )}

      {/* Statistics Section */}
      {isEnabled && (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="stats-chart-outline"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Statistics
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {statistics.totalFills}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Total Fills
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.success }]}>
                {statistics.totalSaves}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Saved Credentials
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.error }]}>
                {statistics.blockedPhishing}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Blocked Phishing
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.warning }]}>
                {trustedDomainsCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Trusted Domains
              </Text>
            </View>
          </View>

          {statistics.lastUsed && (
            <Text style={[styles.lastUsedText, { color: theme.textSecondary }]}>
              Last used: {new Date(statistics.lastUsed).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {/* Management Section */}
      {isEnabled && (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="construct-outline"
              size={24}
              color={theme.primary}
            />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Management
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: theme.border }]}
            onPress={handleManageTrustedDomains}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={theme.primary}
            />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              Manage Trusted Domains
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: theme.border }]}
            onPress={handleClearCache}
          >
            <Ionicons name="trash-outline" size={20} color={theme.error} />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              Clear Autofill Cache
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Help Section */}
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="help-circle-outline"
            size={24}
            color={theme.primary}
          />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Help & Information
          </Text>
        </View>
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          Autofill allows PasswordEpic to automatically fill your credentials in
          apps and websites. Your passwords are encrypted and require biometric
          authentication before being filled.
        </Text>
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          To use autofill, enable the service above and grant the necessary
          permissions. PasswordEpic will detect login forms and offer to fill
          your credentials securely.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
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
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  lastUsedText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  unsupportedTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  unsupportedText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});

export default AutofillSettingsPanel;
