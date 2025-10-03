import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PasswordsNavigator } from './PasswordsNavigator';
import { GeneratorScreen } from '../screens/main/GeneratorScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

  // Save current tab when component mounts and navigation changes
  const [initialTab, setInitialTab] = React.useState<string | null>(null);
  const [shouldRestoreNavigation, setShouldRestoreNavigation] =
    React.useState(false);

  // Listen for tab navigation changes to save current tab
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('state', e => {
      try {
        // Get current tab from navigation state
        const state = e.data.state;
        if (state && state.routes && state.routes[state.index]) {
          const currentRoute = state.routes[state.index];
          const currentTab = currentRoute.name;

          if (['Passwords', 'Generator', 'Settings'].includes(currentTab)) {
            console.log(`💾 Saving current tab: ${currentTab}`);
            AsyncStorage.setItem('last_active_tab', currentTab).catch(error => {
              console.error('Failed to save active tab:', error);
            });
          }
        }
      } catch (error) {
        console.error('Failed to track navigation state:', error);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Restore navigation state
  const restoreNavigationState = React.useCallback(async () => {
    try {
      // Check for saved tab restoration
      const lastActiveTab = await AsyncStorage.getItem('last_active_tab');
      if (
        lastActiveTab &&
        ['Passwords', 'Generator', 'Settings'].includes(lastActiveTab)
      ) {
        console.log(
          `🔄 MainNavigator: Restoring to ${lastActiveTab} tab after authentication`,
        );
        setInitialTab(lastActiveTab);
      } else {
        // Default to Passwords if no saved tab
        setInitialTab('Passwords');
      }
    } catch (error) {
      console.error('Failed to restore navigation state:', error);
    }
  }, []);

  // Initial restore on mount
  React.useEffect(() => {
    restoreNavigationState();
  }, [restoreNavigationState]);

  // Restore navigation when shouldRestoreNavigation flag is set
  React.useEffect(() => {
    if (shouldRestoreNavigation) {
      console.log('🔄 Triggering navigation restoration after unlock');
      restoreNavigationState();
      setShouldRestoreNavigation(false);
    }
  }, [shouldRestoreNavigation, restoreNavigationState]);

  // Restore navigation when screen gains focus (after unlock)
  // Note: Nested screen restoration (like AddPassword) is handled by PasswordsNavigator
  useFocusEffect(
    React.useCallback(() => {
      console.log(
        '🔄 MainNavigator gained focus - tab restoration handled on mount',
      );
    }, []),
  );

  // Don't render until initialTab is determined
  if (initialTab === null) {
    return null; // Or a loading spinner
  }

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName={initialTab as keyof MainTabParamList}
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
