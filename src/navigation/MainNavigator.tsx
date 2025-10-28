import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';
import {
  PasswordsNavigator,
  PasswordsStackParamList,
} from './PasswordsNavigator';
import { SettingsNavigator, SettingsStackParamList } from './SettingsNavigator';
import { GeneratorScreen } from '../screens/main/GeneratorScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

export type MainTabParamList = {
  Passwords: NavigatorScreenParams<PasswordsStackParamList> | undefined;
  Generator: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
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
    iconName = 'lock-closed-outline';
  } else if (routeName === 'Generator') {
    iconName = 'refresh-outline';
  } else {
    iconName = 'settings-outline';
  }

  return <Ionicons name={iconName} size={focused ? 22 : 20} color={color} />;
};

// Tạo function render icon ra ngoài component
const renderTabBarIcon =
  (routeName: string) =>
  ({ focused, color }: { focused: boolean; color: string }) =>
    <TabBarIcon routeName={routeName} focused={focused} color={color} />;

import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

export const MainNavigator: React.FC = () => {
  const { theme } = useTheme();

  // Hàm kiểm tra route con để ẩn tab bar khi ở AddPassword, EditPassword, hoặc AutofillManagement
  const getTabBarStyle = (route: any, defaultRouteName: string) => {
    // Lấy tên route con đang active
    const routeName = getFocusedRouteNameFromRoute(route) ?? defaultRouteName;
    // console.log('🔍 getTabBarStyle - routeName:', routeName); // Debug log
    const baseStyle = {
      ...styles.tabBar,
      backgroundColor: theme.card,
      borderTopColor: theme.border,
    };

    // Kiểm tra trực tiếp mà không cần state
    const shouldHide =
      routeName === 'AddPassword' ||
      routeName === 'EditPassword' ||
      routeName === 'AutofillManagement';

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
          tabBarStyle = getTabBarStyle(route, 'PasswordsList');
        } else if (route.name === 'Settings') {
          // Lấy route con của SettingsNavigator
          tabBarStyle = getTabBarStyle(route, 'SettingsList');
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
        component={SettingsNavigator}
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
    paddingBottom: 2,
    paddingTop: 4,
    height: 60,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
