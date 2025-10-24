# PasswordEpic Autofill Manual Test Guide

## Current Status

✅ **Autofill Service**: ENABLED (com.passwordepic.mobile/.autofill.PasswordEpicAutofillService)
✅ **Credentials Found**: Yes (github.com: testuser)
✅ **Chrome**: Installed and configured
✅ **Apps**: PasswordEpic and Chrome both installed

## Manual Testing Steps

### Step 1: Prepare Chrome

1. Open Chrome browser on your emulator
2. Navigate to `https://github.com/login`
3. Wait for page to fully load (you should see login form)

### Step 2: Trigger Autofill

1. **Tap on the username field** (the first input field on GitHub login)
2. When you tap, you should see:
   - An autofill suggestion popup
   - Username: "testuser"
   - PasswordEpic as the source

### Step 3: Confirm Autofill Works

1. Tap on the autofill suggestion
2. The username field should auto-populate with "testuser"
3. Password field should also auto-populate (if available)

## If Autofill Doesn't Appear

### Issue 1: No popup after tapping field

**Solution**:

- Long-tap on the username field (hold for 1 second)
- Some Android versions require long-tap to trigger autofill

### Issue 2: PasswordEpic not listed as autofill provider

**Solution**:

```powershell
# Check which autofill service is set
adb shell "settings get secure autofill_service"

# If NOT showing PasswordEpic, run:
powershell -File test_autofill_full.ps1 -action full
```

### Issue 3: Credentials not appearing

**Solution**:

- Verify github.com credentials exist in PasswordEpic:
  ```powershell
  powershell -File test_autofill_full.ps1 -action check
  ```
- If empty, you need to:
  1. Open PasswordEpic app
  2. Add a new password for github.com
  3. Set username: testuser
  4. Set password: (any test password)
  5. Save

## Debugging Commands

### Check Autofill Logs (Real-time)

```powershell
adb logcat -s "PasswordEpicAutofill"
```

### Check Stored Credentials

```powershell
adb shell "run-as com.passwordepic.mobile cat /data/data/com.passwordepic.mobile/shared_prefs/autofill_data.xml"
```

### Check Android Autofill Service

```powershell
adb shell "settings get secure autofill_service"
```

### Clear Chrome Data

```powershell
adb shell "pm clear --cache com.android.chrome"
```

## Expected Behavior

When autofill is working correctly:

1. You tap on a username/email field
2. Android shows autofill suggestions
3. PasswordEpic provider shows available credentials
4. Tapping a credential auto-fills the field
5. You may need to approve with biometric/password depending on settings

## Quick Test Commands

```powershell
# Full test
powershell -File test_autofill_full.ps1 -action test

# Check status only
powershell -File test_autofill_full.ps1 -action check

# View logs
powershell -File test_autofill_full.ps1 -action logs
```

## Common Issues & Fixes

| Issue                      | Cause                           | Fix                                                          |
| -------------------------- | ------------------------------- | ------------------------------------------------------------ |
| No autofill popup          | Service not enabled             | Run: `powershell -File test_autofill_full.ps1 -action check` |
| Domain mismatch            | Stored domain doesn't match URL | Add credentials for exact domain in PasswordEpic             |
| Phishing detector blocking | Domain verification failed      | Check DomainVerifier.kt logic                                |
| Permission denied          | Chrome doesn't allow autofill   | Check Chrome Settings > Passwords and autofill               |
| Credentials not loading    | Encrypted data issue            | Clear PasswordEpic cache and re-add credentials              |

## Support

For debugging:

1. Check logs: `adb logcat -s "PasswordEpicAutofill"`
2. Verify credentials: Check autofill_data.xml
3. Test on simpler domain: Try example.com if github.com doesn't work
4. Restart emulator if no changes work
