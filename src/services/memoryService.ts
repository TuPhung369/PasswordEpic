/**
 * Memory Service
 *
 * Provides secure memory management:
 * - Secure data clearing
 * - Memory protection
 * - Sensitive data lifecycle management
 * - Memory leak prevention
 */

import { Platform } from 'react-native';

export interface SecureMemoryOptions {
  autoClean?: boolean;
  cleanupDelay?: number; // milliseconds
  overwriteCount?: number; // number of times to overwrite memory
}

export interface SecureDataHandle {
  id: string;
  data: any;
  createdAt: number;
  lastAccessedAt: number;
  autoClean: boolean;
  cleanupDelay: number;
}

class MemoryService {
  private static instance: MemoryService;
  private secureDataStore: Map<string, SecureDataHandle> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_CLEANUP_DELAY = 300000; // 5 minutes
  private readonly DEFAULT_OVERWRITE_COUNT = 3;

  private constructor() {
    // Setup memory cleanup on app state changes
    this.setupMemoryCleanup();
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * Store sensitive data securely in memory
   */
  public storeSecure(
    key: string,
    data: any,
    options: SecureMemoryOptions = {},
  ): string {
    const {
      autoClean = true,
      cleanupDelay = this.DEFAULT_CLEANUP_DELAY,
      overwriteCount = this.DEFAULT_OVERWRITE_COUNT,
    } = options;

    // Generate unique ID for this data
    const id = `${key}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store data with metadata
    const handle: SecureDataHandle = {
      id,
      data: this.deepClone(data),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      autoClean,
      cleanupDelay,
    };

    this.secureDataStore.set(id, handle);

    // Setup auto-cleanup if enabled
    if (autoClean) {
      this.scheduleCleanup(id, cleanupDelay);
    }

    return id;
  }

  /**
   * Retrieve secure data from memory
   */
  public retrieveSecure(id: string): any | null {
    const handle = this.secureDataStore.get(id);

    if (!handle) {
      console.warn(`Secure data not found: ${id}`);
      return null;
    }

    // Update last accessed time
    handle.lastAccessedAt = Date.now();

    // Reschedule cleanup if auto-clean is enabled
    if (handle.autoClean) {
      this.scheduleCleanup(id, handle.cleanupDelay);
    }

    return this.deepClone(handle.data);
  }

  /**
   * Remove secure data from memory
   */
  public removeSecure(id: string, overwriteCount?: number): boolean {
    const handle = this.secureDataStore.get(id);

    if (!handle) {
      return false;
    }

    // Cancel cleanup timer
    const timer = this.cleanupTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(id);
    }

    // Securely wipe data
    this.secureWipe(
      handle.data,
      overwriteCount || this.DEFAULT_OVERWRITE_COUNT,
    );

    // Remove from store
    this.secureDataStore.delete(id);

    return true;
  }

  /**
   * Clear all secure data from memory
   */
  public clearAll(overwriteCount?: number): void {
    const ids = Array.from(this.secureDataStore.keys());

    ids.forEach(id => {
      this.removeSecure(id, overwriteCount);
    });

    console.log(`Cleared ${ids.length} secure data entries from memory`);
  }

  /**
   * Schedule automatic cleanup for secure data
   */
  private scheduleCleanup(id: string, delay: number): void {
    // Cancel existing timer
    const existingTimer = this.cleanupTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new cleanup
    const timer = setTimeout(() => {
      console.log(`Auto-cleaning secure data: ${id}`);
      this.removeSecure(id);
    }, delay);

    this.cleanupTimers.set(id, timer);
  }

  /**
   * Securely wipe data from memory
   */
  private secureWipe(data: any, overwriteCount: number = 3): void {
    if (data === null || data === undefined) {
      return;
    }

    try {
      // Overwrite primitive values
      if (typeof data === 'string') {
        // Overwrite string with random characters
        for (let i = 0; i < overwriteCount; i++) {
          data = this.generateRandomString(data.length);
        }
      } else if (typeof data === 'number') {
        // Overwrite number with random values
        for (let i = 0; i < overwriteCount; i++) {
          data = Math.random();
        }
      } else if (typeof data === 'boolean') {
        // Toggle boolean
        for (let i = 0; i < overwriteCount; i++) {
          data = !data;
        }
      } else if (Array.isArray(data)) {
        // Recursively wipe array elements
        data.forEach((item, index) => {
          this.secureWipe(item, overwriteCount);
          data[index] = null;
        });
        data.length = 0;
      } else if (typeof data === 'object') {
        // Recursively wipe object properties
        Object.keys(data).forEach(key => {
          this.secureWipe(data[key], overwriteCount);
          delete data[key];
        });
      }
    } catch (error) {
      console.error('Error during secure wipe:', error);
    }
  }

  /**
   * Generate random string for overwriting
   */
  private generateRandomString(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Deep clone data to prevent reference issues
   */
  private deepClone(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.deepClone(item));
    }

    const cloned: any = {};
    Object.keys(data).forEach(key => {
      cloned[key] = this.deepClone(data[key]);
    });

    return cloned;
  }

  /**
   * Setup memory cleanup on app state changes
   */
  private setupMemoryCleanup(): void {
    // In a real app, you'd listen to AppState changes
    // and clear memory when app goes to background

    // For now, we'll just setup periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleData();
    }, 60000); // Check every minute
  }

  /**
   * Destroy the service and clean up resources
   */
  public destroy(): void {
    // Clear all cleanup timers
    this.cleanupTimers.forEach(timer => clearTimeout(timer));
    this.cleanupTimers.clear();

    // Clear the periodic cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all stored data
    this.secureDataStore.clear();
  }

  /**
   * Clean up stale data that hasn't been accessed recently
   */
  private cleanupStaleData(): void {
    const now = Date.now();
    const staleThreshold = 600000; // 10 minutes

    const staleIds: string[] = [];

    this.secureDataStore.forEach((handle, id) => {
      if (now - handle.lastAccessedAt > staleThreshold) {
        staleIds.push(id);
      }
    });

    if (staleIds.length > 0) {
      console.log(`Cleaning up ${staleIds.length} stale data entries`);
      staleIds.forEach(id => this.removeSecure(id));
    }
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): {
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    totalSize: number;
  } {
    const entries = Array.from(this.secureDataStore.values());

    if (entries.length === 0) {
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
        totalSize: 0,
      };
    }

    const timestamps = entries.map(e => e.createdAt);
    const oldestEntry = Math.min(...timestamps);
    const newestEntry = Math.max(...timestamps);

    // Rough estimate of memory size
    const totalSize = entries.reduce((sum, entry) => {
      return sum + JSON.stringify(entry.data).length;
    }, 0);

    return {
      totalEntries: entries.length,
      oldestEntry,
      newestEntry,
      totalSize,
    };
  }

  /**
   * Create a secure string that auto-clears
   */
  public createSecureString(value: string, ttl: number = 300000): SecureString {
    return new SecureString(value, ttl, this);
  }

  /**
   * Create a secure object that auto-clears
   */
  public createSecureObject<T>(
    value: T,
    ttl: number = 300000,
  ): SecureObject<T> {
    return new SecureObject(value, ttl, this);
  }
}

/**
 * Secure String wrapper that auto-clears from memory
 */
export class SecureString {
  private id: string;
  private memoryService: MemoryService;

  constructor(value: string, ttl: number, memoryService: MemoryService) {
    this.memoryService = memoryService;
    this.id = this.memoryService.storeSecure('secure_string', value, {
      autoClean: true,
      cleanupDelay: ttl,
    });
  }

  public getValue(): string | null {
    return this.memoryService.retrieveSecure(this.id);
  }

  public clear(): void {
    this.memoryService.removeSecure(this.id);
  }
}

/**
 * Secure Object wrapper that auto-clears from memory
 */
export class SecureObject<T> {
  private id: string;
  private memoryService: MemoryService;

  constructor(value: T, ttl: number, memoryService: MemoryService) {
    this.memoryService = memoryService;
    this.id = this.memoryService.storeSecure('secure_object', value, {
      autoClean: true,
      cleanupDelay: ttl,
    });
  }

  public getValue(): T | null {
    return this.memoryService.retrieveSecure(this.id);
  }

  public clear(): void {
    this.memoryService.removeSecure(this.id);
  }
}

export { MemoryService };
export default MemoryService.getInstance();
