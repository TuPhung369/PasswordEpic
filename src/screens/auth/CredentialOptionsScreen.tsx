import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch } from '../../hooks/redux';
import {
  setIsInSetupFlow,
  setShouldNavigateToUnlock,
} from '../../store/slices/authSlice';
import ConfirmDialog from '../../components/ConfirmDialog';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type CredentialOptionsNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'CredentialOptions'
>;

interface CredentialOption {
  icon: string;
  title: string;
  description: string;
  action: 'keep' | 'update';
}

export const CredentialOptionsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<CredentialOptionsNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);

  // Mark that user is in setup flow to prevent auto-lock
  useEffect(() => {
    console.log(
      '🔍 [DEBUG_NAV STEP 2] CredentialOptionsScreen mounted - setting isInSetupFlow=true',
    );
    dispatch(setIsInSetupFlow(true));
    dispatch(setShouldNavigateToUnlock(false)); // Don't navigate to unlock until user chooses

    // DON'T reset isInSetupFlow on unmount - let unlock success handler reset it
    // Otherwise AppNavigator switches to Main stack prematurely
  }, [dispatch]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmStyle?: 'default' | 'destructive';
    onCancel?: () => void;
    dismissible?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const options: CredentialOption[] = [
    {
      icon: 'checkmark-circle-outline',
      title: t('credential_options.keep_title'),
      description: t('credential_options.keep_description'),
      action: 'keep',
    },
    {
      icon: 'refresh-circle-outline',
      title: t('credential_options.update_title'),
      description: t('credential_options.update_description'),
      action: 'update',
    },
  ];

  const handleKeepCredentials = async () => {
    setIsLoading(true);
    try {
      console.log(
        '🔍 [DEBUG_NAV STEP 3] User chose "Keep Credentials" - navigating to BiometricWithPin',
      );

      // Navigate directly to PIN unlock screen
      // This screen handles both PIN entry and biometric authentication
      // Skipping BiometricUnlock to avoid navigation stuck issues
      navigation.replace('BiometricWithPin');

      console.log('🔍 [DEBUG_NAV STEP 4] Navigated to BiometricWithPin');
    } catch (error) {
      console.error('Error setting unlock flag:', error);
      setConfirmDialog({
        visible: true,
        title: t('credential_options.navigation_error'),
        message: t('credential_options.navigation_error_message'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCredentials = () => {
    setConfirmDialog({
      visible: true,
      title: t('credential_options.update_confirm_title'),
      message: t('credential_options.update_confirm_message'),
      confirmText: t('common.continue'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        setIsLoading(true);
        try {
          console.log(
            '� [DEBUG_NAV STEP 3-ALT] User chose "Update Credentials" - navigating to MasterPassword',
          );
          // For update path, user will create new credentials (no unlock needed)
          dispatch(setShouldNavigateToUnlock(false));
          navigation.replace('MasterPassword', { mode: 'update' });
        } catch (error) {
          console.error('Error navigating to update:', error);
          setConfirmDialog({
            visible: true,
            title: t('credential_options.navigation_error'),
            message: t('credential_options.navigation_error_message'),
            confirmText: t('common.ok'),
            onConfirm: () =>
              setConfirmDialog(prev => ({ ...prev, visible: false })),
          });
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
      },
    });
  };

  const renderOption = (option: CredentialOption) => (
    <TouchableOpacity
      key={option.action}
      style={[styles.optionCard, { backgroundColor: theme.card }]}
      onPress={
        option.action === 'keep'
          ? handleKeepCredentials
          : handleUpdateCredentials
      }
      disabled={isLoading}
      activeOpacity={0.7}
    >
      <View
        style={[styles.optionIconContainer, { backgroundColor: theme.surface }]}
      >
        <Ionicons name={option.icon as any} size={32} color={theme.primary} />
      </View>

      <View style={styles.optionContent}>
        <Text style={[styles.optionTitle, { color: theme.text }]}>
          {option.title}
        </Text>
        <Text
          style={[styles.optionDescription, { color: theme.textSecondary }]}
        >
          {option.description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward-outline"
        size={24}
        color={theme.textSecondary}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('credential_options.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isLoading}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.surface }]}>
            <Ionicons name="key-outline" size={64} color={theme.primary} />
          </View>

          <Text style={[styles.heroTitle, { color: theme.text }]}>
            {t('credential_options.how_to_proceed')}
          </Text>

          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            {t('credential_options.choose_subtitle')}
          </Text>
        </View>

        {/* Options Section */}
        <View style={styles.optionsSection}>
          {options.map(option => renderOption(option))}
        </View>

        {/* Info Section */}
        <View style={[styles.infoSection, { backgroundColor: theme.surface }]}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.primary}
          />
          <View style={styles.infoContent}>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {t('credential_options.info_note')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={
          confirmDialog.onCancel ||
          (() => setConfirmDialog(prev => ({ ...prev, visible: false })))
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  heroIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  optionsSection: {
    marginBottom: 24,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3.84,
    elevation: 3,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

export default CredentialOptionsScreen;
