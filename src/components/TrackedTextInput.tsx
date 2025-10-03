import React, { useCallback } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { UserActivityService } from '../services/userActivityService';

/**
 * TextInput wrapper that automatically tracks user interaction
 * This ensures session stays active when user is typing
 */
export const TrackedTextInput = React.forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    const recordInteraction = useCallback(() => {
      const service = UserActivityService.getInstance();
      service.recordUserInteraction().catch(error => {
        console.error('Failed to record interaction from TextInput:', error);
      });
    }, []);

    return (
      <TextInput
        {...props}
        ref={ref}
        onFocus={e => {
          recordInteraction();
          props.onFocus?.(e);
        }}
        onChangeText={text => {
          recordInteraction();
          props.onChangeText?.(text);
        }}
        onKeyPress={e => {
          recordInteraction();
          props.onKeyPress?.(e);
        }}
      />
    );
  },
);

TrackedTextInput.displayName = 'TrackedTextInput';
