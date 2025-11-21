import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { useBiometric } from '../../hooks/useBiometric';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BiometricPrompt } from '../../components/BiometricPrompt';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type BiometricUnlockNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'BiometricUnlock'
>;

interface BiometricUnlockScreenProps {
  onUnlock?: () => void;
}

export const BiometricUnlockScreen: React.FC<BiometricUnlockScreenProps> = ({
  onUnlock,
}) => {
  console.log('🔍 [BiometricUnlock] ===== SCREEN RENDERING =====');

  const { theme } = useTheme();
  const navigation = useNavigation<BiometricUnlockNavigationProp>();
  const { isAvailable, biometryType, isLoading } = useBiometric();

  const [showPrompt, setShowPrompt] = useState(false);
  const appState = useRef(AppState.currentState);
  const hasTriggeredOnMount = useRef(false);

  console.log(
    `🔍 [BiometricUnlock] State: isAvailable=${isAvailable}, isLoading=${isLoading}, showPrompt=${showPrompt}, hasTriggeredOnMount=${hasTriggeredOnMount.current}`,
  );

  // Auto-navigate to MasterPassword if biometric hardware is not available
  useEffect(() => {
    if (!isAvailable) {
      const checkTimer = setTimeout(() => {
        if (!isAvailable) {
          console.log(
            '⚠️ BiometricUnlockScreen: Biometric hardware not available, navigating to MasterPassword',
          );
          navigation.navigate('MasterPassword', { mode: 'unlock' });
        }
      }, 500);
      return () => clearTimeout(checkTimer);
    }
  }, [isAvailable, navigation]);

  // Prevent hardware back button during unlock
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => backHandler.remove();
  }, []);

  // 🔥 NEW: Listen to AppState changes to auto-trigger biometric on app resume
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(
        `🔍 [BiometricUnlock] AppState changed: ${appState.current} -> ${nextAppState}`,
      );

      // When app comes back to foreground (background/inactive -> active)
      if (
        (appState.current === 'background' ||
          appState.current === 'inactive') &&
        nextAppState === 'active'
      ) {
        console.log(
          '🔍 [BiometricUnlock] App resumed from background - triggering biometric prompt',
        );
        if (isAvailable && !isLoading) {
          // Small delay to ensure Activity is ready
          setTimeout(() => {
            setShowPrompt(false); // Reset first
            setTimeout(() => {
              setShowPrompt(true); // Then show again
            }, 100);
          }, 300);
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [isAvailable, isLoading]);

  // 🔥 MODIFIED: Auto-trigger biometric prompt on mount (only once)
  useEffect(() => {
    if (isAvailable && !isLoading && !hasTriggeredOnMount.current) {
      console.log(
        '🔍 [BiometricUnlock] Auto-triggering biometric prompt on mount',
      );
      hasTriggeredOnMount.current = true;
      // Small delay to let UI settle
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAvailable, isLoading]);

  // 🔥 NEW: Reset trigger flag when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔍 [BiometricUnlock] Screen focused');
      // Reset the trigger flag when screen gains focus
      // This allows biometric to be triggered again if user navigates back to this screen
      hasTriggeredOnMount.current = false;
      return () => {
        console.log('🔍 [BiometricUnlock] Screen unfocused');
      };
    }, []),
  );

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleBiometricUnlock = async () => {
    if (!isAvailable) {
      setConfirmDialog({
        visible: true,
        title: 'Not Available',
        message:
          'Biometric authentication hardware is not available on this device.',
        confirmText: 'OK',
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setShowPrompt(true);
  };

  const handleBiometricSuccess = async () => {
    setShowPrompt(false);
    console.log('🔍 [DEBUG_NAV STEP 7] BiometricUnlock successful');
    if (onUnlock) {
      onUnlock();
    }
  };

  const handleBiometricError = (errorMessage: string) => {
    console.error('Biometric error:', errorMessage);
    setConfirmDialog({
      visible: true,
      title: 'Biometric Failed',
      message:
        'Unable to unlock with biometric. Please enter your Master Password.',
      confirmText: 'Use Master Password',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        navigation.navigate('MasterPassword', { mode: 'unlock' });
      },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* ✅ Hide all UI when biometric prompt is showing - cleaner UX */}
      {!showPrompt && (
        <>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Unlock
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.heroSection}>
              <View
                style={[styles.heroIcon, { backgroundColor: theme.surface }]}
              >
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
                Unlock with {biometryType}
              </Text>

              <Text
                style={[styles.heroSubtitle, { color: theme.textSecondary }]}
              >
                Use your {biometryType.toLowerCase()} to unlock your vault
              </Text>
            </View>

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
          </View>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.unlockButton,
                { backgroundColor: theme.primary },
                (!isAvailable || isLoading) && styles.disabledButton,
              ]}
              onPress={handleBiometricUnlock}
              disabled={!isAvailable || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name={
                      biometryType.includes('Face')
                        ? 'person-outline'
                        : 'finger-print'
                    }
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.unlockButtonText}>Try Again</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      <BiometricPrompt
        visible={showPrompt}
        onClose={() => setShowPrompt(false)}
        onSuccess={handleBiometricSuccess}
        onError={handleBiometricError}
        title={`Unlock with ${biometryType}`}
        subtitle={`Use your ${biometryType.toLowerCase()} to unlock`}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
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
    marginTop: 24,
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
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
  footer: {
    borderTopWidth: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 10,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
