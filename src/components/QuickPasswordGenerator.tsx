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
import { generateSecurePassword } from '../utils/passwordUtils';
import { DEFAULT_TEMPLATES, PasswordTemplate } from './PasswordTemplates';
import { passwordGeneratorService } from '../services/passwordGeneratorService';

interface QuickPasswordGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onSelectPassword: (password: string) => void;
}

export const QuickPasswordGenerator: React.FC<QuickPasswordGeneratorProps> = ({
  visible,
  onClose,
  onSelectPassword,
}) => {
  const { theme } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleSelectTemplate = (template: PasswordTemplate) => {
    setSelectedTemplate(template.id);
    try {
      let password: string;

      // Use specialized generators for specific template types
      if (template.id === 'passphrase') {
        password = passwordGeneratorService.generatePassphrase(
          template.settings.length,
          template.settings.includeNumbers,
        );
      } else if (template.id === 'memorable') {
        password = passwordGeneratorService.generateMemorablePassword(
          template.settings.length,
        );
      } else {
        // Generic password generator for all other templates
        password = generateSecurePassword(template.settings);
      }

      onSelectPassword(password);
      setTimeout(() => {
        setSelectedTemplate(null);
        onClose();
      }, 300);
    } catch (error) {
      console.error('Failed to generate password:', error);
      setSelectedTemplate(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.container, { backgroundColor: theme.background }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="key" size={24} color={theme.primary} />
              <Text style={[styles.title, { color: theme.text }]}>
                Generate Password
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.presetsList}
            showsVerticalScrollIndicator={false}
          >
            {DEFAULT_TEMPLATES.map((template: PasswordTemplate) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.presetButton,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectedTemplate === template.id && {
                    borderColor: template.color,
                    backgroundColor: `${template.color}10`,
                  },
                ]}
                onPress={() => handleSelectTemplate(template)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.presetIcon,
                    { backgroundColor: `${template.color}20` },
                  ]}
                >
                  <Ionicons
                    name={template.icon as any}
                    size={24}
                    color={template.color}
                  />
                </View>
                <View style={styles.presetInfo}>
                  <Text
                    style={[
                      styles.presetName,
                      { color: theme.text },
                      selectedTemplate === template.id && { color: template.color },
                    ]}
                  >
                    {template.name}
                  </Text>
                  <Text
                    style={[
                      styles.presetDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {template.description}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    maxHeight: 800,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  presetsList: {
    maxHeight: '100%',
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  presetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  advancedButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
