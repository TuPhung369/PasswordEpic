import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import {
  updateSecuritySettings,
  setBiometricEnabled,
} from '../../store/slices/settingsSlice';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ThemeSelector } from '../../components/ThemeSelector';
import { ThemeModal } from '../../components/ThemeModal';
import { useTheme } from '../../contexts/ThemeContext';
import { signOut } from '../../services/authService';
import { useBiometric } from '../../hooks/useBiometric';
import { useSession } from '../../hooks/useSession';

// Tách SettingItem ra ngoài để tránh re-render
const SettingItem: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  theme: any;
}> = ({ icon, title, subtitle, onPress, rightElement, theme }) => (
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
);

export const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: RootState) => state.auth);
  const { security } = useAppSelector((state: RootState) => state.settings);
  const { theme } = useTheme();
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  // Biometric and session hooks
  const {
    isAvailable: biometricAvailable,
    biometryType,
    setupBiometric,
    disableBiometric: disableBiometricService,
  } = useBiometric();

  const { updateConfig: updateSessionConfig } = useSession();

  // Debug Redux state changes
  useEffect(() => {
    console.log('⚙️ SettingsScreen: Redux security state:', security);
    console.log('⚙️ SettingsScreen: biometricEnabled =', security.biometricEnabled);
    console.log('⚙️ SettingsScreen: biometricAvailable =', biometricAvailable);
    console.log('⚙️ SettingsScreen: Switch value =', security.biometricEnabled && biometricAvailable);
  }, [security, biometricAvailable]);

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
        console.log('⚙️ SettingsScreen: Starting biometric setup...');
        const success = await setupBiometric();
        console.log('⚙️ SettingsScreen: Setup result:', success);
        
        if (success) {
          console.log('⚙️ SettingsScreen: Setup successful, updating Redux...');
          dispatch(setBiometricEnabled(true));
          dispatch(updateSecuritySettings({ biometricEnabled: true }));
          console.log('⚙️ SettingsScreen: Redux states updated');
        } else {
          console.log('⚙️ SettingsScreen: Setup failed');
        }
      } catch (error) {
        console.error('⚙️ SettingsScreen: Setup error:', error);
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

  const handleAutoLockChange = () => {
    const options = [
      '1 minute',
      '5 minutes',
      '15 minutes',
      '30 minutes',
      '1 hour',
    ];
    const values = [1, 5, 15, 30, 60];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...options],
          cancelButtonIndex: 0,
          title: 'Auto-Lock Timeout',
        },
        buttonIndex => {
          if (buttonIndex > 0) {
            const newTimeout = values[buttonIndex - 1];
            dispatch(updateSecuritySettings({ autoLockTimeout: newTimeout }));
            updateSessionConfig({ timeout: newTimeout });
          }
        },
      );
    } else {
      // For Android, you could implement a similar picker or modal
      Alert.alert(
        'Auto-Lock Timeout',
        'Choose when to automatically lock the app',
        options
          .map((option, index) => ({
            text: option,
            onPress: () => {
              const newTimeout = values[index];
              dispatch(updateSecuritySettings({ autoLockTimeout: newTimeout }));
              updateSessionConfig({ timeout: newTimeout });
            },
          }))
          .concat([{ text: 'Cancel', onPress: () => {} }]),
      );
    }
  };

  const handleScreenProtectionToggle = (enabled: boolean) => {
    dispatch(updateSecuritySettings({ screenProtectionEnabled: enabled }));
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

          <SettingItem
            icon="timer"
            title="Auto-Lock"
            subtitle={`Lock after ${security.autoLockTimeout} minute${
              security.autoLockTimeout === 1 ? '' : 's'
            }`}
            theme={theme}
            onPress={handleAutoLockChange}
          />

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
