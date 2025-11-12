package com.passwordepic.mobile

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class BiometricModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BiometricModule"
    }

    override fun getName(): String {
        return "BiometricModule"
    }

    @ReactMethod
    fun authenticateWithPreference(
        title: String,
        subtitle: String,
        description: String,
        cancelButtonText: String,
        preference: String,
        promise: Promise
    ) {
        Log.d(TAG, "authenticateWithPreference called with preference: $preference")
        
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ERROR", "Activity is null")
            return
        }

        if (activity !is FragmentActivity) {
            promise.reject("ERROR", "Activity is not a FragmentActivity")
            return
        }

        UiThreadUtil.runOnUiThread {
            try {
                val biometricManager = BiometricManager.from(activity)
                
                Log.d(TAG, "Checking available biometric types:")
                Log.d(TAG, "  BIOMETRIC_STRONG: ${biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)}")
                Log.d(TAG, "  BIOMETRIC_WEAK: ${biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)}")
                Log.d(TAG, "  BIOMETRIC_STRONG | WEAK: ${biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK)}")
                
                val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
                
                Log.d(TAG, "Note: Preference '$preference' requested, but Huawei devices require both STRONG and WEAK authenticators")

                Log.d(TAG, "Using authenticators: $authenticators for preference: $preference")

                when (biometricManager.canAuthenticate(authenticators)) {
                    BiometricManager.BIOMETRIC_SUCCESS -> {
                        Log.d(TAG, "Biometric authentication available")
                    }
                    BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                        promise.reject("ERROR", "No biometric hardware available")
                        return@runOnUiThread
                    }
                    BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                        promise.reject("ERROR", "Biometric hardware unavailable")
                        return@runOnUiThread
                    }
                    BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                        promise.reject("ERROR", "No biometric credentials enrolled")
                        return@runOnUiThread
                    }
                    else -> {
                        promise.reject("ERROR", "Biometric authentication not available")
                        return@runOnUiThread
                    }
                }

                val executor = ContextCompat.getMainExecutor(activity)
                val biometricPrompt = BiometricPrompt(activity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            Log.e(TAG, "Authentication error: $errString")
                            promise.reject("ERROR", errString.toString())
                        }

                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            Log.d(TAG, "Authentication succeeded")
                            promise.resolve(true)
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            Log.w(TAG, "Authentication failed")
                        }
                    })

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setDescription(description)
                    .setAllowedAuthenticators(authenticators)
                    .setNegativeButtonText(cancelButtonText)
                    .build()

                biometricPrompt.authenticate(promptInfo)
            } catch (e: Exception) {
                Log.e(TAG, "Exception during authentication: ${e.message}", e)
                promise.reject("ERROR", "Failed to authenticate: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun getBiometricPreference(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("RN_ASYNC_STORAGE", Context.MODE_PRIVATE)
            val prefJson = prefs.getString("@biometric_preference", null)
            val preference = prefJson?.trim('"') ?: "any"
            Log.d(TAG, "Read biometric preference: $preference")
            promise.resolve(preference)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading biometric preference", e)
            promise.reject("ERROR", "Failed to read preference: ${e.message}")
        }
    }
}
