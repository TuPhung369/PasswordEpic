import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { MasterPasswordScreen } from '../screens/auth/MasterPasswordScreen';
import { BiometricUnlockScreen } from '../screens/auth/BiometricUnlockScreen';
import { BiometricWithPin } from '../screens/auth/BiometricWithPin';
import { CredentialOptionsScreen } from '../screens/auth/CredentialOptionsScreen';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  CredentialOptions: undefined;
  MasterPassword: {
    mode?: 'setup' | 'update' | 'unlock';
    biometricSetupComplete?: boolean;
  };
  BiometricUnlock: undefined;
  BiometricWithPin: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC<{
  needsUnlock?: boolean;
  biometricEnabled?: boolean;
  onUnlock?: () => void;
}> = ({ needsUnlock, onUnlock }) => {
  // Determine initial route based on unlock state
  // When user needs to unlock:
  // - Use MasterPasswordScreen with mode='unlock'
  // - MasterPasswordScreen will auto-trigger biometric on mount
  // - If biometric fails, user can enter Master Password + PIN
  const initialRouteName = needsUnlock
    ? 'MasterPassword' // ✅ Use MasterPasswordScreen for unlock (supports Master Password + PIN fallback)
    : 'Onboarding';

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="CredentialOptions"
        component={CredentialOptionsScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="MasterPassword"
        component={MasterPasswordScreen}
        options={{ gestureEnabled: false }}
        initialParams={needsUnlock ? { mode: 'unlock' } : undefined}
      />
      <Stack.Screen name="BiometricUnlock">
        {props => <BiometricUnlockScreen {...props} onUnlock={onUnlock} />}
      </Stack.Screen>
      <Stack.Screen name="BiometricWithPin">
        {props => <BiometricWithPin {...props} onUnlock={onUnlock} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
