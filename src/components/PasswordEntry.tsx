import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PasswordEntry as Password } from '../types/password';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { getPasswordStrengthColor } from '../utils/passwordUtils';
import { CATEGORY_ICONS } from '../constants/categories';

interface PasswordEntryComponentProps {
  password: Password;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  showActions?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  showPassword?: boolean;
}

// const { width } = Dimensions.get('window'); // Not used yet

// Helper function to get category icon
const getCategoryIcon = (category?: string): string => {
  if (!category) return 'folder';
  return CATEGORY_ICONS[category] || 'folder';
};

const PasswordEntryComponent: React.FC<PasswordEntryComponentProps> = ({
  password,
  onPress,
  onEdit,
  onDelete,
  onShare,
  showActions = true,
  selectable = false,
  selected = false,
  onSelect,
  showPassword = false,
}) => {
  const { theme } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(showPassword);
  const [actionsVisible, setActionsVisible] = useState(false);

  const styles = createStyles(theme);

  const handleCopyUsername = async () => {
    if (password.username) {
      await Clipboard.setString(password.username);
      Alert.alert('Copied', 'Username copied to clipboard');
    }
  };

  const handleCopyPassword = async () => {
    await Clipboard.setString(password.password);
    Alert.alert('Copied', 'Password copied to clipboard');
  };

  const handleCopyUrl = async () => {
    if (password.website) {
      await Clipboard.setString(password.website);
      Alert.alert('Copied', 'URL copied to clipboard');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Password',
      `Are you sure you want to delete "${password.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(),
        },
      ],
    );
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const toggleActions = () => {
    setActionsVisible(!actionsVisible);
  };

  const getStrengthIndicator = () => {
    if (!password.auditData?.passwordStrength) return null;

    const strength = password.auditData.passwordStrength;
    const color = getPasswordStrengthColor(strength.score);

    return (
      <View style={[styles.strengthIndicator, { backgroundColor: color }]}>
        <Text style={styles.strengthText}>{strength.label}</Text>
      </View>
    );
  };

  const getFavoriteIcon = () => {
    if (password.isFavorite) {
      return (
        <Icon
          name="star"
          size={16}
          color={theme.warning}
          style={styles.favoriteIcon}
        />
      );
    }
    return null;
  };

  const getSecurityWarning = () => {
    const warnings = [];

    if (password.breachStatus?.isBreached) {
      warnings.push(
        <Icon
          key="compromised"
          name="security"
          size={16}
          color={theme.error}
          style={styles.warningIcon}
        />,
      );
    }

    if (
      password.auditData?.duplicateCount &&
      password.auditData.duplicateCount > 0
    ) {
      warnings.push(
        <Icon
          key="duplicate"
          name="content-copy"
          size={16}
          color={theme.warning}
          style={styles.warningIcon}
        />,
      );
    }

    // Check if password is old (more than 90 days)
    const isOld =
      password.auditData?.lastPasswordChange &&
      new Date().getTime() -
        new Date(password.auditData.lastPasswordChange).getTime() >
        90 * 24 * 60 * 60 * 1000;

    if (isOld) {
      warnings.push(
        <Icon
          key="old"
          name="schedule"
          size={16}
          color={theme.error}
          style={styles.warningIcon}
        />,
      );
    }

    return warnings.length > 0 ? (
      <View style={styles.warningContainer}>{warnings}</View>
    ) : null;
  };

  const getLastUsedText = () => {
    if (!password.lastUsed) return 'Never used';

    const now = new Date();
    const lastUsed = new Date(password.lastUsed);
    const diffInHours = Math.floor(
      (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.selectedContainer]}
      onPress={onPress}
      onLongPress={showActions ? toggleActions : undefined}
      activeOpacity={0.7}
    >
      {/* Selection Checkbox */}
      {selectable && (
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onSelect?.(!selected)}
        >
          <Icon
            name={selected ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={selected ? theme.primary : theme.textSecondary}
          />
        </TouchableOpacity>
      )}

      {/* Category Icon */}
      <View style={styles.iconContainer}>
        <Icon
          name={getCategoryIcon(password.category)}
          size={28}
          color={theme.primary}
        />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {password.title}
          </Text>
          <View style={styles.headerIcons}>
            {getFavoriteIcon()}
            {getSecurityWarning()}
            {getStrengthIndicator()}
          </View>
        </View>

        {/* Username Row */}
        {password.username && (
          <View style={styles.detailRow}>
            <Icon name="person" size={16} color={theme.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {password.username}
            </Text>
            <TouchableOpacity
              onPress={handleCopyUsername}
              style={styles.copyButton}
            >
              <Icon name="content-copy" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Password Row */}
        <View style={styles.detailRow}>
          <Icon name="lock" size={16} color={theme.textSecondary} />
          <Text style={styles.detailText} numberOfLines={1}>
            {isPasswordVisible ? password.password : '••••••••'}
          </Text>
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={styles.actionButton}
          >
            <Icon
              name={isPasswordVisible ? 'visibility-off' : 'visibility'}
              size={16}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCopyPassword}
            style={styles.copyButton}
          >
            <Icon name="content-copy" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* URL Row */}
        {password.website && (
          <View style={styles.detailRow}>
            <Icon name="language" size={16} color={theme.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {password.website}
            </Text>
            <TouchableOpacity onPress={handleCopyUrl} style={styles.copyButton}>
              <Icon name="content-copy" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Footer Row */}
        <View style={styles.footerRow}>
          <Text style={styles.lastUsedText}>{getLastUsedText()}</Text>
          <Text style={styles.categoryText}>{password.category}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      {showActions && actionsVisible && (
        <View style={styles.actionsContainer}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.actionItem}>
              <Icon name="edit" size={20} color={theme.primary} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onShare && (
            <TouchableOpacity onPress={onShare} style={styles.actionItem}>
              <Icon name="share" size={20} color={theme.primary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={handleDelete} style={styles.actionItem}>
              <Icon name="delete" size={20} color={theme.error} />
              <Text style={[styles.actionText, { color: theme.error }]}>
                Delete
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginVertical: 4,
      marginHorizontal: 16,
      elevation: 2,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    selectedContainer: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    checkbox: {
      marginRight: 12,
      alignSelf: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '20', // Add opacity
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
      marginRight: 8,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    favoriteIcon: {
      marginLeft: 4,
    },
    warningContainer: {
      flexDirection: 'row',
      marginLeft: 4,
    },
    warningIcon: {
      marginLeft: 2,
    },
    strengthIndicator: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      marginLeft: 8,
    },
    strengthText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    detailText: {
      fontSize: 14,
      color: theme.textSecondary,
      flex: 1,
      marginLeft: 8,
    },
    actionButton: {
      padding: 4,
      marginLeft: 8,
    },
    copyButton: {
      padding: 4,
      marginLeft: 4,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    lastUsedText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    categoryText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    actionsContainer: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 8,
      elevation: 4,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      zIndex: 1000,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      minWidth: 80,
    },
    actionText: {
      fontSize: 14,
      color: theme.text,
      marginLeft: 8,
    },
  });

export default PasswordEntryComponent;
