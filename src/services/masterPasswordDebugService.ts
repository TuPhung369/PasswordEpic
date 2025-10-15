/**
 * Master Password Debug Service
 * Helps debug and fix decryption issues by analyzing master password generation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from './firebase';
import { deriveKeyFromPassword } from './cryptoService';

export interface MasterPasswordDebugInfo {
  currentUser: {
    uid: string;
    email: string | null;
  } | null;
  storedValues: {
    dynamicLoginTimestamp: string | null;
    dynamicSessionSalt: string | null;
    staticFixedSalt: string | null;
    userUUID: string | null;
  };
  generatedPasswords: {
    currentDynamic: string;
    currentStatic: string;
    possibleAlternatives: string[];
  };
  sessionInfo: {
    hasValidSession: boolean;
    sessionAge: number | null;
  };
}

/**
 * Get comprehensive debug information about master password state
 */
export const getMasterPasswordDebugInfo =
  async (): Promise<MasterPasswordDebugInfo> => {
    const currentUser = getCurrentUser();

    // Get all stored values
    const [
      dynamicLoginTimestamp,
      dynamicSessionSalt,
      staticFixedSalt,
      userUUID,
    ] = await AsyncStorage.multiGet([
      'dynamic_mp_login_timestamp',
      'dynamic_mp_session_salt',
      'static_mp_fixed_salt',
      'dynamic_mp_user_uuid',
    ]);

    const storedValues = {
      dynamicLoginTimestamp: dynamicLoginTimestamp[1],
      dynamicSessionSalt: dynamicSessionSalt[1],
      staticFixedSalt: staticFixedSalt[1],
      userUUID: userUUID[1],
    };

    // Generate current passwords
    let currentDynamic = '';
    let currentStatic = '';
    let possibleAlternatives: string[] = [];

    if (currentUser) {
      // Current dynamic password
      if (
        storedValues.dynamicLoginTimestamp &&
        storedValues.dynamicSessionSalt
      ) {
        const dynamicComponents = [
          currentUser.uid,
          storedValues.dynamicLoginTimestamp,
          currentUser.email || 'anonymous',
          storedValues.dynamicSessionSalt.substring(0, 16),
        ];
        currentDynamic = dynamicComponents.join('::');
      }

      // Current static password
      if (storedValues.staticFixedSalt) {
        const staticComponents = [
          currentUser.uid,
          currentUser.email || 'anonymous',
          storedValues.staticFixedSalt.substring(0, 16),
        ];
        currentStatic = staticComponents.join('::');
      }

      // Generate possible alternatives
      possibleAlternatives = await generateAlternativeMasterPasswords(
        currentUser,
        storedValues,
      );
    }

    // Session info
    const sessionAge = storedValues.dynamicLoginTimestamp
      ? Date.now() - parseInt(storedValues.dynamicLoginTimestamp, 10)
      : null;

    return {
      currentUser: currentUser
        ? {
            uid: currentUser.uid,
            email: currentUser.email,
          }
        : null,
      storedValues,
      generatedPasswords: {
        currentDynamic,
        currentStatic,
        possibleAlternatives,
      },
      sessionInfo: {
        hasValidSession: !!(
          storedValues.dynamicLoginTimestamp && storedValues.dynamicSessionSalt
        ),
        sessionAge,
      },
    };
  };

/**
 * Generate all possible alternative master passwords
 */
async function generateAlternativeMasterPasswords(
  currentUser: any,
  storedValues: any,
): Promise<string[]> {
  const alternatives: string[] = [];

  // Try different combinations based on common patterns
  const salts = [
    storedValues.dynamicSessionSalt,
    storedValues.staticFixedSalt,
  ].filter(Boolean);
  const timestamps = [storedValues.dynamicLoginTimestamp].filter(Boolean);

  for (const salt of salts) {
    if (!salt) continue;

    // Pattern 1: UID + email + salt (static style)
    alternatives.push(
      `${currentUser.uid}::${
        currentUser.email || 'anonymous'
      }::${salt.substring(0, 16)}`,
    );

    // Pattern 2: Just UID + salt
    alternatives.push(`${currentUser.uid}::${salt.substring(0, 16)}`);

    // Pattern 3: UID + email + full salt
    alternatives.push(
      `${currentUser.uid}::${currentUser.email || 'anonymous'}::${salt}`,
    );

    for (const timestamp of timestamps) {
      // Pattern 4: UID + timestamp + email + salt (dynamic style)
      alternatives.push(
        `${currentUser.uid}::${timestamp}::${
          currentUser.email || 'anonymous'
        }::${salt.substring(0, 16)}`,
      );

      // Pattern 5: UID + timestamp + salt
      alternatives.push(
        `${currentUser.uid}::${timestamp}::${salt.substring(0, 16)}`,
      );

      // Pattern 6: UID + timestamp + email + full salt
      alternatives.push(
        `${currentUser.uid}::${timestamp}::${
          currentUser.email || 'anonymous'
        }::${salt}`,
      );
    }
  }

  // Remove duplicates
  return [...new Set(alternatives)];
}

