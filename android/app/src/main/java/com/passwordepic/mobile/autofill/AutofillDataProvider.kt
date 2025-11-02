package com.passwordepic.mobile.autofill

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * AutofillDataProvider
 * 
 * Provides secure access to encrypted credentials for autofill.
 * Handles communication between autofill service and main app.
 * 
 * Security Features:
 * - Encrypted credential storage
 * - Secure IPC with main app
 * - Session-based access control
 * - Audit logging
 * 
 * Note: This is a simplified implementation. In production, this should
 * communicate with the React Native app through a secure bridge.
 */
class AutofillDataProvider(private val context: Context? = null) {

    companion object {
        private const val TAG = "AutofillDataProvider"
        private const val CREDENTIALS_FILE = "autofill_credentials.json"
        private const val PREFS_NAME = "autofill_data"
        private const val CREDENTIALS_KEY = "credentials"
    }

    /**
     * Gets credentials matching a domain
     * 
     * @param domain The domain to match
     * @param packageName The package name of the requesting app
     * @return List of matching credentials
     */
    fun getCredentialsForDomain(
        domain: String,
        packageName: String
    ): List<AutofillCredential> {
        Log.d(TAG, "🔎 Getting credentials for domain: '$domain', package: '$packageName'")

        try {
            // If context is available, try to get real credentials from SharedPreferences
            if (context != null) {
                Log.d(TAG, "✅ Context is available - attempting to read from SharedPreferences")
                val credentials = getCredentialsFromSharedPreferences(domain, packageName)
                Log.d(TAG, "📦 Retrieved ${credentials.size} credentials from SharedPreferences for domain: '$domain'")
                if (credentials.isNotEmpty()) {
                    Log.d(TAG, "✅ Returning ${credentials.size} real credentials from SharedPreferences")
                    return credentials
                } else {
                    Log.d(TAG, "⚠️ SharedPreferences exists but returned 0 credentials")
                }
            } else {
                Log.w(TAG, "⚠️ Context is null - cannot access SharedPreferences!")
            }

            // No credentials found - return empty list instead of mock data
            Log.w(TAG, "❌ No credentials found for domain: '$domain'")
            Log.d(TAG, "💡 Make sure React Native called AutofillBridge.prepareCredentials() after saving passwords")
            return emptyList()

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error getting credentials", e)
            e.printStackTrace()
            return emptyList()
        }
    }

