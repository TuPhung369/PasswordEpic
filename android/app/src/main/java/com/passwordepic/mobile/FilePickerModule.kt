package com.passwordepic.mobile

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class FilePickerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    private var pickFilePromise: Promise? = null
    private var pickFolderPromise: Promise? = null
    private var isPickerActive = false
    private val PICK_FILE_REQUEST = 1001
    private val PICK_FOLDER_REQUEST = 1002
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
        } else if (requestCode == PICK_FOLDER_REQUEST && isPickerActive) {
            // Cancel the timeout runnable if it exists
            cancelTimeoutRunnable?.let { runnable: Runnable ->
                Handler(Looper.getMainLooper()).removeCallbacks(runnable)
            }
            isPickerActive = false
            
            if (resultCode == Activity.RESULT_OK && data != null) {
                val uri: Uri? = data.data
                if (uri != null) {
                    try {
                        Log.d(TAG, "Folder selected: $uri")
                        
                        val contentResolver = reactApplicationContext.contentResolver
                        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        contentResolver.takePersistableUriPermission(uri, flags)
                        
                        Log.d(TAG, "Persisted URI permissions for: $uri")
                        pickFolderPromise?.resolve(uri.toString())
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to get folder: ${e.message}", e)
                        pickFolderPromise?.reject("FOLDER_PICKER_ERROR", "Failed to get folder: ${e.message}")
                    }
                } else {
                    Log.w(TAG, "Folder URI is null despite RESULT_OK")
                    pickFolderPromise?.resolve("")
                }
            } else {
                Log.d(TAG, "User cancelled folder picker")
                pickFolderPromise?.resolve("")
            }
            pickFolderPromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {
        Log.d(TAG, "onNewIntent called")
        // Not used
    }

    @ReactMethod
    fun writeToFolder(folderUriString: String, fileName: String, content: String, promise: Promise) {
        try {
            Log.d(TAG, "writeToFolder - URI: $folderUriString, fileName: $fileName")
            
            if (folderUriString.isEmpty()) {
                promise.reject("WRITE_ERROR", "Folder URI is empty")
                return
            }
            
            val folderUri = Uri.parse(folderUriString)
            val contentResolver = reactApplicationContext.contentResolver
            
            if (folderUri.scheme == "content") {
                Log.d(TAG, "Using DocumentsContract to write file for content:// URI")
                writeToContentUri(folderUri, fileName, content, promise)
            } else {
                Log.d(TAG, "Using direct file write for file:// URI")
                writeToFilePath(folderUriString, fileName, content, promise)
            }
            
        } catch (e: Throwable) {
            val errorMsg = e.message ?: "Unknown error during write"
            Log.e(TAG, "Failed to write file: $errorMsg", e)
            promise.reject("WRITE_ERROR", errorMsg)
        }
    }

    private fun writeToContentUri(folderUri: Uri, fileName: String, content: String, promise: Promise) {
        try {
            val contentResolver = reactApplicationContext.contentResolver
            val mimeType = "application/json"
            
            Log.d(TAG, "========== writeToContentUri Debug Info ==========")
            Log.d(TAG, "Folder URI (string): $folderUri")
            Log.d(TAG, "URI scheme: ${folderUri.scheme}")
            Log.d(TAG, "URI authority: ${folderUri.authority}")
            Log.d(TAG, "URI path: ${folderUri.path}")
            Log.d(TAG, "URI lastPathSegment: ${folderUri.lastPathSegment}")
            Log.d(TAG, "URI pathSegments: ${folderUri.pathSegments}")
            Log.d(TAG, "Android API Level: ${Build.VERSION.SDK_INT}")
            Log.d(TAG, "Device manufacturer: ${Build.MANUFACTURER}")
            Log.d(TAG, "Device model: ${Build.MODEL}")
            Log.d(TAG, "========== End Debug Info ==========")
            
            // Validate tree URI format
            if (folderUri.scheme != "content") {
                Log.e(TAG, "Invalid URI scheme: ${folderUri.scheme}, expected 'content'")
                promise.reject("WRITE_ERROR", "Invalid URI scheme: ${folderUri.scheme}")
                return
            }
            
            // Verify URI is a tree URI (folder)
            if (folderUri.path?.contains("/tree/") != true) {
                Log.e(TAG, "URI is not a tree URI (folder), path: ${folderUri.path}")
                promise.reject("WRITE_ERROR", "Invalid folder URI format")
                return
            }
            
            try {
                // Check if this is a Download folder - use MediaStore instead of DocumentsContract
                val documentId = android.provider.DocumentsContract.getDocumentId(folderUri)
                Log.d(TAG, "Document ID: $documentId")
                
                // Detect Download folder by checking if it contains "Download" in the path or document ID
                val isDownloadFolder = documentId.contains("Download") || folderUri.path?.contains("Download") == true
                
                if (isDownloadFolder && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Log.d(TAG, "Detected Download folder. Using MediaStore API instead of DocumentsContract.")
                    writeToDownloadViaMediaStore(fileName, content, promise)
                    return
                }
                
                // Check if URI has write capabilities by checking the document flags
                val cursor = contentResolver.query(folderUri, arrayOf(
                    android.provider.DocumentsContract.Document.COLUMN_FLAGS,
                    android.provider.DocumentsContract.Document.COLUMN_MIME_TYPE,
                    android.provider.DocumentsContract.Document.COLUMN_DISPLAY_NAME
                ), null, null, null)
                
                var flags = 0
                var hasWriteCapability = false
                var mimeType = ""
                var displayName = ""
                cursor?.use {
                    if (it.moveToFirst()) {
                        flags = it.getInt(0)
                        mimeType = it.getString(1) ?: ""
                        displayName = it.getString(2) ?: ""
                        hasWriteCapability = (flags and android.provider.DocumentsContract.Document.FLAG_SUPPORTS_WRITE) != 0
                        Log.d(TAG, "Document flags: $flags")
                        Log.d(TAG, "Mime type: $mimeType")
                        Log.d(TAG, "Display name: $displayName")
                        Log.d(TAG, "Has write capability: $hasWriteCapability")
                        Log.d(TAG, "Is directory: ${(flags and android.provider.DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE) != 0}")
                    }
                }
                
                val canCreateDocuments = (flags and android.provider.DocumentsContract.Document.FLAG_DIR_SUPPORTS_CREATE) != 0
                Log.d(TAG, "Can create documents in this folder: $canCreateDocuments")
                
                if (!canCreateDocuments) {
                    Log.e(TAG, "URI does not support creating documents. This folder may be read-only or system-restricted.")
                    Log.e(TAG, "Flags: $flags, hasWriteCapability: $hasWriteCapability")
                    promise.reject("WRITE_ERROR", "The selected folder does not support creating files. Please select a different folder.")
                    return
                }
                
                // Attempt to create the document
                Log.d(TAG, "Calling DocumentsContract.createDocument with fileName: $fileName")
                val newFileUri = android.provider.DocumentsContract.createDocument(
                    contentResolver,
                    folderUri,
                    mimeType,
                    fileName
                )
                
                if (newFileUri != null) {
                    Log.d(TAG, "Document created: $newFileUri")
                    
                    contentResolver.openOutputStream(newFileUri)?.use { output ->
                        output.write(content.toByteArray(Charsets.UTF_8))
                        output.flush()
                    }
                    
                    Log.d(TAG, "Successfully wrote file to: $newFileUri")
                    promise.resolve(newFileUri.toString())
                } else {
                    Log.e(TAG, "DocumentsContract.createDocument returned null for folder URI: $folderUri")
                    Log.e(TAG, "This may indicate the folder doesn't have write permissions or doesn't support document creation")
                    promise.reject("WRITE_ERROR", "Failed to create document in the selected folder. The folder may not have write permissions.")
                }
            } catch (docError: Throwable) {
                Log.e(TAG, "Error with DocumentsContract: ${docError.message}", docError)
                Log.e(TAG, "DocumentsContract error type: ${docError.javaClass.simpleName}")
                docError.printStackTrace()
                
                // Check if this is a permission error
                val isPermissionError = docError.message?.contains("Permission denied") == true || 
                                       docError.message?.contains("EACCES") == true ||
                                       docError.message?.contains("Permission") == true
                
                if (isPermissionError) {
                    Log.w(TAG, "Permission denied when writing via DocumentsContract. This may be due to scoped storage restrictions on Android 10+.")
                    
                    // On Android 10+, direct file write to shared folders won't work
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        Log.w(TAG, "Running on Android 10+. DocumentsContract is the only valid method for shared storage.")
                        promise.reject("WRITE_ERROR", "Cannot write to the selected folder due to Android storage restrictions. Try selecting a folder you created or use internal storage.")
                    } else {
                        Log.d(TAG, "Attempting fallback direct file write on pre-Android 10...")
                        try {
                            val filePath = getFolderPathFromUri(folderUri)
                            Log.d(TAG, "Fallback file path: $filePath")
                            writeToFilePath(filePath, fileName, content, promise)
                        } catch (fallbackError: Throwable) {
                            val errorMsg = "Cannot write to the selected folder: ${docError.message}"
                            Log.e(TAG, errorMsg, fallbackError)
                            promise.reject("WRITE_ERROR", errorMsg)
                        }
                    }
                } else {
                    Log.w(TAG, "DocumentsContract.createDocument() failed (not a permission error), attempting fallback strategies...")
                    Log.w(TAG, "This may indicate the selected folder doesn't support document creation.")
                    
                    // Try MediaStore first if this looks like a system folder
                    try {
                        val docId = android.provider.DocumentsContract.getDocumentId(folderUri)
                        if ((docId.contains("Download") || folderUri.path?.contains("Download") == true) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            Log.d(TAG, "Attempting MediaStore fallback for Download folder...")
                            writeToDownloadViaMediaStore(fileName, content, promise)
                            return
                        }
                    } catch (e: Exception) {
                        Log.d(TAG, "Could not detect folder type for MediaStore fallback")
                    }
                    
                    // Try to get the folder path and write directly
                    try {
                        val filePath = getFolderPathFromUri(folderUri)
                        Log.d(TAG, "Attempting fallback write to: $filePath")
                        
                        val folder = java.io.File(filePath)
                        if (folder.exists() && folder.isDirectory && folder.canWrite()) {
                            Log.d(TAG, "Folder is writable, attempting direct file write...")
                            writeToFilePath(filePath, fileName, content, promise)
                        } else {
                            Log.e(TAG, "Folder validation failed - exists: ${folder.exists()}, isDir: ${folder.isDirectory}, canWrite: ${folder.canWrite()}")
                            val errorMsg = "DocumentsContract failed: ${docError.message}"
                            Log.e(TAG, errorMsg)
                            promise.reject("WRITE_ERROR", errorMsg)
                        }
                    } catch (fallbackError: Throwable) {
                        val errorMsg = "DocumentsContract failed: ${docError.message}"
                        Log.e(TAG, errorMsg, docError)
                        Log.e(TAG, "Fallback also failed: ${fallbackError.message}", fallbackError)
                        promise.reject("WRITE_ERROR", errorMsg)
                    }
                }
            }
        } catch (e: Throwable) {
            val errorMsg = e.message ?: "Unknown error writing to content URI"
            Log.e(TAG, "DocumentsContract write failed: $errorMsg", e)
            promise.reject("WRITE_ERROR", errorMsg)
        }
    }

    private fun writeToDownloadViaMediaStore(fileName: String, content: String, promise: Promise) {
        try {
            Log.d(TAG, "Attempting to write to Downloads using MediaStore API")
            
            val contentResolver = reactApplicationContext.contentResolver
            
            // Create ContentValues for the file
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, "application/json")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            
            // Insert into MediaStore
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            
            if (uri != null) {
                Log.d(TAG, "MediaStore URI created: $uri")
                
                try {
                    contentResolver.openOutputStream(uri)?.use { output ->
                        output.write(content.toByteArray(Charsets.UTF_8))
                        output.flush()
                    }
                    
                    // Mark file as no longer pending
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    contentResolver.update(uri, values, null, null)
                    
                    Log.d(TAG, "Successfully wrote file via MediaStore: $uri")
                    promise.resolve(uri.toString())
                } catch (writeError: Throwable) {
                    Log.e(TAG, "Failed to write via MediaStore: ${writeError.message}", writeError)
                    promise.reject("WRITE_ERROR", "Failed to write file to Downloads: ${writeError.message}")
                }
            } else {
                Log.e(TAG, "MediaStore.insert() returned null")
                promise.reject("WRITE_ERROR", "Failed to create file in Downloads folder")
            }
        } catch (e: Throwable) {
            Log.e(TAG, "MediaStore write failed: ${e.message}", e)
            promise.reject("WRITE_ERROR", "Failed to write via MediaStore: ${e.message}")
        }
    }

    private fun writeToFilePath(folderPath: String, fileName: String, content: String, promise: Promise) {
        try {
            Log.d(TAG, "Writing file via direct file path: folderPath=$folderPath, fileName=$fileName")
            
            // Ensure the folder path exists and is valid
            val folder = java.io.File(folderPath)
            if (!folder.exists()) {
                Log.d(TAG, "Folder does not exist, attempting to create: $folderPath")
                if (!folder.mkdirs()) {
                    Log.e(TAG, "Failed to create folder: $folderPath")
                    promise.reject("WRITE_ERROR", "Failed to create folder: $folderPath")
                    return
                }
            }
            
            if (!folder.isDirectory) {
                Log.e(TAG, "Path is not a directory: $folderPath")
                promise.reject("WRITE_ERROR", "Path is not a directory: $folderPath")
                return
            }
            
            // Check write permissions
            if (!folder.canWrite()) {
                Log.e(TAG, "No write permission for folder: $folderPath")
                Log.d(TAG, "Folder permissions - canRead: ${folder.canRead()}, canWrite: ${folder.canWrite()}, canExecute: ${folder.canExecute()}")
                promise.reject("WRITE_ERROR", "No write permission for folder: $folderPath. Please use internal storage or grant write permissions.")
                return
            }
            
            val file = java.io.File(folder, fileName)
            Log.d(TAG, "Creating file: ${file.absolutePath}")
            
            // Test write capability by attempting a small write first
            file.writeText(content, Charsets.UTF_8)
            
            if (!file.exists()) {
                Log.e(TAG, "File was not created: ${file.absolutePath}")
                promise.reject("WRITE_ERROR", "File was not created in: $folderPath")
                return
            }
            
            Log.d(TAG, "Successfully wrote file via file path: ${file.absolutePath}")
            promise.resolve(file.absolutePath)
        } catch (e: Throwable) {
            val errorMsg = e.message ?: "Unknown error writing to file path"
            Log.e(TAG, "File path write failed: $errorMsg", e)
            Log.e(TAG, "Write error cause: ${e.cause}")
            promise.reject("WRITE_ERROR", errorMsg)
        }
    }

    @ReactMethod
    fun pickFile(promise: Promise) {
        pickFileWithOptions(null, promise)
    }

    @ReactMethod
    fun pickFolder(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        
        if (activity == null) {
            Log.e(TAG, "Activity is null")
            promise.reject("ACTIVITY_NOT_FOUND", "Activity not found")
            return
        }

        if (isPickerActive && (pickFilePromise != null || pickFolderPromise != null)) {
            Log.w(TAG, "File picker already active, ignoring new request")
            promise.reject("PICKER_ACTIVE", "Picker is already active")
            return
        }

        pickFolderPromise = promise
        isPickerActive = true
        Log.d(TAG, "pickFolder called, opening folder picker")

        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                putExtra("android.content.extra.SHOW_ADVANCED", true)
            }
            
            cancelTimeoutRunnable = Runnable {
                if (isPickerActive && pickFolderPromise != null) {
                    Log.w(TAG, "Folder picker timeout - auto-resolving with empty string")
                    isPickerActive = false
                    pickFolderPromise?.resolve("")
                    pickFolderPromise = null
                }
            }
            Handler(Looper.getMainLooper()).postDelayed(cancelTimeoutRunnable!!, 30000)
            
            activity.startActivityForResult(intent, PICK_FOLDER_REQUEST)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open folder picker: ${e.message}", e)
            isPickerActive = false
            cancelTimeoutRunnable?.let { runnable: Runnable ->
                Handler(Looper.getMainLooper()).removeCallbacks(runnable)
            }
            pickFolderPromise?.reject("FOLDER_PICKER_ERROR", "Failed to open folder picker: ${e.message}")
            pickFolderPromise = null
        }
    }

    @ReactMethod
    fun pickFileWithOptions(options: ReadableMap?, promise: Promise) {
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
            // Get file type from options, default to any files
            val fileType = options?.getString("fileType") ?: "*/*"
            Log.d(TAG, "File type filter: $fileType")
            
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = fileType
                // Allow user to select from all storage locations
                putExtra(Intent.EXTRA_LOCAL_ONLY, false)
                // Show all documents and downloads
                putExtra("android.content.extra.SHOW_ADVANCED", true)
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

    private fun getFolderPathFromUri(uri: Uri): String {
        Log.d(TAG, "getFolderPathFromUri - URI: $uri")
        Log.d(TAG, "URI Authority: ${uri.authority}, Path: ${uri.path}")
        
        val documentId = try {
            if ("com.android.externalstorage.documents" == uri.authority) {
                Log.d(TAG, "Extracting document ID from external storage documents")
                android.provider.DocumentsContract.getDocumentId(uri)
            } else if ("com.android.providers.media.documents" == uri.authority) {
                Log.d(TAG, "Extracting document ID from media documents")
                android.provider.DocumentsContract.getDocumentId(uri)
            } else {
                Log.d(TAG, "Using path segments for document ID extraction")
                val pathSegments = uri.pathSegments
                Log.d(TAG, "Path segments: $pathSegments")
                if (pathSegments.contains("tree") && pathSegments.size > pathSegments.indexOf("tree") + 1) {
                    pathSegments[pathSegments.indexOf("tree") + 1]
                } else {
                    uri.lastPathSegment ?: uri.toString()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error getting document ID: ${e.message}, trying path segments")
            val pathSegments = uri.pathSegments
            Log.d(TAG, "Path segments: $pathSegments")
            if (pathSegments.contains("tree") && pathSegments.size > pathSegments.indexOf("tree") + 1) {
                pathSegments[pathSegments.indexOf("tree") + 1]
            } else {
                uri.lastPathSegment ?: uri.toString()
            }
        }
        
        Log.d(TAG, "Raw document ID: $documentId")
        
        // Handle URL-encoded characters in document ID (e.g., %3A for :)
        var decodedId = try {
            java.net.URLDecoder.decode(documentId, "UTF-8")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to URL decode document ID: ${e.message}")
            documentId
        }
        
        Log.d(TAG, "Decoded document ID: $decodedId")
        
        val path = if (decodedId.startsWith("primary:")) {
            val subfolder = decodedId.substringAfter("primary:")
            "/storage/emulated/0/$subfolder"
        } else if (decodedId.contains(":")) {
            val storageId = decodedId.substringBefore(":")
            val subfolder = decodedId.substringAfter(":")
            "/storage/$storageId/$subfolder"
        } else {
            // Try to use the path directly if it's already a valid filesystem path
            if (decodedId.startsWith("/")) decodedId else "/storage/emulated/0/$decodedId"
        }
        
        Log.d(TAG, "Converted URI to folder path: $path")
        
        // Verify the path exists and is accessible
        try {
            val pathFile = java.io.File(path)
            Log.d(TAG, "Path exists: ${pathFile.exists()}, isDirectory: ${pathFile.isDirectory}, canWrite: ${pathFile.canWrite()}")
        } catch (e: Exception) {
            Log.w(TAG, "Cannot verify path: ${e.message}")
        }
        
        return path
    }
}
