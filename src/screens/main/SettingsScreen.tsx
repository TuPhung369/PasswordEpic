import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import {
  updateSecuritySettings,
  setBiometricEnabled,
  setScreenProtectionEnabled,
  setSecurityChecksEnabled,
  setRootDetectionEnabled,
  setAntiTamperingEnabled,
  setMemoryProtectionEnabled,
} from '../../store/slices/settingsSlice';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ThemeSelector } from '../../components/ThemeSelector';
import { ThemeModal } from '../../components/ThemeModal';
import { AutoLockSelector } from '../../components/AutoLockSelector';
import { useTheme } from '../../contexts/ThemeContext';
import { signOut } from '../../services/authService';
import { useBiometric } from '../../hooks/useBiometric';
import { useSecurity } from '../../hooks/useSecurity';
import SecurityWarningModal from '../../components/SecurityWarningModal';
import { clearCorruptedPasswords } from '../../utils/clearCorruptedPasswords';
import { CategoryService } from '../../services/categoryService';

// Memoized SettingItem để tránh re-render
const SettingItem = React.memo<{
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  theme: any;
}>(({ icon, title, subtitle, onPress, rightElement, theme }) => (
  <TouchableOpacity
    style={[
      styles.settingItem,
      { backgroundColor: theme.card, borderColor: theme.border },
    ]}
    onPress={onPress}
  >
    <View style={[styles.settingIcon, { backgroundColor: theme.surface }]}>
      <MaterialIcons name={icon} size={24} color={theme.primary} />
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      )}
    </View>
    {rightElement || (
      <MaterialIcons
        name="chevron-right"
        size={24}
        color={theme.textSecondary}
      />
    )}
  </TouchableOpacity>
));

