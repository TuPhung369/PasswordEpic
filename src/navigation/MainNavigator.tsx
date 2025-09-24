import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { PasswordsScreen } from "../screens/main/PasswordsScreen";
import { GeneratorScreen } from "../screens/main/GeneratorScreen";
import { SettingsScreen } from "../screens/main/SettingsScreen";
import { MaterialIcons } from "@expo/vector-icons";

export type MainTabParamList = {
  Passwords: undefined;
  Generator: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap;

          if (route.name === "Passwords") {
            iconName = "lock";
          } else if (route.name === "Generator") {
            iconName = "refresh";
          } else {
            iconName = "settings";
          }

          return (
            <MaterialIcons
              name={iconName}
              size={focused ? size + 2 : size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#1C1C1E",
          borderTopColor: "#38383A",
          borderTopWidth: 0.5,
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Passwords"
        component={PasswordsScreen}
        options={{
          tabBarLabel: "Vault",
        }}
      />
      <Tab.Screen
        name="Generator"
        component={GeneratorScreen}
        options={{
          tabBarLabel: "Generate",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
        }}
      />
    </Tab.Navigator>
  );
};

