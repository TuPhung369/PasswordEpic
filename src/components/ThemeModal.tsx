import React from 'react';
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
import { useTranslation } from 'react-i18next';

interface ThemeOption {
  key: 'light' | 'dark' | 'system';
  labelKey: string;
  descriptionKey: string;
  icon: string;
}

const themeOptions: ThemeOption[] = [
  {
    key: 'light',
    labelKey: 'theme_modal.light',
    descriptionKey: 'theme_modal.light_description',
    icon: 'sunny-outline',
  },
  {
    key: 'dark',
    labelKey: 'theme_modal.dark',
    descriptionKey: 'theme_modal.dark_description',
    icon: 'moon-outline',
  },
  {
    key: 'system',
    labelKey: 'theme_modal.system',
    descriptionKey: 'theme_modal.system_description',
    icon: 'phone-portrait-outline',
  },
];

interface ThemeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ visible, onClose }) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { t } = useTranslation();

  const handleThemeSelect = (selectedTheme: 'light' | 'dark' | 'system') => {
    setThemeMode(selectedTheme);
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
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('theme_modal.title')}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content}>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {t('theme_modal.description')}
          </Text>

          <View style={styles.optionsList}>
            {themeOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.option,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    ...(themeMode === option.key && {
                      borderColor: theme.primary,
                      borderWidth: 2,
                    }),
                  },
                ]}
                onPress={() => handleThemeSelect(option.key)}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.iconContainer,
                        {
                          backgroundColor:
                            themeMode === option.key
                              ? theme.primary
                              : theme.surface,
                        },
                      ]}
                    >
                      <Ionicons
                        name={option.icon}
                        size={24}
                        color={
                          themeMode === option.key ? '#FFFFFF' : theme.primary
                        }
                      />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, { color: theme.text }]}>
                        {t(option.labelKey)}
                      </Text>
                      <Text
                        style={[
                          styles.optionDescription,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t(option.descriptionKey)}
                      </Text>
                    </View>
                  </View>
                  {themeMode === option.key && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.primary}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  optionsList: {
    gap: 12,
  },
  option: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
});
