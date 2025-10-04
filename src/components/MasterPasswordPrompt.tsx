import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { verifyMasterPassword } from '../services/secureStorageService';

interface MasterPasswordPromptProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export const MasterPasswordPrompt: React.FC<MasterPasswordPromptProps> = ({
  visible,
  onSuccess,
  onCancel,
  title = 'Master Password Required',
  subtitle = 'Enter your master password to continue',
}) => {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleVerify = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your master password');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyMasterPassword(password);
      if (result.success) {
        setPassword('');
        onSuccess();
      } else {
        Alert.alert(
          'Invalid Password',
          result.error || 'The master password you entered is incorrect',
        );
      }
    } catch (error) {
      console.error('Master password verification failed:', error);
      Alert.alert('Error', 'Failed to verify master password');
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
              <MaterialIcons name="lock" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {subtitle}
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputSection}>
            <View
              style={[styles.inputContainer, { borderColor: theme.border }]}
            >
              <MaterialIcons
                name="vpn-key"
                size={24}
                color={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter master password"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
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
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
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
                Cancel
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
                {loading ? 'Verifying...' : 'Unlock'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
