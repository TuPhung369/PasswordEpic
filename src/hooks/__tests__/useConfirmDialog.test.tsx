import { renderHook, act } from '@testing-library/react-native';
import { useConfirmDialog, ConfirmDialogConfig } from '../useConfirmDialog';

describe('useConfirmDialog', () => {
  // ============================================================================
  // SUITE 1: Hook Initialization
  // ============================================================================

  describe('Hook Initialization', () => {
    test('should initialize with default state', () => {
      const { result } = renderHook(() => useConfirmDialog());

      expect(result.current.confirmDialog).toEqual({
        visible: false,
        title: '',
        message: '',
        onConfirm: expect.any(Function),
      });
    });

    test('should expose all required methods', () => {
      const { result } = renderHook(() => useConfirmDialog());

      expect(typeof result.current.showConfirm).toBe('function');
      expect(typeof result.current.hideConfirm).toBe('function');
      expect(typeof result.current.showAlert).toBe('function');
      expect(typeof result.current.showDestructive).toBe('function');
      expect(result.current.confirmDialog).toBeDefined();
    });

    test('should return consistent hook instance', () => {
      const { result, rerender } = renderHook(() => useConfirmDialog());

      const firstInstance = result.current;
      rerender();
      const secondInstance = result.current;

      // Methods should be accessible (though not identical due to re-renders)
      expect(typeof secondInstance.showConfirm).toBe('function');
      expect(typeof secondInstance.hideConfirm).toBe('function');
    });
  });

  // ============================================================================
  // SUITE 2: showConfirm Function
  // ============================================================================

  describe('showConfirm Function', () => {
    test('should show dialog with provided config', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      act(() => {
        result.current.showConfirm({
          title: 'Confirm Delete',
          message: 'Are you sure?',
          confirmText: 'Yes',
          onConfirm: mockCallback,
        });
      });

      expect(result.current.confirmDialog).toEqual({
        visible: true,
        title: 'Confirm Delete',
        message: 'Are you sure?',
        confirmText: 'Yes',
        onConfirm: mockCallback,
      });
    });

    test('should show dialog with minimal config', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      act(() => {
        result.current.showConfirm({
          title: 'Warning',
          message: 'Something happened',
          onConfirm: mockCallback,
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);
      expect(result.current.confirmDialog.title).toBe('Warning');
      expect(result.current.confirmDialog.message).toBe('Something happened');
      expect(result.current.confirmDialog.onConfirm).toBe(mockCallback);
      expect(result.current.confirmDialog.confirmText).toBeUndefined();
    });

    test('should update visible state to true', () => {
      const { result } = renderHook(() => useConfirmDialog());

      expect(result.current.confirmDialog.visible).toBe(false);

      act(() => {
        result.current.showConfirm({
          title: 'Test',
          message: 'Test message',
          onConfirm: () => {},
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);
    });

    test('should preserve config with empty strings', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showConfirm({
          title: '',
          message: '',
          confirmText: '',
          onConfirm: () => {},
        });
      });

      expect(result.current.confirmDialog.title).toBe('');
      expect(result.current.confirmDialog.message).toBe('');
      expect(result.current.confirmDialog.confirmText).toBe('');
    });

    test('should allow setting confirmStyle through config', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showConfirm({
          title: 'Delete',
          message: 'Permanently delete?',
          onConfirm: () => {},
          confirmStyle: 'destructive',
        });
      });

      expect(result.current.confirmDialog.confirmStyle).toBe('destructive');
    });
  });

  // ============================================================================
  // SUITE 3: hideConfirm Function
  // ============================================================================

  describe('hideConfirm Function', () => {
    test('should hide visible dialog', () => {
      const { result } = renderHook(() => useConfirmDialog());

      // Show dialog first
      act(() => {
        result.current.showConfirm({
          title: 'Test',
          message: 'Test message',
          onConfirm: () => {},
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);

      // Hide dialog
      act(() => {
        result.current.hideConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
    });

    test('should preserve other dialog config when hiding', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      // Show dialog with config
      act(() => {
        result.current.showConfirm({
          title: 'Original Title',
          message: 'Original Message',
          confirmText: 'Confirm',
          onConfirm: mockCallback,
          confirmStyle: 'default',
        });
      });

      // Hide dialog
      act(() => {
        result.current.hideConfirm();
      });

      // Config should be preserved
      expect(result.current.confirmDialog.title).toBe('Original Title');
      expect(result.current.confirmDialog.message).toBe('Original Message');
      expect(result.current.confirmDialog.confirmText).toBe('Confirm');
      expect(result.current.confirmDialog.onConfirm).toBe(mockCallback);
      expect(result.current.confirmDialog.confirmStyle).toBe('default');
    });

    test('should be callable on already hidden dialog', () => {
      const { result } = renderHook(() => useConfirmDialog());

      // Dialog is already hidden by default
      expect(result.current.confirmDialog.visible).toBe(false);

      // Calling hide on already hidden dialog should not throw
      expect(() => {
        act(() => {
          result.current.hideConfirm();
        });
      }).not.toThrow();

      expect(result.current.confirmDialog.visible).toBe(false);
    });
  });

  // ============================================================================
  // SUITE 4: showAlert Function
  // ============================================================================

  describe('showAlert Function', () => {
    test('should show alert with title and message', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('Alert Title', 'Alert Message');
      });

      expect(result.current.confirmDialog).toMatchObject({
        visible: true,
        title: 'Alert Title',
        message: 'Alert Message',
        confirmText: 'OK',
        confirmStyle: 'default',
      });
    });

    test('should use default confirmText when not provided', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('Title', 'Message');
      });

      expect(result.current.confirmDialog.confirmText).toBe('OK');
    });

    test('should use custom confirmText when provided', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('Title', 'Message', 'Got It');
      });

      expect(result.current.confirmDialog.confirmText).toBe('Got It');
    });

    test('should set confirmStyle to default', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('Title', 'Message');
      });

      expect(result.current.confirmDialog.confirmStyle).toBe('default');
    });

    test('should set onConfirm callback to hideConfirm', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('Title', 'Message');
      });

      // The onConfirm should be hideConfirm (dialog should hide when alert confirmed)
      expect(typeof result.current.confirmDialog.onConfirm).toBe('function');

      // Verify calling onConfirm hides the dialog
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
    });

    test('should handle empty strings in alert', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('', '', '');
      });

      expect(result.current.confirmDialog.title).toBe('');
      expect(result.current.confirmDialog.message).toBe('');
      expect(result.current.confirmDialog.confirmText).toBe('');
    });
  });

  // ============================================================================
  // SUITE 5: showDestructive Function
  // ============================================================================

  describe('showDestructive Function', () => {
    test('should show destructive dialog with required params', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      act(() => {
        result.current.showDestructive(
          'Delete Account',
          'This action cannot be undone',
          mockCallback,
        );
      });

      expect(result.current.confirmDialog).toMatchObject({
        visible: true,
        title: 'Delete Account',
        message: 'This action cannot be undone',
        confirmText: 'Delete',
        confirmStyle: 'destructive',
      });
    });

    test('should use custom confirmText for destructive dialog', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showDestructive('Delete', 'Sure?', () => {}, 'Remove');
      });

      expect(result.current.confirmDialog.confirmText).toBe('Remove');
    });

    test('should use default confirmText when not provided', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showDestructive('Delete', 'Sure?', () => {});
      });

      expect(result.current.confirmDialog.confirmText).toBe('Delete');
    });

    test('should set confirmStyle to destructive', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showDestructive('Delete', 'Sure?', () => {});
      });

      expect(result.current.confirmDialog.confirmStyle).toBe('destructive');
    });

    test('should hide dialog before calling user callback', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      act(() => {
        result.current.showDestructive('Delete', 'Sure?', mockCallback);
      });

      expect(result.current.confirmDialog.visible).toBe(true);

      // Call the onConfirm callback
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      // Dialog should be hidden
      expect(result.current.confirmDialog.visible).toBe(false);
      // User callback should be called after hiding
      expect(mockCallback).toHaveBeenCalled();
    });

    test('should call user callback exactly once when confirmed', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      act(() => {
        result.current.showDestructive('Delete', 'Sure?', mockCallback);
      });

      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // SUITE 6: State Updates & Callbacks
  // ============================================================================

  describe('State Updates & Callbacks', () => {
    test('should call onConfirm callback when showConfirm is used', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const mockCallback = jest.fn();

      act(() => {
        result.current.showConfirm({
          title: 'Confirm',
          message: 'Proceed?',
          onConfirm: mockCallback,
        });
      });

      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    test('should allow multiple dialog sequences', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      // First dialog
      act(() => {
        result.current.showConfirm({
          title: 'First',
          message: 'First message',
          onConfirm: callback1,
        });
      });

      expect(result.current.confirmDialog.title).toBe('First');

      // Hide it
      act(() => {
        result.current.hideConfirm();
      });

      // Show second dialog
      act(() => {
        result.current.showConfirm({
          title: 'Second',
          message: 'Second message',
          onConfirm: callback2,
        });
      });

      expect(result.current.confirmDialog.title).toBe('Second');
      expect(result.current.confirmDialog.visible).toBe(true);
    });

    test('should handle rapid consecutive calls', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showAlert('First', 'First message');
        result.current.showAlert('Second', 'Second message');
        result.current.showAlert('Third', 'Third message');
      });

      // Last call wins
      expect(result.current.confirmDialog.title).toBe('Third');
      expect(result.current.confirmDialog.message).toBe('Third message');
    });
  });

  // ============================================================================
  // SUITE 7: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle very long strings', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const longString = 'a'.repeat(1000);

      act(() => {
        result.current.showConfirm({
          title: longString,
          message: longString,
          onConfirm: () => {},
        });
      });

      expect(result.current.confirmDialog.title).toBe(longString);
      expect(result.current.confirmDialog.message).toBe(longString);
    });

    test('should handle special characters in strings', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const specialString = '™®©€¥£¢¤§¶†‡•';

      act(() => {
        result.current.showAlert(specialString, specialString);
      });

      expect(result.current.confirmDialog.title).toBe(specialString);
      expect(result.current.confirmDialog.message).toBe(specialString);
    });

    test('should handle null-like callback behavior', () => {
      const { result } = renderHook(() => useConfirmDialog());

      act(() => {
        result.current.showConfirm({
          title: 'Test',
          message: 'Test',
          onConfirm: () => {},
        });
      });

      // Callback should be callable without throwing
      expect(() => {
        act(() => {
          result.current.confirmDialog.onConfirm();
        });
      }).not.toThrow();
    });

    test('should handle showDestructive with empty callback', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const emptyCallback = () => {};

      act(() => {
        result.current.showDestructive('Delete', 'Sure?', emptyCallback);
      });

      expect(() => {
        act(() => {
          result.current.confirmDialog.onConfirm();
        });
      }).not.toThrow();
    });

    test('should handle mixed function calls sequence', () => {
      const { result } = renderHook(() => useConfirmDialog());

      // Mix different function calls
      act(() => {
        result.current.showAlert('Alert', 'Message 1');
      });

      expect(result.current.confirmDialog.confirmStyle).toBe('default');

      act(() => {
        result.current.showDestructive('Delete', 'Message 2', () => {});
      });

      expect(result.current.confirmDialog.confirmStyle).toBe('destructive');

      act(() => {
        result.current.hideConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);

      act(() => {
        result.current.showConfirm({
          title: 'Confirm',
          message: 'Message 3',
          onConfirm: () => {},
          confirmStyle: 'default',
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 8: Type Safety & Interface Validation
  // ============================================================================

  describe('Type Safety & Interface Validation', () => {
    test('should maintain ConfirmDialogConfig interface', () => {
      const { result } = renderHook(() => useConfirmDialog());

      const config: ConfirmDialogConfig = {
        visible: true,
        title: 'Test',
        message: 'Test message',
        onConfirm: () => {},
        confirmText: 'OK',
        confirmStyle: 'default',
      };

      act(() => {
        result.current.showConfirm(config);
      });

      // Should have all properties after showConfirm
      expect(result.current.confirmDialog).toHaveProperty('visible');
      expect(result.current.confirmDialog).toHaveProperty('title');
      expect(result.current.confirmDialog).toHaveProperty('message');
      expect(result.current.confirmDialog).toHaveProperty('onConfirm');
    });

    test('should accept Omit<ConfirmDialogConfig, visible> for showConfirm', () => {
      const { result } = renderHook(() => useConfirmDialog());

      // This should not require 'visible' property
      act(() => {
        result.current.showConfirm({
          title: 'Title',
          message: 'Message',
          onConfirm: () => {},
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 9: Integration Scenarios
  // ============================================================================

  describe('Integration Scenarios', () => {
    test('should handle confirmation workflow', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const onConfirmed = jest.fn();

      // 1. Show confirmation dialog
      act(() => {
        result.current.showConfirm({
          title: 'Delete Item',
          message: 'Are you sure you want to delete?',
          confirmText: 'Delete',
          onConfirm: onConfirmed,
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);

      // 2. User confirms
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(onConfirmed).toHaveBeenCalled();
    });

    test('should handle alert-and-dismiss workflow', () => {
      const { result } = renderHook(() => useConfirmDialog());

      // 1. Show alert
      act(() => {
        result.current.showAlert('Success', 'Operation completed successfully');
      });

      expect(result.current.confirmDialog.visible).toBe(true);
      expect(result.current.confirmDialog.confirmStyle).toBe('default');

      // 2. User dismisses (onConfirm auto-hides for alerts)
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
    });

    test('should handle destructive action workflow', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const onDelete = jest.fn();

      // 1. Show destructive dialog
      act(() => {
        result.current.showDestructive(
          'Delete Account',
          'This cannot be undone. All data will be permanently removed.',
          onDelete,
          'Yes, Delete',
        );
      });

      expect(result.current.confirmDialog.visible).toBe(true);
      expect(result.current.confirmDialog.confirmStyle).toBe('destructive');

      // 2. Dialog should auto-hide and call callback on confirm
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
      expect(onDelete).toHaveBeenCalled();
    });

    test('should support manual dialog management', () => {
      const { result } = renderHook(() => useConfirmDialog());
      const userCallback = jest.fn();

      // 1. Show dialog
      act(() => {
        result.current.showConfirm({
          title: 'Question',
          message: 'Do you want to continue?',
          onConfirm: userCallback,
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);

      // 2. User can manually hide without confirming
      act(() => {
        result.current.hideConfirm();
      });

      expect(result.current.confirmDialog.visible).toBe(false);
      expect(userCallback).not.toHaveBeenCalled();

      // 3. Show again
      act(() => {
        result.current.showConfirm({
          title: 'Question',
          message: 'Do you want to continue?',
          onConfirm: userCallback,
        });
      });

      expect(result.current.confirmDialog.visible).toBe(true);

      // 4. Now confirm
      act(() => {
        result.current.confirmDialog.onConfirm();
      });

      expect(userCallback).toHaveBeenCalled();
    });
  });
});
