import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationState } from '@react-navigation/native';

/**
 * Service to persist and restore navigation state
 * This ensures users return to the exact screen they were on after app lock/unlock
 */
export class NavigationPersistenceService {
  private static instance: NavigationPersistenceService;
  private static readonly NAVIGATION_STATE_KEY = 'navigation_state';
  private static readonly SHOULD_RESTORE_KEY = 'should_restore_navigation';
  private static readonly RESTORE_TRIGGER_KEY = 'navigation_restore_trigger';

  private constructor() {}

  public static getInstance(): NavigationPersistenceService {
    if (!NavigationPersistenceService.instance) {
      NavigationPersistenceService.instance =
        new NavigationPersistenceService();
    }
    return NavigationPersistenceService.instance;
  }

  /**
   * Save the current navigation state
   */
  public async saveNavigationState(
    state: NavigationState | undefined,
  ): Promise<void> {
    try {
      if (!state) {
        console.log('🗺️ No navigation state to save');
        return;
      }

      const stateJson = JSON.stringify(state);
      await AsyncStorage.setItem(
        NavigationPersistenceService.NAVIGATION_STATE_KEY,
        stateJson,
      );
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🗺️ [${timestamp}] Navigation state saved successfully`);
    } catch (error) {
      console.error('Failed to save navigation state:', error);
    }
  }

  /**
   * Get the saved navigation state
   */
  public async getNavigationState(): Promise<NavigationState | undefined> {
    try {
      const stateJson = await AsyncStorage.getItem(
        NavigationPersistenceService.NAVIGATION_STATE_KEY,
      );

      if (!stateJson) {
        console.log('🗺️ No saved navigation state found');
        return undefined;
      }

      const state = JSON.parse(stateJson) as NavigationState;
      console.log('🗺️ Navigation state retrieved successfully');
      return state;
    } catch (error) {
      console.error('Failed to retrieve navigation state:', error);
      return undefined;
    }
  }

  /**
   * Clear the saved navigation state
   */
  public async clearNavigationState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(
        NavigationPersistenceService.NAVIGATION_STATE_KEY,
      );
      console.log('🗺️ Navigation state cleared');
    } catch (error) {
      console.error('Failed to clear navigation state:', error);
    }
  }

  /**
   * Mark that navigation should be restored after unlock
   */
  public async markForRestore(): Promise<void> {
    try {
      // Increment trigger counter
      const currentCounter = await AsyncStorage.getItem(
        NavigationPersistenceService.RESTORE_TRIGGER_KEY,
      );
      const newCounter = String(Number(currentCounter || '0') + 1);

      await AsyncStorage.multiSet([
        [NavigationPersistenceService.SHOULD_RESTORE_KEY, 'true'],
        [NavigationPersistenceService.RESTORE_TRIGGER_KEY, newCounter],
      ]);

      console.log('🗺️ Marked for navigation restore - trigger:', newCounter);
    } catch (error) {
      console.error('Failed to mark for restore:', error);
    }
  }

  /**
   * Check if navigation should be restored
   */
  public async shouldRestore(): Promise<boolean> {
    try {
      const shouldRestore = await AsyncStorage.getItem(
        NavigationPersistenceService.SHOULD_RESTORE_KEY,
      );
      return shouldRestore === 'true';
    } catch (error) {
      console.error('Failed to check restore flag:', error);
      return false;
    }
  }

  /**
   * Get the current restore trigger value
   */
  public async getRestoreTrigger(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(
        NavigationPersistenceService.RESTORE_TRIGGER_KEY,
      );
    } catch (error) {
      console.error('Failed to get restore trigger:', error);
      return null;
    }
  }

  /**
   * Clear restore flags
   */
  public async clearRestoreFlags(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        NavigationPersistenceService.SHOULD_RESTORE_KEY,
        NavigationPersistenceService.RESTORE_TRIGGER_KEY,
      ]);
      console.log('🗺️ Restore flags cleared');
    } catch (error) {
      console.error('Failed to clear restore flags:', error);
    }
  }

  /**
   * Save form data for a specific screen
   * This allows restoring not just the screen, but also the data being entered
   */
  public async saveScreenData(screenName: string, data: any): Promise<void> {
    try {
      const key = `screen_data_${screenName}`;
      const dataJson = JSON.stringify(data);
      await AsyncStorage.setItem(key, dataJson);
      console.log(`🗺️ Screen data saved for ${screenName}`);
    } catch (error) {
      console.error(`Failed to save screen data for ${screenName}:`, error);
    }
  }

  /**
   * Get saved form data for a specific screen
   */
  public async getScreenData<T = any>(screenName: string): Promise<T | null> {
    try {
      const key = `screen_data_${screenName}`;
      const dataJson = await AsyncStorage.getItem(key);

      if (!dataJson) {
        return null;
      }

      const data = JSON.parse(dataJson) as T;
      console.log(`🗺️ Screen data retrieved for ${screenName}`);
      return data;
    } catch (error) {
      console.error(`Failed to retrieve screen data for ${screenName}:`, error);
      return null;
    }
  }

  /**
   * Clear saved form data for a specific screen
   */
  public async clearScreenData(screenName: string): Promise<void> {
    try {
      const key = `screen_data_${screenName}`;
      await AsyncStorage.removeItem(key);
      console.log(`🗺️ Screen data cleared for ${screenName}`);
    } catch (error) {
      console.error(`Failed to clear screen data for ${screenName}:`, error);
    }
  }

  /**
   * Clear all screen data
   */
  public async clearAllScreenData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const screenDataKeys = allKeys.filter(key =>
        key.startsWith('screen_data_'),
      );

      if (screenDataKeys.length > 0) {
        await AsyncStorage.multiRemove(screenDataKeys);
        console.log(`🗺️ Cleared ${screenDataKeys.length} screen data entries`);
      }
    } catch (error) {
      console.error('Failed to clear all screen data:', error);
    }
  }

  /**
   * Extract the full navigation path from navigation state
   * Returns an array of navigation steps needed to reach the active screen
   */
  public getNavigationPath(
    state: NavigationState | undefined,
  ): Array<{ screenName: string; params?: any }> | null {
    if (!state) {
      return null;
    }

    const path: Array<{ screenName: string; params?: any }> = [];

    // Recursively traverse the navigation tree
    let currentState: any = state;
    while (currentState.routes && currentState.index !== undefined) {
      const activeRoute = currentState.routes[currentState.index];

      // Add this route to the path
      path.push({
        screenName: activeRoute.name,
        params: activeRoute.params,
      });

      // Continue traversing if there's a nested state
      if (activeRoute.state) {
        currentState = activeRoute.state;
      } else {
        // Reached the leaf route
        break;
      }
    }

    return path.length > 0 ? path : null;
  }

  /**
   * Restore navigation by navigating to the saved screen
   */
  public async restoreNavigation(navigationRef: any): Promise<boolean> {
    try {
      const savedState = await this.getNavigationState();
      if (!savedState) {
        console.log('🗺️ No saved state to restore');
        return false;
      }

      console.log('🗺️ Restoring navigation from saved state');

      // Extract the full navigation path
      const path = this.getNavigationPath(savedState);
      if (!path || path.length === 0) {
        console.log('🗺️ Could not extract navigation path from saved state');
        return false;
      }

      console.log(
        '🗺️ Navigation path:',
        path.map(p => p.screenName).join(' -> '),
      );

      // Try to restore using the full navigation state first (most accurate)
      // Use setTimeout to ensure UI is ready
      setTimeout(() => {
        try {
          console.log('🗺️ Attempting to restore with full state...');

          // Option 1: Try to reset to the saved state directly (most accurate)
          try {
            navigationRef.current?.reset(savedState);
            console.log('🗺️ Navigation restored using full state reset');
            return;
          } catch (resetError) {
            console.log(
              '🗺️ Full state reset failed, trying navigation path method',
            );
          }

          // Option 2: Fallback to navigation path method
          if (path.length === 1) {
            // Simple navigation
            navigationRef.current?.navigate(path[0].screenName, path[0].params);
          } else {
            // Nested navigation - build the navigation params
            // For example: navigate('Main', { screen: 'Passwords', params: { screen: 'AddPassword' } })
            let nestedParams: any;

            // Build params from the end of the path backwards (skip the first one - it's the root)
            for (let i = path.length - 1; i >= 1; i--) {
              const current = path[i];
              if (nestedParams === undefined) {
                // Leaf screen - just use its params (if any)
                nestedParams = {
                  screen: current.screenName,
                  params: current.params,
                };
              } else {
                // Wrap the existing params
                nestedParams = {
                  screen: current.screenName,
                  params: nestedParams,
                };
              }
            }

            console.log(
              '🗺️ Built nested params:',
              JSON.stringify(nestedParams, null, 2),
            );

            // Navigate to the root with nested params
            navigationRef.current?.navigate(path[0].screenName, nestedParams);
          }

          console.log('🗺️ Navigation restored successfully using path method');
        } catch (error) {
          console.error('Failed to navigate to saved screen:', error);
        }
      }, 300);

      return true;
    } catch (error) {
      console.error('Failed to restore navigation:', error);
      return false;
    }
  }
}
