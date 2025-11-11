package com.passwordepic.mobile

import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.view.WindowManager
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.passwordepic.mobile.autofill.AutofillDecryptionReceiver
import android.util.Log

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
  }

  private val decryptionReceiver = AutofillDecryptionReceiver()

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "PasswordEpic"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // Register broadcast receiver for autofill decryption requests
    Log.d(TAG, "📡 Registering AutofillDecryptionReceiver")
    val intentFilter = IntentFilter("com.passwordepic.mobile.DECRYPT_FOR_AUTOFILL")
    LocalBroadcastManager.getInstance(this).registerReceiver(
      decryptionReceiver,
      intentFilter
    )
    Log.d(TAG, "✅ AutofillDecryptionReceiver registered")
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
  }

  override fun onDestroy() {
    super.onDestroy()
    // Unregister broadcast receiver
    Log.d(TAG, "🛑 Unregistering AutofillDecryptionReceiver")
    LocalBroadcastManager.getInstance(this).unregisterReceiver(decryptionReceiver)
  }
}