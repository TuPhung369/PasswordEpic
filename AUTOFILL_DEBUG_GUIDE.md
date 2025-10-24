# Autofill Domain Issue - Debug Guide

## Problem Summary

When autofill suggestion appears, it shows **"github.com/login"** (domain) instead of **"githublogin"** or **"tombobap"** (username).

## Root Cause Analysis

The autofill system consists of 3 main components:

### 1. React Native Layer (prepares credentials)

- File: `src/services/autofillService.ts`
- Function: `prepareCredentialsForAutofill()`
- What it does: Extracts domain from website URL, then sends credentials to Android via `AutofillBridge.prepareCredentials()`

### 2. Android Bridge Layer (stores credentials)

- File: `android/app/src/main/java/com/passwordepic/mobile/autofill/AutofillBridge.kt`
- Function: `prepareCredentials()`
- What it does: Stores encrypted credentials in SharedPreferences for autofill service to access

### 3. Android Autofill Service (retrieves & displays credentials)

- File: `android/app/src/main/java/com/passwordepic/mobile/autofill/PasswordEpicAutofillService.kt`
- Function: `onFillRequest()` → `buildDataset()`
- What it does: Retrieves credentials from SharedPreferences, matches with detected domain, and creates RemoteViews presentation with `credential.username`

## Changes Made for Debugging

### 1. React Native (autofillService.ts)

✅ Added detailed console logs to show which credentials are being prepared

```typescript
console.log(
  `🔄 Prepared ${credentials.length} credentials for autofill:`,
  credentials.map(c => ({ domain: c.domain, username: c.username })),
);
```

### 2. Android Bridge (AutofillBridge.kt)

✅ Added logs showing what credentials are received and stored

```kotlin
Log.d(TAG, "🔄 Preparing credentials for autofill")
for (i in 0 until credentials.length()) {
    val cred = credentials.getJSONObject(i)
    Log.d(TAG, "  [$i] domain='${cred.optString("domain")}', username='${cred.optString("username")}'")
}
```

### 3. Autofill Service (PasswordEpicAutofillService.kt)

✅ Added logs in `onFillRequest()` to track:

- Domain detected from browser/app
- Credentials retrieved from SharedPreferences
- How credentials are passed to `buildDataset()`

✅ Added logs in `buildDataset()` to show:

- Credential object content (domain, username, password)
- What text is set in presentation view

### 4. Autofill Data Provider (AutofillDataProvider.kt)

✅ Added detailed logs in `getCredentialsFromSharedPreferences()`:

- Whether credentials exist in SharedPreferences
- Total credentials stored
- Each credential's domain and username
- Domain matching logic (MATCH or NO MATCH)

✅ Removed mock credentials fallback

- Previously: If no credentials found, returned mock data
- Now: Returns empty list + helpful error message

## How to Debug

### Step 1: Rebuild and Test

```bash
npm run android
```

### Step 2: Save a Test Credential

1. Open PasswordEpic app
2. Add new password:
   - Website: `github.com` (or `https://github.com`)
   - Username: `testuser`
   - Password: `testpass`
3. Save it

### Step 3: Check React Native Logs

Look for messages like:

```
🔄 Prepared X credentials for autofill:
[
  { domain: 'github.com', username: 'testuser' }
]
```

**If you DON'T see this**, then `prepareCredentialsForAutofill()` is not being called.

### Step 4: Check Android Logs

In Android Studio or `adb logcat`:

```bash
adb logcat | grep -i autofill
```

Look for:

```
🔄 Preparing credentials for autofill
  [0] domain='github.com', username='testuser'
✅ Credentials prepared successfully and saved to SharedPreferences
```

**If you see `❌ Error preparing credentials`**, there's a JSON parsing issue.

### Step 5: Test Autofill

1. Open Chrome and go to https://github.com/login
2. Click on username field
3. Autofill suggestion should appear

Check logs for:

```
📥 onFillRequest: Autofill request received
✅ Found autofillable fields: 2
🔗 Domain: 'github.com', Package: 'com.android.chrome'
🔍 Searching for credentials matching domain: 'github.com'
🔄 AutofillDataProvider: 📊 Total credentials stored: 1
🔄 AutofillDataProvider: 🔍 Checking credential: domain='github.com', username='testuser'
✅ MATCH FOUND! domain='github.com' matches 'github.com'
✅ Found 1 matching credentials
🏗️ Building dataset for credential:
   username: testuser
📄 Presentation set to display: 'testuser'
```

## Possible Issues & Solutions

### Issue 1: "No credentials stored in SharedPreferences"

**Cause**: React Native is not calling `AutofillBridge.prepareCredentials()`
**Check**: Does React Native log show "Sending credentials to native autofill bridge..."?
**Solution**: Ensure `passwordsSlice.ts` calls `autofillService.prepareCredentialsForAutofill()` after loading passwords

### Issue 2: "No dataset matches filter"

**Cause**: Domain mismatch between saved and detected

- Saved: `github.com`
- Detected: `github.com/login` or `api.github.com`
  **Check**: Compare domain values in logs
  **Solution**: Ensure domain extraction is consistent

### Issue 3: "Username showing as domain"

**Cause**: `credential.username` field contains the wrong value
**Check**: In buildDataset() logs, what's in `credential.username`?
**Solution**: Check React Native - is it saving username correctly?

### Issue 4: Presentation shows wrong text

**Cause**: RemoteViews layout ID mismatch
**Check**: `android.R.layout.simple_list_item_1` should have `android.R.id.text1`
**Solution**: Use Chrome Remote Debugging to inspect autofill suggestion layout

## Log Message Guide

| Emoji | Meaning                     |
| ----- | --------------------------- |
| 📥    | Autofill request received   |
| 📦    | Data retrieved from storage |
| 🔎    | Searching for credentials   |
| 🔍    | Checking/analyzing          |
| ✅    | Success/Match found         |
| ❌    | Failure/No match            |
| ⚠️    | Warning                     |
| 💡    | Helpful hint                |
| 🏗️    | Building/Constructing       |
| 📄    | Presentation/UI             |
| 🔗    | Domain/URL related          |
| 🔒    | Password/Security           |
| 📊    | Statistics/Count            |

## Next Steps

1. **Rebuild app** with these debug changes
2. **Reproduce the issue** by saving a credential and testing autofill
3. **Share the logs** showing the full flow
4. Based on logs, we can identify exactly where the problem is

Once we identify the issue from logs, we can implement a permanent fix.
