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
import { PasswordEntry } from '../types/password';
import { useTheme, Theme } from '../contexts/ThemeContext';
import {
  getCategoryById,
  getCategoryByName,
  CATEGORY_ICONS,
} from '../constants/categories';
import { BiometricPrompt } from './BiometricPrompt';
import { MasterPasswordPrompt } from './MasterPasswordPrompt';
import { useBiometric } from '../hooks/useBiometric';
import Toast from './Toast';

interface PasswordEntryComponentProps {
  password: PasswordEntry;
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

  // Quick mapping for common categories (as fallback)
  const quickIconMap: Record<string, string> = {
    Other: 'more-horiz',
    Banking: 'account-balance',
    'Social Media': 'people',
    Work: 'work',
    Entertainment: 'movie',
    Shopping: 'shopping-cart',
    Health: 'local-hospital',
    Travel: 'flight',
    Education: 'school',
    Gaming: 'games',
    Finance: 'attach-money',
    Security: 'security',
  };

  // Try quick mapping first
  if (quickIconMap[category]) {
    console.log(
      '✅ Found icon by quick map:',
      category,
      '->',
      quickIconMap[category],
    );
    return quickIconMap[category];
  }

  // Try by name lookup
  const categoryByName = getCategoryByName(category);
  if (categoryByName) {
    console.log('✅ Found icon by name:', category, '->', categoryByName.icon);
    return categoryByName.icon;
  }

  // Try by id lookup
  const categoryById = getCategoryById(category);
  if (categoryById) {
    console.log('✅ Found icon by id:', category, '->', categoryById.icon);
    return categoryById.icon;
  }

  // Try direct CATEGORY_ICONS lookup (for lowercase keys)
  const lowerCategory = category.toLowerCase();
  const directIcon =
    CATEGORY_ICONS[lowerCategory as keyof typeof CATEGORY_ICONS];
  if (directIcon) {
    console.log('✅ Found icon by direct lookup:', category, '->', directIcon);
    return directIcon;
  }

  // Default fallback
  console.log('❌ No icon found for category:', category, 'using folder');
  return 'folder';
};

