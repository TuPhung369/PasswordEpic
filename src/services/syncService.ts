import AsyncStorage from '@react-native-async-storage/async-storage';
import { PasswordEntry, SyncConflict, SyncStatus } from '../types/password';
import { encryptedDatabase } from './encryptedDatabaseService';

const SYNC_STATUS_KEY = 'passwordepic_sync_status';
const PENDING_OPERATIONS_KEY = 'passwordepic_pending_operations';
const CONFLICTS_KEY = 'passwordepic_sync_conflicts';

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entryId: string;
  entryData?: PasswordEntry;
  timestamp: Date;
  retryCount: number;
}

export interface SyncConfiguration {
  enableAutoSync: boolean;
  syncInterval: number; // in minutes
  retryAttempts: number;
  conflictResolution:
    | 'manual'
    | 'local_wins'
    | 'remote_wins'
    | 'latest_timestamp';
  maxPendingOperations: number;
}

const DEFAULT_SYNC_CONFIG: SyncConfiguration = {
  enableAutoSync: true,
  syncInterval: 15, // 15 minutes
  retryAttempts: 3,
  conflictResolution: 'manual',
  maxPendingOperations: 100,
};

export class SyncService {
  private static instance: SyncService | null = null;
  private static syncStatus: SyncStatus = {
    isOnline: false,
    syncInProgress: false,
    pendingOperations: 0,
    conflicts: [],
  };
  private static pendingOperations: PendingOperation[] = [];
  private static conflicts: SyncConflict[] = [];
  private static config: SyncConfiguration = DEFAULT_SYNC_CONFIG;
  private static syncTimer: NodeJS.Timeout | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(): SyncService {
    if (!this.instance) {
      this.instance = new SyncService();
    }
    return this.instance;
  }

