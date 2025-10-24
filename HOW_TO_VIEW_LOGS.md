# 📋 How to View & Monitor Autofill Logs

## ⚡ Quick Start - Real-Time Monitoring

### Terminal 1: Start Log Monitoring

```powershell
# Option A: Only PasswordEpic autofill logs (cleanest)
adb logcat -s "PasswordEpicAutofill" -v threadtime

# Option B: Multiple related tags
adb logcat -s "PasswordEpicAutofill,ViewNodeParser,AutofillDataProvider" -v threadtime

# Option C: All Android logs (verbose, but see everything)
adb logcat -v threadtime
```

**Press Ctrl+C to stop monitoring**

---

### Terminal 2: Trigger Autofill

```powershell
# Keep Terminal 1 running, open Terminal 2
# Then manually:

# 1. Open Chrome on emulator
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main

# 2. Wait 2-3 seconds
Start-Sleep 3

# 3. Navigate to GitHub login
adb shell input text "github.com/login"
adb shell input keyevent 66  # Press Enter

# 4. Wait for page to load
Start-Sleep 5

# 5. Tap on username field (approximate coordinates)
adb shell input tap 500 400

# 6. Wait 3 seconds and check Terminal 1 logs
Start-Sleep 3
```

---

## 📊 View Logs Step-by-Step

### Method 1️⃣: Real-Time (Recommended for Testing)

```powershell
# Terminal 1 - Monitor logs
adb logcat -s "PasswordEpicAutofill" -v threadtime

# Output Example:
# 10-17 14:30:45.123 12345 12345 I PasswordEpicAutofill: 📥 onFillRequest: Autofill request received
# 10-17 14:30:45.234 12345 12345 I PasswordEpicAutofill: ✅ Found 2 matching credentials
# 10-17 14:30:45.345 12345 12345 I PasswordEpicAutofill: ✅ Autofill response sent
```

---

### Method 2️⃣: Save Logs to File (For Analysis)

```powershell
# Capture logs to file while testing
$logFile = "e:\IT\Mobile\PasswordEpic\autofill_test_logs.txt"

# Start capturing (runs for 30 seconds)
adb logcat -s "PasswordEpicAutofill,ViewNodeParser" -v threadtime > $logFile

# Then in another terminal, trigger autofill (steps above)
# After 30 seconds, Ctrl+C to stop

# View the saved log
Get-Content $logFile | Select-String -Pattern "PasswordEpicAutofill" -Context 0,5
```

---

### Method 3️⃣: Filter Specific Keywords

```powershell
# Search for success indicators
adb logcat -s "PasswordEpicAutofill" -v threadtime | Select-String "Found|matching|response"

# Search for errors
adb logcat -s "PasswordEpicAutofill" -v threadtime | Select-String "Error|Failed|No credentials"

# Search for domain extraction
adb logcat -s "ViewNodeParser" -v threadtime | Select-String "domain|extract"
```

---

## 🎯 Expected Log Outputs

### ✅ SUCCESS Case

```
I PasswordEpicAutofill: 📥 onFillRequest: Autofill request received with 2 contexts
I PasswordEpicAutofill: AssistStructure contains 1 window(s)
I ViewNodeParser: Parsing AssistStructure with 1 windows
I ViewNodeParser: ✅ Extracted domain from webDomain: github.com
I PasswordEpicAutofill: ✅ Found 2 matching credentials for github.com
I PasswordEpicAutofill: 📤 Autofill response sent with 2 datasets
```

### ❌ FAILURE Cases

**No autofill triggered:**

```
(No logs appear in autofill tag)
→ Chrome didn't send autofill request
→ Check: Did you tap on the field? Is autofill enabled in Chrome?
```

**No domain detected:**

```
I PasswordEpicAutofill: 📥 onFillRequest: Autofill request received
I ViewNodeParser: ⚠️ Could not extract domain from node
I PasswordEpicAutofill: ❌ No credentials found (no domain detected)
→ Need to implement more fallbacks
```

