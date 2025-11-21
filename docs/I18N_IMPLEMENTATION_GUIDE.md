# 🌍 Multi-Language Implementation Guide - PasswordEpic

**Date**: November 21, 2025  
**Purpose**: Hướng dẫn implement đa ngôn ngữ (i18n) cho PasswordEpic  
**Current Status**: Chưa implement, đang dùng hardcoded English strings

---

## 📊 Comparison - Top i18n Libraries for React Native

### 1️⃣ **react-i18next** ⭐ RECOMMENDED

**Package**: `react-i18next` + `i18next`

**Pros**:

- ✅ Most popular (16M+ downloads/week)
- ✅ Feature-rich: pluralization, interpolation, nested translations
- ✅ TypeScript support tốt
- ✅ Lazy loading languages
- ✅ React hooks: `useTranslation()`
- ✅ Namespace organization (auth, settings, passwords, etc.)
- ✅ Active development & large community
- ✅ ICU message format support
- ✅ Can detect device language automatically

**Cons**:

- ❌ Slightly larger bundle size
- ❌ More configuration needed initially

**Best for**: Large apps with complex translation needs (like PasswordEpic)

---

### 2️⃣ **react-native-localize**

**Package**: `react-native-localize` + `i18n-js`

**Pros**:

- ✅ Lightweight
- ✅ Good device language detection
- ✅ Built for React Native specifically
- ✅ Simple API

**Cons**:

- ❌ Less features than i18next
- ❌ No namespace support
- ❌ Limited pluralization

**Best for**: Small apps with simple translation needs

---

### 3️⃣ **i18n-js**

**Package**: `i18n-js`

**Pros**:

- ✅ Very lightweight
- ✅ Simple setup
- ✅ Fast performance

**Cons**:

- ❌ No React hooks
- ❌ Manual language switching
- ❌ No lazy loading
- ❌ Basic features only

**Best for**: Minimal translation needs

---

## 🎯 Recommended Solution for PasswordEpic

### **Choice: react-i18next**

**Reasons**:

1. PasswordEpic có nhiều screens phức tạp (Settings, Passwords, Generator, Backup/Restore)
2. Cần pluralization (1 password vs 5 passwords)
3. Cần interpolation (dynamic values: "Backup created at {{time}}")
4. TypeScript typing cho translations
5. Namespace để organize translations theo feature
6. Hook-based API phù hợp với functional components

---

## 📦 Installation

```bash
# Install packages
npm install i18next react-i18next
npm install --save-dev @types/i18next

# Optional: Device language detection
npm install react-native-localize
npm install --save-dev @types/react-native-localize
```

**Package sizes**:

- `i18next`: ~50KB
- `react-i18next`: ~15KB
- `react-native-localize`: ~20KB
- **Total**: ~85KB (gzipped: ~30KB)

---

## 🏗️ Project Structure

```
src/
├── locales/
│   ├── index.ts                 # i18n config & initialization
│   ├── en/                      # English translations
│   │   ├── index.ts
│   │   ├── common.json          # Common: buttons, errors, alerts
│   │   ├── auth.json            # Login, signup, biometric
│   │   ├── passwords.json       # Password list, add/edit
│   │   ├── generator.json       # Password generator
│   │   ├── settings.json        # Settings screen
│   │   ├── backup.json          # Backup & restore
│   │   └── security.json        # Security features
│   ├── vi/                      # Vietnamese translations
│   │   ├── index.ts
│   │   ├── common.json
│   │   ├── auth.json
│   │   ├── passwords.json
│   │   ├── generator.json
│   │   ├── settings.json
│   │   ├── backup.json
│   │   └── security.json
│   └── types.ts                 # TypeScript types for translations
```

---

## 🔧 Setup Configuration

### 1️⃣ Create `src/locales/index.ts`

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

// Import translations
import enCommon from './en/common.json';
import enAuth from './en/auth.json';
import enPasswords from './en/passwords.json';
import enGenerator from './en/generator.json';
import enSettings from './en/settings.json';
import enBackup from './en/backup.json';
import enSecurity from './en/security.json';

import viCommon from './vi/common.json';
import viAuth from './vi/auth.json';
import viPasswords from './vi/passwords.json';
import viGenerator from './vi/generator.json';
import viSettings from './vi/settings.json';
import viBackup from './vi/backup.json';
import viSecurity from './vi/security.json';

