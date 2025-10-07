import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { GeneratorPreset } from '../services/passwordGeneratorService';

export const DEFAULT_PRESETS: GeneratorPreset[] = [
  {
    id: 'strong',
    name: 'Strong',
    description: 'Maximum security for critical accounts',
    icon: 'security',
    color: '#4CAF50',
    options: {
      length: 20,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true,
      excludeAmbiguous: false,
      minNumbers: 3,
      minSymbols: 2,
    },
  },
  {
    id: 'memorable',
    name: 'Memorable',
    description: 'Easy to pronounce and remember',
    icon: 'psychology',
    color: '#2196F3',
    options: {
      length: 16,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: true,
      excludeAmbiguous: false,
      minNumbers: 2,
      minSymbols: 0,
    },
  },
  {
    id: 'pin',
    name: 'PIN',
    description: 'Numeric PIN codes',
    icon: 'pin',
    color: '#FF9800',
    options: {
      length: 6,
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: false,
      excludeAmbiguous: false,
      minNumbers: 0,
      minSymbols: 0,
    },
  },
  {
    id: 'passphrase',
    name: 'Passphrase',
    description: 'Word combinations like "BlueSky2024Fast"',
    icon: 'article',
    color: '#9C27B0',
    options: {
      length: 24,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: true,
      excludeAmbiguous: false,
      minNumbers: 3,
      minSymbols: 0,
    },
  },
  {
    id: 'wifi',
    name: 'WiFi',
    description: 'Easy to share like "HomeNet2024"',
    icon: 'wifi',
    color: '#607D8B',
    options: {
      length: 12,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: true,
      excludeAmbiguous: false,
      minNumbers: 2,
      minSymbols: 0,
    },
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Simple passwords for low-risk accounts',
    icon: 'lock-outline',
    color: '#795548',
    options: {
      length: 12,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: false,
      excludeSimilar: true,
      excludeAmbiguous: false,
      minNumbers: 2,
      minSymbols: 0,
    },
  },
];

interface GeneratorPresetsProps {
  onSelectPreset: (preset: GeneratorPreset) => void;
  currentPreset?: GeneratorPreset | null;
  compact?: boolean;
  grid?: boolean; // New prop for 2-row grid layout
}

export const GeneratorPresets: React.FC<GeneratorPresetsProps> = ({
  onSelectPreset,
  currentPreset,
  compact = false,
  grid = false,
}) => {
  const { theme } = useTheme();

  const renderPresetButton = (preset: GeneratorPreset) => {
    const isSelected = currentPreset?.id === preset.id;

    if (grid) {
      return (
        <TouchableOpacity
          key={preset.id}
          style={[
            styles.gridPresetButton,
            { backgroundColor: theme.card, borderColor: theme.border },
            isSelected && {
              borderColor: preset.color,
              backgroundColor: `${preset.color}10`,
            },
          ]}
          onPress={() => onSelectPreset(preset)}
        >
          <View
            style={[
              styles.gridPresetIcon,
              { backgroundColor: `${preset.color}20` },
            ]}
          >
            <MaterialIcons
              name={preset.icon as any}
              size={18}
              color={preset.color}
            />
          </View>
          <Text
            style={[
              styles.gridPresetName,
              { color: theme.text },
              isSelected && { color: preset.color },
            ]}
          >
            {preset.name}
          </Text>
          {isSelected && (
            <MaterialIcons
              name="check-circle"
              size={16}
              color={preset.color}
              style={styles.checkIcon}
            />
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={preset.id}
        style={[
          compact ? styles.compactPresetButton : styles.presetButton,
          { backgroundColor: theme.card, borderColor: theme.border },
          isSelected && {
            borderColor: preset.color,
            backgroundColor: `${preset.color}10`,
          },
        ]}
        onPress={() => onSelectPreset(preset)}
      >
        <View
          style={[
            compact ? styles.compactPresetIcon : styles.presetIcon,
            { backgroundColor: `${preset.color}20` },
          ]}
        >
          <MaterialIcons
            name={preset.icon as any}
            size={compact ? 16 : 20}
            color={preset.color}
          />
        </View>

        <View style={styles.presetInfo}>
          <Text
            style={[
              compact ? styles.compactPresetName : styles.presetName,
              { color: theme.text },
              isSelected && { color: preset.color },
            ]}
          >
            {preset.name}
          </Text>
          {!compact && (
            <Text
              style={[styles.presetDescription, { color: theme.textSecondary }]}
            >
              {preset.description}
            </Text>
          )}
        </View>

        {!compact && (
          <View style={styles.presetSettings}>
            <Text style={[styles.settingBadge, { color: theme.textSecondary }]}>
              {preset.options.length} chars
            </Text>
            <Text style={[styles.settingBadge, { color: theme.textSecondary }]}>
              {getCharacterTypes(preset.options)}
            </Text>
          </View>
        )}

        {isSelected && (
          <MaterialIcons
            name="check-circle"
            size={20}
            color={preset.color}
            style={styles.checkIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  const getCharacterTypes = (options: GeneratorPreset['options']) => {
    const types = [];
    if (options.includeUppercase) types.push('A-Z');
    if (options.includeLowercase) types.push('a-z');
    if (options.includeNumbers) types.push('0-9');
    if (options.includeSymbols) types.push('!@#');
    return types.join('');
  };

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.compactContainer}
        contentContainerStyle={styles.compactContent}
      >
        {DEFAULT_PRESETS.map(renderPresetButton)}
      </ScrollView>
    );
  }

  if (grid) {
    return (
      <View style={styles.gridContainer}>
        <View style={styles.gridRow}>
          {DEFAULT_PRESETS.slice(0, 3).map(renderPresetButton)}
        </View>
        <View style={styles.gridRow}>
          {DEFAULT_PRESETS.slice(3, 6).map(renderPresetButton)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Quick Presets</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Choose a preset to quickly configure your password generator
      </Text>

      <ScrollView
        style={styles.presetsList}
        showsVerticalScrollIndicator={false}
      >
        {DEFAULT_PRESETS.map(renderPresetButton)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  presetsList: {
    maxHeight: 400,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    position: 'relative',
  },
  presetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  presetSettings: {
    alignItems: 'flex-end',
    gap: 4,
    marginRight: 8,
  },
  settingBadge: {
    fontSize: 11,
    opacity: 0.8,
  },
  checkIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  compactContainer: {
    marginVertical: 16,
  },
  compactContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  compactPresetButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  compactPresetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactPresetName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridPresetButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
    minHeight: 80,
  },
  gridPresetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridPresetName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
