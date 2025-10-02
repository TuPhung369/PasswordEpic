import React, { useEffect, useRef } from 'react';
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
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Add a small delay to ensure React Native environment is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('🚀 Initializing services...');

        // Try Firebase initialization
        try {
          const firebaseInitialized = initializeFirebase();
          if (firebaseInitialized) {
            console.log('✅ Firebase initialized successfully');
          } else {
            console.warn('⚠️ Firebase initialization failed');
          }
        } catch (firebaseError) {
          console.warn('⚠️ Firebase initialization error:', firebaseError);
        }

        // Try Auth initialization
        try {
          const authInitialized = initializeAuth();
          if (authInitialized) {
            console.log('✅ Auth initialized successfully');
          } else {
            console.warn('⚠️ Auth initialization failed');
          }
        } catch (authError) {
          console.warn('⚠️ Auth initialization error:', authError);
        }

        // Delay Google Sign-In initialization to ensure activity is ready
        setTimeout(async () => {
          try {
            const googleSignInInitialized = await initializeGoogleSignIn();

            if (googleSignInInitialized) {
              console.log('✅ Google Sign-In initialized successfully');
            } else {
              console.warn('⚠️ Google Sign-In initialization failed');
            }
          } catch (error) {
            console.warn('⚠️ Google Sign-In initialization error:', error);
          }
        }, 3000); // Wait 3 seconds for activity to be ready

        console.log('✅ Service initialization completed');
      } catch (error) {
        console.error('❌ Service initialization error:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer
            ref={navigationRef}
            onStateChange={state => {
              // Save navigation state when it changes
              try {
                if (state && state.routes) {
                  // Find the current main tab
                  const authRoute = state.routes.find(
                    route => route.name === 'Main',
                  );
                  if (authRoute && authRoute.state && authRoute.state.routes) {
                    const currentTabRoute =
                      authRoute.state.routes[authRoute.state.index || 0];
                    const currentTab = currentTabRoute.name;

                    if (
                      ['Passwords', 'Generator', 'Settings'].includes(
                        currentTab,
                      )
                    ) {
                      console.log(
                        `💾 App.tsx: Saving current tab: ${currentTab}`,
                      );
                      import('@react-native-async-storage/async-storage').then(
                        ({ default: AsyncStorage }) => {
                          AsyncStorage.setItem(
                            'last_active_tab',
                            currentTab,
                          ).catch(console.error);
                        },
                      );
                    }
                  }
                }
              } catch (error) {
                console.error('Failed to save navigation state:', error);
              }
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
};

export default App;
