import React, { useCallback } from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { UserActivityService } from '../services/userActivityService';

/**
 * TouchableWrapper - A wrapper around TouchableOpacity that automatically tracks user activity
 *
 * This component ensures that every touch interaction is recorded for session management
 * and auto-lock functionality. Use this instead of TouchableOpacity for better activity tracking.
 *
 * @example
 * ```tsx
 * <TouchableWrapper onPress={handlePress}>
 *   <Text>Click me</Text>
 * </TouchableWrapper>
 * ```
 */
export const TouchableWrapper: React.FC<TouchableOpacityProps> = ({
  onPress,
  onPressIn,
  children,
  ...props
}) => {
  const activityService = UserActivityService.getInstance();

  const handlePressIn = useCallback(
    (event: any) => {
      // Record user interaction immediately on press
      activityService.recordUserInteraction();

      // Call original onPressIn if provided
      onPressIn?.(event);
    },
    [onPressIn, activityService],
  );

  const handlePress = useCallback(
    (event: any) => {
      // Also record on press for redundancy
      activityService.recordUserInteraction();

      // Call original onPress if provided
      onPress?.(event);
    },
    [onPress, activityService],
  );

  return (
    <TouchableOpacity
      {...props}
      onPressIn={handlePressIn}
      onPress={handlePress}
    >
      {children}
    </TouchableOpacity>
  );
};

export default TouchableWrapper;
