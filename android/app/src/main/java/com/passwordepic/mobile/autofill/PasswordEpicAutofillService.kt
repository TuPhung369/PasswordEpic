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

class PasswordEpicAutofillService : AutofillService() {

    companion object {
        private const val TAG = "PasswordEpicAutofill"
        private const val AUTHENTICATION_REQUEST_CODE = 1001
        
        private const val DEBUG_MODE = false
        private const val SUPPRESS_SUGGESTIONS_WINDOW_MS = 3500L

        var parsedDataForAuth: ParsedStructureData? = null

        private val authenticatedCredentials = mutableMapOf<String, AutofillCredential>()
        private var lastSuccessfulFillTime = 0L
        
        private var serviceInstance: PasswordEpicAutofillService? = null

        fun setAuthenticatedCredential(credentialId: String, credential: AutofillCredential) {
            authenticatedCredentials[credentialId] = credential
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Authenticated credential cached: $credentialId")
        }
        
        fun getAuthenticatedCredentialsCount(): Int {
            return authenticatedCredentials.size
        }
        
        fun getAuthenticatedCredentials(): Map<String, AutofillCredential> {
            return authenticatedCredentials.toMap()
        }
        
        fun clearAuthenticatedCredentials() {
            if (authenticatedCredentials.isNotEmpty()) {
                Log.d(TAG, "DEBUG_AUTOFILL: 🗑️  Clearing ${authenticatedCredentials.size} cached credentials")
                authenticatedCredentials.clear()
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Cached credentials cleared successfully")
            }
        }
        
        fun shouldSuppressSuggestions(): Boolean {
            val timeSinceFill = System.currentTimeMillis() - lastSuccessfulFillTime
            return timeSinceFill < SUPPRESS_SUGGESTIONS_WINDOW_MS
        }
    }

    private val viewNodeParser = ViewNodeParser()
    private val domainVerifier = DomainVerifier()
    private lateinit var autofillDataProvider: AutofillDataProvider

