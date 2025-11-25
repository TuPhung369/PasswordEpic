import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';

const GOOGLE_DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

// Cache for getTokens() to prevent concurrent calls
let pendingTokensPromise: Promise<any> | null = null;
let cachedTokens: any = null;
let tokensCacheTime = 0;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

/**
 * Get cached tokens, preventing concurrent getTokens() calls
 */
const getCachedTokens = async (): Promise<any> => {
  // Return cached tokens if still valid
  if (cachedTokens && Date.now() - tokensCacheTime < TOKEN_CACHE_DURATION) {
    return cachedTokens;
  }

  // Return pending promise if already in progress
  if (pendingTokensPromise) {
    return pendingTokensPromise;
  }

  // Create new promise and cache it
  pendingTokensPromise = GoogleSignin.getTokens();

  try {
    const tokens = await pendingTokensPromise;
    cachedTokens = tokens;
    tokensCacheTime = Date.now();
    return tokens;
  } finally {
    pendingTokensPromise = null;
  }
};

/**
 * Get access token for Google Drive API
 */
const getAccessToken = async (): Promise<string> => {
  try {
    const tokens = await getCachedTokens();
    if (!tokens || !tokens.accessToken) {
      // Clear cache and try to refresh
      cachedTokens = null;
      tokensCacheTime = 0;
      
      // Try to get fresh tokens
      const freshTokens = await GoogleSignin.getTokens();
      cachedTokens = freshTokens;
      tokensCacheTime = Date.now();
      return freshTokens.accessToken;
    }
    return tokens.accessToken;
  } catch (error) {
    console.error('Failed to get access token:', error);
    // Clear cache on error
    cachedTokens = null;
    tokensCacheTime = 0;
    throw new Error('Failed to authenticate with Google Drive');
  }
};

/**
 * Upload a file to Google Drive
 * @param isPublic - if true, upload to root (My Drive); if false, upload to appDataFolder (hidden)
 */