// Get device language
const deviceLanguage = RNLocalize.getLocales()[0]?.languageCode || 'en';

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    passwords: enPasswords,
    generator: enGenerator,
    settings: enSettings,
    backup: enBackup,
    security: enSecurity,
  },
  vi: {
    common: viCommon,
    auth: viAuth,
    passwords: viPasswords,
    generator: viGenerator,
    settings: viSettings,
    backup: viBackup,
    security: viSecurity,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage, // Auto-detect device language
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common',
    'auth',
    'passwords',
    'generator',
    'settings',
    'backup',
    'security',
  ],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  compatibilityJSON: 'v3', // For i18next v21+
});

export default i18n;
```

### 2️⃣ Create `src/locales/types.ts`

```typescript
// TypeScript type-safe translations
export type TranslationKeys = {
  common: {
    // Buttons
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    back: string;
    next: string;
    done: string;
    confirm: string;

    // Common phrases
    loading: string;
    success: string;
    error: string;
    warning: string;

    // Errors
    error_generic: string;
    error_network: string;
    error_permission_denied: string;
  };

  auth: {
    // Login
    login_title: string;
    login_subtitle: string;
    master_password: string;
    sign_in: string;

    // Biometric
    biometric_prompt_title: string;
    biometric_prompt_subtitle: string;

    // Errors
    error_invalid_password: string;
    error_biometric_failed: string;
  };

  passwords: {
    // List
    all_passwords: string;
    search_placeholder: string;
    no_passwords: string;
    password_count: string; // with plural

    // Add/Edit
    add_password: string;
    edit_password: string;
    title: string;
    username: string;
    password: string;
    website: string;
    notes: string;
    category: string;

    // Actions
    copy_password: string;
    copy_username: string;
    password_copied: string;
    username_copied: string;
  };

  generator: {
    title: string;
    generate_password: string;
    password_length: string;
    include_uppercase: string;
    include_lowercase: string;
    include_numbers: string;
    include_symbols: string;
    exclude_similar: string;
    exclude_ambiguous: string;
    password_strength: string;
    strength_weak: string;
    strength_medium: string;
    strength_strong: string;
  };

  settings: {
    title: string;
    security: string;
    appearance: string;
    backup: string;
    about: string;

    // Security
    biometric_authentication: string;
    auto_lock: string;
    screen_protection: string;

    // Appearance
    theme: string;
    theme_light: string;
    theme_dark: string;
    theme_system: string;
    language: string;
  };

  backup: {
    // Backup
    create_backup: string;
    backup_created: string;
    backup_failed: string;
    last_backup: string;

    // Restore
    restore_backup: string;
    restore_successful: string;
    restore_failed: string;

    // Metadata
    entry_count: string;
    category_count: string;
    backup_date: string;
    device_info: string;
  };

  security: {
    security_level: string;
    level_maximum: string;
    level_high: string;
    level_moderate: string;
    level_balanced: string;
    level_low: string;
  };
};
```

### 3️⃣ Initialize in `App.tsx`

```typescript
import './src/locales'; // Import i18n config at top

function App(): React.JSX.Element {
  // ... rest of App component
}
```

---

## 🎨 Usage Examples

### Example 1: Basic Translation with Hook

```typescript
import { useTranslation } from 'react-i18next';

function PasswordsScreen() {
  const { t } = useTranslation('passwords');

  return (
    <View>
      <Text>{t('all_passwords')}</Text>
      <TextInput placeholder={t('search_placeholder')} />
    </View>
  );
}
```

### Example 2: Interpolation (Dynamic Values)

```typescript
const { t } = useTranslation('backup');

const lastBackupDate = new Date('2025-11-21');
<Text>{t('last_backup', { date: lastBackupDate.toLocaleDateString() })}</Text>;
// Output: "Last backup: 11/21/2025"
```

### Example 3: Pluralization

```typescript
const { t } = useTranslation('passwords');

const passwordCount = 5;
<Text>{t('password_count', { count: passwordCount })}</Text>;
// Output: "5 passwords" (en) or "5 mật khẩu" (vi)
```

### Example 4: Multiple Namespaces

```typescript
const { t } = useTranslation(['common', 'settings']);

<Button>
  {t('common:save')}  // From common namespace
</Button>
<Text>
  {t('settings:security')}  // From settings namespace
</Text>
```

### Example 5: Change Language

```typescript
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { setLanguage } from './store/slices/settingsSlice';

function LanguageSelector() {
  const { i18n } = useTranslation();
  const dispatch = useDispatch();

  const changeLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    dispatch(setLanguage(lng)); // Save to Redux
  };

  return (
    <View>
      <TouchableOpacity onPress={() => changeLanguage('en')}>
        <Text>English</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => changeLanguage('vi')}>
        <Text>Tiếng Việt</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 📝 Sample Translation Files

