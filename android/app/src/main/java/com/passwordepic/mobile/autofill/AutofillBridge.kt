package com.passwordepic.mobile.autofill

import android.app.Activity
import android.content.ActivityNotFoundException
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

            // Try 1: Official Android API (preferred method - Android 8.0+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                    Log.d(TAG, "📱 Attempt 1: Opening autofill service settings via official API")
                    activity.startActivity(intent)
                    Log.d(TAG, "✅ Opened autofill settings via official API")
                    promise.resolve(true)
                    return
                } catch (e: ActivityNotFoundException) {
                    Log.d(TAG, "⚠️ Official API not supported on this device, trying OEM-specific paths...")
                } catch (e: Exception) {
                    Log.d(TAG, "⚠️ Error with official API: ${e.message}, trying OEM-specific paths...")
                }
            }

            // Try 2: OEM-specific paths
            if (tryOEMSpecificAutofillSettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific autofill settings")
                promise.resolve(true)
                return
            }

            // Fallback 1: Open Settings with default category
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
                }
                Log.d(TAG, "📱 Attempt 3: Opening Settings app")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened Settings - Navigate to: Settings → System → Languages & input → More input settings → Autofill (or similar path)")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open Settings: ${e.message}")
            }

            // Fallback 2: Try opening app settings for PasswordEpic
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, "com.passwordepic.mobile")
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
                "1. Go to Settings\n" +
                "2. Tap 'System' or 'Advanced'\n" +
                "3. Tap 'Languages & input'\n" +
                "4. Tap 'More input settings' or 'Advanced'\n" +
                "5. Tap 'Autofill service'\n" +
                "6. Select 'None' to disable PasswordEpic"
            
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

            // Try 1: Official Android API (preferred method - Android 8.0+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                    Log.d(TAG, "📱 Attempt 1: Opening autofill service settings via official API")
                    activity.startActivity(intent)
                    Log.d(TAG, "✅ Opened autofill settings via official API")
                    promise.resolve(true)
                    return
                } catch (e: ActivityNotFoundException) {
                    Log.d(TAG, "⚠️ Official API not supported on this device, trying OEM-specific paths...")
                } catch (e: Exception) {
                    Log.d(TAG, "⚠️ Error with official API: ${e.message}, trying OEM-specific paths...")
                }
            }

            // Try 2: OEM-specific paths
            if (tryOEMSpecificAutofillSettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific autofill settings")
                promise.resolve(true)
                return
            }

            // Fallback 1: Open Settings with default category
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
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
     * Try to open autofill settings using OEM-specific deep links
     * Different manufacturers have different paths to autofill settings
     */
    private fun tryOEMSpecificAutofillSettings(activity: Activity, manufacturer: String): Boolean {
        val intentsList = when {
            // Huawei devices: Settings → System → Languages & input → More input settings → Autofill
            // Use the direct autofill activity class instead of INPUT_METHOD_SETTINGS
            manufacturer.contains("HUAWEI") -> listOf(
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                Intent("android.settings.AUTOFILL_SETTINGS"),
                Intent("android.settings.INPUT_METHOD_SETTINGS"),
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$InputMethodAndLanguageSettings")
            )
            // Samsung devices: Settings → Apps → Default apps → Autofill service
            manufacturer.contains("SAMSUNG") -> listOf(
                Intent().setClassName("com.android.settings", "com.android.settings.applications.autofill.AutofillPickerTrampolineActivity"),
                Intent("android.settings.DEFAULT_INPUT_METHOD"),
                Intent("android.settings.AUTOFILL_SETTINGS"),
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$InputMethodAndLanguageSettings")
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
            try {
                Log.d(TAG, "📱 OEM Attempt ${index + 1} ($manufacturer): ${intent.action ?: intent.component}")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Successfully opened autofill settings via OEM-specific path")
                return true
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ OEM Attempt ${index + 1} failed: ${e.message}")
            }
        }

        return false
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
            // Check what autofill service is currently enabled in system settings
            val enabledService = Settings.Secure.getString(
                reactContext.contentResolver,
                "autofill_service"  // Android O+ autofill service setting
            )
            
            // If no service is enabled, return false
            if (enabledService == null) {
                Log.d(TAG, "No autofill service enabled")
                return false
            }
            
            // Check if our package is the enabled autofill service
            // Expected format: "com.passwordepic.mobile/com.passwordepic.mobile.autofill.PasswordEpicAutofillService"
            val isOurService = enabledService.contains("com.passwordepic.mobile")
            
            Log.d(TAG, "Autofill service check - Enabled: $enabledService, IsOurs: $isOurService")
            isOurService
        } catch (e: Exception) {
            Log.e(TAG, "Error checking our autofill service status: ${e.message}", e)
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
            
            sendEvent("AUTOFILL_DECRYPT_REQUEST", eventData)
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
}