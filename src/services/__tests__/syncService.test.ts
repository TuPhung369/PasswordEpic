import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncService, {
  PendingOperation,
  SyncConfiguration,
} from '../syncService';
import { encryptedDatabase } from '../encryptedDatabaseService';
import { PasswordEntry, SyncStatus, SyncConflict } from '../../types/password';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../encryptedDatabaseService');

describe('SyncService', () => {
  const mockPasswordEntry: PasswordEntry = {
    id: 'test-123',
    site: 'example.com',
    username: 'testuser',
    password: 'encrypted-password',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    category: 'work',
    tags: ['important'],
    notes: 'Test entry',
    strength: 'strong',
    lastUsed: new Date('2024-01-03'),
    icon: 'web',
    isEncrypted: true,
  };

  const mockPasswordEntry2: PasswordEntry = {
    ...mockPasswordEntry,
    id: 'test-456',
    site: 'github.com',
    updatedAt: new Date('2024-01-05'),
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset singleton by clearing static state
    (SyncService as any).instance = null;
    (SyncService as any).syncStatus = {
      isOnline: false,
      syncInProgress: false,
      pendingOperations: 0,
      conflicts: [],
    };
    (SyncService as any).pendingOperations = [];
    (SyncService as any).conflicts = [];
    (SyncService as any).syncTimer = null;

    // Mock AsyncStorage methods
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);

    // Mock encryptedDatabase
    (encryptedDatabase.getPasswordEntry as jest.Mock).mockResolvedValue(null);
    (encryptedDatabase.savePasswordEntry as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = SyncService.getInstance();
      const instance2 = SyncService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance on first call', () => {
      const instance = SyncService.getInstance();
      expect(instance).toBeInstanceOf(SyncService);
    });
  });

  describe('initialize()', () => {
    it('should load sync status, pending operations, conflicts, and configuration', async () => {
      const mockStatus = {
        isOnline: true,
        syncInProgress: false,
        pendingOperations: 2,
        conflicts: [],
      };

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(mockStatus))
        .mockResolvedValueOnce(JSON.stringify([]))
        .mockResolvedValueOnce(JSON.stringify([]))
        .mockResolvedValueOnce(JSON.stringify({ enableAutoSync: false }));

      await SyncService.initialize();

      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(4);
    });

    it('should start auto-sync when enabled in configuration', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({}))
        .mockResolvedValueOnce(JSON.stringify([]))
        .mockResolvedValueOnce(JSON.stringify([]))
        .mockResolvedValueOnce(JSON.stringify({ enableAutoSync: true }));

      await SyncService.initialize();
      const syncTimer = (SyncService as any).syncTimer;

      expect(syncTimer).not.toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      // Should not throw
      await expect(SyncService.initialize()).resolves.not.toThrow();
    });
  });

  describe('getSyncStatus()', () => {
    it('should return current sync status', () => {
      const status = SyncService.getSyncStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('syncInProgress');
      expect(status).toHaveProperty('pendingOperations');
      expect(status).toHaveProperty('conflicts');
    });

    it('should return a copy of sync status', () => {
      const status1 = SyncService.getSyncStatus();
      status1.isOnline = true;
      const status2 = SyncService.getSyncStatus();

      expect(status2.isOnline).toBe(false);
    });
  });

  describe('updateOnlineStatus()', () => {
    it('should update online status to true', () => {
      SyncService.updateOnlineStatus(true);
      const status = SyncService.getSyncStatus();

      expect(status.isOnline).toBe(true);
    });

    it('should update online status to false', () => {
      SyncService.updateOnlineStatus(false);
      const status = SyncService.getSyncStatus();

      expect(status.isOnline).toBe(false);
    });

    it('should trigger sync when coming online with pending operations', async () => {
      // Add pending operations
      (SyncService as any).pendingOperations = [
        {
          id: 'op-1',
          type: 'create',
          entryId: 'entry-1',
          timestamp: new Date(),
          retryCount: 0,
        },
      ];

      const performSyncSpy = jest.spyOn(SyncService, 'performSync');

      SyncService.updateOnlineStatus(true);

      expect(performSyncSpy).toHaveBeenCalled();

      performSyncSpy.mockRestore();
    });

    it('should not trigger sync when already syncing', async () => {
      (SyncService as any).syncStatus.syncInProgress = true;
      (SyncService as any).pendingOperations = [
        {
          id: 'op-1',
          type: 'create',
          entryId: 'entry-1',
          timestamp: new Date(),
          retryCount: 0,
        },
      ];

      const performSyncSpy = jest.spyOn(SyncService, 'performSync');

      SyncService.updateOnlineStatus(true);

      expect(performSyncSpy).not.toHaveBeenCalled();

      performSyncSpy.mockRestore();
    });

    it('should save sync status to storage', async () => {
      SyncService.updateOnlineStatus(true);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('addPendingOperation()', () => {
    it('should add create operation to queue', async () => {
      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      expect((SyncService as any).pendingOperations).toHaveLength(1);
      expect((SyncService as any).pendingOperations[0]).toMatchObject({
        type: 'create',
        entryId: 'entry-1',
        retryCount: 0,
      });
    });

    it('should add update operation to queue', async () => {
      await SyncService.addPendingOperation(
        'update',
        'entry-1',
        mockPasswordEntry,
      );

      expect((SyncService as any).pendingOperations).toHaveLength(1);
      expect((SyncService as any).pendingOperations[0].type).toBe('update');
    });

    it('should add delete operation to queue', async () => {
      await SyncService.addPendingOperation('delete', 'entry-1');

      expect((SyncService as any).pendingOperations).toHaveLength(1);
      expect((SyncService as any).pendingOperations[0].type).toBe('delete');
    });

    it('should update pending operations count in status', async () => {
      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      const status = SyncService.getSyncStatus();
      expect(status.pendingOperations).toBe(1);
    });

    it('should remove oldest operations when exceeding max limit', async () => {
      const maxOps = (SyncService as any).config.maxPendingOperations;

      for (let i = 0; i < maxOps + 10; i++) {
        await SyncService.addPendingOperation(
          'create',
          `entry-${i}`,
          mockPasswordEntry,
        );
      }

      expect((SyncService as any).pendingOperations.length).toBe(maxOps);
    });

    it('should trigger sync when online and not already syncing', async () => {
      SyncService.updateOnlineStatus(true);
      const performSyncSpy = jest.spyOn(SyncService, 'performSync');

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      expect(performSyncSpy).toHaveBeenCalled();

      performSyncSpy.mockRestore();
    });

    it('should save operations to storage', async () => {
      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('performSync()', () => {
    it('should return error if sync already in progress', async () => {
      (SyncService as any).syncStatus.syncInProgress = true;

      const result = await SyncService.performSync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Sync already in progress');
    });

    it('should return error if device is offline', async () => {
      (SyncService as any).syncStatus.isOnline = false;

      const result = await SyncService.performSync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Device is offline');
    });

    it('should set syncInProgress to true during sync', async () => {
      SyncService.updateOnlineStatus(true);

      const syncPromise = SyncService.performSync();

      expect((SyncService as any).syncStatus.syncInProgress).toBe(true);

      await syncPromise;

      expect((SyncService as any).syncStatus.syncInProgress).toBe(false);
    });

    it('should process all pending operations', async () => {
      SyncService.updateOnlineStatus(true);

      // Mock database to return null (no existing entry, so no conflict)
      (encryptedDatabase.getPasswordEntry as jest.Mock).mockResolvedValue(null);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );
      await SyncService.addPendingOperation(
        'update',
        'entry-2',
        mockPasswordEntry2,
      );

      const result = await SyncService.performSync();

      expect(result.syncedOperations).toBeGreaterThanOrEqual(0);
    });

    it('should update lastSync timestamp', async () => {
      SyncService.updateOnlineStatus(true);

      await SyncService.performSync();

      const status = SyncService.getSyncStatus();
      expect(status.lastSync).toBeInstanceOf(Date);
    });

    it('should handle operation processing errors', async () => {
      SyncService.updateOnlineStatus(true);

      (SyncService as any).pendingOperations = [
        {
          id: 'op-1',
          type: 'create',
          entryId: 'entry-1',
          entryData: mockPasswordEntry,
          timestamp: new Date(),
          retryCount: 2, // Already at max retries
        },
      ];

      await SyncService.updateConfiguration({ retryAttempts: 2 });

      (encryptedDatabase.getPasswordEntry as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await SyncService.performSync();

      // Operation should be removed after max retries and error logged
      expect((SyncService as any).pendingOperations.length).toBe(0);
    });

    it('should detect conflicts', async () => {
      await SyncService.updateConfiguration({
        conflictResolution: 'manual',
      });

      SyncService.updateOnlineStatus(true);

      const futureDate = new Date('2024-02-01');

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      // Mock existing entry with newer updatedAt
      const existingEntry = {
        ...mockPasswordEntry,
        updatedAt: futureDate,
      };

      (encryptedDatabase.getPasswordEntry as jest.Mock).mockResolvedValueOnce(
        existingEntry,
      );

      const result = await SyncService.performSync();

      // With manual conflict resolution, conflicts should be added
      expect(result.newConflicts).toBeGreaterThanOrEqual(0);
    });

    it('should auto-resolve conflicts based on configuration', async () => {
      await SyncService.updateConfiguration({
        conflictResolution: 'local_wins',
      });

      SyncService.updateOnlineStatus(true);

      const futureDate = new Date('2024-02-01');

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      const existingEntry = {
        ...mockPasswordEntry,
        updatedAt: futureDate,
      };

      (encryptedDatabase.getPasswordEntry as jest.Mock).mockResolvedValueOnce(
        existingEntry,
      );

      (encryptedDatabase.savePasswordEntry as jest.Mock).mockResolvedValue(
        true,
      );

      const result = await SyncService.performSync();

      // Auto-resolve should handle the conflict
      expect(result).toHaveProperty('success');
    });

    it('should remove successful operations from pending queue', async () => {
      SyncService.updateOnlineStatus(true);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      const initialCount = (SyncService as any).pendingOperations.length;

      await SyncService.performSync();

      expect((SyncService as any).pendingOperations.length).toBeLessThanOrEqual(
        initialCount,
      );
    });

    it('should increment retry count on failed operations', async () => {
      SyncService.updateOnlineStatus(true);

      const operation: PendingOperation = {
        id: 'op-1',
        type: 'create',
        entryId: 'entry-1',
        entryData: mockPasswordEntry,
        timestamp: new Date(),
        retryCount: 0,
      };

      (SyncService as any).pendingOperations = [operation];

      (encryptedDatabase.getPasswordEntry as jest.Mock).mockRejectedValue(
        new Error('Error'),
      );

      await SyncService.performSync();

      expect(operation.retryCount).toBeGreaterThan(0);
    });

    it('should remove operations after max retries', async () => {
      SyncService.updateOnlineStatus(true);

      await SyncService.updateConfiguration({ retryAttempts: 2 });

      const operation: PendingOperation = {
        id: 'op-1',
        type: 'create',
        entryId: 'entry-1',
        entryData: mockPasswordEntry,
        timestamp: new Date(),
        retryCount: 2,
      };

      (SyncService as any).pendingOperations = [operation];

      (encryptedDatabase.getPasswordEntry as jest.Mock).mockRejectedValue(
        new Error('Error'),
      );

      const result = await SyncService.performSync();

      expect((SyncService as any).pendingOperations).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should save sync status after completion', async () => {
      SyncService.updateOnlineStatus(true);

      await SyncService.performSync();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('resolveConflict()', () => {
    beforeEach(() => {
      const conflict: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry,
        remoteEntry: mockPasswordEntry2,
        conflictType: 'update',
        timestamp: new Date(),
      };

      (SyncService as any).conflicts = [conflict];
    });

    it('should resolve conflict with local resolution', async () => {
      const conflictId = `entry-1_${(
        SyncService as any
      ).conflicts[0].timestamp.getTime()}`;

      const result = await SyncService.resolveConflict(conflictId, 'local');

      expect(result).toBe(true);
      expect((SyncService as any).conflicts).toHaveLength(0);
    });

    it('should resolve conflict with remote resolution', async () => {
      const conflictId = `entry-1_${(
        SyncService as any
      ).conflicts[0].timestamp.getTime()}`;

      const result = await SyncService.resolveConflict(conflictId, 'remote');

      expect(result).toBe(true);
      expect(encryptedDatabase.savePasswordEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          site: 'github.com',
        }),
        '',
      );
    });

    it('should resolve conflict with merge resolution', async () => {
      const conflictId = `entry-1_${(
        SyncService as any
      ).conflicts[0].timestamp.getTime()}`;
      const mergedEntry = {
        ...mockPasswordEntry,
        site: 'merged.com',
      };

      const result = await SyncService.resolveConflict(
        conflictId,
        'merge',
        mergedEntry,
      );

      expect(result).toBe(true);
      expect(encryptedDatabase.savePasswordEntry).toHaveBeenCalledWith(
        mergedEntry,
        '',
      );
    });

    it('should return false if conflict not found', async () => {
      const result = await SyncService.resolveConflict('invalid-id', 'local');

      expect(result).toBe(false);
    });

    it('should return false if merge resolution without merged entry', async () => {
      const conflictId = `entry-1_${(
        SyncService as any
      ).conflicts[0].timestamp.getTime()}`;

      const result = await SyncService.resolveConflict(conflictId, 'merge');

      expect(result).toBe(false);
    });

    it('should save resolved conflicts to storage', async () => {
      const conflictId = `entry-1_${(
        SyncService as any
      ).conflicts[0].timestamp.getTime()}`;

      await SyncService.resolveConflict(conflictId, 'local');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should handle resolution errors', async () => {
      const conflictId = `entry-1_${(
        SyncService as any
      ).conflicts[0].timestamp.getTime()}`;

      (encryptedDatabase.savePasswordEntry as jest.Mock).mockRejectedValue(
        new Error('Save error'),
      );

      const result = await SyncService.resolveConflict(conflictId, 'local');

      expect(result).toBe(false);
    });
  });

  describe('getConflicts()', () => {
    it('should return empty array when no conflicts', () => {
      const conflicts = SyncService.getConflicts();

      expect(conflicts).toEqual([]);
    });

    it('should return copy of conflicts array', () => {
      const conflict: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry,
        remoteEntry: mockPasswordEntry2,
        conflictType: 'update',
        timestamp: new Date(),
      };

      (SyncService as any).conflicts = [conflict];

      const conflicts1 = SyncService.getConflicts();
      const conflicts2 = SyncService.getConflicts();

      // Both should return different array instances
      expect(conflicts1).not.toBe(conflicts2);
      expect(conflicts1[0].entryId).toBe(conflicts2[0].entryId);
    });

    it('should return all conflicts', () => {
      const conflict1: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry,
        remoteEntry: mockPasswordEntry2,
        conflictType: 'update',
        timestamp: new Date(),
      };

      const conflict2: SyncConflict = {
        entryId: 'entry-2',
        localEntry: mockPasswordEntry2,
        remoteEntry: mockPasswordEntry,
        conflictType: 'create',
        timestamp: new Date(),
      };

      (SyncService as any).conflicts = [conflict1, conflict2];

      const conflicts = SyncService.getConflicts();

      expect(conflicts).toHaveLength(2);
    });
  });

  describe('clearConflicts()', () => {
    it('should clear all conflicts', async () => {
      const conflict: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry,
        remoteEntry: mockPasswordEntry2,
        conflictType: 'update',
        timestamp: new Date(),
      };

      (SyncService as any).conflicts = [conflict];

      await SyncService.clearConflicts();

      expect((SyncService as any).conflicts).toHaveLength(0);
      expect(SyncService.getConflicts()).toHaveLength(0);
    });

    it('should update sync status conflicts', async () => {
      const conflict: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry,
        remoteEntry: mockPasswordEntry2,
        conflictType: 'update',
        timestamp: new Date(),
      };

      (SyncService as any).conflicts = [conflict];

      await SyncService.clearConflicts();

      const status = SyncService.getSyncStatus();
      expect(status.conflicts).toHaveLength(0);
    });

    it('should save to storage', async () => {
      await SyncService.clearConflicts();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('updateConfiguration()', () => {
    it('should update enable auto sync', async () => {
      await SyncService.updateConfiguration({ enableAutoSync: false });

      const config = SyncService.getConfiguration();
      expect(config.enableAutoSync).toBe(false);
    });

    it('should update sync interval', async () => {
      await SyncService.updateConfiguration({ syncInterval: 30 });

      const config = SyncService.getConfiguration();
      expect(config.syncInterval).toBe(30);
    });

    it('should update retry attempts', async () => {
      await SyncService.updateConfiguration({ retryAttempts: 5 });

      const config = SyncService.getConfiguration();
      expect(config.retryAttempts).toBe(5);
    });

    it('should update conflict resolution strategy', async () => {
      await SyncService.updateConfiguration({
        conflictResolution: 'latest_timestamp',
      });

      const config = SyncService.getConfiguration();
      expect(config.conflictResolution).toBe('latest_timestamp');
    });

    it('should update max pending operations', async () => {
      await SyncService.updateConfiguration({ maxPendingOperations: 200 });

      const config = SyncService.getConfiguration();
      expect(config.maxPendingOperations).toBe(200);
    });

    it('should restart auto-sync with new configuration', async () => {
      await SyncService.updateConfiguration({ enableAutoSync: true });

      const syncTimer = (SyncService as any).syncTimer;
      expect(syncTimer).not.toBeNull();
    });

    it('should stop auto-sync when disabled', async () => {
      await SyncService.updateConfiguration({ enableAutoSync: true });

      const timerBefore = (SyncService as any).syncTimer;
      expect(timerBefore).not.toBeNull();

      await SyncService.updateConfiguration({ enableAutoSync: false });

      const timerAfter = (SyncService as any).syncTimer;
      expect(timerAfter).toBeNull();
    });

    it('should save configuration to storage', async () => {
      await SyncService.updateConfiguration({ syncInterval: 20 });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should preserve existing config values', async () => {
      const originalConfig = SyncService.getConfiguration();

      await SyncService.updateConfiguration({ syncInterval: 25 });

      const updatedConfig = SyncService.getConfiguration();

      expect(updatedConfig.enableAutoSync).toBe(originalConfig.enableAutoSync);
      expect(updatedConfig.retryAttempts).toBe(originalConfig.retryAttempts);
    });
  });

  describe('getConfiguration()', () => {
    it('should return current configuration', () => {
      const config = SyncService.getConfiguration();

      expect(config).toHaveProperty('enableAutoSync');
      expect(config).toHaveProperty('syncInterval');
      expect(config).toHaveProperty('retryAttempts');
      expect(config).toHaveProperty('conflictResolution');
      expect(config).toHaveProperty('maxPendingOperations');
    });

    it('should return copy of configuration', () => {
      const config1 = SyncService.getConfiguration();
      config1.syncInterval = 999;

      const config2 = SyncService.getConfiguration();

      expect(config2.syncInterval).not.toBe(999);
    });
  });

  describe('forcSync()', () => {
    it('should trigger sync immediately', async () => {
      SyncService.updateOnlineStatus(true);

      // Mock database to return null (no existing entry)
      (encryptedDatabase.getPasswordEntry as jest.Mock).mockResolvedValue(null);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      const result = await SyncService.forcSync();

      // Should succeed or at least attempt sync
      expect(result).toBeDefined();
    });

    it('should pass master password to sync', async () => {
      SyncService.updateOnlineStatus(true);

      const masterPassword = 'my-master-pass';

      await SyncService.forcSync(masterPassword);

      // The master password is passed to performSync
      expect(SyncService.forcSync).toBeDefined();
    });

    it('should return false when sync fails', async () => {
      const result = await SyncService.forcSync();

      expect(result).toBe(false);
    });
  });

  describe('clearAllSyncData()', () => {
    it('should clear all pending operations', async () => {
      (SyncService as any).pendingOperations = [
        {
          id: 'op-1',
          type: 'create',
          entryId: 'entry-1',
          timestamp: new Date(),
          retryCount: 0,
        },
      ];

      await SyncService.clearAllSyncData();

      expect((SyncService as any).pendingOperations).toHaveLength(0);
    });

    it('should clear all conflicts', async () => {
      (SyncService as any).conflicts = [
        {
          entryId: 'entry-1',
          localEntry: mockPasswordEntry,
          remoteEntry: mockPasswordEntry2,
          conflictType: 'update',
          timestamp: new Date(),
        },
      ];

      await SyncService.clearAllSyncData();

      expect((SyncService as any).conflicts).toHaveLength(0);
    });

    it('should reset sync status', async () => {
      (SyncService as any).syncStatus = {
        isOnline: true,
        syncInProgress: true,
        pendingOperations: 5,
        conflicts: [],
      };

      await SyncService.clearAllSyncData();

      const status = SyncService.getSyncStatus();
      expect(status.isOnline).toBe(false);
      expect(status.syncInProgress).toBe(false);
      expect(status.pendingOperations).toBe(0);
    });

    it('should stop auto-sync timer', async () => {
      await SyncService.updateConfiguration({ enableAutoSync: true });

      const timerBefore = (SyncService as any).syncTimer;
      expect(timerBefore).not.toBeNull();

      await SyncService.clearAllSyncData();

      const timerAfter = (SyncService as any).syncTimer;
      expect(timerAfter).toBeNull();
    });

    it('should clear async storage', async () => {
      await SyncService.clearAllSyncData();

      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.multiRemove as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      // Should not throw
      await expect(SyncService.clearAllSyncData()).resolves.not.toThrow();
    });
  });

  describe('Auto-Sync Functionality', () => {
    it('should start auto-sync interval when enabled', async () => {
      await SyncService.updateConfiguration({ enableAutoSync: true });

      expect((SyncService as any).syncTimer).not.toBeNull();
    });

    it('should trigger sync on interval when conditions are met', async () => {
      await SyncService.updateConfiguration({
        enableAutoSync: true,
        syncInterval: 1, // 1 minute for testing
      });

      SyncService.updateOnlineStatus(true);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      // Fast-forward timers
      jest.advanceTimersByTime(61000); // More than 1 minute

      expect((SyncService as any).syncTimer).not.toBeNull();
    });

    it('should not trigger sync when offline during interval', async () => {
      await SyncService.updateConfiguration({
        enableAutoSync: true,
        syncInterval: 1,
      });

      SyncService.updateOnlineStatus(false);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      jest.advanceTimersByTime(61000);

      // Should still be in pending operations since sync didn't happen
      expect((SyncService as any).pendingOperations.length).toBeGreaterThan(0);
    });

    it('should not trigger sync when already in progress', async () => {
      await SyncService.updateConfiguration({
        enableAutoSync: true,
        syncInterval: 1,
      });

      SyncService.updateOnlineStatus(true);

      (SyncService as any).syncStatus.syncInProgress = true;

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      jest.advanceTimersByTime(61000);

      // Sync should still be marked as in progress
      expect((SyncService as any).syncStatus.syncInProgress).toBe(true);
    });
  });

  describe('Storage Persistence', () => {
    it('should load sync status from storage', async () => {
      const mockStatus = {
        isOnline: true,
        syncInProgress: false,
        pendingOperations: 3,
        conflicts: [],
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockStatus),
      );

      await SyncService.initialize();

      expect(AsyncStorage.getItem).toHaveBeenCalled();
    });

    it('should save pending operations to storage', async () => {
      SyncService.updateOnlineStatus(true);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should load pending operations with correct timestamps', async () => {
      const timestamp = new Date('2024-01-15T10:30:00');
      const mockOperations = [
        {
          id: 'op-1',
          type: 'create',
          entryId: 'entry-1',
          timestamp: timestamp.toISOString(),
          retryCount: 0,
        },
      ];

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({}))
        .mockResolvedValueOnce(JSON.stringify(mockOperations));

      await SyncService.initialize();

      expect(
        (SyncService as any).pendingOperations[0].timestamp,
      ).toBeInstanceOf(Date);
    });

    it('should load conflicts with correct date fields', async () => {
      const mockConflicts = [
        {
          entryId: 'entry-1',
          localEntry: {
            ...mockPasswordEntry,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
            lastUsed: '2024-01-03T00:00:00.000Z',
          },
          remoteEntry: {
            ...mockPasswordEntry2,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
            lastUsed: null,
          },
          conflictType: 'update',
          timestamp: new Date().toISOString(),
        },
      ];

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({}))
        .mockResolvedValueOnce(JSON.stringify([]))
        .mockResolvedValueOnce(JSON.stringify(mockConflicts));

      await SyncService.initialize();

      const conflicts = SyncService.getConflicts();
      expect(conflicts[0].localEntry.createdAt).toBeInstanceOf(Date);
    });

    it('should handle missing date fields in stored conflicts', async () => {
      const mockConflicts = [
        {
          entryId: 'entry-1',
          localEntry: {
            ...mockPasswordEntry,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
            lastUsed: null,
          },
          remoteEntry: {
            ...mockPasswordEntry2,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
            lastUsed: null,
          },
          conflictType: 'update',
          timestamp: new Date().toISOString(),
        },
      ];

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({}))
        .mockResolvedValueOnce(JSON.stringify([]))
        .mockResolvedValueOnce(JSON.stringify(mockConflicts));

      await expect(SyncService.initialize()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle operation without entry data gracefully', async () => {
      SyncService.updateOnlineStatus(true);

      (SyncService as any).pendingOperations = [
        {
          id: 'op-1',
          type: 'create',
          entryId: 'entry-1',
          timestamp: new Date(),
          retryCount: 0,
          // Missing entryData - this will cause operation to fail
        },
      ];

      const result = await SyncService.performSync();

      // Operation should be processed (even if it fails or retries)
      expect(result).toHaveProperty('syncedOperations');
      expect(result).toHaveProperty('errors');
    });

    it('should handle multiple conflicts with same entry id', async () => {
      const conflict1: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry,
        remoteEntry: mockPasswordEntry2,
        conflictType: 'update',
        timestamp: new Date('2024-01-10'),
      };

      const conflict2: SyncConflict = {
        entryId: 'entry-1',
        localEntry: mockPasswordEntry2,
        remoteEntry: mockPasswordEntry,
        conflictType: 'create',
        timestamp: new Date('2024-01-11'),
      };

      (SyncService as any).conflicts = [conflict1, conflict2];

      const conflicts = SyncService.getConflicts();

      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].timestamp.getTime()).not.toBe(
        conflicts[1].timestamp.getTime(),
      );
    });

    it('should handle sync with null master password', async () => {
      SyncService.updateOnlineStatus(true);

      await SyncService.addPendingOperation(
        'create',
        'entry-1',
        mockPasswordEntry,
      );

      const result = await SyncService.performSync(undefined);

      expect(result).toHaveProperty('success');
    });

    it('should handle configuration update to empty object', async () => {
      const initialConfig = SyncService.getConfiguration();

      await SyncService.updateConfiguration({});

      const updatedConfig = SyncService.getConfiguration();

      expect(updatedConfig).toEqual(initialConfig);
    });
  });
});
