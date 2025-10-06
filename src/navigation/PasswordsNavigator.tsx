import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PasswordsScreen } from '../screens/main/PasswordsScreen';
import { AddPasswordScreen } from '../screens/main/AddPasswordScreen';
import { EditPasswordScreen } from '../screens/main/EditPasswordScreen';

export type PasswordsStackParamList = {
  PasswordsList: { successMessage?: string } | undefined;
  AddPassword: { restoreData?: boolean } | undefined;
  EditPassword: { passwordId: string };
};

const Stack = createNativeStackNavigator<PasswordsStackParamList>();

export const PasswordsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false, // We handle headers in individual screens
      }}
    >
      <Stack.Screen name="PasswordsList" component={PasswordsScreen} />
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
