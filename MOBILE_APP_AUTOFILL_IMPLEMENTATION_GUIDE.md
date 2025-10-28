# Mobile App Autofill Feature Implementation Guide

## 🎯 Overview

Tính năng này cho phép user **dễ dàng lưu credentials cho native mobile apps** mà không cần biết package name.

**Tự động lưu domain là package name** (ví dụ: `com.zing.zalo`) thay vì web domain.

---

## ✨ Features Implemented

### 1. **Native Module: AppUtils**

- **File**: `android/app/src/main/java/com/passwordepic/mobile/AppUtilsModule.kt`
- **File**: `android/app/src/main/java/com/passwordepic/mobile/AppUtilsPackage.kt`

Cung cấp 3 native methods:

```kotlin
getInstalledApps(includeSystemApps: Boolean) // Lấy danh sách tất cả apps
searchApps(query: String) // Tìm app theo tên
getAppInfo(packageName: String) // Lấy info app cụ thể
```

### 2. **React Native Hook: useInstalledApps**

- **File**: `src/hooks/useInstalledApps.ts`

Wrapper hook để sử dụng native module từ TypeScript:

```typescript
const { apps, loading, error, searchApps, getAppInfo } = useInstalledApps();
```

### 3. **Enhanced PasswordForm Component**

- **File**: `src/components/PasswordForm.tsx`

**Thêm UI mới:**

- ✅ Toggle giữa "Web" và "Mobile App"
- ✅ App Selector Modal với search functionality
- ✅ Auto-fill domain field với package name
- ✅ Visual indicator cho selected app

---

## 🚀 How It Works (User Flow)

### **Scenario: Thêm password cho Zalo app**

```
1. User tap "Add Password"
   ↓
2. Fill in Title, Username, Password
   ↓
3. Chọn Domain Type: "Mobile App" (toggle)
   ↓
4. Tap "Select App" button
   ↓
5. Modal mở → Search "Zalo"
   ↓
6. Select "Zalo" app từ list
   ↓
7. Domain auto-fill: com.zing.zalo ✅
   ↓
8. Save → Auto-fill sẽ match cho Zalo app!
```

---

## 📱 UI Components

### **Domain Type Toggle**

```
┌─ Domain Type ──────────────────┐
│  [🌍 Web]  [📱 Mobile App]    │
└────────────────────────────────┘
```

### **App Selector Modal**

```
┌─────────────────────────────────┐
│ ✕         Select App       ─    │
├─────────────────────────────────┤
│ 🔍 [Search apps...]            │
├─────────────────────────────────┤
│ 📱 Zalo                         │ ← Tap to select
│    com.zing.zalo            ✓   │
│                                 │
│ 📱 Instagram                    │
│    com.instagram.android        │
│                                 │
│ 📱 Facebook                     │
│    com.facebook.katana          │
└─────────────────────────────────┘
```

### **Domain Info Indicator**

```
┌─────────────────────────────────┐
│ ℹ️ Domain will be set to:        │
│    com.zing.zalo                │
└─────────────────────────────────┘
```

---

## 🛠️ Files Changed/Created

### **New Files Created:**

```
✅ android/app/src/main/java/com/passwordepic/mobile/AppUtilsModule.kt
✅ android/app/src/main/java/com/passwordepic/mobile/AppUtilsPackage.kt
✅ src/hooks/useInstalledApps.ts
```

### **Files Modified:**

```
✏️ android/app/src/main/java/com/passwordepic/mobile/MainApplication.kt
   - Added: add(AppUtilsPackage())

✏️ src/components/PasswordForm.tsx
   - Added: Web/Mobile App toggle UI
   - Added: App Selector Modal
   - Added: useInstalledApps hook integration
   - Added: New styles for UI components
```

---

## 📋 Installation Steps

### **Step 1: Rebuild Android Project**

```bash
cd e:\IT\Mobile\PasswordEpic

# Clean build
npm run android -- --clean

# Or direct gradle clean
cd android
./gradlew clean
./gradlew build
cd ..
```

### **Step 2: Rebuild React Native**

```bash
# Kill metro if running
npm start --reset-cache
```

### **Step 3: Reinstall App on Device**

```bash
npm run android
```

---

## 🧪 Testing the Feature

### **Test Case 1: Add Password for Web Domain**

```
1. Open PasswordEpic
2. Tap "+" to add new password
3. Fill: Title="Gmail", Username="test@gmail.com", Password="***"
4. Domain Type: Select "Web" ✅
5. Website: Enter "gmail.com" or "https://gmail.com"
6. Save ✓
```

