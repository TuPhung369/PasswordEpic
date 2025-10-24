# Chrome Autofill Configuration

## Problema Atual

Chrome não está enviando autofill requests para PasswordEpic, mostrando erro:

```
AutofillManager: view is not autofillable - activity denied for autofill
```

## Solução

### 1. **Chrome Settings** (adb shell)

```bash
# Enable autofill for third-party services
adb shell settings put global autofill_service_enable_for_all_apps 1
adb shell settings put secure autofill_service "com.passwordepic.mobile/.autofill.PasswordEpicAutofillService"

# Disable Google Autofill completely
adb shell pm disable-user com.google.android.gms/.autofill.GmsPkgAutofillService

# Clear Chrome cache completely
adb shell pm clear com.android.chrome
adb shell pm clear com.android.chrome:privileged_process0
adb shell pm clear com.android.chrome:sandboxed_process0
```

### 2. **Chrome Configuration via ADB** (Hidden Settings)

```bash
# Check if Chrome has autofill enabled
adb shell settings get secure autofill_service

# Enable inline suggestions
adb shell settings put secure autofill_inline_suggestions_enabled true

# Enable autofill on all views
adb shell settings put secure include_all_autofill_type_not_none_views_in_assist_structure true
```

### 3. **Manual Chrome Configuration**

1. Open Chrome
2. Settings → Passwords and autofill → Autofill
3. Make sure "Autofill" toggle is ON
4. Select "PasswordEpic Autofill" as the autofill service

### 4. **Test Autofill**

```bash
# Method 1: Direct adb
adb shell am start -a android.intent.action.VIEW -d "https://github.com/login" com.android.chrome

# Method 2: Check autofill logs
adb logcat -d | grep -i "autofill\|PasswordEpic"

# Method 3: Check if service receives requests
adb logcat -d | grep "onFillRequest"
```

## Expected Behavior

When clicking on a login field in Chrome:

1. ✅ `onFillRequest` called in PasswordEpicAutofillService
2. ✅ Credentials loaded from SharedPreferences
3. ✅ Popup with "testuser" appears
4. ✅ User can select to autofill credentials

## Debugging

If autofill still doesn't work:

```bash
# Check system autofill settings
adb shell settings list secure | grep autofill

# Check if service is responding
adb shell "dumpsys autofill"

# Check app permissions
adb shell pm dump com.passwordepic.mobile | grep -i autofill

# Get detailed autofill logs
adb logcat -s "PasswordEpicAutofill" -v threadtime
```

## Alternative: Test with Native Android App

If Chrome still doesn't work, create a simple test Activity with:

- Username EditText with `android:inputType="text"`
- Password EditText with `android:inputType="textPassword"`
- `importantForAutofill="yes"`

This will isolate if the problem is Chrome-specific or system-wide.
