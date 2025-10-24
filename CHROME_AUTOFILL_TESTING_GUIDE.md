# Chrome Autofill Testing Guide

Complete testing guide for the Chrome WebView autofill implementation.

---

## 🧪 Testing Phases

### Phase 1: Unit Testing

#### Test 1: Service Initialization

```typescript
import { chromeAutoFillService } from '../services/chromeAutoFillService';

describe('ChromeAutoFillService', () => {
  it('should initialize without errors', () => {
    expect(chromeAutoFillService).toBeDefined();
  });

  it('should check if supported', async () => {
    const supported = await chromeAutoFillService.isSupported();
    expect(typeof supported).toBe('boolean');
  });
});
```

#### Test 2: Form Detection

```typescript
describe('Form Detection', () => {
  it('should detect login form', async () => {
    const result = await chromeAutoFillService.detectLoginForm();
    expect(result).toHaveProperty('isLoginForm');
    expect(result).toHaveProperty('hasUserField');
    expect(result).toHaveProperty('hasPassField');
  });

  it('should detect all forms', async () => {
    const result = await chromeAutoFillService.detectAllForms();
    expect(result).toHaveProperty('formCount');
    expect(result).toHaveProperty('forms');
    expect(Array.isArray(result.forms)).toBe(true);
  });
});
```

#### Test 3: Credential Injection

```typescript
describe('Credential Injection', () => {
  it('should inject credentials', async () => {
    const result = await chromeAutoFillService.injectCredentials({
      domain: 'github.com',
      username: 'testuser',
      password: 'testpass',
    });
    expect(result.success).toBe(true);
  });

  it('should handle injection errors', async () => {
    const result = await chromeAutoFillService.injectCredentials({
      domain: 'invalid-domain.com',
      username: '',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});
```

#### Test 4: Hook State Management

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useChromeAutoFill } from '../hooks/useChromeAutoFill';

describe('useChromeAutoFill Hook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useChromeAutoFill());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSupported).toBe(false);
  });

  it('should detect form', async () => {
    const { result } = renderHook(() => useChromeAutoFill());

    await act(async () => {
      await result.current.detectForm();
    });

    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
  });
});
```

### Phase 2: Component Testing

#### Test 1: Chrome Autofill Button

```typescript
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';

