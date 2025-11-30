import React from 'react';
import { useTranslation } from 'react-i18next';
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

  mode?: 'import' | 'export' | 'backup' | 'restore';
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
  mode,
  biometricTitle,
  biometricSubtitle,
  pinTitle,
  pinSubtitle,
}) => {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  // Context-aware i18n titles
  let resolvedBiometricTitle = biometricTitle;
  let resolvedBiometricSubtitle = biometricSubtitle;
  let resolvedPinTitle = pinTitle;
  let resolvedPinSubtitle = pinSubtitle;

  if (!biometricTitle || !biometricSubtitle || !pinTitle || !pinSubtitle) {
    switch (mode) {
      case 'import':
        resolvedBiometricTitle = t('password_auth.biometric_title_import');
        resolvedBiometricSubtitle = t(
          'password_auth.biometric_subtitle_import',
        );
        resolvedPinTitle = t('password_auth.pin_title_import');
        resolvedPinSubtitle = t('password_auth.pin_subtitle_import');
        break;
      case 'export':
        resolvedBiometricTitle = t('password_auth.biometric_title_export');
        resolvedBiometricSubtitle = t(
          'password_auth.biometric_subtitle_export',
        );
        resolvedPinTitle = t('password_auth.pin_title_export');
        resolvedPinSubtitle = t('password_auth.pin_subtitle_export');
        break;
      case 'backup':
        resolvedBiometricTitle = t('password_auth.biometric_title_backup');
        resolvedBiometricSubtitle = t(
          'password_auth.biometric_subtitle_backup',
        );
        resolvedPinTitle = t('password_auth.pin_title_backup');
        resolvedPinSubtitle = t('password_auth.pin_subtitle_backup');
        break;
      case 'restore':
        resolvedBiometricTitle = t('password_auth.biometric_title_restore');
        resolvedBiometricSubtitle = t(
          'password_auth.biometric_subtitle_restore',
        );
        resolvedPinTitle = t('password_auth.pin_title_restore');
        resolvedPinSubtitle = t('password_auth.pin_subtitle_restore');
        break;
      default:
        resolvedBiometricTitle =
          biometricTitle || t('password_auth.biometric_title');
        resolvedBiometricSubtitle =
          biometricSubtitle || t('password_auth.biometric_subtitle');
        resolvedPinTitle = pinTitle || t('password_auth.pin_title');
        resolvedPinSubtitle = pinSubtitle || t('password_auth.pin_subtitle');
    }
  }

  return (
    <>
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={onBiometricClose}
        onSuccess={onBiometricSuccess}
        onError={onBiometricError}
        title={resolvedBiometricTitle}
        subtitle={resolvedBiometricSubtitle}
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
        title={resolvedPinTitle}
        subtitle={resolvedPinSubtitle}
        mode={mode}
      />
    </>
  );
};

export default PasswordAuthenticationModal;