  /**
   * Initialize sync service
   */
  public static async initialize(): Promise<void> {
    await this.loadSyncStatus();
    await this.loadPendingOperations();
    await this.loadConflicts();
    await this.loadConfiguration();

    // Start auto-sync if enabled
    if (this.config.enableAutoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Get current sync status
   */
  public static getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Check if device is online
   */
  public static updateOnlineStatus(isOnline: boolean): void {
    this.syncStatus.isOnline = isOnline;
    this.saveSyncStatus();

    // If we came back online and have pending operations, try to sync
    if (
      isOnline &&
      this.pendingOperations.length > 0 &&
      !this.syncStatus.syncInProgress
    ) {
      this.performSync();
    }
  }

  /**
   * Add operation to pending queue
   */
  public static async addPendingOperation(
    type: PendingOperation['type'],
    entryId: string,
    entryData?: PasswordEntry,
  ): Promise<void> {
    const operation: PendingOperation = {
      id: `${type}_${entryId}_${Date.now()}`,
      type,
      entryId,
      entryData,
      timestamp: new Date(),
      retryCount: 0,
    };

    this.pendingOperations.push(operation);
    this.syncStatus.pendingOperations = this.pendingOperations.length;

    // Remove oldest operations if we exceed max limit
    if (this.pendingOperations.length > this.config.maxPendingOperations) {
      this.pendingOperations = this.pendingOperations.slice(
        -this.config.maxPendingOperations,
      );
      this.syncStatus.pendingOperations = this.pendingOperations.length;
    }

    await this.savePendingOperations();
    await this.saveSyncStatus();

    // Try to sync immediately if online
    if (this.syncStatus.isOnline && !this.syncStatus.syncInProgress) {
      this.performSync();
    }
  }

  /**
   * Perform full synchronization
   */
  public static async performSync(masterPassword?: string): Promise<{
    success: boolean;
    syncedOperations: number;
    newConflicts: number;
    errors: string[];
  }> {
    if (this.syncStatus.syncInProgress) {
      return {
        success: false,
        syncedOperations: 0,
        newConflicts: 0,
        errors: ['Sync already in progress'],
      };
    }

    if (!this.syncStatus.isOnline) {
      return {
        success: false,
        syncedOperations: 0,
        newConflicts: 0,
        errors: ['Device is offline'],
      };
    }

    this.syncStatus.syncInProgress = true;
    await this.saveSyncStatus();

    const errors: string[] = [];
    let syncedOperations = 0;
    let newConflicts = 0;

    try {
      // Process pending operations
      const operationsToProcess = [...this.pendingOperations];

      for (const operation of operationsToProcess) {
        try {
          const result = await this.processPendingOperation(
            operation,
            masterPassword,
          );
          if (result.success) {
            // Remove successful operation
            this.pendingOperations = this.pendingOperations.filter(
              op => op.id !== operation.id,
            );
            syncedOperations++;
          } else if (result.conflict) {
            // Handle conflict
            this.conflicts.push(result.conflict);
            newConflicts++;

            // Remove operation from pending if manual resolution is required
            if (this.config.conflictResolution === 'manual') {
              this.pendingOperations = this.pendingOperations.filter(
                op => op.id !== operation.id,
              );
            }
          } else {
            // Increment retry count
            operation.retryCount++;
            if (operation.retryCount >= this.config.retryAttempts) {
              // Remove failed operation after max retries
              this.pendingOperations = this.pendingOperations.filter(
                op => op.id !== operation.id,
              );
              errors.push(
                `Failed to sync operation ${operation.id} after ${this.config.retryAttempts} attempts`,
              );
            }
          }
        } catch (error) {
          errors.push(`Error processing operation ${operation.id}: ${error}`);
          operation.retryCount++;
        }
      }

      // Update sync status
      this.syncStatus.lastSync = new Date();
      this.syncStatus.pendingOperations = this.pendingOperations.length;
      this.syncStatus.conflicts = this.conflicts;
    } finally {
      this.syncStatus.syncInProgress = false;
      await this.saveSyncStatus();
      await this.savePendingOperations();
      await this.saveConflicts();
    }

    return {
      success: errors.length === 0,
      syncedOperations,
      newConflicts,
      errors,
    };
  }

  /**
   * Resolve a sync conflict
   */
  public static async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedEntry?: PasswordEntry,
  ): Promise<boolean> {
    const conflictIndex = this.conflicts.findIndex(
      c => `${c.entryId}_${c.timestamp.getTime()}` === conflictId,
    );

    if (conflictIndex === -1) {
      return false;
    }

    const conflict = this.conflicts[conflictIndex];

    try {
      let resolvedEntry: PasswordEntry;

      switch (resolution) {
        case 'local':
          resolvedEntry = conflict.localEntry;
          break;
        case 'remote':
          resolvedEntry = conflict.remoteEntry;
          break;
        case 'merge':
          if (!mergedEntry) {
            throw new Error('Merged entry required for merge resolution');
          }
          resolvedEntry = mergedEntry;
          break;
        default:
          throw new Error('Invalid resolution type');
      }

      // Apply the resolved entry
      // Note: In a real implementation, this would sync with the remote server
      // For now, we'll just update locally
      await encryptedDatabase.savePasswordEntry(resolvedEntry, ''); // masterPassword would be provided

      // Remove resolved conflict
      this.conflicts.splice(conflictIndex, 1);
      this.syncStatus.conflicts = this.conflicts;

      await this.saveConflicts();
      await this.saveSyncStatus();

      return true;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    }
  }

  /**
   * Get all unresolved conflicts
   */
  public static getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  /**
   * Clear all conflicts (use with caution)
   */
  public static async clearConflicts(): Promise<void> {
    this.conflicts = [];
    this.syncStatus.conflicts = [];
    await this.saveConflicts();
    await this.saveSyncStatus();
  }

  /**
   * Update sync configuration
   */
  public static async updateConfiguration(
    newConfig: Partial<SyncConfiguration>,
  ): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfiguration();

    // Restart auto-sync with new configuration
    this.stopAutoSync();
    if (this.config.enableAutoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Get current sync configuration
   */
  public static getConfiguration(): SyncConfiguration {
    return { ...this.config };
  }

  /**
   * Force immediate sync
   */
  public static async forcSync(masterPassword?: string): Promise<boolean> {
    const result = await this.performSync(masterPassword);
    return result.success;
  }

  /**
   * Clear all sync data (for reset/testing)
   */
  public static async clearAllSyncData(): Promise<void> {
    this.stopAutoSync();
    this.pendingOperations = [];
    this.conflicts = [];
    this.syncStatus = {
      isOnline: false,
      syncInProgress: false,
      pendingOperations: 0,
      conflicts: [],
    };

    try {
      await AsyncStorage.multiRemove([
        SYNC_STATUS_KEY,
        PENDING_OPERATIONS_KEY,
        CONFLICTS_KEY,
      ]);
    } catch (error) {
      console.error('Failed to clear sync data:', error);
    }
  }

  // Private helper methods
  private static async processPendingOperation(
    operation: PendingOperation,
    masterPassword?: string,
  ): Promise<{
    success: boolean;
    conflict?: SyncConflict;
    error?: string;
  }> {
    // Note: In a real implementation, this would communicate with a remote server
    // For now, we'll simulate the process

    try {
      switch (operation.type) {
        case 'create':
        case 'update':
          if (!operation.entryData) {
            return {
              success: false,
              error: 'Entry data missing for create/update operation',
            };
          }

          // Simulate checking for conflicts
          const existingEntry = await encryptedDatabase.getPasswordEntry(
            operation.entryId,
            masterPassword || '',
          );

          if (existingEntry && existingEntry.updatedAt > operation.timestamp) {
            // Conflict detected
            const conflict: SyncConflict = {
              entryId: operation.entryId,
              localEntry: operation.entryData,
              remoteEntry: existingEntry,
              conflictType: operation.type,
              timestamp: new Date(),
            };

            // Auto-resolve based on configuration
            if (this.config.conflictResolution !== 'manual') {
              const resolved = await this.autoResolveConflict(conflict);
              if (resolved) {
                return { success: true };
              }
            }

            return { success: false, conflict };
          }

          // No conflict, proceed with operation
          return { success: true };

        case 'delete':
          // Simulate delete operation
          return { success: true };

        default:
          return { success: false, error: 'Unknown operation type' };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private static async autoResolveConflict(
    conflict: SyncConflict,
  ): Promise<boolean> {
    try {
      let resolvedEntry: PasswordEntry;

      switch (this.config.conflictResolution) {
        case 'local_wins':
          resolvedEntry = conflict.localEntry;
          break;
        case 'remote_wins':
          resolvedEntry = conflict.remoteEntry;
          break;
        case 'latest_timestamp':
          resolvedEntry =
            conflict.localEntry.updatedAt > conflict.remoteEntry.updatedAt
              ? conflict.localEntry
              : conflict.remoteEntry;
          break;
        default:
          return false;
      }

      // Apply resolved entry (would sync to server in real implementation)
      await encryptedDatabase.savePasswordEntry(resolvedEntry, ''); // masterPassword would be provided
      return true;
    } catch (error) {
      console.error('Failed to auto-resolve conflict:', error);
      return false;
    }
  }

  private static startAutoSync(): void {
    if (this.syncTimer) {
      this.stopAutoSync();
    }

    const intervalMs = this.config.syncInterval * 60 * 1000; // Convert minutes to milliseconds
    this.syncTimer = setInterval(() => {
      if (
        this.syncStatus.isOnline &&
        !this.syncStatus.syncInProgress &&
        this.pendingOperations.length > 0
      ) {
        this.performSync();
      }
    }, intervalMs);
  }

  private static stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Storage helper methods
  private static async loadSyncStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.syncStatus = {
          ...parsed,
          lastSync: parsed.lastSync ? new Date(parsed.lastSync) : undefined,
          syncInProgress: false, // Reset on app start
        };
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }

  private static async saveSyncStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        SYNC_STATUS_KEY,
        JSON.stringify(this.syncStatus),
      );
    } catch (error) {
      console.error('Failed to save sync status:', error);
    }
  }

  private static async loadPendingOperations(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(PENDING_OPERATIONS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.pendingOperations = parsed.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp),
        }));
      }
    } catch (error) {
      console.error('Failed to load pending operations:', error);
    }
  }

  private static async savePendingOperations(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PENDING_OPERATIONS_KEY,
        JSON.stringify(this.pendingOperations),
      );
    } catch (error) {
      console.error('Failed to save pending operations:', error);
    }
  }

  private static async loadConflicts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(CONFLICTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.conflicts = parsed.map((conflict: any) => ({
          ...conflict,
          timestamp: new Date(conflict.timestamp),
          localEntry: {
            ...conflict.localEntry,
            createdAt: new Date(conflict.localEntry.createdAt),
            updatedAt: new Date(conflict.localEntry.updatedAt),
            lastUsed: conflict.localEntry.lastUsed
              ? new Date(conflict.localEntry.lastUsed)
              : undefined,
          },
          remoteEntry: {
            ...conflict.remoteEntry,
            createdAt: new Date(conflict.remoteEntry.createdAt),
            updatedAt: new Date(conflict.remoteEntry.updatedAt),
            lastUsed: conflict.remoteEntry.lastUsed
              ? new Date(conflict.remoteEntry.lastUsed)
              : undefined,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  }

  private static async saveConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(this.conflicts));
    } catch (error) {
      console.error('Failed to save conflicts:', error);
    }
  }

  private static async loadConfiguration(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('passwordepic_sync_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...DEFAULT_SYNC_CONFIG, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load sync configuration:', error);
    }
  }

  private static async saveConfiguration(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'passwordepic_sync_config',
        JSON.stringify(this.config),
      );
    } catch (error) {
      console.error('Failed to save sync configuration:', error);
    }
  }
}

export default SyncService;
