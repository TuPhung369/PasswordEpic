import React from 'react';
import { BiometricPrompt } from './BiometricPrompt';
import { BiometricFallbackPrompt } from './BiometricFallbackPrompt';
import { PinPromptModal } from './PinPromptModal';

export interface PasswordAuthenticationModalProps {
  visible: boolean;
  
  showBiometricPrompt: boolean;
  showFallbackModal: boolean;
  showPinPrompt: boolean;
  
  onBiometricSuccess: () => void;
  onBiometricError: (error: string) => void;
  onBiometricClose: () => void;
  
  onFallbackSuccess: (masterPassword: string) => void;
  onFallbackCancel: () => void;
  
  onPinPromptSuccess: (masterPassword: string) => void;
  onPinPromptCancel: () => void;
  
  biometricTitle?: string;
  biometricSubtitle?: string;
  pinTitle?: string;
  pinSubtitle?: string;
}

export const PasswordAuthenticationModal: React.FC<
  PasswordAuthenticationModalProps
> = ({
  visible,
  
  showBiometricPrompt,
  showFallbackModal,
  showPinPrompt,
  
  onBiometricSuccess,
  onBiometricError,
  onBiometricClose,
  
  onFallbackSuccess,
  onFallbackCancel,
  
  onPinPromptSuccess,
  onPinPromptCancel,
  
  biometricTitle = 'Authenticate to access passwords',
  biometricSubtitle = 'Use biometric authentication to verify your identity',
  pinTitle = 'Unlock',
  pinSubtitle = 'Enter your PIN to verify your identity',
}) => {
  if (!visible) {
    return null;
  }

  return (
    <>
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={onBiometricClose}
        onSuccess={onBiometricSuccess}
        onError={onBiometricError}
        title={biometricTitle}
        subtitle={biometricSubtitle}
      />

      <BiometricFallbackPrompt
        visible={showFallbackModal}
        onSuccess={onFallbackSuccess}
        onCancel={onFallbackCancel}
      />

      <PinPromptModal
        visible={showPinPrompt}
        onSuccess={onPinPromptSuccess}
        onCancel={onPinPromptCancel}
        title={pinTitle}
        subtitle={pinSubtitle}
      />
    </>
  );
};

export default PasswordAuthenticationModal;