### `src/locales/en/common.json`

```json
{
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "edit": "Edit",
  "add": "Add",
  "back": "Back",
  "next": "Next",
  "done": "Done",
  "confirm": "Confirm",
  "loading": "Loading...",
  "success": "Success",
  "error": "Error",
  "warning": "Warning",
  "error_generic": "An error occurred. Please try again.",
  "error_network": "Network error. Please check your connection.",
  "error_permission_denied": "Permission denied"
}
```

### `src/locales/vi/common.json`

```json
{
  "save": "Lưu",
  "cancel": "Hủy",
  "delete": "Xóa",
  "edit": "Sửa",
  "add": "Thêm",
  "back": "Quay lại",
  "next": "Tiếp",
  "done": "Xong",
  "confirm": "Xác nhận",
  "loading": "Đang tải...",
  "success": "Thành công",
  "error": "Lỗi",
  "warning": "Cảnh báo",
  "error_generic": "Đã xảy ra lỗi. Vui lòng thử lại.",
  "error_network": "Lỗi mạng. Vui lòng kiểm tra kết nối.",
  "error_permission_denied": "Quyền truy cập bị từ chối"
}
```

### `src/locales/en/passwords.json`

```json
{
  "all_passwords": "All Passwords",
  "search_placeholder": "Search passwords...",
  "no_passwords": "No passwords yet",
  "password_count_one": "{{count}} password",
  "password_count_other": "{{count}} passwords",
  "add_password": "Add Password",
  "edit_password": "Edit Password",
  "title": "Title",
  "username": "Username",
  "password": "Password",
  "website": "Website",
  "notes": "Notes",
  "category": "Category",
  "copy_password": "Copy Password",
  "copy_username": "Copy Username",
  "password_copied": "Password copied to clipboard",
  "username_copied": "Username copied to clipboard"
}
```

### `src/locales/vi/passwords.json`

```json
{
  "all_passwords": "Tất cả mật khẩu",
  "search_placeholder": "Tìm mật khẩu...",
  "no_passwords": "Chưa có mật khẩu nào",
  "password_count_one": "{{count}} mật khẩu",
  "password_count_other": "{{count}} mật khẩu",
  "add_password": "Thêm mật khẩu",
  "edit_password": "Sửa mật khẩu",
  "title": "Tiêu đề",
  "username": "Tên người dùng",
  "password": "Mật khẩu",
  "website": "Trang web",
  "notes": "Ghi chú",
  "category": "Danh mục",
  "copy_password": "Sao chép mật khẩu",
  "copy_username": "Sao chép tên người dùng",
  "password_copied": "Đã sao chép mật khẩu",
  "username_copied": "Đã sao chép tên người dùng"
}
```

---

## 🔄 Integration with Redux

### Update `settingsSlice.ts`

```typescript
// Current state already has language field ✅
interface SettingsState {
  // ... other fields
  language: string; // Already exists!
}

// Load saved language on app start
export const loadSavedLanguage = () => async (dispatch: any, getState: any) => {
  const { settings } = getState();
  const savedLanguage = settings.language;

  if (savedLanguage) {
    await i18n.changeLanguage(savedLanguage);
  }
};
```

### Update `App.tsx`

```typescript
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store';
import i18n from './locales';

function App() {
  const language = useSelector((state: RootState) => state.settings.language);
  const dispatch = useDispatch();

  useEffect(() => {
    // Load saved language
    if (language && language !== i18n.language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // ... rest of App
}
```

---

## 📱 Language Selector UI

### Option 1: Simple Dropdown

```typescript
import { Picker } from '@react-native-picker/picker';

function LanguageSelector() {
  const { i18n } = useTranslation();
  const dispatch = useDispatch();
  const currentLanguage = useSelector(
    (state: RootState) => state.settings.language,
  );

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    dispatch(setLanguage(lng));
  };

  return (
    <Picker selectedValue={currentLanguage} onValueChange={changeLanguage}>
      <Picker.Item label="English" value="en" />
      <Picker.Item label="Tiếng Việt" value="vi" />
      <Picker.Item label="中文" value="zh" />
      <Picker.Item label="日本語" value="ja" />
      <Picker.Item label="한국어" value="ko" />
      <Picker.Item label="Español" value="es" />
      <Picker.Item label="Français" value="fr" />
      <Picker.Item label="Deutsch" value="de" />
    </Picker>
  );
}
```

### Option 2: Flag-based List