**No matching credentials:**

```
I PasswordEpicAutofill: ✅ Extracted domain: github.com (from HTML)
I PasswordEpicAutofill: ❌ No credentials found for github.com
→ Save a password for github.com first
```

---

## 🔧 Complete Debug Workflow

```powershell
# 1. Clear old logs
adb logcat -c

# 2. Start monitoring (Terminal 1)
$job = Start-Process powershell -ArgumentList {
    adb logcat -s "PasswordEpicAutofill,ViewNodeParser,AutofillDataProvider" -v threadtime
} -PassThru

# 3. Wait 1 second
Start-Sleep 1

# 4. Open Chrome (Terminal 2 continues below...)
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main
Start-Sleep 3

# 5. Navigate to test site
adb shell input tap 500 200  # Tap address bar
Start-Sleep 1
adb shell input text "github.com/login"
adb shell input keyevent 66  # Enter
Start-Sleep 5

# 6. Tap username field
adb shell input tap 500 400
Start-Sleep 1

# 7. Wait for autofill popup
Start-Sleep 3

# 8. View captured logs
Write-Host "📋 Checking logs..."
Start-Sleep 1

# 9. Stop job
Stop-Process $job.Id -ErrorAction SilentlyContinue
```

---

## 💾 Save & Analyze Full Log

```powershell
# Method A: Save using PowerShell (BEST FOR WINDOWS)
$logPath = "e:\IT\Mobile\PasswordEpic\autofill_analysis.log"

# Start monitoring and redirect to file
adb logcat -s "PasswordEpicAutofill,ViewNodeParser" -v threadtime | Tee-Object -FilePath $logPath

# (Do your test here)

# Then analyze
notepad $logPath
```

```powershell
# Method B: Save using redirection
adb logcat -s "PasswordEpicAutofill" -v threadtime > "e:\IT\Mobile\PasswordEpic\log.txt"

# (Do your test)

# Then view
Get-Content "e:\IT\Mobile\PasswordEpic\log.txt"
```

---

## 🎬 Live Example Workflow

```powershell
# Terminal 1: Start monitoring
adb logcat -s "PasswordEpicAutofill" -v threadtime

# ↓↓↓ Open Terminal 2 ↓↓↓

# Terminal 2: Execute
adb logcat -c
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main
Start-Sleep 3

# Go to github.com/login manually or:
adb shell "input tap 500 200; input text 'github.com'; input keyevent 66"
Start-Sleep 5

# Tap on username field
adb shell input tap 500 400
Start-Sleep 2

# ↑↑↑ Check Terminal 1 output ↑↑↑
```

---

## 📍 What to Look For

| Log Line                               | Meaning                   |
| -------------------------------------- | ------------------------- |
| `📥 onFillRequest`                     | Autofill was triggered ✅ |
| `AssistStructure contains X window(s)` | App structure parsed ✅   |
| `✅ Extracted domain from`             | Domain found ✅           |
| `✅ Found X matching credentials`      | Credentials matched ✅    |
| `📤 Autofill response sent`            | Popup should appear ✅    |
| `⚠️ Could not extract domain`          | Need more fallbacks ❌    |
| `❌ No credentials found`              | No password saved ❌      |

---

## 🚨 If Logs Don't Appear

1. **Verify PasswordEpicAutofill tag exists:**

   ```powershell
   adb logcat | Select-String "PasswordEpicAutofill" -Context 0,2
   ```

2. **Check if app is installed:**

   ```powershell
   adb shell pm list packages | Select-String "passwordepic"
   ```

3. **Check autofill service enabled:**

   ```powershell
   adb shell settings get secure autofill_service_search_uri
   adb shell "settings list secure | Select-String autofill"
   ```

4. **View ALL logs (verbose):**
   ```powershell
   adb logcat -v threadtime | Select-String "password|autofill" -IgnoreCase
   ```
