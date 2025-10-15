import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  signInWithGoogleNative,
  GoogleAuthResult,
} from '../services/googleAuthNative';
import ConfirmDialog from './ConfirmDialog';

export const GoogleAuthTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [dialogState, setDialogState] = useState({
    visible: false,
    title: '',
    message: '',
    confirmStyle: 'default' as 'default' | 'destructive',
  });

  const testNativeGoogleAuth = async () => {
    setLoading(true);
    setResult('Testing Native Google Auth...');

    try {
      const authResult: GoogleAuthResult = await signInWithGoogleNative();

      if (authResult.success) {
        setResult(
          `✅ Native Auth Success!\nUser: ${authResult.user?.name}\nEmail: ${authResult.user?.email}`,
        );
        setDialogState({
          visible: true,
          title: 'Success!',
          message: `Welcome ${authResult.user?.name}!`,
          confirmStyle: 'default',
        });
      } else {
        setResult(`❌ Native Auth Failed: ${authResult.error}`);
        setDialogState({
          visible: true,
          title: 'Error',
          message: authResult.error || 'Authentication failed',
          confirmStyle: 'destructive',
        });
      }
    } catch (error: any) {
      setResult(`❌ Native Auth Error: ${error.message}`);
      setDialogState({
        visible: true,
        title: 'Error',
        message: error.message,
        confirmStyle: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testNativeGoogleAuthOnly = async () => {
    setLoading(true);
    setResult('Testing Native Google Auth (Fixed)...');

    try {
      const authResult: GoogleAuthResult = await signInWithGoogleNative();

      if (authResult.success) {
        setResult(
          `✅ Native Auth Success!\nUser: ${authResult.user?.name}\nEmail: ${authResult.user?.email}`,
        );
        setDialogState({
          visible: true,
          title: 'Success!',
          message: `Welcome ${authResult.user?.name}!`,
          confirmStyle: 'default',
        });
      } else {
        setResult(`❌ Native Auth Failed: ${authResult.error}`);
        setDialogState({
          visible: true,
          title: 'Error',
          message: authResult.error || 'Authentication failed',
          confirmStyle: 'destructive',
        });
      }
    } catch (error: any) {
      setResult(`❌ Native Auth Error: ${error.message}`);
      setDialogState({
        visible: true,
        title: 'Error',
        message: error.message,
        confirmStyle: 'destructive',
      });
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
          {loading ? '⏳ Testing...' : '🚀 Test Native Google Auth'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.expoButton]}
        onPress={testNativeGoogleAuthOnly}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '⏳ Testing...' : '🔧 Test Fixed Google Auth'}
        </Text>
      </TouchableOpacity>

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>📋 Result:</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}

      <ConfirmDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        confirmText="OK"
        confirmStyle={dialogState.confirmStyle}
        onConfirm={() => setDialogState({ ...dialogState, visible: false })}
        onCancel={() => setDialogState({ ...dialogState, visible: false })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
  },
  nativeButton: {
    backgroundColor: '#4285F4',
  },
  expoButton: {
    backgroundColor: '#000020',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
