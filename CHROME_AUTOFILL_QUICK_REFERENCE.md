# Chrome Autofill - Quick Reference Card

Fast lookup for developers integrating Chrome autofill.

---

## 🎯 30-Second Integration

```typescript
import { ChromeAutofillButton } from '../components/ChromeAutofillButton';

<ChromeAutofillButton credentials={credentials} domain="github.com" />;
```

---

## 📦 Files Overview

| File                          | Purpose       | Status   |
| ----------------------------- | ------------- | -------- |
| `ChromeInjectBridge.kt`       | Native module | ✅ Ready |
| `chromeAutoFillService.ts`    | Core service  | ✅ Ready |
| `useChromeAutoFill.ts`        | React hook    | ✅ Ready |
| `ChromeAutofillButton.tsx`    | UI button     | ✅ Ready |
| `ChromeAutofillIndicator.tsx` | Form detector | ✅ Ready |

---

## 🚀 Three Integration Approaches

### Approach 1: Simplest (Recommended)

```typescript
<ChromeAutofillButton credentials={credentials} domain="github.com" />
```

### Approach 2: With Indicator

```typescript
<ChromeAutofillIndicator credentials={credentials} autoDetect />
<ChromeAutofillButton credentials={credentials} domain="github.com" />
```

### Approach 3: Full Control

```typescript
const { detectForm, injectCredentials } = useChromeAutoFill(credentials);
// Manual management
```

---

## 🔧 Common Props

### ChromeAutofillButton

```typescript
<ChromeAutofillButton
  credentials={AutofillCredential[]}      // Required: saved passwords
  domain="github.com"                      // Optional: domain name
  currentUrl="https://github.com/login"   // Optional: full URL
  variant="primary"                        // Optional: primary|secondary|outline
  size="medium"                            // Optional: small|medium|large
  biometricRequired={true}                 // Optional: require Face ID/fingerprint
  onSuccess={() => console.log('✅')}      // Optional: success callback
  onError={(e) => console.error('❌')}     // Optional: error callback
  visible={true}                           // Optional: show/hide
  disabled={false}                         // Optional: disable button
/>
```

### ChromeAutofillIndicator

```typescript
<ChromeAutofillIndicator
  credentials={AutofillCredential[]}       // Required: saved passwords
  autoDetect={true}                        // Optional: auto-detect forms
  visible={true}                           // Optional: show/hide
  onFormDetected={(detected) => {}}        // Optional: form detection callback
  onAutofill={() => {}}                    // Optional: autofill success callback
/>
```

### useChromeAutoFill Hook

```typescript
const {
  // State
  isSupported: boolean,
  isAvailable: boolean,
  isLoading: boolean,
  isInjecting: boolean,
  isDetecting: boolean,
  error: string | null,
  formDetected: boolean,
  lastInjectionTime: number | null,

  // Methods
  detectForm,
  injectCredentials,
  autoFillCurrentPage,
  clearInjectedContent,
  resetError,
} = useChromeAutoFill(credentials, options);
```

---

## 💡 Common Patterns

### Redux Integration

```typescript
const credentials = useSelector(s => s.passwords.entries).map(p => ({
  id: p.id,
  domain: p.website,
  username: p.username,
  password: p.password,
}));

<ChromeAutofillButton credentials={credentials} domain="github.com" />;
```

### With Error Handling

```typescript
const [error, setError] = useState('');

<ChromeAutofillButton
  credentials={credentials}
  domain="github.com"
  onError={setError}
/>;
{
  error && <Text style={{ color: 'red' }}>{error}</Text>;
}
```

### Manual Control

```typescript
const { injectCredentials, isInjecting } = useChromeAutoFill();

const handleManualAutofill = async () => {
  await injectCredentials({
    domain: 'github.com',
    username: 'user@example.com',
    password: 'password',
  });
};

<Button
  title={isInjecting ? 'Filling...' : 'Autofill'}
  onPress={handleManualAutofill}
  disabled={isInjecting}
/>;
```

---

## 🔒 Security Checklist

- ✅ HTTPS only (HTTP pages rejected automatically)
- ✅ Domain verified before injection
- ✅ XSS prevention (special chars escaped)
- ✅ Biometric confirmation (optional but recommended)
- ✅ No credential logging
- ✅ Encrypted storage

