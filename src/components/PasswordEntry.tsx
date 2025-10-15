import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
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
import { useAppDispatch } from '../hooks/redux';
import { decryptPasswordField } from '../store/slices/passwordsSlice';
import { getEffectiveMasterPassword } from '../services/staticMasterPasswordService';

interface PasswordEntryComponentProps {
  password: PasswordEntry;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  showActions?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  showPassword?: boolean;
}

// const { width } = Dimensions.get('window'); // Not used yet

// Helper function to get category icon with Ionicons support
const getCategoryIcon = (category?: string): string => {
  if (!category) return 'folder-outline';

  // Updated quick mapping for common categories using Ionicons names
  const quickIconMap: Record<string, string> = {
    Other: 'ellipsis-horizontal-outline',
    Banking: 'card-outline',
    'Social Media': 'people-outline',
    Work: 'briefcase-outline',
    Entertainment: 'film-outline',
    Shopping: 'bag-outline',
    Health: 'medical-outline',
    Travel: 'airplane-outline',
    Education: 'school-outline',
    Gaming: 'game-controller-outline',
    Finance: 'cash-outline',
    Security: 'shield-checkmark-outline',
    Business: 'business-outline',
    'Cloud Services': 'cloud-outline',
    Development: 'code-slash-outline',
    Streaming: 'tv-outline',
    Cryptocurrency: 'logo-bitcoin',
    'E-commerce': 'storefront-outline',
    Utilities: 'build-outline',
    Subscriptions: 'calendar-outline',
    Personal: 'person-outline',
    Communication: 'chatbubble-outline',
    Messaging: 'mail-outline',
    Email: 'mail-outline',
  };

  // Try quick mapping first
  if (quickIconMap[category]) {
    return quickIconMap[category];
  }

  // Try by name lookup from DEFAULT_CATEGORIES
  const categoryByName = getCategoryByName(category);
  if (categoryByName) {
    return categoryByName.icon;
  }

  // Try by id lookup from DEFAULT_CATEGORIES
  const categoryById = getCategoryById(category);
  if (categoryById) {
    return categoryById.icon;
  }

  // Try direct CATEGORY_ICONS lookup (for lowercase keys)
  const lowerCategory = category.toLowerCase();
  const directIcon =
    CATEGORY_ICONS[lowerCategory as keyof typeof CATEGORY_ICONS];
  if (directIcon) {
    return directIcon;
  }

  // Material Icons to Ionicons fallback mapping for old data
  const materialToIoniconsMap: Record<string, string> = {
    people: 'people-outline',
    work: 'briefcase-outline',
    movie: 'film-outline',
    'account-balance': 'card-outline',
    'shopping-cart': 'bag-outline',
    'attach-money': 'cash-outline',
    games: 'game-controller-outline',
    tv: 'tv-outline',
    'music-note': 'musical-notes-outline',
    store: 'storefront-outline',
    school: 'school-outline',
    'local-hospital': 'medical-outline',
    flight: 'airplane-outline',
    code: 'code-slash-outline',
    computer: 'laptop-outline',
    build: 'build-outline',
    person: 'person-outline',
    security: 'shield-checkmark-outline',
    folder: 'folder-outline',
    'more-horiz': 'ellipsis-horizontal-outline',
    email: 'mail-outline',
  };

  // Check if it's an old Material Icons name and convert it
  if (materialToIoniconsMap[category]) {
    return materialToIoniconsMap[category];
  }

  // Default fallback
  return 'folder-outline';
};