/**
 * Test decryption with a specific master password and encrypted entry
 */
export const testDecryptionWithPassword = async (
  password: string,
  encryptedEntry: {
    encryptedData: string;
    salt: string;
    iv: string;
    authTag: string;
  },
  iterations: number = 5000,
): Promise<{
  success: boolean;
  error?: string;
  decryptedData?: string;
}> => {
  try {
    const { decryptData } = await import('./cryptoService');

    // Derive key
    const derivedKey = deriveKeyFromPassword(
      password,
      encryptedEntry.salt,
      iterations,
    );

    // Try to decrypt
    const decryptedData = decryptData(
      encryptedEntry.encryptedData,
      derivedKey,
      encryptedEntry.iv,
      encryptedEntry.authTag,
    );

    return {
      success: true,
      decryptedData,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Brute force test all possible master passwords against a failed entry
 */
export const bruteForceDecryptEntry = async (encryptedEntry: {
  id: string;
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
}): Promise<{
  success: boolean;
  workingPassword?: string;
  workingIterations?: number;
  error?: string;
}> => {
  console.log(`🔍 [Debug] Starting brute force for entry ${encryptedEntry.id}`);

  const debugInfo = await getMasterPasswordDebugInfo();
  const allPasswords = [
    debugInfo.generatedPasswords.currentDynamic,
    debugInfo.generatedPasswords.currentStatic,
    ...debugInfo.generatedPasswords.possibleAlternatives,
  ].filter(Boolean);

  console.log(`🔍 [Debug] Testing ${allPasswords.length} password variants`);

  // Test different iteration counts
  const iterationCounts = [5000, 2000, 10000, 1000, 100000];

  for (let i = 0; i < allPasswords.length; i++) {
    const password = allPasswords[i];
    console.log(
      `🔄 [Debug] Testing password ${i + 1}/${
        allPasswords.length
      }: ${password.substring(0, 50)}...`,
    );

    for (const iterations of iterationCounts) {
      try {
        const result = await testDecryptionWithPassword(
          password,
          encryptedEntry,
          iterations,
        );

        if (result.success) {
          console.log(`✅ [Debug] FOUND WORKING PASSWORD!`);
          console.log(`   Password: ${password.substring(0, 50)}...`);
          console.log(`   Iterations: ${iterations}`);

          return {
            success: true,
            workingPassword: password,
            workingIterations: iterations,
          };
        }
      } catch (error) {
        // Continue testing
      }
    }
  }

  console.log(
    `❌ [Debug] No working password found for entry ${encryptedEntry.id}`,
  );
  return {
    success: false,
    error: 'No working master password found',
  };
};

/**
 * Fix master password inconsistencies by standardizing to static approach
 */
export const fixMasterPasswordInconsistency = async (): Promise<{
  success: boolean;
  error?: string;
  migrated?: number;
}> => {
  try {
    console.log('🔧 [Debug] Starting master password consistency fix...');

    // This would require migrating all entries to use a consistent master password
    // For now, we'll just log the debug info
    const debugInfo = await getMasterPasswordDebugInfo();

    console.log('🔍 [Debug] Current master password state:');
    console.log('   Current user:', debugInfo.currentUser);
    console.log('   Stored values:', debugInfo.storedValues);
    console.log(
      '   Current dynamic password:',
      debugInfo.generatedPasswords.currentDynamic.substring(0, 50) + '...',
    );
    console.log(
      '   Current static password:',
      debugInfo.generatedPasswords.currentStatic.substring(0, 50) + '...',
    );
    console.log(
      '   Alternative count:',
      debugInfo.generatedPasswords.possibleAlternatives.length,
    );

    return {
      success: true,
      migrated: 0, // Placeholder - actual migration would happen here
    };
  } catch (error: any) {
    console.error(
      '❌ [Debug] Failed to fix master password consistency:',
      error,
    );
    return {
      success: false,
      error: error.message,
    };
  }
};
