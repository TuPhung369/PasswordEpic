import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import Clipboard from '@react-native-clipboard/clipboard';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';

export interface GeneratedPasswordHistory {
  id: string;
  password: string;
  timestamp: Date;
  length: number;
  settings: {
    includeUppercase: boolean;
    includeLowercase: boolean;
    includeNumbers: boolean;
    includeSymbols: boolean;
  };
  strength: {
    score: number;
    label: string;
    color: string;
  };
  template?: string;
  isFavorite: boolean;
}

interface GeneratorHistoryProps {
  visible: boolean;
  onClose: () => void;
  history: GeneratedPasswordHistory[];
  onUsePassword: (password: string) => void;
  onToggleFavorite: (id: string) => void;
  onClearHistory: () => void;
}

export const GeneratorHistory: React.FC<GeneratorHistoryProps> = ({
  visible,
  onClose,
  history,
  onUsePassword,
  onToggleFavorite,
  onClearHistory,
}) => {
  const { theme } = useTheme();
  const [showPasswords, setShowPasswords] = useState<{
    [key: string]: boolean;
  }>({});

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyToClipboard = async (password: string) => {
    await Clipboard.setString(password);
    setToastMessage('Password copied to clipboard');
    setShowToast(true);
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  const getCharacterTypes = (
    settings: GeneratedPasswordHistory['settings'],
  ) => {
    const types = [];
    if (settings.includeUppercase) types.push('A-Z');
    if (settings.includeLowercase) types.push('a-z');
    if (settings.includeNumbers) types.push('0-9');
    if (settings.includeSymbols) types.push('!@#');
    return types.join(', ');
  };

  const handleClearHistory = () => {
    setConfirmDialog({
      visible: true,
      title: 'Clear History',
      message:
        'Are you sure you want to clear all generated passwords? This action cannot be undone.',
      confirmText: 'Clear',
      confirmStyle: 'destructive',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, visible: false }));
        onClearHistory();
      },
    });
  };

  const favoritePasswords = history.filter(item => item.isFavorite);
  const recentPasswords = history.filter(item => !item.isFavorite);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-outline" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            Generation History
          </Text>
          <TouchableOpacity onPress={handleClearHistory}>
            <Ionicons
              name="trash-outline"
              size={24}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="time-outline"
              size={64}
              color={theme.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Generated Passwords
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: theme.textSecondary }]}
            >
              Passwords you generate will appear here for easy access
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {favoritePasswords.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  ⭐ Favorites
                </Text>
                {favoritePasswords.map(item => (
                  <PasswordHistoryItem
                    key={item.id}
                    item={item}
                    theme={theme}
                    showPassword={showPasswords[item.id]}
                    onToggleVisibility={() => togglePasswordVisibility(item.id)}
                    onCopy={() => copyToClipboard(item.password)}
                    onUse={() => onUsePassword(item.password)}
                    onToggleFavorite={() => onToggleFavorite(item.id)}
                    getCharacterTypes={getCharacterTypes}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </View>
            )}

            {recentPasswords.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  🕒 Recent
                </Text>
                {recentPasswords.map(item => (
                  <PasswordHistoryItem
                    key={item.id}
                    item={item}
                    theme={theme}
                    showPassword={showPasswords[item.id]}
                    onToggleVisibility={() => togglePasswordVisibility(item.id)}
                    onCopy={() => copyToClipboard(item.password)}
                    onUse={() => onUsePassword(item.password)}
                    onToggleFavorite={() => onToggleFavorite(item.id)}
                    getCharacterTypes={getCharacterTypes}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />

      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
      />
    </Modal>
  );
};

interface PasswordHistoryItemProps {
  item: GeneratedPasswordHistory;
  theme: any;
  showPassword: boolean;
  onToggleVisibility: () => void;
  onCopy: () => void;
  onUse: () => void;
  onToggleFavorite: () => void;
  getCharacterTypes: (settings: GeneratedPasswordHistory['settings']) => string;
  formatTimestamp: (timestamp: Date) => string;
}

const PasswordHistoryItem: React.FC<PasswordHistoryItemProps> = ({
  item,
  theme,
  showPassword,
  onToggleVisibility,
  onCopy,
  onUse,
  onToggleFavorite,
  getCharacterTypes,
  formatTimestamp,
}) => {
  return (
    <View
      style={[
        styles.historyItem,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.historyHeader}>
        <View style={styles.historyInfo}>
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            {formatTimestamp(item.timestamp)}
          </Text>
          {item.template && (
            <Text style={[styles.template, { color: theme.primary }]}>
              {item.template}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onToggleFavorite}>
          <Ionicons
            name={item.isFavorite ? 'star' : 'star-outline'}
            size={20}
            color={item.isFavorite ? '#FFD700' : theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.passwordContainer}>
        <View style={styles.passwordDisplay}>
          <Text style={[styles.passwordText, { color: theme.text }]}>
            {showPassword ? item.password : '•'.repeat(item.password.length)}
          </Text>
          <TouchableOpacity
            onPress={onToggleVisibility}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.strengthIndicator}>
          <View
            style={[
              styles.strengthBar,
              { backgroundColor: item.strength.color },
              { width: `${(item.strength.score / 5) * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.passwordMeta}>
        <Text style={[styles.strengthLabel, { color: item.strength.color }]}>
          {item.strength.label}
        </Text>
        <Text style={[styles.lengthLabel, { color: theme.textSecondary }]}>
          {item.length} chars
        </Text>
        <Text style={[styles.typesLabel, { color: theme.textSecondary }]}>
          {getCharacterTypes(item.settings)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.surface }]}
          onPress={onCopy}
        >
          <Ionicons name="copy-outline" size={16} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>
            Copy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={onUse}
        >
          <Ionicons name="open-outline" size={16} color="#ffffff" />
          <Text style={[styles.actionText, styles.whiteText]}>Use</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  historyItem: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 0.5,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyInfo: {
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  template: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  passwordContainer: {
    marginBottom: 12,
  },
  passwordDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  passwordText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  eyeButton: {
    padding: 4,
  },
  strengthIndicator: {
    height: 3,
    backgroundColor: '#333',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 1.5,
  },
  passwordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  lengthLabel: {
    fontSize: 12,
  },
  typesLabel: {
    fontSize: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  whiteText: {
    color: '#ffffff',
  },
});
