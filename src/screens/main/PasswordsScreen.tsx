import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {useAppSelector} from '../../hooks/redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

export const PasswordsScreen: React.FC = () => {
  const {passwords, searchQuery} = useAppSelector(state => state.passwords);

  const filteredPasswords = passwords.filter(password =>
    password.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    password.website.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderPasswordItem = ({item}: {item: any}) => (
    <TouchableOpacity style={styles.passwordItem}>
      <View style={styles.passwordIcon}>
        <Icon name="lock" size={24} color="#007AFF" />
      </View>
      <View style={styles.passwordInfo}>
        <Text style={styles.passwordTitle}>{item.title}</Text>
        <Text style={styles.passwordWebsite}>{item.website}</Text>
      </View>
      <Icon name="chevron-right" size={24} color="#cccccc" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Passwords</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {filteredPasswords.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="lock" size={64} color="#666666" />
          <Text style={styles.emptyTitle}>No Passwords Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + button to add your first password
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPasswords}
          renderItem={renderPasswordItem}
          keyExtractor={item => item.id}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  passwordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  passwordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    color: '#cccccc',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
  },
});