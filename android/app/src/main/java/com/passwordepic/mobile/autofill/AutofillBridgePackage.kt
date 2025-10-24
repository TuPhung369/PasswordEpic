package com.passwordepic.mobile.autofill

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * AutofillBridge Package
 *
 * React Native package for registering the AutofillBridge native module.
 *
 * @author PasswordEpic Team
 * @since Week 9 - Phase 4
 */
class AutofillBridgePackage : ReactPackage {
    
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            AutofillBridge(reactContext),
            ChromeInjectBridge(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}