const PasswordEntryComponent: React.FC<PasswordEntryComponentProps> = ({
  password,
  onPress,
  onEdit,
  onDelete,
  onShare: _onShare,
  onToggleFavorite,
  showActions: _showActions = true,
  selectable = false,
  selected = false,
  onSelect,
  showPassword = false,
}) => {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const { isAvailable: isBiometricAvailable } = useBiometric();
  const [isPasswordVisible, setIsPasswordVisible] = useState(showPassword);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error' | 'info',
  });

  const styles = createStyles(theme);

  // Check if password is encrypted (lazy loaded)
  const isPasswordEncrypted = !password.isDecrypted;

  const handleCopyUsername = async () => {
    if (password.username) {
      await Clipboard.setString(password.username);
      setToast({
        visible: true,
        message: 'Username copied to clipboard',
        type: 'success',
      });
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

    // Use decrypted password if available, otherwise use the password from props
    const passwordToCopy = decryptedPassword || password.password;
    await Clipboard.setString(passwordToCopy);
    setToast({
      visible: true,
      message: 'Password copied to clipboard',
      type: 'success',
    });
  };

  const handleCopyUrl = async () => {
    if (password.website) {
      await Clipboard.setString(password.website);
      setToast({
        visible: true,
        message: 'URL copied to clipboard',
        type: 'success',
      });
    }
  };

  const handleCopyNotes = async () => {
    if (password.notes) {
      await Clipboard.setString(password.notes);
      setToast({
        visible: true,
        message: 'Notes copied to clipboard',
        type: 'success',
      });
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

  const handleBiometricSuccess = async () => {
    setShowBiometricPrompt(false);

    // If password is encrypted, decrypt it first
    if (isPasswordEncrypted && !decryptedPassword) {
      await decryptPassword();
    }

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

  const handlePinSuccess = async () => {
    setShowPinPrompt(false);

    // If password is encrypted, decrypt it first
    if (isPasswordEncrypted && !decryptedPassword) {
      await decryptPassword();
    }

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

  // Decrypt password on-demand
  const decryptPassword = async () => {
    try {
      setIsDecrypting(true);

      // Get master password
      const result = await getEffectiveMasterPassword();
      if (!result.success || !result.password) {
        throw new Error('Failed to get master password');
      }

      // Decrypt password field
      const decryptResult = await dispatch(
        decryptPasswordField({
          id: password.id,
          masterPassword: result.password,
        }),
      ).unwrap();

      if (decryptResult.password) {
        setDecryptedPassword(decryptResult.password);
      }
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      setToast({
        visible: true,
        message: 'Failed to decrypt password',
        type: 'error',
      });
    } finally {
      setIsDecrypting(false);
    }
  };

  const getCategoryData = () => {
    // console.log('🔍 Password category debug:', {
    //   passwordId: password.id,
    //   rawCategory: password.category,
    //   categoryType: typeof password.category,
    // });

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

    // console.log('📋 Category display result:', {
    //   passwordId: password.id,
    //   foundCategory: category?.name,
    //   finalResult: category ? category.name : password.category,
    // });

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
              name={selected ? 'checkbox' : 'checkbox-outline'}
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
          {/* Header Row - Icon + Title + Category + Favorite */}
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {password.title}
            </Text>
            <View style={styles.categoryAndFavorite}>
              <Text
                style={[styles.categoryText, { color: categoryData.color }]}
              >
                {categoryData.name}
              </Text>
              <TouchableOpacity
                onPress={onToggleFavorite}
                style={styles.favoriteButton}
              >
                <Icon
                  name={password.isFavorite ? 'heart' : 'heart-outline'}
                  size={16}
                  color={password.isFavorite ? '#FF6B6B' : theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Username Row */}
          {password.username && (
            <View style={styles.detailRow}>
              <Icon
                name="person-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={styles.detailText} numberOfLines={1}>
                {password.username}
              </Text>
              <TouchableOpacity
                onPress={handleCopyUsername}
                style={styles.copyButton}
              >
                <Icon
                  name="copy-outline"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Password Row */}
          <View style={styles.detailRow}>
            <Icon
              name="lock-closed-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={styles.detailText} numberOfLines={1}>
              {isPasswordVisible
                ? decryptedPassword || password.password
                : '••••••••'}
            </Text>
            {isDecrypting ? (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={styles.actionButton}
              />
            ) : (
              <TouchableOpacity
                onPress={togglePasswordVisibility}
                style={styles.actionButton}
              >
                <Icon
                  name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleCopyPassword}
              style={[
                styles.copyButton,
                !isPasswordVisible && styles.disabledButton,
              ]}
              disabled={!isPasswordVisible}
            >
              <Icon
                name="copy-outline"
                size={16}
                color={isPasswordVisible ? theme.textSecondary : theme.border}
              />
            </TouchableOpacity>
          </View>

          {/* URL Row */}
          {password.website && (
            <View style={styles.detailRow}>
              <Icon
                name="globe-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={styles.detailText} numberOfLines={1}>
                {password.website}
              </Text>
              <TouchableOpacity
                onPress={handleCopyUrl}
                style={styles.copyButton}
              >
                <Icon
                  name="copy-outline"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Notes Row */}
          {password.notes && (
            <View style={styles.detailRow}>
              <Icon
                name="document-text-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={styles.detailText} numberOfLines={2}>
                {password.notes}
              </Text>
              <TouchableOpacity
                onPress={handleCopyNotes}
                style={styles.copyButton}
              >
                <Icon
                  name="copy-outline"
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
                  <Icon name="create-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.footerActionButton}
                >
                  <Icon name="trash-outline" size={18} color={theme.error} />
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
    categoryAndFavorite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    favoriteButton: {
      padding: 4,
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
