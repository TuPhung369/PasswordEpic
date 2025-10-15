package com.passwordepic.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class FilePickerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    private var pickFilePromise: Promise? = null
    private val PICK_FILE_REQUEST = 1001

    override fun getName(): String {
        return "FilePicker"
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == PICK_FILE_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val uri: Uri? = data.data
                if (uri != null) {
                    try {
                        // Get the file path or copy to cache
                        val filePath = getFilePathFromUri(uri)
                        pickFilePromise?.resolve(filePath)
                    } catch (e: Exception) {
                        pickFilePromise?.reject("FILE_PICKER_ERROR", "Failed to get file: ${e.message}")
                    }
                } else {
                    pickFilePromise?.reject("FILE_PICKER_ERROR", "No file selected")
                }
            } else {
                pickFilePromise?.reject("FILE_PICKER_CANCELLED", "User cancelled file picker")
            }
            pickFilePromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {
        // Not used
    }

    @ReactMethod
    fun pickFile(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        
        if (activity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Activity not found")
            return
        }

        pickFilePromise = promise

        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/json"
                // Allow user to select from all storage locations
                putExtra(Intent.EXTRA_LOCAL_ONLY, false)
            }
            
            activity.startActivityForResult(intent, PICK_FILE_REQUEST)
        } catch (e: Exception) {
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
