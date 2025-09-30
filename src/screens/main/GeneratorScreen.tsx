import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState } from '../../store';
import { updateGeneratorSettings } from '../../store/slices/settingsSlice';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';

export const GeneratorScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { generator } = useAppSelector((state: RootState) => state.settings);
  const { theme } = useTheme();
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [length, setLength] = useState(generator.defaultLength);

  const generatePassword = () => {
    let chars = '';

    if (generator.includeUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (generator.includeLowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (generator.includeNumbers) chars += '0123456789';
    if (generator.includeSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    // chars should never be empty now due to validation
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(result);
  };
  const copyToClipboard = () => {
    // TODO: Implement clipboard functionality
    console.log('Copied to clipboard:', generatedPassword);
  };

  const updateLength = (newLength: number) => {
    setLength(newLength);
    dispatch(updateGeneratorSettings({ defaultLength: newLength }));
  };

  const canToggleOff = (currentOption: keyof typeof generator) => {
    const options = [
      'includeUppercase',
      'includeLowercase',
      'includeNumbers',
      'includeSymbols',
    ];
    const enabledCount = options.filter(
      option => generator[option as keyof typeof generator],
    ).length;

    // Nếu chỉ còn 1 option ON và đang cố tắt option đó, thì không cho phép
    if (enabledCount === 1 && generator[currentOption]) {
      return false;
    }
    return true;
  };

  const toggleUppercase = () => {
    if (!canToggleOff('includeUppercase')) {
      // TODO: Show toast/alert "At least one option must be enabled"
      return;
    }
    dispatch(
      updateGeneratorSettings({
        includeUppercase: !generator.includeUppercase,
      }),
    );
  };

  const toggleLowercase = () => {
    if (!canToggleOff('includeLowercase')) {
      return;
    }
    dispatch(
      updateGeneratorSettings({
        includeLowercase: !generator.includeLowercase,
      }),
    );
  };

  const toggleNumbers = () => {
    if (!canToggleOff('includeNumbers')) {
      return;
    }
    dispatch(
      updateGeneratorSettings({ includeNumbers: !generator.includeNumbers }),
    );
  };

  const toggleSymbols = () => {
    if (!canToggleOff('includeSymbols')) {
      return;
    }
    dispatch(
      updateGeneratorSettings({ includeSymbols: !generator.includeSymbols }),
    );
  };

  const getEnabledOptionsCount = () => {
    return [
      generator.includeUppercase,
      generator.includeLowercase,
      generator.includeNumbers,
      generator.includeSymbols,
    ].filter(Boolean).length;
  };

  const isLastEnabledOption = (option: keyof typeof generator) => {
    return getEnabledOptionsCount() === 1 && generator[option];
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>🔐 Generate</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Create secure passwords
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <View
              style={[
                styles.passwordContainer,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.passwordHeader,
                  { backgroundColor: theme.surface },
                ]}
              >
                <MaterialIcons name="vpn-key" size={20} color={theme.primary} />
                <Text
                  style={[styles.passwordLabel, { color: theme.textSecondary }]}
                >
                  Generated Password
                </Text>
              </View>
              <View style={styles.passwordDisplay}>
                <Text style={[styles.passwordText, { color: theme.text }]}>
                  {generatedPassword ||
                    'Tap Generate to create a secure password'}
                </Text>
                {generatedPassword && (
                  <TouchableOpacity
                    style={[
                      styles.copyButton,
                      { backgroundColor: theme.surface },
                    ]}
                    onPress={copyToClipboard}
                  >
                    <MaterialIcons
                      name="content-copy"
                      size={18}
                      color={theme.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={generatePassword}
              >
                <MaterialIcons name="refresh" size={20} color="#ffffff" />
                <Text style={styles.generateButtonText}>
                  Generate New Password
                </Text>
              </TouchableOpacity>
              {generatedPassword && (
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: theme.card, borderColor: theme.primary },
                  ]}
                >
                  <MaterialIcons name="save" size={18} color={theme.primary} />
                  <Text
                    style={[styles.saveButtonText, { color: theme.primary }]}
                  >
                    Save to Vault
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.settings}>
              <Text style={[styles.settingsTitle, { color: theme.text }]}>
                Settings
              </Text>

              <View
                style={[
                  styles.setting,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.sliderHeader}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>
                    Length
                  </Text>
                  <Text style={[styles.lengthValue, { color: theme.primary }]}>
                    {length}
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={8}
                  maximumValue={32}
                  value={length}
                  onValueChange={value => updateLength(Math.round(value))}
                  step={1}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
              </View>

              <View
                style={[
                  styles.switchSetting,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: isLastEnabledOption('includeUppercase') ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Include Uppercase
                  {isLastEnabledOption('includeUppercase') && (
                    <Text
                      style={[styles.requiredText, { color: theme.primary }]}
                    >
                      {' '}
                      *
                    </Text>
                  )}
                </Text>
                <Switch
                  value={generator.includeUppercase}
                  onValueChange={toggleUppercase}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={
                    generator.includeUppercase
                      ? theme.background
                      : theme.textSecondary
                  }
                />
              </View>

              <View
                style={[
                  styles.switchSetting,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: isLastEnabledOption('includeLowercase') ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Include Lowercase
                  {isLastEnabledOption('includeLowercase') && (
                    <Text
                      style={[styles.requiredText, { color: theme.primary }]}
                    >
                      {' '}
                      *
                    </Text>
                  )}
                </Text>
                <Switch
                  value={generator.includeLowercase}
                  onValueChange={toggleLowercase}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={
                    generator.includeLowercase
                      ? theme.background
                      : theme.textSecondary
                  }
                />
              </View>

              <View
                style={[
                  styles.switchSetting,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: isLastEnabledOption('includeNumbers') ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Include Numbers
                  {isLastEnabledOption('includeNumbers') && (
                    <Text
                      style={[styles.requiredText, { color: theme.primary }]}
                    >
                      {' '}
                      *
                    </Text>
                  )}
                </Text>
                <Switch
                  value={generator.includeNumbers}
                  onValueChange={toggleNumbers}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={
                    generator.includeNumbers
                      ? theme.background
                      : theme.textSecondary
                  }
                />
              </View>

              <View
                style={[
                  styles.switchSetting,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: isLastEnabledOption('includeSymbols') ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.settingLabel, { color: theme.text }]}>
                  Include Symbols
                  {isLastEnabledOption('includeSymbols') && (
                    <Text
                      style={[styles.requiredText, { color: theme.primary }]}
                    >
                      {' '}
                      *
                    </Text>
                  )}
                </Text>
                <Switch
                  value={generator.includeSymbols}
                  onValueChange={toggleSymbols}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={
                    generator.includeSymbols
                      ? theme.background
                      : theme.textSecondary
                  }
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  passwordContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: '#38383A',
    overflow: 'hidden',
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    gap: 8,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  passwordDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 60,
  },
  passwordText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'monospace',
    lineHeight: 22,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 32,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1C1C1E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  saveButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settings: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  setting: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  switchSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  lengthValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  requiredText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
