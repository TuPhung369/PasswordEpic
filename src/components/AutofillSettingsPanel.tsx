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

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { accessibilityService } from '../services/accessibilityService';
import { domainVerificationService } from '../services/domainVerificationService';
import { useAccessibility } from '../hooks/useAccessibility';

interface AutofillSettings {
  enabled: boolean;
  requireBiometric: boolean;
  allowSubdomains: boolean;
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
  const accessibility = useAccessibility();
  const [loading, setLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [accessibilityLoading, setAccessibilityLoading] = useState(false);
  const isCheckingAccessibilityRef = useRef(false);
  const [settings, setSettings] = useState<AutofillSettings>({
    enabled: true,
    requireBiometric: true,
    allowSubdomains: true,
  });
  const [statistics, setStatistics] = useState<AutofillStatistics>({
    totalFills: 0,
    totalSaves: 0,
    blockedPhishing: 0,
    lastUsed: '',
  });
  const [trustedDomainsCount, setTrustedDomainsCount] = useState(0);

  // Track app state to detect when user returns from settings
  const isCheckingAutofillRef = useRef(false);
  const [biometricVerifying, setBiometricVerifying] = useState(false);

  const handleAppStateChange = useCallback(
    async (state: string) => {
      if (state === 'active' && (isCheckingAutofillRef.current || isCheckingAccessibilityRef.current)) {
        console.log('📱 App returned to foreground - checking settings status');
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          if (isCheckingAutofillRef.current) {
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
            isCheckingAutofillRef.current = false;
          }

          if (isCheckingAccessibilityRef.current) {
            const enabled = await accessibilityService.isEnabled();
            if (enabled !== accessibility.isEnabled) {
              console.log(
                `✅ Accessibility status changed: ${enabled ? 'Enabled' : 'Disabled'}`,
              );
              
              if (enabled) {
                Alert.alert(
                  '✅ Success',
                  'Accessibility service has been enabled! You can now use PasswordEpic accessibility features.',
                );
              }
              await accessibility.checkAccessibility();
            }
            isCheckingAccessibilityRef.current = false;
            setAccessibilityLoading(false);
          }
        } catch (error) {
          console.error('Error checking settings status on app return:', error);
          setAccessibilityLoading(false);
        } finally {
          isCheckingAutofillRef.current = false;
          isCheckingAccessibilityRef.current = false;
        }
      }
    },
    [isEnabled, accessibility],
  );

