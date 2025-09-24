import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppDispatch } from "../../hooks/redux";
import {
  loginStart,
  loginSuccess,
  loginFailure,
} from "../../store/slices/authSlice";
import { useTheme } from "../../contexts/ThemeContext";

export const LoginScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { theme } = useTheme();

  const handleGoogleSignIn = async () => {
    try {
      dispatch(loginStart());

      // TODO: Implement actual Google Sign-In
      // For now, simulate successful login
      setTimeout(() => {
        dispatch(
          loginSuccess({
            uid: "demo-user-id",
            email: "demo@example.com",
            displayName: "Demo User",
            photoURL: null,
          })
        );
      }, 1000);
    } catch (error) {
      dispatch(loginFailure("Failed to sign in with Google"));
      Alert.alert("Error", "Failed to sign in with Google");
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Sign in to access your secure password vault
        </Text>

        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: theme.primary }]}
          onPress={handleGoogleSignIn}
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={[styles.securityNote, { color: theme.textSecondary }]}>
          🔒 Your data is encrypted end-to-end and never stored on our servers
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#cccccc",
    textAlign: "center",
    marginBottom: 48,
  },
  googleButton: {
    backgroundColor: "#4285F4",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 250,
    marginBottom: 32,
  },
  googleButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  securityNote: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 20,
  },
});

