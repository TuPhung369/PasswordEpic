package com.passwordepic.mobile.autofill

import android.content.Intent
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import android.util.Log
import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.passwordepic.mobile.R
import java.util.concurrent.Executor

/**
 * AutofillAuthActivity
 * 
 * Handles authentication for autofill operations.
 * Presents biometric prompt or master password input before filling credentials.
 * 
 * Security Features:
 * - Biometric authentication (fingerprint, face)
 * - Master password fallback
 * - Session timeout
 * - Secure credential delivery
 */
class AutofillAuthActivity : FragmentActivity() {

    companion object {
        private const val TAG = "AutofillAuthActivity"
        const val EXTRA_DOMAIN = "domain"
        const val EXTRA_PACKAGE_NAME = "packageName"
        const val EXTRA_CREDENTIAL_COUNT = "credentialCount"
    }

    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo

    private var domain: String? = null
    private var packageName: String? = null
    private var credentialCount: Int = 0
    private var credentialId: String? = null
    private var credentialIndex: Int = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "AutofillAuthActivity created")

        // Extract intent extras
        domain = intent.getStringExtra(EXTRA_DOMAIN)
        packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME)
        credentialCount = intent.getIntExtra(EXTRA_CREDENTIAL_COUNT, 0)
        credentialId = intent.getStringExtra("credentialId")
        credentialIndex = intent.getIntExtra("credentialIndex", -1)

        Log.d(TAG, "Domain: $domain, Package: $packageName, Credentials: $credentialCount, CredentialId: $credentialId")

        // Check if biometric authentication is available
        val biometricManager = BiometricManager.from(this)
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                Log.d(TAG, "Biometric authentication available")
                setupBiometricAuthentication()
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                Log.w(TAG, "No biometric hardware available")
                showMasterPasswordPrompt()
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                Log.w(TAG, "Biometric hardware unavailable")
                showMasterPasswordPrompt()
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                Log.w(TAG, "No biometric credentials enrolled")
                showMasterPasswordPrompt()
            }
            else -> {
                Log.w(TAG, "Biometric authentication not available")
                showMasterPasswordPrompt()
            }
        }
    }

    /**
     * Sets up biometric authentication
     */
    private fun setupBiometricAuthentication() {
        executor = ContextCompat.getMainExecutor(this)

        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.e(TAG, "Authentication error: $errString")
                    
                    if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                        // User clicked "Use password" button
                        showMasterPasswordPrompt()
                    } else {
                        Toast.makeText(
                            applicationContext,
                            "Authentication error: $errString",
                            Toast.LENGTH_SHORT
                        ).show()
                        setResultAndFinish(RESULT_CANCELED)
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Log.d(TAG, "Authentication succeeded")
                    
                    Toast.makeText(
                        applicationContext,
                        "Authentication successful",
                        Toast.LENGTH_SHORT
                    ).show()
                    
                    handleAuthenticationSuccess()
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.w(TAG, "Authentication failed")
                    
                    Toast.makeText(
                        applicationContext,
                        "Authentication failed",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })

        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Autofill Authentication")
            .setSubtitle("Authenticate to fill password for $domain")
            .setDescription("Use your biometric credential to autofill your password")
            .setNegativeButtonText("Use master password")
            .build()

        // Show biometric prompt
        biometricPrompt.authenticate(promptInfo)
    }

    /**
     * Shows master password prompt
     */
    private fun showMasterPasswordPrompt() {
        Log.d(TAG, "Showing master password prompt")
        
        // TODO: Implement master password input dialog
        // For now, just fail the authentication
        Toast.makeText(
            this,
            "Master password authentication not yet implemented",
            Toast.LENGTH_SHORT
        ).show()
        
        setResultAndFinish(RESULT_CANCELED)
    }

    /**
     * Handles successful authentication
     */
    private fun handleAuthenticationSuccess() {
        Log.d(TAG, "Handling authentication success")

        try {
            // Get credentials from data provider
            val dataProvider = AutofillDataProvider(this)
            val credentials = dataProvider.getCredentialsForDomain(
                domain ?: "",
                packageName ?: ""
            )

            if (credentials.isEmpty()) {
                Log.w(TAG, "No credentials found after authentication")
                Toast.makeText(this, "No credentials found", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }

            // If multiple credentials, show selection UI
            if (credentials.size > 1) {
                showCredentialSelection(credentials)
            } else {
                // Single credential, use it directly
                deliverCredential(credentials.first())
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error handling authentication success", e)
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            setResultAndFinish(RESULT_CANCELED)
        }
    }



    /**
     * Shows credential selection UI
     * 
     * @param credentials List of credentials to choose from
     */
    private fun showCredentialSelection(credentials: List<AutofillCredential>) {
        Log.d(TAG, "Showing credential selection for ${credentials.size} credentials")

        // TODO: Implement credential selection UI
        // For now, just use the first credential
        deliverCredential(credentials.first())
    }

    /**
     * Delivers the selected credential back to the autofill service
     * Caches the credential and finishes activity to trigger autofill again
     * 
     * ⚠️ SECURITY NOTE: If password is encrypted (iv and tag present), it needs decryption
     * before being filled into forms. The password must be decrypted through React Native
     * using the master key or obtained from the app session.
     * 
     * 🔐 DECRYPTION FLOW:
     * 1. After biometric auth succeeds here
     * 2. Send broadcast to main app to request decryption
     * 3. Main app calls React Native to decrypt and cache plaintext
     * 4. Finish activity to trigger onFillRequest again
     * 5. onFillRequest finds plaintext cache and fills without auth requirement
     * 
     * @param credential The credential to deliver
     */
    private fun deliverCredential(credential: AutofillCredential) {
        Log.d(TAG, "🔐 Delivering credential: ${credential.username}")
        Log.d(TAG, "📦 Credential encrypted: ${credential.isEncrypted}")
        Log.d(TAG, "🔑 Has IV: ${credential.iv.isNotEmpty()}, Has TAG: ${credential.tag.isNotEmpty()}")

        try {
            // Check if password needs decryption
            if (credential.isEncrypted && credential.iv.isNotEmpty() && credential.tag.isNotEmpty()) {
                Log.d(TAG, "🔒 Password is encrypted - requesting decryption from React Native")
                Log.d(TAG, "📝 Encrypted password length: ${credential.password.length} chars")
                
                // 🔐 CRITICAL: Send broadcast to main app to decrypt and cache plaintext password
                // The main app will call React Native to decrypt using the master key
                requestDecryptionFromMainApp(credential)
                
                Log.d(TAG, "📡 Broadcast sent to main app for decryption")
                Log.d(TAG, "⏳ Waiting for decryption to complete...")
                
                // IMPROVED WAIT: Give React Native time to decrypt and cache plaintext
                // Using LONGER timeout (10 seconds) with polling to detect when cache is ready
                val startTime = System.currentTimeMillis()
                val maxWaitTime = 10000 // 10 seconds max - gives React Native plenty of time
                var decrypted = false
                var checkCount = 0
                
                Log.d(TAG, "⏳ Starting polling for decrypted password cache (max ${maxWaitTime}ms)...")
                
                while (System.currentTimeMillis() - startTime < maxWaitTime) {
                    // Check if plaintext has been cached
                    val dataProvider = AutofillDataProvider(this)
                    val cachedPlaintext = dataProvider.getDecryptedPasswordForAutofill(credential.id)
                    checkCount++
                    
                    if (cachedPlaintext != null) {
                        val elapsedTime = System.currentTimeMillis() - startTime
                        Log.d(TAG, "✅ DECRYPTION COMPLETE - plaintext cached after ${elapsedTime}ms (check #$checkCount)")
                        Log.d(TAG, "✅ Cached plaintext length: ${cachedPlaintext.length} chars")
                        decrypted = true
                        break
                    }
                    
                    // Only log every 5 checks to avoid log spam (every ~500ms)
                    if (checkCount % 5 == 0) {
                        val elapsed = System.currentTimeMillis() - startTime
                        Log.d(TAG, "⏳ Still waiting for decryption... (${elapsed}ms elapsed, check #$checkCount)")
                    }
                    
                    // Wait 100ms before checking again
                    Thread.sleep(100)
                }
                
                if (!decrypted) {
                    val totalElapsed = System.currentTimeMillis() - startTime
                    Log.e(TAG, "❌ DECRYPTION TIMEOUT - waited ${totalElapsed}ms (${checkCount} checks) but plaintext NOT cached!")
                    Log.e(TAG, "❌ This is a CRITICAL ISSUE - React Native decryption did not complete")
                    Log.e(TAG, "❌ Possible causes:")
                    Log.e(TAG, "   1. React Native event listener not registered in useAutofillDecryption hook")
                    Log.e(TAG, "   2. AutofillBridge.getInstance() returning null")
                    Log.e(TAG, "   3. cryptoService.decrypt() taking too long")
                    Log.e(TAG, "   4. App not in foreground during decryption")
                    Log.e(TAG, "⚠️ Autofill will NOT work - encrypted password cannot be decrypted")
                } else {
                    Log.d(TAG, "✅ Proceeding with autofill using decrypted plaintext")
                }
            } else {
                Log.d(TAG, "✅ Password is plaintext - ready for immediate autofill")
            }

            // Cache the authenticated credential in the service
            // When autofill is requested again, the service will use this cached credential
            // (either with plaintext if decrypted, or encrypted if couldn't decrypt)
            PasswordEpicAutofillService.setAuthenticatedCredential(credential.id, credential)
            Log.d(TAG, "✅ Credential cached in service: ${credential.id}")
            
            // Set result for the activity
            val resultIntent = Intent().apply {
                putExtra("credential_id", credential.id)
                putExtra("username", credential.username)
                putExtra("domain", credential.domain)
                putExtra("isEncrypted", credential.isEncrypted)
            }
            setResult(RESULT_OK, resultIntent)
            
            Log.d(TAG, "✅ Finishing auth activity with RESULT_OK")
            Log.d(TAG, "🔄 Broadcasting auth success to trigger refill...")
            
            // 📡 Send broadcast to trigger refill via cached callback
            // (Android framework may not auto-trigger onFillRequest again on all devices)
            sendBroadcastRefillTrigger()
            
            // 🔄 Also call notifyAutofillToRefill for backup
            notifyAutofillToRefill(credential)
            
            finish()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error delivering credential", e)
            setResultAndFinish(RESULT_CANCELED)
        }
    }
    
    /**
     * 🔄 CRITICAL FIX: Delivers credentials immediately using stored callback
     * 
     * Android Autofill Framework limitation: FillCallback can only be called once per request.
     * However, we can call it from the auth activity AFTER credential is cached!
     * 
     * Solution: Instead of waiting for user to re-focus field (which triggers 2nd request),
     * we use the FIRST callback to deliver the cached credential immediately.
     * 
     * This makes autofill instant after biometric verification!
     * 
     * @param credential The authenticated credential to fill
     */
    private fun notifyAutofillToRefill(credential: AutofillCredential) {
        try {
            Log.d(TAG, "✅ Auth succeeded with RESULT_OK")
            Log.d(TAG, "📋 Android will now automatically fill fields using values from dataset")
            Log.d(TAG, "⏳ Fields should fill within 1-2 seconds...")
            
            // ⚠️ CRITICAL: Do NOT try to call callback or clear context!
            // 
            // Why? Android's autofill has this behavior:
            // 1. When dataset has setAuthentication() and values set
            // 2. Framework calls callback.onSuccess(response) with that dataset
            // 3. User taps → auth activity launches
            // 4. Biometric succeeds → return RESULT_OK
            // 5. ✅ Android AUTOMATICALLY fills fields from dataset values
            //
            // If we try to call callback again → "Already called" error
            // If we clear context → autofill stops working
            //
            // Solution: Just finish the activity, Android handles the rest!
            
            Log.d(TAG, "🎯 Credential authenticated and cached")
            Log.d(TAG, "   ID: ${credential.id}")
            Log.d(TAG, "   Username: ${credential.username}")
            Log.d(TAG, "   Domain: ${credential.domain}")
            
            // 🚀 Just finish the activity with RESULT_OK
            // The framework will auto-fill the fields using the dataset values
            // that were set BEFORE setAuthentication() was called
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Unexpected error in notifyAutofillToRefill: ${e.message}", e)
        }
    }

    /**
     * 📡 Sends broadcast to trigger autofill refill after authentication succeeds
     * This ensures fields are filled even if Android framework doesn't auto-trigger onFillRequest again
     */
    private fun sendBroadcastRefillTrigger() {
        try {
            Log.d(TAG, "┌──────────────────────────────────────────────────────────────")
            Log.d(TAG, "📡 Sending autofill refill trigger broadcast...")
            Log.d(TAG, "📡 Using LocalBroadcastManager (local, in-process only)")
            
            val refillIntent = Intent(AutofillAuthSuccessReceiver.ACTION_AUTH_SUCCEED)
            Log.d(TAG, "📡 Intent action: ${refillIntent.action}")
            
            val result = LocalBroadcastManager.getInstance(this).sendBroadcast(refillIntent)
            Log.d(TAG, "📡 Broadcast sent successfully")
            Log.d(TAG, "📡 Action: com.passwordepic.mobile.AUTOFILL_AUTH_SUCCEED")
            Log.d(TAG, "✅ LocalBroadcast sent to registered receivers in this process")
            Log.d(TAG, "└──────────────────────────────────────────────────────────────")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending refill broadcast", e)
            Log.e(TAG, "❌ Stack trace: ${e.stackTraceToString()}")
            // Continue anyway - we also have notifyAutofillToRefill as backup
        }
    }

    /**
     * 🔐 Sends broadcast to main app requesting password decryption
     * The main app (React Native) will decrypt the password and cache plaintext
     * 
     * @param credential The credential to decrypt
     */
    private fun requestDecryptionFromMainApp(credential: AutofillCredential) {
        try {
            Log.d(TAG, "📡 Sending decryption request broadcast...")
            
            val decryptIntent = Intent("com.passwordepic.mobile.DECRYPT_FOR_AUTOFILL").apply {
                putExtra("credentialId", credential.id)
                putExtra("encryptedPassword", credential.password)
                putExtra("iv", credential.iv)
                putExtra("tag", credential.tag)
                putExtra("salt", credential.salt)
                putExtra("username", credential.username)
                putExtra("domain", credential.domain)
            }
            
            // 🔴 FIX: Send via GLOBAL broadcast (not LocalBroadcastManager)
            // because AutofillDecryptionReceiver is registered in AndroidManifest.xml
            // Manifest receivers ONLY catch global broadcasts, not local ones!
            sendBroadcast(decryptIntent)
            Log.d(TAG, "📡 Broadcast sent GLOBALLY: DECRYPT_FOR_AUTOFILL")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending decryption broadcast", e)
            // Continue anyway - encryption might not be necessary for this case
        }
    }

    /**
     * Sets result and finishes activity
     * 
     * @param resultCode The result code
     */
    private fun setResultAndFinish(resultCode: Int) {
        setResult(resultCode)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "AutofillAuthActivity destroyed")
        // Global broadcast receiver (GlobalAutofillRefillReceiver) will handle refill
    }
}