package com.passwordepic.mobile.autofill

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentSender
import android.os.Bundle
import android.util.Log
import android.view.autofill.AutofillManager
import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "AutofillAuthActivity created")

        // Extract intent extras
        domain = intent.getStringExtra(EXTRA_DOMAIN)
        packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME)
        credentialCount = intent.getIntExtra(EXTRA_CREDENTIAL_COUNT, 0)

        Log.d(TAG, "Domain: $domain, Package: $packageName, Credentials: $credentialCount")

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
            val dataProvider = AutofillDataProvider()
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
     * 
     * @param credential The credential to deliver
     */
    private fun deliverCredential(credential: AutofillCredential) {
        Log.d(TAG, "Delivering credential: ${credential.username}")

        try {
            // Create the autofill response
            val replyIntent = Intent().apply {
                // Add credential data
                putExtra("credential_id", credential.id)
                putExtra("username", credential.username)
                putExtra("password", credential.password)
                putExtra("domain", credential.domain)
            }

            setResult(RESULT_OK, replyIntent)
            finish()

        } catch (e: Exception) {
            Log.e(TAG, "Error delivering credential", e)
            setResultAndFinish(RESULT_CANCELED)
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
    }
}