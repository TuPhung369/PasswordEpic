import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';

export interface AppInfo {
  name: string;
  packageName: string;
}

interface UseInstalledAppsReturn {
  apps: AppInfo[];
  loading: boolean;
  error: string | null;
  searchApps: (query: string) => Promise<AppInfo[]>;
  getAppInfo: (packageName: string) => Promise<AppInfo | null>;
  refetch: () => Promise<void>;
}

const AppUtils = NativeModules.AppUtils;

/**
 * Hook to get list of installed apps on the device
 * Only works on Android
 */
export const useInstalledApps = (): UseInstalledAppsReturn => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load installed apps - extracted to allow refetching
  const loadApps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS !== 'android') {
        setError('This feature is only available on Android');
        return;
      }

      if (!AppUtils || !AppUtils.getInstalledApps) {
        throw new Error('AppUtils native module not available');
      }

      const appList = await AppUtils.getInstalledApps(false); // excludeSystemApps = false
      // Sort apps by name for consistent UX
      const sortedApps = appList.sort((a: AppInfo, b: AppInfo) =>
        a.name.localeCompare(b.name),
      );
      setApps(sortedApps);
      console.log(`📱 Loaded ${sortedApps.length} installed apps`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Error loading installed apps:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load installed apps on mount
  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // Search apps by name or package name
  const searchApps = useCallback(
    async (query: string): Promise<AppInfo[]> => {
      try {
        if (!query.trim()) {
          return apps;
        }

        if (!AppUtils || !AppUtils.searchApps) {
          throw new Error('AppUtils native module not available');
        }

        const results = await AppUtils.searchApps(query, false);
        // Sort search results by name
        const sortedResults = results.sort((a: AppInfo, b: AppInfo) =>
          a.name.localeCompare(b.name),
        );
        console.log(
          `🔍 Search found ${sortedResults.length} apps matching '${query}'`,
        );
        return sortedResults;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('❌ Error searching apps:', errorMsg);
        throw err;
      }
    },
    [apps],
  );

  // Get info for a specific app
  const getAppInfo = useCallback(
    async (packageName: string): Promise<AppInfo | null> => {
      try {
        if (!packageName.trim()) {
          return null;
        }

        if (!AppUtils || !AppUtils.getAppInfo) {
          throw new Error('AppUtils native module not available');
        }

        const appInfo = await AppUtils.getAppInfo(packageName);
        console.log(`ℹ️ Got info for app: ${packageName}`);
        return appInfo;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `❌ Error getting app info for ${packageName}:`,
          errorMsg,
        );
        return null;
      }
    },
    [],
  );

  return { apps, loading, error, searchApps, getAppInfo, refetch: loadApps };
};
