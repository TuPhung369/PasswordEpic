import { useState, useEffect, useCallback, useRef } from 'react';
import { PanResponder } from 'react-native';
import {
  UserActivityService,
  UserActivityConfig,
  ActivityInfo,
} from '../services/userActivityService';

export interface UseUserActivityReturn {
  activityInfo: ActivityInfo;
  isUserActive: boolean;
  timeUntilAutoLock: number;
  recordInteraction: () => void;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  updateConfig: (config: Partial<UserActivityConfig>) => Promise<void>;
  panResponder: any; // PanResponder for capturing touches
}

export const useUserActivity = (
  onAutoLock?: () => void,
  initialConfig?: Partial<UserActivityConfig>,
): UseUserActivityReturn => {
  const [activityInfo, setActivityInfo] = useState<ActivityInfo>({
    lastUserInteraction: Date.now(),
    lastAppState: 'active',
    isUserActive: true,
    timeUntilAutoLock: 0,
  });

  const activityServiceRef = useRef<UserActivityService | undefined>(undefined);
  const onAutoLockRef = useRef(onAutoLock);

  // Update callback ref when it changes
  useEffect(() => {
    onAutoLockRef.current = onAutoLock;
  }, [onAutoLock]);

  // Initialize activity service
  useEffect(() => {
    const initializeService = async () => {
      try {
        const service = UserActivityService.getInstance();
        activityServiceRef.current = service;

        await service.initialize();

        if (initialConfig) {
          await service.updateConfig(initialConfig);
        }

        // Subscribe to activity changes
        const unsubscribe = service.subscribe((info: ActivityInfo) => {
          setActivityInfo(info);

          // Only trigger auto-lock callback when explicitly requested (shouldLock = true)
          // This prevents triggering on every activity info update
          if (info.shouldLock && onAutoLockRef.current) {
            // console.log('🎯 useUserActivity: Triggering auto-lock callback');
            onAutoLockRef.current();
          }
        });

        // Start tracking
        await service.startTracking();

        // Get initial activity info
        const initialInfo = service.getActivityInfo();
        setActivityInfo(initialInfo);

        // Cleanup on unmount
        return () => {
          unsubscribe();
          service.stopTracking();
        };
      } catch (error) {
        console.error('Failed to initialize user activity service:', error);
      }
    };

    const cleanupPromise = initializeService();

    return () => {
      cleanupPromise.then(cleanup => {
        if (cleanup) cleanup();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - initialConfig is only used for initial setup

  // Record user interaction
  const recordInteraction = useCallback(async () => {
    try {
      const service = activityServiceRef.current;
      if (service) {
        await service.recordUserInteraction();
      }
    } catch (error) {
      console.error('Failed to record user interaction:', error);
    }
  }, []);

  // Start tracking
  const startTracking = useCallback(async () => {
    try {
      const service = activityServiceRef.current;
      if (service) {
        await service.startTracking();
      }
    } catch (error) {
      console.error('Failed to start tracking:', error);
    }
  }, []);

  // Stop tracking
  const stopTracking = useCallback(() => {
    try {
      const service = activityServiceRef.current;
      if (service) {
        service.stopTracking();
      }
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  }, []);

  // Update config
  const updateConfig = useCallback(
    async (config: Partial<UserActivityConfig>) => {
      try {
        const service = activityServiceRef.current;
        if (service) {
          await service.updateConfig(config);
        }
      } catch (error) {
        console.error('Failed to update activity config:', error);
      }
    },
    [],
  );

  // Create PanResponder to capture all touch events
  // This will capture touches even when child components handle them
  const panResponder = useRef(
    PanResponder.create({
      // CRITICAL: Return true here to capture ALL touches, even on child components
      onStartShouldSetPanResponderCapture: () => {
        // Record interaction on touch start
        // The service has debounce logic to prevent excessive calls
        // console.log('🎯 PanResponder: Touch detected (capture phase)');
        recordInteraction();
        return false; // Don't actually capture - let children handle the touch
      },
      onStartShouldSetPanResponder: () => {
        // This is called after children have a chance to handle the touch
        // Record interaction here as well for touches not handled by children
        // console.log('🎯 PanResponder: Touch detected (bubble phase)');
        recordInteraction();
        return false; // Don't capture the gesture - let children handle it
      },
      onMoveShouldSetPanResponderCapture: () => {
        // Don't record on move to reduce calls
        return false;
      },
      onMoveShouldSetPanResponder: () => {
        // Don't record on move check to reduce calls
        return false; // Don't capture the gesture
      },
      onPanResponderGrant: () => {
        // Touch started - already handled by onStartShouldSetPanResponder
        // No need to record again
      },
      onPanResponderMove: () => {
        // Don't record on every move to reduce excessive calls
        // The initial touch is enough to reset the timer
      },
      onPanResponderRelease: () => {
        // Don't record on release to reduce calls
        // The initial touch already reset the timer
      },
    }),
  ).current;

  return {
    activityInfo,
    isUserActive: activityInfo.isUserActive,
    timeUntilAutoLock: activityInfo.timeUntilAutoLock,
    recordInteraction,
    startTracking,
    stopTracking,
    updateConfig,
    panResponder,
  };
};
