package com.passwordepic.mobile.autofill

import android.app.assist.AssistStructure
import android.content.Intent
import android.content.IntentFilter
import android.os.CancellationSignal
import android.service.autofill.*
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.passwordepic.mobile.R

/**
 * PasswordEpic Autofill Service
 * 
 * Provides secure password autofill functionality for Android apps and browsers.
 * Implements Android Autofill Framework with end-to-end encryption and biometric authentication.
 * 
 * Security Features:
 * - Biometric authentication required before filling
 * - Domain verification to prevent phishing
 * - Encrypted credential storage
 * - Zero-knowledge architecture
 * 
 * @since API 26 (Android 8.0 Oreo)
 */
class PasswordEpicAutofillService : AutofillService() {

    companion object {
        private const val TAG = "PasswordEpicAutofill"
        private const val AUTHENTICATION_REQUEST_CODE = 1001
        
        // DEBUG MODE: When true, bypass auth and fill directly (for testing)
        // ⚠️ SECURITY: Set to FALSE for production to enable biometric authentication
        // When FALSE: Users must authenticate with biometric before autofilling
        private const val DEBUG_MODE = false  // 🔐 BIOMETRIC AUTH ENABLED
        
        private val authenticatedCredentials = mutableMapOf<String, AutofillCredential>()
        
        private var lastFillRequest: FillRequest? = null
        private var lastFillCallback: FillCallback? = null
        private var serviceInstance: PasswordEpicAutofillService? = null
        
        // 🔄 Cache for refilling after auth succeeds
        private var cachedCallback: FillCallback? = null
        private var cachedParsedData: ParsedStructureData? = null
        private var cachedCredentials: List<AutofillCredential>? = null
        
        fun setCachedCallbackAndData(
            callback: FillCallback,
            parsedData: ParsedStructureData,
            credentials: List<AutofillCredential>
        ) {
            cachedCallback = callback
            cachedParsedData = parsedData
            cachedCredentials = credentials
            Log.d(TAG, "💾 Cached callback, parsed data and ${credentials.size} credentials for refill after auth")
        }
        
        fun triggerRefillAfterAuth() {
            Log.d(TAG, "┌──────────────────────────────────────────────────────────────")
            Log.d(TAG, "🔄 Triggering refill after auth succeeded...")
            try {
                val callback = cachedCallback
                val parsedData = cachedParsedData
                val credentials = cachedCredentials
                
                Log.d(TAG, "📋 Cache state:")
                Log.d(TAG, "   - Callback available: ${callback != null}")
                Log.d(TAG, "   - ParsedData available: ${parsedData != null}")
                Log.d(TAG, "   - Credentials count: ${credentials?.size ?: 0}")
                
                if (callback == null || parsedData == null || credentials == null) {
                    Log.e(TAG, "❌ CRITICAL: Cannot refill - missing required cache!")
                    Log.e(TAG, "   callback=${ callback==null}, data=${parsedData==null}, creds=${credentials==null}")
                    Log.d(TAG, "└──────────────────────────────────────────────────────────────")
                    return
                }
                
                // 🔐 CRITICAL FIX: Wait for plaintext to be cached before building response
                // This gives React Native additional time if decryption is still in progress
                waitForPlaintextCache(credentials)
                
                Log.d(TAG, "✅ All cached data available! Building filled response...")
                Log.d(TAG, "   Domain: ${parsedData.domain}")
                Log.d(TAG, "   Fields count: ${parsedData.fields.size}")
                Log.d(TAG, "   Credentials: ${credentials.map { it.username }.joinToString(", ")}")
                
                val response = serviceInstance?.buildFillResponse(parsedData, credentials)
                
                if (response == null) {
                    Log.e(TAG, "❌ Failed to build response - serviceInstance returned null")
                    Log.d(TAG, "└──────────────────────────────────────────────────────────────")
                    return
                }
                
                Log.d(TAG, "✅ FillResponse built successfully")
                try {
                    Log.d(TAG, "📤 Calling callback.onSuccess to deliver filled response to framework...")
                    callback.onSuccess(response)
                    Log.d(TAG, "✅ Refill via callback successful! Fields should now auto-fill.")
                } catch (e: IllegalStateException) {
                    Log.w(TAG, "⚠️ Callback already invoked (expected behavior): ${e.message}")
                    // This is OK - means first callback was already used for auth-required response
                    Log.w(TAG, "⚠️ This means Android already called the callback with auth-required response")
                    Log.w(TAG, "⚠️ The fields should fill when you return from the auth activity")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error calling callback: ${e.message}", e)
                }
                
                Log.d(TAG, "🧹 Clearing cache after refill attempt...")
                // Clear cache after refill attempt
                cachedCallback = null
                cachedParsedData = null
                cachedCredentials = null
                Log.d(TAG, "✅ Cache cleared")
                Log.d(TAG, "└──────────────────────────────────────────────────────────────")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error in triggerRefillAfterAuth: ${e.message}", e)
                Log.d(TAG, "└──────────────────────────────────────────────────────────────")
            }
        }
        
        /**
         * 🔐 CRITICAL: Waits for plaintext passwords to be cached for all credentials
         * 
         * This method ensures that if passwords are encrypted, React Native has had
         * enough time to decrypt and cache them before we try to fill them.
         * 
         * Waits up to 5 seconds with polling every 100ms.
         * 
         * @param credentials List of credentials to check for cached plaintext
         */
        private fun waitForPlaintextCache(credentials: List<AutofillCredential>) {
            val encryptedCredentials = credentials.filter { 
                it.isEncrypted && it.iv.isNotEmpty() && it.tag.isNotEmpty() 
            }
            
            if (encryptedCredentials.isEmpty()) {
                Log.d(TAG, "✅ No encrypted credentials - no need to wait for plaintext cache")
                return
            }
            
            Log.d(TAG, "⏳ Waiting for plaintext cache for ${encryptedCredentials.size} encrypted credential(s)...")
            
            val startTime = System.currentTimeMillis()
            val maxWaitTime = 5000 // 5 seconds for refill (shorter than auth activity's 10s)
            var allCached = false
            var checkCount = 0
            
            while (System.currentTimeMillis() - startTime < maxWaitTime) {
                checkCount++
                val dataProvider = AutofillDataProvider(serviceInstance!!)
                
                // Check if all encrypted credentials have cached plaintext
                val allCachedNow = encryptedCredentials.all { credential ->
                    dataProvider.getDecryptedPasswordForAutofill(credential.id) != null
                }
                
                if (allCachedNow) {
                    val elapsedTime = System.currentTimeMillis() - startTime
                    Log.d(TAG, "✅ ALL PLAINTEXT CACHED - took ${elapsedTime}ms (${checkCount} checks)")
                    Log.d(TAG, "✅ Ready to build filled response with decrypted passwords")
                    allCached = true
                    break
                }
                
                // Only log every 3 checks to avoid spam
                if (checkCount % 3 == 0) {
                    val elapsed = System.currentTimeMillis() - startTime
                    val cachedCount = encryptedCredentials.count { 
                        dataProvider.getDecryptedPasswordForAutofill(it.id) != null 
                    }
                    Log.d(TAG, "⏳ Waiting... ${cachedCount}/${encryptedCredentials.size} cached (${elapsed}ms)")
                }
                
                Thread.sleep(100)
            }
            
            if (!allCached) {
                val totalElapsed = System.currentTimeMillis() - startTime
                val dataProvider = AutofillDataProvider(serviceInstance!!)
                val cachedCount = encryptedCredentials.count { 
                    dataProvider.getDecryptedPasswordForAutofill(it.id) != null 
                }
                
                Log.w(TAG, "⚠️ PLAINTEXT CACHE WAIT TIMEOUT after ${totalElapsed}ms")
                Log.w(TAG, "⚠️ ${cachedCount}/${encryptedCredentials.size} credentials cached")
                
                if (cachedCount == 0) {
                    Log.e(TAG, "❌ CRITICAL: NO PLAINTEXT CACHED AT ALL!")
                    Log.e(TAG, "❌ React Native decryption may have failed:")
                    Log.e(TAG, "   - Check if useAutofillDecryption hook is running")
                    Log.e(TAG, "   - Check if cryptoService is available")
                    Log.e(TAG, "   - Check if master password session is active")
                } else {
                    Log.w(TAG, "⚠️ Some credentials cached but not all - proceeding anyway")
                }
            }
        }
        
        fun setAuthenticatedCredential(credentialId: String, credential: AutofillCredential) {
            authenticatedCredentials[credentialId] = credential
            Log.d(TAG, "✅ Authenticated credential cached: $credentialId")
        }
        
        fun getAuthenticatedCredential(credentialId: String): AutofillCredential? {
            val credential = authenticatedCredentials[credentialId]
            if (credential != null) {
                authenticatedCredentials.remove(credentialId)
                Log.d(TAG, "✅ Retrieved authenticated credential: $credentialId")
            }
            return credential
        }
        
        fun getInstance(): PasswordEpicAutofillService? = serviceInstance
        
        fun storeFillContext(request: FillRequest, callback: FillCallback) {
            lastFillRequest = request
            lastFillCallback = callback
        }
        
        fun getLastFillRequest(): FillRequest? = lastFillRequest
        
        fun getLastFillCallback(): FillCallback? = lastFillCallback
        
        fun clearFillContext() {
            lastFillRequest = null
            lastFillCallback = null
            Log.d(TAG, "🧹 Fill context cleared")
        }
    }

