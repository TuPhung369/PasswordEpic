/**
 * Chrome Autofill Indicator Component
 *
 * Visual indicator showing when Chrome autofill is available.
 * Displays on login pages with detected form fields.
 *
 * @author PasswordEpic Team
 * @since Week 10 - Chrome Integration Phase
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useChromeAutoFill } from '../hooks/useChromeAutoFill';
import type { AutofillCredential } from '../services/autofillService';

export interface ChromeAutofillIndicatorProps {
  credentials?: AutofillCredential[];
  onAutofill?: () => void;
  onFormDetected?: (detected: boolean) => void;
  visible?: boolean;
  autoDetect?: boolean;
  style?: any;
}

export const ChromeAutofillIndicator: React.FC<
  ChromeAutofillIndicatorProps
> = ({
  credentials,
  onAutofill,
  onFormDetected,
  visible = true,
  autoDetect = true,
  style,
}) => {
  const { t } = useTranslation();
  const [animationValue] = useState(new Animated.Value(0));

  const { isSupported, isAvailable, isDetecting, formDetected, error } =
    useChromeAutoFill(credentials, {
      autoDetect,
      biometricRequired: true,
      onSuccess: onAutofill,
    });

  // Animate appearance
  useEffect(() => {
    if (formDetected && isAvailable) {
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animationValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [formDetected, isAvailable, animationValue]);

  // Notify parent about form detection
  useEffect(() => {
    onFormDetected?.(formDetected);
  }, [formDetected, onFormDetected]);

  if (!visible || !isAvailable || !formDetected) {
    return null;
  }

  const opacity = animationValue;

  return (
    <Animated.View
      style={[styles.container, { opacity }, style]}
      accessible
      accessibilityLabel={t('chrome_autofill.indicator_label')}
      accessibilityHint={t('chrome_autofill.indicator_hint')}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {isDetecting ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Text style={styles.icon}>🔓</Text>
          )}
        </View>

        <Text style={styles.text}>
          {isDetecting
            ? t('chrome_autofill.detecting_form')
            : t('chrome_autofill.autofill_available')}
        </Text>

        {error && (
          <Text style={styles.errorText} numberOfLines={1}>
            {error}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
  },
  text: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    color: '#D32F2F',
    marginTop: 4,
    flex: 1,
  },
});