  const loadAutofillData = useCallback(async () => {
    try {
      setLoading(true);

      const supported = await autofillService.isSupported();
      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      const enabled = await autofillService.isEnabled();
      setIsEnabled(enabled);

      const loadedSettings = await autofillService.getSettings();
      setSettings(loadedSettings);

      const stats = await autofillService.getStatistics();
      setStatistics(stats);

      const domains = await domainVerificationService.getTrustedDomains();
      setTrustedDomainsCount(domains.length);
    } catch (error) {
      console.error('Error loading autofill data:', error);
      Alert.alert('Error', 'Failed to load autofill settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccessibilityData = useCallback(async () => {
    try {
      await accessibility.checkAccessibility();
    } catch (error) {
      console.error('Error loading accessibility data:', error);
    }
  }, [accessibility]);

  useEffect(() => {
    loadAutofillData();
    loadAccessibilityData();
  }, [loadAutofillData, loadAccessibilityData]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  const handleEnableAutofill = async () => {
    console.log('🔵 [DEBUG] handleEnableAutofill called, isEnabled:', isEnabled);
    try {
      if (isEnabled) {
        // Autofill is enabled - user wants to DISABLE it
        console.log('🔴 User wants to disable autofill');
        await handleDisableAutofill();
      } else {
        // Autofill is disabled - user wants to ENABLE it
        console.log('🟢 User wants to enable autofill');
        await handleEnableAutofillFlow();
      }
    } catch (error) {
      console.error('Error in handleEnableAutofill:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      Alert.alert('Error', 'Failed to toggle autofill service');
      isCheckingAutofillRef.current = false;
    }
  };

  const handleEnableAutofillFlow = async () => {
    try {
      console.log('🎯 Opening autofill service selection...');
      setBiometricVerifying(true);

      // Mark that we're waiting for user to return from settings
      isCheckingAutofillRef.current = true;

      const deviceInstructions = Platform.select({
        android: () => {
          const manufacturer = (Platform.constants as any)?.Manufacturer?.toUpperCase() || '';
          
          if (manufacturer.includes('SAMSUNG')) {
            return {
              title: '📱 Enable Autofill on Samsung',
              message: 'Follow these steps:\n\n' +
                '1. In Settings, tap "General management"\n' +
                '2. Tap "Language and input"\n' +
                '3. Tap "Autofill service"\n' +
                '4. Select "PasswordEpic"\n' +
                '5. Return to this app\n\n' +
                'Note: You may need to disable Samsung Pass first.',
            };
          } else if (manufacturer.includes('HUAWEI')) {
            return {
              title: '📱 Enable Autofill on Huawei',
              message: 'Follow these steps:\n\n' +
                '1. In Settings, tap "System"\n' +
                '2. Tap "Languages & input"\n' +
                '3. Tap "More input settings"\n' +
                '4. Tap "Autofill service"\n' +
                '5. Select "PasswordEpic"\n' +
                '6. Return to this app',
            };
          } else {
            return {
              title: '📱 Enable Autofill',
              message: 'Follow these steps:\n\n' +
                '1. In Settings, look for "Autofill service"\n' +
                '2. Select "PasswordEpic" from the list\n' +
                '3. Return to this app\n\n' +
                'Common paths:\n' +
                '• Settings → System → Languages & input → Autofill\n' +
                '• Settings → Apps → Default apps → Autofill',
            };
          }
        },
        default: () => ({
          title: '📱 Enable Autofill',
          message: 'Please select "PasswordEpic" as your Autofill service in Settings.',
        }),
      })();

      // Show device-specific instructions FIRST, then open settings when user confirms
      Alert.alert(
        deviceInstructions.title,
        deviceInstructions.message,
        [
          {
            text: 'Open Settings',
            onPress: async () => {
              console.log('👤 User confirmed - opening settings now...');
              
              try {
                console.log('📞 Calling autofillService.requestEnable()...');
                const success = await autofillService.requestEnable();
                console.log('📞 requestEnable returned:', success);

                if (!success) {
                  console.warn('⚠️ requestEnable returned false');
                  Alert.alert(
                    'Error',
                    "Failed to open autofill settings. Please manually enable it following the instructions above.",
                  );
                  isCheckingAutofillRef.current = false;
                }
              } catch (bridgeError) {
                console.error(
                  '❌ Error calling autofillService.requestEnable:',
                  bridgeError,
                );
                Alert.alert(
                  'Error Opening Settings',
                  'Failed to open autofill settings. Please manually enable it following the instructions above.',
                );
                isCheckingAutofillRef.current = false;
              }
            },
          },
          {
            text: 'Cancel',
            onPress: () => {
              console.log('❌ User cancelled autofill setup');
              isCheckingAutofillRef.current = false;
            },
            style: 'cancel',
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error('Error in handleEnableAutofillFlow:', error);
      throw error;
    } finally {
      setBiometricVerifying(false);
    }
  };

  const handleDisableAutofill = async () => {
    try {
      console.log('🔴 Opening autofill disable settings...');

      try {
        console.log('📞 Calling autofillService.requestDisable()...');
        const result = await autofillService.requestDisable();
        console.log('📞 requestDisable returned:', result);
        console.log('📞 Result type:', typeof result);
        console.log('📞 Result is object:', typeof result === 'object');

        // Handle both old format (boolean) and new format (object with instructions)
        const success = typeof result === 'boolean' ? result : result?.success;
        const instructions =
          typeof result === 'object' ? result?.instructions : null;
        const error = typeof result === 'object' ? result?.error : null;

        console.log('📞 Parsed values:', { success, instructions, error });

        // Mark that we're waiting for user to return from settings
        isCheckingAutofillRef.current = true;

        // Prepare the message with OEM-specific instructions or generic message
        const messageText = instructions
          ? `${
              error ? error + '\n\n' : ''
            }Follow these steps for your device:\n\n${instructions}`
          : 'Please select "None" or another autofill service to disable PasswordEpic as your autofill provider.\n\nSteps:\n1. Look for "Autofill service" or "Autofill" option\n2. Select "None" or another autofill service\n3. Return to the app when done';

        console.log('📞 Prepared message text');
        console.log('📞 NOW showing Alert.alert');

        // Show user-friendly message with OEM-specific or generic instructions
        // Intent will be opened when user confirms, AFTER alert is visible
        Alert.alert(
          '🔧 Disable Autofill',
          messageText,
          [
            {
              text: "I've disabled it",
              onPress: async () => {
                console.log('� User confirmed they disabled autofill');

                // NOW open the autofill settings intent
                // App will go to background here
                console.log('🔧 Opening autofill settings intent now...');
                try {
                  await autofillService.openAutofillSettingsNow();
                  console.log('✅ Settings intent opened successfully');
                } catch (settingsError) {
                  console.error('❌ Failed to open settings:', settingsError);
                }

                // Wait a bit then check status with retries
                await checkAutofillDisableStatusWithRetry();
              },
            },
            {
              text: 'Cancel',
              onPress: () => {
                console.log('❌ User cancelled autofill disable');
                isCheckingAutofillRef.current = false;
              },
              style: 'cancel',
            },
          ],
          { cancelable: false },
        );

        console.log('📞 Alert.alert called successfully');
      } catch (bridgeError) {
        console.error(
          '❌ Error calling autofillService.requestDisable:',
          bridgeError,
        );
        console.error('Error details:', {
          message:
            bridgeError instanceof Error
              ? bridgeError.message
              : String(bridgeError),
          stack: bridgeError instanceof Error ? bridgeError.stack : undefined,
        });

        Alert.alert(
          'Error Opening Settings',
          'Failed to open autofill settings.\n\nPlease manually disable it:\n\n1. Go to Settings\n2. Look for "Languages and input" or "Input methods"\n3. Find "Autofill service" or "Autofill"\n4. Select "None"',
        );
      }
    } catch (error) {
      console.error('Error in handleDisableAutofill:', error);
      throw error;
    }
  };

  const checkAutofillDisableStatusWithRetry = async () => {
    try {
      // Retry up to 3 times with increasing delays
      for (let attempt = 1; attempt <= 3; attempt++) {
        // Wait longer on each retry
        const delayMs = attempt * 1500;
        console.log(
          `⏳ Autofill disable check attempt ${attempt}/3 (waiting ${delayMs}ms)...`,
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const enabled = await autofillService.isEnabled();
        console.log(`   Result: ${enabled ? 'Enabled ❌' : 'Disabled ✅'}`);

        if (!enabled) {
          setIsEnabled(false);
          Alert.alert(
            '✅ Success!',
            'Autofill has been disabled successfully. PasswordEpic is no longer your autofill service.',
          );
          return;
        }
      }

      // If still enabled after retries, show help message
      console.warn('⚠️ Autofill still enabled after 3 attempts');
      Alert.alert(
        '⏳ Still Checking',
        'Autofill is still enabled. Please make sure to select "None" or another service in Settings > System > Autofill service and return to the app.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error during autofill disable check retry:', error);
      Alert.alert('Error', 'Failed to verify autofill disable status');
    }
  };

  const handleDisableAccessibility = async () => {
    try {
      console.log('🔴 Opening accessibility disable settings...');

      try {
        console.log('📞 Calling accessibilityService.requestDisable()...');
        const result = await accessibilityService.requestDisable();
        console.log('📞 requestDisable returned:', result);
        console.log('📞 Result type:', typeof result);
        console.log('📞 Result is object:', typeof result === 'object');

        const success = typeof result === 'boolean' ? result : result?.success;
        const instructions =
          typeof result === 'object' ? result?.instructions : null;
        const error = typeof result === 'object' ? result?.error : null;

        console.log('📞 Parsed values:', { success, instructions, error });

        isCheckingAccessibilityRef.current = true;

        const messageText = instructions
          ? `${
              error ? error + '\n\n' : ''
            }Follow these steps for your device:\n\n${instructions}`
          : 'Please disable PasswordEpic in your accessibility settings.\n\nSteps:\n1. Go to Settings > Accessibility\n2. Find "PasswordEpic" in the list\n3. Toggle it OFF\n4. Return to the app when done';

        console.log('📞 Prepared message text');
        console.log('📞 NOW showing Alert.alert');

        Alert.alert(
          '🔧 Disable Accessibility',
          messageText,
          [
            {
              text: "I've disabled it",
              onPress: async () => {
                console.log('✅ User confirmed they disabled accessibility');

                console.log('🔧 Opening accessibility settings intent now...');
                try {
                  await accessibilityService.openAccessibilitySettingsNow();
                  console.log('✅ Settings intent opened successfully');
                } catch (settingsError) {
                  console.error('❌ Failed to open settings:', settingsError);
                }

                await checkAccessibilityDisableStatusWithRetry();
              },
            },
            {
              text: 'Cancel',
              onPress: () => {
                console.log('❌ User cancelled accessibility disable');
                isCheckingAccessibilityRef.current = false;
                setAccessibilityLoading(false);
              },
              style: 'cancel',
            },
          ],
          { cancelable: false },
        );

        console.log('📞 Alert.alert called successfully');
      } catch (bridgeError) {
        console.error(
          '❌ Error calling accessibilityService.requestDisable:',
          bridgeError,
        );
        console.error('Error details:', {
          message:
            bridgeError instanceof Error
              ? bridgeError.message
              : String(bridgeError),
          stack: bridgeError instanceof Error ? bridgeError.stack : undefined,
        });

        Alert.alert(
          'Error Opening Settings',
          'Failed to open accessibility settings.\n\nPlease manually disable it:\n\n1. Go to Settings\n2. Look for "Accessibility"\n3. Find "PasswordEpic"\n4. Toggle it OFF',
        );
      }
    } catch (error) {
      console.error('Error in handleDisableAccessibility:', error);
      throw error;
    } finally {
      setAccessibilityLoading(false);
    }
  };

  const checkAccessibilityDisableStatusWithRetry = async () => {
    try {
      // Retry up to 3 times with increasing delays
      for (let attempt = 1; attempt <= 3; attempt++) {
        const delayMs = attempt * 1500;
        console.log(
          `⏳ Accessibility disable check attempt ${attempt}/3 (waiting ${delayMs}ms)...`,
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));

        const enabled = await accessibilityService.isEnabled();
        console.log(`   Result: ${enabled ? 'Enabled ❌' : 'Disabled ✅'}`);

        if (!enabled) {
          await accessibility.checkAccessibility();
          Alert.alert(
            '✅ Success!',
            'Accessibility has been disabled successfully. PasswordEpic is no longer your accessibility service.',
          );
          return;
        }
      }

      console.warn('⚠️ Accessibility still enabled after 3 attempts');
      Alert.alert(
        '⏳ Still Checking',
        'Accessibility is still enabled. Please make sure to toggle OFF PasswordEpic in Settings > Accessibility and return to the app.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error during accessibility disable check retry:', error);
      Alert.alert('Error', 'Failed to verify accessibility disable status');
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

  const buttonStyle = {
    backgroundColor: isEnabled ? theme.error : theme.primary,
    opacity: biometricVerifying ? 0.6 : 1,
  };

  const accessibilityButtonStyle = {
    backgroundColor: accessibility.isEnabled ? theme.error : theme.primary,
    opacity: accessibilityLoading ? 0.6 : 1,
  };

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
          style={[styles.button, buttonStyle]}
          onPress={handleEnableAutofill}
          disabled={biometricVerifying}
        >
          {biometricVerifying ? (
            <ActivityIndicator color={theme.surface} size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {isEnabled ? 'Disable Autofill' : 'Enable Autofill'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Accessibility Status Section */}
      {accessibility.isSupported && (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name={accessibility.isEnabled ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={accessibility.isEnabled ? theme.success : theme.error}
            />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Accessibility Status
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
                  { color: accessibility.isEnabled ? theme.success : theme.error },
                ]}
              >
                {accessibility.isEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              accessibilityButtonStyle,
            ]}
            onPress={async () => {
              try {
                if (accessibility.isEnabled) {
                  await handleDisableAccessibility();
                } else {
                  Alert.alert(
                    'Enable Accessibility Service',
                    'In the next screen:\n\n' +
                    '1️⃣ Tap "Accessibility"\n' +
                    '2️⃣ Scroll down to "Downloaded apps"\n' +
                    '3️⃣ Find "PasswordEpic Autofill Refill"\n' +
                    '4️⃣ Tap it\n' +
                    '5️⃣ Toggle "Use PasswordEpic" ON\n\n' +
                    '✓ We\'ll auto-detect when you return',
                    [
                      { text: 'Cancel', style: 'cancel', onPress: () => {} },
                      {
                        text: 'Open Settings',
                        onPress: async () => {
                          setAccessibilityLoading(true);
                          isCheckingAccessibilityRef.current = true;
                          
                          try {
                            await accessibilityService.requestEnable();
                          } catch (error) {
                            console.error('Error opening accessibility settings:', error);
                            Alert.alert(
                              'Error',
                              'Failed to open settings. Open manually: Settings → Accessibility → PasswordEpic Autofill Refill',
                            );
                            isCheckingAccessibilityRef.current = false;
                            setAccessibilityLoading(false);
                          }
                        },
                      },
                    ]
                  );
                }
              } catch (error) {
                console.error('Error handling accessibility toggle:', error);
                setAccessibilityLoading(false);
              }
            }}
            disabled={accessibilityLoading}
          >
            {accessibilityLoading ? (
              <ActivityIndicator color={theme.surface} size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {accessibility.isEnabled ? 'Disable Accessibility' : 'Enable Accessibility'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

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
