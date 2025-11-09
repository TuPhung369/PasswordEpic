package com.passwordepic.mobile.autofill

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log
import androidx.core.content.ContextCompat
import android.os.Bundle
import android.content.ClipboardManager
import android.content.ClipData

/**
 * 🔄 Accessibility Service for triggering autofill refill after biometric authentication
 * 
 * This service listens for broadcast intents from AutofillAuthActivity
 * and performs accessibility actions to trigger a new autofill request.
 * 
 * The problem it solves:
 * - After biometric auth succeeds, many devices don't automatically call onFillRequest() again
 * - This service actively triggers a refill by performing accessibility actions
 * - It does this by simulating user interactions that would normally trigger autofill
 * 
 * Requirements:
 * - User must enable this accessibility service in Android Settings > Accessibility
 * - Service needs explicit permission grant to work on Android 12+
 */
class AutofillRefillAccessibilityService : AccessibilityService() {
    
    companion object {
        private const val TAG = "AutofillRefill"
        const val ACTION_TRIGGER_REFILL = "com.passwordepic.mobile.TRIGGER_AUTOFILL_REFILL"
    }
    
    private val refillReceiver = RefillBroadcastReceiver()
    private var isReceiverRegistered = false
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "DEBUG_AUTOFILL: ════════════════════════════════════════")
        Log.d(TAG, "DEBUG_AUTOFILL: ✅ Accessibility Service CONNECTED!")
        Log.d(TAG, "DEBUG_AUTOFILL: ════════════════════════════════════════")
        
        val filter = IntentFilter(ACTION_TRIGGER_REFILL)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Log.d(TAG, "DEBUG_AUTOFILL: 🔧 Android 12+ detected - registering receiver with RECEIVER_EXPORTED")
                ContextCompat.registerReceiver(
                    this,
                    refillReceiver,
                    filter,
                    ContextCompat.RECEIVER_EXPORTED
                )
            } else {
                Log.d(TAG, "DEBUG_AUTOFILL: 🔧 Android 11 or below - registering receiver directly")
                registerReceiver(refillReceiver, filter)
            }
            isReceiverRegistered = true
            Log.d(TAG, "DEBUG_AUTOFILL: ✅ BroadcastReceiver registered successfully!")
            Log.d(TAG, "DEBUG_AUTOFILL: 📡 Listening for action: $ACTION_TRIGGER_REFILL")
            Log.d(TAG, "DEBUG_AUTOFILL: ════════════════════════════════════════")
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ FAILED to register receiver: ${e.message}")
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Stack: ${e.stackTraceToString()}")
            isReceiverRegistered = false
        }
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't process events here, we're controlled by broadcasts from AutofillAuthActivity
    }
    
    override fun onInterrupt() {
        Log.w(TAG, "DEBUG_AUTOFILL: ⚠️⚠️⚠️ Accessibility Service INTERRUPTED")
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.w(TAG, "DEBUG_AUTOFILL: ════════════════════════════════════════")
        Log.w(TAG, "DEBUG_AUTOFILL: 🛑 Accessibility Service DESTROYED")
        Log.w(TAG, "DEBUG_AUTOFILL: ════════════════════════════════════════")
        
        if (isReceiverRegistered) {
            try {
                unregisterReceiver(refillReceiver)
                isReceiverRegistered = false
                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Receiver unregistered successfully")
            } catch (e: Exception) {
                Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error unregistering receiver: ${e.message}")
            }
        }
    }
    
    /**
     * Inner class to receive broadcast intents for refill triggers
     */
    private inner class RefillBroadcastReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.d(TAG, "DEBUG_AUTOFILL: 🔔 BroadcastReceiver.onReceive() called!")
            Log.d(TAG, "DEBUG_AUTOFILL: Intent action: ${intent?.action}")
            Log.d(TAG, "DEBUG_AUTOFILL: Expected action: $ACTION_TRIGGER_REFILL")
            
            if (intent?.action == ACTION_TRIGGER_REFILL) {
                val targetPackage = intent.getStringExtra("targetPackage")
                Log.d(TAG, "DEBUG_AUTOFILL: ┌─────────────────────────────────────────────")
                Log.d(TAG, "DEBUG_AUTOFILL: ✅✅✅ TRIGGER_REFILL BROADCAST RECEIVED! ✅✅✅")
                Log.d(TAG, "DEBUG_AUTOFILL: Biometric auth succeeded!")
                Log.d(TAG, "DEBUG_AUTOFILL: Target package: $targetPackage")
                
                val isBrowser = isBrowserPackage(targetPackage)
                Log.d(TAG, "DEBUG_AUTOFILL: 🌐 Is Browser: $isBrowser")
                
                if (isBrowser) {
                    Log.d(TAG, "DEBUG_AUTOFILL: 🌍 WEB FLOW: Using direct fill (form fields filtered safely)")
                    Log.d(TAG, "DEBUG_AUTOFILL: └─────────────────────────────────────────────")
                }
                
                val cachedCount = PasswordEpicAutofillService.getAuthenticatedCredentialsCount()
                Log.d(TAG, "DEBUG_AUTOFILL: 🔐 CACHED CREDENTIALS COUNT: $cachedCount")
                
                if (cachedCount > 0) {
                    try {
                        val creds = PasswordEpicAutofillService.getAuthenticatedCredentials()
                        for ((id, cred) in creds) {
                            Log.d(TAG, "DEBUG_AUTOFILL: 📦 Credential ID: $id")
                            Log.d(TAG, "DEBUG_AUTOFILL: Username: ${cred.username}")
                            Log.d(TAG, "DEBUG_AUTOFILL: Password cached: ${cred.password.isNotEmpty()}")
                            Log.d(TAG, "DEBUG_AUTOFILL: IsEncrypted: ${cred.isEncrypted}")
                            Log.d(TAG, "DEBUG_AUTOFILL: Domain: ${cred.domain}")
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Error reading cached credentials: ${e.message}")
                    }
                } else {
                    Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ NO CACHED CREDENTIALS!")
                }
                
                Log.d(TAG, "DEBUG_AUTOFILL: 📱 APP FLOW: Starting immediate refill trigger...")
                Log.d(TAG, "DEBUG_AUTOFILL: └─────────────────────────────────────────────")
                
                Thread {
                    try {
                        Log.d(TAG, "DEBUG_AUTOFILL: 🧵 Background thread initial wait (400ms)...")
                        Thread.sleep(400)

                        var refillSuccess = false
                        var attempts = 0
                        val maxAttempts = 15
                        
                        while (!refillSuccess && attempts < maxAttempts) {
                            attempts++
                            Log.d(TAG, "DEBUG_AUTOFILL: Refill attempt #$attempts/$maxAttempts...")
                            
                            try {
                                val triggerSuccess = triggerAutofillRefill(targetPackage)
                                if (triggerSuccess) {
                                    refillSuccess = true
                                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ Refill triggered successfully on attempt #$attempts")
                                } else {
                                    Log.w(TAG, "DEBUG_AUTOFILL: Attempt #$attempts did not find target window or fields, will retry...")
                                    if (attempts < maxAttempts) {
                                        Thread.sleep(250)
                                    }
                                }
                            } catch (e: Exception) {
                                Log.w(TAG, "DEBUG_AUTOFILL: Attempt #$attempts error: ${e.message}")
                                if (attempts < maxAttempts) {
                                    Thread.sleep(250)
                                }
                            }
                        }
                        
                        if (!refillSuccess) {
                            Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ All refill attempts failed ($maxAttempts tried)")
                            Log.w(TAG, "DEBUG_AUTOFILL: This is OK - framework will refill when user refocuses field")
                        }
                        
                    } catch (e: Exception) {
                        Log.e(TAG, "DEBUG_AUTOFILL: ❌ Thread error: ${e.message}")
                    }
                }.start()
            } else {
                Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Received broadcast with DIFFERENT action: ${intent?.action}")
            }
        }
    }
    
    /**
     * 🌐 Detects if the target package is a web browser
     */
    private fun isBrowserPackage(packageName: String?): Boolean {
        if (packageName == null) return false
        
        val browserPackages = setOf(
            "com.android.chrome",
            "com.android.browser",
            "org.mozilla.firefox",
            "org.mozilla.fenix",
            "com.opera.browser",
            "com.sec.android.app.sbrowser",
            "com.brave.browser",
            "com.microsoft.edge",
            "org.chromium.webview_shell",
            "com.google.android.webview"
        )
        
        return browserPackages.any { packageName.equals(it, ignoreCase = true) || packageName.contains("chrome", ignoreCase = true) || packageName.contains("browser", ignoreCase = true) }
    }
    
    /**
     * 🌐 For web flow: Focus first actual form field (input/textarea) to trigger onFillRequest()
     * Avoids focusing address bar or other non-form fields
     */
    private fun focusFirstFormField(targetPackage: String?): Boolean {
        if (targetPackage == null) {
            Log.w(TAG, "DEBUG_AUTOFILL: ❌ Target package is null")
            return false
        }
        
        try {
            val windowsList = windows
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Searching ${windowsList.size} windows for form fields...")
            
            for ((index, window) in windowsList.withIndex()) {
                val windowRoot = window.root ?: continue
                val windowPackage = windowRoot.packageName?.toString() ?: "unknown"
                
                if (windowPackage.equals(targetPackage, ignoreCase = true)) {
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ Found target window: $targetPackage")
                    
                    val formFields = mutableListOf<AccessibilityNodeInfo>()
                    findFormFields(windowRoot, formFields)
                    
                    if (formFields.isEmpty()) {
                        Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ No form fields found in target window")
                        windowRoot.recycle()
                        return false
                    }
                    
                    Log.d(TAG, "DEBUG_AUTOFILL: 🎯 Found ${formFields.size} form fields")
                    
                    var actionSucceeded = false
                    try {
                        val firstField = formFields.first()
                        Log.d(TAG, "DEBUG_AUTOFILL: 🔗 Focusing first form field...")
                        
                        val focusResult = firstField.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
                        if (focusResult) {
                            Log.d(TAG, "DEBUG_AUTOFILL: ✅ Successfully focused form field")
                            Thread.sleep(100)
                            actionSucceeded = true
                        } else {
                            Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ ACTION_FOCUS returned false, trying ACTION_CLICK...")
                            val clickResult = firstField.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            if (clickResult) {
                                Log.d(TAG, "DEBUG_AUTOFILL: ✅ Successfully clicked form field")
                                Thread.sleep(100)
                                actionSucceeded = true
                            }
                        }
                    } finally {
                        formFields.forEach { 
                            try {
                                it.recycle()
                            } catch (e: Exception) {
                                Log.w(TAG, "DEBUG_AUTOFILL: Error recycling node: ${e.message}")
                            }
                        }
                        try {
                            windowRoot.recycle()
                        } catch (e: Exception) {
                            Log.w(TAG, "DEBUG_AUTOFILL: Error recycling window: ${e.message}")
                        }
                    }
                    
                    return actionSucceeded
                } else {
                    windowRoot.recycle()
                }
            }
            
            Log.w(TAG, "DEBUG_AUTOFILL: ❌ Target package not found in windows")
            return false
            
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Error focusing form field: ${e.message}")
            return false
        }
    }
    
    /**
     * 🔍 Find form field nodes (input, textarea) - skip address bar and other non-form nodes
     */
    private fun findFormFields(
        node: AccessibilityNodeInfo?,
        fields: MutableList<AccessibilityNodeInfo>,
        maxFields: Int = 10,
        maxDepth: Int = 30,
        currentDepth: Int = 0
    ) {
        if (node == null || currentDepth >= maxDepth || fields.size >= maxFields) return
        
        try {
            val className = node.className?.toString() ?: ""
            val viewId = node.viewIdResourceName?.toString() ?: ""
            val contentDesc = node.contentDescription?.toString()?.lowercase() ?: ""
            val text = node.text?.toString()?.lowercase() ?: ""
            
            val isFormField = (
                (className.contains("EditText", ignoreCase = true) || 
                 className.contains("TextInputEditText", ignoreCase = true) ||
                 className.contains("AutoCompleteTextView", ignoreCase = true)) &&
                !viewId.contains("url", ignoreCase = true) &&
                !viewId.contains("address", ignoreCase = true) &&
                !contentDesc.contains("url", ignoreCase = true) &&
                !contentDesc.contains("address", ignoreCase = true) &&
                !text.contains("http", ignoreCase = true) &&
                node.isEditable && node.isEnabled && node.isFocusable && node.isVisibleToUser
            )
            
            if (isFormField) {
                Log.d(TAG, "DEBUG_AUTOFILL: 📝 Found form field at depth $currentDepth: $className")
                fields.add(AccessibilityNodeInfo.obtain(node))
                if (fields.size >= maxFields) return
            }
            
            for (i in 0 until node.childCount) {
                if (fields.size >= maxFields) break
                val child = node.getChild(i)
                findFormFields(child, fields, maxFields, maxDepth, currentDepth + 1)
            }
        } catch (e: Exception) {
            Log.d(TAG, "      Error traversing node: ${e.message}")
        }
    }
    
    /**
     * 🔄 Triggers autofill refill by performing accessibility actions on the correct window.
     * 
     * Strategy:
     * 1. Iterate through all available windows provided by the Accessibility Service.
     * 2. Find the window that belongs to the `targetPackage`.
     * 3. Once the target window is found, search for input fields (EditText, etc.) within it.
     * 4. Directly fill the fields with username and password from cached credentials.
     * 5. Uses accessibility ACTION_SET_TEXT to inject credentials directly into fields.
     * 
     * Returns: true if fields were filled in the target window, false otherwise.
     */
    private fun triggerAutofillRefill(targetPackage: String?): Boolean {
        if (targetPackage == null) {
            Log.w(TAG, "DEBUG_AUTOFILL: ❌ Target package is null, cannot trigger refill.")
            return false
        }

        Log.d(TAG, "DEBUG_AUTOFILL: ═══════════════════════════════════════════════")
        Log.d(TAG, "DEBUG_AUTOFILL: 🔄 STARTING AUTOFILL REFILL TRIGGER")
        Log.d(TAG, "DEBUG_AUTOFILL: ═══════════════════════════════════════════════")
        Log.d(TAG, "DEBUG_AUTOFILL: Target package: $targetPackage")

        val cachedCredential = PasswordEpicAutofillService.getAuthenticatedCredentials().values.firstOrNull()
        val cachedCount = PasswordEpicAutofillService.getAuthenticatedCredentialsCount()
        Log.d(TAG, "DEBUG_AUTOFILL: 🔐 VERIFIED: Cached credentials available: $cachedCount")
        if (cachedCount == 0 || cachedCredential == null) {
            Log.w(TAG, "DEBUG_AUTOFILL: ❌ NO CACHED CREDENTIALS - refill will fail!")
            return false
        }

        Log.d(TAG, "DEBUG_AUTOFILL: 📦 Cached Username: ${cachedCredential.username}")
        Log.d(TAG, "DEBUG_AUTOFILL: 🔐 Cached Password: [ENCRYPTED]")

        try {
            val windowsList = windows
            Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Searching ${windowsList.size} windows for target package...")

            for ((index, window) in windowsList.withIndex()) {
                val windowRoot = window.root ?: continue
                val windowPackage = windowRoot.packageName?.toString() ?: "unknown"
                
                Log.d(TAG, "DEBUG_AUTOFILL: [Window ${index + 1}/${windowsList.size}] Package: $windowPackage")

                if (windowPackage.equals(targetPackage, ignoreCase = true)) {
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ FOUND TARGET WINDOW for package: $targetPackage")
                    
                    val isBrowser = isBrowserPackage(targetPackage)
                    val inputFields = mutableListOf<AccessibilityNodeInfo>()
                    findInputFieldsDeep(windowRoot, inputFields, isBrowser)
                    
                    if (inputFields.isEmpty()) {
                        Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Found target window, but it contains no input fields. Trying next window...")
                        windowRoot.recycle()
                        continue 
                    }

                    Log.d(TAG, "DEBUG_AUTOFILL: 🔍 Found ${inputFields.size} input fields in target window.")
                    Log.d(TAG, "DEBUG_AUTOFILL: 🎯 Filling fields with cached credentials...")
                    var fieldsFilled = 0
                    val filledFields = mutableListOf<AccessibilityNodeInfo>()
                    try {
                        val fieldsToFill = if (isBrowser) inputFields.take(2) else inputFields
                        
                        for ((fieldIndex, field) in fieldsToFill.withIndex()) {
                            try {
                                Log.d(TAG, "DEBUG_AUTOFILL:   - Processing Field ${fieldIndex + 1}/${fieldsToFill.size}...")
                                
                                val contentDesc = field.contentDescription?.toString()?.lowercase() ?: ""
                                val viewId = field.viewIdResourceName?.toString()?.lowercase() ?: ""
                                
                                val isPasswordField = contentDesc.contains("password") || contentDesc.contains("pwd") || viewId.contains("password") || viewId.contains("pwd")

                                val valueToFill = if (fieldIndex == 0 && !isPasswordField) {
                                    Log.d(TAG, "DEBUG_AUTOFILL:     └─ Detected as USERNAME field (position 0)")
                                    cachedCredential.username
                                } else if (fieldIndex == 1 || isPasswordField) {
                                    Log.d(TAG, "DEBUG_AUTOFILL:     └─ Detected as PASSWORD field (position $fieldIndex)")
                                    cachedCredential.password
                                } else {
                                    continue
                                }

                                field.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
                                
                                Thread.sleep(50)
                                
                                val textArgs = Bundle()
                                textArgs.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, valueToFill)
                                val textSet = field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, textArgs)
                                
                                if (textSet) {
                                    Log.d(TAG, "DEBUG_AUTOFILL:     └─ ✅ Text filled via ACTION_SET_TEXT")
                                    filledFields.add(AccessibilityNodeInfo.obtain(field))
                                    fieldsFilled++
                                } else {
                                    Log.w(TAG, "DEBUG_AUTOFILL:     └─ ⚠️ ACTION_SET_TEXT failed, trying clipboard method...")
                                    if (fillFieldViaClipboard(valueToFill, field)) {
                                        Log.d(TAG, "DEBUG_AUTOFILL:     └─ ✅ Text filled via clipboard + paste")
                                        filledFields.add(AccessibilityNodeInfo.obtain(field))
                                        fieldsFilled++
                                    } else {
                                        Log.w(TAG, "DEBUG_AUTOFILL:     └─ ⚠️ Clipboard method also failed")
                                    }
                                }
                                
                                Thread.sleep(100)
                                
                            } catch (e: Exception) {
                                Log.e(TAG, "DEBUG_AUTOFILL:     └─ ❌ Exception during fill: ${e.message}")
                            }
                        }
                    } finally {
                        Log.d(TAG, "DEBUG_AUTOFILL: 🧹 Cleaning up ${inputFields.size} input field nodes.")
                        inputFields.forEach { it.recycle() }
                    }

                    windowRoot.recycle()

                    if (fieldsFilled > 0) {
                        Log.d(TAG, "DEBUG_AUTOFILL: ✅✅✅ FILLED $fieldsFilled FIELDS ✅✅✅")
                        Thread.sleep(150)
                        
                        if (isBrowser) {
                            Log.d(TAG, "DEBUG_AUTOFILL: 🌐 WEB BROWSER DETECTED - Blurring filled fields to prevent autofill UI")
                            try {
                                for (field in filledFields) {
                                    field.performAction(AccessibilityNodeInfo.ACTION_CLEAR_FOCUS)
                                    Thread.sleep(50)
                                }
                                Log.d(TAG, "DEBUG_AUTOFILL: ✅ All fields blurred successfully")
                            } catch (e: Exception) {
                                Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Error blurring fields: ${e.message}")
                            } finally {
                                filledFields.forEach { it.recycle() }
                            }
                        }
                        
                        Log.d(TAG, "DEBUG_AUTOFILL: 🔐 Autofill successful - clearing cached credentials for security...")
                        PasswordEpicAutofillService.clearAuthenticatedCredentials()
                        return true 
                    } else {
                        Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Could not fill any fields.")
                        filledFields.forEach { it.recycle() }
                    }
                } else {
                    windowRoot.recycle() 
                }
            }

            Log.w(TAG, "DEBUG_AUTOFILL: ⚠️ Target package '$targetPackage' not found in any of the ${windowsList.size} windows.")
            return false

        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: ❌ Unhandled exception in triggerAutofillRefill: ${e.message}")
            return false
        }
    }
    
    /**
     * 📋 Fills a field via clipboard + paste action
     * This is a reliable fallback when ACTION_SET_TEXT doesn't work
     */
    private fun fillFieldViaClipboard(value: String, field: AccessibilityNodeInfo): Boolean {
        return try {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            if (clipboard != null) {
                val clip = ClipData.newPlainText("autofill_data", value)
                clipboard.setPrimaryClip(clip)
                Thread.sleep(50)
                field.performAction(AccessibilityNodeInfo.ACTION_PASTE)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "DEBUG_AUTOFILL: Error in clipboard fill: ${e.message}")
            false
        }
    }
    
    /**
     * 🔍 Recursively find all editable input fields with better performance
     * For browsers, filters out address bar fields to avoid filling URI fields
     */
    private fun findInputFieldsDeep(
        node: AccessibilityNodeInfo?,
        fields: MutableList<AccessibilityNodeInfo>,
        isBrowser: Boolean = false,
        maxFields: Int = 20,
        maxDepth: Int = 30,
        currentDepth: Int = 0
    ) {
        if (node == null || currentDepth >= maxDepth || fields.size >= maxFields) return
        
        try {
            val className = node.className?.toString() ?: ""
            val viewId = node.viewIdResourceName?.toString()?.lowercase() ?: ""
            val contentDesc = node.contentDescription?.toString()?.lowercase() ?: ""
            val text = node.text?.toString()?.lowercase() ?: ""
            
            val isAddressBarField = (
                viewId.contains("url", ignoreCase = true) ||
                viewId.contains("address", ignoreCase = true) ||
                viewId.contains("toolbar", ignoreCase = true) ||
                contentDesc.contains("url", ignoreCase = true) ||
                contentDesc.contains("address", ignoreCase = true) ||
                contentDesc.contains("search", ignoreCase = true) ||
                text.contains("http", ignoreCase = true)
            )
            
            if ( (className.contains("EditText", ignoreCase = true) || className.contains("TextInputEditText", ignoreCase = true) || node.isEditable) && node.isEnabled && node.isFocusable && node.isVisibleToUser ) {
                if (isBrowser && isAddressBarField) {
                    Log.d(TAG, "DEBUG_AUTOFILL: ⏭️  Skipping browser address/toolbar field at depth $currentDepth: $className (id=$viewId)")
                } else {
                    Log.d(TAG, "DEBUG_AUTOFILL: ✅ Found QUALIFIED field at depth $currentDepth: $className")
                    fields.add(AccessibilityNodeInfo.obtain(node))
                    if (fields.size >= maxFields) return
                }
            }
            
            for (i in 0 until node.childCount) {
                if (fields.size >= maxFields) break
                val child = node.getChild(i)
                findInputFieldsDeep(child, fields, isBrowser, maxFields, maxDepth, currentDepth + 1)
                // DO NOT recycle child here; it prevents deep traversal.
                // The parent `triggerAutofillRefill` is responsible for recycling the root, which cleans up its descendants.
                // The `inputFields` list contains copies that are recycled separately.
            }
        } catch (e: Exception) {
            Log.d(TAG, "      Error traversing node: ${e.message}")
        } finally {
            // The node passed in should be recycled by its caller if it was obtained via getChild or getRoot
            // In our case, we let the top-level loop in triggerAutofillRefill handle it.
        }
    }
}