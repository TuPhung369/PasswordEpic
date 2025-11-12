package com.passwordepic.mobile.autofill

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityManager
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

/**
 * AccessibilityBridge Native Module
 *
 * React Native bridge for Android Accessibility Service functionality.
 * Provides communication between React Native app and native accessibility service.
 *
 * Features:
 * - Check accessibility service support
 * - Check if PasswordEpic accessibility is enabled
 * - Request accessibility service enablement
 * - Disable accessibility service
 * - Open accessibility settings
 * - Get OEM-specific instructions
 *
 * @author PasswordEpic Team
 * @since Week 9 - Phase 4
 */
class AccessibilityBridge(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AccessibilityBridge"
        private const val MODULE_NAME = "AccessibilityBridge"
        
        // Package name for PasswordEpic accessibility service
        private const val ACCESSIBILITY_SERVICE_PACKAGE = "com.passwordepic.mobile"
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Check if accessibility is supported on this device
     * Accessibility is supported on all Android versions
     */
    @ReactMethod
    fun isAccessibilitySupported(promise: Promise) {
        try {
            // Accessibility is supported on all Android versions
            val isSupported = true
            Log.d(TAG, "✅ Accessibility supported: $isSupported (API ${Build.VERSION.SDK_INT})")
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
            val isEnabled = isOurAccessibilityServiceEnabled()
            Log.d(TAG, "✅ Accessibility enabled: $isEnabled (our service: com.passwordepic.mobile)")
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility status", e)
            promise.reject("ERROR", "Failed to check accessibility status: ${e.message}", e)
        }
    }

    /**
     * Check if our accessibility service is currently enabled
     */
    private fun isOurAccessibilityServiceEnabled(): Boolean {
        try {
            val accessibilityManager = reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            if (accessibilityManager == null) {
                Log.w(TAG, "⚠️ AccessibilityManager not available")
                return false
            }

            // Get list of all enabled accessibility services
            val enabledServices = Settings.Secure.getString(
                reactContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )

            if (enabledServices.isNullOrEmpty()) {
                Log.d(TAG, "No accessibility services are enabled")
                return false
            }

            // Check if PasswordEpic accessibility service is in the list
            val isEnabled = enabledServices.contains("com.passwordepic.mobile") || 
                           enabledServices.contains("com.passwordepic.mobile.accessibility.PasswordEpicAccessibilityService")
            
            Log.d(TAG, "Enabled accessibility services: $enabledServices")
            Log.d(TAG, "✅ PasswordEpic accessibility enabled: $isEnabled")
            
            return isEnabled
        } catch (e: Exception) {
            Log.e(TAG, "Error checking if our service is enabled", e)
            return false
        }
    }

    /**
     * Request to enable accessibility service
     * Opens system settings for user to enable the service
     * Tries multiple approaches including OEM-specific paths for compatibility
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

            // Try 1: OEM-specific paths (most reliable for different vendors)
            if (tryOEMSpecificAccessibilitySettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific accessibility settings")
                promise.resolve(true)
                return
            }

            // Try 2: Open Accessibility settings using standard intent
            try {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                Log.d(TAG, "📱 Attempt 2: Opening accessibility settings via standard intent")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened accessibility settings")
                promise.resolve(true)
                return
            } catch (e: ActivityNotFoundException) {
                Log.d(TAG, "⚠️ Standard accessibility settings not supported, trying generic settings...")
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Error opening accessibility settings: ${e.message}")
            }

            // Fallback: Open Settings with default category
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addCategory(Intent.CATEGORY_DEFAULT)
                }
                Log.d(TAG, "📱 Attempt 3: Opening Settings app")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened Settings - User will navigate to: Accessibility → Downloaded apps → PasswordEpic Autofill Refill")
                promise.resolve(true)
                return
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Failed to open Settings: ${e.message}")
            }

            // If all attempts fail
            Log.e(TAG, "❌ All attempts to open accessibility settings failed")
            promise.reject("ERROR", "Failed to open accessibility settings. Please enable manually in System Settings → Accessibility.")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting accessibility enable", e)
            promise.reject("ERROR", "Failed to request accessibility enable: ${e.message}", e)
        }
    }

    /**
     * Get OEM-specific instructions for disabling accessibility
     * Returns user-friendly guide for the specific device manufacturer
     */
    private fun getOEMDisableInstructions(manufacturer: String): String {
        return when {
            manufacturer.contains("HUAWEI") -> 
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
            
            manufacturer.contains("SAMSUNG") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
            
            manufacturer.contains("XIAOMI") || manufacturer.contains("REDMI") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
            
            manufacturer.contains("OPPO") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
            
            manufacturer.contains("ONEPLUS") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
            
            manufacturer.contains("GOOGLE") || manufacturer.contains("ANDROID") ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
            
            else ->
                "1. Go to Settings\n" +
                "2. Tap 'Accessibility'\n" +
                "3. Find 'PasswordEpic' in the list\n" +
                "4. Tap 'PasswordEpic' to toggle it OFF"
        }
    }

    /**
     * Disable accessibility service
     * Opens system settings for user to disable the service
     * Tries device-specific paths for different manufacturers
     * Returns OEM-specific instructions for user guidance
     * Note: We can't programmatically disable - user must do it through settings
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
            
            // Get OEM-specific instructions for this device
            val instructions = getOEMDisableInstructions(manufacturer)

            // IMPORTANT: Return data without opening intent yet
            // Intent will be opened by JavaScript AFTER showing the Alert dialog
            // This ensures the Alert is visible before app goes to background
            
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
     * Actually open accessibility settings after user confirms
     * This is called AFTER the Alert dialog is shown to the user
     * So the app stays in foreground until user sees the instructions
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

            // Try 1: Standard Accessibility settings action (preferred method)
            try {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                Log.d(TAG, "📱 Attempt 1: Opening accessibility settings via standard action")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Opened accessibility settings")
                promise.resolve(true)
                return
            } catch (e: ActivityNotFoundException) {
                Log.d(TAG, "⚠️ Standard action not supported, trying OEM-specific paths...")
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ Error with standard action: ${e.message}, trying OEM-specific paths...")
            }

            // Try 2: OEM-specific paths
            if (tryOEMSpecificAccessibilitySettings(activity, manufacturer)) {
                Log.d(TAG, "✅ Opened OEM-specific accessibility settings")
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

            // If all attempts fail
            Log.e(TAG, "❌ All attempts to open accessibility settings failed")
            promise.resolve(false)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error opening accessibility settings", e)
            promise.reject("ERROR", "Failed to open accessibility settings: ${e.message}", e)
        }
    }

    /**
     * Try to open accessibility settings using OEM-specific deep links
     * Different manufacturers have different paths to accessibility settings
     * Attempts to open directly to the app list / installed apps section
     */
    private fun tryOEMSpecificAccessibilitySettings(activity: Activity, manufacturer: String): Boolean {
        val intentsList = when {
            manufacturer.contains("SAMSUNG") -> listOf(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.samsung.android.settings", "com.samsung.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.Settings\$AccessibilitySettingsActivity"),
                Intent(Settings.ACTION_SETTINGS)
            )
            
            manufacturer.contains("HUAWEI") -> listOf(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.huawei.settings", "com.huawei.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.AccessibilitySettings"),
                Intent(Settings.ACTION_SETTINGS)
            )
            
            manufacturer.contains("XIAOMI") || manufacturer.contains("REDMI") -> listOf(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.AccessibilitySettings"),
                Intent(Settings.ACTION_SETTINGS)
            )
            
            manufacturer.contains("OPPO") -> listOf(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.coloros.settings", "com.coloros.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.AccessibilitySettings"),
                Intent(Settings.ACTION_SETTINGS)
            )
            
            manufacturer.contains("ONEPLUS") -> listOf(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.oneplus.settings", "com.oneplus.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.AccessibilitySettings"),
                Intent(Settings.ACTION_SETTINGS)
            )
            
            else -> listOf(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS),
                Intent().setClassName("com.android.settings", "com.android.settings.accessibility.AccessibilitySettings"),
                Intent().setClassName("com.android.settings", "com.android.settings.AccessibilitySettings"),
                Intent(Settings.ACTION_SETTINGS)
            )
        }

        for ((index, intent) in intentsList.withIndex()) {
            try {
                Log.d(TAG, "📱 OEM Attempt ${index + 1} ($manufacturer): ${intent.action ?: intent.component}")
                activity.startActivity(intent)
                Log.d(TAG, "✅ Successfully opened accessibility settings via OEM-specific path")
                return true
            } catch (e: Exception) {
                Log.d(TAG, "⚠️ OEM Attempt ${index + 1} failed: ${e.message}")
            }
        }

        return false
    }
}
