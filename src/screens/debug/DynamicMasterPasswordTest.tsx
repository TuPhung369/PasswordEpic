// Simple test for Dynamic Master Password system
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getCurrentUser } from '../../services/firebase';
import {
  getEffectiveMasterPassword,
  generateDynamicMasterPassword,
} from '../../services/dynamicMasterPasswordService';

const DynamicMasterPasswordTest: React.FC = () => {
  const { theme } = useTheme();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
    console.log(message);
  };

  const runFullTest = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      addResult('🚀 Starting Dynamic Master Password Test');

      // Test 1: Check current user
      const currentUser = getCurrentUser();
      if (currentUser) {
        addResult(
          `✅ User authenticated: ${
            currentUser.email
          } (${currentUser.uid.substring(0, 10)}...)`,
        );
      } else {
        addResult('❌ No authenticated user found');
        setIsRunning(false);
        return;
      }

      // Test 2: Generate dynamic master password
      addResult('🔐 Testing dynamic master password generation...');
      const startTime = Date.now();

      const dynamicResult = await generateDynamicMasterPassword();
      const duration = Date.now() - startTime;

      if (dynamicResult.success) {
        addResult(`✅ Dynamic password generated in ${duration}ms`);
        addResult(
          `   - Session ID: ${dynamicResult.sessionId?.substring(0, 30)}...`,
        );
        addResult(`   - Password length: ${dynamicResult.password?.length}`);
        addResult(
          `   - Derived key length: ${dynamicResult.derivedKey?.length}`,
        );
      } else {
        addResult(`❌ Dynamic password failed: ${dynamicResult.error}`);
      }

      // Test 3: Test effective master password (caching)
      addResult('⚡ Testing effective master password (with caching)...');

      const test1Start = Date.now();
      const effective1 = await getEffectiveMasterPassword();
      const test1Duration = Date.now() - test1Start;

      const test2Start = Date.now();
      const effective2 = await getEffectiveMasterPassword();
      const test2Duration = Date.now() - test2Start;

      addResult(
        `   - First call: ${test1Duration}ms (${
          effective1.success ? 'success' : 'failed'
        })`,
      );
      addResult(
        `   - Second call: ${test2Duration}ms (${
          effective2.success ? 'success' : 'failed'
        }) - should be cached`,
      );

      if (test2Duration < test1Duration / 2) {
        addResult('✅ Caching is working effectively');
      } else {
        addResult('⚠️ Caching might not be working optimally');
      }

      // Test 4: Performance comparison
      addResult('🏎️ Running performance test (5 calls)...');
      const perfTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        const perfStart = Date.now();
        const perfResult = await getEffectiveMasterPassword();
        const perfDuration = Date.now() - perfStart;
        perfTimes.push(perfDuration);

        if (perfResult.success) {
          addResult(`   - Call ${i + 1}: ${perfDuration}ms`);
        } else {
          addResult(
            `   - Call ${i + 1}: ${perfDuration}ms (failed: ${
              perfResult.error
            })`,
          );
        }
      }

      const avgTime = perfTimes.reduce((a, b) => a + b, 0) / perfTimes.length;
      const minTime = Math.min(...perfTimes);
      const maxTime = Math.max(...perfTimes);

      addResult(
        `📊 Performance stats: avg=${avgTime.toFixed(
          1,
        )}ms, min=${minTime}ms, max=${maxTime}ms`,
      );

      addResult('🎉 Dynamic Master Password Test Completed Successfully!');
    } catch (error: any) {
      addResult(`💥 Test failed with error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Dynamic Master Password Test
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={runFullTest}
          disabled={isRunning}
        >
          <Text style={[styles.buttonText, { color: theme.background }]}>
            {isRunning ? 'Running Test...' : 'Run Full Test'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.error }]}
          onPress={clearResults}
          disabled={isRunning}
        >
          <Text style={[styles.buttonText, { color: theme.background }]}>
            Clear Results
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <Text
            key={index}
            style={[styles.resultText, { color: theme.textSecondary }]}
          >
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
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
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 12,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
    lineHeight: 16,
  },
});

export default DynamicMasterPasswordTest;
