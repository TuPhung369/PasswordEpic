/**
 * useActivityTracking Hook - Comprehensive Test Suite
 *
 * Tests for user activity tracking including:
 * - Manual activity tracking
 * - Scroll event throttling (1000ms)
 * - Press handler wrapping
 * - Text change tracking
 * - Focus event tracking
 * - Callback execution order
 * - Reference stability
 *
 * @jest-environment node
 */

import { renderHook, act } from '@testing-library/react-native';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useActivityTracking } from '../useActivityTracking';
import { UserActivityService } from '../../services/userActivityService';

// ============================================================================
// MOCKS
// ============================================================================

let mockServiceInstance: any;

jest.mock('../../services/userActivityService', () => ({
  UserActivityService: {
    getInstance: jest.fn(() => mockServiceInstance),
  },
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const mockUserActivityService = () => {
  const recordUserInteraction = jest.fn();
  mockServiceInstance = { recordUserInteraction };
  return recordUserInteraction;
};

let advanceTime: (ms: number) => void;

const mockDateNow = () => {
  let currentTime = 2000; // Start at 2000ms so first scroll passes (2000 - 0 > 1000)
  jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
  advanceTime = (ms: number) => {
    currentTime += ms;
  };
};

const createScrollEvent = (
  yOffset: number = 0,
): NativeSyntheticEvent<NativeScrollEvent> => ({
  nativeEvent: {
    contentOffset: { x: 0, y: yOffset },
    contentSize: { width: 100, height: 1000 },
    layoutMeasurement: { width: 100, height: 600 },
    zoomScale: 1,
  },
});

// ============================================================================
// TEST SUITES
// ============================================================================

describe('useActivityTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockServiceInstance = null;
    jest.useFakeTimers();
    mockDateNow();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ==========================================================================
  // SUITE 1: Hook Initialization
  // ==========================================================================

  describe('Hook Initialization', () => {
    it('should return all tracking functions', () => {
      const { result } = renderHook(() => useActivityTracking());

      expect(result.current).toHaveProperty('trackActivity');
      expect(result.current).toHaveProperty('onScroll');
      expect(result.current).toHaveProperty('onPress');
      expect(result.current).toHaveProperty('onTextChange');
      expect(result.current).toHaveProperty('onFocus');

      expect(typeof result.current.trackActivity).toBe('function');
      expect(typeof result.current.onScroll).toBe('function');
      expect(typeof result.current.onPress).toBe('function');
      expect(typeof result.current.onTextChange).toBe('function');
      expect(typeof result.current.onFocus).toBe('function');
    });

    it('should maintain consistent references across renders', () => {
      const { result, rerender } = renderHook(() => useActivityTracking());

      const firstRender = {
        trackActivity: result.current.trackActivity,
        onScroll: result.current.onScroll,
        onPress: result.current.onPress,
        onTextChange: result.current.onTextChange,
        onFocus: result.current.onFocus,
      };

      rerender();

      expect(result.current.trackActivity).toBe(firstRender.trackActivity);
      expect(result.current.onScroll).toBe(firstRender.onScroll);
      expect(result.current.onPress).toBe(firstRender.onPress);
      expect(result.current.onTextChange).toBe(firstRender.onTextChange);
      expect(result.current.onFocus).toBe(firstRender.onFocus);
    });
  });

  // ==========================================================================
  // SUITE 2: trackActivity Function
  // ==========================================================================

  describe('trackActivity Function', () => {
    it('should call recordUserInteraction on trackActivity', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.trackActivity();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should call recordUserInteraction multiple times', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.trackActivity();
        result.current.trackActivity();
        result.current.trackActivity();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(3);
    });

    it('should maintain independent call counts across invocations', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.trackActivity();
      });
      expect(recordUserInteraction).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.trackActivity();
      });
      expect(recordUserInteraction).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // SUITE 3: onScroll Function (Throttling)
  // ==========================================================================

  describe('onScroll Function', () => {
    it('should track scroll event on first call (no throttle)', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onScroll(createScrollEvent(100));
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should throttle scroll events within 1000ms threshold', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onScroll(createScrollEvent(100));
        advanceTime(500); // 500ms
        result.current.onScroll(createScrollEvent(200));
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should track scroll after 1000ms throttle threshold expires', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onScroll(createScrollEvent(100));
        advanceTime(1001); // > 1000ms threshold
        result.current.onScroll(createScrollEvent(200));
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple scroll events with proper throttling', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        // First scroll at 2000ms - tracks
        result.current.onScroll(createScrollEvent(100));
        expect(recordUserInteraction).toHaveBeenCalledTimes(1);

        // Scroll at 2500ms (500ms later) - throttled, within 1000ms window
        advanceTime(500);
        result.current.onScroll(createScrollEvent(200));
        expect(recordUserInteraction).toHaveBeenCalledTimes(1);

        // Scroll at 3001ms (1001ms later) - should track, outside 1000ms window
        advanceTime(501);
        result.current.onScroll(createScrollEvent(300));
        expect(recordUserInteraction).toHaveBeenCalledTimes(2);

        // Scroll at 3500ms (499ms later from last track) - throttled
        advanceTime(499);
        result.current.onScroll(createScrollEvent(400));
        expect(recordUserInteraction).toHaveBeenCalledTimes(2);

        // Scroll at 4002ms (1001ms later from last track) - should track
        advanceTime(502);
        result.current.onScroll(createScrollEvent(500));
        expect(recordUserInteraction).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle scroll event with zero offset', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onScroll(createScrollEvent(0));
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should preserve throttle state across multiple hook instances', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result: result1 } = renderHook(() => useActivityTracking());
      const { result: result2 } = renderHook(() => useActivityTracking());

      act(() => {
        result1.current.onScroll(createScrollEvent(100));
        result2.current.onScroll(createScrollEvent(100));
      });

      // Each instance should track independently
      expect(recordUserInteraction).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // SUITE 4: onPress Function
  // ==========================================================================

  describe('onPress Function', () => {
    it('should call trackActivity and handler when both provided', () => {
      const recordUserInteraction = mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedHandler = result.current.onPress(handler);

      act(() => {
        wrappedHandler();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should call trackActivity without handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedHandler = result.current.onPress(undefined);

      act(() => {
        wrappedHandler();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to handler', () => {
      mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedHandler = result.current.onPress(handler);

      act(() => {
        wrappedHandler('arg1', 'arg2', { key: 'value' });
      });

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });

    it('should return handler result', () => {
      mockUserActivityService();
      const handler = jest.fn(() => 'result_value');
      const { result } = renderHook(() => useActivityTracking());

      const wrappedHandler = result.current.onPress(handler);

      const returnValue = wrappedHandler();

      expect(returnValue).toBe('result_value');
    });

    it('should call trackActivity before handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const callOrder: string[] = [];

      const handler = jest.fn(() => {
        callOrder.push('handler');
      });

      recordUserInteraction.mockImplementation(() => {
        callOrder.push('tracking');
      });

      const { result } = renderHook(() => useActivityTracking());
      const wrappedHandler = result.current.onPress(handler);

      act(() => {
        wrappedHandler();
      });

      expect(callOrder).toEqual(['tracking', 'handler']);
    });

    it('should handle handler that throws error', () => {
      mockUserActivityService();
      const handler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const { result } = renderHook(() => useActivityTracking());

      const wrappedHandler = result.current.onPress(handler);

      expect(() => {
        act(() => {
          wrappedHandler();
        });
      }).toThrow('Handler error');
    });

    it('should work with arrow function handlers', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedHandler = result.current.onPress((x: number) => x * 2);

      const returnValue = wrappedHandler(5);

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
      expect(returnValue).toBe(10);
    });
  });

  // ==========================================================================
  // SUITE 5: onTextChange Function
  // ==========================================================================

  describe('onTextChange Function', () => {
    it('should track activity on text change with original handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onTextChange('new_text', handler);
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('new_text');
    });

    it('should track activity on text change without original handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onTextChange('new_text');
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should pass text to original handler', () => {
      mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onTextChange('some_text', handler);
      });

      expect(handler).toHaveBeenCalledWith('some_text');
    });

    it('should track activity call before handler call', () => {
      const recordUserInteraction = mockUserActivityService();
      const callOrder: string[] = [];

      const handler = jest.fn(() => {
        callOrder.push('handler');
      });

      recordUserInteraction.mockImplementation(() => {
        callOrder.push('tracking');
      });

      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onTextChange('text', handler);
      });

      expect(callOrder).toEqual(['tracking', 'handler']);
    });

    it('should handle empty string text changes', () => {
      const recordUserInteraction = mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onTextChange('', handler);
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('');
    });
  });

  // ==========================================================================
  // SUITE 6: onFocus Function
  // ==========================================================================

  describe('onFocus Function', () => {
    it('should return a wrapped function', () => {
      mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedFocus = result.current.onFocus();

      expect(typeof wrappedFocus).toBe('function');
    });

    it('should track activity on focus with original handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedFocus = result.current.onFocus(handler);

      act(() => {
        wrappedFocus();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should track activity on focus without original handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedFocus = result.current.onFocus();

      act(() => {
        wrappedFocus();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(1);
    });

    it('should call tracking before original handler', () => {
      const recordUserInteraction = mockUserActivityService();
      const callOrder: string[] = [];

      const handler = jest.fn(() => {
        callOrder.push('handler');
      });

      recordUserInteraction.mockImplementation(() => {
        callOrder.push('tracking');
      });

      const { result } = renderHook(() => useActivityTracking());
      const wrappedFocus = result.current.onFocus(handler);

      act(() => {
        wrappedFocus();
      });

      expect(callOrder).toEqual(['tracking', 'handler']);
    });

    it('should handle multiple focus events', () => {
      const recordUserInteraction = mockUserActivityService();
      const handler = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      const wrappedFocus = result.current.onFocus(handler);

      act(() => {
        wrappedFocus();
        wrappedFocus();
        wrappedFocus();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // SUITE 7: Edge Cases & Integration
  // ==========================================================================

  describe('Edge Cases & Integration', () => {
    it('should handle mixed function sequences', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      const pressHandler = jest.fn();
      const textHandler = jest.fn();
      const focusHandler = jest.fn();

      act(() => {
        result.current.trackActivity(); // 1
        result.current.onScroll(createScrollEvent(100)); // 2
        result.current.onPress(pressHandler)(); // 3
        result.current.onTextChange('text', textHandler); // 4
        result.current.onFocus(focusHandler)(); // 5
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(5);
      expect(pressHandler).toHaveBeenCalledTimes(1);
      expect(textHandler).toHaveBeenCalledTimes(1);
      expect(focusHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid consecutive calls', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.trackActivity();
        }
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(10);
    });

    it('should maintain separate tracking for different wrapper invocations', () => {
      const recordUserInteraction = mockUserActivityService();
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const { result } = renderHook(() => useActivityTracking());

      const wrapped1 = result.current.onPress(handler1);
      const wrapped2 = result.current.onPress(handler2);

      act(() => {
        wrapped1();
        wrapped2();
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(recordUserInteraction).toHaveBeenCalledTimes(2);
    });

    it('should handle undefined/null handlers gracefully', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onTextChange('text', undefined);
        const focusWrapper = result.current.onFocus(undefined);
        focusWrapper();
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(2);
    });

    it('should preserve scroll throttle across other function calls', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      act(() => {
        result.current.onScroll(createScrollEvent(100)); // 1 - immediate
        result.current.trackActivity(); // 2 - direct call
        result.current.onScroll(createScrollEvent(200)); // should be throttled
      });

      expect(recordUserInteraction).toHaveBeenCalledTimes(2);
    });

    it('should handle complex real-world scenario', () => {
      const recordUserInteraction = mockUserActivityService();
      const { result } = renderHook(() => useActivityTracking());

      const submitHandler = jest.fn();
      const changeHandler = jest.fn();
      const focusHandler = jest.fn();

      act(() => {
        // User focuses field
        const focusWrapper = result.current.onFocus(focusHandler);
        focusWrapper();
        expect(recordUserInteraction).toHaveBeenCalledTimes(1);

        // User types
        result.current.onTextChange('test@', changeHandler);
        expect(recordUserInteraction).toHaveBeenCalledTimes(2);

        // Scroll while typing
        result.current.onScroll(createScrollEvent(100));
        expect(recordUserInteraction).toHaveBeenCalledTimes(3);

        // User submits form
        const pressWrapper = result.current.onPress(submitHandler);
        pressWrapper();
        expect(recordUserInteraction).toHaveBeenCalledTimes(4);

        // Rapid scrolls after submit (throttled)
        advanceTime(500);
        result.current.onScroll(createScrollEvent(200));
        expect(recordUserInteraction).toHaveBeenCalledTimes(4); // Still 4

        // After throttle expires
        advanceTime(501);
        result.current.onScroll(createScrollEvent(300));
        expect(recordUserInteraction).toHaveBeenCalledTimes(5);
      });

      expect(focusHandler).toHaveBeenCalledTimes(1);
      expect(changeHandler).toHaveBeenCalledWith('test@');
      expect(submitHandler).toHaveBeenCalledTimes(1);
    });

    it('should not leak references between hook instances', () => {
      mockUserActivityService();
      const { result: result1 } = renderHook(() => useActivityTracking());
      const { result: result2 } = renderHook(() => useActivityTracking());

      expect(result1.current.trackActivity).not.toBe(
        result2.current.trackActivity,
      );
      expect(result1.current.onScroll).not.toBe(result2.current.onScroll);
      expect(result1.current.onPress).not.toBe(result2.current.onPress);
    });
  });
});
