package com.passwordepic.mobile.autofill

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

/**
 * AutofillBridge Native Module
 *
 * React Native bridge for Android Autofill functionality.
 * Provides communication between React Native app and native autofill service.
 *
 * Features:
 * - Check autofill service status
 * - Request autofill service enablement
 * - Prepare credentials for autofill
 * - Handle autofill events
 * - Manage autofill settings
 *
 * @author PasswordEpic Team
 * @since Week 9 - Phase 4
 */
class AutofillBridge(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AutofillBridge"
        private const val MODULE_NAME = "AutofillBridge"
        
        // Event names
        private const val EVENT_AUTOFILL_REQUEST = "onAutofillRequest"
        private const val EVENT_AUTOFILL_SAVE = "onAutofillSave"
        private const val EVENT_AUTOFILL_ERROR = "onAutofillError"
        
        // Request codes
        private const val REQUEST_CODE_ENABLE_AUTOFILL = 1001
        
        /**
         * Static reference to the AutofillBridge instance
         * Used by AutofillDecryptionReceiver to emit events
         */
        @Volatile
        private var instance: AutofillBridge? = null
        
        fun getInstance(): AutofillBridge? = instance
        
        fun setInstance(bridge: AutofillBridge?) {
            instance = bridge
        }
    }

    init {
        // Store React context globally so AutofillTestActivity can access it
        try {
            val mainApp = reactContext.baseContext.applicationContext as? com.passwordepic.mobile.MainApplication
            if (mainApp != null) {
                com.passwordepic.mobile.MainApplication.setReactContext(reactContext)
                Log.d(TAG, "✅ React context stored globally for autofill activities")
            } else {
                Log.w(TAG, "⚠️ Could not cast to MainApplication")
            }
            
            // Store this instance statically for AutofillDecryptionReceiver
            setInstance(this)
            Log.d(TAG, "✅ AutofillBridge instance stored statically")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error storing React context", e)
        }
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Check if autofill is supported on this device
     */
    @ReactMethod
    fun isAutofillSupported(promise: Promise) {
        try {
            val isSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            Log.d(TAG, "Autofill supported: $isSupported (API ${Build.VERSION.SDK_INT})")
            promise.resolve(isSupported)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking autofill support", e)
            promise.reject("ERROR", "Failed to check autofill support: ${e.message}", e)
        }
    }

    /**
     * Check if PasswordEpic autofill service is enabled
     */
    @ReactMethod
    fun isAutofillEnabled(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(false)
                return
            }

            val autofillManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.getSystemService(AutofillManager::class.java)
            } else {
                null
            }
            
            if (autofillManager == null) {
                Log.w(TAG, "AutofillManager not available")
                promise.resolve(false)
                return
            }

            val isEnabled = autofillManager.hasEnabledAutofillServices()
            val isOurService = isOurAutofillServiceEnabled()
            
            Log.d(TAG, "Autofill enabled: $isEnabled, Our service: $isOurService")
            
            // 🔧 FIX: On some OEM devices (e.g., Huawei), hasEnabledAutofillServices() 
            // may return false even when an autofill service IS selected.
            // If our service is the one enabled, then autofill IS enabled.
            // Also on Huawei, Settings.Secure.autofill_service might be null but the service still works
            val finalResult = isOurService || isEnabled
            Log.d(TAG, "✅ Final autofill status: $finalResult (ourService=$isOurService, systemEnabled=$isEnabled)")
            
            promise.resolve(finalResult)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking autofill status", e)
            promise.reject("ERROR", "Failed to check autofill status: ${e.message}", e)
        }
    }

    /**
     * Request to enable autofill service
     * Opens system settings for user to enable the service
     * Tries multiple approaches including OEM-specific paths for compatibility
     */
    @ReactMethod
    fun requestEnableAutofill(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                Log.e(TAG, "❌ Autofill not supported (API ${Build.VERSION.SDK_INT} < ${Build.VERSION_CODES.O})")
                promise.reject("UNSUPPORTED", "Autofill not supported on this device")
                return
            }

            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Activity not available")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val manufacturer = Build.MANUFACTURER.uppercase()
            Log.d(TAG, "📱 Device manufacturer: $manufacturer")
            Log.d(TAG, "📱 Activity class: ${activity.javaClass.simpleName}")
            
            // Log diagnostic info early to help debug
            logSettingsPackageDiagnostics(activity.packageManager, manufacturer)

            // Try 1: OEM-specific paths FIRST (more reliable on many devices)
            if (tryOEMSpecificAutofillSettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific autofill settings")
                promise.resolve(true)
                return
            }
            Log.d(TAG, "⚠️ OEM-specific paths failed, trying fallbacks...")

            // Try 2: Official Android API (fallback - Android 8.0+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    Log.d(TAG, "📱 Attempt 2: Opening autofill service settings via official API")
                    activity.startActivity(intent)
                    Log.d(TAG, "✅ Opened autofill settings via official API")
                    promise.resolve(true)
                    return
                } catch (e: ActivityNotFoundException) {
                    Log.d(TAG, "⚠️ Official API not supported: ${e.message}")
                } catch (e: Exception) {
                    Log.d(TAG, "⚠️ Error with official API (${e.javaClass.simpleName}): ${e.message}")
                }
            }

            // Fallback 1: Open Settings without category
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                Log.d(TAG, "📱 Attempt 3: Opening Settings app (no category)")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened Settings - Navigate to: Settings → System → Languages & input → More input settings → Autofill (or similar path)")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open Settings without category (${e.javaClass.simpleName}): ${e.message}")
            }

            // Fallback 2: Open Settings with default category
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                Log.d(TAG, "📱 Attempt 4: Opening Settings app (with DEFAULT category)")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened Settings with category")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open Settings with category (${e.javaClass.simpleName}): ${e.message}")
            }

            // Fallback 3: Try opening app settings for PasswordEpic
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, "com.passwordepic.mobile")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                Log.d(TAG, "📱 Attempt 5: Opening PasswordEpic app settings")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened app settings")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open app settings (${e.javaClass.simpleName}): ${e.message}")
            }

            // If all attempts fail
            Log.e(TAG, "❌ All attempts to open autofill settings failed")
            promise.reject("ERROR", "Failed to open autofill settings. Please enable manually in System Settings.")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting autofill enable", e)
            promise.reject("ERROR", "Failed to request autofill enable: ${e.message}", e)
        }
    }

    /**
     * Get OEM-specific instructions for disabling autofill
     * Returns user-friendly guide for the specific device manufacturer
     */
    private fun getOEMDisableInstructions(manufacturer: String): String {
        return when {
            manufacturer.contains("HUAWEI") -> 
                "Huawei Autofill Disabling Instructions:\n\n" +
                "Note: Huawei restricts direct access to autofill settings from apps.\n" +
                "Please follow these manual steps:\n\n" +
                "1. Go to Settings\n" +
                "2. Search for 'Autofill' (use search icon)\n" +
                "3. Or navigate: Settings → System → Languages & input → Autofill\n" +
                "4. Find 'PasswordEpic' autofill service\n" +
                "5. Tap and select 'None' or toggle OFF\n\n" +
                "Alternative (if above doesn't work):\n" +
                "1. Go to Settings → Apps\n" +
                "2. Find 'PasswordEpic'\n" +
                "3. Tap 'Permissions' → 'Autofill'\n" +
                "4. Disable the permission"
            
            manufacturer.contains("SAMSUNG") ->
                "1. Go to Settings\n" +
                "2. Tap 'Apps' or 'Applications'\n" +
                "3. Tap 'Default apps' or 'Default applications'\n" +
                "4. Tap 'Autofill service'\n" +
                "5. Select 'None' to disable PasswordEpic"
            
            manufacturer.contains("XIAOMI") || manufacturer.contains("REDMI") ->
                "1. Go to Settings\n" +
                "2. Tap 'System' or 'Additional settings'\n" +
                "3. Tap 'Languages and input'\n" +
                "4. Tap 'Autofill services' or 'Autofill'\n" +
                "5. Select 'None' to disable PasswordEpic"
            
            manufacturer.contains("OPPO") ->
                "1. Go to Settings\n" +
                "2. Tap 'System' → 'System apps' → 'Settings'\n" +
                "3. Tap 'Languages and input' or 'Input & language'\n" +
                "4. Tap 'Autofill service'\n" +
                "5. Select 'None' to disable PasswordEpic"
            
            manufacturer.contains("ONEPLUS") ->
                "1. Go to Settings\n" +
                "2. Tap 'System'\n" +
                "3. Tap 'System apps' → 'Settings'\n" +
                "4. Tap 'Languages and input'\n" +
                "5. Tap 'Autofill services'\n" +
                "6. Select 'None' to disable PasswordEpic"
            
            manufacturer.contains("GOOGLE") || manufacturer.contains("ANDROID") ->
                "1. Go to Settings\n" +
                "2. Tap 'System' → 'Languages and input'\n" +
                "3. Tap 'Autofill service' or 'Autofill'\n" +
                "4. Select 'None' to disable PasswordEpic"
            
            else ->
                "1. Go to Settings\n" +
                "2. Look for 'Languages and input' or 'Input methods'\n" +
                "3. Find 'Autofill service' or 'Autofill'\n" +
                "4. Select 'None' to disable PasswordEpic"
        }
    }

    /**
     * List all available autofill services on the device
     */
    @ReactMethod
    fun listAvailableAutofillServices(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(Arguments.createArray())
                return
            }
            
            val services = Arguments.createArray()
            
            // Method 1: Try to get from AutofillManager (API 26+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val autofillManager = reactContext.getSystemService(AutofillManager::class.java)
                    if (autofillManager != null) {
                        val currentService = autofillManager.getAutofillServiceComponentName()
                        if (currentService != null) {
                            val serviceMap = Arguments.createMap().apply {
                                putString("package", currentService.packageName)
                                putString("class", currentService.className)
                                putString("full", "${currentService.packageName}/${currentService.className}")
                            }
                            services.pushMap(serviceMap)
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Could not get autofill services from AutofillManager: ${e.message}")
                }
            }
            
            Log.d(TAG, "Found ${services.size()} available autofill services")
            promise.resolve(services)
        } catch (e: Exception) {
            Log.e(TAG, "Error listing autofill services", e)
            promise.reject("ERROR", "Failed to list autofill services: ${e.message}", e)
        }
    }

    /**
     * Disable autofill service
     * Opens system settings for user to disable the service
     * Tries device-specific paths for different manufacturers
     * Returns OEM-specific instructions for user guidance
     * Note: We can't programmatically disable - user must do it through settings
     */
    @ReactMethod
    fun disableAutofill(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(true)
                return
            }

            val autofillManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.getSystemService(AutofillManager::class.java)
            } else {
                null
            }
            
            if (autofillManager == null) {
                Log.e(TAG, "❌ AutofillManager not available")
                promise.reject("ERROR", "AutofillManager not available")
                return
            }

            val activity = reactContext.currentActivity
            
            if (activity == null) {
                Log.e(TAG, "❌ Activity not available")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val manufacturer = Build.MANUFACTURER.uppercase()
            Log.d(TAG, "📱 Device manufacturer: $manufacturer")
            
            // Get OEM-specific instructions for this device
            val instructions = getOEMDisableInstructions(manufacturer)

            // IMPORTANT: Return data without opening intent yet
            // Intent will be opened by JavaScript AFTER showing the Alert dialog
            // This ensures the Alert is visible before app goes to background
            
            Log.d(TAG, "✅ Returning disable autofill data with OEM-specific instructions")
            
            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("instructions", instructions)
                putString("action", "openAutofillSettings")
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error disabling autofill", e)
            promise.reject("ERROR", "Failed to disable autofill: ${e.message}", e)
        }
    }

    /**
     * Actually open autofill settings after user confirms
     * This is called AFTER the Alert dialog is shown to the user
     * So the app stays in foreground until user sees the instructions
     */
    @ReactMethod
    fun openAutofillSettingsNow(promise: Promise) {
        try {
            Log.d(TAG, "📱 openAutofillSettingsNow called - opening settings intent")
            
            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Activity not available")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val manufacturer = Build.MANUFACTURER.uppercase()
            Log.d(TAG, "📱 Device manufacturer: $manufacturer")

            // Try 1: OEM-specific paths FIRST (more reliable on many devices, especially Huawei)
            if (tryOEMSpecificAutofillSettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific autofill settings")
                promise.resolve(true)
                return
            }

            // Try 2: Official Android API (fallback - Android 8.0+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    Log.d(TAG, "📱 Attempt 2: Opening autofill service settings via official API")
                    activity.startActivity(intent)
                    Log.d(TAG, "✅ Opened autofill settings via official API")
                    promise.resolve(true)
                    return
                } catch (e: ActivityNotFoundException) {
                    Log.d(TAG, "⚠️ Official API not supported on this device, trying fallback...")
                } catch (e: Exception) {
                    Log.d(TAG, "⚠️ Error with official API: ${e.message}, trying fallback...")
                }
            }

            // Fallback 1: Open Settings with default category
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                Log.d(TAG, "📱 Attempt 3: Opening Settings app")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened Settings")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open Settings: ${e.message}")
            }

            // Fallback 2: Try opening app settings for PasswordEpic
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, "com.passwordepic.mobile")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                Log.d(TAG, "📱 Attempt 4: Opening PasswordEpic app settings")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened app settings")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open app settings: ${e.message}")
            }

            // If all attempts fail
            Log.e(TAG, "❌ All attempts to open autofill settings failed")
            promise.resolve(false)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error opening autofill settings", e)
            promise.reject("ERROR", "Failed to open autofill settings: ${e.message}", e)
        }
    }

    /**
     * Log diagnostic information about available settings packages
     * Helps troubleshoot why settings cannot be opened on specific devices
     */
    private fun logSettingsPackageDiagnostics(packageManager: android.content.pm.PackageManager, manufacturer: String) {
        try {
            Log.d(TAG, "🔧 === Diagnostic Info for $manufacturer ===")
            
            // Check if com.android.settings exists
            try {
                packageManager.getPackageInfo("com.android.settings", 0)
                Log.d(TAG, "✓ com.android.settings package found")
            } catch (e: Exception) {
                Log.d(TAG, "✗ com.android.settings package NOT found: ${e.message}")
            }
            
            // Check if com.huawei.settings exists (for Huawei devices)
            if (manufacturer.contains("HUAWEI")) {
                try {
                    packageManager.getPackageInfo("com.huawei.settings", 0)
                    Log.d(TAG, "✓ com.huawei.settings package found")
                } catch (e: Exception) {
                    Log.d(TAG, "✗ com.huawei.settings package NOT found: ${e.message}")
                }
            }
            
            // Try to launch getPackageInfo for system settings to see what's available
            val sysSettingsIntents = listOf(
                Pair("ACTION_SETTINGS", Intent(Settings.ACTION_SETTINGS)),
                Pair("ACTION_REQUEST_SET_AUTOFILL_SERVICE", Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)),
                Pair("android.settings.AUTOFILL_SETTINGS", Intent("android.settings.AUTOFILL_SETTINGS"))
            )
            
            for ((name, intent) in sysSettingsIntents) {
                val resolveInfos = packageManager.queryIntentActivities(intent, 0)
                Log.d(TAG, "📱 $name: ${resolveInfos.size} activity(ies) found")
                for (info in resolveInfos) {
                    Log.d(TAG, "   - ${info.activityInfo.packageName}/${info.activityInfo.name}")
                }
            }
            
            Log.d(TAG, "🔧 === End Diagnostic Info ===")
        } catch (e: Exception) {
            Log.d(TAG, "Could not log diagnostics: ${e.message}")
        }
    }

    /**
     * Query PackageManager to find available autofill-related settings activities
     * This helps discover what settings activities are actually available on the device
     * Works across different OEM implementations
     */
    private fun discoverAvailableAutofillActivities(packageManager: android.content.pm.PackageManager): List<Intent> {
        val discoveredIntents = mutableListOf<Intent>()
        
        try {
            // Query 1: Try apps that can handle autofill settings
            val autofillSettingsIntent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
            val autofillResolveInfos = packageManager.queryIntentActivities(autofillSettingsIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            Log.d(TAG, "🔍 Found ${autofillResolveInfos.size} activities for ACTION_REQUEST_SET_AUTOFILL_SERVICE")
            for (info in autofillResolveInfos) {
                val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                    setClassName(info.activityInfo.packageName, info.activityInfo.name)
                }
                discoveredIntents.add(intent)
                Log.d(TAG, "  ✓ Discovered: ${info.activityInfo.packageName}/${info.activityInfo.name}")
            }
        } catch (e: Exception) {
            Log.d(TAG, "Note: Could not query ACTION_REQUEST_SET_AUTOFILL_SERVICE: ${e.message}")
        }
        
        try {
            // Query 2: Try generic autofill settings action
            val customAutofillIntent = Intent("android.settings.AUTOFILL_SETTINGS")
            val customResolveInfos = packageManager.queryIntentActivities(customAutofillIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            Log.d(TAG, "🔍 Found ${customResolveInfos.size} activities for android.settings.AUTOFILL_SETTINGS")
            for (info in customResolveInfos) {
                val intent = Intent("android.settings.AUTOFILL_SETTINGS").apply {
                    setClassName(info.activityInfo.packageName, info.activityInfo.name)
                }
                if (!discoveredIntents.any { it.component == intent.component }) {
                    discoveredIntents.add(intent)
                    Log.d(TAG, "  ✓ Discovered: ${info.activityInfo.packageName}/${info.activityInfo.name}")
                }
            }
        } catch (e: Exception) {
            Log.d(TAG, "Note: Could not query android.settings.AUTOFILL_SETTINGS: ${e.message}")
        }
        
        Log.d(TAG, "🔍 Total discovered autofill activities: ${discoveredIntents.size}")
        return discoveredIntents
    }

    /**
     * Try to open autofill settings using OEM-specific deep links
     * Different manufacturers have different paths to autofill settings
     */
    private fun tryOEMSpecificAutofillSettings(activity: Activity, manufacturer: String): Boolean {
        val packageManager = activity.packageManager
        val intentsList = when {
            // Huawei devices: Settings → System → Languages & input → More input settings → Autofill
            // Huawei has different settings paths than AOSP and often blocks direct access to autofill settings
            manufacturer.contains("HUAWEI") -> {
                val huaweiIntents = mutableListOf<Intent>()
                
                // Try 1: Direct autofill intent with explicit flags
                val autofillRequestIntent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                }
                huaweiIntents.add(autofillRequestIntent)
                
                // Try 2: Generic autofill settings action
                huaweiIntents.add(Intent("android.settings.AUTOFILL_SETTINGS"))
                
                // Try 3: Try with explicit action for autofill picker
                huaweiIntents.add(Intent("android.settings.AUTOFILL_SETTINGS").apply {
                    setPackage("com.android.settings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                
                // Try 4: Use direct action without component (let system resolve)
                huaweiIntents.add(Intent("android.settings.AUTOFILL_SETTINGS").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                })
                
                // Note: AutofillPickerTrampolineActivity is often unavailable or crashes on Huawei
                // Skip it to avoid wasting attempts - will use fallback methods instead
                
                huaweiIntents
            }
            // Samsung devices: Settings → General management → Language and input → Autofill service
            // Samsung One UI has different paths than stock Android
            manufacturer.contains("SAMSUNG") -> listOf(
                // Try Samsung's DefaultAutofillPickerActivity (found via dumpsys)
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$DefaultAutofillPickerActivity"),
                // Try direct component for Language and Input (Samsung One UI)
                Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.Settings\$LanguageAndInputSettingsActivity")
                },
                // Try opening Manage Default Apps
                Intent("android.settings.MANAGE_DEFAULT_APPS_SETTINGS"),
                // Try standard Autofill picker
                Intent().setClassName("com.android.settings", "com.android.settings.applications.defaultapps.DefaultAutofillPicker"),
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                // Try Autofill settings action
                Intent("android.settings.AUTOFILL_SETTINGS"),
                // Fallback: Open general Settings
                Intent(Settings.ACTION_SETTINGS)
            )
            // Xiaomi devices: Settings → System → Languages and input → Autofill services
            manufacturer.contains("XIAOMI") || manufacturer.contains("REDMI") -> listOf(
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                Intent("android.settings.AUTOFILL_SETTINGS"),
                Intent("android.settings.INPUT_METHOD_SETTINGS"),
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$InputMethodAndLanguageSettings")
            )
            // OPPO/OnePlus devices: Settings → System → System apps → Settings → Languages and input
            manufacturer.contains("OPPO") || manufacturer.contains("ONEPLUS") -> listOf(
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                Intent("android.settings.AUTOFILL_SETTINGS"),
                Intent("android.settings.INPUT_METHOD_SETTINGS"),
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$InputMethodAndLanguageSettings")
            )
            // Google/Stock Android devices
            manufacturer.contains("GOOGLE") || manufacturer.contains("ANDROID") -> listOf(
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                Intent("android.settings.AUTOFILL_SETTINGS"),
                Intent("android.settings.INPUT_METHOD_SETTINGS")
            )
            // Generic fallback for unknown manufacturers
            else -> listOf(
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                Intent("android.settings.AUTOFILL_SETTINGS"),
                Intent("android.settings.INPUT_METHOD_SETTINGS"),
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$InputMethodAndLanguageSettings")
            )
        }

        for ((index, intent) in intentsList.withIndex()) {
            val actionStr = intent.action ?: "no-action"
            val componentStr = intent.component?.className ?: "N/A"
            val pkgStr = intent.component?.packageName ?: intent.getPackage() ?: "N/A"
            Log.d(TAG, "📱 OEM Attempt ${index + 1} ($manufacturer): action='$actionStr' pkg='$pkgStr' component='$componentStr'")
            
            try {
                // Check if intent can be resolved before calling startActivity
                val resolveInfo = packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
                if (resolveInfo == null) {
                    Log.d(TAG, "⚠️ OEM Attempt ${index + 1}: Cannot resolve - checking with flag 0...")
                    // Try with different flags
                    val resolveInfo2 = packageManager.resolveActivity(intent, 0)
                    if (resolveInfo2 == null) {
                        Log.d(TAG, "⚠️ OEM Attempt ${index + 1}: Intent cannot be resolved even with flag 0")
                        continue
                    } else {
                        Log.d(TAG, "✓ OEM Attempt ${index + 1}: Intent resolved with flag 0: ${resolveInfo2.activityInfo.packageName}/${resolveInfo2.activityInfo.name}")
                    }
                } else {
                    Log.d(TAG, "✓ OEM Attempt ${index + 1}: Intent resolved: ${resolveInfo.activityInfo.packageName}/${resolveInfo.activityInfo.name}")
                }
                
                Log.d(TAG, "✓ OEM Attempt ${index + 1}: Attempting to start activity...")
                // Only add flags if they're not already set
                if (intent.flags == 0) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                try {
                    activity.startActivity(intent)
                    Log.d(TAG, "✅ Successfully opened autofill settings via OEM-specific path")
                    Thread.sleep(500)
                    return true
                } catch (e: Exception) {
                    Log.d(TAG, "⚠️ OEM Attempt ${index + 1} startActivity() failed (${e.javaClass.simpleName}): ${e.message}")
                    throw e
                }
            } catch (e: ActivityNotFoundException) {
                Log.d(TAG, "⚠️ OEM Attempt ${index + 1}: ActivityNotFoundException - ${e.message}")
            } catch (e: SecurityException) {
                Log.d(TAG, "⚠️ OEM Attempt ${index + 1}: SecurityException - ${e.message}")
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ OEM Attempt ${index + 1} failed (${e.javaClass.simpleName}): ${e.message}")
            }
        }

        Log.d(TAG, "⏳ OEM-specific direct attempts failed - trying alternative navigation...")
        
        // For Huawei, the autofill activity is blocked from direct launch
        // Use optimized helper function with nested fallbacks
        if (manufacturer.contains("HUAWEI")) {
            Log.d(TAG, "📱 Huawei detected: Direct autofill settings access not working")
            Log.d(TAG, "📱 Attempting Huawei-optimized autofill settings approach...")
            try {
                openAutofillSettings(activity)
                return true
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Huawei-optimized approach failed: ${e.message}")
            }
        }
        
        Log.d(TAG, "⏳ Trying dynamically discovered autofill activities...")
        
        // Fallback: Try dynamically discovered autofill activities
        val discoveredIntents = discoverAvailableAutofillActivities(packageManager)
        for ((index, intent) in discoveredIntents.withIndex()) {
            val componentStr = intent.component?.className ?: "N/A"
            Log.d(TAG, "🔍 Discovered Attempt ${index + 1}: component='$componentStr'")
            
            try {
                val resolveInfo = packageManager.resolveActivity(intent, 0)
                if (resolveInfo == null) {
                    Log.d(TAG, "⚠️ Discovered Attempt ${index + 1}: Intent cannot be resolved")
                    continue
                }
                
                Log.d(TAG, "✓ Discovered Attempt ${index + 1}: Intent can be resolved, attempting to start...")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                activity.startActivity(intent)
                Log.d(TAG, "✅ Successfully opened autofill settings via discovered activity")
                return true
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Discovered Attempt ${index + 1} failed: ${e.javaClass.simpleName} - ${e.message}")
            }
        }

        Log.e(TAG, "❌ All autofill settings attempts failed for $manufacturer")
        Log.e(TAG, "💡 On Huawei devices, autofill settings are restricted. Opening general Settings instead...")
        
        // Last resort: Open general settings
        try {
            val settingsIntent = Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            activity.startActivity(settingsIntent)
            Log.d(TAG, "✅ Opened Settings app as final fallback")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Even Settings app cannot be opened: ${e.message}")
            return false
        }
    }

    /**
     * Prepare credentials for autofill
     * Stores encrypted credentials in secure storage for autofill service access
     */
    @ReactMethod
    fun prepareCredentials(credentialsJson: String, promise: Promise) {
        try {
            Log.d(TAG, "🔄 Preparing credentials for autofill")
            
            // Parse credentials JSON
            val credentials = JSONArray(credentialsJson)
            Log.d(TAG, "📊 Parsed ${credentials.length()} credentials")

            // Debug: log each credential
            for (i in 0 until credentials.length()) {
                val cred = credentials.getJSONObject(i)
                Log.d(TAG, "  [$i] domain='${cred.optString("domain")}', username='${cred.optString("username")}'")
            }

            // Store in shared preferences (encrypted by React Native layer)
            val prefs = reactContext.getSharedPreferences("autofill_data", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putString("credentials", credentialsJson)
                putLong("last_updated", System.currentTimeMillis())
                apply()
            }

            Log.d(TAG, "✅ Credentials prepared successfully and saved to SharedPreferences")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error preparing credentials", e)
            promise.reject("ERROR", "Failed to prepare credentials: ${e.message}", e)
        }
    }

    /**
     * Get credentials for a specific domain
     */
    @ReactMethod
    fun getCredentialsForDomain(domain: String, promise: Promise) {
        try {
            Log.d(TAG, "Getting credentials for domain: $domain")

            val prefs = reactContext.getSharedPreferences("autofill_data", Context.MODE_PRIVATE)
            val credentialsJson = prefs.getString("credentials", null)

            if (credentialsJson == null) {
                Log.w(TAG, "No credentials available")
                promise.resolve(Arguments.createArray())
                return
            }

            // Parse and filter credentials
            val allCredentials = JSONArray(credentialsJson)
            val matchingCredentials = Arguments.createArray()

            for (i in 0 until allCredentials.length()) {
                val credential = allCredentials.getJSONObject(i)
                val credDomain = credential.optString("domain", "")
                
                if (domainsMatch(credDomain, domain)) {
                    val credMap = Arguments.createMap().apply {
                        putString("id", credential.optString("id"))
                        putString("domain", credential.optString("domain"))
                        putString("username", credential.optString("username"))
                        putString("password", credential.optString("password"))
                    }
                    matchingCredentials.pushMap(credMap)
                }
            }

            Log.d(TAG, "Found ${matchingCredentials.size()} matching credentials")
            promise.resolve(matchingCredentials)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting credentials for domain", e)
            promise.reject("ERROR", "Failed to get credentials: ${e.message}", e)
        }
    }

    /**
     * Clear autofill cache
     */
    @ReactMethod
    fun clearCache(promise: Promise) {
        try {
            Log.d(TAG, "Clearing autofill cache")

            val prefs = reactContext.getSharedPreferences("autofill_data", Context.MODE_PRIVATE)
            prefs.edit().clear().apply()

            Log.d(TAG, "Cache cleared successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing cache", e)
            promise.reject("ERROR", "Failed to clear cache: ${e.message}", e)
        }
    }

    /**
     * Update autofill settings
     */
    @ReactMethod
    fun updateSettings(settingsJson: String, promise: Promise) {
        try {
            Log.d(TAG, "Updating autofill settings")

            val settings = JSONObject(settingsJson)
            val prefs = reactContext.getSharedPreferences("autofill_settings", Context.MODE_PRIVATE)
            
            prefs.edit().apply {
                putString("settings", settingsJson)
                putBoolean("enabled", settings.optBoolean("enabled", true))
                putBoolean("require_biometric", settings.optBoolean("requireBiometric", true))
                putBoolean("allow_subdomains", settings.optBoolean("allowSubdomains", true))
                putBoolean("auto_submit", settings.optBoolean("autoSubmit", false))
                apply()
            }

            Log.d(TAG, "Settings updated successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error updating settings", e)
            promise.reject("ERROR", "Failed to update settings: ${e.message}", e)
        }
    }

    /**
     * Get autofill settings
     */
    @ReactMethod
    fun getSettings(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("autofill_settings", Context.MODE_PRIVATE)
            val settingsJson = prefs.getString("settings", null)

            if (settingsJson != null) {
                val settings = JSONObject(settingsJson)
                val settingsMap = Arguments.createMap().apply {
                    putBoolean("enabled", settings.optBoolean("enabled", true))
                    putBoolean("requireBiometric", settings.optBoolean("requireBiometric", true))
                    putBoolean("allowSubdomains", settings.optBoolean("allowSubdomains", true))
                    putBoolean("autoSubmit", settings.optBoolean("autoSubmit", false))
                }
                promise.resolve(settingsMap)
            } else {
                // Return default settings
                val defaultSettings = Arguments.createMap().apply {
                    putBoolean("enabled", true)
                    putBoolean("requireBiometric", true)
                    putBoolean("allowSubdomains", true)
                    putBoolean("autoSubmit", false)
                }
                promise.resolve(defaultSettings)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting settings", e)
            promise.reject("ERROR", "Failed to get settings: ${e.message}", e)
        }
    }

    /**
     * Get autofill statistics
     */
    @ReactMethod
    fun getStatistics(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("autofill_stats", Context.MODE_PRIVATE)
            
            val stats = Arguments.createMap().apply {
                putInt("totalFills", prefs.getInt("total_fills", 0))
                putInt("totalSaves", prefs.getInt("total_saves", 0))
                putInt("blockedPhishing", prefs.getInt("blocked_phishing", 0))
                putString("lastUsed", prefs.getString("last_used", ""))
            }

            promise.resolve(stats)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting statistics", e)
            promise.reject("ERROR", "Failed to get statistics: ${e.message}", e)
        }
    }

    /**
     * Decrypt autofill password
     * Called when user clicks Login - decrypts the encrypted password using master key
     * 
     * Encrypted password format stored in autofill field:
     * {
     *   "encryptedPassword": "...",
     *   "passwordSalt": "...",
     *   "passwordIv": "...",
     *   "passwordAuthTag": "..."
     * }
     */
    @ReactMethod
    fun decryptAutofillPassword(encryptedPasswordJson: String, masterKey: String, promise: Promise) {
        try {
            Log.d(TAG, "🔓 Decrypting autofill password...")
            
            // Parse encrypted password data
            val encryptedData = JSONObject(encryptedPasswordJson)
            val ciphertext = encryptedData.optString("encryptedPassword", "")
            val salt = encryptedData.optString("passwordSalt", "")
            val iv = encryptedData.optString("passwordIv", "")
            val tag = encryptedData.optString("passwordAuthTag", "")
            
            if (ciphertext.isEmpty() || salt.isEmpty() || iv.isEmpty() || tag.isEmpty()) {
                Log.w(TAG, "⚠️ Invalid encrypted password data - missing components")
                promise.reject("INVALID_DATA", "Missing encryption components (ciphertext, salt, iv, tag)")
                return
            }
            
            Log.d(TAG, "✅ Encrypted password components extracted")
            
            // Send to React Native for decryption (it has access to master password and crypto service)
            val eventData = Arguments.createMap().apply {
                putString("encryptedPassword", ciphertext)
                putString("salt", salt)
                putString("iv", iv)
                putString("tag", tag)
                putString("masterKey", masterKey)
            }
            
            // Create listener for response
            var responseReceived = false
            var decryptedPassword = ""
            var decryptError: String? = null
            
            // Emit event to React Native
            Log.d(TAG, "📤 Sending decrypt request to React Native...")
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onDecryptAutofillPasswordRequest", eventData)
            
            // Note: In a real implementation, we'd use a callback mechanism
            // For now, we're calling this synchronously from native side
            promise.reject("NOT_IMPLEMENTED", "Decryption must be called from React Native side")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error during autofill password decryption", e)
            promise.reject("ERROR", "Failed to decrypt password: ${e.message}", e)
        }
    }

    /**
     * Record autofill usage
     */
    @ReactMethod
    fun recordUsage(type: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("autofill_stats", Context.MODE_PRIVATE)
            
            prefs.edit().apply {
                when (type) {
                    "fill" -> {
                        val count = prefs.getInt("total_fills", 0)
                        putInt("total_fills", count + 1)
                    }
                    "save" -> {
                        val count = prefs.getInt("total_saves", 0)
                        putInt("total_saves", count + 1)
                    }
                    "phishing" -> {
                        val count = prefs.getInt("blocked_phishing", 0)
                        putInt("blocked_phishing", count + 1)
                    }
                }
                putString("last_used", System.currentTimeMillis().toString())
                apply()
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error recording usage", e)
            promise.reject("ERROR", "Failed to record usage: ${e.message}", e)
        }
    }

    /**
     * Callback from React Native after decryption
     * Called by React Native when it has successfully decrypted the password
     * Passes the plaintext password back to AutofillTestActivity
     * 
     * @param plainTextPassword The decrypted plaintext password (empty if failed)
     * @param success Whether decryption was successful
     * @param errorMessage Error message if decryption failed
     */
    @ReactMethod
    fun updateAutofillDecryptResult(
        plainTextPassword: String,
        success: Boolean,
        errorMessage: String,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "📥 [AutofillBridge] Received decrypt result from React Native: success=$success")
            
            // Try to get the AutofillTestActivity from static instance first
            // This allows callback even if Activity is backgrounded
            var targetActivity: com.passwordepic.mobile.AutofillTestActivity? = 
                com.passwordepic.mobile.AutofillTestActivity.getInstance()
            
            // Fall back to current activity if static instance not available
            if (targetActivity == null) {
                val currentActivity = reactContext.currentActivity
                if (currentActivity is com.passwordepic.mobile.AutofillTestActivity) {
                    targetActivity = currentActivity
                }
            }
            
            if (success && plainTextPassword.isNotEmpty()) {
                Log.d(TAG, "✅ [AutofillBridge] Password successfully decrypted - forwarding to AutofillTestActivity")
                
                if (targetActivity != null) {
                    // Call the activity's method to update with decrypted password
                    targetActivity.updateAutofillDecryptResult(plainTextPassword, true, "")
                    Log.d(TAG, "✅ [AutofillBridge] Decrypted password forwarded to AutofillTestActivity")
                    promise.resolve(true)
                } else {
                    Log.w(TAG, "⚠️ [AutofillBridge] AutofillTestActivity not found (neither active nor in static instance)")
                    promise.resolve(false)
                }
            } else {
                Log.e(TAG, "❌ [AutofillBridge] Decryption failed: $errorMessage")
                
                if (targetActivity != null) {
                    targetActivity.updateAutofillDecryptResult("", false, errorMessage)
                    Log.d(TAG, "✅ [AutofillBridge] Error forwarded to AutofillTestActivity")
                } else {
                    Log.w(TAG, "⚠️ [AutofillBridge] Cannot forward error to AutofillTestActivity - not found")
                }
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ [AutofillBridge] Error processing decrypt result", e)
            promise.reject("ERROR", "Failed to process decrypt result: ${e.message}", e)
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Retrieve cached plaintext password from autofill cache
     * Checks expiry time and returns plaintext only if not expired
     */
    @ReactMethod
    fun getDecryptedPasswordForAutofill(passwordId: String, promise: Promise) {
        try {
            Log.d(TAG, "🔓 Retrieving cached plaintext password (ID: $passwordId)")
            
            val prefs = reactContext.getSharedPreferences("autofill_plaintext_cache", Context.MODE_PRIVATE)
            val cacheEntryJson = prefs.getString("plaintext_$passwordId", null)
            
            if (cacheEntryJson == null) {
                Log.w(TAG, "⚠️ No cached plaintext password found for: $passwordId")
                promise.resolve(null)
                return
            }
            
            try {
                val cacheEntry = JSONObject(cacheEntryJson)
                val expiryTime = cacheEntry.getLong("expiresAt")
                val currentTime = System.currentTimeMillis()
                
                if (currentTime > expiryTime) {
                    Log.w(TAG, "⏰ Cached password expired - clearing cache")
                    prefs.edit().remove("plaintext_$passwordId").apply()
                    promise.resolve(null)
                    return
                }
                
                val plaintextPassword = cacheEntry.getString("password")
                Log.d(TAG, "✅ Cached plaintext password retrieved (valid for ${(expiryTime - currentTime) / 1000}s more)")
                
                val result = Arguments.createMap().apply {
                    putString("password", plaintextPassword)
                    putDouble("expiresIn", (expiryTime - currentTime).toDouble())
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error parsing cached password entry", e)
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error retrieving cached plaintext password", e)
            promise.reject("ERROR", "Failed to retrieve cached password: ${e.message}", e)
        }
    }
    
    /**
     * Clear cached plaintext password manually
     * Called after autofill completes or for security cleanup
     */
    @ReactMethod
    fun clearDecryptedPasswordForAutofill(passwordId: String, promise: Promise) {
        try {
            Log.d(TAG, "🗑️ Clearing cached plaintext password (ID: $passwordId)")
            
            val prefs = reactContext.getSharedPreferences("autofill_plaintext_cache", Context.MODE_PRIVATE)
            prefs.edit().apply {
                remove("plaintext_$passwordId")
                remove("stored_at_$passwordId")
                apply()
            }
            
            Log.d(TAG, "✅ Cached password cleared")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error clearing cached password", e)
            promise.reject("ERROR", "Failed to clear cached password: ${e.message}", e)
        }
    }

    /**
     * Decrypt autofill password by password ID
     * Calls React Native to decrypt using master password
     * Android cannot decrypt directly as it doesn't have the master password
     */
    @ReactMethod
    fun decryptAutofillPasswordById(passwordId: String, promise: Promise) {
        try {
            Log.d(TAG, "🔐 [AutofillBridge] Requesting password decryption from React Native...")
            Log.d(TAG, "🔑 Password ID: $passwordId")
            
            // Call the autofillService module in React Native
            // This will use the master password stored in React Native to decrypt
            val autofillServiceModule = reactContext.getNativeModule("AutofillService")
            
            if (autofillServiceModule == null) {
                Log.w(TAG, "⚠️ AutofillService module not found")
                promise.reject("ERROR", "AutofillService module not available")
                return
            }
            
            // We would call the React Native method here, but React Native
            // modules need to be called from React side. For now, return error.
            promise.reject("ERROR", "Direct decrypt from native is not supported - use React Native method instead")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting decryption: ${e.message}", e)
            promise.reject("ERROR", "Failed to request decryption: ${e.message}", e)
        }
    }

    /**
     * Check if our autofill service is the enabled one
     * Verifies that PasswordEpic is specifically set as the default autofill service
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun isOurAutofillServiceEnabled(): Boolean {
        return try {
            // Try Method 1: Check Settings.Secure (works on stock Android)
            Log.d(TAG, "📋 Method 1: Checking Settings.Secure.autofill_service...")
            val enabledService = Settings.Secure.getString(
                reactContext.contentResolver,
                "autofill_service"
            )
            
            Log.d(TAG, "   Raw value: '$enabledService'")
            
            if (enabledService != null && enabledService.isNotEmpty()) {
                val isOurService = enabledService.contains("com.passwordepic.mobile")
                Log.d(TAG, "✅ Settings.Secure found: '$enabledService' -> IsOurs: $isOurService")
                if (isOurService) return true
            } else {
                Log.d(TAG, "⚠️ Settings.Secure.autofill_service is null/empty (Huawei doesn't populate this)")
            }
            
            // Try Method 2: Use AutofillManager API (Android Q+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, "📋 Method 2: Checking AutofillManager.getAutofillServiceComponentName() (API 26+)...")
                try {
                    val autofillManager = reactContext.getSystemService(AutofillManager::class.java)
                    if (autofillManager != null) {
                        val currentService = autofillManager.getAutofillServiceComponentName()
                        
                        if (currentService != null) {
                            val serviceName = "${currentService.packageName}/${currentService.className}"
                            Log.d(TAG, "   Found enabled service: $serviceName")
                            
                            if (currentService.packageName == "com.passwordepic.mobile") {
                                Log.d(TAG, "✅ AutofillManager check: IsOurs: true")
                                return true
                            }
                        } else {
                            Log.d(TAG, "   No autofill service is currently enabled")
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ AutofillManager.getAutofillServiceComponentName() failed: ${e.message}")
                }
            }
            
            // Try Method 3: Check system property via reflection (fallback for Huawei)
            Log.d(TAG, "📋 Method 3: Checking via reflection fallback...")
            try {
                val settingsClass = Class.forName("android.provider.Settings\$Secure")
                val getStringMethod = settingsClass.getMethod(
                    "getString",
                    android.content.ContentResolver::class.java,
                    String::class.java
                )
                val result = getStringMethod.invoke(null, reactContext.contentResolver, "autofill_service")
                if (result != null && result.toString().isNotEmpty()) {
                    val isOurService = result.toString().contains("com.passwordepic.mobile")
                    Log.d(TAG, "✅ Reflection check: '$result' -> IsOurs: $isOurService")
                    if (isOurService) return true
                }
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Reflection check failed: ${e.message}")
            }
            
            Log.d(TAG, "❌ All checks failed - autofill service not detected")
            false
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking autofill service status: ${e.message}", e)
            false
        }
    }

    /**
     * Check if two domains match
     */
    private fun domainsMatch(domain1: String, domain2: String): Boolean {
        val normalized1 = normalizeDomain(domain1)
        val normalized2 = normalizeDomain(domain2)
        
        return normalized1 == normalized2 || 
               normalized1.endsWith(".$normalized2") || 
               normalized2.endsWith(".$normalized1")
    }

    /**
     * 🔐 Cache decrypted plaintext password for autofill
     * Called by React Native after successful decryption
     * 
     * @param credentialId The credential ID
     * @param plaintextPassword The decrypted plaintext password
     * @param promise Resolution promise
     */
    @ReactMethod
    fun storeDecryptedPasswordForAutofill(
        credentialId: String,
        plaintextPassword: String,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "🔐 Storing decrypted password for autofill (ID: $credentialId)")
            
            val dataProvider = AutofillDataProvider(reactContext)
            val success = dataProvider.cacheDecryptedPasswordForAutofill(
                credentialId,
                plaintextPassword
            )
            
            if (success) {
                Log.d(TAG, "✅ Password cached successfully for autofill")
                promise.resolve(true)
            } else {
                Log.w(TAG, "⚠️ Failed to cache password (context unavailable?)")
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error storing decrypted password", e)
            promise.reject("ERROR", "Failed to store password: ${e.message}", e)
        }
    }

    /**
     * 📡 Emit autofill decryption request to React Native
     * This is called by AutofillDecryptionReceiver when auth succeeds
     * 
     * @param credentialId The credential ID
     * @param encryptedPassword The encrypted password
     * @param iv The initialization vector
     * @param tag The authentication tag
     * @param salt The salt for PBKDF2
     * @param username The username
     * @param domain The domain
     */
    fun emitDecryptionRequest(
        credentialId: String,
        encryptedPassword: String,
        iv: String,
        tag: String,
        salt: String,
        username: String,
        domain: String
    ) {
        try {
            Log.d(TAG, "📤 Emitting decryption request to React Native...")
            
            val eventData = Arguments.createMap().apply {
                putString("credentialId", credentialId)
                putString("encryptedPassword", encryptedPassword)
                putString("iv", iv)
                putString("tag", tag)
                putString("salt", salt)
                putString("username", username)
                putString("domain", domain)
            }
            
            sendEvent("onAutofillDecryptRequest", eventData)
            Log.d(TAG, "✅ Decryption request emitted to React Native")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error emitting decryption request", e)
        }
    }

    /**
     * Normalize domain for comparison
     */
    private fun normalizeDomain(domain: String): String {
        return domain.lowercase()
            .removePrefix("http://")
            .removePrefix("https://")
            .removePrefix("www.")
            .split("/")[0]
            .split(":")[0]
    }

    /**
     * Send event to React Native
     */
    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event: $eventName", e)
        }
    }

    /**
     * Check if accessibility service is supported on this device
     */
    @ReactMethod
    fun isAccessibilitySupported(promise: Promise) {
        try {
            val isSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN
            Log.d(TAG, "Accessibility supported: $isSupported (API ${Build.VERSION.SDK_INT})")
            promise.resolve(isSupported)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility support", e)
            promise.reject("ERROR", "Failed to check accessibility support: ${e.message}", e)
        }
    }

    /**
     * Check if PasswordEpic accessibility service is enabled
     */
    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        try {
            val packageName = "com.passwordepic.mobile"
            val serviceClassName = "$packageName.services.PasswordEpicAccessibilityService"
            
            val accessibilityManager = reactContext.getSystemService(android.view.accessibility.AccessibilityManager::class.java)
            if (accessibilityManager == null) {
                Log.w(TAG, "AccessibilityManager not available")
                promise.resolve(false)
                return
            }

            val enabledServices = android.provider.Settings.Secure.getString(
                reactContext.contentResolver,
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""

            val isEnabled = enabledServices.contains(packageName)
            Log.d(TAG, "Accessibility enabled: $isEnabled, Services: $enabledServices")
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility status", e)
            promise.reject("ERROR", "Failed to check accessibility status: ${e.message}", e)
        }
    }

    /**
     * Request to enable accessibility service
     */
    @ReactMethod
    fun requestEnableAccessibility(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Activity not available")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val manufacturer = Build.MANUFACTURER.uppercase()
            Log.d(TAG, "📱 Device manufacturer: $manufacturer")

            // Try OEM-specific paths first
            if (tryOEMSpecificAccessibilitySettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific accessibility settings")
                promise.resolve(true)
                return
            }

            // Fallback: Open accessibility settings directly
            try {
                val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
                Log.d(TAG, "📱 Opening accessibility settings via ACTION_ACCESSIBILITY_SETTINGS")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened accessibility settings")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open accessibility settings: ${e.message}")
            }

            // Last fallback: Open general settings
            try {
                val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
                Log.d(TAG, "📱 Opening general Settings")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened general Settings")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.e(TAG, "❌ All attempts to open accessibility settings failed")
                promise.reject("ERROR", "Failed to open accessibility settings. Please enable manually in System Settings.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting accessibility enable", e)
            promise.reject("ERROR", "Failed to request accessibility enable: ${e.message}", e)
        }
    }

    /**
     * Disable accessibility service
     */
    @ReactMethod
    fun disableAccessibility(promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Activity not available")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val manufacturer = Build.MANUFACTURER.uppercase()
            Log.d(TAG, "📱 Device manufacturer: $manufacturer")

            val instructions = getOEMDisableAccessibilityInstructions(manufacturer)
            Log.d(TAG, "✅ Returning disable accessibility data with OEM-specific instructions")

            val result = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("instructions", instructions)
                putString("action", "openAccessibilitySettings")
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error disabling accessibility", e)
            promise.reject("ERROR", "Failed to disable accessibility: ${e.message}", e)
        }
    }

    /**
     * Open accessibility settings now
     */
    @ReactMethod
    fun openAccessibilitySettingsNow(promise: Promise) {
        try {
            Log.d(TAG, "📱 openAccessibilitySettingsNow called - opening settings intent")

            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Activity not available")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val manufacturer = Build.MANUFACTURER.uppercase()
            Log.d(TAG, "📱 Device manufacturer: $manufacturer")

            // Try OEM-specific paths first
            if (tryOEMSpecificAccessibilitySettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific accessibility settings")
                promise.resolve(true)
                return
            }

            // Try official accessibility settings action
            try {
                val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
                Log.d(TAG, "📱 Opening accessibility settings via ACTION_ACCESSIBILITY_SETTINGS")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened accessibility settings")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open accessibility settings: ${e.message}")
            }

            // Last fallback: Open general settings
            try {
                val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
                Log.d(TAG, "📱 Opening general Settings")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened general Settings")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to open settings: ${e.message}")
                promise.reject("ERROR", "Failed to open accessibility settings")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error opening accessibility settings", e)
            promise.reject("ERROR", "Failed to open accessibility settings: ${e.message}", e)
        }
    }

    /**
     * Try to open accessibility settings using OEM-specific deep links
     */
    private fun tryOEMSpecificAccessibilitySettings(activity: Activity, manufacturer: String): Boolean {
        val intentsList = when {
            manufacturer.contains("SAMSUNG") -> listOf(
                Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings")
                },
                Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.Settings\$AccessibilitySettingsActivity")
                }
            )
            manufacturer.contains("HUAWEI") -> listOf(
                Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings")
                }
            )
            else -> listOf(
                Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings")
                }
            )
        }

        for ((index, intent) in intentsList.withIndex()) {
            try {
                Log.d(TAG, "📱 OEM Accessibility Attempt ${index + 1} ($manufacturer): ${intent.action ?: intent.component}")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Successfully opened accessibility settings via OEM-specific path")
                return true
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ OEM Accessibility Attempt ${index + 1} failed: ${e.message}")
            }
        }

        return false
    }

    /**
     * Get OEM-specific instructions for disabling accessibility
     */
    private fun getOEMDisableAccessibilityInstructions(manufacturer: String): String {
        return when {
            manufacturer.contains("SAMSUNG") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Toggle it OFF to disable"

            manufacturer.contains("HUAWEI") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Toggle it OFF to disable"

            else ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility' or 'Accessibility Services'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Toggle it OFF or uninstall to disable"
        }
    }

    /**
     * Get constants for React Native
     */
    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "EVENT_AUTOFILL_REQUEST" to EVENT_AUTOFILL_REQUEST,
            "EVENT_AUTOFILL_SAVE" to EVENT_AUTOFILL_SAVE,
            "EVENT_AUTOFILL_ERROR" to EVENT_AUTOFILL_ERROR,
            "MIN_API_LEVEL" to Build.VERSION_CODES.O
        )
    }

    private fun openAutofillSettings(context: Context) {
        val manufacturer = Build.MANUFACTURER.uppercase()
        
        Log.d(TAG, "📱 Discovering available autofill-related activities...")
        val packageManager = context.packageManager
        discoverAndLogAvailableActivities(packageManager)
        
        Log.d(TAG, "⚠️ Standard autofill paths not working on this device")
        
        /* COMMENTED OUT - Opens general Settings, not autofill
        try {
            val intent = Intent(Intent.ACTION_SEARCH).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra("query", "autofill")
                setPackage("com.android.settings")
            }
            Log.d(TAG, "📱 Attempt: Search for 'autofill' in Settings")
            context.startActivity(intent)
            Thread.sleep(500)
            Log.d(TAG, "✅ Opened Settings search for 'autofill'")
            return
        } catch (e: Exception) {
            Log.d(TAG, "⚠️ Search attempt failed: ${e.javaClass.simpleName}")
        }
        */
        
        if (manufacturer.contains("HUAWEI")) {
            Log.d(TAG, "📱 Huawei: Trying alternative paths...")
            
            /* COMMENTED OUT - Opens general Settings
            try {
                val intent = Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    putExtra(":settings:show_fragment_args", android.os.Bundle().apply {
                        putString("query", "autofill")
                    })
                }
                Log.d(TAG, "📱 Attempt: HWSettings with search fragment")
                context.startActivity(intent)
                Thread.sleep(500)
                Log.d(TAG, "✅ Opened HWSettings")
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ HWSettings with fragment failed: ${e.javaClass.simpleName}")
            }
            */
            
            /* COMMENTED OUT - These paths don't lead to autofill settings
            val huaweiPaths = listOf(
                Pair("com.android.settings.Settings\$InputMethodAndLanguageSettings", "InputMethodAndLanguageSettings"),
                Pair("com.android.settings.Settings\$LanguageAndInputSettings", "LanguageAndInputSettings"),
                Pair("com.android.settings.Settings\$AccessibilitySettings", "AccessibilitySettings (check if autofill is there)"),
                Pair("com.android.settings.Settings\$SecuritySettings", "SecuritySettings"),
                Pair("com.android.settings.applications.DefaultAppSettings", "DefaultAppSettings")
            )
            
            for ((className, label) in huaweiPaths) {
                try {
                    val intent = Intent().apply {
                        setClassName("com.android.settings", className)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    Log.d(TAG, "📱 Attempt: $label")
                    context.startActivity(intent)
                    Thread.sleep(500)
                    Log.d(TAG, "✅ Opened $label")
                    return
                } catch (e: Exception) {
                    Log.d(TAG, "⚠️ $label failed: ${e.javaClass.simpleName}")
                }
            }
            */
        }
        
        Log.d(TAG, "📱 Final fallback: Open general Settings")
        openLanguageAndInputSettings(context)
    }
    
    private fun discoverAndLogAvailableActivities(packageManager: android.content.pm.PackageManager) {
        try {
            Log.d(TAG, "🔍 Discovering ALL settings activities...")
            val intent = Intent(Intent.ACTION_MAIN)
            intent.addCategory(Intent.CATEGORY_LAUNCHER)
            intent.setPackage("com.android.settings")
            
            val activities = packageManager.queryIntentActivities(intent, android.content.pm.PackageManager.MATCH_ALL)
            Log.d(TAG, "   Total activities found: ${activities.size}")
            
            for ((index, resolveInfo) in activities.withIndex()) {
                val className = resolveInfo.activityInfo.name
                Log.d(TAG, "   [$index] $className")
                
                if (index >= 20) {
                    Log.d(TAG, "   ... and more (showing first 20)")
                    break
                }
            }
        } catch (e: Exception) {
            Log.d(TAG, "⚠️ Discovery failed: ${e.message}")
        }
    }

    private fun openLanguageAndInputSettings(context: Context) {
        Log.d(TAG, "📱 Attempting Huawei autofill settings navigation - systematic path testing")
        
        val huaweiPaths = listOf(
            // ❌ TESTED: Opens general Settings, fragment ignored, NOT autofill settings
            Triple("Strategy 1: Fragment InputMethodAndLanguageSettings", 
                { Intent(Settings.ACTION_SETTINGS).apply {
                    putExtra(":settings:show_fragment", "com.android.settings.inputmethod.InputMethodAndLanguageSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, fragment ignored"),
            
            // ❌ TESTED: HWSettings + show_fragment - opens general Settings, NOT autofill
            Triple("Strategy 2: HWSettings with show_fragment", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra(":settings:show_fragment", "com.android.settings.inputmethod.InputMethodAndLanguageSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, extra ignored"),
            
            // ❌ TESTED: HWSettings + show_fragment_args - opens general Settings, NOT autofill
            Triple("Strategy 3: HWSettings with show_fragment_args", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra(":settings:show_fragment", "com.android.settings.inputmethod.InputMethodAndLanguageSettings")
                    putExtra(":settings:show_fragment_args", android.os.Bundle())
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, extras ignored"),
            
            // ❌ TESTED: HWSettings + 'screen' extra - opens general Settings, NOT autofill
            Triple("Strategy 4: HWSettings with 'screen' extra", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra("screen", "com.android.settings.inputmethod.InputMethodAndLanguageSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, 'screen' extra not recognized"),
            
            // ❌ TESTED: HWSettings + 'page' extra - opens general Settings, NOT autofill
            Triple("Strategy 5: HWSettings with 'page' extra", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra("page", "InputMethodAndLanguageSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, 'page' extra not recognized"),
            
            // ❌ TESTED: HWSettings + 'target' extra - opens general Settings, NOT autofill
            Triple("Strategy 6: HWSettings with 'target' extra", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra("target", "com.android.settings.inputmethod.InputMethodAndLanguageSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, 'target' extra not recognized"),
            
            // ❌ TESTED: HWSettings via ACTION_MAIN - opens general Settings, NOT autofill
            Triple("Strategy 7: HWSettings via ACTION_MAIN", 
                { Intent(Intent.ACTION_MAIN).apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings via ACTION_MAIN"),
            
            // ❌ NOT AVAILABLE: ACTION_REQUEST_SET_AUTOFILL_SERVICE throws exception on Huawei
            Triple("Strategy 8: Direct autofill action", 
                { Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ UNAVAILABLE: ActivityNotFoundException (not supported)"),
            
            // ❌ TESTED: HWSettings + query extra - opens general Settings, NOT autofill
            Triple("Strategy 9: HWSettings with query extra", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra("query", "autofill")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, search extra ignored"),
            
            // ❌ TESTED: HWSettings + keyword extra - opens general Settings, NOT autofill
            Triple("Strategy 10: HWSettings with keyword extra", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra("keyword", "autofill")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, keyword extra not recognized"),
            
            // ❌ TESTED: HWSettings + short fragment name - opens general Settings, NOT autofill
            Triple("Strategy 11: HWSettings fragment with short name", 
                { Intent().apply {
                    setClassName("com.android.settings", "com.android.settings.HWSettings")
                    putExtra(":settings:show_fragment", "InputMethodAndLanguageSettings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ TESTED FAILED: Opens general Settings, short fragment name doesn't work"),
            
            // ❌ NOT AVAILABLE: Intent.ACTION_SEARCH throws SecurityException on Huawei
            Triple("Strategy 12: Settings search for 'autofill'", 
                { Intent(Intent.ACTION_SEARCH).apply {
                    putExtra("query", "autofill")
                    setPackage("com.android.settings")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                } }, 
                "❌ UNAVAILABLE: SecurityException (permission denied)"),
            
            // ❌ NOT AVAILABLE: AUTOFILL_SETTINGS action throws exception on Huawei
            Triple("Strategy 13: AUTOFILL_SETTINGS action", 
                { Intent("android.settings.AUTOFILL_SETTINGS").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "❌ UNAVAILABLE: ActivityNotFoundException (action not supported)"),
            
            // ✅ WORKS: General Settings always opens, but requires manual navigation
            Triple("Strategy 14: General Settings (fallback)", 
                { Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                } }, 
                "✅ WORKS: Opens Settings app (user must navigate manually)")
        )
        
        val results = mutableListOf<Pair<Int, String>>() // Track which strategies succeed in launching
        
        for ((index, pathInfo) in huaweiPaths.withIndex()) {
            val (strategyName, intentCreator, description) = pathInfo
            
            try {
                Log.d(TAG, "📱 Attempt ${index + 1}/${huaweiPaths.size}: $strategyName")
                Log.d(TAG, "   └─ Description: $description")
                
                val intent = intentCreator()
                context.startActivity(intent)
                Thread.sleep(300)
                
                Log.d(TAG, "✅ Attempt ${index + 1} LAUNCHED successfully (no exception thrown)")
                results.add(Pair(index + 1, strategyName))
            } catch (e: ActivityNotFoundException) {
                Log.d(TAG, "❌ Attempt ${index + 1} FAILED (ActivityNotFoundException)")
            } catch (e: SecurityException) {
                Log.d(TAG, "❌ Attempt ${index + 1} FAILED (SecurityException)")
            } catch (e: Exception) {
                Log.d(TAG, "❌ Attempt ${index + 1} FAILED (${e.javaClass.simpleName}): ${e.message}")
            }
        }
        
        Log.e(TAG, "════════════════════════════════════════════════════════════════")
        Log.e(TAG, "🔍 HUAWEI AUTOFILL SETTINGS - TEST RESULTS SUMMARY")
        Log.e(TAG, "════════════════════════════════════════════════════════════════")
        
        if (results.isEmpty()) {
            Log.e(TAG, "❌ NO strategies succeeded - all threw exceptions")
            Log.e(TAG, "💡 Huawei may have completely blocked programmatic access")
        } else {
            Log.e(TAG, "✅ ${results.size} strategy(ies) launched successfully (without exceptions):")
            for ((attemptNum, strategyName) in results) {
                Log.e(TAG, "   └─ Strategy $attemptNum: $strategyName")
            }
            Log.e(TAG, "")
            Log.e(TAG, "📌 CHECK WHICH STRATEGY OPENED THE CORRECT SCREEN:")
            Log.e(TAG, "   • Look at the device screen right now")
            Log.e(TAG, "   • If it shows: Settings > System > Languages & input > Autofill")
            Log.e(TAG, "   • Then that strategy WORKS - update code to mark it TESTED:WORKS")
            Log.e(TAG, "   • If it shows general Settings - that strategy FAILED")
            Log.e(TAG, "   • Continue testing other strategies")
        }
        Log.e(TAG, "════════════════════════════════════════════════════════════════")
    }
}