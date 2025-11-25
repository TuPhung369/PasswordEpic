/**
 * Backup Metadata Cache Service
 *
 * Caches backup metadata to avoid re-downloading and re-decrypting
 * backup files every time the backup list is loaded.
 *
 * Cache Strategy:
 * - Key: backup file ID (Google Drive) or filename (local)
 * - Value: metadata + modifiedTime
 * - Invalidation: when modifiedTime changes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@backup_metadata_cache';
const CACHE_VERSION = 1;

export interface CachedBackupMetadata {
  id: string;
  filename: string;
  modifiedTime: string; // ISO string for comparison
  createdAt: string; // ISO string
  size: number;
  entryCount: number;
  categoryCount: number;
  encrypted: boolean;
  version: string;
  appVersion: string;
  cachedAt: number; // timestamp when cached
}

interface CacheData {
  version: number;
  entries: { [key: string]: CachedBackupMetadata };
}

class BackupMetadataCacheService {
  private cache: CacheData | null = null;
  private initialized = false;

  /**
   * Initialize cache from AsyncStorage
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as CacheData;
        // Check version compatibility
        if (data.version === CACHE_VERSION) {
          this.cache = data;
          console.log(
            `✅ [BackupCache] Loaded ${
              Object.keys(data.entries).length
            } cached metadata entries`,
          );
        } else {
          console.log(
            '🔄 [BackupCache] Cache version mismatch, clearing cache',
          );
          await this.clear();
        }
      } else {
        this.cache = { version: CACHE_VERSION, entries: {} };
      }
    } catch (error) {
      console.warn('⚠️ [BackupCache] Failed to load cache:', error);
      this.cache = { version: CACHE_VERSION, entries: {} };
    }

    this.initialized = true;
  }

  /**
   * Get cached metadata for a backup
   * Returns null if not cached or if modifiedTime has changed
   */
  async get(
    id: string,
    modifiedTime: string,
  ): Promise<CachedBackupMetadata | null> {
    await this.init();

    const entry = this.cache?.entries[id];
    if (!entry) {
      return null;
    }

    // Check if modifiedTime matches (cache invalidation)
    if (entry.modifiedTime !== modifiedTime) {
      console.log(
        `🔄 [BackupCache] Cache miss for ${id}: modifiedTime changed`,
      );
      return null;
    }

    console.log(`✅ [BackupCache] Cache hit for ${entry.filename}`);
    return entry;
  }

  /**
   * Set cached metadata for a backup
   */
  async set(metadata: CachedBackupMetadata): Promise<void> {
    await this.init();

    if (!this.cache) {
      this.cache = { version: CACHE_VERSION, entries: {} };
    }

    this.cache.entries[metadata.id] = {
      ...metadata,
      cachedAt: Date.now(),
    };

    // Save to AsyncStorage (debounced in real usage)
    await this.persist();
  }

  /**
   * Set multiple cached metadata entries at once
   */
  async setMany(metadataList: CachedBackupMetadata[]): Promise<void> {
    await this.init();

    if (!this.cache) {
      this.cache = { version: CACHE_VERSION, entries: {} };
    }

    for (const metadata of metadataList) {
      this.cache.entries[metadata.id] = {
        ...metadata,
        cachedAt: Date.now(),
      };
    }

    await this.persist();
    console.log(
      `✅ [BackupCache] Cached ${metadataList.length} metadata entries`,
    );
  }

  /**
   * Remove cached metadata for a backup
   */
  async remove(id: string): Promise<void> {
    await this.init();

    if (this.cache?.entries[id]) {
      delete this.cache.entries[id];
      await this.persist();
    }
  }

  /**
   * Clear all cached metadata
   */
  async clear(): Promise<void> {
    this.cache = { version: CACHE_VERSION, entries: {} };
    await AsyncStorage.removeItem(CACHE_KEY);
    console.log('🗑️ [BackupCache] Cache cleared');
  }

  /**
   * Get all cached entries
   */
  async getAll(): Promise<CachedBackupMetadata[]> {
    await this.init();
    return Object.values(this.cache?.entries || {});
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ count: number; oldestCacheTime: number | null }> {
    await this.init();

    const entries = Object.values(this.cache?.entries || {});
    const oldestCacheTime =
      entries.length > 0 ? Math.min(...entries.map(e => e.cachedAt)) : null;

    return {
      count: entries.length,
      oldestCacheTime,
    };
  }

  /**
   * Persist cache to AsyncStorage
   */
  private async persist(): Promise<void> {
    if (!this.cache) {
      return;
    }

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.warn('⚠️ [BackupCache] Failed to persist cache:', error);
    }
  }

  /**
   * Check which backups need metadata fetching
   * Returns: { cached: CachedBackupMetadata[], needsFetch: DriveFile[] }
   */
  async checkCache(
    files: Array<{
      id: string;
      name: string;
      modifiedTime: string;
      createdTime: string;
      size: string;
    }>,
  ): Promise<{
    cached: CachedBackupMetadata[];
    needsFetch: Array<{
      id: string;
      name: string;
      modifiedTime: string;
      createdTime: string;
      size: string;
    }>;
  }> {
    await this.init();

    const cached: CachedBackupMetadata[] = [];
    const needsFetch: Array<{
      id: string;
      name: string;
      modifiedTime: string;
      createdTime: string;
      size: string;
    }> = [];

    for (const file of files) {
      const cachedEntry = await this.get(file.id, file.modifiedTime);
      if (cachedEntry) {
        cached.push(cachedEntry);
      } else {
        needsFetch.push(file);
      }
    }

    console.log(
      `📊 [BackupCache] Cache check: ${cached.length} cached, ${needsFetch.length} need fetch`,
    );

    return { cached, needsFetch };
  }
}

// Singleton instance
export const backupMetadataCache = new BackupMetadataCacheService();
