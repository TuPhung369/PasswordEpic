// Debug screen for Dynamic Master Password system
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import {
  generateDynamicMasterPassword,
  verifyDynamicMasterPasswordSession,
  getDynamicMasterPasswordInfo,
  startNewDynamicMasterPasswordSession,
  clearDynamicMasterPasswordData,
  isUsingStaticMasterPassword,
  getEffectiveMasterPassword,
} from '../../services/dynamicMasterPasswordService';
import { getCurrentUser } from '../../services/firebase';

const DynamicMasterPasswordDebugScreen: React.FC = () => {
  const { theme } = useTheme();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDebugInfo = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const currentUser = getCurrentUser();

      // Get dynamic master password info
      const infoResult = await getDynamicMasterPasswordInfo();

      // Check if using static master password
      const usingStatic = await isUsingStaticMasterPassword();

      // Try to verify session
      const sessionResult = await verifyDynamicMasterPasswordSession();

      // Get effective master password (performance test)
      const startTime = Date.now();
      const effectiveResult = await getEffectiveMasterPassword();
      const effectiveDuration = Date.now() - startTime;

      setDebugInfo({
        currentUser: {
          uid: currentUser?.uid || 'Not authenticated',
          email: currentUser?.email || 'No email',
          displayName: currentUser?.displayName || 'No display name',
        },
        sessionInfo: infoResult.success
          ? infoResult.info
          : { error: infoResult.error },
        usingStaticMasterPassword: usingStatic,
        sessionVerification: sessionResult,
        effectiveMasterPassword: {
          success: effectiveResult.success,
          sessionId: effectiveResult.sessionId,
          error: effectiveResult.error,
          duration: `${effectiveDuration}ms`,
          passwordLength: effectiveResult.password?.length || 0,
          derivedKeyLength: effectiveResult.derivedKey?.length || 0,
        },
      });
    } catch (error: any) {
      console.error('Failed to load debug info:', error);
      Alert.alert('Error', `Failed to load debug info: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDebugInfo();
    setRefreshing(false);
  };

  const testGenerateDynamicPassword = async () => {
    try {
      const startTime = Date.now();
      const result = await generateDynamicMasterPassword();
      const duration = Date.now() - startTime;

      Alert.alert(
        'Dynamic Master Password Test',
        `Success: ${result.success}\n` +
          `Duration: ${duration}ms\n` +
          `Session ID: ${result.sessionId?.substring(0, 30)}...\n` +
          `Password Length: ${result.password?.length || 0}\n` +
          `Key Length: ${result.derivedKey?.length || 0}\n` +
          `Error: ${result.error || 'None'}`,
      );

      // Refresh debug info
      await loadDebugInfo();
    } catch (error: any) {
      Alert.alert('Error', `Test failed: ${error.message}`);
    }
  };

  const testStartNewSession = async () => {
    try {
      const result = await startNewDynamicMasterPasswordSession();
      Alert.alert(
        'New Session Test',
        `Success: ${result.success}\n` + `Error: ${result.error || 'None'}`,
      );

      // Refresh debug info
      await loadDebugInfo();
    } catch (error: any) {
      Alert.alert('Error', `Test failed: ${error.message}`);
    }
  };

  const testClearData = async () => {
    Alert.alert(
      'Clear Dynamic Data',
      'This will clear all dynamic master password data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await clearDynamicMasterPasswordData();
              Alert.alert(
                'Clear Data Test',
                `Success: ${result.success}\n` +
                  `Error: ${result.error || 'None'}`,
              );

              // Refresh debug info
              await loadDebugInfo();
            } catch (error: any) {
              Alert.alert('Error', `Test failed: ${error.message}`);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const renderSection = (title: string, data: any) => (
    <View style={[styles.section, { backgroundColor: theme.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.sectionContent, { color: theme.textSecondary }]}>
        {typeof data === 'object'
          ? JSON.stringify(data, null, 2)
          : String(data)}
      </Text>
    </View>
  );

  const renderButton = (title: string, onPress: () => void, color?: string) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color || theme.primary }]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, { color: theme.background }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Text style={[styles.title, { color: theme.text }]}>
        Dynamic Master Password Debug
      </Text>

      {isLoading ? (
        <Text style={[styles.loading, { color: theme.textSecondary }]}>
          Loading debug information...
        </Text>
      ) : debugInfo ? (
        <>
          {renderSection('Current User', debugInfo.currentUser)}
          {renderSection('Session Info', debugInfo.sessionInfo)}
          {renderSection(
            'Using Static Master Password',
            debugInfo.usingStaticMasterPassword,
          )}
          {renderSection('Session Verification', debugInfo.sessionVerification)}
          {renderSection(
            'Effective Master Password',
            debugInfo.effectiveMasterPassword,
          )}

          <View style={styles.buttonContainer}>
            {renderButton(
              'Generate Dynamic Password',
              testGenerateDynamicPassword,
            )}
            {renderButton('Start New Session', testStartNewSession)}
            {renderButton('Clear Dynamic Data', testClearData, theme.error)}
            {renderButton('Refresh Debug Info', handleRefresh, theme.success)}
          </View>
        </>
      ) : (
        <Text style={[styles.error, { color: theme.error }]}>
          Failed to load debug information
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
    fontStyle: 'italic',
  },
  error: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DynamicMasterPasswordDebugScreen;
