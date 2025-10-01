/**
 * Screen Protection Service
 *
 * Provides screen security features:
 * - Screenshot prevention
 * - Screen recording detection
 * - Screen capture blocking
 * - Secure view protection
 */

import { Platform, NativeModules } from 'react-native';

export interface ScreenProtectionStatus {
  isProtected: boolean;
  screenshotBlocked: boolean;
  screenRecordingBlocked: boolean;
  platform: string;
}

class ScreenProtectionService {
  private static instance: ScreenProtectionService;
  private isProtectionEnabled: boolean = false;

  private constructor() {}

  public static getInstance(): ScreenProtectionService {
    if (!ScreenProtectionService.instance) {
      ScreenProtectionService.instance = new ScreenProtectionService();
    }
    return ScreenProtectionService.instance;
  }

  /**
   * Enable screen protection
   */
  public async enableProtection(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        return await this.enableAndroidProtection();
      } else if (Platform.OS === 'ios') {
        return await this.enableIOSProtection();
      }
      return false;
    } catch (error) {
      console.error('Failed to enable screen protection:', error);
      return false;
    }
  }

  /**
   * Disable screen protection
   */
  public async disableProtection(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        return await this.disableAndroidProtection();
      } else if (Platform.OS === 'ios') {
        return await this.disableIOSProtection();
      }
      return false;
    } catch (error) {
      console.error('Failed to disable screen protection:', error);
      return false;
    }
  }

  /**
   * Enable Android screen protection
   */
  private async enableAndroidProtection(): Promise<boolean> {
    try {
      // For Android, we need to add FLAG_SECURE to the window
      // This requires native module implementation

      // Check if native module is available
      const { ScreenProtectionModule } = NativeModules;

      console.log('🔍 ScreenProtectionModule check:', {
        exists: !!ScreenProtectionModule,
        hasEnableMethod: !!ScreenProtectionModule?.enableProtection,
        allMethods: ScreenProtectionModule
          ? Object.keys(ScreenProtectionModule)
          : [],
      });

      if (ScreenProtectionModule && ScreenProtectionModule.enableProtection) {
        console.log('✅ Calling native enableProtection...');
        await ScreenProtectionModule.enableProtection();
        this.isProtectionEnabled = true;
        console.log('Android screen protection enabled');
        console.log(
          '⚠️ NOTE: FLAG_SECURE does NOT work on emulators! Test on a real device.',
        );
        return true;
      } else {
        console.warn(
          '❌ ScreenProtectionModule not available - native implementation required',
        );
        // Fallback: Log warning but don't fail
        this.isProtectionEnabled = false;
        return false;
      }
    } catch (error) {
      console.error('Android screen protection error:', error);
      return false;
    }
  }

  /**
   * Disable Android screen protection
   */
  private async disableAndroidProtection(): Promise<boolean> {
    try {
      const { ScreenProtectionModule } = NativeModules;

      if (ScreenProtectionModule && ScreenProtectionModule.disableProtection) {
        await ScreenProtectionModule.disableProtection();
        this.isProtectionEnabled = false;
        console.log('Android screen protection disabled');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Android screen protection disable error:', error);
      return false;
    }
  }

  /**
   * Enable iOS screen protection
   */
  private async enableIOSProtection(): Promise<boolean> {
    try {
      // For iOS, we need to use native module to add blur view when app is backgrounded
      // and prevent screen recording detection

      const { ScreenProtectionModule } = NativeModules;

      if (ScreenProtectionModule && ScreenProtectionModule.enableProtection) {
        await ScreenProtectionModule.enableProtection();
        this.isProtectionEnabled = true;
        console.log('iOS screen protection enabled');
        return true;
      } else {
        console.warn(
          'ScreenProtectionModule not available - native implementation required',
        );
        this.isProtectionEnabled = false;
        return false;
      }
    } catch (error) {
      console.error('iOS screen protection error:', error);
      return false;
    }
  }

  /**
   * Disable iOS screen protection
   */
  private async disableIOSProtection(): Promise<boolean> {
    try {
      const { ScreenProtectionModule } = NativeModules;

      if (ScreenProtectionModule && ScreenProtectionModule.disableProtection) {
        await ScreenProtectionModule.disableProtection();
        this.isProtectionEnabled = false;
        console.log('iOS screen protection disabled');
        return true;
      }
      return false;
    } catch (error) {
      console.error('iOS screen protection disable error:', error);
      return false;
    }
  }

  /**
   * Check if screen recording is active (iOS only)
   */
  public async isScreenRecording(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      const { ScreenProtectionModule } = NativeModules;

      if (ScreenProtectionModule && ScreenProtectionModule.isScreenRecording) {
        return await ScreenProtectionModule.isScreenRecording();
      }
      return false;
    } catch (error) {
      console.error('Screen recording check error:', error);
      return false;
    }
  }

  /**
   * Get current protection status
   */
  public async getProtectionStatus(): Promise<ScreenProtectionStatus> {
    const isRecording = await this.isScreenRecording();

    return {
      isProtected: this.isProtectionEnabled,
      screenshotBlocked: this.isProtectionEnabled && Platform.OS === 'android',
      screenRecordingBlocked: this.isProtectionEnabled && Platform.OS === 'ios',
      platform: Platform.OS,
    };
  }

  /**
   * Check if protection is enabled
   */
  public isEnabled(): boolean {
    return this.isProtectionEnabled;
  }

  /**
   * Verify if FLAG_SECURE is actually set (Android only)
   * This is useful for debugging - note that FLAG_SECURE doesn't work on emulators
   */
  public async verifyProtectionStatus(): Promise<{
    isSet: boolean;
    platform: string;
    note: string;
  }> {
    try {
      if (Platform.OS === 'android') {
        const { ScreenProtectionModule } = NativeModules;

        if (
          ScreenProtectionModule &&
          ScreenProtectionModule.isProtectionEnabled
        ) {
          const isSet = await ScreenProtectionModule.isProtectionEnabled();
          return {
            isSet,
            platform: 'android',
            note: isSet
              ? '⚠️ FLAG_SECURE is set, but it does NOT work on emulators. Test on a real device!'
              : 'FLAG_SECURE is not set',
          };
        }
      }

      return {
        isSet: false,
        platform: Platform.OS,
        note: 'Verification not available for this platform',
      };
    } catch (error) {
      console.error('Failed to verify protection status:', error);
      return {
        isSet: false,
        platform: Platform.OS,
        note: `Error: ${error}`,
      };
    }
  }

  /**
   * Setup screen recording detection (iOS)
   */
  public setupScreenRecordingDetection(
    onRecordingStart: () => void,
    onRecordingStop: () => void,
  ): () => void {
    if (Platform.OS !== 'ios') {
      return () => {}; // No-op for Android
    }

    // Poll for screen recording status
    const interval = setInterval(async () => {
      const isRecording = await this.isScreenRecording();

      if (isRecording) {
        onRecordingStart();
      } else {
        onRecordingStop();
      }
    }, 1000); // Check every second

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }

  /**
   * Create a secure view wrapper (for sensitive content)
   */
  public createSecureView(): SecureViewConfig {
    return {
      pointerEvents: 'none',
      accessible: false,
      importantForAccessibility: 'no-hide-descendants',
      accessibilityElementsHidden: true,
    };
  }
}

