import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useBiometric } from '../../hooks/useBiometric';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch } from '../../hooks/redux';
import { setIsInSetupFlow } from '../../store/slices/authSlice';
import { BiometricPrompt } from '../../components/BiometricPrompt';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type BiometricSetupNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'CredentialOptions'
>;

interface BiometricFeature {
  icon: string;
  title: string;
  description: string;
}

export const BiometricSetupScreen: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<BiometricSetupNavigationProp>();
  const {
    isAvailable,
    isSetup,
    biometryType,
    setupBiometric,
    isLoading,
    error,
  } = useBiometric();

  const [showPrompt, setShowPrompt] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // Mark that user is in setup flow to prevent auto-lock
  useEffect(() => {
    dispatch(setIsInSetupFlow(true));

    // Cleanup: Mark setup flow as complete when unmounting
    return () => {
      dispatch(setIsInSetupFlow(false));
    };
  }, [dispatch]);

  // Confirm dialog state
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

  const features: BiometricFeature[] = [
    {
      icon: 'shield-checkmark-outline',
      title: t('biometric_setup.feature_security_title'),
      description: t('biometric_setup.feature_security_desc'),
    },
    {
      icon: 'flash-outline',
      title: t('biometric_setup.feature_quick_title'),
      description: t('biometric_setup.feature_quick_desc'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: t('biometric_setup.feature_unique_title'),
      description: t('biometric_setup.feature_unique_desc'),
    },
    {
      icon: 'lock-closed-outline',
      title: t('biometric_setup.feature_privacy_title'),
      description: t('biometric_setup.feature_privacy_desc'),
    },
  ];

  useEffect(() => {
    if (isSetup && !setupComplete) {
      setSetupComplete(true);
    }
  }, [isSetup, setupComplete]);

  const handleSetupBiometric = async () => {
    if (!isAvailable) {
      setConfirmDialog({
        visible: true,
        title: t('biometric_setup.not_available_title'),
        message: t('biometric_setup.not_available_message'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setShowPrompt(true);
  };

  const handleBiometricSuccess = async () => {
    setShowPrompt(false);

    console.log(
      '🔐 [BiometricSetupScreen] Setup mode - calling setupBiometric()',
    );
    try {
      const success = await setupBiometric();
      if (success) {
        setSetupComplete(true);
        setConfirmDialog({
          visible: true,
          title: t('biometric_setup.setup_complete'),
          message: t('biometric_setup.setup_complete_message', {
            biometryType,
          }),
          confirmText: t('common.continue'),
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, visible: false }));
            try {
              const { enableBiometricForMasterPassword } = await import(
                '../../services/secureStorageService'
              );
              const { getEffectiveMasterPassword } = await import(
                '../../services/staticMasterPasswordService'
              );
              const mpResult = await getEffectiveMasterPassword();
              if (mpResult.success && mpResult.password) {
                await enableBiometricForMasterPassword(mpResult.password);
              }
            } catch (err) {
              console.error(
                'Failed to enable biometric for master password:',
                err,
              );
            }
            navigation.navigate('MasterPassword', {
              biometricSetupComplete: true,
            });
          },
        });
      } else {
        setConfirmDialog({
          visible: true,
          title: t('biometric_setup.setup_failed'),
          message: error || t('biometric_setup.setup_failed_message'),
          confirmText: t('common.ok'),
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      }
    } catch (err) {
      console.error('Setup error:', err);
      setConfirmDialog({
        visible: true,
        title: t('biometric_setup.setup_error'),
        message: t('biometric_setup.setup_error_message'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    }
  };

  const handleBiometricError = (errorMessage: string) => {
    console.error('Biometric error:', errorMessage);
    setConfirmDialog({
      visible: true,
      title: t('biometric_setup.authentication_failed'),
      message: errorMessage,
      confirmText: t('common.ok'),
      onConfirm: () => setConfirmDialog(prev => ({ ...prev, visible: false })),
    });
  };

  const handleSkip = () => {
    setConfirmDialog({
      visible: true,
      title: t('biometric_setup.skip_setup_title'),
      message: t('biometric_setup.skip_setup_message'),
      confirmText: t('common.skip'),
      confirmStyle: 'destructive',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        navigation.goBack();
      },
    });
  };

  const renderFeature = (feature: BiometricFeature, index: number) => (
    <View
      key={index}
      style={[styles.featureItem, { borderColor: theme.border }]}
    >
      <View style={[styles.featureIcon, { backgroundColor: theme.surface }]}>
        <Ionicons name={feature.icon} size={24} color={theme.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: theme.text }]}>
          {feature.title}
        </Text>
        <Text
          style={[styles.featureDescription, { color: theme.textSecondary }]}
        >
          {feature.description}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('biometric_setup.title')}
        </Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={[styles.skipText, { color: theme.textSecondary }]}>
            {t('biometric_setup.skip')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.surface }]}>
            <Ionicons
              name={
                biometryType.includes('Face')
                  ? 'person-outline'
                  : 'finger-print'
              }
              size={64}
              color={theme.primary}
            />
          </View>

          <Text style={[styles.heroTitle, { color: theme.text }]}>
            {t('biometric_setup.enable_biometric', { biometryType })}
          </Text>

          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            {t('biometric_setup.enable_subtitle', {
              biometryType: biometryType.toLowerCase(),
            })}
          </Text>
        </View>

        {/* Status Section */}
        {!isAvailable && (
          <View
            style={[
              styles.statusCard,
              styles.errorCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={theme.error}
            />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: theme.error }]}>
                {t('biometric_setup.not_available_title')}
              </Text>
              <Text
                style={[
                  styles.statusDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {t('biometric_setup.not_available_message')}
              </Text>
            </View>
          </View>
        )}

        {setupComplete && (
          <View
            style={[
              styles.statusCard,
              styles.successCard,
              { backgroundColor: theme.surface },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={24}
              color="#4CAF50"
            />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, styles.successColor]}>
                {t('biometric_setup.setup_complete')}
              </Text>
              <Text
                style={[
                  styles.statusDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {t('biometric_setup.setup_complete_message', { biometryType })}
              </Text>
            </View>
          </View>
        )}

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('biometric_setup.why_use_title')}
          </Text>

          {features.map((feature, index) => renderFeature(feature, index))}
        </View>

        {/* Security Notice */}
        <View
          style={[styles.securityNotice, { backgroundColor: theme.surface }]}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={[styles.securityText, { color: theme.textSecondary }]}>
            {t('biometric_setup.security_notice')}
          </Text>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        {!setupComplete ? (
          <TouchableOpacity
            style={[
              styles.setupButton,
              { backgroundColor: theme.primary },
              (!isAvailable || isLoading) && styles.disabledButton,
            ]}
            onPress={handleSetupBiometric}
            disabled={!isAvailable || isLoading}
          >
            <Ionicons
              name={
                biometryType.includes('Face')
                  ? 'person-outline'
                  : 'finger-print'
              }
              size={20}
              color="#ffffff"
            />
            <Text style={styles.setupButtonText}>
              {isLoading
                ? t('biometric_setup.setting_up')
                : t('biometric_setup.enable_biometric', { biometryType })}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="checkmark-outline" size={20} color="#ffffff" />
            <Text style={styles.completeButtonText}>
              {t('common.continue')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Biometric Prompt */}
      <BiometricPrompt
        visible={showPrompt}
        onClose={() => setShowPrompt(false)}
        onSuccess={handleBiometricSuccess}
        onError={handleBiometricError}
        title={t('biometric_setup.setup_biometric_title', { biometryType })}
        subtitle={t('biometric_setup.setup_biometric_subtitle', {
          biometryType: biometryType.toLowerCase(),
        })}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusContent: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  successColor: {
    color: '#4CAF50',
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 0.5,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  securityText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 12,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  setupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default BiometricSetupScreen;
