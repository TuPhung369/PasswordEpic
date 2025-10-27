package com.passwordepic.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class FilePickerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    private var pickFilePromise: Promise? = null
    private var isPickerActive = false
    private val PICK_FILE_REQUEST = 1001
    private val TAG = "FilePickerModule"
    private var cancelTimeoutRunnable: Runnable? = null

    override fun getName(): String {
        return "FilePicker"
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        Log.d(TAG, "onActivityResult called: requestCode=$requestCode, resultCode=$resultCode, isPickerActive=$isPickerActive")
        
        if (requestCode == PICK_FILE_REQUEST && isPickerActive) {
            // Cancel the timeout runnable if it exists
            cancelTimeoutRunnable?.let { runnable: Runnable ->
                Handler(Looper.getMainLooper()).removeCallbacks(runnable)
            }
            isPickerActive = false
            
            if (resultCode == Activity.RESULT_OK && data != null) {
                val uri: Uri? = data.data
                if (uri != null) {
                    try {
                        Log.d(TAG, "File selected: $uri")
                        // Get the file path or copy to cache
                        val filePath = getFilePathFromUri(uri)
                        Log.d(TAG, "File path: $filePath")
                        pickFilePromise?.resolve(filePath)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to get file: ${e.message}", e)
                        pickFilePromise?.reject("FILE_PICKER_ERROR", "Failed to get file: ${e.message}")
                    }
                } else {
                    Log.w(TAG, "File URI is null despite RESULT_OK")
                    pickFilePromise?.resolve("")
                }
            } else {
                // User cancelled or activity closed - resolve with empty string
                Log.d(TAG, "User cancelled file picker")
                pickFilePromise?.resolve("")
            }
            pickFilePromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {
        Log.d(TAG, "onNewIntent called")
        // Not used
    }

    @ReactMethod
    fun pickFile(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        
        if (activity == null) {
            Log.e(TAG, "Activity is null")
            promise.reject("ACTIVITY_NOT_FOUND", "Activity not found")
            return
        }

        // Prevent multiple simultaneous file picker instances
        if (isPickerActive && pickFilePromise != null) {
            Log.w(TAG, "File picker already active, ignoring new request")
            promise.reject("FILE_PICKER_ACTIVE", "File picker is already active")
            return
        }

        pickFilePromise = promise
        isPickerActive = true
        Log.d(TAG, "pickFile called, opening file picker")

        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/json"
                // Allow user to select from all storage locations
                putExtra(Intent.EXTRA_LOCAL_ONLY, false)
            }
            
            // Set a timeout to auto-cancel if activity result never fires
            // This handles edge cases where onActivityResult might not be called
            cancelTimeoutRunnable = Runnable {
                if (isPickerActive && pickFilePromise != null) {
                    Log.w(TAG, "File picker timeout - auto-resolving with empty string")
                    isPickerActive = false
                    pickFilePromise?.resolve("")
                    pickFilePromise = null
                }
            }
            Handler(Looper.getMainLooper()).postDelayed(cancelTimeoutRunnable!!, 30000) // 30 second timeout
            
            activity.startActivityForResult(intent, PICK_FILE_REQUEST)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open file picker: ${e.message}", e)
            isPickerActive = false
            cancelTimeoutRunnable?.let { runnable: Runnable ->
                Handler(Looper.getMainLooper()).removeCallbacks(runnable)
            }
            pickFilePromise?.reject("FILE_PICKER_ERROR", "Failed to open file picker: ${e.message}")
            pickFilePromise = null
        }
    }

    private fun getFilePathFromUri(uri: Uri): String {
        val contentResolver = reactApplicationContext.contentResolver
        
        // Create a temporary file in cache directory
        val cacheDir = reactApplicationContext.cacheDir
        val tempFile = File(cacheDir, "temp_import_${System.currentTimeMillis()}.json")
        
        contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(tempFile).use { output ->
                input.copyTo(output)
            }
        }
        
        return tempFile.absolutePath
    }
}
