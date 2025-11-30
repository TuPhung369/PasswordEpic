import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { unlockMasterPasswordWithPin } from '../../services/staticMasterPasswordService';
import ConfirmDialog from '../../components/ConfirmDialog';
import BiometricService from '../../services/biometricService';

type BiometricWithPinNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'BiometricWithPin'
>;

interface BiometricWithPinProps {
  onUnlock?: () => void;
}

export const BiometricWithPin: React.FC<BiometricWithPinProps> = ({
  onUnlock,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<BiometricWithPinNavigationProp>();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [waitingForBiometric, setWaitingForBiometric] = useState(true); // Track if waiting for initial biometric
  const biometricAttemptedRef = useRef(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    dismissible?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    dismissible: true,
  });

  const isPinValid = pin.length >= 6 && pin.length <= 8 && /^\d+$/.test(pin);

  // 🔥 Reset biometric attempted flag when screen mounts (allow retry on navigation)
  useEffect(() => {
    console.log(
      '🔍 [BiometricWithPin] Screen mounted - resetting biometric attempted flag',
    );
    biometricAttemptedRef.current = false;

    return () => {
      console.log('🔍 [BiometricWithPin] Screen unmounted - cleaning up');
    };
  }, []);

  // 🔥 Auto-trigger biometric authentication when screen mounts
  useEffect(() => {
    const checkAndTriggerBiometric = async () => {
      if (biometricAttemptedRef.current) {
        console.log(
          '🔍 [BiometricWithPin] Biometric already attempted, skipping...',
        );
        return;
      }

      try {
        const biometricService = BiometricService.getInstance();
        const capability = await biometricService.checkBiometricCapability();

        console.log(
          `🔍 [BiometricWithPin] Biometric capability: ${JSON.stringify(
            capability,
          )}`,
        );

        setBiometricAvailable(capability.available);

        if (capability.available) {
          console.log(
            '🔍 [BiometricWithPin] Biometric available - triggering authentication...',
          );
          biometricAttemptedRef.current = true;

          // Small delay to ensure UI is ready
          setTimeout(async () => {
            try {
              const result = await biometricService.authenticateWithBiometrics(
                'Unlock your vault',
              );

              if (result.success) {
                console.log(
                  '✅ [BiometricWithPin] Biometric authentication successful!',
                );

                // Cache encrypted master password
                const { cacheEncryptedMasterPasswordToAsyncStorage } =
                  await import('../../services/staticMasterPasswordService');
                const cacheResult =
                  await cacheEncryptedMasterPasswordToAsyncStorage();
                if (cacheResult.success) {
                  console.log(
                    '✅ [BiometricWithPin] Encrypted MP cached successfully',
                  );
                }

                setWaitingForBiometric(false); // Done waiting

                // Call onUnlock callback
                if (onUnlock) {
                  onUnlock();
                } else {
                  navigation.navigate('Login');
                }
              } else {
                console.log(
                  '❌ [BiometricWithPin] Biometric failed or cancelled - navigating to Master Password screen',
                );
                setWaitingForBiometric(false); // Done waiting
                // Navigate to Master Password screen for fallback (Master Password + PIN)
                navigation.navigate('MasterPassword', { mode: 'unlock' });
              }
            } catch (error) {
              console.error('❌ [BiometricWithPin] Biometric error:', error);
              setWaitingForBiometric(false); // Done waiting
              // Navigate to Master Password screen for fallback
              navigation.navigate('MasterPassword', { mode: 'unlock' });
            }
          }, 300);
        } else {
          console.log(
            '⚠️ [BiometricWithPin] Biometric not available - navigating to Master Password screen',
          );
          setWaitingForBiometric(false); // Done waiting
          // Navigate to Master Password screen for fallback
          navigation.navigate('MasterPassword', { mode: 'unlock' });
        }
      } catch (error) {
        console.error('❌ [BiometricWithPin] Error checking biometric:', error);
        setWaitingForBiometric(false); // Done waiting
        // Navigate to Master Password screen for fallback
        navigation.navigate('MasterPassword', { mode: 'unlock' });
      }
    };

    checkAndTriggerBiometric();
  }, [onUnlock, navigation]);

  // 🔥 Handle hardware back button - trigger biometric instead of going back
  useFocusEffect(
    React.useCallback(() => {
      const handleBackPress = () => {
        // If biometric is available, trigger it instead of going back
        if (biometricAvailable) {
          console.log(
            '🔍 [BiometricWithPin] Back button pressed - triggering biometric...',
          );

          // Trigger biometric asynchronously (don't wait for result)
          (async () => {
            try {
              const biometricService = BiometricService.getInstance();
              const result = await biometricService.authenticateWithBiometrics(
                'Unlock your vault',
              );

              if (result.success) {
                console.log(
                  '✅ [BiometricWithPin] Biometric authentication successful!',
                );

                // Cache encrypted master password
                const { cacheEncryptedMasterPasswordToAsyncStorage } =
                  await import('../../services/staticMasterPasswordService');
                const cacheResult =
                  await cacheEncryptedMasterPasswordToAsyncStorage();
                if (cacheResult.success) {
                  console.log(
                    '✅ [BiometricWithPin] Encrypted MP cached successfully',
                  );
                }

                // Call onUnlock callback
                if (onUnlock) {
                  onUnlock();
                } else {
                  navigation.navigate('Login');
                }
              } else {
                console.log(
                  '❌ [BiometricWithPin] Back button biometric failed - navigating to Master Password screen',
                );
                // Navigate to Master Password screen for fallback
                navigation.navigate('MasterPassword', { mode: 'unlock' });
              }
            } catch (error) {
              console.error('❌ [BiometricWithPin] Biometric error:', error);
              // Navigate to Master Password screen for fallback
              navigation.navigate('MasterPassword', { mode: 'unlock' });
            }
          })();

          return true; // Prevent default back behavior
        } else {
          // No biometric available, allow normal back navigation
          navigation.goBack();
          return true;
        }
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBackPress,
      );
      return () => backHandler.remove();
    }, [biometricAvailable, onUnlock, navigation]),
  );

  const handleUnlock = async () => {
    if (!isPinValid) {
      setConfirmDialog({
        visible: true,
        title: t('biometric_pin.invalid_pin'),
        message: t('biometric_pin.pin_must_be_digits'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await unlockMasterPasswordWithPin(pin.trim());
      if (result.success) {
        console.log('🔍 [DEBUG_NAV STEP 7] BiometricWithPin unlock successful');

        // Call onUnlock callback if provided (from AppNavigator)
        if (onUnlock) {
          onUnlock();
        } else {
          // Fallback: navigate to Login if no callback provided
          navigation.navigate('Login');
        }
      } else {
        throw new Error(result.error || 'Failed to unlock');
      }
    } catch (error: any) {
      setConfirmDialog({
        visible: true,
        title: t('biometric_pin.unlock_failed'),
        message: error.message || t('biometric_pin.unlock_failed_message'),
        confirmText: t('common.try_again'),
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, visible: false }));
          setIsLoading(false);
        },
      });
    } finally {
      // Always turn off loading state
      setIsLoading(false);
    }
  };

  // 🔥 Show loading state while waiting for biometric authentication
  // Note: If biometric fails/cancels, screen will navigate to MasterPasswordScreen
  if (waitingForBiometric) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('biometric_pin.waiting_for_auth')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('biometric_pin.title')}
        </Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.surface }]}>
            <Ionicons
              name="lock-closed-outline"
              size={64}
              color={theme.primary}
            />
          </View>

          <Text style={[styles.heroTitle, { color: theme.text }]}>
            {t('biometric_pin.enter_your_pin')}
          </Text>

          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            {t('biometric_pin.enter_pin_subtitle')}
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            {t('biometric_pin.security_pin')}
          </Text>
          <View style={[styles.inputContainer, { borderColor: theme.border }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              value={pin}
              onChangeText={text =>
                setPin(text.replace(/[^0-9]/g, '').slice(0, 8))
              }
              placeholder={t('biometric_pin.enter_pin_placeholder')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              maxLength={8}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowPin(!showPin)}
              style={styles.eyeButton}
              disabled={isLoading}
            >
              <Ionicons
                name={showPin ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {pin.length > 0 && (
            <View style={styles.pinLengthContainer}>
              <Ionicons
                name={
                  isPinValid
                    ? 'checkmark-circle-outline'
                    : 'radio-button-off-outline'
                }
                size={16}
                color={isPinValid ? '#00C851' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.pinLengthText,
                  isPinValid
                    ? styles.pinLengthTextValid
                    : { color: theme.textSecondary },
                ]}
              >
                {t('biometric_pin.digits', { count: pin.length })} (
                {isPinValid
                  ? t('biometric_pin.valid')
                  : t('biometric_pin.need_6_8')}
                )
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            {t('biometric_pin.pin_setup_info')}
          </Text>
        </View>

        {/* 🔥 Show biometric option if available */}
        {biometricAvailable && (
          <View style={styles.biometricSection}>
            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: theme.border }]}
              />
              <Text
                style={[styles.dividerText, { color: theme.textSecondary }]}
              >
                {t('biometric_pin.or')}
              </Text>
              <View
                style={[styles.dividerLine, { backgroundColor: theme.border }]}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.biometricButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={async () => {
                try {
                  console.log(
                    '🔍 [BiometricWithPin] User tapped biometric button',
                  );
                  const biometricService = BiometricService.getInstance();
                  const result =
                    await biometricService.authenticateWithBiometrics(
                      'Unlock your vault',
                    );

                  if (result.success) {
                    console.log(
                      '✅ [BiometricWithPin] Biometric authentication successful!',
                    );

                    // Cache encrypted master password
                    const { cacheEncryptedMasterPasswordToAsyncStorage } =
                      await import(
                        '../../services/staticMasterPasswordService'
                      );
                    const cacheResult =
                      await cacheEncryptedMasterPasswordToAsyncStorage();
                    if (cacheResult.success) {
                      console.log(
                        '✅ [BiometricWithPin] Encrypted MP cached successfully',
                      );
                    }

                    // Call onUnlock callback
                    if (onUnlock) {
                      onUnlock();
                    } else {
                      navigation.navigate('Login');
                    }
                  } else {
                    console.log(
                      '❌ [BiometricWithPin] Biometric failed - navigating to Master Password screen',
                    );
                    // Navigate to Master Password screen for fallback
                    navigation.navigate('MasterPassword', { mode: 'unlock' });
                  }
                } catch (error) {
                  console.error(
                    '❌ [BiometricWithPin] Biometric error:',
                    error,
                  );
                  // Navigate to Master Password screen for fallback
                  navigation.navigate('MasterPassword', { mode: 'unlock' });
                }
              }}
            >
              <Ionicons
                name="finger-print-outline"
                size={24}
                color={theme.primary}
              />
              <Text style={[styles.biometricButtonText, { color: theme.text }]}>
                {t('biometric_pin.use_biometric')}
              </Text>
            </TouchableOpacity>

            <Text
              style={[styles.biometricHint, { color: theme.textSecondary }]}
            >
              {t('biometric_pin.back_button_hint')}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.unlockButton,
            { backgroundColor: theme.primary },
            (!isPinValid || isLoading) && styles.disabledButton,
          ]}
          onPress={handleUnlock}
          disabled={!isPinValid || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="lock-open-outline" size={20} color="#ffffff" />
              <Text style={styles.unlockButtonText}>
                {t('biometric_pin.unlock')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={
          confirmDialog.dismissible
            ? () => setConfirmDialog(prev => ({ ...prev, visible: false }))
            : undefined
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
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
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
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
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinLengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinLengthText: {
    fontSize: 14,
  },
  pinLengthTextValid: {
    color: '#00C851',
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
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
  biometricSection: {
    marginTop: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  biometricHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