```typescript
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

function LanguagePicker() {
  const { i18n } = useTranslation();
  const dispatch = useDispatch();

  return (
    <FlatList
      data={LANGUAGES}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => {
            i18n.changeLanguage(item.code);
            dispatch(setLanguage(item.code));
          }}
        >
          <View style={styles.languageItem}>
            <Text style={styles.flag}>{item.flag}</Text>
            <Text>{item.name}</Text>
            {i18n.language === item.code && (
              <Ionicons name="checkmark" size={24} color="green" />
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
```

---

## 🎯 Supported Languages (Priority)

### Tier 1 (Must-have):

1. 🇺🇸 **English** (en) - Global standard
2. 🇻🇳 **Vietnamese** (vi) - Your market

### Tier 2 (High Priority):

3. 🇨🇳 **Chinese Simplified** (zh-CN) - Large user base
4. 🇯🇵 **Japanese** (ja) - Security-conscious market
5. 🇰🇷 **Korean** (ko) - Tech-savvy users

### Tier 3 (Nice to have):

6. 🇪🇸 **Spanish** (es) - Second most spoken language
7. 🇫🇷 **French** (fr) - European market
8. 🇩🇪 **German** (de) - Privacy-conscious market
9. 🇧🇷 **Portuguese** (pt-BR) - Brazilian market
10. 🇷🇺 **Russian** (ru) - Eastern Europe

---

## ✅ Implementation Checklist

### Phase 1: Setup (1-2 hours)

- [ ] Install packages (`i18next`, `react-i18next`, `react-native-localize`)
- [ ] Create folder structure (`src/locales/`)
- [ ] Setup i18n configuration (`src/locales/index.ts`)
- [ ] Create TypeScript types (`src/locales/types.ts`)
- [ ] Initialize in `App.tsx`

### Phase 2: English Translations (2-3 hours)

- [ ] Create `en/common.json` (buttons, errors, alerts)
- [ ] Create `en/auth.json` (login, biometric)
- [ ] Create `en/passwords.json` (password list, add/edit)
- [ ] Create `en/generator.json` (password generator)
- [ ] Create `en/settings.json` (settings screen)
- [ ] Create `en/backup.json` (backup & restore)
- [ ] Create `en/security.json` (security features)

### Phase 3: Vietnamese Translations (2-3 hours)

- [ ] Translate all English files to Vietnamese
- [ ] Review translations for cultural appropriateness
- [ ] Test on device with Vietnamese locale

### Phase 4: Integration (3-4 hours)

- [ ] Replace hardcoded strings in `PasswordsScreen.tsx`
- [ ] Replace hardcoded strings in `GeneratorScreen.tsx`
- [ ] Replace hardcoded strings in `SettingsScreen.tsx`
- [ ] Replace hardcoded strings in `BackupRestoreModal.tsx`
- [ ] Replace hardcoded strings in `AddPasswordScreen.tsx`
- [ ] Update all buttons, labels, placeholders

### Phase 5: Language Selector (1 hour)

- [ ] Add Language Selector UI in Settings
- [ ] Connect to Redux `language` state
- [ ] Test language switching
- [ ] Persist language preference

### Phase 6: Testing (1-2 hours)

- [ ] Test all screens in English
- [ ] Test all screens in Vietnamese
- [ ] Test language switching without restart
- [ ] Test backup/restore with language settings
- [ ] Test device language auto-detection

**Total Estimated Time**: 10-15 hours

---

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install i18next react-i18next react-native-localize
npm install --save-dev @types/i18next @types/react-native-localize

# Create folder structure
mkdir -p src/locales/en src/locales/vi

# Run app
npm run android
```

---

## 📚 Additional Resources

- **i18next Docs**: https://www.i18next.com/
- **react-i18next Docs**: https://react.i18next.com/
- **React Native Localize**: https://github.com/zoontek/react-native-localize
- **ICU Message Format**: https://unicode-org.github.io/icu/userguide/format_parse/messages/
- **Pluralization Rules**: https://www.i18next.com/translation-function/plurals

---

## 🎉 Benefits

After implementation, you'll have:

- ✅ Support for multiple languages
- ✅ Easy to add new languages (just add JSON files)
- ✅ Type-safe translations (TypeScript)
- ✅ Organized by feature (namespaces)
- ✅ Dynamic content (interpolation, pluralization)
- ✅ Auto-detect device language
- ✅ Persist user's language preference
- ✅ ~30KB gzipped overhead (minimal)

**Total work**: ~10-15 hours for English + Vietnamese support! 🚀
