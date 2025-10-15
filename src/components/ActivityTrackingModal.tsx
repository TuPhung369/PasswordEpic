import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  ModalProps,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { UserActivityService } from '../services/userActivityService';

/**
 * ActivityTrackingModal - A wrapper around React Native Modal that tracks user activity
 *
 * This component ensures that interactions within modals are properly tracked for
 * session management and auto-lock functionality.
 *
 * @example
 * ```tsx
 * <ActivityTrackingModal visible={isVisible} onRequestClose={handleClose}>
 *   <View>
 *     <Text>Modal Content</Text>
 *   </View>
 * </ActivityTrackingModal>
 * ```
 */
export const ActivityTrackingModal: React.FC<ModalProps> = ({
  children,
  visible,
  onShow,
  onRequestClose,
  ...props
}) => {
  const activityService = UserActivityService.getInstance();

  // Track activity when modal becomes visible
  useEffect(() => {
    if (visible) {
      activityService.recordUserInteraction();
    }
  }, [visible, activityService]);

  const handleShow = useCallback(
    (event: any) => {
      // Record activity when modal is shown
      activityService.recordUserInteraction();
      onShow?.(event);
    },
    [onShow, activityService],
  );

  const handleRequestClose = useCallback(
    (event: any) => {
      // Record activity when modal is closed
      activityService.recordUserInteraction();
      onRequestClose?.(event);
    },
    [onRequestClose, activityService],
  );

  // Wrap children in a touchable container to track any touches inside the modal
  const wrappedChildren = (
    <TouchableWithoutFeedback
      onPress={() => {
        // Record activity on any touch inside modal
        activityService.recordUserInteraction();
      }}
    >
      <View style={styles.modalContainer} pointerEvents="box-none">
        {children}
      </View>
    </TouchableWithoutFeedback>
  );

  return (
    <Modal
      {...props}
      visible={visible}
      onShow={handleShow}
      onRequestClose={handleRequestClose}
    >
      {wrappedChildren}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
});

export default ActivityTrackingModal;
