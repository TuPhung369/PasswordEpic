import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import {
  signInWithGoogleNative,
  NativeGoogleAuthResult,
} from "../services/googleAuthNative";
import {
  signInWithGoogleExpo,
  ExpoGoogleAuthResult,
} from "../services/expoGoogleAuth";

export const GoogleAuthTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const testNativeGoogleAuth = async () => {
    setLoading(true);
    setResult("Testing Native Google Auth...");

    try {
      const authResult: NativeGoogleAuthResult = await signInWithGoogleNative();

      if (authResult.success) {
        setResult(
          `✅ Native Auth Success!\nUser: ${authResult.user?.name}\nEmail: ${authResult.user?.email}`
        );
        Alert.alert("Success!", `Welcome ${authResult.user?.name}!`);
      } else {
        setResult(`❌ Native Auth Failed: ${authResult.error}`);
        Alert.alert("Error", authResult.error || "Authentication failed");
      }
    } catch (error: any) {
      setResult(`❌ Native Auth Error: ${error.message}`);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const testExpoGoogleAuth = async () => {
    setLoading(true);
    setResult("Testing Expo Google Auth...");

    try {
      const authResult: ExpoGoogleAuthResult = await signInWithGoogleExpo();

      if (authResult.success) {
        setResult(
          `✅ Expo Auth Success!\nUser: ${authResult.user?.name}\nEmail: ${authResult.user?.email}`
        );
        Alert.alert("Success!", `Welcome ${authResult.user?.name}!`);
      } else {
        setResult(`❌ Expo Auth Failed: ${authResult.error}`);
        Alert.alert("Error", authResult.error || "Authentication failed");
      }
    } catch (error: any) {
      setResult(`❌ Expo Auth Error: ${error.message}`);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 Google Auth Test</Text>

      <TouchableOpacity
        style={[styles.button, styles.nativeButton]}
        onPress={testNativeGoogleAuth}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "⏳ Testing..." : "🚀 Test Native Google Auth"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.expoButton]}
        onPress={testExpoGoogleAuth}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "⏳ Testing..." : "📱 Test Expo Google Auth"}
        </Text>
      </TouchableOpacity>

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>📋 Result:</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: "center",
  },
  nativeButton: {
    backgroundColor: "#4285F4",
  },
  expoButton: {
    backgroundColor: "#000020",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  resultText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
});
