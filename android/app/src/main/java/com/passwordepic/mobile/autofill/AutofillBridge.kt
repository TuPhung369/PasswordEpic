package com.passwordepic.mobile.autofill

import android.app.Activity
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
            promise.resolve(isEnabled && isOurService)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking autofill status", e)
            promise.reject("ERROR", "Failed to check autofill status: ${e.message}", e)
        }
    }

    /**
     * Request to enable autofill service
     * Opens system settings for user to enable the service
     */
    @ReactMethod
    fun requestEnableAutofill(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.reject("UNSUPPORTED", "Autofill not supported on this device")
                return
            }

            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity not available")
                return
            }

            // Open autofill settings
            val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
            intent.data = android.net.Uri.parse("package:${reactContext.packageName}")
            
            activity.startActivity(intent)
            
            Log.d(TAG, "Opened autofill settings")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting autofill enable", e)
            promise.reject("ERROR", "Failed to request autofill enable: ${e.message}", e)
        }
    }

    /**
     * Disable autofill service
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
                promise.reject("ERROR", "AutofillManager not available")
                return
            }

            // Note: We can't programmatically disable autofill service
            // User must do it through settings
            // We can only guide them to settings
            val activity = reactContext.currentActivity
            if (activity != null) {
                val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                activity.startActivity(intent)
            }

            Log.d(TAG, "Opened settings to disable autofill")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error disabling autofill", e)
            promise.reject("ERROR", "Failed to disable autofill: ${e.message}", e)
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

    // ==================== Helper Methods ====================

    /**
     * Check if our autofill service is the enabled one
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun isOurAutofillServiceEnabled(): Boolean {
        return try {
            val autofillManager = reactContext.getSystemService(AutofillManager::class.java)
            if (autofillManager == null) {
                false
            } else {
                // Check if our service is enabled
                // Note: This is a simplified check
                autofillManager.hasEnabledAutofillServices()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking our service status", e)
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