describe('ChromeAutofillButton', () => {
  const mockCredentials = [
    {
      id: '1',
      domain: 'github.com',
      username: 'testuser',
      password: 'testpass',
    },
  ];

  it('should render button', () => {
    const { getByTestId } = render(
      <ChromeAutofillButton
        credentials={mockCredentials}
        domain="github.com"
        testID="autofill-button"
      />,
    );

    expect(getByTestId('autofill-button')).toBeDefined();
  });

  it('should handle press', async () => {
    const onSuccess = jest.fn();
    const { getByTestId } = render(
      <ChromeAutofillButton
        credentials={mockCredentials}
        domain="github.com"
        onSuccess={onSuccess}
        testID="autofill-button"
      />,
    );

    fireEvent.press(getByTestId('autofill-button'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should show loading state', async () => {
    const { getByText } = render(
      <ChromeAutofillButton
        credentials={mockCredentials}
        domain="github.com"
      />,
    );

    // After press
    fireEvent.press(getByText('Autofill'));

    await waitFor(() => {
      expect(getByText('Filling...')).toBeDefined();
    });
  });

  it('should show error', () => {
    const onError = jest.fn();
    const { getByTestId } = render(
      <ChromeAutofillButton
        credentials={[]}
        domain="github.com"
        onError={onError}
        testID="autofill-button"
      />,
    );

    fireEvent.press(getByTestId('autofill-button'));

    expect(onError).toHaveBeenCalled();
  });
});
```

#### Test 2: Chrome Autofill Indicator

```typescript
describe('ChromeAutofillIndicator', () => {
  it('should not render when no form detected', () => {
    const { queryByText } = render(
      <ChromeAutofillIndicator credentials={mockCredentials} visible={true} />,
    );

    expect(queryByText('Autofill available')).toBeNull();
  });

  it('should render when form detected', async () => {
    const { getByText } = render(
      <ChromeAutofillIndicator
        credentials={mockCredentials}
        visible={true}
        autoDetect={true}
      />,
    );

    await waitFor(() => {
      expect(getByText('Autofill available')).toBeDefined();
    });
  });

  it('should call onFormDetected callback', async () => {
    const onFormDetected = jest.fn();
    render(
      <ChromeAutofillIndicator
        credentials={mockCredentials}
        onFormDetected={onFormDetected}
      />,
    );

    await waitFor(() => {
      expect(onFormDetected).toHaveBeenCalled();
    });
  });
});
```

---

### Phase 3: Integration Testing

#### Manual Test 1: Basic GitHub Login

**Setup**:

- Install app on real Android device with Chrome
- Have saved GitHub credentials in PasswordEpic

**Steps**:

1. Open PasswordEpic app
2. Go to Settings > Autofill
3. Enable Chrome autofill if not enabled
4. Open Chrome browser
5. Navigate to https://github.com/login
6. PasswordEpic indicator should appear
7. Tap autofill button
8. Provide biometric authentication
9. Fields should be filled with credentials
10. Form should be ready to submit

**Expected Result**: ✅ GitHub username and password filled

**Log Checks**:

```
✅ Credentials injected successfully
✅ Injection completed with timestamp
```

---

#### Manual Test 2: Facebook Login with Subdomain

**Setup**:

- Saved Facebook credentials for facebook.com
- App running in foreground

**Steps**:

1. Open Chrome
2. Navigate to https://www.facebook.com/login
3. Indicator should show form detected (subdomain match)
4. Tap autofill
5. Biometric prompt appears
6. Credentials injected to m.facebook.com URL

**Expected Result**: ✅ Subdomains matched and filled

**Verification**:

```javascript
// In Chrome DevTools
console.log(document.querySelector('input[type="email"]').value);
// Should show: user@example.com
```

---

#### Manual Test 3: HTTPS-Only Security

**Steps**:

1. Navigate to http://example.com/login (HTTP, not HTTPS)
2. Autofill button should not appear
3. Try to call inject service manually
4. Should reject with "HTTPS required" error

**Expected Result**: ✅ No injection on HTTP pages

---

#### Manual Test 4: Domain Verification

**Setup**:

- Credentials for github.com stored
- Navigate to example.com login page

**Steps**:

1. Open https://example.com/login
2. Autofill button appears (form detected)
3. Tap autofill
4. System checks domain: example.com vs stored github.com
5. Should show error: "Domain mismatch"

**Expected Result**: ✅ Prevents filling wrong credentials on wrong site

---

#### Manual Test 5: Biometric Authentication

**Setup**:

- Biometric enabled in settings
- Fingerprint/Face registered on device

**Steps**:

1. Tap autofill button
2. Biometric prompt appears
3. Provide correct fingerprint
4. Credentials injected
5. Go back, tap again
6. Provide wrong fingerprint
7. Should reject

**Expected Result**: ✅ Biometric verification required and working

---

#### Manual Test 6: Multiple Forms on One Page

**Setup**:

- Page with multiple login forms
- Each form has different username/password fields

**Steps**:

1. Navigate to page with multiple forms
2. Call detectAllForms()
3. Should return array with multiple form entries
4. Try injecting into different form indexes
5. Each should work independently

**Expected Result**: ✅ Can handle multiple forms

---

### Phase 4: Performance Testing

#### Test 1: Form Detection Latency

```typescript
it('should detect form within acceptable time', async () => {
  const startTime = Date.now();
  await chromeAutoFillService.detectLoginForm();
  const endTime = Date.now();
  const duration = endTime - startTime;

  expect(duration).toBeLessThan(1000); // Should be <1 second
});
```

#### Test 2: Injection Latency

```typescript
it('should inject credentials quickly', async () => {
  const startTime = Date.now();
  await chromeAutoFillService.injectCredentials({
    domain: 'github.com',
    username: 'user',
    password: 'pass',
  });
  const endTime = Date.now();
  const duration = endTime - startTime;

  expect(duration).toBeLessThan(500); // Should be <500ms
});
```

#### Test 3: Memory Usage

```typescript
it('should not leak memory on repeated injections', async () => {
  const initialMemory = performance.memory.usedJSHeapSize;

  for (let i = 0; i < 10; i++) {
    await chromeAutoFillService.injectCredentials({
      domain: 'github.com',
      username: 'user',
      password: 'pass',
    });
  }

  const finalMemory = performance.memory.usedJSHeapSize;
  const memoryGrowth = finalMemory - initialMemory;

  expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // <5MB growth
});
```

---

### Phase 5: Security Testing

#### Test 1: XSS Prevention

```typescript
it('should escape JavaScript special characters', async () => {
  const maliciousInput = `"; alert('XSS'); "`;

  // Should not throw
  const result = await chromeAutoFillService.injectCredentials({
    domain: 'github.com',
    username: maliciousInput,
    password: 'test',
  });

  expect(result.success).toBe(true);
});
```

#### Test 2: No Credential Logging

```typescript
it('should not log credentials', async () => {
  const consoleSpy = jest.spyOn(console, 'log');

  await chromeAutoFillService.injectCredentials({
    domain: 'github.com',
    username: 'user@example.com',
    password: 'MySecurePassword123!',
  });

  // Check logs don't contain credentials
  const logs = consoleSpy.mock.calls.join(' ');
  expect(logs).not.toContain('MySecurePassword123!');
  expect(logs).not.toContain('user@example.com');
});
```

#### Test 3: Domain Whitelist

```typescript
it('should verify domain before injection', async () => {
  const unverifiedDomain = 'phishing-site.com';

  // Mock domain verification to fail
  domainVerificationService.verifyDomain = jest.fn().mockResolvedValue(false);

  const result = await chromeAutoFillService.injectCredentials({
    domain: unverifiedDomain,
    username: 'user',
    password: 'pass',
  });

  expect(result.success).toBe(false);
});
```

---

## 🚀 Test Execution

### Run All Tests

```bash
npm test -- --testPathPattern=chromeAutofill
```

### Run Specific Test Suite

```bash
npm test -- ChromeAutofillButton
npm test -- useChromeAutoFill
npm test -- ChromeAutoFillService
```

### Run with Coverage

```bash
npm test -- --coverage --testPathPattern=chromeAutofill
```

### Run E2E Tests

```bash
npm run test:e2e -- chromeAutofill
```

---

## 📋 Test Checklist

### Service Tests

- [ ] Service initializes correctly
- [ ] Form detection works
- [ ] All forms detection works
- [ ] Credential injection works
- [ ] Domain verification works
- [ ] Error handling works
- [ ] Events emitted correctly

### Component Tests

- [ ] Button renders when form detected
- [ ] Button disabled when not supported
- [ ] Button shows loading state
- [ ] Button calls callbacks
- [ ] Indicator shows/hides correctly
- [ ] Indicator responsive to prop changes

### Integration Tests

- [ ] GitHub login works
- [ ] Facebook login works with subdomain
- [ ] HTTPS requirement enforced
- [ ] Domain verification prevents wrong fills
- [ ] Biometric authentication works
- [ ] Multiple forms handled
- [ ] Error messages clear

### Security Tests

- [ ] XSS prevented
- [ ] No credential logging
- [ ] Domain verification working
- [ ] HTTPS only
- [ ] Biometric required

### Performance Tests

- [ ] Form detection < 1000ms
- [ ] Credential injection < 500ms
- [ ] No memory leaks
- [ ] Handles rapid requests

---

## 🐛 Common Test Issues

### Issue: "Module not found"

**Cause**: ChromeInjectBridge not available in test environment

**Solution**:

```typescript
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  NativeModules: {
    ...jest.requireActual('react-native').NativeModules,
    ChromeInjectBridge: {
      detectLoginForm: jest.fn().mockResolvedValue({ isLoginForm: true }),
      injectCredentials: jest.fn().mockResolvedValue({ success: true }),
    },
  },
}));
```

### Issue: "WebView not found"

**Cause**: Test environment doesn't have WebView

**Solution**: Mock WebView in tests:

```typescript
jest.mock('react-native-webview', () => ({
  WebView: () => null,
}));
```

### Issue: "Timeout waiting for form detection"

**Cause**: Polling interval too high for tests

**Solution**: Reduce poll interval in tests:

```typescript
useChromeAutoFill(credentials, {
  pollInterval: 100, // 100ms for tests instead of 3000ms
});
```

---

## 📊 Test Coverage Target

| Category    | Target | Status |
| ----------- | ------ | ------ |
| Services    | > 90%  | 🚀     |
| Hooks       | > 85%  | 🚀     |
| Components  | > 80%  | 🚀     |
| Integration | > 75%  | 🚀     |
| Overall     | > 85%  | 🚀     |

---

## 🔍 Manual Testing Scenarios

### Scenario 1: Happy Path

1. Open Chrome
2. Navigate to login page
3. Auto-fill appears
4. Click autofill
5. Biometric confirms
6. Fields filled
7. Submit form

**Expected**: ✅ All steps succeed

### Scenario 2: No Form

1. Open Chrome
2. Navigate to non-login page
3. No auto-fill appears
4. Open DevTools console
5. Manually call detectForm()
6. Returns isLoginForm: false

**Expected**: ✅ Correctly identifies no form

### Scenario 3: Wrong Domain

1. Have credentials for github.com
2. Open facebook.com login
3. Click autofill
4. Error: "Domain mismatch"
5. Credentials not filled

**Expected**: ✅ Prevents wrong-site fill

### Scenario 4: Biometric Denied

1. Click autofill
2. Biometric prompt appears
3. Deny/Cancel
4. Nothing happens
5. Fields remain empty

**Expected**: ✅ Respects user denial

### Scenario 5: Multiple Credentials

1. Have multiple credentials for github.com
2. Open github.com login
3. Should use first matching
4. Correct username/password filled

**Expected**: ✅ Correct credential selected

---

## 📝 Reporting

After testing, fill out this checklist:

```markdown
## Chrome Autofill Testing Report

**Date**: [DATE]
**Tester**: [NAME]
**Device**: [MODEL, OS VERSION]

### Overall Status

- [ ] All tests passed
- [ ] No critical issues
- [ ] Performance acceptable
- [ ] Security verified

### Issues Found

- [ ] Critical: [List]
- [ ] Major: [List]
- [ ] Minor: [List]

### Recommendations

- [ ] Ready for production
- [ ] Minor fixes needed
- [ ] Major revisions needed
```

---

**Last Updated**: Week 10
**Status**: Ready for Testing ✅
