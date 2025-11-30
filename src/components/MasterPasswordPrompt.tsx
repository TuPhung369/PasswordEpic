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
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { verifyMasterPassword } from '../services/secureStorageService';
import ConfirmDialog from './ConfirmDialog';

interface MasterPasswordPromptProps {
  visible: boolean;
  onSuccess: (password: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export const MasterPasswordPrompt: React.FC<MasterPasswordPromptProps> = ({
  visible,
  onSuccess,
  onCancel,
  title,
  subtitle,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const displayTitle = title || t('master_password_prompt.title');
  const displaySubtitle = subtitle || t('master_password_prompt.subtitle');

  const handleVerify = async () => {
    if (!password.trim()) {
      setConfirmDialog({
        visible: true,
        title: t('common.error'),
        message: t('master_password_prompt.error_empty'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
      return;
    }

    setLoading(true);
    try {
      const result = await verifyMasterPassword(password.trim());
      if (result.success) {
        const verifiedPassword = password.trim();
        setPassword('');
        onSuccess(verifiedPassword);
      } else {
        setConfirmDialog({
          visible: true,
          title: t('master_password_prompt.error_incorrect'),
          message: result.error || t('master_password_prompt.error_incorrect'),
          confirmText: t('common.ok'),
          onConfirm: () =>
            setConfirmDialog(prev => ({ ...prev, visible: false })),
        });
      }
    } catch (error) {
      console.error('Master password verification failed:', error);
      setConfirmDialog({
        visible: true,
        title: t('common.error'),
        message: t('master_password_prompt.error_failed'),
        confirmText: t('common.ok'),
        onConfirm: () =>
          setConfirmDialog(prev => ({ ...prev, visible: false })),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
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
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={32}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              {displayTitle}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {displaySubtitle}
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputSection}>
            <View
              style={[styles.inputContainer, { borderColor: theme.border }]}
            >
              <Ionicons
                name="key-outline"
                size={24}
                color={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('master_password_prompt.placeholder')}
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={text => setPassword(text.trim())}
                secureTextEntry={!showPassword}
                autoFocus={true}
                onSubmitEditing={handleVerify}
                autoComplete="off"
                importantForAutofill="no"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
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
                {t('master_password_prompt.cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.verifyButton,
                { backgroundColor: theme.primary },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading || !password.trim()}
            >
              <Text style={[styles.buttonText, { color: theme.background }]}>
                {loading
                  ? t('master_password_prompt.verifying')
                  : t('master_password_prompt.unlock')}
              </Text>
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
  verifyButton: {
    // backgroundColor set dynamically
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
