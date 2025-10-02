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

  // Save current tab when component mounts and navigation changes
  const [initialTab, setInitialTab] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    const restoreNavigationState = async () => {
      try {
        // Check for AddPassword restoration first
        const lastActiveScreen = await AsyncStorage.getItem(
          'last_active_screen',
        );
        if (lastActiveScreen === 'AddPassword') {
          console.log(
            '🔄 Restoring navigation to AddPassword after authentication',
          );
          setTimeout(() => {
            (navigation as any).navigate('Passwords', {
              screen: 'AddPassword',
              params: { restoreData: true },
            });
          }, 100);
          await AsyncStorage.removeItem('last_active_screen');
          return;
        }

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
    };

    restoreNavigationState();
  }, [navigation]);

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