---

## ❌ Don't Do This

```typescript
// ❌ WRONG: Storing credentials in plain text
localStorage.setItem('password', 'myPassword');

// ❌ WRONG: Injecting without user interaction
// (automatically fill without user clicking button)

// ❌ WRONG: Injecting on HTTP pages
// (only HTTPS supported)

// ❌ WRONG: Logging credentials
console.log('Username:', username, 'Password:', password);

// ❌ WRONG: Filling wrong domain
// Domain verification prevents this automatically
```

---

## 🧪 Quick Test

```typescript
// Check if available
const { isAvailable } = useChromeAutoFill();
console.log('Chrome autofill available:', isAvailable);

// Detect form
const { detectForm } = useChromeAutoFill();
const result = await detectForm();
console.log('Form detected:', result.isLoginForm);

// Manual injection
const { injectCredentials } = useChromeAutoFill();
const success = await injectCredentials({
  domain: 'github.com',
  username: 'user@example.com',
  password: 'password',
});
console.log('Injection success:', success);
```

---

## 📊 Component Props Cheat Sheet

| Prop              | Type                              | Default   | Required?              |
| ----------------- | --------------------------------- | --------- | ---------------------- |
| credentials       | AutofillCredential[]              | -         | ✅ For Button          |
| domain            | string                            | -         | ⚠️ If not using URL    |
| currentUrl        | string                            | -         | ⚠️ If not using domain |
| variant           | 'primary'\|'secondary'\|'outline' | 'primary' | ❌                     |
| size              | 'small'\|'medium'\|'large'        | 'medium'  | ❌                     |
| biometricRequired | boolean                           | true      | ❌                     |
| onSuccess         | () => void                        | -         | ❌                     |
| onError           | (error: string) => void           | -         | ❌                     |
| visible           | boolean                           | true      | ❌                     |
| disabled          | boolean                           | false     | ❌                     |
| autoDetect        | boolean                           | true      | ❌                     |

---

## 🎨 Styling Examples

### Custom Button Style

```typescript
<ChromeAutofillButton
  credentials={credentials}
  domain="github.com"
  variant="primary"
  size="large"
  style={{ marginVertical: 16, borderRadius: 12 }}
/>
```

### Custom Indicator Style

```typescript
<ChromeAutofillIndicator
  credentials={credentials}
  style={{
    backgroundColor: '#E3F2FD',
    borderLeftColor: '#2196F3',
  }}
/>
```

---

## 🔍 Debug Commands

```typescript
// Check support
import { chromeAutoFillService } from '../services/chromeAutoFillService';
await chromeAutoFillService.isSupported(); // true/false

// Detect forms
const forms = await chromeAutoFillService.detectAllForms();
console.log('Forms found:', forms.formCount);

// Check current form
const form = await chromeAutoFillService.detectLoginForm();
console.log('Login form:', form.isLoginForm);
```

---

## 🚨 Error Messages & Meanings

| Error                       | Meaning                        | Solution                |
| --------------------------- | ------------------------------ | ----------------------- |
| "Module not available"      | ChromeInjectBridge not loaded  | Rebuild app             |
| "Form not detected"         | No login form on page          | Check page URL          |
| "Domain mismatch"           | URL domain ≠ credential domain | Use correct domain      |
| "HTTPS required"            | Page is HTTP, not HTTPS        | Navigate to HTTPS       |
| "Biometric cancelled"       | User denied biometric          | Expected behavior       |
| "No credentials for domain" | No matching credentials stored | Store credentials first |

---

## 📋 Type Definitions

```typescript
// Credential type
interface AutofillCredential {
  id: string;
  domain: string;
  username: string;
  password: string;
  lastUsed?: number;
}

// Hook options
interface UseChromeAutoFillOptions {
  autoDetect?: boolean; // Auto-detect forms
  biometricRequired?: boolean; // Require Face ID/fingerprint
  onSuccess?: () => void; // Success callback
  onError?: (error: string) => void; // Error callback
  pollInterval?: number; // Form detection interval (ms)
}

// Form detection result
interface DetectionResult {
  success: boolean;
  hasUserField: boolean;
  hasPassField: boolean;
  isLoginForm: boolean;
  fieldIds: {
    userFieldId: string | null;
    userFieldName: string | null;
    passFieldId: string | null;
    passFieldName: string | null;
  };
}

// Injection result
interface InjectionResult {
  success: boolean;
  message?: string;
  error?: string;
  usernameInjected?: boolean;
  passwordInjected?: boolean;
}
```

