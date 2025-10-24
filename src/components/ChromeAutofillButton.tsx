/**
 * Chrome Autofill Button Component
 *
 * Interactive button for triggering Chrome WebView autofill.
 * Shows when form is detected and credentials are available.
 *
 * @author PasswordEpic Team
 * @since Week 10 - Chrome Integration Phase
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  AccessibilityInfo,
} from 'react-native';
import { useChromeAutoFill } from '../hooks/useChromeAutoFill';
import type { AutofillCredential } from '../services/autofillService';

export interface ChromeAutofillButtonProps {
  credentials?: AutofillCredential[];
  domain?: string;
  currentUrl?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  visible?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  biometricRequired?: boolean;
  style?: any;
  testID?: string;
}

export const ChromeAutofillButton: React.FC<ChromeAutofillButtonProps> = ({
  credentials,
  domain,
  currentUrl,
  onSuccess,
  onError,
  visible = true,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  biometricRequired = true,
  style,
  testID,
}) => {
  const {
    isAvailable,
    isInjecting,
    formDetected,
    error,
    injectCredentials,
    autoFillCurrentPage,
    resetError,
  } = useChromeAutoFill(credentials, {
    biometricRequired,
    onSuccess,
    onError,
  });

  const handlePress = useCallback(async () => {
    resetError();

    if (!isAvailable) {
      onError?.('Chrome autofill not available');
      return;
    }

    if (currentUrl && currentUrl.startsWith('http')) {
      // Use auto-fill with URL detection
      await autoFillCurrentPage(currentUrl);
    } else if (domain && credentials && credentials.length > 0) {
      // Use manual injection with specific domain
      const credential = credentials.find(
        c => c.domain === domain || domain.includes(c.domain),
      );

      if (credential) {
        const result = await injectCredentials({
          domain: credential.domain,
          username: credential.username,
          password: credential.password,
        });

        if (!result) {
          onError?.('Failed to inject credentials');
        }
      } else {
        onError?.(`No credentials found for ${domain}`);
      }
    } else {
      onError?.('Missing domain or credentials');
    }
  }, [
    isAvailable,
    currentUrl,
    domain,
    credentials,
    autoFillCurrentPage,
    injectCredentials,
    onError,
    resetError,
  ]);

  if (!visible || !isAvailable || !formDetected) {
    return null;
  }

  const isDisabled = disabled || isInjecting || !isAvailable || !formDetected;

  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles[`button_${variant}`],
          styles[`button_${size}`],
          isDisabled && styles.buttonDisabled,
          pressed && !isDisabled && styles.buttonPressed,
        ]}
        onPress={handlePress}
        disabled={isDisabled}
        testID={testID || 'chrome-autofill-button'}
        accessible
        accessibilityLabel="Autofill credentials"
        accessibilityHint="Tap to autofill the login form with saved credentials"
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: isInjecting }}
      >
        {isInjecting ? (
          <>
            <ActivityIndicator
              size="small"
              color={variant === 'primary' ? '#FFF' : '#4CAF50'}
              style={styles.activityIndicator}
            />
            <Text
              style={[
                styles.buttonText,
                styles[`buttonText_${variant}`],
                styles[`buttonText_${size}`],
              ]}
            >
              Filling...
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.buttonEmoji}>🔓</Text>
            <Text
              style={[
                styles.buttonText,
                styles[`buttonText_${variant}`],
                styles[`buttonText_${size}`],
              ]}
            >
              Autofill
            </Text>
          </>
        )}
      </Pressable>

      {error && (
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    gap: 6,
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  button_small: {
    paddingVertical: 8,
  },
  button_medium: {
    paddingVertical: 12,
  },
  button_large: {
    paddingVertical: 16,
  },
  button_primary: {
    backgroundColor: '#4CAF50',
  },
  button_secondary: {
    backgroundColor: '#2196F3',
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: '600',
  },
  buttonText_small: {
    fontSize: 12,
  },
  buttonText_medium: {
    fontSize: 14,
  },
  buttonText_large: {
    fontSize: 16,
  },
  buttonText_primary: {
    color: '#FFF',
  },
  buttonText_secondary: {
    color: '#FFF',
  },
  buttonText_outline: {
    color: '#4CAF50',
  },
  buttonEmoji: {
    fontSize: 16,
  },
  activityIndicator: {
    marginRight: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#D32F2F',
    paddingHorizontal: 4,
  },
});
