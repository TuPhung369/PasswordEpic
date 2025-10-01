import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useBiometric } from '../../hooks/useBiometric';
import { useNavigation } from '@react-navigation/native';
import { BiometricPrompt } from '../../components/BiometricPrompt';

interface BiometricFeature {
  icon: string;
  title: string;
  description: string;
}

export const BiometricSetupScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
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

  const features: BiometricFeature[] = [
    {
      icon: 'security',
      title: 'Enhanced Security',
      description:
        'Your biometric data is stored securely on your device and never leaves it.',
    },
    {
      icon: 'flash-on',
      title: 'Quick Access',
      description:
        'Access your passwords instantly without typing your master password.',
    },
    {
      icon: 'verified-user',
      title: 'Unique to You',
      description:
        'Only you can access your passwords using your unique biometric features.',
    },
    {
      icon: 'privacy-tip',
      title: 'Privacy Protected',
      description:
        'Your biometric data is processed locally and never shared or stored online.',
    },
  ];

  useEffect(() => {
    if (isSetup && !setupComplete) {
      setSetupComplete(true);
    }
  }, [isSetup, setupComplete]);

  const handleSetupBiometric = async () => {
    if (!isAvailable) {
      Alert.alert(
        'Not Available',
        'Biometric authentication is not available on this device.',
        [{ text: 'OK' }],
      );
      return;
    }

    setShowPrompt(true);
  };

  const handleBiometricSuccess = async () => {
    setShowPrompt(false);

    try {
      const success = await setupBiometric();
      if (success) {
        setSetupComplete(true);
        Alert.alert(
          'Setup Complete',
          `${biometryType} authentication has been enabled successfully!`,
          [
            {
              text: 'Continue',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } else {
        Alert.alert(
          'Setup Failed',
          error ||
            'Failed to setup biometric authentication. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (err) {
      console.error('Setup error:', err);
      Alert.alert(
        'Setup Error',
        'An error occurred while setting up biometric authentication.',
        [{ text: 'OK' }],
      );
    }
  };

  const handleBiometricError = (errorMessage: string) => {
    console.error('Biometric error:', errorMessage);
    Alert.alert('Authentication Failed', errorMessage, [{ text: 'OK' }]);
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Setup',
      'You can enable biometric authentication later in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  };

  const renderFeature = (feature: BiometricFeature, index: number) => (
    <View
      key={index}
      style={[styles.featureItem, { borderColor: theme.border }]}
    >
      <View style={[styles.featureIcon, { backgroundColor: theme.surface }]}>
        <MaterialIcons name={feature.icon} size={24} color={theme.primary} />
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
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Biometric Setup
        </Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={[styles.skipText, { color: theme.textSecondary }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.surface }]}>
            <MaterialIcons
              name={biometryType.includes('Face') ? 'face' : 'fingerprint'}
              size={64}
              color={theme.primary}
            />
          </View>

          <Text style={[styles.heroTitle, { color: theme.text }]}>
            Enable {biometryType}
          </Text>

          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Use your {biometryType.toLowerCase()} to quickly and securely access
            your passwords
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
            <MaterialIcons name="error-outline" size={24} color={theme.error} />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: theme.error }]}>
                Not Available
              </Text>
              <Text
                style={[
                  styles.statusDescription,
                  { color: theme.textSecondary },
                ]}
              >
                Biometric authentication is not available on this device.
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
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, styles.successColor]}>
                Setup Complete
              </Text>
              <Text
                style={[
                  styles.statusDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {biometryType} authentication is now enabled.
              </Text>
            </View>
          </View>
        )}

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Why Use Biometric Authentication?
          </Text>

          {features.map((feature, index) => renderFeature(feature, index))}
        </View>

        {/* Security Notice */}
        <View
          style={[styles.securityNotice, { backgroundColor: theme.surface }]}
        >
          <MaterialIcons name="info-outline" size={20} color={theme.primary} />
          <Text style={[styles.securityText, { color: theme.textSecondary }]}>
            Your biometric data is stored securely on your device using
            hardware-backed security features. It never leaves your device and
            cannot be accessed by this app or any third parties.
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
            <MaterialIcons
              name={biometryType.includes('Face') ? 'face' : 'fingerprint'}
              size={20}
              color="#ffffff"
            />
            <Text style={styles.setupButtonText}>
              {isLoading ? 'Setting up...' : `Enable ${biometryType}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="check" size={20} color="#ffffff" />
            <Text style={styles.completeButtonText}>Continue</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Biometric Prompt */}
      <BiometricPrompt
        visible={showPrompt}
        onClose={() => setShowPrompt(false)}
        onSuccess={handleBiometricSuccess}
        onError={handleBiometricError}
        title={`Setup ${biometryType}`}
        subtitle={`Authenticate with your ${biometryType.toLowerCase()} to enable this feature`}
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
