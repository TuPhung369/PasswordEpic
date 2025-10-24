# 🗺️ PasswordEpic Navigation Structure

**Last Updated:** December 2024  
**Version:** 1.0 (Week 9 Complete)

---

## 📊 Complete Navigation Hierarchy

```
AppNavigator (Root Stack)
│
├── Auth (Stack Navigator)
│   ├── Login
│   ├── Register
│   └── ForgotPassword
│
└── Main (Tab Navigator)
    │
    ├── Passwords (Tab + Stack Navigator)
    │   ├── PasswordsList (Default)
    │   ├── AddPassword (Modal)
    │   └── EditPassword (Modal)
    │
    ├── Generator (Tab + Screen)
    │   └── GeneratorScreen
    │
    └── Settings (Tab + Stack Navigator) ✨ NEW!
        ├── SettingsList (Default)
        └── AutofillManagement (Card) ✨ NEW!
```

---

## 🎯 Navigator Types

### Root Level

- **AppNavigator:** Native Stack Navigator
  - Handles authentication state
  - Switches between Auth and Main flows

### Authentication Flow

- **AuthNavigator:** Native Stack Navigator
  - Login, Register, ForgotPassword screens
  - No tab bar

### Main Application Flow

- **MainNavigator:** Bottom Tab Navigator
  - Three tabs: Passwords, Generator, Settings
  - Persistent tab bar (hides on certain screens)

### Tab-Specific Navigators

#### 1. Passwords Tab

- **PasswordsNavigator:** Native Stack Navigator
- **Screens:**
  - `PasswordsList` - Main passwords list
  - `AddPassword` - Add new password (modal)
  - `EditPassword` - Edit existing password (modal)
- **Tab Bar:** Hidden on AddPassword and EditPassword

#### 2. Generator Tab

- **No Navigator** - Direct screen
- **Screen:**
  - `GeneratorScreen` - Password generator
- **Tab Bar:** Always visible

#### 3. Settings Tab ✨ NEW!

- **SettingsNavigator:** Native Stack Navigator
- **Screens:**
  - `SettingsList` - Main settings screen
  - `AutofillManagement` - Autofill configuration (card)
- **Tab Bar:** Hidden on AutofillManagement

---

## 🔀 Navigation Flows

### 1. App Launch Flow

```
App Start
    ↓
AppNavigator checks auth state
    ↓
┌─────────────────┬─────────────────┐
│ Not Authenticated│  Authenticated  │
│        ↓         │        ↓        │
│  AuthNavigator   │  MainNavigator  │
│        ↓         │        ↓        │
│   Login Screen   │  Passwords Tab  │
└─────────────────┴─────────────────┘
```

### 2. Authentication Flow

```
Login Screen
    ↓
User enters credentials
    ↓
Authentication successful
    ↓
Navigate to Main
    ↓
PasswordsList Screen
```

### 3. Password Management Flow

```
PasswordsList
    ↓
Tap "Add Password"
    ↓
AddPassword Screen (Modal)
    ↓
Save password
    ↓
Return to PasswordsList
    ↓
Success message shown
```

### 4. Autofill Management Flow ✨ NEW!

```
Settings Tab
    ↓
SettingsList Screen
    ↓
Tap "Autofill Management"
    ↓
AutofillManagement Screen (Card)
    ↓
Configure autofill settings
    ↓
Back button/gesture
    ↓
Return to SettingsList
```

---

## 📱 Screen Presentations

### Modal Presentation

Used for temporary, focused tasks:

- `AddPassword` - Creating new password
- `EditPassword` - Editing existing password

**Characteristics:**

- Slides up from bottom
- Dismissible with swipe down
- Clear "Done" or "Cancel" actions

### Card Presentation

Used for related content navigation:

- `AutofillManagement` - Settings sub-screen

**Characteristics:**

- Slides in from right (iOS) or fades (Android)
- Back button in header
- Part of navigation stack

### Default Presentation

Used for main screens:

- All list screens
- Tab screens

**Characteristics:**

- Standard navigation
- Tab bar visible (unless explicitly hidden)

---

## 🎨 Tab Bar Behavior

### Always Visible

- `PasswordsList`
- `GeneratorScreen`
- `SettingsList`

### Hidden (Full Screen)

- `AddPassword`
- `EditPassword`
- `AutofillManagement`

### Implementation

```typescript
const getTabBarStyle = (route: any, defaultRouteName: string) => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? defaultRouteName;

  const shouldHide =
    routeName === 'AddPassword' ||
    routeName === 'EditPassword' ||
    routeName === 'AutofillManagement';

  if (shouldHide) {
    return { height: 0, opacity: 0, overflow: 'hidden' };
  }
  return baseStyle;
};
```

---

## 🔑 Type Definitions

### Root Stack

```typescript
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
```

### Main Tab

```typescript
export type MainTabParamList = {
  Passwords: NavigatorScreenParams<PasswordsStackParamList> | undefined;
  Generator: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};
```

### Passwords Stack

```typescript
export type PasswordsStackParamList = {
  PasswordsList: { successMessage?: string } | undefined;
  AddPassword:
    | { restoreData?: boolean; generatedPassword?: string }
    | undefined;
  EditPassword: { passwordId: string };
};
```

### Settings Stack ✨ NEW!

```typescript
export type SettingsStackParamList = {
  SettingsList: undefined;
  AutofillManagement: undefined;
};
```

---

## 🧭 Navigation Examples

### Navigate to Autofill Management

