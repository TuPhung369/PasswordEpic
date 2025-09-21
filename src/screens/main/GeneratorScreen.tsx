import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  TextInput,
} from 'react-native';
import {useAppSelector} from '../../hooks/redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

export const GeneratorScreen: React.FC = () => {
  const {generator} = useAppSelector(state => state.settings);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [length, setLength] = useState(generator.defaultLength.toString());

  const generatePassword = () => {
    // TODO: Implement actual password generation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < parseInt(length); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(result);
  };

  const copyToClipboard = () => {
    // TODO: Implement clipboard functionality
    console.log('Copied to clipboard:', generatedPassword);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Password Generator</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.passwordContainer}>
          <Text style={styles.passwordText}>
            {generatedPassword || 'Tap Generate to create a password'}
          </Text>
          {generatedPassword && (
            <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
              <Icon name="content-copy" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.generateButton} onPress={generatePassword}>
          <Text style={styles.generateButtonText}>Generate Password</Text>
        </TouchableOpacity>

        <View style={styles.settings}>
          <Text style={styles.settingsTitle}>Settings</Text>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Length</Text>
            <TextInput
              style={styles.lengthInput}
              value={length}
              onChangeText={setLength}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Include Uppercase</Text>
            <Switch
              value={generator.includeUppercase}
              onValueChange={() => {}}
              trackColor={{false: '#333333', true: '#007AFF'}}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Include Lowercase</Text>
            <Switch
              value={generator.includeLowercase}
              onValueChange={() => {}}
              trackColor={{false: '#333333', true: '#007AFF'}}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Include Numbers</Text>
            <Switch
              value={generator.includeNumbers}
              onValueChange={() => {}}
              trackColor={{false: '#333333', true: '#007AFF'}}
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Include Symbols</Text>
            <Switch
              value={generator.includeSymbols}
              onValueChange={() => {}}
              trackColor={{false: '#333333', true: '#007AFF'}}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  passwordContainer: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  settings: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  lengthInput: {
    backgroundColor: '#333333',
    color: '#ffffff',
    padding: 8,
    borderRadius: 6,
    minWidth: 60,
    textAlign: 'center',
  },
});