export interface SecureViewConfig {
  pointerEvents: 'none';
  accessible: boolean;
  importantForAccessibility: string;
  accessibilityElementsHidden: boolean;
}

/**
 * Native Module Implementation Guide
 *
 * To fully implement screen protection, you need to create native modules:
 *
 * ANDROID (Java/Kotlin):
 *
 * 1. Create ScreenProtectionModule.java:
 *
 * ```java
 * package com.passwordepic;
 *
 * import android.view.WindowManager;
 * import com.facebook.react.bridge.ReactApplicationContext;
 * import com.facebook.react.bridge.ReactContextBaseJavaModule;
 * import com.facebook.react.bridge.ReactMethod;
 * import com.facebook.react.bridge.Promise;
 *
 * public class ScreenProtectionModule extends ReactContextBaseJavaModule {
 *     private final ReactApplicationContext reactContext;
 *
 *     public ScreenProtectionModule(ReactApplicationContext reactContext) {
 *         super(reactContext);
 *         this.reactContext = reactContext;
 *     }
 *
 *     @Override
 *     public String getName() {
 *         return "ScreenProtectionModule";
 *     }
 *
 *     @ReactMethod
 *     public void enableProtection(Promise promise) {
 *         try {
 *             getCurrentActivity().runOnUiThread(() -> {
 *                 getCurrentActivity().getWindow().setFlags(
 *                     WindowManager.LayoutParams.FLAG_SECURE,
 *                     WindowManager.LayoutParams.FLAG_SECURE
 *                 );
 *             });
 *             promise.resolve(true);
 *         } catch (Exception e) {
 *             promise.reject("ERROR", e.getMessage());
 *         }
 *     }
 *
 *     @ReactMethod
 *     public void disableProtection(Promise promise) {
 *         try {
 *             getCurrentActivity().runOnUiThread(() -> {
 *                 getCurrentActivity().getWindow().clearFlags(
 *                     WindowManager.LayoutParams.FLAG_SECURE
 *                 );
 *             });
 *             promise.resolve(true);
 *         } catch (Exception e) {
 *             promise.reject("ERROR", e.getMessage());
 *         }
 *     }
 * }
 * ```
 *
 * 2. Register module in MainApplication.java
 *
 * IOS (Objective-C/Swift):
 *
 * 1. Create ScreenProtectionModule.m:
 *
 * ```objc
 * #import <React/RCTBridgeModule.h>
 * #import <React/RCTEventEmitter.h>
 *
 * @interface RCT_EXTERN_MODULE(ScreenProtectionModule, NSObject)
 *
 * RCT_EXTERN_METHOD(enableProtection:(RCTPromiseResolveBlock)resolve
 *                   rejecter:(RCTPromiseRejectBlock)reject)
 *
 * RCT_EXTERN_METHOD(disableProtection:(RCTPromiseResolveBlock)resolve
 *                   rejecter:(RCTPromiseRejectBlock)reject)
 *
 * RCT_EXTERN_METHOD(isScreenRecording:(RCTPromiseResolveBlock)resolve
 *                   rejecter:(RCTPromiseRejectBlock)reject)
 *
 * @end
 * ```
 *
 * 2. Create ScreenProtectionModule.swift:
 *
 * ```swift
 * import UIKit
 *
 * @objc(ScreenProtectionModule)
 * class ScreenProtectionModule: NSObject {
 *     private var blurView: UIVisualEffectView?
 *
 *     @objc
 *     func enableProtection(_ resolve: @escaping RCTPromiseResolveBlock,
 *                          rejecter reject: @escaping RCTPromiseRejectBlock) {
 *         DispatchQueue.main.async {
 *             // Add blur view when app goes to background
 *             NotificationCenter.default.addObserver(
 *                 self,
 *                 selector: #selector(self.addBlurView),
 *                 name: UIApplication.willResignActiveNotification,
 *                 object: nil
 *             )
 *             resolve(true)
 *         }
 *     }
 *
 *     @objc
 *     func isScreenRecording(_ resolve: @escaping RCTPromiseResolveBlock,
 *                           rejecter reject: @escaping RCTPromiseRejectBlock) {
 *         let isRecording = UIScreen.main.isCaptured
 *         resolve(isRecording)
 *     }
 *
 *     @objc
 *     private func addBlurView() {
 *         guard let window = UIApplication.shared.windows.first else { return }
 *         let blurEffect = UIBlurEffect(style: .light)
 *         blurView = UIVisualEffectView(effect: blurEffect)
 *         blurView?.frame = window.bounds
 *         window.addSubview(blurView!)
 *     }
 * }
 * ```
 */

export default ScreenProtectionService.getInstance();
