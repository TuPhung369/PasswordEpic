import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { initializeAuth } from './src/services/authService';
import { initializeFirebase } from './src/services/firebase';
import { initializeGoogleSignIn } from './src/services/googleAuthNative';

// Import polyfills for crypto and URL
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

const App: React.FC = () => {
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('Initializing Firebase...');
        const firebaseInitialized = initializeFirebase();

        console.log('Initializing Auth...');
        let authInitialized = false;
        if (firebaseInitialized) {
          try {
            authInitialized = initializeAuth();
          } catch (authError) {
            console.warn('Auth initialization failed:', authError);
            authInitialized = false;
          }
        }

        // Delay Google Sign-In initialization to ensure activity is ready
        setTimeout(async () => {
          try {
            console.log('Initializing Google Sign-In...');
            const googleSignInInitialized = await initializeGoogleSignIn();

            if (googleSignInInitialized) {
              console.log('Google Sign-In initialized successfully');
            } else {
              console.warn('Google Sign-In initialization failed');
            }
          } catch (error) {
            console.warn('Google Sign-In initialization error:', error);
          }
        }, 3000); // Wait 3 seconds for activity to be ready

        if (firebaseInitialized) {
          console.log('Firebase initialized successfully');
          if (authInitialized) {
            console.log('Auth initialized successfully');
          } else {
            console.warn(
              'Auth initialization failed - Google Sign-In will not work',
            );
          }
        } else {
          console.warn('Firebase initialization failed');
        }
      } catch (error) {
        console.error('Service initialization error:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
};

export default App;
