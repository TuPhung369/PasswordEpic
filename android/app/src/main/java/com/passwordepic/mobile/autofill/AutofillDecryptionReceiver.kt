package com.passwordepic.mobile.autofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

/**
 * AutofillDecryptionReceiver
 *
 * Receives decryption requests from AutofillAuthActivity and forwards them to React Native
 * for decryption using the master key stored in the app session.
 *
 * Flow:
 * 1. User authenticates with biometric in AutofillAuthActivity
 * 2. Encrypted credential is sent via broadcast
 * 3. This receiver catches it and calls React Native cryptoService.decrypt()
 * 4. React Native returns plaintext password
 * 5. Plaintext is cached in SharedPreferences via AutofillDataProvider
 * 6. AutofillAuthActivity finishes, triggering onFillRequest
 * 7. onFillRequest finds plaintext cache and fills without auth
 */
class AutofillDecryptionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AutofillDecryptReceiver"
        const val ACTION_DECRYPT_FOR_AUTOFILL = "com.passwordepic.mobile.DECRYPT_FOR_AUTOFILL"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) {
            Log.w(TAG, "⚠️ Received null context or intent")
            return
        }

        if (intent.action != ACTION_DECRYPT_FOR_AUTOFILL) {
            Log.d(TAG, "⏭️ Ignoring non-decryption intent: ${intent.action}")
            return
        }

        Log.d(TAG, "📡 Received decryption request from AutofillAuthActivity")

        try {
            val credentialId = intent.getStringExtra("credentialId") ?: return
            val encryptedPassword = intent.getStringExtra("encryptedPassword") ?: return
            val iv = intent.getStringExtra("iv") ?: return
            val tag = intent.getStringExtra("tag") ?: return
            val salt = intent.getStringExtra("salt") ?: ""
            val username = intent.getStringExtra("username") ?: ""
            val domain = intent.getStringExtra("domain") ?: ""

            Log.d(TAG, "🔐 Decryption request details:")
            Log.d(TAG, "   Credential ID: $credentialId")
            Log.d(TAG, "   Username: $username")
            Log.d(TAG, "   Domain: $domain")
            Log.d(TAG, "   Has IV: ${iv.isNotEmpty()}")
            Log.d(TAG, "   Has TAG: ${tag.isNotEmpty()}")

            // TODO: Call React Native cryptoService to decrypt
            // This requires access to ReactContext which should be obtained from the app
            // 
            // The decryption process should:
            // 1. Get master password from app session
            // 2. Derive decryption key using PBKDF2 + salt
            // 3. Decrypt password using AES-GCM with IV and TAG
            // 4. Cache plaintext via AutofillDataProvider.cacheDecryptedPasswordForAutofill()
            //
            // For now, we'll document the expected flow:

            Log.d(TAG, "📝 Expected React Native decryption flow:")
            Log.d(TAG, "   1. Get master password from session context")
            Log.d(TAG, "   2. Derive key: PBKDF2(masterPassword, salt, iterations, keyLength)")
            Log.d(TAG, "   3. Decrypt: AES-GCM(encryptedPassword, key, iv, tag)")
            Log.d(TAG, "   4. Cache: AutofillDataProvider.cacheDecryptedPasswordForAutofill(id, plaintext)")

            requestDecryptionFromReactNative(
                context = context,
                credentialId = credentialId,
                encryptedPassword = encryptedPassword,
                iv = iv,
                tag = tag,
                salt = salt,
                username = username,
                domain = domain
            )

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error processing decryption request", e)
        }
    }

    /**
     * Requests decryption from React Native via event bridge
     *
     * This sends an event to React Native's DeviceEventEmitter which should be
     * handled by the useAutofillDecryption hook.
     *
     * The React Native side should:
     * 1. Decrypt the password
     * 2. Call AutofillBridge.storeDecryptedPasswordForAutofill() to cache plaintext
     */
    private fun requestDecryptionFromReactNative(
        context: Context,
        credentialId: String,
        encryptedPassword: String,
        iv: String,
        tag: String,
        salt: String,
        username: String,
        domain: String
    ) {
        try {
            Log.d(TAG, "🔗 Bridging to React Native for decryption...")

            val decryptRequest = JSONObject().apply {
                put("credentialId", credentialId)
                put("encryptedPassword", encryptedPassword)
                put("iv", iv)
                put("tag", tag)
                put("salt", salt)
                put("username", username)
                put("domain", domain)
            }

            Log.d(TAG, "📤 Decryption request JSON prepared")
            
            // Send event to React Native via NativeModules bridge
            // The useAutofillDecryption hook listens for this event
            emitEventToReactNative(context, decryptRequest)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting decryption from React Native", e)
        }
    }

    /**
     * Emits event to React Native using the static AutofillBridge instance
     */
    private fun emitEventToReactNative(context: Context, decryptRequest: JSONObject) {
        try {
            Log.d(TAG, "📤 Attempting to emit AUTOFILL_DECRYPT_REQUEST event to React Native")
            Log.d(TAG, "   Credential ID: ${decryptRequest.getString("credentialId")}")
            Log.d(TAG, "   Username: ${decryptRequest.getString("username")}")
            
            // Get the AutofillBridge instance
            val autofillBridge = AutofillBridge.getInstance()
            if (autofillBridge == null) {
                Log.w(TAG, "⚠️ AutofillBridge instance not available - React Native may not be initialized yet")
                return
            }
            
            // Emit the decryption request
            autofillBridge.emitDecryptionRequest(
                credentialId = decryptRequest.getString("credentialId"),
                encryptedPassword = decryptRequest.getString("encryptedPassword"),
                iv = decryptRequest.getString("iv"),
                tag = decryptRequest.getString("tag"),
                salt = decryptRequest.getString("salt"),
                username = decryptRequest.getString("username"),
                domain = decryptRequest.getString("domain")
            )
            
            Log.d(TAG, "✅ Successfully emitted decryption request to React Native")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error emitting event to React Native", e)
        }
    }
}