```typescript
// From SettingsList screen
navigation.navigate('AutofillManagement');

// Type-safe version
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsStackParamList } from '../navigation/SettingsNavigator';

type NavigationProp = NativeStackNavigationProp<
  SettingsStackParamList,
  'SettingsList'
>;

const navigation = useNavigation<NavigationProp>();
navigation.navigate('AutofillManagement');
```

### Navigate to Add Password

```typescript
// From PasswordsList screen
navigation.navigate('AddPassword');

// With generated password
navigation.navigate('AddPassword', {
  generatedPassword: 'SecurePass123!',
});
```

### Navigate to Edit Password

```typescript
// From PasswordsList screen
navigation.navigate('EditPassword', {
  passwordId: 'password-uuid-here',
});
```

### Navigate Between Tabs

```typescript
// From any screen in Main
navigation.navigate('Generator');
navigation.navigate('Settings');
navigation.navigate('Passwords');
```

---

## 🔄 Navigation State Management

### Navigation Persistence

- Navigation state is persisted across app restarts
- Handled by `NavigationPersistenceService`
- Restores user's last location

### Deep Linking

- Support for deep links to specific screens
- Example: `passwordepic://settings/autofill`

### Back Button Behavior

- Android hardware back button supported
- iOS swipe-back gesture supported
- Custom back button handlers where needed

---

## 🎯 Best Practices

### 1. Type Safety

Always use TypeScript types for navigation:

```typescript
// ✅ Good
const navigation = useNavigation<NavigationProp>();

// ❌ Bad
const navigation = useNavigation<any>();
```

### 2. Screen Options

Configure screen options in navigator, not in screens:

```typescript
// ✅ Good - In Navigator
<Stack.Screen name="AutofillManagement" options={{ presentation: 'card' }} />;

// ❌ Bad - In Screen component
navigation.setOptions({ presentation: 'card' });
```

### 3. Tab Bar Hiding

Use centralized logic in MainNavigator:

```typescript
// ✅ Good - Centralized
const shouldHide = routeName === 'AutofillManagement';

// ❌ Bad - Per screen
navigation.setOptions({ tabBarVisible: false });
```

### 4. Navigation Params

Always define param types:

```typescript
// ✅ Good
type StackParamList = {
  EditPassword: { passwordId: string };
};

// ❌ Bad
type StackParamList = {
  EditPassword: any;
};
```

---

## 🚀 Adding New Screens

### To Passwords Stack

1. Add type to `PasswordsStackParamList`
2. Add `Stack.Screen` to `PasswordsNavigator`
3. Update tab bar hiding logic if needed

### To Settings Stack

1. Add type to `SettingsStackParamList`
2. Add `Stack.Screen` to `SettingsNavigator`
3. Update tab bar hiding logic if needed

### New Tab

1. Add type to `MainTabParamList`
2. Add `Tab.Screen` to `MainNavigator`
3. Add icon to `TabBarIcon` component

### Example: Add Security Settings

```typescript
// 1. Update SettingsStackParamList
export type SettingsStackParamList = {
  SettingsList: undefined;
  AutofillManagement: undefined;
  SecuritySettings: undefined; // NEW
};

// 2. Add to SettingsNavigator
<Stack.Screen
  name="SecuritySettings"
  component={SecuritySettingsScreen}
  options={{ presentation: 'card' }}
/>;

// 3. Update tab bar hiding (if needed)
const shouldHide =
  routeName === 'AddPassword' ||
  routeName === 'EditPassword' ||
  routeName === 'AutofillManagement' ||
  routeName === 'SecuritySettings'; // NEW
```

---

## 📊 Navigation Metrics

| Navigator          | Screens | Type      | Complexity |
| ------------------ | ------- | --------- | ---------- |
| AppNavigator       | 2       | Stack     | Low        |
| AuthNavigator      | 3       | Stack     | Low        |
| MainNavigator      | 3       | Tab       | Medium     |
| PasswordsNavigator | 3       | Stack     | Medium     |
| SettingsNavigator  | 2       | Stack     | Low        |
| **Total**          | **13**  | **Mixed** | **Medium** |

---

## 🔍 Troubleshooting

### Navigation Error

```
The action 'NAVIGATE' with payload {"name":"ScreenName"}
was not handled by any navigator.
```

**Solution:**

1. Check screen is registered in navigator
2. Verify route name matches exactly (case-sensitive)
3. Ensure navigator is mounted

### Tab Bar Not Hiding

**Solution:**

1. Check `getTabBarStyle` includes the route name
2. Verify `getFocusedRouteNameFromRoute` is working
3. Check default route name is correct

### Type Errors

**Solution:**

1. Ensure all param lists are exported
2. Check navigation prop types match
3. Verify screen names match type definitions

---

## 📚 Related Documentation

- **Navigation Fix:** `docs/Navigation_Fix_AutofillManagement.md`
- **Fix Summary:** `docs/NAVIGATION_FIX_SUMMARY.md`
- **Autofill Reference:** `docs/Autofill_Quick_Reference.md`
- **Week 9 Status:** `docs/Week9_FINAL_STATUS.md`

---

## 🎓 Key Concepts

### Stack Navigator

- Linear navigation history
- Push/pop screens
- Back button support

### Tab Navigator

- Parallel navigation
- Persistent tabs
- Independent stacks per tab

### Nested Navigation

- Tabs contain stacks
- Stacks can contain modals
- Type-safe navigation between levels

### Screen Presentation

- Modal: Temporary, focused tasks
- Card: Related content navigation
- Default: Standard navigation

---

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** ✅ Complete and Documented
