package com.passwordepic.mobile

import android.util.Log
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Screen Protection Native Module
 * 
 * Provides native Android screen protection features:
 * - Screenshot prevention using FLAG_SECURE
 * - Screen recording blocking
 * - Secure window management
 */
class ScreenProtectionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ScreenProtection"
    }

    override fun getName(): String {
        return "ScreenProtectionModule"
    }

    /**
     * Enable screen protection by setting FLAG_SECURE
     * This prevents screenshots and screen recording
     */
    @ReactMethod
    fun enableProtection(promise: Promise) {
        Log.d(TAG, "enableProtection called")
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "Activity is null")
                promise.reject("ERROR", "Activity is null")
                return
            }

            UiThreadUtil.runOnUiThread {
                try {
                    Log.d(TAG, "Setting FLAG_SECURE on window")
                    activity.window.setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    )
                    Log.d(TAG, "FLAG_SECURE set successfully")
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to set FLAG_SECURE: ${e.message}")
                    promise.reject("ERROR", "Failed to enable protection: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception in enableProtection: ${e.message}")
            promise.reject("ERROR", "Failed to enable protection: ${e.message}")
        }
    }

    /**
     * Disable screen protection by clearing FLAG_SECURE
     * This allows screenshots and screen recording again
     */
    @ReactMethod
    fun disableProtection(promise: Promise) {
        Log.d(TAG, "disableProtection called")
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                Log.e(TAG, "Activity is null")
                promise.reject("ERROR", "Activity is null")
                return
            }

            UiThreadUtil.runOnUiThread {
                try {
                    Log.d(TAG, "Clearing FLAG_SECURE from window")
                    activity.window.clearFlags(
                        WindowManager.LayoutParams.FLAG_SECURE
                    )
                    Log.d(TAG, "FLAG_SECURE cleared successfully")
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to clear FLAG_SECURE: ${e.message}")
                    promise.reject("ERROR", "Failed to disable protection: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception in disableProtection: ${e.message}")
            promise.reject("ERROR", "Failed to disable protection: ${e.message}")
        }
    }

    /**
     * Check if screen protection is currently enabled
     */
    @ReactMethod
    fun isProtectionEnabled(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("ERROR", "Activity is null")
                return
            }

            UiThreadUtil.runOnUiThread {
                try {
                    val flags = activity.window.attributes.flags
                    val flagSecure = WindowManager.LayoutParams.FLAG_SECURE
                    val isSecure = (flags and flagSecure) == flagSecure
                    promise.resolve(isSecure)
                } catch (e: Exception) {
                    promise.reject("ERROR", "Failed to check protection status: ${e.message}")
                }
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check protection status: ${e.message}")
        }
    }
}