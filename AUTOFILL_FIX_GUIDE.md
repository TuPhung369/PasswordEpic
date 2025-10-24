# PasswordEpic Autofill Fix Guide

## Problems Identified and Fixed 🔴➡️🟢

### Problem 1: Domain Extraction Bug in ViewNodeParser

**Status**: ✅ FIXED

**Issue**:

- Chrome webview not sending `webDomain` property to autofill framework
- Old code had a bug on line 213: `val url = "$scheme://${node.webDomain}"` creating invalid URL like `scheme://null`
- No fallback mechanism to detect domain from alternative sources

**Root Cause**:
Chrome doesn't properly expose domain information through Android's autofill framework for security reasons.

**Fix Applied**:
Added comprehensive domain extraction fallback chain:

```kotlin
1. webDomain property (if available)
2. webScheme + webDomain combined
3. Node text content (accessibility)
4. Node hint text
5. HTML attributes (action, data)
6. Recursive search in child nodes
```

**Files Modified**:

- `/android/app/src/main/java/com/passwordepic/mobile/autofill/ViewNodeParser.kt`

---

### Problem 2: Missing Debug Logging

**Status**: ✅ FIXED

**Issue**:

- Insufficient logging to diagnose where autofill fails
- Could not see if onFillRequest was even called
- No visibility into parse results

**Fix Applied**:
Added detailed logging to:

- FillRequest reception
- AssistStructure window count
- ParsedData results (fields count, domain, package)
- Domain extraction attempts (shows which method succeeded)

**Files Modified**:

- `/android/app/src/main/java/com/passwordepic/mobile/autofill/PasswordEpicAutofillService.kt`

---

## Testing the Fix

### Step 1: Rebuild the App

```powershell
npm run android
# Wait for build to complete
```

### Step 2: Clear Old Logs

```powershell
adb logcat -c
```

### Step 3: Trigger Autofill Test

```powershell
# Open test script
powershell -File test_autofill_trigger.ps1
```

Or manually:

1. Open Chrome
2. Navigate to github.com/login
3. **Tap on username field**
4. Watch logs for autofill service response

### Step 4: Check Logs in Real-time

```powershell
adb logcat -s "PasswordEpicAutofill,ViewNodeParser,AutofillDataProvider" --format "threadtime"
```

---

## Expected Log Output After Fix

### ✅ Successful Case

```
I PasswordEpicAutofill: 📥 onFillRequest: Autofill request received
I PasswordEpicAutofill: 📦 FillContexts count: 1
I PasswordEpicAutofill: 🔍 AssistStructure windows: 1
I ViewNodeParser: Parsing AssistStructure with 1 windows
I ViewNodeParser: Package name: com.android.chrome
I ViewNodeParser: ✅ Extracted domain from webDomain: github.com
  (OR) ✅ Extracted domain from HTML action: github.com
  (OR) ✅ Extracted domain from node text: github.com
I ViewNodeParser: Found 2 autofillable fields
I PasswordEpicAutofill: 📊 ParsedData - Fields: 2, Domain: 'github.com', Package: 'com.android.chrome'
I PasswordEpicAutofill: 🔍 Searching for credentials matching domain: 'github.com'
I AutofillDataProvider: 🔎 Getting credentials for domain: 'github.com'
I AutofillDataProvider: ✅ Found credentials in SharedPreferences
I PasswordEpicAutofill: ✅ Found 1 matching credentials
I PasswordEpicAutofill: ✅ Autofill response sent to Chrome
```

### ❌ Debug Cases

**Case 1: No Form Fields Detected**

```
I PasswordEpicAutofill: 📥 onFillRequest: Autofill request received
I ViewNodeParser: Parsing AssistStructure with 1 windows
I ViewNodeParser: ❌ No autofillable fields found
```

**Solution**: Check if Chrome's form fields have proper autofill hints

**Case 2: Domain Not Extracted**

```
I ViewNodeParser: ⚠️ Could not extract domain from node
```

**Solution**: Domain might be in unexpected location, check HTML content

**Case 3: No Credentials Found**