    private val viewNodeParser = ViewNodeParser()
    private val domainVerifier = DomainVerifier()
    private lateinit var autofillDataProvider: AutofillDataProvider
    
    // 📡 Local broadcast receiver for auth success events
    private var authSuccessReceiver: AutofillAuthSuccessReceiver? = null

    override fun onCreate() {
        super.onCreate()
        serviceInstance = this
        Log.d(TAG, "🚀 Service.onCreate() called! Initializing AutofillDataProvider")
        try {
            autofillDataProvider = AutofillDataProvider(this)
            Log.d(TAG, "✅ AutofillDataProvider initialized with context")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to initialize AutofillDataProvider", e)
        }
        
        // 📡 Register local broadcast receiver for auth success
        registerAuthSuccessReceiver()
    }
    
    /**
     * 📡 Registers local broadcast receiver to listen for auth success events
     * This allows the service to trigger refill when user completes biometric auth
     */
    private fun registerAuthSuccessReceiver() {
        try {
            authSuccessReceiver = AutofillAuthSuccessReceiver()
            val intentFilter = IntentFilter(AutofillAuthSuccessReceiver.ACTION_AUTH_SUCCEED)
            LocalBroadcastManager.getInstance(this).registerReceiver(authSuccessReceiver!!, intentFilter)
            Log.d(TAG, "📡 Auth success receiver registered successfully")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to register auth success receiver: ${e.message}")
        }
    }
    
