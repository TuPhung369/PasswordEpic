package com.passwordepic.mobile

import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.graphics.drawable.Drawable
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import android.util.Log

class AppUtilsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AppUtils"
    }

    override fun getName(): String = "AppUtils"

    /**
     * Get list of installed apps with their names and package names
     * Filters out system apps by default
     */
    @ReactMethod
    fun getInstalledApps(includeSystemApps: Boolean = false, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)

            val appsList = WritableNativeArray()

            for (appInfo in packages) {
                // Skip system apps if not requested
                if (!includeSystemApps && (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0) {
                    continue
                }

                // Skip launcher app
                if (appInfo.packageName == reactApplicationContext.packageName) {
                    continue
                }

                try {
                    val appName = pm.getApplicationLabel(appInfo).toString()
                    val packageName = appInfo.packageName

                    val appMap = WritableNativeMap()
                    appMap.putString("name", appName)
                    appMap.putString("packageName", packageName)

                    appsList.pushMap(appMap)
                } catch (e: Exception) {
                    Log.w(TAG, "Error processing app: ${appInfo.packageName}", e)
                }
            }

            // Return unsorted list - let JS handle sorting for better compatibility
            Log.d(TAG, "Found ${appsList.size()} apps")
            promise.resolve(appsList)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting installed apps", e)
            promise.reject("ERROR_GET_APPS", e.message, e)
        }
    }

    /**
     * Search for apps matching a query string
     */
    @ReactMethod
    fun searchApps(query: String, includeSystemApps: Boolean = false, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)

            val appsList = WritableNativeArray()
            val lowerQuery = query.lowercase()

            for (appInfo in packages) {
                // Skip system apps if not requested
                if (!includeSystemApps && (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0) {
                    continue
                }

                // Skip launcher app
                if (appInfo.packageName == reactApplicationContext.packageName) {
                    continue
                }

                try {
                    val appName = pm.getApplicationLabel(appInfo).toString()
                    val packageName = appInfo.packageName

                    // Match against both name and package name
                    if (appName.lowercase().contains(lowerQuery) ||
                        packageName.lowercase().contains(lowerQuery)
                    ) {
                        val appMap = WritableNativeMap()
                        appMap.putString("name", appName)
                        appMap.putString("packageName", packageName)
                        appsList.pushMap(appMap)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Error processing app: ${appInfo.packageName}", e)
                }
            }

            Log.d(TAG, "Found ${appsList.size()} apps matching '$query'")
            promise.resolve(appsList)
        } catch (e: Exception) {
            Log.e(TAG, "Error searching apps", e)
            promise.reject("ERROR_SEARCH_APPS", e.message, e)
        }
    }

    /**
     * Get app info for a specific package name
     */
    @ReactMethod
    fun getAppInfo(packageName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val appName = pm.getApplicationLabel(appInfo).toString()

            val result = WritableNativeMap()
            result.putString("name", appName)
            result.putString("packageName", packageName)

            Log.d(TAG, "Got info for app: $packageName")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting app info for $packageName", e)
            promise.reject("ERROR_GET_APP_INFO", e.message, e)
        }
    }
}