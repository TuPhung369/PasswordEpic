package com.passwordepic.mobile

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * LaunchTestActivityModule - Launch AutofillTestActivity from React Native
 */
class LaunchTestActivityModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LaunchTestActivity"
    }

    override fun getName(): String = "LaunchTestActivity"

    /**
     * Launch the autofill test activity with theme data
     * Accepts a theme object with color values that will be applied to the native UI
     */
    @ReactMethod
    fun launchAutofillTestWithTheme(themeData: ReadableMap?, promise: Promise) {
        try {
            Log.d(TAG, "🚀 Launching AutofillTestActivity with theme...")
            
            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Current activity is null")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val intent = Intent(activity, AutofillTestActivity::class.java)
            
            // Pass theme data as extras if provided
            if (themeData != null) {
                Log.d(TAG, "🎨 Adding theme data to intent extras")
                intent.putExtra("theme_background", themeData.getString("background") ?: "#000000")
                intent.putExtra("theme_surface", themeData.getString("surface") ?: "#1C1C1E")
                intent.putExtra("theme_primary", themeData.getString("primary") ?: "#007AFF")
                intent.putExtra("theme_secondary", themeData.getString("secondary") ?: "#5856D6")
                intent.putExtra("theme_text", themeData.getString("text") ?: "#FFFFFF")
                intent.putExtra("theme_textSecondary", themeData.getString("textSecondary") ?: "#8E8E93")
                intent.putExtra("theme_border", themeData.getString("border") ?: "#38383A")
                intent.putExtra("theme_card", themeData.getString("card") ?: "#1C1C1E")
                intent.putExtra("theme_error", themeData.getString("error") ?: "#FF453A")
                intent.putExtra("theme_success", themeData.getString("success") ?: "#30D158")
                intent.putExtra("theme_warning", themeData.getString("warning") ?: "#FF9F0A")
                intent.putExtra("theme_isDarkMode", themeData.getBoolean("isDarkMode"))
            }
            
            activity.startActivity(intent)
            
            Log.d(TAG, "✅ AutofillTestActivity launched successfully with theme")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error launching test activity", e)
            promise.reject("ERROR", "Failed to launch test activity: ${e.message}", e)
        }
    }

    /**
     * Launch the autofill test activity (legacy - without theme)
     */
    @ReactMethod
    fun launchAutofillTest(promise: Promise) {
        try {
            Log.d(TAG, "🚀 Launching AutofillTestActivity...")
            
            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "❌ Current activity is null")
                promise.reject("ERROR", "Activity not available")
                return
            }

            val intent = Intent(activity, AutofillTestActivity::class.java)
            activity.startActivity(intent)
            
            Log.d(TAG, "✅ AutofillTestActivity launched successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error launching test activity", e)
            promise.reject("ERROR", "Failed to launch test activity: ${e.message}", e)
        }
    }

    /**
     * Check if autofill is enabled
     */
    @ReactMethod
    fun isAutofillEnabled(promise: Promise) {
        try {
            val autofillManager = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.getSystemService(android.view.autofill.AutofillManager::class.java)
            } else {
                null
            }

            if (autofillManager == null) {
                promise.resolve(false)
                return
            }

            val isEnabled = autofillManager.hasEnabledAutofillServices()
            Log.d(TAG, "Autofill enabled: $isEnabled")
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking autofill status", e)
            promise.reject("ERROR", "Failed to check autofill status: ${e.message}", e)
        }
    }

    /**
     * Open autofill settings for user to enable the service
     */
    @ReactMethod
    fun openAutofillSettings(promise: Promise) {
        try {
            if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) {
                promise.reject("UNSUPPORTED", "Autofill not supported on this device")
                return
            }

            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity not available")
                return
            }

            val intent = Intent(android.provider.Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
            intent.data = android.net.Uri.parse("package:${reactContext.packageName}")
            activity.startActivity(intent)
            
            Log.d(TAG, "✅ Opened autofill settings")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error opening autofill settings", e)
            promise.reject("ERROR", "Failed to open autofill settings: ${e.message}", e)
        }
    }
}