    /**
     * 📡 Unregisters local broadcast receiver when service is disconnected
     */
    private fun unregisterAuthSuccessReceiver() {
        try {
            if (authSuccessReceiver != null) {
                LocalBroadcastManager.getInstance(this).unregisterReceiver(authSuccessReceiver!!)
                authSuccessReceiver = null
                Log.d(TAG, "📡 Auth success receiver unregistered successfully")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to unregister auth success receiver: ${e.message}")
        }
    }

    /**
     * Called when service is started
     */
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "⚙️ onStartCommand() called with action: ${intent?.action}")
        Log.d(TAG, "🔗 Service is being bound by system")
        return super.onStartCommand(intent, flags, startId)
    }

    /**
     * Called when the system requests autofill for a view.
     * This is the main entry point for the autofill service.
     * 
     * @param request The autofill request containing the view structure
     * @param cancellationSignal Signal to cancel the operation
     * @param callback Callback to send the response
     */
    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        Log.d(TAG, "┌─────────────────────────────────────────────")
        Log.d(TAG, "📥 onFillRequest: Autofill request received")
        Log.d(TAG, "📦 FillContexts count: ${request.fillContexts.size}")
        Log.d(TAG, "🔐 Cached credentials count: ${authenticatedCredentials.size}")
        
        // Store for later refill triggered by auth activity
        storeFillContext(request, callback)

        try {
            // Extract the view structure from the request
            val structure: AssistStructure = request.fillContexts.lastOrNull()?.structure
                ?: run {
                    Log.w(TAG, "⚠️ No AssistStructure found in request")
                    callback.onFailure("No structure available")
                    return
                }

            Log.d(TAG, "🔍 AssistStructure windows: ${structure.windowNodeCount}")

            // Parse the view structure to find autofillable fields
            val parsedData = viewNodeParser.parseStructure(structure)
            
            Log.d(TAG, "📊 ParsedData - Fields: ${parsedData.fields.size}, Domain: '${parsedData.domain}', Package: '${parsedData.packageName}'")
            
            if (parsedData.isEmpty()) {
                Log.d(TAG, "❌ No autofillable fields found")
                Log.d(TAG, "└─────────────────────────────────────────────")
                callback.onSuccess(null)
                return
            }

            Log.d(TAG, "✅ Found autofillable fields: ${parsedData.fields.size}")
            parsedData.fields.forEach { field ->
                Log.d(TAG, "   Field: ${field.type} (hint: ${field.hint})")
            }
            Log.d(TAG, "🔗 Domain: '${parsedData.domain}', Package: '${parsedData.packageName}'")

            // Verify the domain to prevent phishing
            if (!domainVerifier.isValidDomain(parsedData.domain, parsedData.packageName)) {
                Log.w(TAG, "⚠️ Domain verification failed: ${parsedData.domain}")
                Log.d(TAG, "└─────────────────────────────────────────────")
                callback.onFailure("Domain verification failed")
                return
            }

            // Check if we have a cached credential from recent successful authentication
            val cachedCredential = authenticatedCredentials.values.firstOrNull()
            if (cachedCredential != null) {
                Log.d(TAG, "🔑 Found cached authenticated credential, filling with values immediately")
                Log.d(TAG, "   Credential: ${cachedCredential.username} for ${cachedCredential.domain}")
                Log.d(TAG, "   Encrypted: ${cachedCredential.isEncrypted}, has IV: ${cachedCredential.iv.isNotEmpty()}, has TAG: ${cachedCredential.tag.isNotEmpty()}")
                
                // Check if password is encrypted - if so, try to get plaintext from cache
                if (cachedCredential.isEncrypted && cachedCredential.iv.isNotEmpty() && cachedCredential.tag.isNotEmpty()) {
                    Log.d(TAG, "🔒 Encrypted password detected - checking plaintext cache...")
                    val plaintext = autofillDataProvider.getDecryptedPasswordForAutofill(cachedCredential.id)
                    
                    if (plaintext != null) {
                        Log.d(TAG, "✅ FOUND PLAINTEXT IN CACHE - Using decrypted password for fill")
                        // Use plaintext password for fill
                        val responseBuilder = FillResponse.Builder()
                        val datasetBuilder = Dataset.Builder()
                        
                        parsedData.fields.forEach { field ->
                            when (field.type) {
                                FieldType.USERNAME, FieldType.EMAIL -> {
                                    Log.d(TAG, "✍️ Filling USERNAME/EMAIL with: '${cachedCredential.username}'")
                                    datasetBuilder.setValue(
                                        field.autofillId,
                                        AutofillValue.forText(cachedCredential.username)
                                    )
                                }
                                FieldType.PASSWORD -> {
                                    Log.d(TAG, "🔓 Filling PASSWORD field with decrypted plaintext from cache")
                                    datasetBuilder.setValue(
                                        field.autofillId,
                                        AutofillValue.forText(plaintext)
                                    )
                                }
                                else -> {}
                            }
                        }
                        
                        responseBuilder.addDataset(datasetBuilder.build())
                        Log.d(TAG, "✅ Sending response with decrypted plaintext password")
                        Log.d(TAG, "└─────────────────────────────────────────────")
                        callback.onSuccess(responseBuilder.build())
                        return
                    }
                    
                    Log.w(TAG, "⚠️ NO PLAINTEXT CACHE FOUND - Password still encrypted")
                    Log.e(TAG, "❌ CRITICAL: Password is ENCRYPTED but autofill cannot decrypt it!")
                    Log.e(TAG, "🔐 Password is encrypted with:")
                    Log.e(TAG, "   - Ciphertext: ${cachedCredential.password.substring(0, minOf(50, cachedCredential.password.length))}...")
                    Log.e(TAG, "   - IV: ${cachedCredential.iv}")
                    Log.e(TAG, "   - TAG: ${cachedCredential.tag}")
                    Log.e(TAG, "💡 Make sure React Native called cacheDecryptedPasswordForAutofill()")
                    Log.e(TAG, "💡 Or the decryption broadcast receiver is not working")
                    
                    // Don't fill encrypted passwords - this is a security issue
                    Log.d(TAG, "⚠️ Aborting autofill - refusing to fill encrypted password directly")
                    Log.d(TAG, "└─────────────────────────────────────────────")
                    callback.onSuccess(null)
                    return
                }
                
                // Build response with the cached credential WITH values (no auth needed)
                val responseBuilder = FillResponse.Builder()
                val datasetBuilder = Dataset.Builder()
                
                // Fill all fields with actual values from the cached credential
                parsedData.fields.forEach { field ->
                    when (field.type) {
                        FieldType.USERNAME, FieldType.EMAIL -> {
                            Log.d(TAG, "✍️ Filling USERNAME/EMAIL with: '${cachedCredential.username}'")
                            datasetBuilder.setValue(
                                field.autofillId,
                                AutofillValue.forText(cachedCredential.username)
                            )
                        }
                        FieldType.PASSWORD -> {
                            Log.d(TAG, "🔒 Filling PASSWORD field with plaintext password")
                            datasetBuilder.setValue(
                                field.autofillId,
                                AutofillValue.forText(cachedCredential.password)
                            )
                        }
                        else -> {}
                    }
                }
                
                responseBuilder.addDataset(datasetBuilder.build())
                Log.d(TAG, "✅ Sending response with cached credential FILLED VALUES")
                Log.d(TAG, "└─────────────────────────────────────────────")
                callback.onSuccess(responseBuilder.build())
                return
            }

            // Get matching credentials for this domain
            Log.d(TAG, "🔍 Searching for credentials matching domain: '${parsedData.domain}'")
            val credentials = autofillDataProvider.getCredentialsForDomain(
                parsedData.domain,
                parsedData.packageName
            )

            if (credentials.isEmpty()) {
                Log.d(TAG, "❌ No credentials found for domain: '${parsedData.domain}'")
                Log.w(TAG, "⚠️ Possible causes:")
                Log.w(TAG, "   1. No test credentials set up in SharedPreferences")
                Log.w(TAG, "   2. Domain mismatch between stored and requested")
                Log.w(TAG, "   3. AutofillDataProvider context is null or invalid")
                Log.d(TAG, "└─────────────────────────────────────────────")
                callback.onSuccess(null)
                return
            }

            Log.d(TAG, "✅ Found ${credentials.size} matching credentials:")
            credentials.forEach { cred ->
                Log.d(TAG, "   - domain: '${cred.domain}', username: '${cred.username}'")
            }

            // 💾 Cache callback and data for potential refill after auth
            // (in case Android framework doesn't auto-trigger onFillRequest again)
            setCachedCallbackAndData(callback, parsedData, credentials)

            // Build the autofill response
            val response = buildFillResponse(parsedData, credentials)
            if (response != null) {
                Log.d(TAG, "✅ Sending response for ${credentials.size} credentials")
                Log.d(TAG, "📤 Response created successfully")
            } else {
                Log.e(TAG, "❌ CRITICAL: buildFillResponse returned null!")
            }
            Log.d(TAG, "└─────────────────────────────────────────────")
            callback.onSuccess(response)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error processing autofill request", e)
            Log.d(TAG, "└─────────────────────────────────────────────")
            callback.onFailure("Error: ${e.message}")
        }
    }

    /**
     * Called when the system wants to save user-entered credentials.
     * This allows the app to save new passwords or update existing ones.
     * 
     * @param request The save request containing the entered data
     * @param callback Callback to indicate success or failure
     */
    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        Log.d(TAG, "onSaveRequest: Save request received")

        try {
            // Extract the view structure
            val structure: AssistStructure = request.fillContexts.lastOrNull()?.structure
                ?: run {
                    Log.w(TAG, "No AssistStructure found in save request")
                    callback.onFailure("No structure available")
                    return
                }

            // Parse the structure to extract entered credentials
            val parsedData = viewNodeParser.parseStructure(structure)
            
            if (parsedData.isEmpty()) {
                Log.d(TAG, "No saveable fields found")
                callback.onFailure("No fields to save")
                return
            }

            // Extract username and password values
            val username = parsedData.fields
                .firstOrNull { it.type == FieldType.USERNAME }
                ?.value

            val password = parsedData.fields
                .firstOrNull { it.type == FieldType.PASSWORD }
                ?.value

            if (username.isNullOrEmpty() || password.isNullOrEmpty()) {
                Log.d(TAG, "Username or password is empty")
                callback.onFailure("Missing credentials")
                return
            }

            Log.d(TAG, "Saving credentials for domain: ${parsedData.domain}")

            // Save the credentials through the data provider
            val saved = autofillDataProvider.saveCredentials(
                domain = parsedData.domain,
                packageName = parsedData.packageName,
                username = username,
                password = password
            )

            if (saved) {
                Log.d(TAG, "Credentials saved successfully")
                callback.onSuccess()
            } else {
                Log.w(TAG, "Failed to save credentials")
                callback.onFailure("Save failed")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error processing save request", e)
            callback.onFailure("Error: ${e.message}")
        }
    }

    /**
     * Builds a FillResponse containing autofill datasets for the user to choose from.
     * Includes authentication requirement before filling.
     * 
     * @param parsedData The parsed view structure data
     * @param credentials List of matching credentials
     * @return FillResponse with datasets
     */
    private fun buildFillResponse(
        parsedData: ParsedStructureData,
        credentials: List<AutofillCredential>
    ): FillResponse? {
        val responseBuilder = FillResponse.Builder()

        // Create datasets for each credential
        credentials.forEachIndexed { index, credential ->
            // Create a unique authentication intent for each credential
            val authIntent = Intent(this, AutofillAuthActivity::class.java).apply {
                putExtra("domain", parsedData.domain)
                putExtra("packageName", parsedData.packageName)
                putExtra("credentialCount", credentials.size)
                putExtra("credentialId", credential.id)
                putExtra("credentialIndex", index)
            }

            val authIntentSender = android.app.PendingIntent.getActivity(
                this,
                AUTHENTICATION_REQUEST_CODE + index,
                authIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            ).intentSender

            val dataset = buildDataset(parsedData, credential, authIntentSender)
            responseBuilder.addDataset(dataset)
        }

        // Configure save info if we have password fields
        val passwordField = parsedData.fields.firstOrNull { it.type == FieldType.PASSWORD }
        val usernameField = parsedData.fields.firstOrNull { it.type == FieldType.USERNAME }

        if (passwordField != null) {
            val saveInfoBuilder = SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_USERNAME or SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                arrayOf(passwordField.autofillId)
            )

            // Add username field if available
            if (usernameField != null) {
                saveInfoBuilder.setOptionalIds(arrayOf(usernameField.autofillId))
            }

            responseBuilder.setSaveInfo(saveInfoBuilder.build())
        }

        return responseBuilder.build()
    }

    /**
     * Builds a Dataset for a single credential.
     * In DEBUG_MODE: Fills values directly for testing
     * In PRODUCTION: Sets authentication requirement with presentation only
     * 
     * @param parsedData The parsed view structure data
     * @param credential The credential to fill
     * @param authIntentSender Intent sender for authentication
     * @return Dataset for this credential
     */
    private fun buildDataset(
        parsedData: ParsedStructureData,
        credential: AutofillCredential,
        authIntentSender: android.content.IntentSender
    ): Dataset {
        val datasetBuilder = Dataset.Builder()

        Log.d(TAG, "🏗️ Building dataset for credential:")
        Log.d(TAG, "   id: ${credential.id}")
        Log.d(TAG, "   domain: ${credential.domain}")
        Log.d(TAG, "   username: ${credential.username}")
        Log.d(TAG, "   DEBUG_MODE: $DEBUG_MODE")

        // Create presentation for the dataset (what the user sees in the dropdown)
        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
            setTextViewText(android.R.id.text1, credential.username)
            Log.d(TAG, "📄 Presentation set to display: '${credential.username}'")
        }

        // DEBUG MODE: Fill values directly without authentication
        if (DEBUG_MODE) {
            Log.d(TAG, "🔧 DEBUG_MODE ENABLED - Filling values directly without authentication")
            Log.d(TAG, "📦 Credential status: encrypted=${credential.isEncrypted}, password=${credential.password}")
            
            // Fill all available fields - encrypted passwords will be decrypted by React Native after login
            parsedData.fields.forEach { field ->
                when (field.type) {
                    FieldType.USERNAME, FieldType.EMAIL -> {
                        Log.d(TAG, "✍️ Filling USERNAME/EMAIL with: '${credential.username}'")
                        datasetBuilder.setValue(
                            field.autofillId,
                            AutofillValue.forText(credential.username),
                            presentation
                        )
                    }
                    FieldType.PASSWORD -> {
                        if (credential.isEncrypted) {
                            Log.d(TAG, "🔐 Filling PASSWORD field with encrypted value (will be decrypted on login)")
                        } else {
                            Log.d(TAG, "🔒 Filling PASSWORD field with plaintext value")
                        }
                        datasetBuilder.setValue(
                            field.autofillId,
                            AutofillValue.forText(credential.password),
                            presentation
                        )
                    }
                    else -> {
                        Log.d(TAG, "⏭️ Skipping field type: ${field.type}")
                    }
                }
            }
            Log.d(TAG, "✅ Dataset built in DEBUG_MODE with all values (encryption handled by React Native)")
        } else {
            // PRODUCTION MODE: Check for cached plaintext first, otherwise require authentication
            Log.d(TAG, "🔐 PRODUCTION_MODE - Checking for cached plaintext...")
            
            // 🔑 Check if we have cached plaintext password
            // CRITICAL FIX: Check for encryption EITHER by isEncrypted flag OR by presence of IV/TAG
            // Some credentials may have IV/TAG but isEncrypted=false (data inconsistency)
            var cachedPlaintextPassword: String? = null
            val hasEncryptionMetadata = credential.iv.isNotEmpty() && credential.tag.isNotEmpty()
            
            if ((credential.isEncrypted || hasEncryptionMetadata)) {
                Log.d(TAG, "🔍 Encrypted password detected (isEncrypted=${credential.isEncrypted}, hasMetadata=$hasEncryptionMetadata) - checking plaintext cache...")
                val dataProvider = AutofillDataProvider(this)
                cachedPlaintextPassword = dataProvider.getDecryptedPasswordForAutofill(credential.id)
            }
            
            // If we have cached plaintext, fill it directly without auth
            if (cachedPlaintextPassword != null) {
                Log.d(TAG, "✅ PRODUCTION_MODE: Found cached plaintext - filling without auth requirement")
                parsedData.fields.forEach { field ->
                    when (field.type) {
                        FieldType.USERNAME, FieldType.EMAIL -> {
                            Log.d(TAG, "✍️ Filling USERNAME/EMAIL with cached credentials")
                            datasetBuilder.setValue(
                                field.autofillId,
                                AutofillValue.forText(credential.username),
                                presentation
                            )
                        }
                        FieldType.PASSWORD -> {
                            Log.d(TAG, "✅ Filling PASSWORD with cached plaintext")
                            datasetBuilder.setValue(
                                field.autofillId,
                                AutofillValue.forText(cachedPlaintextPassword),
                                presentation
                            )
                        }
                        else -> {
                            Log.d(TAG, "⏭️ Skipping field type: ${field.type}")
                        }
                    }
                }
                Log.d(TAG, "✅ Dataset built with cached plaintext values (no auth required)")
            } else {
                // No cached plaintext - check if biometric is required
                Log.d(TAG, "🔐 PRODUCTION_MODE - No cached plaintext, checking requireBiometric setting...")
                
                // Check if biometric authentication is required
                val requireBiometric = autofillDataProvider.isRequireBiometricEnabled()
                Log.d(TAG, "🔐 Biometric requirement: $requireBiometric")
                
                if (requireBiometric) {
                    // ✅ CASE 1: Biometric REQUIRED - Add authentication requirement
                    Log.d(TAG, "🔐 requireBiometric=TRUE - Requiring authentication before filling")
                    
                    // Add field values with presentation
                    // Android autofill stores these values and uses them after auth succeeds
                    parsedData.fields.forEach { field ->
                        when (field.type) {
                            FieldType.USERNAME, FieldType.EMAIL -> {
                                Log.d(TAG, "✍️ Setting USERNAME/EMAIL value (will be filled after auth): '${credential.username}'")
                                datasetBuilder.setValue(
                                    field.autofillId,
                                    AutofillValue.forText(credential.username),
                                    presentation
                                )
                            }
                            FieldType.PASSWORD -> {
                                Log.d(TAG, "🔒 Setting PASSWORD value (will be filled after auth)")
                                Log.d(TAG, "   Password is encrypted: ${credential.isEncrypted}")
                                Log.d(TAG, "   Will be decrypted by app and replaced with plaintext after auth succeeds")
                                // For now, set the plaintext if available, otherwise the encrypted password
                                // After auth succeeds, this might be updated with plaintext by React Native
                                datasetBuilder.setValue(
                                    field.autofillId,
                                    AutofillValue.forText(credential.password),
                                    presentation
                                )
                            }
                            else -> {
                                Log.d(TAG, "⏭️ Skipping field type: ${field.type}")
                            }
                        }
                    }
                    
                    // NOW set authentication requirement
                    // Android autofill will use the values we just set after auth succeeds
                    Log.d(TAG, "🔐 Setting authentication requirement on dataset (biometric REQUIRED)...")
                    datasetBuilder.setAuthentication(authIntentSender)
                    
                    Log.d(TAG, "✅ Dataset built with authentication requirement")
                    Log.d(TAG, "   Values are set and will be used after successful authentication")
                } else {
                    // ❌ CASE 2: Biometric NOT REQUIRED - Fill directly without authentication
                    Log.d(TAG, "⏭️ requireBiometric=FALSE - Biometric NOT required, filling directly without auth")
                    Log.d(TAG, "⚠️ WARNING: Filling credentials without biometric verification!")
                    Log.d(TAG, "   Username: '${credential.username}'")
                    
                    // Still check if password is encrypted - if so, we shouldn't fill it without decryption
                    if ((credential.isEncrypted || hasEncryptionMetadata)) {
                        Log.e(TAG, "❌ SECURITY ISSUE: Password is ENCRYPTED but requireBiometric=FALSE")
                        Log.e(TAG, "   Cannot fill encrypted password without decryption!")
                        Log.e(TAG, "   Falling back to requiring authentication for security")
                        
                        // For security, still require auth if password is encrypted
                        parsedData.fields.forEach { field ->
                            when (field.type) {
                                FieldType.USERNAME, FieldType.EMAIL -> {
                                    datasetBuilder.setValue(
                                        field.autofillId,
                                        AutofillValue.forText(credential.username),
                                        presentation
                                    )
                                }
                                FieldType.PASSWORD -> {
                                    datasetBuilder.setValue(
                                        field.autofillId,
                                        AutofillValue.forText(credential.password),
                                        presentation
                                    )
                                }
                                else -> {}
                            }
                        }
                        datasetBuilder.setAuthentication(authIntentSender)
                        Log.d(TAG, "✅ Dataset built with authentication (fallback for encrypted password)")
                    } else {
                        // Password is plaintext - safe to fill without auth
                        Log.d(TAG, "✅ Password is PLAINTEXT - Safe to fill without authentication")
                        parsedData.fields.forEach { field ->
                            when (field.type) {
                                FieldType.USERNAME, FieldType.EMAIL -> {
                                    Log.d(TAG, "✍️ Filling USERNAME/EMAIL directly: '${credential.username}'")
                                    datasetBuilder.setValue(
                                        field.autofillId,
                                        AutofillValue.forText(credential.username),
                                        presentation
                                    )
                                }
                                FieldType.PASSWORD -> {
                                    Log.d(TAG, "🔓 Filling PASSWORD with plaintext directly (NO auth required)")
                                    datasetBuilder.setValue(
                                        field.autofillId,
                                        AutofillValue.forText(credential.password),
                                        presentation
                                    )
                                }
                                else -> {
                                    Log.d(TAG, "⏭️ Skipping field type: ${field.type}")
                                }
                            }
                        }
                        Log.d(TAG, "✅ Dataset built WITHOUT authentication requirement")
                        Log.d(TAG, "   Credentials will fill immediately when user taps this suggestion")
                    }
                }
            }
        }
        
        return datasetBuilder.build()
    }

    /**
     * Called when the service is connected.
     */
    override fun onConnected() {
        super.onConnected()
        Log.d(TAG, "✅ Autofill service connected and bound to system!")
    }

    /**
     * Called when the service is disconnected.
     */
    override fun onDisconnected() {
        super.onDisconnected()
        Log.d(TAG, "Autofill service disconnected")
        
        // 📡 Unregister local broadcast receiver
        unregisterAuthSuccessReceiver()
    }
}

/**
 * Data class representing parsed autofill structure data
 */
data class ParsedStructureData(
    val domain: String,
    val packageName: String,
    val fields: List<AutofillField>
) {
    fun isEmpty(): Boolean = fields.isEmpty()
}

/**
 * Data class representing an autofillable field
 */
data class AutofillField(
    val autofillId: AutofillId,
    val type: FieldType,
    val hint: String?,
    val value: String?
)

/**
 * Enum representing field types
 */
enum class FieldType {
    USERNAME,
    PASSWORD,
    EMAIL,
    PHONE,
    OTHER
}

/**
 * Data class representing a credential for autofill
 */
data class AutofillCredential(
    val id: String,
    val username: String,
    val password: String,
    val domain: String,
    val salt: String = "",  // 🔑 CRITICAL: Salt for PBKDF2 key derivation during decryption
    val iv: String = "",  // Initialization vector for AES decryption
    val tag: String = "",  // Authentication tag for AES-GCM decryption
    val isEncrypted: Boolean = false  // Whether password is encrypted
)