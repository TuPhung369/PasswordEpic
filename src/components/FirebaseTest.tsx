import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { initializeFirebase, signInWithGoogle } from '../services/firebase';
import { signInWithGoogle as authSignInWithGoogle } from '../services/authService';

const FirebaseTest: React.FC = () => {
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Checking...');
  const [isSigningIn, setIsSigningIn] = useState(false);

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
        Alert.alert('Success', 'Google Sign-In successful!');
        console.log('Sign-in successful:', result.user);
      } else {
        Alert.alert('Error', result.error || 'Sign-in failed');
        console.log('Sign-in failed:', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Sign-in error: ' + (error as Error).message);
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
            { color: firebaseStatus.includes('OK') ? 'green' : 'red' },
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
