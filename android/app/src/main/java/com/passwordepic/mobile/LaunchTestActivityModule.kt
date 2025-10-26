package com.passwordepic.mobile

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

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
     * Launch the autofill test activity
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