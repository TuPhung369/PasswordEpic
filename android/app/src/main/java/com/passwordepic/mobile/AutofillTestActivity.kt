package com.passwordepic.mobile

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import android.widget.EditText
import android.widget.Button
import android.widget.TextView

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

        // Create simple layout programmatically
        setContentView(R.layout.activity_autofill_test)

        val emailField = findViewById<EditText>(R.id.emailField)
        val passwordField = findViewById<EditText>(R.id.passwordField)
        val loginButton = findViewById<Button>(R.id.loginButton)
        val resultText = findViewById<TextView>(R.id.resultText)

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
}