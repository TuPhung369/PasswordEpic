package com.passwordepic.mobile.autofill

import android.app.assist.AssistStructure
import android.content.Intent
import android.os.CancellationSignal
import android.service.autofill.*
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
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
        private const val DEBUG_MODE = true  // ⚠️ SET TO FALSE IN PRODUCTION
        
        private val authenticatedCredentials = mutableMapOf<String, AutofillCredential>()
        
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
    }

    private val viewNodeParser = ViewNodeParser()
    private val domainVerifier = DomainVerifier()
    private lateinit var autofillDataProvider: AutofillDataProvider

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚀 Service.onCreate() called! Initializing AutofillDataProvider")
        try {
            autofillDataProvider = AutofillDataProvider(this)
            Log.d(TAG, "✅ AutofillDataProvider initialized with context")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to initialize AutofillDataProvider", e)
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
                            Log.d(TAG, "🔒 Filling PASSWORD field")
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
            
            parsedData.fields.forEach { field ->
                when (field.type) {
                    FieldType.USERNAME, FieldType.EMAIL -> {
                        Log.d(TAG, "✍️ [DEBUG] Filling USERNAME/EMAIL with: '${credential.username}'")
                        datasetBuilder.setValue(
                            field.autofillId,
                            AutofillValue.forText(credential.username),
                            presentation
                        )
                    }
                    FieldType.PASSWORD -> {
                        Log.d(TAG, "🔒 [DEBUG] Filling PASSWORD with value")
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
            Log.d(TAG, "✅ Dataset built in DEBUG_MODE with DIRECT VALUES (no auth required)")
        } else {
            // PRODUCTION MODE: Require authentication first
            Log.d(TAG, "🔐 PRODUCTION_MODE - Requiring authentication before filling")
            
            // Set authentication requirement with presentation
            datasetBuilder.setAuthentication(authIntentSender)
            
            // Add presentation to show the username in the dropdown
            // but don't set any field values yet (will be filled after auth)
            parsedData.fields.forEach { field ->
                when (field.type) {
                    FieldType.USERNAME, FieldType.EMAIL -> {
                        Log.d(TAG, "📍 Adding presentation for USERNAME/EMAIL field (auth required)")
                        datasetBuilder.setValue(
                            field.autofillId,
                            null,
                            presentation
                        )
                    }
                    FieldType.PASSWORD -> {
                        Log.d(TAG, "📍 Adding presentation for PASSWORD field (auth required)")
                        datasetBuilder.setValue(
                            field.autofillId,
                            null,
                            presentation
                        )
                    }
                    else -> {
                        Log.d(TAG, "⏭️ Skipping field type: ${field.type}")
                    }
                }
            }
            Log.d(TAG, "✅ Dataset built with authentication requirement (values will be filled after auth)")
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
    val domain: String
)