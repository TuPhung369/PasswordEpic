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

  // Auto-trigger native biometric authentication when visible
  React.useEffect(() => {
    if (visible && isAvailable && !hasTriggeredRef.current) {
      console.log('🔐 BiometricPrompt: Auto-triggering native biometric authentication...');
      hasTriggeredRef.current = true;

      // Small delay to ensure proper initialization
      const timeout = setTimeout(async () => {
        try {
          console.log('🔐 BiometricPrompt: Calling authenticate...');
          const success = await authenticate();
          
          if (success) {
            console.log('🔐 BiometricPrompt: Authentication SUCCESS');
            onSuccess();
          } else {
            console.log('🔐 BiometricPrompt: Authentication FAILED');
            onError('Authentication failed');
          }
        } catch (error: any) {
          console.error('🔐 BiometricPrompt: Authentication ERROR:', error);
          onError(error.message || 'Authentication failed');
        } finally {
          // Always close after authentication attempt
          onClose();
        }
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [visible, isAvailable, authenticate, onSuccess, onError, onClose]);

  // Reset when visibility changes
  React.useEffect(() => {
    if (!visible) {
      hasTriggeredRef.current = false;
    }
  }, [visible]);

  // This component doesn't render any UI - it only triggers native biometric prompt
  // All UI is handled by the native biometric system (fingerprint/face/pattern)
  return null;
};
