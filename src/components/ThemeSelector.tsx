import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeSelectorProps {
  onPress: () => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onPress }) => {
  const { theme, themeMode, isDarkMode } = useTheme();

  const getThemeDisplayName = () => {
    switch (themeMode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return `System (${isDarkMode ? 'Dark' : 'Light'})`;
      default:
        return 'System';
    }
  };

  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light':
        return 'sunny-outline';
      case 'dark':
        return 'moon-outline';
      case 'system':
        return 'phone-portrait-outline';
      default:
        return 'phone-portrait-outline';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <View
          style={[styles.iconBackground, { backgroundColor: theme.surface }]}
        >
          <Ionicons name={getThemeIcon()} size={24} color={theme.primary} />
        </View>
        <View style={styles.textContent}>
          <Text style={[styles.label, { color: theme.text }]}>Theme</Text>
        </View>
      </View>
      <View style={styles.rightContent}>
        <Text style={[styles.value, { color: theme.textSecondary }]}>
          {getThemeDisplayName()}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={theme.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContent: {
    flex: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '400',
  },
});
