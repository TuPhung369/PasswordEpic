import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { unlockMasterPasswordWithPin } from '../services/staticMasterPasswordService';
import ConfirmDialog from './ConfirmDialog';

interface PinPromptModalProps {
  visible: boolean;
  onSuccess: (masterPassword: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  mode?: 'export' | 'import' | 'backup' | 'restore';
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  visible,
  onSuccess,
  onCancel,
  title,
  subtitle,
  mode,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmStyle?: 'default' | 'destructive';
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isPinValid = pin.length >= 6 && pin.length <= 8 && /^\d+$/.test(pin);

  const handleUnlock = async () => {
    if (!pin.trim()) {
      setConfirmDialog({
        visible: true,
        title: t('common.error'),
        message: t('pin_prompt.enter_pin'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    if (!isPinValid) {
      setConfirmDialog({
        visible: true,
        title: t('pin_prompt.invalid_pin'),
        message: t('pin_prompt.pin_must_be_digits'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setLoading(true);
    try {
      const result = await unlockMasterPasswordWithPin(pin.trim());

      if (result.success && result.password) {
        setPin('');
        onSuccess(result.password);
      } else {
        setConfirmDialog({
          visible: true,
          title: t('pin_prompt.failed_to_unlock'),
          message: result.error || t('pin_prompt.failed_decrypt_pin'),
          confirmText: t('common.ok'),
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      }
    } catch (error) {
      console.error('PIN unlock failed:', error);
      setConfirmDialog({
        visible: true,
        title: t('common.error'),
        message:
          error instanceof Error ? error.message : t('errors.failed_unlock'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPin('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <Ionicons name="keypad-outline" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}> 
              {title ||
                (mode === 'export' && t('backup_restore.export')) ||
                (mode === 'import' && t('backup_restore.import')) ||
                (mode === 'backup' && t('backup_restore.backup')) ||
                (mode === 'restore' && t('backup_restore.restore')) ||
                t('backup_restore.title')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {subtitle || t('backup_restore.enter_pin_to_proceed')}
            </Text>
          </View>

          <View style={styles.inputSection}>
            <View
              style={[styles.inputContainer, { borderColor: theme.border }]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={24}
                color={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('pin_prompt.enter_pin')}
                placeholderTextColor={theme.textSecondary}
                value={pin}
                onChangeText={text => setPin(text.replace(/[^0-9]/g, ''))}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                maxLength={8}
                autoFocus={true}
                onSubmitEditing={handleUnlock}
                autoComplete="off"
                importantForAutofill="no"
              />
              <TouchableOpacity
                onPress={() => setShowPin(!showPin)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPin ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { borderColor: theme.border },
              ]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.unlockButton,
                { backgroundColor: theme.primary },
                (!isPinValid || loading) && styles.buttonDisabled,
              ]}
              onPress={handleUnlock}
              disabled={!isPinValid || loading}
            >
              {loading ? (
                <Text style={[styles.buttonText, { color: theme.background }]}>
                  {t('backup_restore.unlocking')}
                </Text>
              ) : (
                <Text style={[styles.buttonText, { color: theme.background }]}>
                  {t('backup_restore.unlock')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    marginRight: 8,
    letterSpacing: 4,
  },
  eyeButton: {
    padding: 4,
  },
  buttonSection: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  unlockButton: {},
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
