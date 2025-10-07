import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PasswordsNavigator } from './PasswordsNavigator';
import { GeneratorScreen } from '../screens/main/GeneratorScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

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

import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

export const MainNavigator: React.FC = () => {
  const { theme } = useTheme();

  // Hàm kiểm tra route con để ẩn tab bar khi ở AddPassword hoặc EditPassword
  const getTabBarStyle = (route: any) => {
    // Lấy tên route con đang active trong PasswordsNavigator
    const routeName = getFocusedRouteNameFromRoute(route) ?? 'PasswordsList';
    // console.log('🔍 getTabBarStyle - routeName:', routeName); // Debug log
    const baseStyle = {
      ...styles.tabBar,
      backgroundColor: theme.card,
      borderTopColor: theme.border,
    };

    // Kiểm tra trực tiếp mà không cần state
    const shouldHide =
      routeName === 'AddPassword' || routeName === 'EditPassword';

    if (shouldHide) {
      // console.log('🚫 Hiding tab bar for route:', routeName); // Debug log
      return {
        ...baseStyle,
        height: 0,
        paddingBottom: 0,
        paddingTop: 0,
        opacity: 0,
        overflow: 'hidden' as 'hidden',
      };
    }
    // console.log('✅ Showing tab bar for route:', routeName); // Debug log
    return baseStyle;
  };

  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => {
        let tabBarStyle = {
          ...styles.tabBar,
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        };
        if (route.name === 'Passwords') {
          // Lấy route con của PasswordsNavigator
          tabBarStyle = getTabBarStyle(route);
        }
        return {
          tabBarIcon: renderTabBarIcon(route.name),
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle,
          tabBarLabelStyle: styles.tabLabel,
          headerShown: false,
        };
      }}
    >
      <Tab.Screen name="Passwords" component={PasswordsNavigator} />
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