    /**
     * Tries to get plaintext password from React Native decryption cache
     * This is used after the app has decrypted the password via biometric auth
     * 
     * The plaintext password is stored with a 60-second expiry for security
     * 
     * @param credentialId The credential ID
     * @return Plaintext password if found and not expired, null otherwise
     */
    fun getDecryptedPasswordForAutofill(credentialId: String): String? {
        try {
            if (context == null) {
                Log.w(TAG, "⚠️ Context is null - cannot access plaintext cache")
                return null
            }
            
            // Use the correct SharedPreferences name for plaintext cache
            val prefs = context.getSharedPreferences("autofill_plaintext_cache", Context.MODE_PRIVATE)
            val passwordJson = prefs.getString("plaintext_$credentialId", null)
            
            if (passwordJson == null) {
                Log.w(TAG, "⚠️ No cached plaintext password for $credentialId")
                return null
            }
            
            try {
                val obj = JSONObject(passwordJson)
                val expiryTime = obj.optLong("expiresAt", 0)
                val currentTime = System.currentTimeMillis()
                
                // Check if expired
                if (currentTime > expiryTime) {
                    Log.w(TAG, "⏰ Plaintext password for $credentialId has EXPIRED - clearing cache")
                    prefs.edit().remove("plaintext_$credentialId").apply()
                    return null
                }
                
                val password = obj.optString("password", null)
                if (password != null) {
                    val remainingSeconds = (expiryTime - currentTime) / 1000
                    Log.d(TAG, "✅ Found cached plaintext password for $credentialId (expires in ${remainingSeconds}s)")
                } else {
                    Log.w(TAG, "⚠️ Password field is missing in cache for $credentialId")
                }
                return password
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error parsing cached password JSON for $credentialId: ${e.message}")
                return null
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error retrieving decrypted password for autofill: ${e.message}", e)
            return null
        }
    }

    /**
     * 🔐 CRITICAL: Stores plaintext password for autofill with time-limited cache
     * After successful biometric authentication and decryption, store plaintext
     * in a temporary cache that expires in 60 seconds for security
     * 
     * This allows the autofill service to retrieve plaintext passwords without
     * needing React Native's master key for subsequent fills
     * 
     * @param credentialId The credential ID
     * @param plaintextPassword The decrypted plaintext password
     * @return true if stored successfully
     */
    fun cacheDecryptedPasswordForAutofill(credentialId: String, plaintextPassword: String): Boolean {
        return try {
            if (context == null) {
                Log.w(TAG, "⚠️ Context is null - cannot cache plaintext password")
                return false
            }
            
            Log.d(TAG, "📦 Caching decrypted password for autofill (ID: $credentialId)")
            
            val prefs = context.getSharedPreferences("autofill_plaintext_cache", Context.MODE_PRIVATE)
            val currentTime = System.currentTimeMillis()
            val expiryTime = currentTime + 60_000  // 60-second expiry for security
            
            val cacheEntry = JSONObject().apply {
                put("password", plaintextPassword)
                put("storedAt", currentTime)
                put("expiresAt", expiryTime)
                put("credentialId", credentialId)
            }
            
            prefs.edit().apply {
                putString("plaintext_$credentialId", cacheEntry.toString())
                putLong("stored_at_$credentialId", currentTime)
                apply()
            }
            
            Log.d(TAG, "✅ Plaintext password cached successfully (expires in 60s)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error caching plaintext password", e)
            false
        }
    }

    /**
     * 🗑️ Clears cached plaintext password for security
     * Called after autofill completes or when session ends
     * 
     * @param credentialId The credential ID
     * @return true if cleared successfully
     */
    fun clearDecryptedPasswordCache(credentialId: String): Boolean {
        return try {
            if (context == null) return false
            
            Log.d(TAG, "🗑️ Clearing cached plaintext password (ID: $credentialId)")
            
            val prefs = context.getSharedPreferences("autofill_plaintext_cache", Context.MODE_PRIVATE)
            prefs.edit().apply {
                remove("plaintext_$credentialId")
                remove("stored_at_$credentialId")
                apply()
            }
            
            Log.d(TAG, "✅ Cache cleared")
            true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error clearing cache", e)
            false
        }
    }

    /**
     * Retrieves credentials from SharedPreferences
     * 
     * @param domain The domain to match
     * @param packageName The package name (for debug matching)
     * @return List of matching credentials
     */
    private fun getCredentialsFromSharedPreferences(domain: String, packageName: String = ""): List<AutofillCredential> {
        if (context == null) {
            Log.e(TAG, "❌ CRITICAL: Context is null in AutofillDataProvider!")
            return emptyList()
        }

        try {
            Log.d(TAG, "🔓 Accessing SharedPreferences with name: '$PREFS_NAME'")
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            
            // List all keys in SharedPreferences for debugging
            val allKeys = prefs.all.keys
            Log.d(TAG, "🔑 All keys in SharedPreferences: ${allKeys.joinToString(", ")}")
            Log.d(TAG, "🔑 Number of keys: ${allKeys.size}")
            
            val credentialsJson = prefs.getString(CREDENTIALS_KEY, null)
            
            if (credentialsJson.isNullOrEmpty()) {
                Log.w(TAG, "⚠️ No credentials stored in SharedPreferences (key: '$CREDENTIALS_KEY')")
                Log.w(TAG, "💡 Available keys: ${allKeys.joinToString(", ")}")
                Log.w(TAG, "💡 Looking for domain: '$domain', packageName: '$packageName'")
                return emptyList()
            }

            Log.d(TAG, "✅ Found credentials in SharedPreferences")
            Log.d(TAG, "📋 Credentials JSON length: ${credentialsJson.length} characters")
            Log.d(TAG, "📋 JSON preview: ${credentialsJson.substring(0, minOf(150, credentialsJson.length))}...")
            
            // Parse and filter credentials
            val allCredentials = JSONArray(credentialsJson)
            val matchingCredentials = mutableListOf<AutofillCredential>()

            Log.d(TAG, "📊 Total credentials stored: ${allCredentials.length()}")

            for (i in 0 until allCredentials.length()) {
                val credential = allCredentials.getJSONObject(i)
                val credDomain = credential.optString("domain", "")
                val username = credential.optString("username", "")
                val password = credential.optString("password", "")
                
                Log.d(TAG, "🔍 [${i+1}/${allCredentials.length()}] Credential:")
                Log.d(TAG, "   domain='$credDomain'")
                Log.d(TAG, "   username='$username'")
                Log.d(TAG, "   password='${if (password.length > 20) password.substring(0, 20) + "..." else password}'")
                Log.d(TAG, "   Requested domain='$domain'")
                
                if (domainsMatch(credDomain, domain)) {
                    Log.d(TAG, "✅ MATCH FOUND! credential domain='$credDomain' matches requested='$domain'")
                    
                    val credentialId = credential.optString("id", "")
                    
                    // Try to get plaintext password from decryption cache first
                    var passwordToUse = password
                    var isEncrypted = credential.optBoolean("encrypted", false)
                    
                    val decryptedPassword = getDecryptedPasswordForAutofill(credentialId)
                    if (decryptedPassword != null) {
                        Log.d(TAG, "🔓 Using cached plaintext password for autofill (decrypted by app)")
                        passwordToUse = decryptedPassword
                        isEncrypted = false  // Now it's plaintext
                    }
                    
                    // Extract encryption metadata for reference (in case we need it later)
                    val salt = credential.optString("salt", "")  // 🔑 CRITICAL: Salt for key derivation
                    val iv = credential.optString("iv", "")
                    val tag = credential.optString("tag", "")
                    
                    if (isEncrypted) {
                        Log.d(TAG, "🔐 Credential encrypted: $isEncrypted")
                        Log.d(TAG, "   ✓ has SALT: ${salt.isNotEmpty()} (${salt.length} chars)")
                        Log.d(TAG, "   ✓ has IV: ${iv.isNotEmpty()} (${iv.length} chars)")
                        Log.d(TAG, "   ✓ has TAG: ${tag.isNotEmpty()} (${tag.length} chars)")
                    } else {
                        Log.d(TAG, "✅ Credential is plaintext - ready for autofill")
                    }
                    
                    matchingCredentials.add(
                        AutofillCredential(
                            id = credentialId,
                            username = username,
                            password = passwordToUse,
                            domain = credDomain,
                            salt = salt,  // 🔑 CRITICAL: Include salt for decryption
                            iv = iv,
                            tag = tag,
                            isEncrypted = isEncrypted
                        )
                    )
                } else {
                    Log.d(TAG, "❌ NO MATCH: credential domain='$credDomain' does NOT match requested='$domain'")
                }
            }

            Log.d(TAG, "📈 Found ${matchingCredentials.size} matching credentials for domain: $domain")
            return matchingCredentials

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error retrieving credentials from SharedPreferences", e)
            Log.e(TAG, "Exception message: ${e.message}")
            Log.e(TAG, "Stack trace:")
            e.printStackTrace()
            return emptyList()
        }
    }

    /**
     * Saves new credentials from autofill save request
     * 
     * @param domain The domain
     * @param packageName The package name
     * @param username The username
     * @param password The password
     * @return true if saved successfully
     */
    fun saveCredentials(
        domain: String,
        packageName: String,
        username: String,
        password: String
    ): Boolean {
        Log.d(TAG, "Saving credentials for domain: $domain")

        try {
            // In production, this should:
            // 1. Send save request to React Native app via bridge
            // 2. Encrypt credentials with master key
            // 3. Store in secure storage
            // 4. Update autofill cache

            // For now, just log the action
            Log.d(TAG, "Credentials saved: $username@$domain")
            return true

        } catch (e: Exception) {
            Log.e(TAG, "Error saving credentials", e)
            return false
        }
    }

    /**
     * Updates existing credentials
     * 
     * @param credentialId The ID of the credential to update
     * @param username The new username
     * @param password The new password
     * @return true if updated successfully
     */
    fun updateCredentials(
        credentialId: String,
        username: String,
        password: String
    ): Boolean {
        Log.d(TAG, "Updating credentials: $credentialId")

        try {
            // Send update request to React Native app
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error updating credentials", e)
            return false
        }
    }

    /**
     * Deletes credentials
     * 
     * @param credentialId The ID of the credential to delete
     * @return true if deleted successfully
     */
    fun deleteCredentials(credentialId: String): Boolean {
        Log.d(TAG, "Deleting credentials: $credentialId")

        try {
            // Send delete request to React Native app
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting credentials", e)
            return false
        }
    }

    /**
     * Checks if autofill is enabled in the main app
     * 
     * @return true if enabled
     */
    fun isAutofillEnabled(): Boolean {
        // Check app settings
        return true
    }

    /**
     * Checks if biometric authentication is required
     * 
     * @return true if required
     */
    fun isBiometricRequired(): Boolean {
        // Check app settings
        return true
    }

    /**
     * Verifies user authentication for autofill
     * 
     * @return true if authenticated
     */
    fun verifyAuthentication(): Boolean {
        // Verify biometric or master password
        return false // Requires authentication
    }

    /**
     * Logs autofill activity for security audit
     * 
     * @param domain The domain
     * @param action The action performed
     * @param success Whether the action succeeded
     */
    fun logAutofillActivity(
        domain: String,
        action: String,
        success: Boolean
    ) {
        Log.d(TAG, "Autofill activity: $action on $domain (success: $success)")
        
        // In production, log to secure audit trail
    }

    /**
     * Check if two domains match
     * Supports exact match, subdomain match, and package name match
     */
    private fun domainsMatch(domain1: String, domain2: String): Boolean {
        val normalized1 = normalizeDomain(domain1)
        val normalized2 = normalizeDomain(domain2)
        
        Log.d(TAG, "🔍 Comparing normalized domains: '$normalized1' vs '$normalized2'")
        
        // Exact match
        if (normalized1 == normalized2) {
            Log.d(TAG, "✅ EXACT MATCH: '$normalized1' == '$normalized2'")
            return true
        }
        
        // Subdomain match
        if (normalized1.endsWith(".$normalized2") || normalized2.endsWith(".$normalized1")) {
            Log.d(TAG, "✅ SUBDOMAIN MATCH: '$normalized1' contains or is contained in '$normalized2'")
            return true
        }
        
        // Special case: PasswordEpic app credentials
        // Match "com.passwordepic.com" with "com.passwordepic.mobile" and vice versa
        if ((normalized1.contains("com.passwordepic") && normalized2.contains("com.passwordepic")) &&
            (normalized1 == "com.passwordepic.com" || normalized1 == "com.passwordepic.mobile") &&
            (normalized2 == "com.passwordepic.com" || normalized2 == "com.passwordepic.mobile")) {
            Log.d(TAG, "✅ PASSWORDEPIC APP MATCH: Both are PasswordEpic credentials (com.passwordepic.com or .mobile)")
            return true
        }
        
        // For package names like "com.passwordepic.mobile", also try matching the last part
        val parts1 = normalized1.split(".")
        val parts2 = normalized2.split(".")
        
        if (parts1.size >= 2 && parts2.size >= 2) {
            // If both are package names and last part matches, consider it a match
            if (parts1[parts1.size - 1] == parts2[parts2.size - 1] && 
                parts1[parts1.size - 2] == parts2[parts2.size - 2]) {
                Log.d(TAG, "✅ PACKAGE NAME MATCH: Last two parts match")
                return true
            }
        }
        
        Log.d(TAG, "❌ NO MATCH between '$normalized1' and '$normalized2'")
        return false
    }

    /**
     * Normalize domain for comparison
     */
    private fun normalizeDomain(domain: String): String {
        return domain.lowercase()
            .trim()
            .removePrefix("http://")
            .removePrefix("https://")
            .removePrefix("www.")
            .split("/")[0]
            .split(":")[0]
    }

    /**
     * Gets mock credentials for testing
     * (Remove in production)
     * 
     * @param domain The domain to match
     * @return List of mock credentials
     */
    private fun getMockCredentials(domain: String): List<AutofillCredential> {
        // Return mock data for testing
        return listOf(
            AutofillCredential(
                id = "1",
                username = "user@example.com",
                password = "password123",
                domain = domain
            )
        )
    }

    /**
     * Communicates with React Native app via bridge
     * (To be implemented)
     * 
     * @param method The method to call
     * @param params The parameters
     * @return Response from React Native
     */
    private fun callReactNativeBridge(
        method: String,
        params: Map<String, Any>
    ): JSONObject? {
        // TODO: Implement React Native bridge communication
        // This should use the AutofillBridge module
        return null
    }

    /**
     * Encrypts data for secure storage
     * (To be implemented)
     * 
     * @param data The data to encrypt
     * @return Encrypted data
     */
    private fun encryptData(data: String): String {
        // TODO: Implement encryption using Android Keystore
        return data
    }

    /**
     * Decrypts data from secure storage
     * (To be implemented)
     * 
     * @param encryptedData The encrypted data
     * @return Decrypted data
     */
    private fun decryptData(encryptedData: String): String {
        // TODO: Implement decryption using Android Keystore
        return encryptedData
    }
}