    override fun onCreate() {
        super.onCreate()
        serviceInstance = this
        Log.d(TAG, "DEBUG_AUTOFILL: 🚀 Service.onCreate() called! Initializing AutofillDataProvider")
        try {
            autofillDataProvider = AutofillDataProvider(this)
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ AutofillDataProvider initialized with context")
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Failed to initialize AutofillDataProvider", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "DEBUG_AUTOFILL: ⚙️ onStartCommand() called with action: ${intent?.action}")
        return super.onStartCommand(intent, flags, startId)
    }

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        AutofillLogger.reset()
        AutofillLogger.logStep("onFillRequest() called")
        Log.d(TAG, "DEBUG_AUTOFILL: 📦 FillContexts count: ${request.fillContexts.size}")
        Log.d(TAG, "DEBUG_AUTOFILL: 🔐 Cached credentials count: ${authenticatedCredentials.size}")

        autofillDataProvider.cleanupExpiredCache()

        try {
            val structure: AssistStructure = request.fillContexts.lastOrNull()?.structure
                ?: run {
                    Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ No AssistStructure found in request")
                    callback.onFailure("No structure available")
                    return
                }

            AutofillLogger.logStep("Parse view structure")
            val parsedData = viewNodeParser.parseStructure(structure)
            parsedDataForAuth = parsedData
            
            if (parsedData.isEmpty()) {
                Log.d(TAG, "DEBUG_AUTOFILL: ❌ No autofillable fields found")
                callback.onSuccess(null)
                return
            }
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Found autofillable fields: ${parsedData.fields.size}")
            Log.d(TAG, "DEBUG_AUTOFILL: 🔗 Domain: '${parsedData.domain}', Package: '${parsedData.packageName}'")
            
            // Log field details for debugging domain issues
            parsedData.fields.forEachIndexed { idx, field ->
                Log.d(TAG, "DEBUG_AUTOFILL:   Field[$idx]: type=${field.type}, hint='${field.hint}'")
            }

            if (!domainVerifier.isValidDomain(parsedData.domain, parsedData.packageName)) {
                Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Domain verification failed: ${parsedData.domain}")
                callback.onFailure("Domain verification failed")
                return
            }

            if (shouldSuppressSuggestions()) {
                Log.d(TAG, "DEBUG_AUTOFILL: 🚫 Suggestions suppressed - recent successful fill detected")
                AutofillLogger.logStep("Suppress autofill UI temporarily")
                val disabledResponse = FillResponse.Builder().disableAutofill(SUPPRESS_SUGGESTIONS_WINDOW_MS).build()
                callback.onSuccess(disabledResponse)
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Disabling autofill temporarily to hide suggestion list")
                return
            }

            AutofillLogger.logStep("Check for cached authenticated credential")
            val cachedCredential = authenticatedCredentials.values.firstOrNull { cred ->
                cred.domain.equals(parsedData.domain, ignoreCase = true)
            } ?: authenticatedCredentials.values.firstOrNull()
            
            if (cachedCredential != null) {
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ ═══ CACHED CREDENTIAL FOUND! ═══")
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Credential ID: ${cachedCredential.id}")
                
                if (cachedCredential.isEncrypted) {
                    Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Cached credential is still encrypted. Aborting fill.")
                    callback.onSuccess(null)
                    authenticatedCredentials.remove(cachedCredential.id) // Clean up
                    return
                }

                AutofillLogger.logStep("Framework refill: Building response with cached plaintext credential")
                Log.d(TAG, "DEBUG_AUTOFILL: ✅🔥 Found cached credential, building response with requireAuth=false.")
                val response = buildFillResponse(parsedData, listOf(cachedCredential), requireAuth = false)
                
                AutofillLogger.logStep("Send plaintext response to framework")
                Log.d(TAG, "DEBUG_AUTOFILL: 📤 Sending response with plaintext data.")
                Log.d(TAG, "DEBUG_AUTOFILL: 📋 Username: ${cachedCredential.username}")
                Log.d(TAG, "DEBUG_AUTOFILL: 🔓 Password: [PLAINTEXT - Will be filled by framework]")
                callback.onSuccess(response)
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Plaintext credential sent - keeping cache for session")
                
                lastSuccessfulFillTime = System.currentTimeMillis()
                Log.d(TAG, "DEBUG_AUTOFILL: 🚫 Set suppression timer immediately - will suppress suggestions for next ${SUPPRESS_SUGGESTIONS_WINDOW_MS}ms")
                
                triggerAccessibilityServiceFill(parsedData.packageName)
                
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    Log.d(TAG, "DEBUG_AUTOFILL: 🗑️ Clearing cache after successful fill")
                    autofillDataProvider.clearDecryptedPasswordCache(cachedCredential.id)
                    clearAuthenticatedCredentials()
                }, 1000)
                
                return
            }

            Log.d(TAG, "DEBUG_AUTOFILL: ❌ ═══ NO CACHED CREDENTIAL FOUND! ═══")
            AutofillLogger.logStep("Search credentials from storage")
            val credentials = autofillDataProvider.getCredentialsForDomain(
                parsedData.domain,
                parsedData.packageName
            )

            if (credentials.isEmpty()) {
                Log.d(TAG, "DEBUG_AUTOFILL: ❌ No credentials found for domain: '${parsedData.domain}'")
                callback.onSuccess(null)
                return
            }
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Found ${credentials.size} matching credentials.")

            AutofillLogger.logStep("Check if authentication required")
            val requiresAuth = credentials.any { it.isEncrypted } || autofillDataProvider.isRequireBiometricEnabled()
            Log.d(TAG, "DEBUG_AUTOFILL: 🔐 Authentication required: $requiresAuth")

            AutofillLogger.logStep("Build response (auth=$requiresAuth)")
            Log.d(TAG, "DEBUG_AUTOFILL: ❌🔥 No cached credential found, building response with requireAuth=$requiresAuth.")
            val response = buildFillResponse(parsedData, credentials, requireAuth = requiresAuth)
            
