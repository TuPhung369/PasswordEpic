# Chrome Autofill Integration Examples

Complete examples showing how to integrate Chrome autofill into different screens.

---

## Example 1: Simple Login Screen

```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';
import type { AutofillCredential } from '../services/autofillService';

interface LoginScreenProps {
  credentials: AutofillCredential[];
  domain: string;
  onLoginSuccess: () => void;
}

export const SimpleLoginScreen: React.FC<LoginScreenProps> = ({
  credentials,
  domain,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (username && password) {
      // Your login logic
      console.log('Logging in with:', { username, password });
      onLoginSuccess();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {/* Chrome Autofill Button - Shows when form detected */}
      <ChromeAutofillButton
        credentials={credentials}
        domain={domain}
        onSuccess={onLoginSuccess}
        onError={error => console.error('Autofill error:', error)}
        size="medium"
      />

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button title="Login" onPress={handleLogin} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
});
```

---

## Example 2: With Form Indicator

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChromeAutofillIndicator } from '../components/ChromeAutofillIndicator';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';
import type { AutofillCredential } from '../services/autofillService';

interface WebLoginViewProps {
  credentials: AutofillCredential[];
  loginUrl: string;
}

export const WebLoginView: React.FC<WebLoginViewProps> = ({
  credentials,
  loginUrl,
}) => {
  return (
    <View style={styles.container}>
      {/* Indicator - Shows when form is detected */}
      <ChromeAutofillIndicator
        credentials={credentials}
        visible={true}
        autoDetect={true}
        onFormDetected={detected => {
          console.log('Form detection changed:', detected);
        }}
      />

      {/* Autofill Button - Alternative or complementary UI */}
      <ChromeAutofillButton
        credentials={credentials}
        currentUrl={loginUrl}
        variant="secondary"
        onSuccess={() => console.log('Auto-filled!')}
      />

      {/* WebView with login form */}
      <WebView source={{ uri: loginUrl }} style={styles.webview} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
```

---

## Example 3: With Redux Integration

```typescript
import React from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';
import type { RootState } from '../store';
import type { PasswordEntry } from '../types/password';

export const ReduxLoginScreen: React.FC = () => {
  // Get credentials from Redux
  const passwords = useSelector((state: RootState) => state.passwords.entries);
  const currentDomain = useSelector(
    (state: RootState) => state.auth.currentDomain,
  );

  // Convert PasswordEntry to AutofillCredential
  const autofillCredentials = passwords.map(pwd => ({
    id: pwd.id,
    domain: pwd.website || '',
    username: pwd.username,
    password: pwd.password,
    lastUsed: pwd.lastUsed ? new Date(pwd.lastUsed).getTime() : undefined,
  }));

  const handleLoginSuccess = () => {
    dispatch({ type: 'AUTH/LOGIN_SUCCESS' });
  };

  return (
    <View style={styles.container}>
      <ChromeAutofillButton
        credentials={autofillCredentials}
        domain={currentDomain}
        onSuccess={handleLoginSuccess}
      />

      <TextInput placeholder="Username" style={styles.input} />
      <TextInput placeholder="Password" style={styles.input} secureTextEntry />
      <Button title="Login" onPress={handleLoginSuccess} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});
```

---

## Example 4: Advanced - Manual Control

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useChromeAutoFill } from '../hooks/useChromeAutoFill';
import type { AutofillCredential } from '../services/autofillService';

interface AdvancedLoginScreenProps {
  credentials: AutofillCredential[];
  domain: string;
}

export const AdvancedLoginScreen: React.FC<AdvancedLoginScreenProps> = ({
  credentials,
  domain,
}) => {
  const [selectedCredential, setSelectedCredential] =
    useState<AutofillCredential | null>(null);

  const {
    isSupported,
    isAvailable,
    isInjecting,
    formDetected,
    error,
    detectForm,
    injectCredentials,
    resetError,
  } = useChromeAutoFill(credentials, {
    autoDetect: false, // Manual control
    biometricRequired: true,
  });

  // Manual form detection
  const handleDetectForm = async () => {
    resetError();
    const result = await detectForm();
    if (result?.isLoginForm) {
      Alert.alert('✅ Login form detected!');
    } else {
      Alert.alert('❌ No login form found');
    }
  };

  // Manual credential selection and injection
  const handleSelectAndInject = async (credential: AutofillCredential) => {
    setSelectedCredential(credential);
    resetError();

    const success = await injectCredentials({
      domain: credential.domain,
      username: credential.username,
      password: credential.password,
    });

    if (success) {
      Alert.alert('✅ Credentials injected!');
    }
  };

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <Text>Chrome autofill not supported on this device</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Advanced Manual Control</Text>

      {/* Support Check */}
      <View style={styles.statusBox}>
        <Text>✅ Supported: {isSupported ? 'Yes' : 'No'}</Text>
        <Text>✅ Available: {isAvailable ? 'Yes' : 'No'}</Text>
        <Text>✅ Form Detected: {formDetected ? 'Yes' : 'No'}</Text>
      </View>

      {/* Manual Form Detection */}
      <Button
        title="Detect Form"
        onPress={handleDetectForm}
        disabled={isInjecting}
      />

      {/* Credential List */}
      <Text style={styles.sectionTitle}>Available Credentials:</Text>
      {credentials.map(cred => (
        <View key={cred.id} style={styles.credentialItem}>
          <Text>{cred.username}</Text>
          <Button
            title={
              selectedCredential?.id === cred.id ? '⏳ Injecting...' : 'Use'
            }
            onPress={() => handleSelectAndInject(cred)}
            disabled={isInjecting}
          />
        </View>
      ))}

      {/* Error Display */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <Button title="Dismiss" onPress={resetError} />
        </View>
      )}

      {/* Loading Indicator */}
      {isInjecting && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text>Injecting credentials...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusBox: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  credentialItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 8,
    borderRadius: 6,
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
});
```

---

## Example 5: With Error Boundary

```typescript
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';
import type { AutofillCredential } from '../services/autofillService';

interface ErrorBoundaryLoginScreenProps {
  credentials: AutofillCredential[];
  domain: string;
}

const LoginContent: React.FC<ErrorBoundaryLoginScreenProps> = ({
  credentials,
  domain,
}) => {
  return (
    <View style={styles.container}>
      <ChromeAutofillButton
        credentials={credentials}
        domain={domain}
        onError={error => {
          console.error('Autofill error caught:', error);
        }}
      />
      <Button title="Login" onPress={() => {}} />
    </View>
  );
};

export const SafeLoginScreen: React.FC<
  ErrorBoundaryLoginScreenProps
> = props => {
  return (
    <ErrorBoundary>
      <LoginContent {...props} />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});
```

---

## Example 6: With Custom Styling

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';
import { ChromeAutofillIndicator } from '../components/ChromeAutofillIndicator';
import type { AutofillCredential } from '../services/autofillService';

export const StyledLoginScreen: React.FC<{
  credentials: AutofillCredential[];
}> = ({ credentials }) => {
  return (
    <View style={styles.container}>
      {/* Styled Indicator */}
      <ChromeAutofillIndicator
        credentials={credentials}
        style={[
          styles.indicator,
          {
            backgroundColor: '#E3F2FD',
            borderLeftColor: '#2196F3',
          },
        ]}
      />

      {/* Large Primary Button */}
      <ChromeAutofillButton
        credentials={credentials}
        variant="primary"
        size="large"
        style={styles.primaryButton}
      />

      {/* Secondary Button */}
      <ChromeAutofillButton
        credentials={credentials}
        variant="secondary"
        size="medium"
        style={styles.secondaryButton}
      />

      {/* Outline Button */}
      <ChromeAutofillButton
        credentials={credentials}
        variant="outline"
        size="small"
        style={styles.outlineButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  indicator: {
    marginBottom: 12,
  },
  primaryButton: {
    marginBottom: 8,
  },
  secondaryButton: {
    marginBottom: 8,
  },
  outlineButton: {
    marginBottom: 8,
  },
});
```

---

## Example 7: Progressive Enhancement

```typescript
import React, { useEffect, useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';
import { useChromeAutoFill } from '../hooks/useChromeAutoFill';
import type { AutofillCredential } from '../services/autofillService';

interface ProgressiveLoginScreenProps {
  credentials: AutofillCredential[];
  domain: string;
}

export const ProgressiveLoginScreen: React.FC<ProgressiveLoginScreenProps> = ({
  credentials,
  domain,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'initial' | 'checking' | 'ready'>('initial');

  const { isAvailable, formDetected } = useChromeAutoFill(credentials);

  // Progressive enhancement based on Chrome autofill availability
  useEffect(() => {
    if (!isAvailable) {
      setStep('initial');
      return;
    }

    if (formDetected) {
      setStep('ready');
    } else {
      setStep('checking');
    }
  }, [isAvailable, formDetected]);

  return (
    <View style={styles.container}>
      {/* Show indicator based on step */}
      {step === 'checking' && (
        <Text style={styles.infoText}>🔍 Checking for login form...</Text>
      )}

      {step === 'ready' && (
        <>
          <Text style={styles.infoText}>✅ Chrome autofill available!</Text>
          <ChromeAutofillButton
            credentials={credentials}
            domain={domain}
            onSuccess={() => setStep('initial')}
          />
        </>
      )}

      {/* Always show traditional login */}
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Login" onPress={() => {}} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});
```

---

## Quick Integration Checklist

- [ ] Import `ChromeAutofillButton` or `ChromeAutofillIndicator`
- [ ] Import `useChromeAutoFill` hook if manual control needed
- [ ] Pass `credentials` array (AutofillCredential[])
- [ ] Set `domain` prop to current domain
- [ ] Add `onSuccess` callback
- [ ] Add `onError` callback
- [ ] Test on Android Chrome browser
- [ ] Test biometric authentication
- [ ] Test error cases (missing form, wrong domain, etc.)
- [ ] Customize styling if needed

---

**See also**: `CHROME_AUTOFILL_IMPLEMENTATION_GUIDE.md` for complete documentation.
