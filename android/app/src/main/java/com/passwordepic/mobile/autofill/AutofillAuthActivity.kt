package com.passwordepic.mobile.autofill

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.util.concurrent.Executor
import android.view.autofill.AutofillManager


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

    private var decryptionService: AutofillDecryptionService? = null
    private var isBound = false
    private var credentialToDecrypt: AutofillCredential? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Log.d(TAG, "DEBUG_AUTOFILL: 📡 Decryption service connected")
            val binder = service as AutofillDecryptionService.LocalBinder
            decryptionService = binder.getService()
            isBound = true
            credentialToDecrypt?.let {
                Log.d(TAG, "DEBUG_AUTOFILL: Service is now bound, performing deferred decryption request.")
                performDecryptionRequest(it)
                
                Log.d(TAG, "DEBUG_AUTOFILL: ⏳ Starting non-blocking poll for decrypted password cache (max 10000ms)...")
                pollForDecryptionResult(it, System.currentTimeMillis())
                
                credentialToDecrypt = null
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "DEBUG_AUTOFILL: 📡 Decryption service disconnected")
            decryptionService = null
            isBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "DEBUG_AUTOFILL: AutofillAuthActivity created")

        domain = intent.getStringExtra(EXTRA_DOMAIN)
        packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME)
        credentialCount = intent.getIntExtra(EXTRA_CREDENTIAL_COUNT, 0)
        credentialId = intent.getStringExtra("credentialId")
        credentialIndex = intent.getIntExtra("credentialIndex", -1)

        Log.d(TAG, "DEBUG_AUTOFILL: Domain: $domain, Package: $packageName, Credentials: $credentialCount, CredentialId: $credentialId")

        // Check if biometric is required for autofill
        val requireBiometric = isAutofillBiometricRequired()
        Log.d(TAG, "DEBUG_AUTOFILL: Require biometric for autofill: $requireBiometric")

        if (!requireBiometric) {
            Log.d(TAG, "DEBUG_AUTOFILL: Biometric disabled in settings - skipping biometric auth")
            handleAuthenticationSuccess()
            return
        }

        val biometricManager = BiometricManager.from(this)
        val biometricPreference = getBiometricPreference()
        val authenticators = when (biometricPreference) {
            "face" -> BiometricManager.Authenticators.BIOMETRIC_WEAK
            "fingerprint" -> BiometricManager.Authenticators.BIOMETRIC_STRONG
            else -> BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
        }
        Log.d(TAG, "DEBUG_AUTOFILL: Biometric preference: $biometricPreference, authenticators: $authenticators")
        when (biometricManager.canAuthenticate(authenticators)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                Log.d(TAG, "DEBUG_AUTOFILL: Biometric authentication available")
                setupBiometricAuthentication()
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                Log.w(TAG, "DEBUG_AUTOFILL: No biometric hardware available")
                showMasterPasswordPrompt()
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                Log.w(TAG, "DEBUG_AUTOFILL: Biometric hardware unavailable")
                showMasterPasswordPrompt()
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                Log.w(TAG, "DEBUG_AUTOFILL: No biometric credentials enrolled")
                showMasterPasswordPrompt()
            }
            else -> {
                Log.w(TAG, "DEBUG_AUTOFILL: Biometric authentication not available")
                showMasterPasswordPrompt()
            }
        }
    }

    private fun isAutofillBiometricRequired(): Boolean {
        return try {
            val prefs = getSharedPreferences("autofill_settings", Context.MODE_PRIVATE)
            val requireBiometric = prefs.getBoolean("require_biometric", true)
            Log.d(TAG, "DEBUG_AUTOFILL: Read require_biometric from SharedPreferences: $requireBiometric")
            requireBiometric
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error reading biometric setting from SharedPreferences", e)
            true
        }
    }

    private fun getBiometricPreference(): String {
        return try {
            val prefs = getSharedPreferences("RN_ASYNC_STORAGE", Context.MODE_PRIVATE)
            val prefJson = prefs.getString("@biometric_preference", null)
            val preference = prefJson?.trim('"') ?: "any"
            Log.d(TAG, "DEBUG_AUTOFILL: Read biometric preference: $preference")
            preference
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error reading biometric preference", e)
            "any"
        }
    }

    private fun setupBiometricAuthentication() {
        executor = ContextCompat.getMainExecutor(this)

        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.e(TAG, "DEBUG_AUTOFILL: Authentication error: $errString")
                    
                    if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
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
                    Log.d(TAG, "DEBUG_AUTOFILL: ═══ BIOMETRIC AUTH SUCCEEDED ═══")
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ User completed biometric authentication successfully")
                    
                    Toast.makeText(
                        applicationContext,
                        "Authentication successful",
                        Toast.LENGTH_SHORT
                    ).show()
                    
                    handleAuthenticationSuccess()
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.w(TAG, "DEBUG_AUTOFILL: Authentication failed")
                    
                    Toast.makeText(
                        applicationContext,
                        "Authentication failed",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })

        val biometricPreference = getBiometricPreference()
        val authenticators = when (biometricPreference) {
            "face" -> BiometricManager.Authenticators.BIOMETRIC_WEAK
            "fingerprint" -> BiometricManager.Authenticators.BIOMETRIC_STRONG
            else -> BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
        }

        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Autofill Authentication")
            .setSubtitle("Authenticate to fill password for $domain")
            .setDescription("Use your biometric credential to autofill your password")
            .setAllowedAuthenticators(authenticators)
            .setNegativeButtonText("Use master password")
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    private fun showMasterPasswordPrompt() {
        Log.d(TAG, "DEBUG_AUTOFILL: Showing master password prompt")
        
        Toast.makeText(
            this,
            "Master password authentication not yet implemented",
            Toast.LENGTH_SHORT
        ).show()
        
        setResultAndFinish(RESULT_CANCELED)
    }

    private fun handleAuthenticationSuccess() {
        AutofillLogger.logStep("Fetch credentials for domain")
        Log.d(TAG, "DEBUG_AUTOFILL: Domain: $domain, Package: $packageName, CredentialId: $credentialId, CredentialIndex: $credentialIndex")

        try {
            val dataProvider = AutofillDataProvider(this)
            val credentials = dataProvider.getCredentialsForDomain(
                domain ?: "",
                packageName ?: ""
            )

            if (credentials.isEmpty()) {
                Log.w(TAG, "DEBUG_AUTOFILL: No credentials found after authentication")
                Toast.makeText(this, "No credentials found", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }

            val selectedCredential = if (credentialId != null) {
                credentials.find { it.id == credentialId }?.also {
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ Found credential by ID: ${it.username}")
                }
            } else if (credentialIndex >= 0 && credentialIndex < credentials.size) {
                credentials[credentialIndex].also {
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ Found credential by index $credentialIndex: ${it.username}")
                }
            } else {
                credentials.firstOrNull()?.also {
                    Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ No credentialId/index provided, using first credential: ${it.username}")
                }
            }

            if (selectedCredential != null) {
                deliverCredential(selectedCredential)
            } else {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Could not find selected credential")
                Toast.makeText(this, "Selected credential not found", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
            }

        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error handling authentication success", e)
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            setResultAndFinish(RESULT_CANCELED)
        }
    }

    private fun deliverCredential(credential: AutofillCredential) {
        AutofillLogger.logStep("Deliver credential to autofill service")
        Log.d(TAG, "DEBUG_AUTOFILL: 📧 Username: ${credential.username}")
        Log.d(TAG, "DEBUG_AUTOFILL: 📦 Credential encrypted: ${credential.isEncrypted}")

        // If the password is not encrypted, proceed immediately.
        if (!credential.isEncrypted || credential.iv.isEmpty() || credential.tag.isEmpty()) {
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Password is plaintext - proceeding directly.")
            proceedWithCredential(credential)
            return
        }

        // --- ASYNCHRONOUS DECRYPTION FLOW ---
        Log.d(TAG, "DEBUG_AUTOFILL: 🔒 Password is encrypted - starting non-blocking decryption flow.")
        
        // Request decryption from the service (polling will start after service is bound)
        requestDecryptionViaService(credential)
    }

    private fun pollForDecryptionResult(credential: AutofillCredential, startTime: Long) {
        val dataProvider = AutofillDataProvider(this)
        val cachedPlaintext = dataProvider.getDecryptedPasswordForAutofill(credential.id)

        if (cachedPlaintext != null) {
            val elapsedTime = System.currentTimeMillis() - startTime
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ DECRYPTION COMPLETE - plaintext cached after ${elapsedTime}ms")
            val decryptedCredential = credential.copy(password = cachedPlaintext, isEncrypted = false)
            proceedWithCredential(decryptedCredential)
            return
        }

        val elapsedTime = System.currentTimeMillis() - startTime
        if (elapsedTime > 10000) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ DECRYPTION TIMEOUT - Waited 10s but plaintext was not cached.")
            Toast.makeText(this, "Decryption timed out.", Toast.LENGTH_LONG).show()
            setResultAndFinish(RESULT_CANCELED)
            return
        }

        // Schedule the next check
        Handler(Looper.getMainLooper()).postDelayed({
            pollForDecryptionResult(credential, startTime)
        }, 200) // Check every 200ms
    }

    private fun proceedWithCredential(credential: AutofillCredential) {
        AutofillLogger.logStep("Cache plaintext credential in service")
        
        try {
            Log.d(TAG, "DEBUG_AUTOFILL: 🔐 User authenticated - caching credential")
            Log.d(TAG, "DEBUG_AUTOFILL: 📦 Username: ${credential.username}")
            
            PasswordEpicAutofillService.setAuthenticatedCredential(credential.id, credential)
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Cached: ${credential.id}")
            
            AutofillLogger.logStep("Trigger autofill refill via accessibility service")
            Log.d(TAG, "DEBUG_AUTOFILL: 📡 Sending refill trigger broadcast...")
            try {
                val refillIntent = Intent(AutofillRefillAccessibilityService.ACTION_TRIGGER_REFILL)
                refillIntent.putExtra("targetPackage", packageName)
                refillIntent.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES)
                sendBroadcast(refillIntent)
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Broadcast sent successfully")
            } catch (e: Exception) {
                Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Failed to send broadcast: ${e.message}")
            }
            
            AutofillLogger.logStep("Complete auth - return to target app")
            Log.d(TAG, "DEBUG_AUTOFILL: 📤 Returning RESULT_OK to framework")
            setResult(RESULT_OK)
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Credential cached - finishing after 500ms to release focus")
            Handler(Looper.getMainLooper()).postDelayed({
                Log.d(TAG, "DEBUG_AUTOFILL: ⏳ Finishing auth activity")
                finish()
            }, 500)
            
            Handler(Looper.getMainLooper()).postDelayed({
                Log.d(TAG, "DEBUG_AUTOFILL: 🗑️ Clearing plaintext cache after successful fill")
                val dataProvider = AutofillDataProvider(this)
                dataProvider.clearDecryptedPasswordCache(credential.id)
            }, 2000)
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error", e)
            setResultAndFinish(RESULT_CANCELED)
        }
    }

    private fun requestDecryptionViaService(credential: AutofillCredential) {
        try {
            Log.d(TAG, "DEBUG_AUTOFILL: 🔗 Requesting decryption via bound service...")

            if (!isBound || decryptionService == null) {
                Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Service not bound yet, binding now...")
                credentialToDecrypt = credential
                bindToDecryptionService()
                return
            }

            performDecryptionRequest(credential)
            
            Log.d(TAG, "DEBUG_AUTOFILL: ⏳ Starting non-blocking poll for decrypted password cache (max 10000ms)...")
            pollForDecryptionResult(credential, System.currentTimeMillis())

        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error requesting decryption via service", e)
        }
    }

    private fun performDecryptionRequest(credential: AutofillCredential) {
        try {
            val service = decryptionService
            if (service == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Decryption service is null")
                return
            }

            Log.d(TAG, "DEBUG_AUTOFILL: 📤 Sending decryption request to service...")
            service.requestDecryption(
                credentialId = credential.id,
                encryptedPassword = credential.password,
                iv = credential.iv,
                tag = credential.tag,
                salt = credential.salt,
                username = credential.username,
                domain = credential.domain,
                callback = object : AutofillDecryptionService.DecryptionCallback {
                    override fun onDecryptionRequested() {
                        Log.d(TAG, "DEBUG_AUTOFILL: ✅ Decryption request sent successfully to service.")
                    }

                    override fun onDecryptionFailed(error: String) {
                        Log.e(TAG, "DEBUG_AUTOFILL: ❌ Decryption request failed via callback: $error")
                    }
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error performing decryption request", e)
        }
    }

    private fun bindToDecryptionService() {
        try {
            Log.d(TAG, "DEBUG_AUTOFILL: 🔗 Binding to AutofillDecryptionService...")
            val intent = Intent(this, AutofillDecryptionService::class.java)
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            Log.d(TAG, "DEBUG_AUTOFILL: 📡 Service binding initiated")
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error binding to decryption service", e)
        }
    }

    private fun unbindFromDecryptionService() {
        try {
            if (isBound) {
                unbindService(serviceConnection)
                isBound = false
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Unbound from decryption service")
            }
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error unbinding from decryption service", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "DEBUG_AUTOFILL: AutofillAuthActivity destroyed")
        unbindFromDecryptionService()
        
        Log.d(TAG, "DEBUG_AUTOFILL: 🗑️ Cleaning up expired cache on activity destroy")
        try {
            val dataProvider = AutofillDataProvider(this)
            dataProvider.cleanupExpiredCache()
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error cleaning cache: ${e.message}")
        }
    }

    private fun setResultAndFinish(resultCode: Int) {
        setResult(resultCode)
        finish()
    }
}