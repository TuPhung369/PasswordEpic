/**
 * Migration Banner Component
 *
 * Displays a banner when passwords need migration
 * Shows migration progress and allows manual trigger
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

interface MigrationBannerProps {
  needsMigration: number;
  total: number;
  onMigrate?: () => void;
}

export const MigrationBanner: React.FC<MigrationBannerProps> = ({
  needsMigration,
  total,
  onMigrate,
}) => {
  const { theme } = useTheme();

  // Don't show if no migration needed
  if (needsMigration === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.primary + '20', // 20% opacity
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    icon: {
      marginRight: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    message: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
      marginRight: 12,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
      minWidth: 50,
      textAlign: 'right',
    },
    button: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
    },
  });

  const progress = total > 0 ? ((total - needsMigration) / total) * 100 : 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons
          name="upgrade"
          size={24}
          color={theme.primary}
          style={styles.icon}
        />
        <Text style={styles.title}>Update Available</Text>
      </View>

      <Text style={styles.message}>
        {needsMigration} of your {total} passwords need to be updated to support
        new features like password history and security audit.
      </Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>

      {onMigrate && (
        <TouchableOpacity style={styles.button} onPress={onMigrate}>
          <MaterialIcons name="system-update" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Update Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default MigrationBanner;
