import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PasswordsNavigator } from './PasswordsNavigator';
import { GeneratorScreen } from '../screens/main/GeneratorScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MainTabParamList = {
  Passwords: undefined;
  Generator: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Tách component tabBarIcon ra ngoài để tránh re-render
const TabBarIcon: React.FC<{
  routeName: string;
  focused: boolean;
  color: string;
}> = ({ routeName, focused, color }) => {
  let iconName: string;

  if (routeName === 'Passwords') {
    iconName = 'lock';
  } else if (routeName === 'Generator') {
    iconName = 'refresh';
  } else {
    iconName = 'settings';
  }

  return (
    <MaterialIcons name={iconName} size={focused ? 26 : 24} color={color} />
  );
};

// Tạo function render icon ra ngoài component
const renderTabBarIcon =
  (routeName: string) =>
  ({ focused, color }: { focused: boolean; color: string }) =>
    <TabBarIcon routeName={routeName} focused={focused} color={color} />;

export const MainNavigator: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();

  // Check if we need to restore to AddPassword screen
  React.useEffect(() => {
    const checkNavigationRestore = async () => {
      try {
        const lastActiveScreen = await AsyncStorage.getItem(
          'last_active_screen',
        );
        if (lastActiveScreen === 'AddPassword') {
          console.log(
            '🔄 Restoring navigation to AddPassword after authentication',
          );
          // Small delay to ensure navigation stack is ready
          setTimeout(() => {
            (navigation as any).navigate('Passwords', {
              screen: 'AddPassword',
              // Pass a flag to restore form data
              params: { restoreData: true },
            });
          }, 100);
          // Clear the flag after restoring
          await AsyncStorage.removeItem('last_active_screen');
        }
      } catch (error) {
        console.error('Failed to check navigation restore:', error);
      }
    };

    checkNavigationRestore();
  }, [navigation]);

  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => ({
        tabBarIcon: renderTabBarIcon(route.name),
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Passwords"
        component={PasswordsNavigator}
        options={{
          tabBarIcon: renderTabBarIcon('Passwords'),
        }}
      />
      <Tab.Screen
        name="Generator"
        component={GeneratorScreen}
        options={{
          tabBarLabel: 'Generate',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0.5,
    paddingBottom: 8,
    paddingTop: 8,
    height: 88,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