```
I PasswordEpicAutofill: ❌ No credentials found for domain: 'github.com'
I AutofillDataProvider: 💡 Make sure React Native called prepareCredentials()
```

**Solution**:

1. Save a password in PasswordEpic for github.com first
2. App must call `autofillService.prepareCredentialsForAutofill()`
3. Check SharedPreferences for credentials

---

## Diagnostic Commands

### View All Credentials in SharedPreferences

```powershell
adb shell "run-as com.passwordepic.mobile cat /data/data/com.passwordepic.mobile/shared_prefs/autofill_data.xml"
```

### Clear AutofillDataProvider Cache

```powershell
adb shell "run-as com.passwordepic.mobile rm -f /data/data/com.passwordepic.mobile/shared_prefs/autofill_data.xml"
```

### Capture Full Autofill Logs (30 seconds)

```powershell
adb logcat -s "PasswordEpicAutofill,ViewNodeParser,AutofillDataProvider,AutofillBridge" --format "threadtime" > autofill_logs.txt
# Wait 30 seconds while interacting with Chrome
# Press Ctrl+C
# Check autofill_logs.txt
```

### Check if AutofillService is Registered

```powershell
adb shell "dumpsys autofill | grep -i passwordepic"
```

### Test Credentials Storage Directly

```powershell
adb shell "run-as com.passwordepic.mobile"
# Inside shell:
cat /data/data/com.passwordepic.mobile/shared_prefs/autofill_data.xml
exit
```

---

## Common Issues & Solutions

| Issue                        | Cause                            | Solution                                                                                                                             |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| onFillRequest never logged   | Service not triggered            | 1. Ensure service is enabled in Settings<br>2. Check AndroidManifest.xml registration<br>3. Verify form has detectable fields        |
| Domain extraction fails      | Chrome not sending domain info   | 1. Check if website URL visible in logs<br>2. Verify HTML form elements<br>3. May need custom HTML parsing                           |
| No credentials found         | Credentials not prepared         | 1. Save password in PasswordEpic first<br>2. Check prepareCredentialsForAutofill() is called<br>3. Verify SharedPreferences has data |
| Autofill popup not appearing | Response building issue          | 1. Check buildFillResponse() logic<br>2. Ensure RemoteViews created correctly<br>3. Verify callback.onSuccess() called               |
| Field detection fails        | Chrome webview structure differs | 1. Log node structure<br>2. Add additional field detection heuristics<br>3. Check HTML input types                                   |

---

## Next Steps

1. **After rebuild completes**:

   ```powershell
   # Test manually
   adb logcat -s "PasswordEpicAutofill" --format "threadtime"
   # Open Chrome to github.com/login
   # Tap username field
   ```

2. **If still not working**:

   ```powershell
   # Export logs for analysis
   adb logcat -s "PasswordEpicAutofill,ViewNodeParser" > debug_logs.txt
   # Then analyze what's failing
   ```

3. **Enable verbose autofill logging**:
   ```powershell
   adb shell "settings put secure autofill_logging_level 2"
   ```

---

## Files Changed in This Fix

1. `ViewNodeParser.kt` - Added fallback domain extraction methods
2. `PasswordEpicAutofillService.kt` - Added comprehensive logging
3. `test_autofill_trigger.ps1` - Test script to trigger autofill

---

## Quick Reference: Autofill Flow

```
User taps form field in Chrome
        ↓
Chrome calls AutofillManager.requestAutofill()
        ↓
System calls PasswordEpicAutofillService.onFillRequest()
        ↓
ViewNodeParser extracts domain from webview
        ↓
AutofillDataProvider.getCredentialsForDomain()
        ↓
If found: buildFillResponse() creates UI dataset
        ↓
callback.onSuccess(response)
        ↓
Chrome shows autofill popup
        ↓
User taps credential
        ↓
AutofillBridge fills form and submits
```

---

## Support Resources

- Android Autofill Framework: https://developer.android.com/guide/topics/text/autofill
- Common Autofill Issues: https://developer.android.com/reference/android/service/autofill/AutofillService

---

**Last Updated**: 2024
**Version**: 1.0
