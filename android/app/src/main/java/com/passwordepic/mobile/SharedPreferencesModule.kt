package com.passwordepic.mobile

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap

class SharedPreferencesModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PREFS_NAME = "autofill_encrypted_data"
    }

    override fun getName(): String {
        return "SharedPreferencesModule"
    }

    private fun getSharedPreferences(): SharedPreferences {
        return reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Save encrypted master password data to SharedPreferences
     * for Android Native Autofill access
     */
    @ReactMethod
    fun saveEncryptedData(data: ReadableMap, promise: Promise) {
        try {
            val prefs = getSharedPreferences()
            val editor = prefs.edit()

            // Save all encrypted data
            if (data.hasKey("ciphertext")) {
                editor.putString("encrypted_master_password", data.getString("ciphertext"))
            }
            if (data.hasKey("iv")) {
                editor.putString("encrypted_mp_iv", data.getString("iv"))
            }
            if (data.hasKey("tag")) {
                editor.putString("encrypted_mp_tag", data.getString("tag"))
            }
            if (data.hasKey("fixedSalt")) {
                editor.putString("fixed_salt", data.getString("fixedSalt"))
            }
            if (data.hasKey("userId")) {
                editor.putString("user_id", data.getString("userId"))
            }
            if (data.hasKey("userEmail")) {
                editor.putString("user_email", data.getString("userEmail"))
            }

            editor.apply()

            android.util.Log.d("SharedPreferencesModule", "✅ Encrypted data saved to SharedPreferences")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SharedPreferencesModule", "❌ Failed to save encrypted data", e)
            promise.reject("SAVE_ERROR", "Failed to save encrypted data: ${e.message}")
        }
    }

    /**
     * Get encrypted master password data from SharedPreferences
     */
    @ReactMethod
    fun getEncryptedData(promise: Promise) {
        try {
            val prefs = getSharedPreferences()
            val ciphertext = prefs.getString("encrypted_master_password", null)
            val iv = prefs.getString("encrypted_mp_iv", null)
            val tag = prefs.getString("encrypted_mp_tag", null)

            if (ciphertext != null && iv != null && tag != null) {
                val result = mutableMapOf<String, String>()
                result["ciphertext"] = ciphertext
                result["iv"] = iv
                result["tag"] = tag
                promise.resolve(result)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            android.util.Log.e("SharedPreferencesModule", "❌ Failed to get encrypted data", e)
            promise.reject("GET_ERROR", "Failed to get encrypted data: ${e.message}")
        }
    }

    /**
     * Clear encrypted data from SharedPreferences
     */
    @ReactMethod
    fun clearEncryptedData(promise: Promise) {
        try {
            val prefs = getSharedPreferences()
            prefs.edit().clear().apply()
            android.util.Log.d("SharedPreferencesModule", "✅ Encrypted data cleared from SharedPreferences")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SharedPreferencesModule", "❌ Failed to clear encrypted data", e)
            promise.reject("CLEAR_ERROR", "Failed to clear encrypted data: ${e.message}")
        }
    }
}
