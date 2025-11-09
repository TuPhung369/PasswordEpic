package com.passwordepic.mobile.autofill

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.util.Log
import org.json.JSONObject

class AutofillDecryptionService : Service() {

    companion object {
        private const val TAG = "AutofillDecryptService"
    }

    private val binder = LocalBinder()

    inner class LocalBinder : Binder() {
        fun getService(): AutofillDecryptionService = this@AutofillDecryptionService
    }

    override fun onBind(intent: Intent?): IBinder? {
        Log.d(TAG, "✅ Service bound by client")
        return binder
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚀 AutofillDecryptionService created")
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "🧹 AutofillDecryptionService destroyed")
    }

    fun requestDecryption(
        credentialId: String,
        encryptedPassword: String,
        iv: String,
        tag: String,
        salt: String,
        username: String,
        domain: String,
        callback: DecryptionCallback
    ) {
        Log.d(TAG, "🔐 Decryption request received")
        Log.d(TAG, "   Credential ID: $credentialId")
        Log.d(TAG, "   Username: $username")
        Log.d(TAG, "   Domain: $domain")

        try {
            val decryptRequest = JSONObject().apply {
                put("credentialId", credentialId)
                put("encryptedPassword", encryptedPassword)
                put("iv", iv)
                put("tag", tag)
                put("salt", salt)
                put("username", username)
                put("domain", domain)
            }

            Log.d(TAG, "🔗 Bridging to React Native for decryption...")

            val autofillBridge = AutofillBridge.getInstance()
            if (autofillBridge == null) {
                Log.w(TAG, "⚠️ AutofillBridge instance not available - React Native may not be initialized yet")
                callback.onDecryptionFailed("AutofillBridge not available")
                return
            }

            autofillBridge.emitDecryptionRequest(
                credentialId = credentialId,
                encryptedPassword = encryptedPassword,
                iv = iv,
                tag = tag,
                salt = salt,
                username = username,
                domain = domain
            )

            Log.d(TAG, "✅ Successfully emitted decryption request to React Native")
            callback.onDecryptionRequested()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting decryption: ${e.message}", e)
            callback.onDecryptionFailed(e.message ?: "Unknown error")
        }
    }

    interface DecryptionCallback {
        fun onDecryptionRequested()
        fun onDecryptionFailed(error: String)
    }
}
