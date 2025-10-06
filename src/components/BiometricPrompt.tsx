import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useBiometric } from '../hooks/useBiometric';

interface BiometricPromptProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  title?: string;
  subtitle?: string;
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  visible,
  onClose,
  onSuccess,
  onError,
  title: _title = 'Authenticate to access your passwords',
  subtitle: _subtitle,
}) => {
  const { authenticate, isAvailable } = useBiometric();
  const hasTriggeredRef = React.useRef(false);
  const isAuthenticatingRef = React.useRef(false);

  // Store callbacks in refs to avoid dependency issues
  const authenticateRef = React.useRef(authenticate);
  const onSuccessRef = React.useRef(onSuccess);
  const onErrorRef = React.useRef(onError);
  const onCloseRef = React.useRef(onClose);

  // Update refs when callbacks change
  React.useEffect(() => {
    authenticateRef.current = authenticate;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    onCloseRef.current = onClose;
  }, [authenticate, onSuccess, onError, onClose]);

  // Auto-trigger native biometric authentication when visible
  React.useEffect(() => {
    if (
      visible &&
      isAvailable &&
      !hasTriggeredRef.current &&
      !isAuthenticatingRef.current
    ) {
      hasTriggeredRef.current = true;
      isAuthenticatingRef.current = true;

      // Small delay to ensure proper initialization
      const timeout = setTimeout(async () => {
        try {
          // console.log('🔐 BiometricPrompt: Calling authenticate...');
          const success = await authenticateRef.current();

          if (success) {
            // console.log('🔐 BiometricPrompt: Authentication SUCCESS');
            onSuccessRef.current();
          } else {
            // console.log('🔐 BiometricPrompt: Authentication FAILED');
            onErrorRef.current('Authentication failed');
          }
        } catch (error: any) {
          // console.error('🔐 BiometricPrompt: Authentication ERROR:', error);

          // Check if user cancelled (user-initiated cancellation)
          const isCancellation =
            error.message?.includes('cancel') ||
            error.message?.includes('Cancel') ||
            error.code === 'USER_CANCEL' ||
            error.code === 'AUTHENTICATION_CANCELED';

          if (isCancellation) {
            // console.log('🔐 BiometricPrompt: User CANCELLED authentication');
            // Only call onClose for user cancellation (which triggers logout)
            onCloseRef.current();
          } else {
            // For other errors, just report the error
            onErrorRef.current(error.message || 'Authentication failed');
          }
        } finally {
          // Reset authenticating flag
          isAuthenticatingRef.current = false;
        }
      }, 100);

      return () => {
        clearTimeout(timeout);
        isAuthenticatingRef.current = false;
      };
    } else if (visible && !isAvailable) {
      // Waiting for biometric availability check
    }
  }, [visible, isAvailable]);

  // Reset when visibility changes
  React.useEffect(() => {
    // console.log('🔐 BiometricPrompt: Visibility changed', { visible });
    if (!visible) {
      hasTriggeredRef.current = false;
      isAuthenticatingRef.current = false;
    }
  }, [visible]);

  // Render a simple overlay with close button (native biometric prompt will show on top)
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Spacer to push content to bottom */}
        <View style={styles.topSpacer} />

        {/* Close button positioned ABOVE the bottom sheet area */}
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom sheet area (where native biometric prompt appears) */}
        <View style={styles.bottomSheetArea} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end', // Align to bottom
  },
  topSpacer: {
    flex: 1, // Takes up remaining space (top 65% of screen)
  },
  closeButtonContainer: {
    width: '100%',
    alignItems: 'flex-end', // Align button to right
    paddingRight: 20,
    paddingBottom: 10, // Small gap between button and modal
  },
  bottomSheetArea: {
    width: '100%',
    height: '35%', // Bottom 1/3 of screen where biometric prompt appears
  },
  closeButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#007AFF', // iOS blue background
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    zIndex: 10000, // Ensure it's on top
  },
});
