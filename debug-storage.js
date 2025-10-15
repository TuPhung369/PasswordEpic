// Debug script to check password storage
// Run this in React Native Debugger console or add to your app temporarily

const AsyncStorage =
  require('@react-native-async-storage/async-storage').default;

async function debugStorage() {
  console.log('🔍 [Debug] Checking password storage...\n');

  try {
    // Check V1 (legacy) storage
    const v1Data = await AsyncStorage.getItem('encrypted_passwords');
    if (v1Data) {
      const v1Passwords = JSON.parse(v1Data);
      console.log('✅ [V1 Legacy] Found passwords:', v1Passwords.length);
      console.log(
        '📋 [V1 Legacy] IDs:',
        v1Passwords.map(p => p.id),
      );
    } else {
      console.log('❌ [V1 Legacy] No passwords found');
    }

    // Check V2 (optimized) storage
    const v2Data = await AsyncStorage.getItem('optimized_passwords_v2');
    if (v2Data) {
      const v2Passwords = JSON.parse(v2Data);
      console.log('\n✅ [V2 Optimized] Found passwords:', v2Passwords.length);
      console.log(
        '📋 [V2 Optimized] Titles:',
        v2Passwords.map(p => p.title),
      );
    } else {
      console.log('\n❌ [V2 Optimized] No passwords found');
    }

    // Check migration flag
    const migrationFlag = await AsyncStorage.getItem(
      'password_migration_v2_completed',
    );
    console.log(
      '\n🔄 [Migration] Flag:',
      migrationFlag ? 'COMPLETED' : 'NOT COMPLETED',
    );

    // List all keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(
      '\n📦 [Storage] All keys:',
      allKeys.filter(k => k.includes('password')),
    );
  } catch (error) {
    console.error('❌ [Debug] Error:', error);
  }
}

// Export for use
module.exports = { debugStorage };

// If running directly
if (require.main === module) {
  debugStorage();
}