**Expected Result**: Browser autofill works for Gmail website ✅

---

### **Test Case 2: Add Password for Mobile App (Zalo)**

```
1. Open PasswordEpic
2. Tap "+" to add new password
3. Fill: Title="Zalo", Username="0123456789", Password="***"
4. Domain Type: Select "Mobile App" ✅
5. Tap "Select App" button
6. Modal opens → Search "zalo"
7. Tap "Zalo" from list
8. Verify domain shows: "com.zing.zalo" ✅
9. Save ✓
```

**Expected Result**:

- When opening Zalo and long-pressing login field → Autofill shows Zalo credentials ✅

---

### **Test Case 3: Edit Existing Password**

```
1. Edit old Zalo password that has domain "zalo.me"
2. Domain Type should auto-detect as "Web" (not package name)
3. User can manually switch to "Mobile App" type
4. Select "Zalo" app
5. Domain updates to "com.zing.zalo"
6. Save ✓
```

---

## 🔧 Troubleshooting

### **Issue: App list doesn't load**

```
❌ Error: "AppUtils native module not available"

Solution:
- Ensure MainApplication.kt has: add(AppUtilsPackage())
- Rebuild: npm run android -- --clean
- Clear cache: npm start --reset-cache
```

### **Issue: App search not working**

```
❌ No results when searching

Solution:
- Check app name/package name is correct
- Try searching with first few letters only
- Example: Search "zalo" instead of "Zalo Messaging"
```

### **Issue: Domain not auto-filling**

```
❌ Domain field stays empty after selecting app

Solution:
- Check if website field is being cleared
- Ensure domainType state changed to "mobile"
- Try selecting app again
```

---

## 📚 Code Examples

### **TypeScript: Using useInstalledApps hook**

```typescript
import { useInstalledApps } from '../hooks/useInstalledApps';

function MyComponent() {
  const { apps, loading, searchApps } = useInstalledApps();

  const handleSearch = async (query: string) => {
    const results = await searchApps(query);
    console.log('Found apps:', results);
  };

  return (
    <View>
      {apps.map(app => (
        <Text key={app.packageName}>{app.name}</Text>
      ))}
    </View>
  );
}
```

### **Kotlin: Native AppUtils usage**

```kotlin
// Already wrapped by React Native module
// No need to call directly from Kotlin
```

---

## 🎨 UI/UX Design Patterns

### **Dark Mode Support**: ✅

- All colors use theme context
- Properly adapts to dark/light theme

### **Accessibility**: ✅

- Touch targets are 48dp minimum
- Icons + text labels provided
- Loading states handled

### **Performance**: ✅

- Apps list loaded once on mount
- Search is debounced
- Modal smoothly animates

---

## 🔐 Security Considerations

### **Package Names are Safe to Store**

```
✅ Package names are public information
✅ Not sensitive data
✅ User can see them in Play Store URL
✅ No privacy concerns
```

### **Domain Matching is Verified**

```
✅ DomainVerifier checks package name against requesting app
✅ Cannot spoof/inject fake package names
✅ Android system enforces this
```

---

## 📊 Future Improvements

### **v2 Features to Consider:**

1. **Icon Display**: Show app icon in selector (requires additional permissions)
2. **Recently Used Apps**: Show favorite apps first
3. **Category-based Grouping**: Sort apps by category
4. **Custom Aliases**: Allow user to set custom name for package
5. **Bulk Import**: Import credentials for frequently used apps

---

## 📞 Support

If you encounter any issues:

1. **Check Android logcat**:

   ```bash
   adb logcat | grep AppUtils
   adb logcat | grep PasswordEpic
   ```

2. **Review test logs**:

   - Look for `📱 Selected app:` logs
   - Check `🔍 Search found` results

3. **Verify native module loaded**:
   - Check if `AppUtils native module not available` error appears
   - Rebuild project if needed

---

## ✅ Implementation Checklist

- [x] Native AppUtils module created
- [x] React Native bridge implemented
- [x] TypeScript hook created
- [x] UI components added to PasswordForm
- [x] Theme support integrated
- [x] Modal with search functionality
- [x] Auto-fill domain detection
- [x] Styles for all screen sizes
- [x] Error handling
- [x] Documentation created

---

**Author**: Zencoder AI Assistant  
**Date**: 2024  
**Status**: ✅ Production Ready
