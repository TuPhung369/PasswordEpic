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
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import android.util.Base64


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

    private var decryptedMasterPassword: String? = null // Store decrypted master password after PIN verification

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
                showMasterPasswordAndPinPrompt()
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                Log.w(TAG, "DEBUG_AUTOFILL: Biometric hardware unavailable")
                showMasterPasswordAndPinPrompt()
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                Log.w(TAG, "DEBUG_AUTOFILL: No biometric credentials enrolled")
                showMasterPasswordAndPinPrompt()
            }
            else -> {
                Log.w(TAG, "DEBUG_AUTOFILL: Biometric authentication not available")
                showMasterPasswordAndPinPrompt()
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
                    
                    if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON || 
                        errorCode == BiometricPrompt.ERROR_USER_CANCELED) {
                        // Show master password + PIN fallback
                        showMasterPasswordAndPinPrompt()
                    } else {
                        Toast.makeText(
                            applicationContext,
                            "Authentication error: $errString",
                            Toast.LENGTH_SHORT
                        ).show()
                        // Still show fallback on other errors
                        showMasterPasswordAndPinPrompt()
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Log.d(TAG, "DEBUG_AUTOFILL: ═══ BIOMETRIC AUTH SUCCEEDED ═══")
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ User completed biometric authentication successfully")
                    
                    Toast.makeText(
                        applicationContext,
                        "Biometric verified",
                        Toast.LENGTH_SHORT
                    ).show()
                    
                    // Show PIN prompt after successful biometric
                    showPinPrompt()
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
            .setDescription("Biometric + PIN required to autofill your password")
            .setAllowedAuthenticators(authenticators)
            .setNegativeButtonText("Use fallback")
            .setConfirmationRequired(false)
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    private fun showPinPrompt() {
        Log.d(TAG, "DEBUG_AUTOFILL: Showing PIN prompt after successful biometric")
        
        val builder = android.app.AlertDialog.Builder(this)
        builder.setTitle("Enter PIN")
        builder.setMessage("Enter your PIN to decrypt and autofill this credential")
        
        // Create container with padding
        val container = android.widget.FrameLayout(this)
        container.setPadding(50, 20, 50, 20)
        
        // Create PIN input field
        val input = android.widget.EditText(this)
        input.hint = "Enter PIN"
        input.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        input.setHorizontallyScrolling(false)
        
        // Limit to 8 digits
        input.filters = arrayOf(android.text.InputFilter.LengthFilter(8))
        
        container.addView(input)
        builder.setView(container)
        
        // Cancel button
        builder.setNegativeButton("Cancel") { dialog, _ ->
            dialog.dismiss()
            setResultAndFinish(RESULT_CANCELED)
        }
        
        // Unlock button
        builder.setPositiveButton("Unlock") { _, _ ->
            val pin = input.text.toString().trim()
            if (pin.isEmpty()) {
                Toast.makeText(this, "Please enter your PIN", Toast.LENGTH_SHORT).show()
                showPinPrompt() // Show again
                return@setPositiveButton
            }
            
            verifyPinAndProceed(pin)
        }
        
        builder.setOnCancelListener {
            setResultAndFinish(RESULT_CANCELED)
        }
        
        builder.show()
    }
    
    private fun showMasterPasswordAndPinPrompt() {
        Log.d(TAG, "DEBUG_AUTOFILL: Showing master password + PIN fallback prompt")
        
        val builder = android.app.AlertDialog.Builder(this)
        builder.setTitle("Authentication Required")
        builder.setMessage("Enter your master password and PIN to autofill this credential")
        
        // Create container layout with proper spacing
        val container = android.widget.LinearLayout(this)
        container.orientation = android.widget.LinearLayout.VERTICAL
        container.setPadding(50, 20, 50, 20)
        
        // Master password label
        val masterPasswordLabel = android.widget.TextView(this)
        masterPasswordLabel.text = "Master Password:"
        masterPasswordLabel.textSize = 14f
        masterPasswordLabel.setPadding(0, 0, 0, 8)
        container.addView(masterPasswordLabel)
        
        // Master password input
        val masterPasswordInput = android.widget.EditText(this)
        masterPasswordInput.hint = "Enter master password"
        masterPasswordInput.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        val masterPasswordParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        )
        masterPasswordParams.setMargins(0, 0, 0, 32)
        masterPasswordInput.layoutParams = masterPasswordParams
        container.addView(masterPasswordInput)
        
        // PIN label
        val pinLabel = android.widget.TextView(this)
        pinLabel.text = "PIN (max 8 digits):"
        pinLabel.textSize = 14f
        pinLabel.setPadding(0, 0, 0, 8)
        container.addView(pinLabel)
        
        // PIN input
        val pinInput = android.widget.EditText(this)
        pinInput.hint = "Enter PIN"
        pinInput.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        
        // Limit to 8 digits
        pinInput.filters = arrayOf(android.text.InputFilter.LengthFilter(8))
        
        val pinParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        )
        pinInput.layoutParams = pinParams
        container.addView(pinInput)
        
        builder.setView(container)
        
        // Cancel button
        builder.setNegativeButton("Cancel") { dialog, _ ->
            dialog.dismiss()
            setResultAndFinish(RESULT_CANCELED)
        }
        
        // Verify button
        builder.setPositiveButton("Unlock") { _, _ ->
            val masterPassword = masterPasswordInput.text.toString().trim()
            val pin = pinInput.text.toString().trim()
            
            if (masterPassword.isEmpty()) {
                Toast.makeText(this, "Please enter your master password", Toast.LENGTH_SHORT).show()
                showMasterPasswordAndPinPrompt() // Show again
                return@setPositiveButton
            }
            
            if (pin.isEmpty()) {
                Toast.makeText(this, "Please enter your PIN", Toast.LENGTH_SHORT).show()
                showMasterPasswordAndPinPrompt() // Show again
                return@setPositiveButton
            }
            
            verifyMasterPasswordAndPinThenProceed(masterPassword, pin)
        }
        
        builder.setOnCancelListener {
            setResultAndFinish(RESULT_CANCELED)
        }
        
        val dialog = builder.create()
        dialog.show()
        
        // Auto-focus on master password input
        masterPasswordInput.requestFocus()
    }
    
    private fun verifyPinAndProceed(pin: String) {
        Log.d(TAG, "DEBUG_AUTOFILL: Verifying PIN after successful biometric...")
        
        try {
            val prefs = getSharedPreferences("autofill_encrypted_data", Context.MODE_PRIVATE)
            
            // Debug: List all keys in SharedPreferences
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Checking SharedPreferences keys...")
            val allKeys = prefs.all.keys
            Log.d(TAG, "DEBUG_AUTOFILL: 📦 Total keys in SharedPreferences: ${allKeys.size}")
            
            // Get encrypted master password from SharedPreferences
            val encryptedMPJson = prefs.getString("encrypted_master_password", null)
            val mpIVJson = prefs.getString("encrypted_mp_iv", null)
            val mpTagJson = prefs.getString("encrypted_mp_tag", null)
            val fixedSaltJson = prefs.getString("fixed_salt", null)
            
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Encrypted MP found: ${encryptedMPJson != null}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 MP IV found: ${mpIVJson != null}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 MP Tag found: ${mpTagJson != null}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Fixed Salt found: ${fixedSaltJson != null}")
            
            if (encryptedMPJson == null || mpIVJson == null || mpTagJson == null || fixedSaltJson == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Encrypted master password data not found in AsyncStorage")
                Log.e(TAG, "DEBUG_AUTOFILL: 💡 Please unlock the app first to cache encrypted data")
                Toast.makeText(this, "Please unlock the app first, then try autofill again", Toast.LENGTH_LONG).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }
            
            val encryptedMP = encryptedMPJson.trim('"')
            val mpIV = mpIVJson.trim('"')
            val mpTag = mpTagJson.trim('"')
            val fixedSalt = fixedSaltJson.trim('"')
            
            Log.d(TAG, "DEBUG_AUTOFILL: 🔓 Decrypting user master password with PIN...")
            
            // Decrypt the user's master password using PIN
            val decryptedUserMP = decryptMasterPasswordWithPin(encryptedMP, mpIV, mpTag, pin, fixedSalt)
            
            if (decryptedUserMP == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Failed to decrypt master password with PIN (wrong PIN)")
                Toast.makeText(this, "Incorrect PIN", Toast.LENGTH_SHORT).show()
                showPinPrompt() // Show again
                return
            }
            
            // Generate static master password for credential decryption (uid::email::salt[0:16])
            val userId = prefs.getString("user_id", null)
            val userEmail = prefs.getString("user_email", "anonymous")
            
            if (userId == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ User ID not found in SharedPreferences")
                Toast.makeText(this, "User data not cached", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }
            
            val saltPrefix = fixedSalt.substring(0, minOf(16, fixedSalt.length))
            val staticMasterPassword = "$userId::$userEmail::$saltPrefix"
            
            // Store static master password for credential decryption
            decryptedMasterPassword = staticMasterPassword
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ PIN verified and static master password generated")
            Toast.makeText(this, "Authentication successful", Toast.LENGTH_SHORT).show()
            handleAuthenticationSuccess()
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error verifying PIN", e)
            Toast.makeText(this, "Error verifying PIN: ${e.message}", Toast.LENGTH_SHORT).show()
            showPinPrompt() // Show again
        }
    }
    
    private fun verifyMasterPasswordAndPinThenProceed(masterPassword: String, pin: String) {
        Log.d(TAG, "DEBUG_AUTOFILL: Verifying master password + PIN fallback...")
        
        try {
            // Get SharedPreferences (accessible from autofill service)
            val prefs = getSharedPreferences("autofill_encrypted_data", Context.MODE_PRIVATE)
            
            // Step 1: Get encrypted master password from SharedPreferences
            val encryptedMPJson = prefs.getString("encrypted_master_password", null)
            val mpIVJson = prefs.getString("encrypted_mp_iv", null)
            val mpTagJson = prefs.getString("encrypted_mp_tag", null)
            val fixedSaltJson = prefs.getString("fixed_salt", null)
            
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Encrypted MP found: ${encryptedMPJson != null}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 MP IV found: ${mpIVJson != null}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 MP Tag found: ${mpTagJson != null}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Fixed Salt found: ${fixedSaltJson != null}")
            
            if (encryptedMPJson == null || mpIVJson == null || mpTagJson == null || fixedSaltJson == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Encrypted master password data not found in AsyncStorage")
                Log.e(TAG, "DEBUG_AUTOFILL: 💡 Please unlock the app first to cache encrypted data")
                Toast.makeText(this, "Please unlock the app first, then try autofill again", Toast.LENGTH_LONG).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }
            
            val encryptedMP = encryptedMPJson.trim('"')
            val mpIV = mpIVJson.trim('"')
            val mpTag = mpTagJson.trim('"')
            val fixedSalt = fixedSaltJson.trim('"')
            
            Log.d(TAG, "DEBUG_AUTOFILL: 🔓 Decrypting user master password with PIN...")
            
            // Step 2: Decrypt the user's master password using PIN
            val decryptedUserMP = decryptMasterPasswordWithPin(encryptedMP, mpIV, mpTag, pin, fixedSalt)
            
            if (decryptedUserMP == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Failed to decrypt master password with PIN")
                Toast.makeText(this, "Incorrect PIN", Toast.LENGTH_SHORT).show()
                showMasterPasswordAndPinPrompt() // Show again
                return
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Master password decrypted with PIN")
            
            // Step 3: Compare decrypted master password with user input
            Log.d(TAG, "DEBUG_AUTOFILL: Comparing decrypted password with user input")
            
            if (decryptedUserMP.trim() != masterPassword.trim()) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Password verification failed")
                Toast.makeText(this, "Incorrect master password", Toast.LENGTH_SHORT).show()
                showMasterPasswordAndPinPrompt() // Show again
                return
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Master password verified successfully!")
            
            // Step 4: Generate static master password for credential decryption (uid::email::salt[0:16])
            val userId = prefs.getString("user_id", null)
            val userEmail = prefs.getString("user_email", "anonymous")
            
            if (userId == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ User ID not found in SharedPreferences")
                Toast.makeText(this, "User data not cached", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }
            
            val saltPrefix = fixedSalt.substring(0, minOf(16, fixedSalt.length))
            val staticMasterPassword = "$userId::$userEmail::$saltPrefix"
            
            // Store static master password for credential decryption
            decryptedMasterPassword = staticMasterPassword
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ User master password decrypted successfully with PIN")
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Static master password generated for credential decryption")
            Toast.makeText(this, "Authentication successful", Toast.LENGTH_SHORT).show()
            handleAuthenticationSuccess()
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error verifying credentials", e)
            Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            showMasterPasswordAndPinPrompt() // Show again
        }
    }
    
    private fun hashPin(pin: String): String {
        return try {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            val hashBytes = digest.digest(pin.toByteArray(Charsets.UTF_8))
            android.util.Base64.encodeToString(hashBytes, android.util.Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error hashing PIN", e)
            ""
        }
    }
    
    private fun decryptMasterPasswordWithPin(
        encryptedMP: String,
        mpIV: String,
        mpTag: String,
        pin: String,
        fixedSalt: String
    ): String? {
        return try {
            Log.d(TAG, "DEBUG_AUTOFILL: 🔑 Deriving decryption key from PIN + salt...")
            
            // Derive key from PIN + salt using PBKDF2 (same as React Native)
            // CRITICAL: Must match React Native CRYPTO_CONSTANTS.KEY_LENGTH = 32 bytes (256 bits)
            val iterations = 10000 // Match React Native PBKDF2_ITERATIONS = 10000
            val keyLength = 32 // 32 bytes = 256 bits (AES-256)
            
            val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val spec = PBEKeySpec(
                pin.toCharArray(),
                fixedSalt.toByteArray(Charsets.UTF_8),
                iterations,
                keyLength * 8
            )
            
            val derivedKey = factory.generateSecret(spec)
            val keyBytes = derivedKey.encoded
            val keyHex = bytesToHex(keyBytes)
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Decryption key derived (${keyBytes.size} bytes)")
            
            // Verify authentication tag
            val expectedTag = computeHmacSHA256Tag(encryptedMP + mpIV, keyHex)
            
            if (expectedTag != mpTag) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Authentication tag verification failed")
                Log.e(TAG, "DEBUG_AUTOFILL: Expected tag: ${expectedTag.substring(0, 16)}...")
                Log.e(TAG, "DEBUG_AUTOFILL: Stored tag: ${mpTag.substring(0, 16)}...")
                return null
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Authentication tag verified")
            
            // Decrypt using Manual CTR Mode (CryptoJS-compatible)
            Log.d(TAG, "🔧 [FIX v8] Using Manual CTR Mode to work around CryptoJS sigBytes bug")
            Log.d(TAG, "   Root cause: CryptoJS 12-byte IV creates WordArray with sigBytes=12")
            Log.d(TAG, "   Bug: counter[3] increments but sigBytes stays 12, so it's ignored")
            Log.d(TAG, "   Result: All blocks reuse same counter → same keystream (cyclically)")
            
            val cipherBytes = hexToBytes(encryptedMP)
            val ivBytes = hexToBytes(mpIV)
            
            val decryptedBytes = decryptWithManualCTR(cipherBytes, keyBytes, ivBytes)
            val plaintext = String(decryptedBytes, Charsets.UTF_8)
            
            if (plaintext.isEmpty()) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Decryption resulted in empty data")
                return null
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Master password decrypted successfully")
            return plaintext
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error decrypting master password with PIN", e)
            return null
        }
    }
    
    /**
     * Decrypt credential password using master password
     * Same algorithm as decryptMasterPasswordWithPin but uses master password instead of PIN
     */
    private fun decryptCredentialPassword(
        encryptedPassword: String,
        iv: String,
        tag: String,
        salt: String,
        masterPassword: String
    ): String? {
        return try {
            Log.d(TAG, "DEBUG_AUTOFILL: 🔑 Deriving decryption key from master password + salt...")
            
            // Derive key from master password + salt using PBKDF2 (same as React Native)
            val iterations = 10000 // Match React Native PBKDF2_ITERATIONS
            val keyLength = 32 // 32 bytes = 256 bits (AES-256)
            
            val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val spec = PBEKeySpec(
                masterPassword.toCharArray(),
                salt.toByteArray(Charsets.UTF_8),
                iterations,
                keyLength * 8
            )
            
            val derivedKey = factory.generateSecret(spec)
            val keyBytes = derivedKey.encoded
            val keyHex = bytesToHex(keyBytes)
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Decryption key derived (${keyBytes.size} bytes)")
            
            // Verify authentication tag
            val expectedTag = computeHmacSHA256Tag(encryptedPassword + iv, keyHex)
            
            if (expectedTag != tag) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Authentication tag verification failed for credential")
                Log.e(TAG, "DEBUG_AUTOFILL: Expected tag: ${expectedTag.substring(0, 16)}...")
                Log.e(TAG, "DEBUG_AUTOFILL: Stored tag: ${tag.substring(0, 16)}...")
                return null
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Authentication tag verified for credential")
            
            // Decrypt using Manual CTR Mode (CryptoJS-compatible)
            Log.d(TAG, "🔧 [FIX v8] Using Manual CTR Mode for credential decryption (CryptoJS sigBytes bug workaround)")
            
            val cipherBytes = hexToBytes(encryptedPassword)
            val ivBytes = hexToBytes(iv)
            
            val decryptedBytes = decryptWithManualCTR(cipherBytes, keyBytes, ivBytes)
            val plaintext = String(decryptedBytes, Charsets.UTF_8)
            
            if (plaintext.isEmpty()) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Decryption resulted in empty credential password")
                return null
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Credential password decrypted successfully")
            return plaintext
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error decrypting credential password", e)
            return null
        }
    }
    
    private fun computeHmacSHA256Tag(data: String, keyHex: String): String {
        return try {
            val keyBytes = hexToBytes(keyHex)
            val mac = javax.crypto.Mac.getInstance("HmacSHA256")
            val keySpec = javax.crypto.spec.SecretKeySpec(keyBytes, "HmacSHA256")
            mac.init(keySpec)
            
            val hmacBytes = mac.doFinal(data.toByteArray(Charsets.UTF_8))
            val fullTag = bytesToHex(hmacBytes)
            
            // Return first 32 characters (16 bytes = 128 bits) to match TAG_LENGTH
            fullTag.substring(0, 32)
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error computing HMAC", e)
            ""
        }
    }
    
    private fun bytesToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02x".format(it) }
    }
    
    private fun hexToBytes(hex: String): ByteArray {
        val len = hex.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(hex[i], 16) shl 4) + Character.digit(hex[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
    
    private fun verifyMasterPasswordHash(password: String, hash: String, salt: String): Boolean {
        return try {
            // Import the crypto utilities from the app
            // Using PBKDF2 with SHA-256 for password hashing verification
            val iterations = 100000
            val keyLength = 64
            
            // Derive key from password using PBKDF2
            val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val spec = javax.crypto.spec.PBEKeySpec(
                password.toCharArray(),
                salt.toByteArray(Charsets.UTF_8),
                iterations,
                keyLength * 8
            )
            
            val derivedKey = factory.generateSecret(spec)
            val derived = derivedKey.encoded
            val derivedHashBase64 = android.util.Base64.encodeToString(derived, android.util.Base64.NO_WRAP)
            
            Log.d(TAG, "DEBUG_AUTOFILL: Comparing hashes...")
            // Compare the derived hash with stored hash
            derivedHashBase64 == hash
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error during password verification", e)
            false
        }
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

        // --- SYNCHRONOUS DECRYPTION IN KOTLIN ---
        Log.d(TAG, "DEBUG_AUTOFILL: 🔒 Password is encrypted - decrypting in Kotlin...")
        
        // Decrypt directly using master password
        performDecryptionRequest(credential)
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



    private fun performDecryptionRequest(credential: AutofillCredential) {
        try {
            // Check if we have decrypted master password
            val masterPassword = decryptedMasterPassword
            if (masterPassword == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ No master password available for decryption")
                Toast.makeText(this, "Master password not available", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }

            Log.d(TAG, "DEBUG_AUTOFILL: � Decrypting credential password directly in Kotlin...")
            
            // Decrypt credential password using master password
            val decryptedPassword = decryptCredentialPassword(
                encryptedPassword = credential.password,
                iv = credential.iv,
                tag = credential.tag,
                salt = credential.salt,
                masterPassword = masterPassword
            )
            
            if (decryptedPassword == null) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Failed to decrypt credential password")
                Toast.makeText(this, "Failed to decrypt password", Toast.LENGTH_SHORT).show()
                setResultAndFinish(RESULT_CANCELED)
                return
            }
            
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Credential password decrypted successfully")
            
            // Create decrypted credential and proceed
            val decryptedCredential = credential.copy(
                password = decryptedPassword,
                isEncrypted = false
            )
            
            proceedWithCredential(decryptedCredential)
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error performing decryption request", e)
            Toast.makeText(this, "Decryption error: ${e.message}", Toast.LENGTH_SHORT).show()
            setResultAndFinish(RESULT_CANCELED)
        }
    }



    /**
     * Manual CTR Mode Decryption (CryptoJS-compatible)
     * 
     * FIX v8: CryptoJS CTR mode has a CRITICAL BUG with 12-byte IVs!
     * 
     * ROOT CAUSE DISCOVERED:
     * - CryptoJS creates WordArray from 12-byte IV with sigBytes=12 (only 3 words)
     * - When incrementing counter[3] (4th word), the value changes BUT sigBytes stays 12!
     * - When converting to bytes for encryption, only first 12 bytes are used (counter[0-2])
     * - Result: counter[3] is IGNORED, so all blocks use THE SAME counter value
     * - This causes all blocks to reuse THE SAME keystream (just different offsets)
     * 
     * SOLUTION:
     * - Generate keystream ONCE from the 12-byte IV (padded to 16 bytes with zeros)
     * - Reuse this keystream cyclically for all ciphertext bytes
     * - Block 0: XOR with keystream[0-15]
     * - Block 1: XOR with keystream[0-1] (bytes 16-17 reuse keystream start)
     * 
     * @param ciphertext Encrypted data bytes
     * @param key AES key bytes (32 bytes for AES-256)
     * @param iv Initialization vector (12 bytes from CryptoJS)
     * @return Decrypted plaintext bytes
     */
    private fun decryptWithManualCTR(
        ciphertext: ByteArray,
        key: ByteArray,
        iv: ByteArray
    ): ByteArray {
        try {
            Log.d(TAG, "🔧 [MANUAL CTR FIX v8] Starting decryption (${ciphertext.size} bytes)")
            
            // Use AES/ECB to encrypt counter blocks
            val cipher = javax.crypto.Cipher.getInstance("AES/ECB/NoPadding")
            cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, javax.crypto.spec.SecretKeySpec(key, "AES"))

            val plaintext = ByteArray(ciphertext.size)
            
            // Create counter block from 12-byte IV (pad with zeros to 16 bytes)
            // CRITICAL: Due to CryptoJS sigBytes bug, this counter NEVER changes!
            val counterBlock = ByteArray(16)
            System.arraycopy(iv, 0, counterBlock, 0, 12)
            // Bytes 12-15 remain 0x00 (counter starts at 0, but never increments due to bug)
            
            // Generate keystream ONCE - this is the ONLY keystream used for all blocks
            val keystream = cipher.doFinal(counterBlock)
            
            // XOR ciphertext with keystream (cycling keystream every 16 bytes)
            // Block 0: bytes 0-15 XOR keystream[0-15]
            // Block 1: bytes 16-17 XOR keystream[0-1] (REUSE!)
            for (i in ciphertext.indices) {
                val keystreamByte = keystream[i % 16].toInt() and 0xFF
                val ciphertextByte = ciphertext[i].toInt() and 0xFF
                plaintext[i] = (ciphertextByte xor keystreamByte).toByte()
            }
            
            Log.d(TAG, "✅ [MANUAL CTR] Decryption complete (${plaintext.size} bytes)")
            
            return plaintext
        } catch (e: Exception) {
            Log.e(TAG, "❌ [MANUAL CTR] Decryption error", e)
            throw e
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "DEBUG_AUTOFILL: AutofillAuthActivity destroyed")
        
        // Clear decrypted master password from memory
        decryptedMasterPassword = null
        
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