export const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: RootState) => state.auth);
  const { security } = useAppSelector((state: RootState) => state.settings);
  const { theme } = useTheme();
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [securityWarningVisible, setSecurityWarningVisible] = useState(false);

  // Biometric and session hooks
  const {
    isAvailable: biometricAvailable,
    biometryType,
    setupBiometric,
    disableBiometric: disableBiometricService,
  } = useBiometric();

  // Security hooks
  const {
    security: securityState,
    checkSecurity,
    enableScreenProtection,
    disableScreenProtection,
    getSecuritySummary,
  } = useSecurity();

  // Debug Redux state changes
  useEffect(() => {
    // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
    // console.log('⚙️ SettingsScreen: Redux security state:', security);
    // console.log(
    //   '⚙️ SettingsScreen: biometricEnabled =',
    //   security.biometricEnabled,
    // );
    // console.log('⚙️ SettingsScreen: biometricAvailable =', biometricAvailable);
    // console.log(
    //   '⚙️ SettingsScreen: Switch value =',
    //   security.biometricEnabled && biometricAvailable,
    // );
  }, [security, biometricAvailable]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
      // console.log('⚙️ SettingsScreen: Cleaning up...');
      // Clear any pending timeouts or intervals
      // Cancel any ongoing async operations
    };
  }, []);

  // Handler functions
  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!biometricAvailable) {
        Alert.alert(
          'Biometric Not Available',
          'Biometric authentication is not available on this device.',
          [{ text: 'OK' }],
        );
        return;
      }

      try {
        // 🔥 COMMENTED OUT FOR DEBUGGING NAVIGATION
        // console.log('⚙️ SettingsScreen: Starting biometric setup...');
        const success = await setupBiometric();
        // console.log('⚙️ SettingsScreen: Setup result:', success);

        if (success) {
          // console.log('⚙️ SettingsScreen: Setup successful, updating Redux...');
          dispatch(setBiometricEnabled(true));
          dispatch(updateSecuritySettings({ biometricEnabled: true }));
          // console.log('⚙️ SettingsScreen: Redux states updated');
        } else {
          // console.log('⚙️ SettingsScreen: Setup failed');
        }
      } catch (error) {
        // console.error('⚙️ SettingsScreen: Setup error:', error);
        Alert.alert(
          'Setup Failed',
          'Failed to setup biometric authentication. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } else {
      Alert.alert(
        'Disable Biometric',
        'Are you sure you want to disable biometric authentication?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              try {
                await disableBiometricService();
                dispatch(setBiometricEnabled(false));
                dispatch(updateSecuritySettings({ biometricEnabled: false }));
              } catch (error) {
                console.error('Failed to disable biometric:', error);
              }
            },
          },
        ],
      );
    }
  };

  const handleScreenProtectionToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await enableScreenProtection();
      if (success) {
        dispatch(setScreenProtectionEnabled(true));

        // Show warning if on emulator (Android only)
        if (Platform.OS === 'android') {
          Alert.alert(
            'Screen Protection Enabled',
            '⚠️ NOTE: Screenshot blocking does NOT work on Android emulators.\n\n' +
              'FLAG_SECURE is set correctly, but emulators bypass it for development.\n\n' +
              '✅ To test: Use a real Android device.',
            [{ text: 'OK' }],
          );
        }
      } else {
        Alert.alert(
          'Screen Protection',
          'Screen protection requires native module implementation. Feature will be available in production build.',
          [{ text: 'OK' }],
        );
      }
    } else {
      await disableScreenProtection();
      dispatch(setScreenProtectionEnabled(false));
    }
  };

  const handleSecurityChecksToggle = (enabled: boolean) => {
    dispatch(setSecurityChecksEnabled(enabled));
    if (enabled) {
      checkSecurity(true);
    }
  };

  const handleRootDetectionToggle = (enabled: boolean) => {
    dispatch(setRootDetectionEnabled(enabled));
  };

  const handleAntiTamperingToggle = (enabled: boolean) => {
    dispatch(setAntiTamperingEnabled(enabled));
  };

  const handleMemoryProtectionToggle = (enabled: boolean) => {
    dispatch(setMemoryProtectionEnabled(enabled));
  };

  const handleViewSecurityStatus = async () => {
    await checkSecurity(true);
    if (securityState.threats.length > 0) {
      setSecurityWarningVisible(true);
    } else {
      const summary = await getSecuritySummary();
      Alert.alert('Security Status', summary, [{ text: 'OK' }]);
    }
  };

  const handleClearCorruptedData = async () => {
    Alert.alert(
      '⚠️ Clear Corrupted Data',
      'This will delete all encrypted passwords that cannot be decrypted. This action cannot be undone.\n\nUse this if you see decryption errors after reinstalling the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ User requested to clear corrupted data');
              const result = await clearCorruptedPasswords();

              if (result.success) {
                Alert.alert(
                  '✅ Success',
                  'All encrypted data has been cleared. You can now create new passwords.',
                  [{ text: 'OK' }],
                );
              } else {
                Alert.alert(
                  '❌ Error',
                  `Failed to clear data: ${result.error}`,
                  [{ text: 'OK' }],
                );
              }
            } catch (error: any) {
              console.error('Failed to clear corrupted data:', error);
              Alert.alert('❌ Error', `An error occurred: ${error.message}`, [
                { text: 'OK' },
              ]);
            }
          },
        },
      ],
    );
  };

  const handleResetCategories = async () => {
    Alert.alert(
      '🔄 Reset Categories',
      'This will reset all categories to default settings with updated icons. Custom categories will be removed.\n\nYour passwords will NOT be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 User requested to reset categories');
              await CategoryService.resetToDefaultCategories();
              Alert.alert(
                '✅ Success',
                'Categories have been reset to default with updated icons.',
                [{ text: 'OK' }],
              );
            } catch (error: any) {
              console.error('Failed to reset categories:', error);
              Alert.alert('❌ Error', `An error occurred: ${error.message}`, [
                { text: 'OK' },
              ]);
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    try {
      // Sign out from Firebase and Google
      await signOut();
      // Redux state will be updated automatically via auth state listener
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: dispatch logout action directly
      dispatch(logout());
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>⚙️ Settings</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Manage your security preferences
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* User Profile */}
        <View style={styles.section}>
          <View
            style={[
              styles.userProfile,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
              <MaterialIcons name="person" size={32} color={theme.primary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {user?.displayName || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user?.email || 'No email available'}
              </Text>
            </View>
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Security
          </Text>

          <SettingItem
            icon="fingerprint"
            title="Biometric Authentication"
            subtitle={
              biometricAvailable
                ? `Use ${biometryType.toLowerCase()}`
                : 'Not available on this device'
            }
            theme={theme}
            rightElement={
              <Switch
                value={security.biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.biometricEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          {/* Auto Lock Selector */}
          <View
            style={[
              styles.settingItem,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.settingIcon, { backgroundColor: theme.surface }]}
            >
              <MaterialIcons
                name="lock-clock"
                size={24}
                color={theme.primary}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>
                Auto-Lock
              </Text>
              <Text
                style={[styles.settingSubtitle, { color: theme.textSecondary }]}
              >
                Automatically lock app after inactivity
              </Text>
            </View>
            <AutoLockSelector
              currentValue={security.autoLockTimeout}
              onValueChange={value => {
                dispatch(updateSecuritySettings({ autoLockTimeout: value }));
                // Note: Session timeout is fixed at 7 days, this only affects biometric auto-lock
              }}
            />
          </View>

          <SettingItem
            icon="security"
            title="Screen Protection"
            subtitle="Prevent screenshots and screen recording"
            theme={theme}
            rightElement={
              <Switch
                value={security.screenProtectionEnabled}
                onValueChange={handleScreenProtectionToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.screenProtectionEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />
        </View>

        {/* Advanced Security */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Advanced Security
          </Text>

          <SettingItem
            icon="verified-user"
            title="Security Checks"
            subtitle="Detect root, jailbreak, and tampering"
            theme={theme}
            rightElement={
              <Switch
                value={security.securityChecksEnabled}
                onValueChange={handleSecurityChecksToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.securityChecksEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="phonelink-lock"
            title="Root Detection"
            subtitle="Block app on rooted/jailbroken devices"
            theme={theme}
            rightElement={
              <Switch
                value={security.rootDetectionEnabled}
                onValueChange={handleRootDetectionToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.rootDetectionEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="shield"
            title="Anti-Tampering"
            subtitle="Detect app modifications and hooks"
            theme={theme}
            rightElement={
              <Switch
                value={security.antiTamperingEnabled}
                onValueChange={handleAntiTamperingToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.antiTamperingEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="memory"
            title="Memory Protection"
            subtitle="Secure sensitive data in memory"
            theme={theme}
            rightElement={
              <Switch
                value={security.memoryProtectionEnabled}
                onValueChange={handleMemoryProtectionToggle}
                trackColor={{ false: theme.surface, true: theme.primary }}
                thumbColor={
                  security.memoryProtectionEnabled
                    ? theme.background
                    : theme.textSecondary
                }
              />
            }
          />

          <SettingItem
            icon="info"
            title="Security Status"
            subtitle={
              securityState.isSecure
                ? '✅ Secure'
                : `⚠️ ${securityState.threats.length} threat(s)`
            }
            theme={theme}
            onPress={handleViewSecurityStatus}
          />
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            General
          </Text>

          <ThemeSelector onPress={() => setThemeModalVisible(true)} />

          <SettingItem
            icon="translate"
            title="Language"
            subtitle="English"
            theme={theme}
            onPress={() => {}}
          />

          <SettingItem
            icon="backup"
            title="Backup & Sync"
            subtitle="Manage your encrypted backups"
            theme={theme}
            onPress={() => {}}
          />
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Support
          </Text>

          <SettingItem
            icon="help"
            title="Help & Support"
            theme={theme}
            onPress={() => {}}
          />

          <SettingItem
            icon="visibility-off"
            title="Privacy Policy"
            theme={theme}
            onPress={() => {}}
          />

          <SettingItem
            icon="info"
            title="About"
            subtitle="Version 1.0.0"
            theme={theme}
            onPress={() => {}}
          />
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.error }]}>
            Danger Zone
          </Text>

          <SettingItem
            icon="refresh"
            title="Reset Categories"
            subtitle="Reset all categories to default with updated icons"
            theme={theme}
            onPress={handleResetCategories}
            rightElement={
              <MaterialIcons name="info" size={24} color={theme.primary} />
            }
          />

          <SettingItem
            icon="delete-sweep"
            title="Clear Corrupted Data"
            subtitle="Delete all encrypted passwords (use if decryption fails)"
            theme={theme}
            onPress={handleClearCorruptedData}
            rightElement={
              <MaterialIcons name="warning" size={24} color={theme.warning} />
            }
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[
            styles.logoutButton,
            { backgroundColor: theme.card, borderColor: theme.error },
          ]}
          onPress={handleLogout}
        >
          <MaterialIcons name="exit-to-app" size={24} color={theme.error} />
          <Text style={[styles.logoutText, { color: theme.error }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ThemeModal
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
      />

      <SecurityWarningModal
        visible={securityWarningVisible}
        threats={securityState.threats}
        onClose={() => setSecurityWarningVisible(false)}
        allowContinue={true}
        onContinueAnyway={() => setSecurityWarningVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
});
