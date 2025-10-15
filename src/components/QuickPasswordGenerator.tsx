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
import { DEFAULT_PRESETS } from './GeneratorPresets';
import { passwordGeneratorService } from '../services/passwordGeneratorService';
import type { GeneratorPreset } from '../services/passwordGeneratorService';

interface QuickPasswordGeneratorProps {
  visible: boolean;
  onClose: () => void;
  onSelectPassword: (password: string) => void;

  // Remove PresetOption, use GeneratorPreset everywhere
  // Removed PresetOption, use GeneratorPreset everywhere
}

// Use DEFAULT_PRESETS from GeneratorPresets

export const QuickPasswordGenerator: React.FC<QuickPasswordGeneratorProps> = ({
  visible,
  onClose,
  onSelectPassword,
}) => {
  const { theme } = useTheme();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handleSelectPreset = (preset: GeneratorPreset) => {
    setSelectedPreset(preset.id);
    try {
      let password = '';
      if (preset.id === 'memorable') {
        password = passwordGeneratorService.generateMemorablePassword(
          preset.options.length,
        );
      } else if (preset.id === 'passphrase') {
        password = passwordGeneratorService.generatePatternPassword('WwNwY');
      } else if (preset.id === 'wifi') {
        password = passwordGeneratorService.generatePatternPassword('ZNNY');
      } else {
        password = generateSecurePassword(preset.options);
      }
      onSelectPassword(password);
      setTimeout(() => {
        setSelectedPreset(null);
        onClose();
      }, 300);
    } catch (error) {
      console.error('Failed to generate password:', error);
      setSelectedPreset(null);
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
            {DEFAULT_PRESETS.map((preset: GeneratorPreset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetButton,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectedPreset === preset.id && {
                    borderColor: preset.color,
                    backgroundColor: `${preset.color}10`,
                  },
                ]}
                onPress={() => handleSelectPreset(preset)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.presetIcon,
                    { backgroundColor: `${preset.color}20` },
                  ]}
                >
                  <Ionicons
                    name={preset.icon as any}
                    size={24}
                    color={preset.color}
                  />
                </View>
                <View style={styles.presetInfo}>
                  <Text
                    style={[
                      styles.presetName,
                      { color: theme.text },
                      selectedPreset === preset.id && { color: preset.color },
                    ]}
                  >
                    {preset.name}
                  </Text>
                  <Text
                    style={[
                      styles.presetDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {preset.description}
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
