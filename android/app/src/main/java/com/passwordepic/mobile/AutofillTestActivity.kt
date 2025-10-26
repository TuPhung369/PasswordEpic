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

/**
 * Simple test activity to verify autofill service works with native EditText fields
 */
class AutofillTestActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "AutofillTestActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "🚀 AutofillTestActivity created - testing autofill")
        
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

        // Login button to show entered values
        loginButton.setOnClickListener {
            val email = emailField.text.toString()
            val password = passwordField.text.toString()
            resultText.text = "Email: $email\nPassword: $password"
            Log.d(TAG, "✅ Login button clicked - Email: $email")
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