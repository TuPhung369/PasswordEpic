import React from 'react';
import { View, StyleSheet, Modal, InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  title: _title,
  subtitle: _subtitle,
}) => {
  const { authenticate, isAvailable } = useBiometric();
  const { t } = useTranslation();
  const defaultTitle = _title || t('auth.biometric_prompt_title');
  const hasTriggeredRef = React.useRef(false);
  const isAuthenticatingRef = React.useRef(false);
  const retryCountRef = React.useRef(0);
  const [retryTrigger, setRetryTrigger] = React.useState(0);

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

      // Wait for UI interactions to complete before showing biometric prompt
      const interactionHandle = InteractionManager.runAfterInteractions(
        async () => {
          // Additional delay to ensure Activity is fully ready (especially on Android)
          await new Promise(resolve => setTimeout(resolve, 500));

          try {
            // console.log('🔐 BiometricPrompt: Calling authenticate...');
            const success = await authenticateRef.current(defaultTitle);

            if (success) {
              // console.log('🔐 BiometricPrompt: Authentication SUCCESS');
              retryCountRef.current = 0; // Reset retry count on success
              setTimeout(() => {
                onSuccessRef.current();
              }, 100);
            } else {
              // console.log('🔐 BiometricPrompt: Authentication FAILED');
              retryCountRef.current = 0; // Reset retry count
              setTimeout(() => {
                onErrorRef.current('Authentication failed');
              }, 100);
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
              retryCountRef.current = 0; // Reset retry count
              // Only call onClose for user cancellation (which triggers logout)
              // Use setTimeout to ensure Modal state updates complete before opening next modal
              setTimeout(() => {
                onCloseRef.current();
              }, 100);
            } else {
              // Check if this is a FragmentActivity timing issue (Android)
              const isActivityNotReady =
                error.message?.includes('FragmentActivity') ||
                error.message?.includes('must not be null') ||
                error.message?.includes('not ready');

              if (isActivityNotReady && retryCountRef.current < 2) {
                // Retry up to 2 times with increasing delays
                retryCountRef.current += 1;
                const retryDelay = retryCountRef.current * 1000; // 1s, 2s
                console.log(
                  `⚠️ Activity not ready, retrying in ${retryDelay}ms (attempt ${retryCountRef.current}/2)`,
                );

                // Reset flags to allow retry
                hasTriggeredRef.current = false;
                isAuthenticatingRef.current = false;

                // Retry after delay by triggering state change
                setTimeout(() => {
                  setRetryTrigger(prev => prev + 1);
                }, retryDelay);
              } else {
                // Max retries reached or different error - report to user
                retryCountRef.current = 0; // Reset retry count
                setTimeout(() => {
                  onErrorRef.current(error.message || 'Authentication failed');
                }, 100);
              }
            }
          } finally {
            // Reset authenticating flag (unless we're retrying)
            if (retryCountRef.current === 0) {
              isAuthenticatingRef.current = false;
            }
          }
        },
      );

      return () => {
        interactionHandle.cancel();
        isAuthenticatingRef.current = false;
      };
    } else if (visible && !isAvailable) {
      // Waiting for biometric availability check
    }
  }, [visible, isAvailable, retryTrigger, defaultTitle]);

  // Reset when visibility changes
  React.useEffect(() => {
    // console.log('🔐 BiometricPrompt: Visibility changed', { visible });
    if (!visible) {
      hasTriggeredRef.current = false;
      isAuthenticatingRef.current = false;
      retryCountRef.current = 0; // Reset retry count when modal closes
      setRetryTrigger(0); // Reset retry trigger
    }
  }, [visible]);

  // Render a simple overlay (native biometric prompt will show on top)
  // No close button - user must authenticate or cancel via native prompt
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
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
  bottomSheetArea: {
    width: '100%',
    height: '35%', // Bottom 1/3 of screen where biometric prompt appears
  },
});
