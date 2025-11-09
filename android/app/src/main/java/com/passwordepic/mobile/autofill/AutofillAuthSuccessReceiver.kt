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
    }
}