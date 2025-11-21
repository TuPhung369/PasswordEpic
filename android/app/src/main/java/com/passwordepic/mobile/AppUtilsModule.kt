package com.passwordepic.mobile

import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.content.Intent
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

    private fun isLaunchable(pm: PackageManager, packageName: String): Boolean {
        return try {
            // First try LAUNCHER category (most common)
            val launcherIntent = Intent(Intent.ACTION_MAIN)
            launcherIntent.setPackage(packageName)
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER)
            if (pm.resolveActivity(launcherIntent, PackageManager.MATCH_ALL) != null) {
                return true
            }
            
            // Fallback: Check if app has any main activity (for apps without launcher category)
            val mainIntent = Intent(Intent.ACTION_MAIN)
            mainIntent.setPackage(packageName)
            pm.resolveActivity(mainIntent, PackageManager.MATCH_ALL) != null
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Get list of installed apps with their names and package names
     * Returns all installed apps regardless of system/user status
     */
    @ReactMethod
    fun getInstalledApps(includeSystemApps: Boolean = false, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val packages = pm.getInstalledPackages(PackageManager.GET_META_DATA)

            val appsList = WritableNativeArray()
            val launcherPackageName = reactApplicationContext.packageName

            for (packageInfo in packages) {
                val packageName = packageInfo.packageName
                
                // Skip launcher app
                if (packageName == launcherPackageName) {
                    continue
                }

                try {
                    // Only show launchable apps
                    if (!isLaunchable(pm, packageName)) {
                        if (packageName == "fi.hsl.app") {
                            Log.d(TAG, "DEBUG: fi.hsl.app is NOT launchable")
                        }
                        continue
                    }

                    val appInfo = pm.getApplicationInfo(packageName, 0)
                    val appName = pm.getApplicationLabel(appInfo).toString()
                    
                    if (packageName == "fi.hsl.app") {
                        Log.d(TAG, "DEBUG: Added fi.hsl.app with name: $appName")
                    }

                    val appMap = WritableNativeMap()
                    appMap.putString("name", appName)
                    appMap.putString("packageName", packageName)

                    appsList.pushMap(appMap)
                } catch (e: Exception) {
                    Log.w(TAG, "Error processing app: $packageName", e)
                    if (packageName == "fi.hsl.app") {
                        Log.d(TAG, "DEBUG: Exception processing fi.hsl.app: ${e.message}")
                    }
                }
            }

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
            val packages = pm.getInstalledPackages(PackageManager.GET_META_DATA)

            val appsList = WritableNativeArray()
            val lowerQuery = query.trim().lowercase()
            val launcherPackageName = reactApplicationContext.packageName

            for (packageInfo in packages) {
                val packageName = packageInfo.packageName
                
                // Skip launcher app
                if (packageName == launcherPackageName) {
                    continue
                }

                try {
                    // Only show launchable apps (user-installed or launchable system apps)
                    if (!isLaunchable(pm, packageName)) {
                        if (packageName == "fi.hsl.app") {
                            Log.d(TAG, "DEBUG searchApps: fi.hsl.app is NOT launchable")
                        }
                        continue
                    }

                    val appInfo = pm.getApplicationInfo(packageName, 0)
                    val appName = pm.getApplicationLabel(appInfo).toString()

                    if (packageName == "fi.hsl.app") {
                        Log.d(TAG, "DEBUG searchApps: fi.hsl.app found, name=$appName, query=$lowerQuery")
                        Log.d(TAG, "DEBUG searchApps: nameMatch=${appName.lowercase().contains(lowerQuery)}, pkgMatch=${packageName.lowercase().contains(lowerQuery)}")
                    }

                    // Match against both name and package name
                    if (appName.lowercase().contains(lowerQuery) ||
                        packageName.lowercase().contains(lowerQuery)
                    ) {
                        val appMap = WritableNativeMap()
                        appMap.putString("name", appName)
                        appMap.putString("packageName", packageName)
                        appsList.pushMap(appMap)
                        if (packageName == "fi.hsl.app") {
                            Log.d(TAG, "DEBUG searchApps: fi.hsl.app MATCHED and added to results")
                        }
                    } else if (packageName == "fi.hsl.app") {
                        Log.d(TAG, "DEBUG searchApps: fi.hsl.app did NOT match the query")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Error processing app: $packageName", e)
                    if (packageName == "fi.hsl.app") {
                        Log.d(TAG, "DEBUG searchApps: Exception processing fi.hsl.app: ${e.message}")
                    }
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