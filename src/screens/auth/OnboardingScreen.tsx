import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../navigation/AuthNavigator";
import { useTheme } from "../../contexts/ThemeContext";

type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Onboarding"
>;

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const { theme } = useTheme();

  const handleGetStarted = () => {
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>PasswordEpic</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Ultra-Secure Mobile Password Manager
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Protect your digital life with military-grade encryption and seamless
          auto-fill functionality.
        </Text>

        <View style={styles.features}>
          <Text style={[styles.feature, { color: theme.text }]}>
            🔐 Zero-Knowledge Architecture
          </Text>
          <Text style={[styles.feature, { color: theme.text }]}>
            🛡️ Biometric Authentication
          </Text>
          <Text style={[styles.feature, { color: theme.text }]}>
            ⚡ Secure Auto-fill
          </Text>
          <Text style={[styles.feature, { color: theme.text }]}>
            🔒 End-to-End Encryption
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleGetStarted}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "600",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
  },
  features: {
    alignSelf: "stretch",
    marginBottom: 48,
  },
  feature: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});

