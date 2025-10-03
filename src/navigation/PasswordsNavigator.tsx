import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PasswordsScreen } from '../screens/main/PasswordsScreen';
import { AddPasswordScreen } from '../screens/main/AddPasswordScreen';
import { EditPasswordScreen } from '../screens/main/EditPasswordScreen';

export type PasswordsStackParamList = {
  PasswordsList: undefined;
  AddPassword: { restoreData?: boolean } | undefined;
  EditPassword: { passwordId: string };
};

const Stack = createNativeStackNavigator<PasswordsStackParamList>();

// Wrapper component to handle navigation restoration
const PasswordsScreenWrapper: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<PasswordsStackParamList>>();

  // State to track restore trigger changes
  // Use null as initial state to distinguish from actual '0' value
  const [restoreTrigger, setRestoreTrigger] = React.useState<string | null>(
    null,
  );

  // Check for restore trigger changes
  React.useEffect(() => {
    const checkInterval = setInterval(async () => {
      try {
        const trigger = await AsyncStorage.getItem(
          'navigation_restore_trigger',
        );
        // Update state if trigger exists and is different from current state
        if (trigger !== null && trigger !== restoreTrigger) {
          console.log(
            '🔄 Restore trigger changed:',
            restoreTrigger,
            '->',
            trigger,
          );
          setRestoreTrigger(trigger);
        }
      } catch (error) {
        console.error('Failed to check restore trigger:', error);
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkInterval);
  }, [restoreTrigger]);

  // NOTE: We rely ONLY on the trigger-based mechanism below
  // useFocusEffect was causing race conditions with the trigger mechanism
  // Keeping this commented out as reference:
  /*
  useFocusEffect(
    React.useCallback(() => {
      console.log(
        '🔄 PasswordsNavigator gained focus - checking for screen restore',
      );
      // ... (old code)
    }, [navigation]),
  );
  */

  // Also check when restore trigger changes
  React.useEffect(() => {
    // Only process if we have a valid trigger (not null, which is initial state)
    if (restoreTrigger !== null) {
      console.log(
        '🔄 Restore trigger effect - checking for navigation restore (trigger:',
        restoreTrigger,
        ')',
      );

      AsyncStorage.multiGet(['last_active_screen', 'should_restore_navigation'])
        .then(([[, lastActiveScreen], [, shouldRestore]]) => {
          console.log(
            '🔄 PasswordsNavigator (trigger): last_active_screen =',
            lastActiveScreen,
            ', should_restore =',
            shouldRestore,
          );

          if (shouldRestore === 'true' && lastActiveScreen === 'AddPassword') {
            console.log(
              '🔄 Restoring to AddPassword after unlock (via trigger)',
            );

            // Clear the flags IMMEDIATELY to prevent multiple navigations
            AsyncStorage.multiRemove([
              'last_active_screen',
              'should_restore_navigation',
              'navigation_restore_trigger',
            ]).catch(error =>
              console.error('Failed to clear restore flags:', error),
            );

            // Navigate to AddPassword
            setTimeout(() => {
              navigation.navigate('AddPassword', {
                restoreData: true,
              });
            }, 100);
          } else if (shouldRestore === 'true') {
            // Clear the flags even if not restoring to AddPassword
            console.log(
              '🔄 Clearing restore flags - not restoring to AddPassword',
            );
            AsyncStorage.multiRemove([
              'should_restore_navigation',
              'navigation_restore_trigger',
            ]).catch(error =>
              console.error('Failed to clear restore flags:', error),
            );
          }
        })
        .catch(error => {
          console.error('Failed to check last active screen:', error);
        });
    }
  }, [restoreTrigger, navigation]);

  return <PasswordsScreen />;
};

export const PasswordsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false, // We handle headers in individual screens
      }}
    >
      <Stack.Screen name="PasswordsList" component={PasswordsScreenWrapper} />
      <Stack.Screen
        name="AddPassword"
        component={AddPasswordScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="EditPassword"
        component={EditPasswordScreen}
        options={{
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};

export default PasswordsNavigator;
