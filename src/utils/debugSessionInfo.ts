// Debug helper for Dynamic Master Password Session
import {
  getDynamicMasterPasswordInfo,
  verifyDynamicMasterPasswordSession,
  DYNAMIC_MP_KEYS,
} from '../services/dynamicMasterPasswordService';
import { getCurrentUser } from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const debugSessionInfo = async () => {
  console.log('\n🔍 ===== SESSION DEBUG INFO =====');

  try {
    // 1. Current User Info
    const currentUser = getCurrentUser();
    console.log('👤 Current User:', {
      authenticated: !!currentUser,
      uid: currentUser?.uid?.substring(0, 12) + '...' || 'None',
      email: currentUser?.email || 'None',
    });

    // 2. Stored Session Data
    const sessionData = await AsyncStorage.multiGet([
      DYNAMIC_MP_KEYS.LOGIN_TIMESTAMP,
      DYNAMIC_MP_KEYS.USER_UUID,
      DYNAMIC_MP_KEYS.SESSION_SALT,
      DYNAMIC_MP_KEYS.CURRENT_SESSION_HASH,
    ]);

    console.log('💾 Stored Session Data:');
    sessionData.forEach(([key, value]) => {
      const keyName = key.split('_').pop();
      console.log(
        `   ${keyName}: ${
          value
            ? keyName === 'timestamp'
              ? `${value} (${new Date(parseInt(value, 10)).toISOString()})`
              : value.substring(0, 16) + '...'
            : 'None'
        }`,
      );
    });

    // 3. Session Info from Service
    const sessionInfo = await getDynamicMasterPasswordInfo();
    if (sessionInfo.success && sessionInfo.info) {
      console.log('🔐 Session Service Info:', {
        hasSession: sessionInfo.info.hasSession,
        sessionAge: sessionInfo.info.sessionAge
          ? `${Math.round(sessionInfo.info.sessionAge / 1000)}s`
          : 'Unknown',
        cacheValid: sessionInfo.info.cacheValid,
      });
    }

    // 4. Session Verification
    const verification = await verifyDynamicMasterPasswordSession();
    console.log('✅ Session Verification:', {
      success: verification.success,
      valid: verification.valid,
      sessionId: verification.sessionId?.substring(0, 20) + '...' || 'None',
      error: verification.error || 'None',
    });

    // 5. AsyncStorage Keys Analysis
    const allKeys = await AsyncStorage.getAllKeys();
    const passwordKeys = allKeys.filter(
      key =>
        key.includes('password') ||
        key.includes('dynamic_mp') ||
        key.includes('encrypted'),
    );
    console.log(
      '🗄️ Related Storage Keys:',
      passwordKeys.length > 0 ? passwordKeys : 'None found',
    );
  } catch (error) {
    console.error('❌ Debug session info failed:', error);
  }

  console.log('===== END SESSION DEBUG =====\n');
};

// Export for use in development/testing
export const logSessionStatus = () => {
  debugSessionInfo().catch(console.error);
};