const PasswordEntryComponent: React.FC<PasswordEntryComponentProps> = ({
  password,
  onPress,
  onEdit,
  onDelete,
  onShare: _onShare,
  showActions: _showActions = true,
  selectable = false,
  selected = false,
  onSelect,
  showPassword = false,
}) => {
  const { theme } = useTheme();
  const { isAvailable: isBiometricAvailable } = useBiometric();
  const [isPasswordVisible, setIsPasswordVisible] = useState(showPassword);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info',
  });

  const styles = createStyles(theme);

  const handleCopyUsername = async () => {
    if (password.username) {
      await Clipboard.setString(password.username);
      Alert.alert('Copied', 'Username copied to clipboard');
    }
  };

  const handleCopyPassword = async () => {
    // Only allow copy if password is visible
    if (!isPasswordVisible) {
      setToast({
        visible: true,
        message: 'Please reveal password first to copy',
        type: 'error',
      });
      return;
    }

    await Clipboard.setString(password.password);
    setToast({
      visible: true,
      message: 'Password copied to clipboard',
      type: 'success',
    });
  };

  const handleCopyUrl = async () => {
    if (password.website) {
      await Clipboard.setString(password.website);
      Alert.alert('Copied', 'URL copied to clipboard');
    }
  };

  const handleCopyNotes = async () => {
    if (password.notes) {
      await Clipboard.setString(password.notes);
      Alert.alert('Copied', 'Notes copied to clipboard');
    }
  };

  const handleEdit = () => {
    onEdit?.();
  };

  const handleDelete = () => {
    // Call onDelete directly - parent component will handle confirmation
    onDelete?.();
  };

  const togglePasswordVisibility = () => {
    // If trying to show password, require authentication
    if (!isPasswordVisible) {
      // Try biometric first if available
      if (isBiometricAvailable) {
        setShowBiometricPrompt(true);
      } else {
        // Fallback to PIN/Master Password
        setShowPinPrompt(true);
      }
    } else {
      // Hide password - no authentication needed
      setIsPasswordVisible(false);
    }
  };

  const handleBiometricSuccess = () => {
    setShowBiometricPrompt(false);
    setIsPasswordVisible(true);
    setToast({
      visible: true,
      message: 'Authentication successful',
      type: 'success',
    });
  };

  const handleBiometricError = (error: string) => {
    setShowBiometricPrompt(false);
    setToast({
      visible: true,
      message: error || 'Authentication failed',
      type: 'error',
    });

    // Fallback to PIN if biometric fails
    setTimeout(() => {
      setShowPinPrompt(true);
    }, 500);
  };

  const handleBiometricClose = () => {
    setShowBiometricPrompt(false);
  };

  const handlePinSuccess = () => {
    setShowPinPrompt(false);
    setIsPasswordVisible(true);
    setToast({
      visible: true,
      message: 'Authentication successful',
      type: 'success',
    });
  };

  const handlePinCancel = () => {
    setShowPinPrompt(false);
  };

  const getCategoryData = () => {
    console.log('🔍 Password category debug:', {
      passwordId: password.id,
      rawCategory: password.category,
      categoryType: typeof password.category,
    });

    if (!password.category) {
      return {
        name: 'Uncategorized',
        color: theme.textSecondary,
      };
    }

    // First try by name, then by id
    const category =
      getCategoryByName(password.category) ||
      getCategoryById(password.category);

    console.log('📋 Category display result:', {
      passwordId: password.id,
      foundCategory: category?.name,
      finalResult: category ? category.name : password.category,
    });

    return {
      name: category ? category.name : password.category,
      color: category ? category.color : theme.primary,
    };
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

  const handleMainPress = () => {
    onPress?.();
  };

  const categoryData = getCategoryData();

  return (
    <>
      <TouchableOpacity
        style={[styles.container, selected && styles.selectedContainer]}
        onPress={handleMainPress}
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
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: categoryData.color + '20' },
          ]}
        >
          <Icon
            name={getCategoryIcon(password.category)}
            size={28}
            color={categoryData.color}
          />
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Header Row - Icon + Title + Group Name */}
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {password.title}
            </Text>
            <Text style={[styles.categoryText, { color: categoryData.color }]}>
              {categoryData.name}
            </Text>
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
                <Icon
                  name="content-copy"
                  size={16}
                  color={theme.textSecondary}
                />
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
              style={[
                styles.copyButton,
                !isPasswordVisible && styles.disabledButton,
              ]}
              disabled={!isPasswordVisible}
            >
              <Icon
                name="content-copy"
                size={16}
                color={isPasswordVisible ? theme.textSecondary : theme.border}
              />
            </TouchableOpacity>
          </View>

          {/* URL Row */}
          {password.website && (
            <View style={styles.detailRow}>
              <Icon name="language" size={16} color={theme.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {password.website}
              </Text>
              <TouchableOpacity
                onPress={handleCopyUrl}
                style={styles.copyButton}
              >
                <Icon
                  name="content-copy"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Notes Row */}
          {password.notes && (
            <View style={styles.detailRow}>
              <Icon name="note" size={16} color={theme.textSecondary} />
              <Text style={styles.detailText} numberOfLines={2}>
                {password.notes}
              </Text>
              <TouchableOpacity
                onPress={handleCopyNotes}
                style={styles.copyButton}
              >
                <Icon
                  name="content-copy"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Footer Row - Last Used + Action Icons */}
          <View style={styles.footerRow}>
            <Text style={styles.lastUsedText}>{getLastUsedText()}</Text>
            <View style={styles.actionIconsRow}>
              {onEdit && (
                <TouchableOpacity
                  onPress={handleEdit}
                  style={styles.footerActionButton}
                >
                  <Icon name="edit" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.footerActionButton}
                >
                  <Icon name="delete" size={18} color={theme.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Biometric Prompt */}
      <BiometricPrompt
        visible={showBiometricPrompt}
        onClose={handleBiometricClose}
        onSuccess={handleBiometricSuccess}
        onError={handleBiometricError}
        title="Authenticate to view password"
        subtitle="Use biometric authentication to reveal password"
      />

      {/* Master Password Prompt (Fallback) */}
      <MasterPasswordPrompt
        visible={showPinPrompt}
        onSuccess={handlePinSuccess}
        onCancel={handlePinCancel}
        title="Master Password Required"
        subtitle="Enter your master password to reveal password"
      />

      {/* Toast Notification */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </>
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
    disabledButton: {
      opacity: 0.4,
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
      fontWeight: '500',
    },
    actionIconsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    footerActionButton: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: theme.surface,
      elevation: 1,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
  });

export default PasswordEntryComponent;
