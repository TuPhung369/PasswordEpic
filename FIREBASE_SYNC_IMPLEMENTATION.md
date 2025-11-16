# Firebase Sync Implementation for Fixed Salt

## Overview
This document describes the implementation of cross-device sync for the Fixed Salt using Firebase Firestore and encryption.

## Problem Solved
Previously, when users tried to restore backups on a different device using the same account and master password, the restore would fail because:
- Each device generated its own random `fixedSalt`
- The fixed salt is used to derive the master password: `UID::Email::fixedSalt`
- Different salt → Different master password → Cannot decrypt backups from other devices

## Solution: Encrypted Salt Storage on Firebase

### Architecture

```
Device 1 (Initial Setup):
1. User logs in with master password
2. Generate random fixedSalt
3. Encrypt: encryptedSalt = AES(fixedSalt, PBKDF2(masterPassword))
4. Save encryptedSalt to Firebase
5. Save fixedSalt to local AsyncStorage

Device 2 (Restore):
1. User logs in with same master password
2. Fetch encryptedSalt from Firebase
3. Decrypt: fixedSalt = Decrypt(encryptedSalt, PBKDF2(masterPassword))
4. ✅ Same fixedSalt + Same masterPassword → Can decrypt backups!
5. Save fixedSalt to local AsyncStorage
```

### Key Features

1. **Encrypted Storage**: Salt is encrypted with user's master password before storing on Firebase
2. **Access Control**: Firebase Rules ensure only the authenticated user can read/write their salt
3. **Deterministic Encryption Key**: Uses empty salt for PBKDF2 to ensure same password always produces same key
4. **Backwards Compatible**: Works with existing flow when master password is not provided
5. **Fallback Strategy**: If Firebase unavailable, falls back to local AsyncStorage
6. **Auto-sync**: On first device with master password, automatically saves salt to Firebase

### Code Changes

#### 1. Modified: `staticMasterPasswordService.ts`

**New Functions:**
- `saveEncryptedSaltToFirebase()`: Encrypts salt with master password and saves to Firebase
- `fetchDecryptedSaltFromFirebase()`: Fetches encrypted salt and decrypts using master password

**Modified Function:**
- `generateStaticMasterPassword(userMasterPassword?: string)`
  - NEW Parameter: `userMasterPassword` (optional)
  - When provided: Syncs with Firebase (fetch or create+save)
  - When not provided: Uses local storage only (backwards compatible)

**Flow:**
```typescript
// Called during restore/import flow with user's master password
const result = await generateStaticMasterPassword(userMasterPassword);

// Called without parameter (backwards compatible)
const result = await generateStaticMasterPassword();
```

### Firebase Firestore Structure

```
Collection: users
Document: {userId}
Fields:
  - encryptedFixedSalt: string (hex-encoded ciphertext)
  - saltEncryptionIV: string (initialization vector)
  - saltEncryptionTag: string (authentication tag)
  - updatedAt: number (timestamp)
```

### Security

#### Encryption Details
- **Algorithm**: AES-GCM (via CryptoJS AES-CTR + HMAC-SHA256)
- **Key Derivation**: PBKDF2 with 10,000 iterations
- **Key Material**: Master password + empty salt (deterministic)
- **Authentication**: HMAC-SHA256 tag verification

#### Security Properties
✅ **Confidentiality**: Salt encrypted with user's master password
✅ **Integrity**: HMAC tag verifies salt wasn't tampered with
✅ **Access Control**: Firebase Rules restrict to authenticated user only
✅ **No Brute Force**: User must have correct master password to decrypt

#### Attack Resistance
| Attack Scenario | Protection |
|---|---|
| Firebase breach | Attacker gets encryptedSalt (encrypted with masterPassword) |
| Brute force offline | Attacker needs masterPassword to decrypt |
| Network sniff | HTTPS + encrypted payload |
| Unauthorized user access | Firebase Rules prevent read/write |

### Integration Points

#### 1. During User Registration/First Login
- Automatically generates salt and saves to Firebase (handled by `generateStaticMasterPassword`)

#### 2. During Restore/Import Flow
Update `PasswordsScreen.tsx` to pass master password:

```typescript
// In handleRestoreBackupFile function
const masterPassword = /* user's input */;

// This will now sync with Firebase if not already done
const result = await generateStaticMasterPassword(masterPassword);
```

#### 3. Logout
- `clearStaticMasterPasswordData()` already clears both local and cache
- Firebase data remains for re-login on other devices

### Firebase Rules Deployment

**File**: `firestore.rules`

The rules file restricts access so that:
- Only authenticated users can read/write their own user document
- Only specific fields can be updated
- No cross-user data access

**To Deploy:**
```bash
firebase deploy --only firestore:rules
```

### Error Handling

The implementation includes graceful fallbacks:

```
If Firebase fetch fails:
  → Try local AsyncStorage
  → If empty, generate new salt
  → Attempt to save to Firebase (if master password provided)
  → Log warnings but don't crash

If Firebase save fails:
  → Local salt still works
  → Warning logged to console
  → Next restore attempt will try again
```

### Testing Checklist

- [ ] Single device: Setup, backup, restore (should work as before)
- [ ] Two devices same account:
  - [ ] Setup on Device 1 with master password
  - [ ] Login on Device 2 with same master password
  - [ ] Restore backup from Device 1
  - [ ] Verify passwords decrypt correctly
- [ ] Firebase offline: Local storage fallback
- [ ] Wrong master password: Decryption should fail (correct behavior)
- [ ] New user registration: Salt auto-synced to Firebase

### Backwards Compatibility

✅ Fully backwards compatible:
- Existing apps without master password: Work with local storage
- Existing salts: Auto-migrated to Firebase on next master password use
- No breaking changes to existing APIs

### Next Steps

1. **Test Locally**
   - Test backup/restore flow on two emulators
   - Verify salt matches across devices

2. **Update Firebase Rules**
   - Deploy `firestore.rules` to production

3. **Release**
   - No database migrations needed
   - Salt will be synced automatically on first use

### Troubleshooting

**Issue**: "Failed to fetch salt from Firebase"
- Solution: Check Firebase connection, verify rules are deployed

**Issue**: Restore fails with "invalid key"
- Solution: Check master password is correct, try clearing local salt and re-syncing

**Issue**: Different salts on Device 1 and Device 2
- Solution: Delete local salt, re-login with master password to fetch from Firebase

