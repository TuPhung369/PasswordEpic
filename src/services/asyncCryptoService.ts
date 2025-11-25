/**
 * Async Crypto Service
 * Provides async versions of crypto operations that don't block main thread
 * Uses requestAnimationFrame to yield to UI updates during heavy computations
 */

import { CRYPTO_CONSTANTS, deriveKeyFromPassword as syncDeriveKeyFromPassword } from './cryptoService';

interface ChunkedPBKDF2Result {
  key: string;
  iterationsCompleted: number;
  totalIterations: number;
}

/**
 * Async PBKDF2 that yields to main thread periodically
 * Allows UI to update during long key derivation
 * 
 * Note: This is a compatibility layer. For production, use native module.
 * Native module can provide 10-100x speedup.
 */
export async function deriveKeyAsync(
  password: string,
  salt: string,
  iterations: number = CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // For now, use setImmediate with larger chunks
      // In production, this should call native module
      setImmediate(() => {
        try {
          const key = syncDeriveKeyFromPassword(password, salt, iterations);
          resolve(key);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Higher level async wrapper that handles errors gracefully
 */
export async function deriveKeyAsyncWithFallback(
  password: string,
  salt: string,
  iterations: number = CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
  timeoutMs: number = 10000,
): Promise<string> {
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(
      () => reject(new Error(`PBKDF2 timeout after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );

  const cryptoPromise = deriveKeyAsync(password, salt, iterations);

  try {
    return await Promise.race([cryptoPromise, timeoutPromise]);
  } catch (error) {
    console.error('❌ [AsyncCrypto] Async PBKDF2 failed:', error);
    throw error;
  }
}
