package com.passwordepic.mobile.autofill

import android.util.Log
import java.util.concurrent.atomic.AtomicInteger

object AutofillLogger {
    private const val TAG = "PasswordEpicAutofill"
    private val stepCounter = AtomicInteger(1)

    fun logStep(message: String) {
        val step = stepCounter.getAndIncrement()
        Log.d(TAG, "📥 ═══ STEP $step: $message ═══")
    }

    fun reset() {
        stepCounter.set(1)
    }
}
