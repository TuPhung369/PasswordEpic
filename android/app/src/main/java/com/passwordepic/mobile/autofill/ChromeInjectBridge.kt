package com.passwordepic.mobile.autofill

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Chrome Inject Bridge - JavaScript Injection for Chrome AutoFill
 *
 * Handles JavaScript injection into Chrome WebView to support autofill
 * for web forms that the Android Autofill Framework cannot access.
 *
 * Features:
 * - Form detection and field locating
 * - JavaScript-based credential injection
 * - Domain verification
 * - Security checks (HTTPS only, XSS prevention)
 *
 * @author PasswordEpic Team
 * @since Week 10 - Chrome Integration Phase
 */
class ChromeInjectBridge(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ChromeInjectBridge"
        private const val MODULE_NAME = "ChromeInjectBridge"

        // Event names
        private const val EVENT_FORM_DETECTED = "onFormDetected"
        private const val EVENT_INJECTION_SUCCESS = "onInjectionSuccess"
        private const val EVENT_INJECTION_FAILED = "onInjectionFailed"

        // JavaScript injection templates
        private const val FORM_DETECTION_JS = """
            (function() {
                const forms = document.querySelectorAll('form');
                const loginForms = [];
                
                forms.forEach((form, index) => {
                    const userField = form.querySelector('input[type="text"], input[type="email"], input[type="username"]');
                    const passField = form.querySelector('input[type="password"]');
                    
                    if (userField && passField) {
                        loginForms.push({
                            formIndex: index,
                            userFieldName: userField.name || userField.id || 'user_' + index,
                            passFieldName: passField.name || passField.id || 'pass_' + index,
                            formId: form.id || 'form_' + index,
                            actionUrl: form.action || '',
                            method: form.method || 'POST'
                        });
                    }
                });
                
                return JSON.stringify({
                    success: true,
                    formCount: loginForms.length,
                    forms: loginForms,
                    pageUrl: window.location.href,
                    title: document.title
                });
            })();
        """

        // Credential injection template
        private const val INJECT_CREDENTIALS_JS_TEMPLATE = """
            (function() {
                try {
                    const username = '%USERNAME%';
                    const password = '%PASSWORD%';
                    const domain = '%DOMAIN%';
                    
                    // Verify domain matches
                    const currentDomain = new URL(window.location.href).hostname;
                    if (!currentDomain.includes(domain)) {
                        return JSON.stringify({
                            success: false,
                            error: 'Domain mismatch: ' + currentDomain + ' vs ' + domain
                        });
                    }
                    
                    // Find username field
                    const userField = document.querySelector(
                        'input[type="text"], input[type="email"], input[type="username"]'
                    );
                    
                    // Find password field
                    const passField = document.querySelector('input[type="password"]');
                    
                    if (!userField || !passField) {
                        return JSON.stringify({
                            success: false,
                            error: 'Could not find form fields'
                        });
                    }
                    
                    // Inject credentials
                    userField.value = username;
                    passField.value = password;
                    
                    // Trigger input events for form validation
                    [userField, passField].forEach(field => {
                        field.dispatchEvent(new Event('input', { bubbles: true }));
                        field.dispatchEvent(new Event('change', { bubbles: true }));
                        field.dispatchEvent(new Event('blur', { bubbles: true }));
                    });
                    
                    return JSON.stringify({
                        success: true,
                        usernameInjected: true,
                        passwordInjected: true,
                        message: 'Credentials injected successfully'
                    });
                } catch(e) {
                    return JSON.stringify({
                        success: false,
                        error: e.message
                    });
                }
            })();
        """

        // Form detection for auto-detection feature
        private const val DETECT_LOGIN_FORM_JS = """
            (function() {
                try {
                    const userField = document.querySelector(
                        'input[type="text"], input[type="email"], input[type="username"]'
                    );
                    const passField = document.querySelector('input[type="password"]');
                    
                    return JSON.stringify({
                        success: true,
                        hasUserField: !!userField,
                        hasPassField: !!passField,
                        isLoginForm: !!(userField && passField),
                        fieldIds: {
                            userFieldId: userField?.id || null,
                            userFieldName: userField?.name || null,
                            passFieldId: passField?.id || null,
                            passFieldName: passField?.name || null
                        }
                    });
                } catch(e) {
                    return JSON.stringify({
                        success: false,
                        error: e.message
                    });
                }
            })();
        """
    }

    override fun getName(): String = MODULE_NAME

    /**
     * Detects if a login form is present on the current page
     */
    @ReactMethod
    fun detectLoginForm(promise: Promise) {
        try {
            val currentActivity = currentActivity ?: run {
                promise.reject("ACTIVITY_NOT_FOUND", "Current activity is null")
                return
            }

            executeJavaScript(currentActivity, DETECT_LOGIN_FORM_JS) { result ->
                try {
                    val json = ReadableNativeMap.nativeMapToWritableMap(
                        Arguments.fromJavaMap(
                            JSONObjectToMap(org.json.JSONObject(result))
                        ) as ReadableNativeMap
                    )
                    promise.resolve(json)
                } catch (e: Exception) {
                    promise.reject("JSON_PARSE_ERROR", "Failed to parse result: ${e.message}")
                }
            }
        } catch (e: Exception) {
            promise.reject("DETECT_FORM_ERROR", "Error detecting form: ${e.message}")
        }
    }

    /**
     * Injects credentials into the current page's login form
     *
     * @param username The username to inject
     * @param password The password to inject
     * @param domain The domain to verify against
     * @param promise Promise to resolve with result
     */
    @ReactMethod
    fun injectCredentials(
        username: String,
        password: String,
        domain: String,
        promise: Promise
    ) {
        try {
            val currentActivity = currentActivity ?: run {
                promise.reject("ACTIVITY_NOT_FOUND", "Current activity is null")
                return
            }

            // Escape special characters to prevent injection attacks
            val safeUsername = escapeJavaScript(username)
            val safePassword = escapeJavaScript(password)
            val safeDomain = escapeJavaScript(domain)

            // Verify HTTPS (security requirement)
            if (!isHttpsPage(currentActivity)) {
                promise.reject(
                    "INSECURE_PAGE",
                    "Autofill only works on HTTPS pages for security"
                )
                return
            }

            val injectionScript = INJECT_CREDENTIALS_JS_TEMPLATE
                .replace("%USERNAME%", safeUsername)
                .replace("%PASSWORD%", safePassword)
                .replace("%DOMAIN%", safeDomain)

            executeJavaScript(currentActivity, injectionScript) { result ->
                try {
                    val json = org.json.JSONObject(result)
                    val success = json.optBoolean("success", false)

                    val response = WritableNativeMap().apply {
                        putBoolean("success", success)
                        if (success) {
                            putString("message", json.optString("message", "Credentials injected"))
                        } else {
                            putString("error", json.optString("error", "Unknown error"))
                        }
                    }

                    promise.resolve(response)

                    // Send event
                    if (success) {
                        sendEvent(EVENT_INJECTION_SUCCESS, mapOf("timestamp" to System.currentTimeMillis()))
                    } else {
                        sendEvent(EVENT_INJECTION_FAILED, mapOf("error" to json.optString("error")))
                    }
                } catch (e: Exception) {
                    promise.reject("RESULT_PARSE_ERROR", "Failed to parse injection result: ${e.message}")
                }
            }
        } catch (e: Exception) {
            promise.reject("INJECTION_ERROR", "Error injecting credentials: ${e.message}")
        }
    }

    /**
     * Detects all login forms on the current page
     */
    @ReactMethod
    fun detectAllForms(promise: Promise) {
        try {
            val currentActivity = currentActivity ?: run {
                promise.reject("ACTIVITY_NOT_FOUND", "Current activity is null")
                return
            }

            executeJavaScript(currentActivity, FORM_DETECTION_JS) { result ->
                try {
                    val json = org.json.JSONObject(result)
                    val success = json.optBoolean("success", false)

                    val response = WritableNativeMap().apply {
                        putBoolean("success", success)
                        putInt("formCount", json.optInt("formCount", 0))
                        putString("pageUrl", json.optString("pageUrl", ""))
                        putString("title", json.optString("title", ""))

                        val formsArray = json.optJSONArray("forms")
                        if (formsArray != null) {
                            val forms = WritableNativeArray()
                            for (i in 0 until formsArray.length()) {
                                val form = formsArray.getJSONObject(i)
                                forms.pushMap(WritableNativeMap().apply {
                                    putInt("formIndex", form.optInt("formIndex", i))
                                    putString("userFieldName", form.optString("userFieldName", ""))
                                    putString("passFieldName", form.optString("passFieldName", ""))
                                    putString("formId", form.optString("formId", ""))
                                })
                            }
                            putArray("forms", forms)
                        }
                    }

                    promise.resolve(response)
                } catch (e: Exception) {
                    promise.reject("JSON_PARSE_ERROR", "Failed to parse forms result: ${e.message}")
                }
            }
        } catch (e: Exception) {
            promise.reject("DETECT_FORMS_ERROR", "Error detecting forms: ${e.message}")
        }
    }

    /**
     * Clears injected content (optional for cleanup)
     */
    @ReactMethod
    fun clearInjectedContent(promise: Promise) {
        try {
            val clearScript = """
                (function() {
                    try {
                        const passFields = document.querySelectorAll('input[type="password"]');
                        const userFields = document.querySelectorAll('input[type="text"], input[type="email"]');
                        
                        passFields.forEach(f => f.value = '');
                        
                        return JSON.stringify({ success: true });
                    } catch(e) {
                        return JSON.stringify({ success: false, error: e.message });
                    }
                })();
            """

            val currentActivity = currentActivity ?: run {
                promise.reject("ACTIVITY_NOT_FOUND", "Current activity is null")
                return
            }

            executeJavaScript(currentActivity, clearScript) { result ->
                promise.resolve(WritableNativeMap().apply {
                    putBoolean("success", true)
                })
            }
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", "Error clearing content: ${e.message}")
        }
    }

    /**
     * Executes JavaScript in the current WebView
     */
    private fun executeJavaScript(
        activity: Activity,
        script: String,
        callback: (String) -> Unit
    ) {
        Handler(Looper.getMainLooper()).post {
            try {
                val webView = findWebView(activity.window.decorView)
                if (webView != null) {
                    webView.evaluateJavascript(script) { result ->
                        callback.invoke(result ?: "")
                    }
                } else {
                    Log.w(TAG, "WebView not found in current activity")
                    callback.invoke("""{"success": false, "error": "WebView not found"}""")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error executing JavaScript", e)
                callback.invoke("""{"success": false, "error": "${e.message}"}""")
            }
        }
    }

    /**
     * Finds WebView in the view hierarchy
     */
    private fun findWebView(view: android.view.View): WebView? {
        if (view is WebView) {
            return view
        }

        if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                val webView = findWebView(child)
                if (webView != null) {
                    return webView
                }
            }
        }

        return null
    }

    /**
     * Checks if current page is HTTPS
     */
    private fun isHttpsPage(activity: Activity): Boolean {
        return try {
            val webView = findWebView(activity.window.decorView)
            val url = webView?.url ?: ""
            url.startsWith("https://")
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Escapes JavaScript special characters to prevent XSS
     */
    private fun escapeJavaScript(input: String): String {
        return input
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    /**
     * Converts JSONObject to Map for ReadableMap conversion
     */
    private fun JSONObjectToMap(json: org.json.JSONObject): Map<String, Any> {
        val map = mutableMapOf<String, Any>()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = json.opt(key)
            when (value) {
                is org.json.JSONObject -> map[key] = JSONObjectToMap(value)
                is org.json.JSONArray -> map[key] = JSONArrayToList(value)
                else -> map[key] = value ?: JSONObject.NULL
            }
        }
        return map
    }

    /**
     * Converts JSONArray to List for ReadableArray conversion
     */
    private fun JSONArrayToList(json: org.json.JSONArray): List<Any> {
        val list = mutableListOf<Any>()
        for (i in 0 until json.length()) {
            val value = json.opt(i)
            when (value) {
                is org.json.JSONObject -> list.add(JSONObjectToMap(value))
                is org.json.JSONArray -> list.add(JSONArrayToList(value))
                else -> list.add(value ?: JSONObject.NULL)
            }
        }
        return list
    }

    /**
     * Sends event to React Native
     */
    private fun sendEvent(eventName: String, data: Map<String, Any>) {
        try {
            val params = WritableNativeMap()
            data.forEach { (key, value) ->
                when (value) {
                    is String -> params.putString(key, value)
                    is Int -> params.putInt(key, value)
                    is Long -> params.putDouble(key, value.toDouble())
                    is Double -> params.putDouble(key, value)
                    is Boolean -> params.putBoolean(key, value)
                    else -> params.putString(key, value.toString())
                }
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event: $eventName", e)
        }
    }
}