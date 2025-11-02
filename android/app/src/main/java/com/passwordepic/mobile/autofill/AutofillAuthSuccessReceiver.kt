package com.passwordepic.mobile.autofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives broadcast when autofill authentication succeeds.
 * Triggers refill of credentials into the form fields.
 */
class AutofillAuthSuccessReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "AutofillAuthSuccessReceiver"
        const val ACTION_AUTH_SUCCEED = "com.passwordepic.mobile.AUTOFILL_AUTH_SUCCEED"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        Log.d(TAG, "┌──────────────────────────────────────────────────────────────")
        Log.d(TAG, "📡 BroadcastReceiver.onReceive() called!")
        Log.d(TAG, "📡 Received broadcast action: ${intent?.action}")
        Log.d(TAG, "📡 Expected action: $ACTION_AUTH_SUCCEED")
        
        if (intent?.action == ACTION_AUTH_SUCCEED) {
            Log.d(TAG, "✅ Action matches! This is our auth success broadcast")
            Log.d(TAG, "🔐 Auth succeeded! Triggering refill...")
            
            try {
                // Trigger refill using cached callback
                Log.d(TAG, "📞 Calling PasswordEpicAutofillService.triggerRefillAfterAuth()")
                PasswordEpicAutofillService.triggerRefillAfterAuth()
                Log.d(TAG, "✅ Refill triggered successfully")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error triggering refill: ${e.message}", e)
            }
        } else {
            Log.w(TAG, "⚠️ Action does NOT match - ignoring this broadcast")
        }
        Log.d(TAG, "└──────────────────────────────────────────────────────────────")
    }
}