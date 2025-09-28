import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { OnboardingScreen } from "../screens/auth/OnboardingScreen";
import { MasterPasswordScreen } from "../screens/auth/MasterPasswordScreen";

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  MasterPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MasterPassword" component={MasterPasswordScreen} />
    </Stack.Navigator>
  );
};
