import React from 'react';
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

  // console.log('🔐 BiometricPrompt: Component rendered', {
  //   visible,
  //   isAvailable,
  //   hasTriggered: hasTriggeredRef.current,
  //   isAuthenticating: isAuthenticatingRef.current,
  // });

  // Auto-trigger native biometric authentication when visible
  React.useEffect(() => {
    // console.log('🔐 BiometricPrompt: useEffect triggered', {
    //   visible,
    //   isAvailable,
    //   hasTriggered: hasTriggeredRef.current,
    //   isAuthenticating: isAuthenticatingRef.current,
    // });

    if (
      visible &&
      isAvailable &&
      !hasTriggeredRef.current &&
      !isAuthenticatingRef.current
    ) {
      // console.log(
      //   '🔐 BiometricPrompt: Auto-triggering native biometric authentication...',
      // );
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
            console.log('🔐 BiometricPrompt: User CANCELLED authentication');
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
    // Biometric prompt visibility changed
    if (!visible) {
      hasTriggeredRef.current = false;
      isAuthenticatingRef.current = false;
    }
  }, [visible]);

  // This component doesn't render any UI - it only triggers native biometric prompt
  // All UI is handled by the native biometric system (fingerprint/face/pattern)
  return null;
};
