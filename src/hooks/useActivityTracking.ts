import { useCallback, useRef } from 'react';
import { UserActivityService } from '../services/userActivityService';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

/**
 * Hook for tracking user activity in components
 *
 * This hook provides convenient methods to track user interactions
 * for session management and auto-lock functionality.
 *
 * @example
 * ```tsx
 * const { trackActivity, onScroll, onPress } = useActivityTracking();
 *
 * // Manual tracking
 * trackActivity();
 *
 * // Automatic tracking on scroll
 * <ScrollView onScroll={onScroll} scrollEventThrottle={400}>
 *   ...
 * </ScrollView>
 *
 * // Automatic tracking on press
 * <TouchableOpacity onPress={onPress(handleMyPress)}>
 *   ...
 * </TouchableOpacity>
 * ```
 */
export const useActivityTracking = () => {
  const activityService = UserActivityService.getInstance();
  const lastScrollTrackRef = useRef<number>(0);

  /**
   * Manually track user activity
   */
  const trackActivity = useCallback(() => {
    activityService.recordUserInteraction();
  }, [activityService]);

  /**
   * Track activity on scroll events (throttled to avoid excessive calls)
   */
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const now = Date.now();
      // Throttle scroll tracking to once per 1000ms (1 second)
      if (now - lastScrollTrackRef.current > 1000) {
        activityService.recordUserInteraction();
        lastScrollTrackRef.current = now;
      }
    },
    [activityService],
  );

  /**
   * Wrap a press handler to track activity
   *
   * @param handler - The original press handler
   * @returns A wrapped handler that tracks activity
   */
  const onPress = useCallback(
    <T extends (...args: any[]) => any>(handler?: T) => {
      return (...args: Parameters<T>) => {
        activityService.recordUserInteraction();
        return handler?.(...args);
      };
    },
    [activityService],
  );

  /**
   * Track activity on text input changes
   */
  const onTextChange = useCallback(
    (text: string, originalHandler?: (text: string) => void) => {
      activityService.recordUserInteraction();
      originalHandler?.(text);
    },
    [activityService],
  );

  /**
   * Track activity on focus events
   */
  const onFocus = useCallback(
    (originalHandler?: () => void) => {
      return () => {
        activityService.recordUserInteraction();
        originalHandler?.();
      };
    },
    [activityService],
  );

  return {
    trackActivity,
    onScroll,
    onPress,
    onTextChange,
    onFocus,
  };
};

export default useActivityTracking;
