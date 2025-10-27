package com.passwordepic.mobile

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import android.widget.EditText
import android.widget.Button
import android.widget.TextView
import android.widget.ImageButton
import android.content.Context
import android.view.autofill.AutofillManager
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONException
import com.passwordepic.mobile.autofill.AutofillBridge
import androidx.biometric.BiometricPrompt
import java.util.concurrent.Executors


/**
 * Simple test activity to verify autofill service works with native EditText fields
 */
class AutofillTestActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "AutofillTestActivity"
        
        // Static reference to current activity instance so AutofillBridge can access it
        private var currentInstance: AutofillTestActivity? = null
        
        fun getInstance(): AutofillTestActivity? = currentInstance
        fun setInstance(instance: AutofillTestActivity?) {
            currentInstance = instance
            if (instance != null) {
                Log.d(TAG, "🔗 AutofillTestActivity instance registered globally")
            } else {
                Log.d(TAG, "🔗 AutofillTestActivity instance cleared")
            }
        }
    }

    // Instance variables for pending decryption result
    private var pendingDecryptResult: TextView? = null
    private var decryptedPasswordText: TextView? = null
    private var encryptedPasswordText: TextView? = null
    private var pendingEmail: String? = null
    private var pendingPlaintextPassword: String? = null
    private var pendingCredential: JSONObject? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "🚀 AutofillTestActivity created - testing autofill")
        
        // Register this activity instance globally so AutofillBridge can access it
        setInstance(this)
        
        // Check autofill service status
        checkAutofillServiceStatus()
        
        // Log available credentials from React Native
        verifyCredentialsFromApp()

        // Create simple layout programmatically
        setContentView(R.layout.activity_autofill_test)

        val backButton = findViewById<ImageButton>(R.id.backButton)
        val emailField = findViewById<EditText>(R.id.emailField)
        val passwordField = findViewById<EditText>(R.id.passwordField)
        val loginButton = findViewById<Button>(R.id.loginButton)
        val resultText = findViewById<TextView>(R.id.resultText)
        this.encryptedPasswordText = findViewById<TextView>(R.id.encryptedPasswordText)
        this.decryptedPasswordText = findViewById<TextView>(R.id.decryptedPasswordText)

        backButton.setOnClickListener {
            Log.d(TAG, "🔙 Back button clicked - finishing activity")
            finish()
        }

        // Log when fields get focus (autofill should trigger here)
        emailField.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                Log.d(TAG, "✅ Email field focused - autofill request should trigger")
            }
        }

        passwordField.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                Log.d(TAG, "✅ Password field focused - autofill request should trigger")
            }
        }

        // Login button to show entered values and attempt decryption
        loginButton.setOnClickListener {
            val email = emailField.text.toString()
            val passwordFromField = passwordField.text.toString()
            Log.d(TAG, "✅ Login button clicked - Email: $email")
            
            // Don't save encrypted password as "plaintext" - let decryption process handle it
            // The field might contain encrypted password from autofill, which will be decrypted
            Log.d(TAG, "📝 Password field value (${passwordFromField.length} chars) will be processed by decryption flow")
            
            // Try to decrypt the password
            resultText.text = "Decrypting password..."
            decryptAutofillPassword(email, passwordFromField, resultText)
        }
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "📱 AutofillTestActivity resumed")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            Log.d(TAG, "🪟 Window focus gained - requesting focus on email field for autofill")
            try {
                val emailField = findViewById<EditText>(R.id.emailField)
                // Ensure the field is visible and enabled before requesting focus
                emailField.isEnabled = true
                emailField.isFocusableInTouchMode = true
                emailField.requestFocus()
                Log.d(TAG, "✅ Email field focus requested in onWindowFocusChanged - autofill should trigger now")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error requesting focus: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Clear the global instance reference
        setInstance(null)
        Log.d(TAG, "🚀 AutofillTestActivity destroyed")
    }

    private fun verifyCredentialsFromApp() {
        try {
            Log.d(TAG, "🔍 Checking credentials from React Native app...")
            val prefs = getSharedPreferences("autofill_data", Context.MODE_PRIVATE)
            val credentialsJson = prefs.getString("credentials", null)
            
            if (credentialsJson.isNullOrEmpty()) {
                Log.w(TAG, "⚠️ No credentials found in SharedPreferences yet")
                Log.w(TAG, "💡 Save a password in PasswordEpic app first, then open this test activity")
                Log.w(TAG, "💡 The app will automatically sync credentials via AutofillBridge.prepareCredentials()")
            } else {
                try {
                    val creds = JSONArray(credentialsJson)
                    Log.d(TAG, "✅ Found ${creds.length()} credentials from React Native app:")
                    for (i in 0 until creds.length()) {
                        val cred = creds.getJSONObject(i)
                        Log.d(TAG, "   📌 Domain: ${cred.optString("domain")}, Username: ${cred.optString("username")}")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "⚠️ Could not parse credentials JSON: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error verifying credentials", e)
        }
    }

    /**
     * Decrypt autofill password by email
     * Retrieves encrypted password components from SharedPreferences and sends to React Native for decryption
     */
    private fun decryptAutofillPassword(email: String, encryptedPasswordField: String, resultText: TextView) {
        try {
            Log.d(TAG, "🔓 Starting password decryption for email: $email")
            
            // Get credentials from SharedPreferences
            val prefs = getSharedPreferences("autofill_data", Context.MODE_PRIVATE)
            val credentialsJson = prefs.getString("credentials", null)
            
            if (credentialsJson.isNullOrEmpty()) {
                Log.e(TAG, "❌ No credentials found in SharedPreferences")
                resultText.text = "❌ Error: No stored credentials found"
                return
            }
            
            Log.d(TAG, "📋 Raw credentials JSON (first 300 chars): ${credentialsJson.substring(0, Math.min(300, credentialsJson.length))}")
            
            try {
                // Find matching credential by email/username
                val allCreds = JSONArray(credentialsJson)
                Log.d(TAG, "📊 Total credentials in array: ${allCreds.length()}")
                var matchedCredential: JSONObject? = null
                
                for (i in 0 until allCreds.length()) {
                    val cred = allCreds.getJSONObject(i)
                    val username = cred.optString("username", "")
                    Log.d(TAG, "   [${i}] Checking credential with username: $username")
                    if (username.equals(email, ignoreCase = true)) {
                        matchedCredential = cred
                        Log.d(TAG, "✅ Found matching credential for: $email")
                        break
                    }
                }
                
                if (matchedCredential == null) {
                    Log.w(TAG, "⚠️ No credential found matching email: $email")
                    resultText.text = "⚠️ Warning: No stored credential found for this email"
                    return
                }
                
                Log.d(TAG, "📋 Matched credential keys: ${matchedCredential.keys().asSequence().toList()}")
                Log.d(TAG, "📋 Full credential JSON: ${matchedCredential.toString()}")
                
                // STEP 1: Check if credential was stored with encryption metadata
                val credentialSalt = matchedCredential.optString("salt", "")
                val credentialIv = matchedCredential.optString("iv", "")
                val credentialTag = matchedCredential.optString("tag", "")
                Log.d(TAG, "📊 STEP 1 - Credential encryption metadata:")
                Log.d(TAG, "   ✓ salt present: ${credentialSalt.isNotEmpty()}")
                Log.d(TAG, "   ✓ iv present: ${credentialIv.isNotEmpty()}")
                Log.d(TAG, "   ✓ tag present: ${credentialTag.isNotEmpty()}")
                
                // Check if password is encrypted using the 'encrypted' flag from credential
                val isEncrypted = matchedCredential.optBoolean("encrypted", false)
                
                Log.d(TAG, "🔐 Credential encrypted flag: $isEncrypted")
                
                if (isEncrypted) {
                    Log.d(TAG, "🔒 Password is encrypted - attempting decryption")
                    
                    // Try to get password as JSONObject first (new format with encryption components)
                    val passwordValue = try {
                        val passwordObj = matchedCredential.getJSONObject("password")
                        Log.d(TAG, "✅ Password stored as JSON object with encryption components")
                        passwordObj.toString()
                    } catch (e: JSONException) {
                        // If not a JSONObject, try getting as string (hex-encoded or stringified JSON)
                        val passwordStr = matchedCredential.optString("password", "")
                        Log.d(TAG, "📦 Password value (hex/string format): ${passwordStr.substring(0, Math.min(200, passwordStr.length))}")
                        
                        // Check if it looks like JSON
                        if (passwordStr.trim().startsWith("{")) {
                            try {
                                // Try to parse as stringified JSON
                                val obj = JSONObject(passwordStr)
                                Log.d(TAG, "✅ Password is stringified JSON - parsed successfully")
                                obj.toString()
                            } catch (jsonError: Exception) {
                                // Not valid JSON, but marked as encrypted - assume it's hex ciphertext
                                Log.d(TAG, "ℹ️ Password is encrypted hex ciphertext (not JSON format)")
                                passwordStr
                            }
                        } else {
                            // Hex-encoded encrypted password (most common format)
                            Log.d(TAG, "ℹ️ Password is encrypted hex ciphertext format")
                            passwordStr
                        }
                    }
                    
                    // Store credential for decryption simulation
                    this.pendingCredential = matchedCredential
                    decryptEncryptedPassword(email, passwordValue, resultText)
                } else {
                    // Password is plaintext - get as string
                    Log.d(TAG, "✅ Password is plaintext - using directly")
                    val passwordField = matchedCredential.optString("password", "")
                    // Store plaintext for use in simulation
                    this.pendingPlaintextPassword = passwordField
                    resultText.text = "Email: $email\n✅ Password: $passwordField\n(plaintext - no decryption needed)"
                    
                    // Show in encrypted password section (since this is what autofill would have filled)
                    if (this.encryptedPasswordText != null) {
                        this.encryptedPasswordText!!.text = passwordField
                        this.encryptedPasswordText!!.setTextColor(android.graphics.Color.parseColor("#1B5E20"))
                    }
                    
                    // Also show in decrypted password section
                    if (this.decryptedPasswordText != null) {
                        this.decryptedPasswordText!!.text = passwordField
                        this.decryptedPasswordText!!.setTextColor(android.graphics.Color.parseColor("#228B22"))
                    }
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error parsing credentials JSON: ${e.message}", e)
                Log.e(TAG, "❌ Full credentials JSON: $credentialsJson")
                resultText.text = "❌ Error: Invalid credentials data\n${e.message}"
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error during password decryption: ${e.message}", e)
            resultText.text = "❌ Error: ${e.message}"
        }
    }
    
    /**
     * Decrypt encrypted password using React Native bridge with biometric authentication
     */
    private fun decryptEncryptedPassword(email: String, encryptedPasswordJson: String, resultText: TextView) {
        try {
            Log.d(TAG, "🔐 Attempting to decrypt encrypted password...")
            Log.d(TAG, "📦 Encrypted data length: ${encryptedPasswordJson.length} chars")
            Log.d(TAG, "📦 First 100 chars: ${encryptedPasswordJson.substring(0, Math.min(100, encryptedPasswordJson.length))}")
            
            // Display the encrypted password for user to see
            if (encryptedPasswordText != null) {
                encryptedPasswordText!!.text = encryptedPasswordJson
                encryptedPasswordText!!.setTextColor(android.graphics.Color.parseColor("#B71C1C"))
                Log.d(TAG, "✅ Displayed encrypted password (hex/JSON)")
            }
            
            // Check if it's JSON format or hex-encoded ciphertext
            val isJsonFormat = encryptedPasswordJson.trim().startsWith("{")
            
            // Show message that user needs to authenticate
            resultText.text = "🔐 Password is encrypted\n\n⏳ Requiring biometric authentication to decrypt...\n\n(Please unlock your device or use fingerprint)"
            
            if (!isJsonFormat) {
                // Hex-encoded ciphertext format (legacy or simplified storage)
                Log.d(TAG, "ℹ️ Password is hex-encoded ciphertext")
                Log.d(TAG, "📦 Hex ciphertext: $encryptedPasswordJson")
                
                // STEP 2: Extract encryption metadata from credential for hex format
                Log.d(TAG, "📊 STEP 2 - Extracting metadata from credential:")
                val metadataFromCredential = try {
                    val credSalt = this.pendingCredential?.optString("salt", "") ?: ""
                    val credIv = this.pendingCredential?.optString("iv", "") ?: ""
                    val credTag = this.pendingCredential?.optString("tag", "") ?: ""
                    Log.d(TAG, "   ✓ salt from credential: ${credSalt.take(20)}... (${credSalt.length} chars)")
                    Log.d(TAG, "   ✓ iv from credential: ${credIv.take(20)}... (${credIv.length} chars)")
                    Log.d(TAG, "   ✓ tag from credential: ${credTag.take(20)}... (${credTag.length} chars)")
                    Triple(credSalt, credIv, credTag)
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error extracting metadata: ${e.message}")
                    Triple("", "", "")
                }
                
                // Prepare decryption data for React Native - hex format
                val decryptRequest = JSONObject().apply {
                    put("encryptedPassword", encryptedPasswordJson)
                    put("passwordSalt", metadataFromCredential.first)
                    put("passwordIv", metadataFromCredential.second)
                    put("passwordAuthTag", metadataFromCredential.third)
                    put("email", email)
                    put("format", "hex")  // Add format indicator
                }
                Log.d(TAG, "📤 STEP 3 - Prepared decrypt request:")
                Log.d(TAG, "   ✓ salt being sent: ${metadataFromCredential.first.take(20)}... (${metadataFromCredential.first.length} chars)")
                Log.d(TAG, "   ✓ iv being sent: ${metadataFromCredential.second.take(20)}... (${metadataFromCredential.second.length} chars)")
                Log.d(TAG, "   ✓ tag being sent: ${metadataFromCredential.third.take(20)}... (${metadataFromCredential.third.length} chars)")
                
                // Store reference for callback
                this.pendingDecryptResult = resultText
                this.pendingEmail = email
                
                // Call React Native to trigger biometric auth and decryption
                Log.d(TAG, "📤 Sending HEX format decryption request to React Native...")
                requestBiometricDecryption(decryptRequest.toString())
                return
            }
            
            // Parse the encrypted password JSON
            val encryptedData = try {
                JSONObject(encryptedPasswordJson)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to parse encrypted password JSON: ${e.message}")
                Log.e(TAG, "❌ Full value: $encryptedPasswordJson")
                resultText.text = "❌ Error: Invalid encrypted password format\n${e.message}"
                return
            }
            
            val ciphertext = encryptedData.optString("encryptedPassword", "")
            // Try both field name formats - React Native sends "salt"/"iv"/"tag"
            // but legacy format might use "passwordSalt"/"passwordIv"/"passwordAuthTag"
            val salt = encryptedData.optString("salt", encryptedData.optString("passwordSalt", ""))
            val iv = encryptedData.optString("iv", encryptedData.optString("passwordIv", ""))
            val tag = encryptedData.optString("tag", encryptedData.optString("passwordAuthTag", ""))
            
            if (ciphertext.isEmpty()) {
                Log.w(TAG, "⚠️ Encrypted password is empty or missing")
                resultText.text = "⚠️ Encrypted password data is incomplete"
                return
            }
            
            // STEP 2: Log extracted encryption components (JSON format)
            Log.d(TAG, "📊 STEP 2 - Encryption components extracted (JSON format):")
            Log.d(TAG, "   ✓ ciphertext: ${ciphertext.take(20)}... (${ciphertext.length} chars)")
            Log.d(TAG, "   ✓ salt present: ${salt.isNotEmpty()} (${salt.length} chars)")
            Log.d(TAG, "   ✓ iv present: ${iv.isNotEmpty()} (${iv.length} chars)")
            Log.d(TAG, "   ✓ tag present: ${tag.isNotEmpty()} (${tag.length} chars)")
            
            // Prepare decryption data for React Native - JSON format
            // Send with both field name formats for compatibility
            val decryptRequest = JSONObject().apply {
                put("encryptedPassword", ciphertext)
                put("salt", salt)  // New format - matches React Native autofillService
                put("passwordSalt", salt)  // Legacy format - for backward compatibility
                put("iv", iv)  // New format
                put("passwordIv", iv)  // Legacy format
                put("tag", tag)  // New format
                put("passwordAuthTag", tag)  // Legacy format
                put("email", email)
                put("format", "json")  // Add format indicator
            }
            
            // STEP 3: Verify metadata is being sent
            Log.d(TAG, "📤 STEP 3 - Prepared decrypt request (JSON format):")
            Log.d(TAG, "   ✓ salt being sent: ${salt.take(20)}... (${salt.length} chars)")
            Log.d(TAG, "   ✓ iv being sent: ${iv.take(20)}... (${iv.length} chars)")
            Log.d(TAG, "   ✓ tag being sent: ${tag.take(20)}... (${tag.length} chars)")
            
            // Store reference for callback
            this.pendingDecryptResult = resultText
            this.pendingEmail = email
            
            // Call React Native to trigger biometric auth and decryption
            Log.d(TAG, "📤 Sending JSON format decryption request to React Native...")
            requestBiometricDecryption(decryptRequest.toString())
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error processing encrypted password", e)
            resultText.text = "❌ Error: ${e.message}"
        }
    }
    
    /**
     * Request biometric authentication and password decryption from React Native
     * Shows an actual BiometricPrompt dialog to the user
     */
    private fun requestBiometricDecryption(encryptedPasswordJson: String) {
        try {
            Log.d(TAG, "📨 Requesting biometric authentication for password decryption...")
            
            // Create BiometricPrompt callback
            val biometricCallback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Log.d(TAG, "✅ Biometric authentication successful!")
                    Log.d(TAG, "🔐 User authenticated - proceeding with password decryption...")
                    
                    // After successful biometric auth, simulate decryption
                    simulateDecryption(encryptedPasswordJson)
                }
                
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.e(TAG, "❌ Biometric authentication error: $errString (code: $errorCode)")
                    if (pendingDecryptResult != null) {
                        pendingDecryptResult!!.text = "❌ Biometric authentication failed: $errString"
                    }
                }
                
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.w(TAG, "⚠️ Biometric authentication failed - user may retry")
                    // User can retry, so we don't update UI here
                }
            }
            
            // Create BiometricPrompt
            val executor = Executors.newSingleThreadExecutor()
            val biometricPrompt = BiometricPrompt(this, executor, biometricCallback)
            
            // Create prompt info
            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("🔐 Authenticate to Decrypt Password")
                .setSubtitle("Use your fingerprint or face to unlock your password")
                .setNegativeButtonText("Cancel")
                .build()
            
            Log.d(TAG, "🎯 Showing biometric prompt to user...")
            // Show the biometric prompt
            biometricPrompt.authenticate(promptInfo)
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error showing biometric prompt", e)
            if (pendingDecryptResult != null) {
                pendingDecryptResult!!.text = "❌ Error: ${e.message}"
            }
        }
    }
    
    /**
     * Update autofill decrypt result - called from React Native after successful decryption
     * This method can be called via AutofillBridge or direct module call
     * 
     * IMPORTANT: This method handles UI updates which must run on the main thread
     */
    fun updateAutofillDecryptResult(plainTextPassword: String, success: Boolean, errorMessage: String = "") {
        // Ensure UI updates run on main thread
        runOnUiThread {
            try {
                Log.d(TAG, "📥 Received decryption result from React Native")
                
                if (success && plainTextPassword.isNotEmpty()) {
                    Log.d(TAG, "✅ Decryption successful!")
                    val resultText = pendingDecryptResult ?: return@runOnUiThread
                    resultText.text = """
                        Email: ${pendingEmail}
                        
                        🔓 Password: $plainTextPassword
                        
                        ✅ Successfully decrypted after biometric authentication
                    """.trimIndent()
                    
                    // Also show the decrypted password in the dedicated section
                    if (decryptedPasswordText != null) {
                        decryptedPasswordText!!.text = plainTextPassword
                        decryptedPasswordText!!.setTextColor(android.graphics.Color.parseColor("#228B22"))
                        Log.d(TAG, "✅ Updated decrypted password display")
                    }
                    
                    // 🔑 CRITICAL: Store plaintext password in cache for autofill to access
                    // This is the key missing piece - after successful decryption,
                    // cache the plaintext so autofill service can retrieve it
                    if (pendingCredential != null) {
                        try {
                            val passwordId = pendingCredential!!.optString("id", "")
                            if (passwordId.isNotEmpty()) {
                                Log.d(TAG, "📦 Caching plaintext password for autofill...")
                                storeDecryptedPasswordInCache(passwordId, plainTextPassword)
                            } else {
                                Log.w(TAG, "⚠️ No password ID available to cache")
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "❌ Error storing plaintext in cache: ${e.message}")
                        }
                    }
                } else {
                    Log.e(TAG, "❌ Decryption failed: $errorMessage")
                    val resultText = pendingDecryptResult ?: return@runOnUiThread
                    resultText.text = "❌ Decryption failed: $errorMessage"
                    
                    // Show error in decrypted password section
                    if (decryptedPasswordText != null) {
                        decryptedPasswordText!!.text = "❌ $errorMessage"
                        decryptedPasswordText!!.setTextColor(android.graphics.Color.parseColor("#D32F2F"))
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error updating decrypt result", e)
            } finally {
                pendingDecryptResult = null
                pendingEmail = null
            }
        }
    }
    
    /**
     * Store decrypted plaintext password in cache using AutofillBridge
     * This allows the autofill service to retrieve plaintext passwords
     * from the cache when filling forms
     */
    private fun storeDecryptedPasswordInCache(passwordId: String, plainTextPassword: String) {
        try {
            Log.d(TAG, "🔐 Calling AutofillBridge to cache plaintext password...")
            
            val module = com.passwordepic.mobile.autofill.AutofillBridge(
                (application as com.facebook.react.ReactApplication).reactNativeHost.reactInstanceManager.currentReactContext as com.facebook.react.bridge.ReactApplicationContext
            )
            
            // Call the native method directly to store the plaintext
            val prefs = getSharedPreferences("autofill_plaintext_cache", android.content.Context.MODE_PRIVATE)
            val currentTime = System.currentTimeMillis()
            val expiryTime = currentTime + 60_000  // 60-second expiry
            
            val cacheEntry = org.json.JSONObject().apply {
                put("password", plainTextPassword)
                put("storedAt", currentTime)
                put("expiresAt", expiryTime)
                put("passwordId", passwordId)
            }
            
            prefs.edit().apply {
                putString("plaintext_$passwordId", cacheEntry.toString())
                putLong("stored_at_$passwordId", currentTime)
                apply()
            }
            
            Log.d(TAG, "✅ Plaintext password cached successfully for 60 seconds!")
            Log.d(TAG, "🎯 Autofill will now be able to retrieve plaintext from cache")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error caching plaintext password: ${e.message}", e)
        }
    }
    
    /**
     * Call React Native to decrypt password after successful biometric authentication
     * 
     * Flow:
     * 1. User passes biometric auth
     * 2. This method extracts password ID from credential
     * 3. Calls React Native autofillService.decryptAutofillPasswordById()
     * 4. React Native decrypts using master key + encryption components from database
     * 5. Returns plaintext via callback
     */
    private fun simulateDecryption(encryptedPasswordJson: String) {
        try {
            Log.d(TAG, "🔐 Calling React Native to decrypt password after biometric auth...")
            
            // Parse the encrypted password request
            val encryptedData = JSONObject(encryptedPasswordJson)
            val format = encryptedData.optString("format", "json")
            
            // Extract password ID or use the stored pending credential
            val passwordId = if (pendingCredential != null) {
                pendingCredential!!.optString("id", "")
            } else {
                ""
            }
            
            if (passwordId.isEmpty()) {
                Log.e(TAG, "❌ Cannot decrypt - no password ID available")
                updateAutofillDecryptResult("", false, "Password ID not found in credential")
                return
            }
            
            Log.d(TAG, "🔑 Password ID: $passwordId")
            Log.d(TAG, "📤 Requesting decryption from React Native (format: $format)...")
            
            // Emit decryption request to React Native
            Log.d(TAG, "📞 Emitting onAutofillDecryptRequest event to React Native")
            
            Thread {
                try {
                    // Extract encrypted data
                    val ciphertext = encryptedData.optString("encryptedPassword", "")
                    val salt = encryptedData.optString("passwordSalt", "")
                    val iv = encryptedData.optString("passwordIv", "")
                    val tag = encryptedData.optString("passwordAuthTag", "")
                    val email = encryptedData.optString("email", "")
                    
                    Log.d(TAG, "🔍 DEBUG simulateDecryption extraction:")
                    Log.d(TAG, "   encryptedPasswordJson has key 'passwordSalt': ${encryptedData.has("passwordSalt")}, value=${salt.take(10)}")
                    Log.d(TAG, "   encryptedPasswordJson has key 'passwordIv': ${encryptedData.has("passwordIv")}, value=${iv.take(10)}")
                    Log.d(TAG, "   encryptedPasswordJson has key 'passwordAuthTag': ${encryptedData.has("passwordAuthTag")}, value=${tag.take(10)}")
                    Log.d(TAG, "   Full encryptedData keys: ${encryptedData.keys().asSequence().toList()}")
                    Log.d(TAG, "   Full encryptedData: ${encryptedData.toString()}")
                    
                    if (ciphertext.isEmpty()) {
                        Log.e(TAG, "❌ Ciphertext is empty - cannot decrypt")
                        runOnUiThread {
                            updateAutofillDecryptResult("", false, "Ciphertext is empty")
                        }
                        return@Thread
                    }
                    
                    Log.d(TAG, "🔐 Encrypted password received from credential")
                    Log.d(TAG, "📦 Sending decryption request to React Native via event emission...")
                    
                    // Get React Native context from static holder (set by AutofillBridge during initialization)
                    val reactContext = com.passwordepic.mobile.MainApplication.getReactContext()
                    
                    if (reactContext != null) {
                        Log.d(TAG, "✅ React context available from MainApplication")
                        val eventData = com.facebook.react.bridge.Arguments.createMap().apply {
                            putString("passwordId", passwordId)
                            putString("email", email)
                            putString("encryptedPassword", ciphertext)
                            putString("passwordSalt", salt)
                            putString("passwordIv", iv)
                            putString("passwordAuthTag", tag)
                            putString("format", format)
                        }
                        
                        Log.d(TAG, "📤 FINAL DEBUG - Sending to React Native:")
                        Log.d(TAG, "   passwordSalt length: ${salt.length} (empty: ${salt.isEmpty()})")
                        Log.d(TAG, "   passwordIv length: ${iv.length} (empty: ${iv.isEmpty()})")
                        Log.d(TAG, "   passwordAuthTag length: ${tag.length} (empty: ${tag.isEmpty()})")
                        
                        // Emit event to React Native for decryption
                        reactContext.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("onAutofillDecryptRequest", eventData)
                        
                        Log.d(TAG, "✅ Decryption request sent to React Native")
                        Log.d(TAG, "⏳ Waiting for React Native to decrypt and call updateAutofillDecryptResult()...")
                    } else {
                        Log.e(TAG, "❌ React Native context not available - AutofillBridge may not have been initialized yet")
                        runOnUiThread {
                            updateAutofillDecryptResult("", false, "React Native context not available - ensure app is running in background")
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error during decryption request", e)
                    runOnUiThread {
                        updateAutofillDecryptResult("", false, e.message ?: "Unknown error")
                    }
                }
            }.start()
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error requesting decryption from React Native", e)
            updateAutofillDecryptResult("", false, e.message ?: "Unknown error")
        }
    }
    
    /**
     * Decrypt hex-encoded password using React Native
     * Only uses encrypted password, no plaintext fallbacks
     */
    private fun decryptHexPassword(hexCiphertext: String): String {
        return try {
            Log.d(TAG, "🔐 Attempting to decrypt HEX format password using React Native...")
            Log.d(TAG, "📦 Encrypted ciphertext length: ${hexCiphertext.length} chars")
            
            // Only use encrypted password - no plaintext lookups
            if (hexCiphertext.isEmpty()) {
                Log.e(TAG, "❌ ERROR_HEX_EMPTY_CIPHERTEXT: Encrypted password is empty")
                "ERROR_HEX_EMPTY_CIPHERTEXT"
            } else {
                Log.d(TAG, "📤 Sending encrypted hex password to React Native for decryption")
                // Return the ciphertext - React Native will handle actual decryption
                // This will be processed by the React Native bridge
                "PENDING_REACT_NATIVE_DECRYPTION"
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in HEX decryption: ${e.message}", e)
            "ERROR_HEX_DECRYPT"
        }
    }
    
    /**
     * Decrypt JSON-formatted password using React Native
     * Only uses encrypted password components, no plaintext fallbacks
     */
    private fun decryptJsonPassword(ciphertext: String, salt: String, iv: String, tag: String): String {
        return try {
            Log.d(TAG, "🔐 Attempting to decrypt JSON format password using React Native...")
            Log.d(TAG, "🔐 Components: ciphertext=${ciphertext.length}chars, salt=${salt.length}chars, iv=${iv.length}chars, tag=${tag.length}chars")
            
            // Only use encrypted password components - no plaintext lookups
            if (ciphertext.isEmpty()) {
                Log.e(TAG, "❌ ERROR_JSON_EMPTY_CIPHERTEXT: Ciphertext is empty")
                "ERROR_JSON_EMPTY_CIPHERTEXT"
            } else {
                Log.d(TAG, "📤 Sending encrypted JSON components to React Native for decryption")
                Log.d(TAG, "   - Ciphertext: ${ciphertext.take(20)}...")
                Log.d(TAG, "   - Salt: ${salt.take(20)}...")
                Log.d(TAG, "   - IV: ${iv.take(20)}...")
                Log.d(TAG, "   - Tag: ${tag.take(20)}...")
                // Return pending status - React Native will handle actual decryption
                // This will be processed by the React Native bridge
                "PENDING_REACT_NATIVE_DECRYPTION"
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error in JSON decryption: ${e.message}", e)
            "ERROR_JSON_DECRYPT"
        }
    }

    private fun checkAutofillServiceStatus() {
        try {
            val autofillManager = getSystemService(AutofillManager::class.java)
            
            if (autofillManager == null) {
                Log.e(TAG, "❌ CRITICAL: AutofillManager is null - autofill not available on this device")
                return
            }
            
            val isEnabled = autofillManager.isEnabled
            Log.d(TAG, "🔍 Autofill enabled on device: $isEnabled")
            
            if (!isEnabled) {
                Log.w(TAG, "⚠️ WARNING: Autofill is disabled on this device!")
                Log.w(TAG, "⚠️ Go to Settings > System > Languages & input > Advanced > Autofill to enable it")
            }
            
            val currentService = autofillManager.getAutofillServiceComponentName()
            if (currentService == null) {
                Log.w(TAG, "⚠️ WARNING: No autofill service is currently selected!")
                Log.w(TAG, "⚠️ Go to Settings > System > Languages & input > Advanced > Autofill service and select PasswordEpic")
            } else {
                Log.d(TAG, "✅ Current autofill service: $currentService")
                val isPasswordEpic = currentService.packageName.contains("passwordepic", ignoreCase = true)
                if (isPasswordEpic) {
                    Log.d(TAG, "✅ PasswordEpic is the active autofill service!")
                } else {
                    Log.w(TAG, "⚠️ Different autofill service is active: $currentService")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error checking autofill status", e)
        }
    }
}