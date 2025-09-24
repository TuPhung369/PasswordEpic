import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "../../hooks/redux";
import { RootState } from "../../store";
import { MaterialIcons } from "@expo/vector-icons";

export const GeneratorScreen: React.FC = () => {
  const { generator } = useAppSelector((state: RootState) => state.settings);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [length, setLength] = useState(generator.defaultLength.toString());

  const generatePassword = () => {
    // TODO: Implement actual password generation
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < parseInt(length); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(result);
  };

  const copyToClipboard = () => {
    // TODO: Implement clipboard functionality
    console.log("Copied to clipboard:", generatedPassword);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Generate</Text>
        <Text style={styles.subtitle}>Create secure passwords</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <View style={styles.passwordContainer}>
              <View style={styles.passwordHeader}>
                <MaterialIcons name="vpn-key" size={20} color="#007AFF" />
                <Text style={styles.passwordLabel}>Generated Password</Text>
              </View>
              <View style={styles.passwordDisplay}>
                <Text style={styles.passwordText}>
                  {generatedPassword ||
                    "Tap Generate to create a secure password"}
                </Text>
                {generatedPassword && (
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={copyToClipboard}
                  >
                    <MaterialIcons
                      name="content-copy"
                      size={18}
                      color="#007AFF"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generatePassword}
              >
                <MaterialIcons name="refresh" size={20} color="#ffffff" />
                <Text style={styles.generateButtonText}>
                  Generate New Password
                </Text>
              </TouchableOpacity>
              {generatedPassword && (
                <TouchableOpacity style={styles.saveButton}>
                  <MaterialIcons name="save" size={18} color="#007AFF" />
                  <Text style={styles.saveButtonText}>Save to Vault</Text>
                </TouchableOpacity>
              )}
            </View>

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
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  onEndEditing={Keyboard.dismiss}
                  blurOnSubmit={true}
                />
              </View>

              <View style={styles.setting}>
                <Text style={styles.settingLabel}>Include Uppercase</Text>
                <Switch
                  value={generator.includeUppercase}
                  onValueChange={() => {}}
                  trackColor={{ false: "#333333", true: "#007AFF" }}
                />
              </View>

              <View style={styles.setting}>
                <Text style={styles.settingLabel}>Include Lowercase</Text>
                <Switch
                  value={generator.includeLowercase}
                  onValueChange={() => {}}
                  trackColor={{ false: "#333333", true: "#007AFF" }}
                />
              </View>

              <View style={styles.setting}>
                <Text style={styles.settingLabel}>Include Numbers</Text>
                <Switch
                  value={generator.includeNumbers}
                  onValueChange={() => {}}
                  trackColor={{ false: "#333333", true: "#007AFF" }}
                />
              </View>

              <View style={styles.setting}>
                <Text style={styles.settingLabel}>Include Symbols</Text>
                <Switch
                  value={generator.includeSymbols}
                  onValueChange={() => {}}
                  trackColor={{ false: "#333333", true: "#007AFF" }}
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
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#38383A",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  passwordContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: "#38383A",
    overflow: "hidden",
  },
  passwordHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#2C2C2E",
    gap: 8,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  passwordDisplay: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    minHeight: 60,
  },
  passwordText: {
    flex: 1,
    fontSize: 16,
    color: "#ffffff",
    fontFamily: "monospace",
    lineHeight: 22,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 32,
  },
  generateButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  generateButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#1C1C1E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#007AFF",
    gap: 8,
  },
  saveButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  settings: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
  },
  setting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "#38383A",
  },
  settingLabel: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "500",
  },
  lengthInput: {
    backgroundColor: "#2C2C2E",
    color: "#ffffff",
    padding: 12,
    borderRadius: 8,
    minWidth: 70,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
});

