// Debug helper for Static Master Password
import {
  getStaticMasterPasswordInfo,
  verifyStaticMasterPassword,
  STATIC_MP_KEYS,
} from '../services/staticMasterPasswordService';
import { getCurrentUser } from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const debugSessionInfo = async () => {
  console.log('\n🔍 ===== STATIC PASSWORD DEBUG INFO =====');

  try {
    // 1. Current User Info
    const currentUser = getCurrentUser();
    console.log('👤 Current User:', {
      authenticated: !!currentUser,
      uid: currentUser?.uid?.substring(0, 12) + '...' || 'None',
      email: currentUser?.email || 'None',
    });

    // 2. Stored Static Password Data
    const staticData = await AsyncStorage.multiGet([
      STATIC_MP_KEYS.FIXED_SALT,
      STATIC_MP_KEYS.USER_UUID,
    ]);

    console.log('💾 Stored Static Password Data:');
    staticData.forEach(([key, value]) => {
      const keyName = key.split('_').pop();
      console.log(
        `   ${keyName}: ${value ? value.substring(0, 16) + '...' : 'None'}`,
      );
    });

    // 3. Static Password Info from Service
    const staticInfo = await getStaticMasterPasswordInfo();
    if (staticInfo.success && staticInfo.info) {
      console.log('🔐 Static Password Service Info:', {
        hasFixedSalt: staticInfo.info.hasFixedSalt,
        userUuidMatch: staticInfo.info.userUuidMatch,
        cacheValid: staticInfo.info.cacheValid,
      });
    }

    // 4. Static Password Verification
    const verification = await verifyStaticMasterPassword();
    console.log('✅ Static Password Verification:', {
      success: verification.success,
      valid: verification.valid,
      error: verification.error || 'None',
    });

    // 5. AsyncStorage Keys Analysis
    const allKeys = await AsyncStorage.getAllKeys();
    const passwordKeys = allKeys.filter(
      key =>
        key.includes('password') ||
        key.includes('static_mp') ||
        key.includes('encrypted'),
    );
    console.log(
      '🗄️ Related Storage Keys:',
      passwordKeys.length > 0 ? passwordKeys : 'None found',
    );
  } catch (error) {
    console.error('❌ Debug static password info failed:', error);
  }

  console.log('===== END STATIC PASSWORD DEBUG =====\n');
};

// Export for use in development/testing
export const logSessionStatus = () => {
  debugSessionInfo().catch(console.error);
};
