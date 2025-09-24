import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSelector } from "../../hooks/redux";
import { RootState } from "../../store";
import { MaterialIcons } from "@expo/vector-icons";
import { PasswordEntry } from "../../types";

export const PasswordsScreen: React.FC = () => {
  const { passwords, searchQuery } = useAppSelector(
    (state: RootState) => state.passwords
  );

  const filteredPasswords = passwords.filter(
    (password: PasswordEntry) =>
      password.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      password.website.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderPasswordItem = ({ item }: { item: PasswordEntry }) => (
    <TouchableOpacity style={styles.passwordItem}>
      <View style={styles.passwordIcon}>
        <MaterialIcons name="lock" size={20} color="#007AFF" />
      </View>
      <View style={styles.passwordInfo}>
        <Text style={styles.passwordTitle}>{item.title}</Text>
        <Text style={styles.passwordWebsite}>{item.website}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="content-copy" size={18} color="#8E8E93" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="visibility" size={18} color="#8E8E93" />
        </TouchableOpacity>
        <MaterialIcons name="chevron-right" size={20} color="#8E8E93" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>🔐 Vault</Text>
          <Text style={styles.subtitle}>
            {filteredPasswords.length} passwords
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.searchButton}>
            <MaterialIcons name="search" size={22} color="#8E8E93" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton}>
            <MaterialIcons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {filteredPasswords.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="lock" size={48} color="#007AFF" />
          </View>
          <Text style={styles.emptyTitle}>Your Vault is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Add your first password to get started with secure storage
          </Text>
          <TouchableOpacity style={styles.emptyButton}>
            <MaterialIcons name="add" size={20} color="#007AFF" />
            <Text style={styles.emptyButtonText}>Add Password</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPasswords}
          renderItem={renderPasswordItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#38383A",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "500",
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#007AFF",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  passwordItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: "#38383A",
  },
  passwordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  passwordInfo: {
    flex: 1,
  },
  passwordTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  passwordWebsite: {
    fontSize: 14,
    color: "#8E8E93",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#007AFF",
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
});

