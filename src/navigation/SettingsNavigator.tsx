import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { AutofillManagementScreen } from '../screens/main/AutofillManagementScreen';

export type SettingsStackParamList = {
  SettingsList: undefined;
  AutofillManagement: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false, // We handle headers in individual screens
      }}
    >
      <Stack.Screen name="SettingsList" component={SettingsScreen} />
      <Stack.Screen
        name="AutofillManagement"
        component={AutofillManagementScreen}
        options={{
          presentation: 'card', // Use card presentation for smooth transition
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsNavigator;
