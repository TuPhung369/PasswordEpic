import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {PasswordsScreen} from '../screens/main/PasswordsScreen';
import {GeneratorScreen} from '../screens/main/GeneratorScreen';
import {SettingsScreen} from '../screens/main/SettingsScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';

export type MainTabParamList = {
  Passwords: undefined;
  Generator: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          if (route.name === 'Passwords') {
            iconName = 'lock';
          } else if (route.name === 'Generator') {
            iconName = 'refresh';
          } else {
            iconName = 'settings';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}>
      <Tab.Screen name="Passwords" component={PasswordsScreen} />
      <Tab.Screen name="Generator" component={GeneratorScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};