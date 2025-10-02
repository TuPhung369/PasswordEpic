import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks/redux';
import { RootState } from '../../store';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PasswordEntry as Password } from '../../types/password';
import { useTheme } from '../../contexts/ThemeContext';
import PasswordEntryComponent from '../../components/PasswordEntry';
import { PasswordsStackParamList } from '../../navigation/PasswordsNavigator';

type NavigationProp = NativeStackNavigationProp<
  PasswordsStackParamList,
  'PasswordsList'
>;

export const PasswordsScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { passwords } = useAppSelector((state: RootState) => state.passwords);

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPasswords, setSelectedPasswords] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Filter passwords based on search query
  const filteredPasswords = useMemo(() => {
    if (!searchQuery.trim()) return passwords;

    return passwords.filter(
      password =>
        password.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (password.username &&
          password.username
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
        (password.website &&
          password.website.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [passwords, searchQuery]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const weakPasswords = filteredPasswords.filter(
      p =>
        p.auditData?.passwordStrength && p.auditData.passwordStrength.score < 2,
    ).length;

    const compromisedPasswords = filteredPasswords.filter(
      p => p.breachStatus?.isBreached,
    ).length;

    const duplicatePasswords = filteredPasswords.filter(
      p => p.auditData?.duplicateCount && p.auditData.duplicateCount > 0,
    ).length;

    return {
      weakPasswords,
      compromisedPasswords,
      duplicatePasswords,
    };
  }, [filteredPasswords]);

  // Handlers
  const handlePasswordPress = (password: Password) => {
    if (bulkMode) {
      togglePasswordSelection(password.id);
    } else {
      // Navigate to password details
      // navigation.navigate('PasswordDetails', { passwordId: password.id });
    }
  };

  const handlePasswordEdit = (password: Password) => {
    navigation.navigate('EditPassword', { passwordId: password.id });
  };

  const handlePasswordDelete = async (password: Password) => {
    Alert.alert(
      'Delete Password',
      `Are you sure you want to delete "${password.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement password deletion
              console.log('Delete password:', password.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete password');
            }
          },
        },
      ],
    );
  };

  const togglePasswordSelection = (passwordId: string) => {
    setSelectedPasswords(prev =>
      prev.includes(passwordId)
        ? prev.filter(id => id !== passwordId)
        : [...prev, passwordId],
    );
  };

  const selectAllPasswords = () => {
    setSelectedPasswords(filteredPasswords.map(p => p.id));
  };

  const clearSelection = () => {
    setSelectedPasswords([]);
  };

  const handleAddPassword = () => {
    navigation.navigate('AddPassword');
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (!bulkMode) {
      clearSelection();
    }
  };

  const handleBulkDelete = () => {
    if (selectedPasswords.length === 0) return;

    Alert.alert(
      'Delete Passwords',
      `Are you sure you want to delete ${selectedPasswords.length} password(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement bulk deletion
              console.log('Delete passwords:', selectedPasswords);
              setBulkMode(false);
              clearSelection();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete passwords');
            }
          },
        },
      ],
    );
  };

  const renderPasswordItem = ({ item }: { item: Password }) => (
    <PasswordEntryComponent
      password={item}
      onPress={() => handlePasswordPress(item)}
      onEdit={() => handlePasswordEdit(item)}
      onDelete={() => handlePasswordDelete(item)}
      selectable={bulkMode}
      selected={selectedPasswords.includes(item.id)}
      onSelect={_selected => togglePasswordSelection(item.id)}
      showActions={!bulkMode}
    />
  );

  const renderSearchBar = () => {
    if (!showSearch) return null;

    return (
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <MaterialIcons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search passwords..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.textSecondary}
          autoFocus
        />
        <TouchableOpacity
          onPress={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
          style={styles.searchClose}
        >
          <MaterialIcons name="close" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderBulkActions = () => {
    if (!bulkMode) return null;

    return (
      <View
        style={[
          styles.bulkActions,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={selectAllPasswords}
          style={styles.bulkButton}
        >
          <MaterialIcons name="select-all" size={20} color={theme.primary} />
          <Text style={[styles.bulkButtonText, { color: theme.primary }]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBulkDelete}
          style={styles.bulkButton}
          disabled={selectedPasswords.length === 0}
        >
          <MaterialIcons name="delete" size={20} color={theme.error} />
          <Text style={[styles.bulkButtonText, { color: theme.error }]}>
            Delete
          </Text>
        </TouchableOpacity>

        <Text style={[styles.selectionCount, { color: theme.textSecondary }]}>
          {selectedPasswords.length} selected
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <View style={styles.headerLeft}>
        <Text style={[styles.title, { color: theme.text }]}>🔐 Vault</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {filteredPasswords.length} passwords
          {statistics.weakPasswords > 0 && (
            <Text style={{ color: theme.warning }}>
              {' '}
              • {statistics.weakPasswords} weak
            </Text>
          )}
          {statistics.compromisedPasswords > 0 && (
            <Text style={{ color: theme.error }}>
              {' '}
              • {statistics.compromisedPasswords} compromised
            </Text>
          )}
        </Text>
      </View>
      <View style={styles.headerRight}>
        {!bulkMode && (
          <TouchableOpacity
            onPress={() => setShowSearch(!showSearch)}
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
          >
            <MaterialIcons
              name="search"
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={toggleBulkMode}
          style={[
            styles.headerButton,
            { backgroundColor: bulkMode ? theme.primary : theme.surface },
          ]}
        >
          <MaterialIcons
            name="checklist"
            size={22}
            color={bulkMode ? '#FFFFFF' : theme.textSecondary}
          />
        </TouchableOpacity>

        {!bulkMode && (
          <TouchableOpacity
            onPress={handleAddPassword}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <MaterialIcons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
        <MaterialIcons name="lock" size={48} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        Your Vault is Empty
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Add your first password to get started with secure storage
      </Text>
      <TouchableOpacity
        onPress={handleAddPassword}
        style={[
          styles.emptyButton,
          { backgroundColor: theme.card, borderColor: theme.primary },
        ]}
      >
        <MaterialIcons name="add" size={20} color={theme.primary} />
        <Text style={[styles.emptyButtonText, { color: theme.primary }]}>
          Add Password
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {renderHeader()}
      {renderSearchBar()}
      {renderBulkActions()}

      {filteredPasswords.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredPasswords}
          renderItem={renderPasswordItem}
          keyExtractor={item => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383A',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  searchClose: {
    padding: 4,
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 16,
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectionCount: {
    fontSize: 14,
    marginLeft: 'auto',
  },
  list: {
    flex: 1,
    paddingTop: 8,
  },
  passwordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#38383A',
  },
  passwordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  passwordInfo: {
    flex: 1,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  passwordWebsite: {
    fontSize: 14,
    color: '#8E8E93',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
});
