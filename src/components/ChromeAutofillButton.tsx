/**
 * Chrome Autofill Button Component
 *
 * Displays a button to trigger Chrome WebView autofill functionality.
 * Handles form detection, credential selection, and biometric authentication.
 *
 * Usage:
 * ```tsx
 * <ChromeAutofillButton
 *   credentials={credentials}
 *   onSuccess={() => navigation.goBack()}
 *   onError={(error) => showError(error)}
 * />
 * ```
 *
 * @author PasswordEpic Team
 * @since Week 10 - Chrome Integration Phase
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Text,
} from 'react-native';
import { useChromeAutoFill } from '../hooks/useChromeAutoFill';
import { chromeAutoFillService } from '../services/chromeAutoFillService';
import type { AutofillCredential } from '../services/autofillService';
import Icon from 'react-native-vector-icons/MaterialIcons';

export interface ChromeAutofillButtonProps {
  credentials: AutofillCredential[];
  onSuccess?: () => void;
  onError?: (error: string) => void;
  style?: any;
  textColor?: string;
  backgroundColor?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  biometricRequired?: boolean;
}

/**
 * Chrome Autofill Button Component
 */
export const ChromeAutofillButton: React.FC<ChromeAutofillButtonProps> = ({
  credentials,
  onSuccess,
  onError,
  style,
  textColor = '#FFFFFF',
  backgroundColor = '#1E90FF',
  size = 'medium',
  showLabel = true,
  biometricRequired = true,
}) => {
  const [showCredentialPicker, setShowCredentialPicker] = useState(false);
  const [selectedCredential, setSelectedCredential] =
    useState<AutofillCredential | null>(null);
  const [detectedForms, setDetectedForms] = useState(0);

  const {
    isSupported,
    isAvailable,
    isLoading,
    isInjecting,
    isDetecting,
    error,
    formDetected,
    injectCredentials,
    detectForm,
    resetError,
  } = useChromeAutoFill(credentials, {
    autoDetect: true,
    biometricRequired,
    onSuccess,
    onError,
  });

  // Detect forms on mount
  useEffect(() => {
    if (isAvailable) {
      detectForms();
    }
  }, [isAvailable]);

  // Detect forms and count them
  const detectForms = async () => {
    try {
      const result = await chromeAutoFillService.detectAllForms();
      if (result.success) {
        setDetectedForms(result.formCount);
        console.log(`✅ Detected ${result.formCount} forms on page`);
      }
    } catch (error) {
      console.warn('Error detecting forms:', error);
    }
  };

  // Handle autofill button press
  const handleAutofill = async () => {
    resetError();

    // Check if Chrome injection is available
    if (!isAvailable) {
      Alert.alert(
        'Not Available',
        'Chrome autofill is not available on this device. This feature requires Android 8.0+.',
      );
      return;
    }

    // Check if we have credentials
    if (!credentials || credentials.length === 0) {
      Alert.alert('No Credentials', 'Please add a password first.');
      return;
    }

    // If only one credential, use it directly
    if (credentials.length === 1) {
      await performAutofill(credentials[0]);
      return;
    }

    // Show credential picker if multiple credentials
    setShowCredentialPicker(true);
  };

  // Perform autofill with selected credential
  const performAutofill = async (credential: AutofillCredential) => {
    try {
      setShowCredentialPicker(false);

      // Check if current page is HTTPS
      const isHttps = await chromeAutoFillService.isCurrentPageHttps();
      if (!isHttps) {
        Alert.alert(
          'Insecure Connection',
          'Autofill only works on HTTPS pages for security reasons.',
        );
        return;
      }

      console.log(`🔐 Injecting credentials for domain: ${credential.domain}`);

      // Perform injection
      const success = await injectCredentials({
        domain: credential.domain,
        username: credential.username,
        password: credential.password,
      });

      if (success) {
        Alert.alert('Success', `Credentials injected for ${credential.domain}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Autofill error:', err);
      Alert.alert('Error', errorMsg);
    }
  };

  // Get button size styles
  const getButtonSize = () => {
    const sizes = {
      small: { width: 40, height: 40, fontSize: 14 },
      medium: { width: 50, height: 50, fontSize: 16 },
      large: { width: 60, height: 60, fontSize: 18 },
    };
    return sizes[size];
  };

  const buttonSize = getButtonSize();
  const isLoaded = !isLoading;
  const isReady = isAvailable && isLoaded && formDetected;

  // Don't render on non-Android platforms
  if (Platform.OS !== 'android') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Main Autofill Button */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: buttonSize.width,
            height: buttonSize.height,
            backgroundColor,
          },
          !isReady && styles.buttonDisabled,
        ]}
        onPress={handleAutofill}
        disabled={!isReady || isInjecting || isDetecting}
        activeOpacity={0.7}
      >
        {isInjecting ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            <Icon
              name="security"
              size={buttonSize.fontSize}
              color={textColor}
              style={styles.icon}
            />
            {showLabel && (
              <Text style={[styles.label, { color: textColor, fontSize: 10 }]}>
                Autofill
              </Text>
            )}
          </>
        )}
      </TouchableOpacity>

      {/* Status Indicator */}
      {isAvailable && formDetected && (
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {detectedForms > 0
              ? `${detectedForms} form${detectedForms > 1 ? 's' : ''}`
              : 'Ready'}
          </Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={resetError}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Credential Picker Modal */}
      {showCredentialPicker && credentials.length > 0 && (
        <View style={styles.credentialPickerContainer}>
          <View style={styles.credentialPicker}>
            <Text style={styles.pickerTitle}>Select Credential</Text>

            {credentials.map((cred, index) => (
              <TouchableOpacity
                key={index}
                style={styles.credentialOption}
                onPress={() => performAutofill(cred)}
              >
                <View style={styles.credentialInfo}>
                  <Text style={styles.credentialDomain}>{cred.domain}</Text>
                  <Text style={styles.credentialUsername}>{cred.username}</Text>
                </View>
                <Icon name="arrow-forward" size={20} color="#1E90FF" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCredentialPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={backgroundColor} />
          <Text style={styles.loadingText}>
            Initializing Chrome Autofill...
          </Text>
        </View>
      )}

      {/* Not Supported Message */}
      {!isSupported && (
        <View style={styles.notSupportedContainer}>
          <Icon name="info" size={24} color="#FF6B6B" />
          <Text style={styles.notSupportedText}>
            Chrome autofill requires Android 8.0+
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  icon: {
    marginBottom: 2,
  },
  label: {
    marginTop: 2,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#C62828',
    flex: 1,
  },
  errorDismiss: {
    fontSize: 12,
    color: '#1E90FF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  credentialPickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  credentialPicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  credentialOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    justifyContent: 'space-between',
  },
  credentialInfo: {
    flex: 1,
  },
  credentialDomain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  credentialUsername: {
    fontSize: 12,
    color: '#666',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  notSupportedContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  notSupportedText: {
    marginTop: 8,
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
  },
});

export default ChromeAutofillButton;
