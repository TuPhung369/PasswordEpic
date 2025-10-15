import { Platform, PermissionsAndroid, Alert } from 'react-native';

/**
 * Request storage permissions for Android
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export const requestStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    // iOS doesn't need explicit storage permissions for app directories
    return true;
  }

  try {
    const androidVersion = Platform.Version;
    console.log('📱 [Permissions] Android version:', androidVersion);

    // Android 13+ (API 33+) uses different permission model
    if (androidVersion >= 33) {
      console.log(
        '📱 [Permissions] Android 13+, no storage permission needed for app directories',
      );
      // For Android 13+, we don't need WRITE_EXTERNAL_STORAGE for app-specific directories
      // But if we're using shared storage, we'd need READ_MEDIA_* permissions
      return true;
    }

    // Android 11-12 (API 30-32)
    if (androidVersion >= 30) {
      console.log(
        '📱 [Permissions] Android 11-12, checking WRITE_EXTERNAL_STORAGE',
      );
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );

      if (granted) {
        console.log('✅ [Permissions] Storage permission already granted');
        return true;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission Required',
          message:
            'PasswordEpic needs access to your storage to create backup files.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('✅ [Permissions] Storage permission granted');
        return true;
      } else {
        console.log('❌ [Permissions] Storage permission denied');
        Alert.alert(
          'Permission Required',
          'Storage permission is required to create backups. Please enable it in app settings.',
        );
        return false;
      }
    }

    // Android 6-10 (API 23-29)
    console.log(
      '📱 [Permissions] Android 6-10, requesting WRITE_EXTERNAL_STORAGE',
    );
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );

    if (granted) {
      console.log('✅ [Permissions] Storage permission already granted');
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission Required',
        message:
          'PasswordEpic needs access to your storage to create backup files.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('✅ [Permissions] Storage permission granted');
      return true;
    } else {
      console.log('❌ [Permissions] Storage permission denied');
      Alert.alert(
        'Permission Required',
        'Storage permission is required to create backups. Please enable it in app settings.',
      );
      return false;
    }
  } catch (error) {
    console.error(
      '❌ [Permissions] Error requesting storage permission:',
      error,
    );
    Alert.alert(
      'Permission Error',
      'Failed to request storage permission. Please try again.',
    );
    return false;
  }
};

/**
 * Check if storage permission is granted
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export const checkStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const androidVersion = Platform.Version;

    // Android 13+ doesn't need storage permission for app directories
    if (androidVersion >= 33) {
      return true;
    }

    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );

    return granted;
  } catch (error) {
    console.error('❌ [Permissions] Error checking storage permission:', error);
    return false;
  }
};
