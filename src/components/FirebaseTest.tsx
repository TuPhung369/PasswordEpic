import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { initializeFirebase } from '../services/firebase';
import { signInWithGoogle as authSignInWithGoogle } from '../services/authService';
import ConfirmDialog from './ConfirmDialog';

const FirebaseTest: React.FC = () => {
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Checking...');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [dialogState, setDialogState] = useState({
    visible: false,
    title: '',
    message: '',
    confirmStyle: 'default' as 'default' | 'destructive',
  });

  useEffect(() => {
    const checkFirebase = () => {
      try {
        const initialized = initializeFirebase();
        setFirebaseStatus(initialized ? 'Firebase OK' : 'Firebase Error');
      } catch (error) {
        setFirebaseStatus('Firebase Error: ' + (error as Error).message);
      }
    };

    checkFirebase();
  }, []);

  const handleTestGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      console.log('Testing Google Sign-In...');
      const result = await authSignInWithGoogle();

      if (result.success) {
        setDialogState({
          visible: true,
          title: 'Success',
          message: 'Google Sign-In successful!',
          confirmStyle: 'default',
        });
        console.log('Sign-in successful:', result.user);
      } else {
        setDialogState({
          visible: true,
          title: 'Error',
          message: result.error || 'Sign-in failed',
          confirmStyle: 'destructive',
        });
        console.log('Sign-in failed:', result.error);
      }
    } catch (error) {
      setDialogState({
        visible: true,
        title: 'Error',
        message: 'Sign-in error: ' + (error as Error).message,
        confirmStyle: 'destructive',
      });
      console.log('Sign-in error:', error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Test</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Firebase Status:</Text>
        <Text
          style={[
            styles.statusText,
            firebaseStatus.includes('OK')
              ? styles.statusSuccess
              : styles.statusError,
          ]}
        >
          {firebaseStatus}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, isSigningIn && styles.buttonDisabled]}
        onPress={handleTestGoogleSignIn}
        disabled={isSigningIn}
      >
        <Text style={styles.buttonText}>
          {isSigningIn ? 'Signing In...' : 'Test Google Sign-In'}
        </Text>
      </TouchableOpacity>

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
    padding: 20,
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusSuccess: {
    color: 'green',
  },
  statusError: {
    color: 'red',
  },
  button: {
    backgroundColor: '#4285f4',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default FirebaseTest;
