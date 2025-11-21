# PowerShell script to monitor autofill logs
# Usage: .\monitor-autofill.ps1

Write-Host "Monitoring Autofill Logs..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Monitor autofill-related logs
adb logcat | Select-String -Pattern "DEBUG_AUTOFILL|StaticMP|AutofillAuth"