---

## 🔄 Lifecycle

```typescript
// 1. Component mounts
// → useChromeAutoFill checks support

// 2. User navigates to login page
// → detectForm() called automatically

// 3. Form detected
// → Button/Indicator becomes visible

// 4. User taps autofill button
// → Biometric prompt shown (if enabled)

// 5. Biometric confirmed
// → injectCredentials() called

// 6. Credentials injected
// → onSuccess() callback fired
// → User can submit form

// 7. Component unmounts
// → Event listeners cleaned up
// → Memory freed
```

---

## 🎯 Before Shipping to Production

- [ ] Tested on real device (not emulator)
- [ ] Tested with Chrome browser
- [ ] Biometric tested (Face/Fingerprint/Pattern)
- [ ] Tested error scenarios
- [ ] Domain verification tested
- [ ] HTTPS requirement tested
- [ ] Multiple credentials tested
- [ ] Performance acceptable (<1s detection, <500ms injection)

---

## 📚 Documentation Map

| Need          | Document                                  |
| ------------- | ----------------------------------------- |
| Full guide    | CHROME_AUTOFILL_IMPLEMENTATION_GUIDE.md   |
| Code examples | CHROME_INTEGRATION_EXAMPLES.md            |
| Testing       | CHROME_AUTOFILL_TESTING_GUIDE.md          |
| Architecture  | CHROME_AUTOFILL_SOLUTION_ROADMAP.md       |
| Why needed    | AUTOFILL_WEBVIEW_LIMITATION_ANALYSIS.md   |
| Summary       | CHROME_AUTOFILL_IMPLEMENTATION_SUMMARY.md |

---

## 🆘 Common Problems

### Button not showing

```typescript
// Check if:
✓ credentials provided
✓ domain matches URL
✓ form exists on page
✓ isAvailable is true
✓ formDetected is true
```

### Form not detected

```typescript
// Try:
1. Reload page
2. Check URL in Chrome
3. Manually call detectForm()
4. Check console for errors
```

### Injection fails

```typescript
// Verify:
1. Page is HTTPS (not HTTP)
2. Domain matches credentials
3. Biometric confirmed
4. Form fields present
```

### Biometric prompt not showing

```typescript
// Check:
1. biometricRequired={true}
2. Device has biometric registered
3. Not in emulator (usually can't do biometric)
```

---

## ⚡ Performance Tips

```typescript
// Reduce polling interval for faster detection
useChromeAutoFill(credentials, {
  pollInterval: 1000, // Default is 3000
});

// Or disable auto-detection if not needed
useChromeAutoFill(credentials, {
  autoDetect: false,
});

// Clear content after submission for security
await chromeAutoFillService.clearInjectedContent();
```

---

## 🎓 Learning Path

1. **Beginner**: Read this quick reference
2. **Developer**: Check INTEGRATION_EXAMPLES.md
3. **Integrator**: Follow IMPLEMENTATION_GUIDE.md
4. **Tester**: Use TESTING_GUIDE.md

---

## 📞 Quick Support

**Q: How do I add autofill to my login screen?**
A: Use `<ChromeAutofillButton credentials={credentials} domain="example.com" />`

**Q: Does it work on iOS?**
A: No, only Android with Chrome browser (platform limitation)

**Q: Can it auto-submit forms?**
A: No, for security. User must tap submit button.

**Q: Is it secure?**
A: Yes - HTTPS only, domain verified, biometric optional, no logging

**Q: Why doesn't it work on regular Android autofill?**
A: Chrome blocks custom autofill services - uses only Google's

---

## ✅ Quick Checklist

- [ ] Files created in correct locations
- [ ] `AutofillBridgePackage.kt` updated
- [ ] Component imported in screens
- [ ] Credentials array provided
- [ ] Domain prop set correctly
- [ ] Error handling added
- [ ] Tested on device
- [ ] Production ready!

---

**Version**: 1.0
**Updated**: Week 10
**Status**: Production Ready ✅

---

For detailed information, see the full implementation guide.
