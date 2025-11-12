package com.passwordepic.mobile

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.passwordepic.mobile.BuildConfig
import com.passwordepic.mobile.autofill.AutofillBridgePackage

class MainApplication : Application(), ReactApplication {

  companion object {
    private const val TAG = "MainApplication"
    
    /**
     * Static reference to React context for autofill activities
     * Since AutofillTestActivity runs as a separate activity outside the main RN stack,
     * we need a static reference to communicate back to React Native
     */
    @Volatile
    private var reactContext: ReactContext? = null
    
    fun getReactContext(): ReactContext? = reactContext
    
    fun setReactContext(context: ReactContext?) {
      Log.d(TAG, "Setting React context: ${if (context != null) "Available" else "Null"}")
      reactContext = context
    }
  }

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              
              // Add Screen Protection Module
              add(ScreenProtectionPackage())
              
              // Add File Picker Module
              add(FilePickerPackage())
              
              // Add Autofill Bridge Module
              add(AutofillBridgePackage())
              
              // Add Launch Test Activity Module
              add(LaunchTestActivityPackage())
              
              // Add App Utils Module (for getting installed apps)
              add(AppUtilsPackage())
              
              // Add Biometric Module
              add(BiometricPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}