            AutofillLogger.logStep("Send response to framework")
            callback.onSuccess(response)

        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error processing autofill request", e)
            callback.onFailure("Error: ${e.message}")
        }
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        // Implementation unchanged
    }

    private fun buildFillResponse(
        parsedData: ParsedStructureData,
        credentials: List<AutofillCredential>,
        requireAuth: Boolean
    ): FillResponse? {
        val responseBuilder = FillResponse.Builder()

        credentials.forEachIndexed { index, credential ->
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

            val dataset = buildDataset(parsedData, credential, authIntentSender, requireAuth = requireAuth)
            responseBuilder.addDataset(dataset)
        }

        val passwordField = parsedData.fields.firstOrNull { it.type == FieldType.PASSWORD }
        if (passwordField != null) {
            val saveInfoBuilder = SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_USERNAME or SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                arrayOf(passwordField.autofillId)
            )
            parsedData.fields.firstOrNull { it.type == FieldType.USERNAME }?.let {
                saveInfoBuilder.setOptionalIds(arrayOf(it.autofillId))
            }
            responseBuilder.setSaveInfo(saveInfoBuilder.build())
        }

        return responseBuilder.build()
    }

    private fun buildDataset(
        parsedData: ParsedStructureData,
        credential: AutofillCredential,
        authIntentSender: android.content.IntentSender,
        requireAuth: Boolean
    ): Dataset {
        val datasetBuilder: Dataset.Builder

        if (requireAuth) {
            val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
                setTextViewText(android.R.id.text1, credential.username)
            }
            datasetBuilder = Dataset.Builder(presentation)
            Log.d(TAG, "DEBUG_AUTOFILL:    🔐 Requiring authentication for ${credential.username}")
            datasetBuilder.setAuthentication(authIntentSender)
            // For username, we can show it.
            parsedData.fields.firstOrNull { it.type == FieldType.USERNAME || it.type == FieldType.EMAIL }?.let {
                datasetBuilder.setValue(it.autofillId, AutofillValue.forText(credential.username))
            }
            // For password, we set a null value. The real value will be filled after auth.
            parsedData.fields.firstOrNull { it.type == FieldType.PASSWORD }?.let {
                datasetBuilder.setValue(it.autofillId, null)
            }
        } else {
            Log.d(TAG, "DEBUG_AUTOFILL:    ✅ Building direct-fill dataset for ${credential.username}")
            val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
                setTextViewText(android.R.id.text1, credential.username)
            }
            datasetBuilder = Dataset.Builder(presentation)
            Log.d(TAG, "DEBUG_AUTOFILL: 📝 Filling by position order (cached)")
            parsedData.fields.forEachIndexed { index, field ->
                when (index) {
                    0 -> {
                        Log.d(TAG, "DEBUG_AUTOFILL:   [0] Username: ${credential.username}")
                        datasetBuilder.setValue(field.autofillId, AutofillValue.forText(credential.username))
                    }
                    1 -> {
                        Log.d(TAG, "DEBUG_AUTOFILL:   [1] Password: [PLAINTEXT]")
                        datasetBuilder.setValue(field.autofillId, AutofillValue.forText(credential.password))
                    }
                }
            }
        }
        
        return datasetBuilder.build()
    }

    override fun onConnected() {
        super.onConnected()
        Log.d(TAG, "DEBUG_AUTOFILL: ✅ Autofill service connected and bound to system!")
    }

    override fun onDisconnected() {
        super.onDisconnected()
        Log.d(TAG, "DEBUG_AUTOFILL: Autofill service disconnected")
    }

    private fun triggerAccessibilityServiceFill(packageName: String) {
        try {
            Log.d(TAG, "DEBUG_AUTOFILL: 🚀 Triggering accessibility service fill for $packageName")
            val intent = Intent(AutofillRefillAccessibilityService.ACTION_TRIGGER_REFILL).apply {
                putExtra("targetPackage", packageName)
            }
            sendBroadcast(intent)
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Accessibility fill broadcast sent")
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error triggering accessibility fill: ${e.message}")
        }
    }
}

// Data classes (ParsedStructureData, AutofillField, FieldType, AutofillCredential) remain unchanged

data class ParsedStructureData(
    val domain: String,
    val packageName: String,
    val fields: List<AutofillField>
) {
    fun isEmpty(): Boolean = fields.isEmpty()
}

data class AutofillField(
    val autofillId: AutofillId,
    val type: FieldType,
    val hint: String?,
    val value: String?
)

enum class FieldType {
    USERNAME,
    PASSWORD,
    EMAIL,
    PHONE,
    OTHER
}

data class AutofillCredential(
    val id: String,
    val username: String,
val password: String,
    val domain: String,
    val salt: String = "",
    val iv: String = "",
    val tag: String = "",
    val isEncrypted: Boolean = false
)