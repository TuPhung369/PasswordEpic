import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { RootState } from '../../store';
import { updateGeneratorSettings } from '../../store/slices/settingsSlice';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../contexts/ThemeContext';
import { usePasswordGenerator } from '../../hooks/usePasswordGenerator';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { GeneratorPresets } from '../../components/GeneratorPresets';
import {
  PasswordTemplate,
  DEFAULT_TEMPLATES,
} from '../../components/PasswordTemplates';
import { GeneratorPreset } from '../../services/passwordGeneratorService';
import { MainTabParamList } from '../../navigation/MainNavigator';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';

type GeneratorScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Generator'>,
  NativeStackNavigationProp<PasswordsStackParamList>
>;

export const GeneratorScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<GeneratorScreenNavigationProp>();
  const { generator } = useAppSelector((state: RootState) => state.settings);
  const { theme } = useTheme();
  const {
    currentPassword: generatedPassword,
    generatePassword: generatePasswordAsync,
    usePreset: applyPreset,
    copyToClipboard,
  } = usePasswordGenerator();

  const [length, setLength] = useState(generator.defaultLength);
  const [selectedPreset, setSelectedPreset] = useState<GeneratorPreset | null>(
    null,
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<PasswordTemplate | null>(null);

  const handleSelectPreset = async (preset: GeneratorPreset) => {
    setSelectedPreset(preset);
    // Reset selected template when choosing a preset
    setSelectedTemplate(null);
    await applyPreset(preset.id);
  };

  const handleSelectTemplate = async (template: PasswordTemplate) => {
    setSelectedTemplate(template);
    // Reset selected preset when choosing a template
    setSelectedPreset(null);
    // Apply template settings to generator
    dispatch(
      updateGeneratorSettings({
        defaultLength: template.settings.length,
        includeUppercase: template.settings.includeUppercase,
        includeLowercase: template.settings.includeLowercase,
        includeNumbers: template.settings.includeNumbers,
        includeSymbols: template.settings.includeSymbols,
      }),
    );
    setLength(template.settings.length);
  };

  const handleGeneratePassword = async () => {
    try {
      await generatePasswordAsync({
        length,
        includeUppercase: generator.includeUppercase,
        includeLowercase: generator.includeLowercase,
        includeNumbers: generator.includeNumbers,
        includeSymbols: generator.includeSymbols,
        excludeSimilar: true,
        excludeAmbiguous: false,
      });
      // Reset selections when manually generating password
      setSelectedPreset(null);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error generating password:', error);
    }
  };

  const handleCopyToClipboard = async () => {
    if (generatedPassword) {
      await copyToClipboard(generatedPassword);
    }
  };

  const handleSaveToVault = () => {
    if (generatedPassword) {
      // Navigate to Passwords tab, then to AddPassword screen with the generated password
      navigation.navigate('Passwords', {
        screen: 'AddPassword',
        params: { generatedPassword },
      });
    }
  };

  const updateLength = (newLength: number) => {
    setLength(newLength);
    dispatch(updateGeneratorSettings({ defaultLength: newLength }));
    // Reset selections when manually changing settings
    setSelectedPreset(null);
    setSelectedTemplate(null);
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
    // Reset selections when manually changing settings
    setSelectedPreset(null);
    setSelectedTemplate(null);
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
    // Reset selections when manually changing settings
    setSelectedPreset(null);
    setSelectedTemplate(null);
  };

  const toggleNumbers = () => {
    if (!canToggleOff('includeNumbers')) {
      return;
    }
    dispatch(
      updateGeneratorSettings({ includeNumbers: !generator.includeNumbers }),
    );
    // Reset selections when manually changing settings
    setSelectedPreset(null);
    setSelectedTemplate(null);
  };

  const toggleSymbols = () => {
    if (!canToggleOff('includeSymbols')) {
      return;
    }
    dispatch(
      updateGeneratorSettings({ includeSymbols: !generator.includeSymbols }),
    );
    // Reset selections when manually changing settings
    setSelectedPreset(null);
    setSelectedTemplate(null);
  };

  const getEnabledOptionsCount = () => {
    return [
      generator.includeUppercase,
      generator.includeLowercase,
      generator.includeNumbers,
      generator.includeSymbols,
    ].filter(Boolean).length;
  };

  const isLastEnabledOption = (option: keyof typeof generator): boolean => {
    return getEnabledOptionsCount() === 1 && Boolean(generator[option]);
  };

  const getCheckboxStyle = (isEnabled: boolean) => [
    styles.checkbox,
    {
      borderColor: isEnabled ? theme.primary : theme.border,
      backgroundColor: isEnabled ? `${theme.primary}20` : 'transparent',
    },
  ];

  const getCheckboxLabelStyle = (isEnabled: boolean) => [
    styles.checkboxLabel,
    {
      color: isEnabled ? theme.text : theme.textSecondary,
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>🔐 Generate</Text>
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
                <Ionicons name="key-outline" size={20} color={theme.primary} />
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
                    onPress={handleCopyToClipboard}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={theme.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {generatedPassword && (
              <PasswordStrengthMeter
                password={generatedPassword}
                compact={true}
              />
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleGeneratePassword}
              >
                <Ionicons name="refresh-outline" size={20} color="#ffffff" />
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
                  onPress={handleSaveToVault}
                >
                  <Ionicons
                    name="save-outline"
                    size={18}
                    color={theme.primary}
                  />
                  <Text
                    style={[styles.saveButtonText, { color: theme.primary }]}
                  >
                    Save to Vault
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <GeneratorPresets
              onSelectPreset={handleSelectPreset}
              currentPreset={selectedPreset}
              grid={true}
            />

            {/* Templates Section - Improved Layout */}
            <View style={styles.templatesSection}>
              <Text
                style={[styles.templatesSectionTitle, { color: theme.text }]}
              >
                Choose Template
              </Text>

              <View style={styles.templatesGrid}>
                {DEFAULT_TEMPLATES.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.templateChip,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                      selectedTemplate?.id === item.id && {
                        borderColor: item.color,
                        backgroundColor: `${item.color}15`,
                      },
                    ]}
                    onPress={() => handleSelectTemplate(item)}
                  >
                    <View
                      style={[
                        styles.templateChipIcon,
                        { backgroundColor: `${item.color}20` },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={item.color}
                      />
                    </View>
                    <Text
                      style={[styles.templateChipText, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {selectedTemplate?.id === item.id && (
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color={item.color}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settings}>
              <Text style={[styles.settingsTitle, { color: theme.text }]}>
                Settings
              </Text>

              <View
                style={[
                  styles.settingCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                {/* Length Slider */}
                <View style={styles.sliderSection}>
                  <View style={styles.sliderHeader}>
                    <Text style={[styles.settingLabel, { color: theme.text }]}>
                      Length
                    </Text>
                    <Text
                      style={[styles.lengthValue, { color: theme.primary }]}
                    >
                      {length}
                    </Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={10}
                    maximumValue={50}
                    value={length}
                    onValueChange={value => updateLength(Math.round(value))}
                    step={1}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor={theme.border}
                    thumbTintColor={theme.primary}
                  />
                </View>

                {/* Divider */}
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />

                {/* Include Options */}
                <View>
                  <Text style={[styles.includeLabel, { color: theme.text }]}>
                    Include
                  </Text>
                  <View style={styles.checkboxGrid}>
                    {/* Row 1 */}
                    <View style={styles.checkboxRow}>
                      <TouchableOpacity
                        style={styles.checkboxItem}
                        onPress={toggleUppercase}
                        disabled={isLastEnabledOption('includeUppercase')}
                      >
                        <View
                          style={getCheckboxStyle(generator.includeUppercase)}
                        >
                          {generator.includeUppercase && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={theme.primary}
                            />
                          )}
                        </View>
                        <Text
                          style={getCheckboxLabelStyle(
                            generator.includeUppercase,
                          )}
                        >
                          A-Z
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.checkboxItem}
                        onPress={toggleLowercase}
                        disabled={isLastEnabledOption('includeLowercase')}
                      >
                        <View
                          style={getCheckboxStyle(generator.includeLowercase)}
                        >
                          {generator.includeLowercase && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={theme.primary}
                            />
                          )}
                        </View>
                        <Text
                          style={getCheckboxLabelStyle(
                            generator.includeLowercase,
                          )}
                        >
                          a-z
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Row 2 */}
                    <View style={styles.checkboxRow}>
                      <TouchableOpacity
                        style={styles.checkboxItem}
                        onPress={toggleNumbers}
                        disabled={isLastEnabledOption('includeNumbers')}
                      >
                        <View
                          style={getCheckboxStyle(generator.includeNumbers)}
                        >
                          {generator.includeNumbers && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={theme.primary}
                            />
                          )}
                        </View>
                        <Text
                          style={getCheckboxLabelStyle(
                            generator.includeNumbers,
                          )}
                        >
                          0-9
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.checkboxItem}
                        onPress={toggleSymbols}
                        disabled={isLastEnabledOption('includeSymbols')}
                      >
                        <View
                          style={getCheckboxStyle(generator.includeSymbols)}
                        >
                          {generator.includeSymbols && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={theme.primary}
                            />
                          )}
                        </View>
                        <Text
                          style={getCheckboxLabelStyle(
                            generator.includeSymbols,
                          )}
                        >
                          !@#
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  passwordContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    marginBottom: 16,
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
    paddingTop: 0,
    paddingBottom: 16,
    paddingHorizontal: 16,
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
    marginBottom: 24,
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
    marginBottom: 12,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  sliderSection: {
    marginBottom: 12,
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
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.3,
  },
  includeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  checkboxGrid: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  checkboxItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 28,
  },
  templatesSection: {
    marginBottom: 20,
  },
  templatesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  templateChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
    minHeight: 44,
  },
  templateChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