export const uploadToGoogleDrive = async (
  filePath: string,
  fileName: string,
  mimeType: string = 'application/octet-stream',
  isPublic: boolean = false,
): Promise<{ success: boolean; fileId?: string; error?: string }> => {
  try {
    console.log('🔵 [GoogleDrive] Starting upload:', fileName, `(${isPublic ? 'Public' : 'Hidden'})`);

    // Get access token
    let accessToken = await getAccessToken();

    // Read file content
    const fileContent = await RNFS.readFile(filePath, 'base64');
    const fileSize = (await RNFS.stat(filePath)).size;

    console.log('🔵 [GoogleDrive] File size:', fileSize, 'bytes');

    // Create metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [isPublic ? 'root' : 'appDataFolder'],
    };

    // Create multipart request body
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileContent +
      closeDelimiter;

    // Upload file
    let response = await fetch(
      `${GOOGLE_DRIVE_UPLOAD_URL}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
    );

    // If we get 401, try refreshing the token and retrying once
    if (response.status === 401) {
      console.log('🔵 [GoogleDrive] Received 401 on upload, refreshing token and retrying...');
      
      // Clear cache and force refresh
      cachedTokens = null;
      tokensCacheTime = 0;
      
      try {
        accessToken = await getAccessToken();
        response = await fetch(
          `${GOOGLE_DRIVE_UPLOAD_URL}/files?uploadType=multipart`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          },
        );
      } catch (refreshError) {
        console.error('🔴 [GoogleDrive] Failed to refresh token on upload:', refreshError);
        throw new Error('Authentication failed - please sign in again');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 [GoogleDrive] Upload failed:', errorText);
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log('✅ [GoogleDrive] Upload successful:', result.id);

    return {
      success: true,
      fileId: result.id,
    };
  } catch (error) {
    console.error('🔴 [GoogleDrive] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * List files from Google Drive (supports both public My Drive and hidden appDataFolder)
 * @param isPublic - if true, list from root (My Drive); if false, list from appDataFolder (hidden)
 */
export const listGoogleDriveBackups = async (isPublic: boolean = false): Promise<{
  success: boolean;
  files?: DriveFile[];
  error?: string;
}> => {
  try {
    console.log('🔵 [GoogleDrive] Listing backups from', isPublic ? 'My Drive' : 'Hidden folder');

    let accessToken = await getAccessToken();

    // Query files - use different spaces/query based on public/private
    let url: string;
    if (isPublic) {
      url = `${GOOGLE_DRIVE_API_URL}/files?` +
        `q=name contains 'PasswordEpic_' and trashed=false&` +
        `spaces=drive&` +
        `fields=files(id,name,mimeType,size,createdTime,modifiedTime)&` +
        `orderBy=modifiedTime desc`;
    } else {
      url = `${GOOGLE_DRIVE_API_URL}/files?` +
        `spaces=appDataFolder&` +
        `fields=files(id,name,mimeType,size,createdTime,modifiedTime)&` +
        `orderBy=modifiedTime desc`;
    }

    let response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // If we get 401, try refreshing the token and retrying once
    if (response.status === 401) {
      console.log('🔵 [GoogleDrive] Received 401, refreshing token and retrying...');
      
      // Clear cache and force refresh
      cachedTokens = null;
      tokensCacheTime = 0;
      
      try {
        accessToken = await getAccessToken();
        response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (refreshError) {
        console.error('🔴 [GoogleDrive] Failed to refresh token:', refreshError);
        throw new Error('Authentication failed - please sign in again');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 [GoogleDrive] List failed:', errorText);
      throw new Error(`List failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ [GoogleDrive] Found', result.files?.length || 0, 'backups');

    return {
      success: true,
      files: result.files || [],
    };
  } catch (error) {
    console.error('🔴 [GoogleDrive] List error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Download a file from Google Drive
 */
export const downloadFromGoogleDrive = async (
  fileId: string,
  destinationPath: string,
): Promise<{ success: boolean; error?: string }> => {
  try {

    let accessToken = await getAccessToken();

    // Download file content
    let response = await fetch(
      `${GOOGLE_DRIVE_API_URL}/files/${fileId}?alt=media`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    // If we get 401, try refreshing the token and retrying once
    if (response.status === 401) {
      console.log('🔵 [GoogleDrive] Received 401 on download, refreshing token and retrying...');
      
      // Clear cache and force refresh
      cachedTokens = null;
      tokensCacheTime = 0;
      
      try {
        accessToken = await getAccessToken();
        response = await fetch(
          `${GOOGLE_DRIVE_API_URL}/files/${fileId}?alt=media`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      } catch (refreshError) {
        console.error('🔴 [GoogleDrive] Failed to refresh token on download:', refreshError);
        throw new Error('Authentication failed - please sign in again');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 [GoogleDrive] Download failed:', errorText);
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      );
    }

    // Try to get the content, handling both text and binary responses
    let fileContent: string;
    
    try {
      // First try to read as text (most backups are JSON/text)
      fileContent = await response.text();
    } catch (textError) {
      console.warn('⚠️ [GoogleDrive] Failed to read as text, trying as blob');
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      fileContent = Buffer.from(arrayBuffer).toString('utf8');
      console.log('🔵 [GoogleDrive] Downloaded content as blob, decoded length:', fileContent.length);
    }

    // Detect and decode base64 if needed
    // Base64 will contain only: A-Za-z0-9+/= (and possibly whitespace)
    const base64Pattern = /^[A-Za-z0-9+/=\s\r\n]*$/;
    const trimmedContent = fileContent.trim();
    
    if (base64Pattern.test(trimmedContent) && trimmedContent.length > 0) {
      try {
        // Remove all whitespace before decoding
        const cleanBase64 = trimmedContent.replace(/\s/g, '');
        
        // Verify it looks like valid base64 (length should be multiple of 4)
        if (cleanBase64.length % 4 === 0) {
          // Try to decode
          const decoded = Buffer.from(cleanBase64, 'base64').toString('utf8');
          
          // Verify it's valid JSON by checking for common JSON markers
          if ((decoded.includes('{') || decoded.includes('[') || decoded.includes('ENCRYPTED_V1:')) && 
              decoded.length > trimmedContent.length / 2) { // Decoded should be significantly larger
            fileContent = decoded;
            console.log('🔵 [GoogleDrive] Successfully decoded base64 content');
            console.log('🔵 [GoogleDrive] Decoded content length:', fileContent.length);
            console.log('🔵 [GoogleDrive] First 100 chars of decoded:', fileContent.substring(0, 100));
          } else {
            console.log('⚠️ [GoogleDrive] Decoded content does not look like valid backup, keeping original');
          }
        }
      } catch (decodeError) {
        console.warn('⚠️ [GoogleDrive] Failed to decode base64:', decodeError);
      }
    } else {
      console.log('🔵 [GoogleDrive] Content does not appear to be base64 encoded');
    }

    // Write to destination
    await RNFS.writeFile(destinationPath, fileContent, 'utf8');

    console.log('✅ [GoogleDrive] Download successful');

    return {
      success: true,
    };
  } catch (error) {
    console.error('🔴 [GoogleDrive] Download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Delete a file from Google Drive
 */
export const deleteFromGoogleDrive = async (
  fileId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔵 [GoogleDrive] Deleting file:', fileId);

    let accessToken = await getAccessToken();

    let response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // If we get 401, try refreshing the token and retrying once
    if (response.status === 401) {
      console.log('🔵 [GoogleDrive] Received 401 on delete, refreshing token and retrying...');
      
      // Clear cache and force refresh
      cachedTokens = null;
      tokensCacheTime = 0;
      
      try {
        accessToken = await getAccessToken();
        response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (refreshError) {
        console.error('🔴 [GoogleDrive] Failed to refresh token on delete:', refreshError);
        throw new Error('Authentication failed - please sign in again');
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 [GoogleDrive] Delete failed:', errorText);
      throw new Error(
        `Delete failed: ${response.status} ${response.statusText}`,
      );
    }

    console.log('✅ [GoogleDrive] Delete successful');

    return {
      success: true,
    };
  } catch (error) {
    console.error('🔴 [GoogleDrive] Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Check if user is signed in to Google and has Drive permissions
 */
export const isGoogleDriveAvailable = async (): Promise<boolean> => {
  try {
    // Use hasPreviousSignIn instead of isSignedIn (for v16+ compatibility)
    const isSignedIn = await GoogleSignin.hasPreviousSignIn();
    if (!isSignedIn) {
      console.log('🔴 [GoogleDrive] User not signed in');
      return false;
    }

    // Try to get fresh tokens silently
    try {
      await GoogleSignin.signInSilently();
      const tokens = await GoogleSignin.getTokens();
      console.log('🔵 [GoogleDrive] Has access token:', !!tokens.accessToken);
      
      // Update cache with fresh tokens
      cachedTokens = tokens;
      tokensCacheTime = Date.now();
      
      return !!tokens.accessToken;
    } catch (error) {
      console.error('🔴 [GoogleDrive] Failed to get tokens:', error);
      return false;
    }
  } catch (error) {
    console.error('🔴 [GoogleDrive] Error checking availability:', error);
    return false;
  }
};

/**
 * Ensure user is authenticated and has Drive permissions before making API calls
 * Automatically requests permissions if needed
 */
export const ensureGoogleDriveAuthenticated = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const available = await isGoogleDriveAvailable();
    if (available) {
      return { success: true };
    }

    console.log('🔵 [GoogleDrive] Not authenticated, requesting permissions...');
    const permResult = await requestDrivePermissions();
    
    if (!permResult.success) {
      return {
        success: false,
        error: permResult.error || 'Failed to authenticate with Google Drive',
      };
    }

    // Verify authentication after requesting permissions
    const verified = await isGoogleDriveAvailable();
    if (!verified) {
      return {
        success: false,
        error: 'Authentication failed after permission request',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('🔴 [GoogleDrive] Error ensuring authentication:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Request additional Drive permissions if needed
 */
export const requestDrivePermissions = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log('🔵 [GoogleDrive] Requesting Drive permissions...');

    // Add Drive scopes
    await GoogleSignin.addScopes({
      scopes: [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    console.log('✅ [GoogleDrive] Drive permissions granted');
    return { success: true };
  } catch (error) {
    console.error('🔴 [GoogleDrive] Failed to request permissions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
