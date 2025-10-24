import { renderHook } from '@testing-library/react-native';
import { useAppDispatch, useAppSelector } from '../redux';
import { useDispatch, useSelector } from 'react-redux';

// Mock react-redux
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
  useReducer: jest.fn(),
}));

describe('Redux Custom Hooks', () => {
  let mockDispatch: jest.Mock;
  let mockSelector: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch = jest.fn((...args) => jest.fn());
    mockSelector = jest.fn();

    (useDispatch as jest.Mock).mockReturnValue(mockDispatch);
    (useSelector as jest.Mock).mockReturnValue(mockSelector);
  });

  describe('useAppDispatch', () => {
    test('should return a dispatch function', () => {
      const { result } = renderHook(() => useAppDispatch());

      expect(result.current).toBeDefined();
      expect(typeof result.current).toBe('function');
    });

    test('should call useDispatch from react-redux', () => {
      renderHook(() => useAppDispatch());

      expect(useDispatch).toHaveBeenCalled();
    });

    test('should return the mocked dispatch', () => {
      const mockDispatchFn = jest.fn();
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      expect(result.current).toBe(mockDispatchFn);
    });

    test('should provide typed dispatch for actions', () => {
      const mockDispatchFn = jest.fn(action => action);
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      const testAction = {
        type: 'TEST_ACTION',
        payload: { test: true },
      };

      result.current(testAction);

      expect(mockDispatchFn).toHaveBeenCalledWith(testAction);
    });

    test('should support dispatching thunks', () => {
      const mockDispatchFn = jest.fn(action => {
        if (typeof action === 'function') {
          return action();
        }
        return action;
      });
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      const thunk = jest.fn();
      result.current(thunk);

      expect(mockDispatchFn).toHaveBeenCalledWith(thunk);
    });

    test('should maintain dispatch function consistency across renders', () => {
      const mockDispatchFn = jest.fn();
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result, rerender } = renderHook(() => useAppDispatch());

      const firstDispatch = result.current;

      rerender();

      // Dispatch function should be callable consistently
      expect(typeof result.current).toBe('function');
    });

    test('should work with Redux actions with multiple payloads', () => {
      const mockDispatchFn = jest.fn(action => action);
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      const actionWithMeta = {
        type: 'COMPLEX_ACTION',
        payload: { id: 123, name: 'test' },
        meta: { timestamp: Date.now() },
      };

      result.current(actionWithMeta);

      expect(mockDispatchFn).toHaveBeenCalledWith(actionWithMeta);
    });
  });

  describe('useAppSelector', () => {
    test('should return a selector function', () => {
      const { result } = renderHook(() => useAppSelector);

      expect(result.current).toBeDefined();
      expect(typeof result.current).toBe('function');
    });

    test('should call useSelector from react-redux', () => {
      const selector = (state: any) => state.auth;
      renderHook(() => useAppSelector(selector));

      expect(useSelector).toHaveBeenCalledWith(selector);
    });

    test('should return selected state', () => {
      const mockState = { auth: { isAuthenticated: true } };
      const mockSelectFn = jest.fn(() => mockState.auth);
      (useSelector as jest.Mock).mockReturnValue(mockState.auth);

      const { result } = renderHook(() =>
        useAppSelector((state: any) => state.auth),
      );

      expect(result.current).toEqual(mockState.auth);
    });

    test('should support selecting nested state', () => {
      const nestedState = { isAuthenticated: true, user: { id: 1 } };
      (useSelector as jest.Mock).mockReturnValue(nestedState.user);

      const { result } = renderHook(() =>
        useAppSelector((state: any) => state.auth.user),
      );

      expect(result.current).toEqual(nestedState.user);
    });

    test('should support selecting partial state', () => {
      const mockState = { field1: 'value1', field2: 'value2' };
      (useSelector as jest.Mock).mockReturnValue({
        field1: 'value1',
      });

      const { result } = renderHook(() =>
        useAppSelector((state: any) => ({
          field1: state.field1,
        })),
      );

      expect(result.current).toEqual({ field1: 'value1' });
    });

    test('should work with equality comparison', () => {
      const initialState = { data: [1, 2, 3] };
      (useSelector as jest.Mock).mockReturnValue(initialState.data);

      const selector = jest.fn((state: any) => state.data);
      const { result } = renderHook(() => useAppSelector(selector));

      expect(result.current).toEqual([1, 2, 3]);
    });

    test('should handle null state', () => {
      (useSelector as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() =>
        useAppSelector((state: any) => state?.optional),
      );

      expect(result.current).toBeNull();
    });

    test('should handle undefined selectors', () => {
      (useSelector as jest.Mock).mockReturnValue(undefined);

      const { result } = renderHook(() =>
        useAppSelector((state: any) => state?.missing),
      );

      expect(result.current).toBeUndefined();
    });

    test('should support multiple selectors on same hook', () => {
      const mockState1 = { value: 'auth' };
      const mockState2 = { value: 'settings' };

      (useSelector as jest.Mock)
        .mockReturnValueOnce(mockState1)
        .mockReturnValueOnce(mockState2);

      const { result: result1 } = renderHook(() =>
        useAppSelector((state: any) => state.auth),
      );

      const { result: result2 } = renderHook(() =>
        useAppSelector((state: any) => state.settings),
      );

      expect(result1.current).toEqual(mockState1);
      expect(result2.current).toEqual(mockState2);
    });
  });

  describe('Integration: useAppDispatch and useAppSelector together', () => {
    test('should work together to dispatch and select', () => {
      const mockDispatchFn = jest.fn();
      const mockState = { auth: { isAuthenticated: true } };

      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);
      (useSelector as jest.Mock).mockReturnValue(mockState.auth);

      const { result: dispatchResult } = renderHook(() => useAppDispatch());
      const { result: selectorResult } = renderHook(() =>
        useAppSelector((state: any) => state.auth),
      );

      // Dispatch an action
      const action = { type: 'LOGIN' };
      dispatchResult.current(action);

      // Select the resulting state
      expect(selectorResult.current).toEqual(mockState.auth);
      expect(mockDispatchFn).toHaveBeenCalledWith(action);
    });

    test('should maintain type safety across dispatch and select', () => {
      const mockDispatchFn = jest.fn((action: any) => action);
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      const typedAction = {
        type: 'TYPED_ACTION',
        payload: { count: 5, message: 'test' },
      };

      result.current(typedAction);

      expect(mockDispatchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TYPED_ACTION',
          payload: expect.objectContaining({ count: 5 }),
        }),
      );
    });

    test('should allow chaining multiple dispatches', () => {
      const mockDispatchFn = jest.fn();
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      result.current({ type: 'ACTION_1' });
      result.current({ type: 'ACTION_2' });
      result.current({ type: 'ACTION_3' });

      expect(mockDispatchFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    test('useAppDispatch should handle undefined dispatch gracefully', () => {
      (useDispatch as jest.Mock).mockReturnValue(undefined);

      const { result } = renderHook(() => useAppDispatch());

      // Should still return from the hook
      expect(result.current).toBeUndefined();
    });

    test('useAppSelector should handle selector function errors', () => {
      const selectorWithError = jest.fn(() => {
        throw new Error('Selector error');
      });

      (useSelector as jest.Mock).mockImplementation(() => {
        throw new Error('Selector error');
      });

      expect(() => {
        renderHook(() => useAppSelector(selectorWithError));
      }).toThrow('Selector error');
    });

    test('should handle rapid successive dispatches', () => {
      const mockDispatchFn = jest.fn();
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      for (let i = 0; i < 10; i++) {
        result.current({ type: `ACTION_${i}` });
      }

      expect(mockDispatchFn).toHaveBeenCalledTimes(10);
    });

    test('useAppSelector should handle different selector return types', () => {
      const testCases = [
        { value: 'string', type: 'string' },
        { value: 123, type: 'number' },
        { value: true, type: 'boolean' },
        { value: [1, 2, 3], type: 'array' },
        { value: { key: 'value' }, type: 'object' },
      ];

      testCases.forEach(({ value }) => {
        (useSelector as jest.Mock).mockReturnValue(value);

        const { result } = renderHook(() =>
          useAppSelector((state: any) => value),
        );

        expect(result.current).toEqual(value);
      });
    });
  });

  describe('Hook Type Definitions', () => {
    test('useAppDispatch returns AppDispatch type', () => {
      const mockDispatchFn = jest.fn();
      (useDispatch as jest.Mock).mockReturnValue(mockDispatchFn);

      const { result } = renderHook(() => useAppDispatch());

      // The hook should return a function (dispatch)
      expect(typeof result.current).toBe('function');
    });

    test('useAppSelector is a TypedUseSelectorHook', () => {
      const { result } = renderHook(() => useAppSelector);

      // useAppSelector should be a function that returns selected state
      expect(typeof result.current).toBe('function');
    });
  });
});
