import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';

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
    return tokens.accessToken;
  } catch (error) {
    console.error('Failed to get access token:', error);
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
    const accessToken = await getAccessToken();

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
    const response = await fetch(
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

    const accessToken = await getAccessToken();

    // Query files - use different spaces/query based on public/private
    let url: string;
    if (isPublic) {
      url = `${GOOGLE_DRIVE_API_URL}/files?` +
        `q=name contains 'PasswordEpic_Export' and trashed=false&` +
        `spaces=drive&` +
        `fields=files(id,name,mimeType,size,createdTime,modifiedTime)&` +
        `orderBy=modifiedTime desc`;
    } else {
      url = `${GOOGLE_DRIVE_API_URL}/files?` +
        `spaces=appDataFolder&` +
        `fields=files(id,name,mimeType,size,createdTime,modifiedTime)&` +
        `orderBy=modifiedTime desc`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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
    console.log('🔵 [GoogleDrive] Downloading file:', fileId);

    const accessToken = await getAccessToken();

    // Download file content
    const response = await fetch(
      `${GOOGLE_DRIVE_API_URL}/files/${fileId}?alt=media`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 [GoogleDrive] Download failed:', errorText);
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`,
      );
    }

    const fileContent = await response.text();

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

    const accessToken = await getAccessToken();

    const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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

    // Check if we have the required scopes
    try {
      const tokens = await getCachedTokens();
      console.log('🔵 [GoogleDrive] Has access token:', !!tokens.accessToken);
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
