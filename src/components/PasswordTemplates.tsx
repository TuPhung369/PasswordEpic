import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

export interface PasswordTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  settings: {
    length: number;
    includeUppercase: boolean;
    includeLowercase: boolean;
    includeNumbers: boolean;
    includeSymbols: boolean;
    excludeSimilar?: boolean;
    pattern?: string;
    pronounceable?: boolean;
  };
  examples: string[];
}

export const DEFAULT_TEMPLATES: PasswordTemplate[] = [
  {
    id: 'banking',
    name: 'Banking & Finance',
    description: 'Extra secure for financial accounts',
    icon: 'account-balance',
    color: '#4CAF50',
    settings: {
      length: 20,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true,
    },
    examples: ['K9!mN$vZ2#xR8@pL4wQ6', 'P7&dF$kM3!vB9#nH2@cX'],
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Strong but memorable for social accounts',
    icon: 'people',
    color: '#FF9800',
    settings: {
      length: 16,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      pronounceable: true,
    },
    examples: ['MyPass2024Strong', 'SocialKey9876Safe'],
  },
  {
    id: 'email',
    name: 'Email Accounts',
    description: 'Balanced security for email access',
    icon: 'email',
    color: '#2196F3',
    settings: {
      length: 18,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true,
    },
    examples: ['Email@2024Secure!9', 'MyMail#Strong2024'],
  },
  {
    id: 'work',
    name: 'Work & Business',
    description: 'Professional passwords for work accounts',
    icon: 'business',
    color: '#9C27B0',
    settings: {
      length: 16,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true,
    },
    examples: ['Work2024@Secure!', 'Business#Pass9876'],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Fun but secure for gaming platforms',
    icon: 'sports-esports',
    color: '#E91E63',
    settings: {
      length: 14,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
    },
    examples: ['GameMaster2024Pro', 'PlayerOne9876Win'],
  },
  {
    id: 'shopping',
    name: 'Shopping & E-commerce',
    description: 'Secure passwords for online shopping',
    icon: 'shopping-cart',
    color: '#FF5722',
    settings: {
      length: 16,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
    },
    examples: ['Shop2024@Secure!', 'Buy#Safe9876Pass'],
  },
  {
    id: 'wifi',
    name: 'WiFi Networks',
    description: 'Strong passwords for WiFi security',
    icon: 'wifi',
    color: '#607D8B',
    settings: {
      length: 24,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true,
    },
    examples: ['WiFi@Home2024#Secure!9876', 'Network$Strong2024@Safe!'],
  },
  {
    id: 'memorable',
    name: 'Memorable',
    description: 'Easy to remember but still secure',
    icon: 'psychology',
    color: '#795548',
    settings: {
      length: 12,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      pronounceable: true,
    },
    examples: ['MySecure2024', 'Remember9876'],
  },
];

interface PasswordTemplatesProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PasswordTemplate) => void;
  currentTemplate?: PasswordTemplate | null;
}

export const PasswordTemplates: React.FC<PasswordTemplatesProps> = ({
  visible,
  onClose,
  onSelectTemplate,
  currentTemplate,
}) => {
  const { theme } = useTheme();
  const [selectedTemplate, setSelectedTemplate] =
    useState<PasswordTemplate | null>(currentTemplate || null);

  const handleSelectTemplate = (template: PasswordTemplate) => {
    setSelectedTemplate(template);
    onSelectTemplate(template);
    onClose();
  };

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
            <MaterialIcons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            Password Templates
          </Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose a template optimized for specific use cases
          </Text>

          <View style={styles.templatesGrid}>
            {DEFAULT_TEMPLATES.map(template => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectedTemplate?.id === template.id && {
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}10`,
                  },
                ]}
                onPress={() => handleSelectTemplate(template)}
              >
                <View style={styles.templateHeader}>
                  <View
                    style={[
                      styles.templateIcon,
                      { backgroundColor: `${template.color}20` },
                    ]}
                  >
                    <MaterialIcons
                      name={template.icon as any}
                      size={24}
                      color={template.color}
                    />
                  </View>
                  {selectedTemplate?.id === template.id && (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={theme.primary}
                    />
                  )}
                </View>

                <Text style={[styles.templateName, { color: theme.text }]}>
                  {template.name}
                </Text>
                <Text
                  style={[
                    styles.templateDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {template.description}
                </Text>

                <View style={styles.templateSettings}>
                  <View style={styles.settingItem}>
                    <MaterialIcons
                      name="straighten"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.settingText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {template.settings.length} chars
                    </Text>
                  </View>
                  <View style={styles.settingItem}>
                    <MaterialIcons
                      name="security"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.settingText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {template.settings.includeSymbols
                        ? 'All chars'
                        : 'No symbols'}
                    </Text>
                  </View>
                </View>

                <View style={styles.exampleContainer}>
                  <Text
                    style={[
                      styles.exampleLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Example:
                  </Text>
                  <Text
                    style={[
                      styles.exampleText,
                      styles.monospaceText,
                      { color: theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {template.examples[0]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2; // 20px margin + 20px gap

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  templateCard: {
    width: cardWidth,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  templateSettings: {
    gap: 6,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingText: {
    fontSize: 12,
  },
  exampleContainer: {
    borderTopWidth: 0.5,
    borderTopColor: '#333',
    paddingTop: 8,
  },
  exampleLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 11,
    opacity: 0.8,
  },
  spacer: {
    width: 24,
  },
  monospaceText: {
    fontFamily: 'monospace',
  },
});
