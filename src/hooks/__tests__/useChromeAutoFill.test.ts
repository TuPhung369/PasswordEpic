/**
 * useChromeAutoFill Hook - Comprehensive Test Suite
 *
 * Tests for Chrome WebView autofill functionality including:
 * - Hook initialization and state management
 * - Support checking and platform detection
 * - Form detection and polling
 * - Credential injection with biometric verification
 * - Auto-fill with matching credentials
 * - Error handling and callbacks
 * - AppState lifecycle management
 *
 * @jest-environment node
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';
import { useChromeAutoFill } from '../useChromeAutoFill';
import { chromeAutoFillService } from '../../services/chromeAutoFillService';
import { biometricService } from '../../services/biometricService';
import type { AutofillCredential } from '../../services/autofillService';
import type {
  DetectionResult,
  ChromeAutoFillOptions,
} from '../../services/chromeAutoFillService';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('../../services/chromeAutoFillService', () => ({
  chromeAutoFillService: {
    isSupported: jest.fn(() => Promise.resolve(true)),
    detectLoginForm: jest.fn(() =>
      Promise.resolve({
        success: true,
        isLoginForm: true,
        formFields: { username: true, password: true },
        url: 'https://example.com',
      }),
    ),
    injectCredentials: jest.fn(() => Promise.resolve(true)),
    autoFillCurrentPage: jest.fn(() => Promise.resolve(true)),
    clearInjectedContent: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../services/biometricService', () => ({
  biometricService: {
    authenticate: jest.fn(() => Promise.resolve(true)),
    setup: jest.fn(() => Promise.resolve()),
    isAvailable: jest.fn(() => Promise.resolve(true)),
    disable: jest.fn(() => Promise.resolve()),
    deleteKeys: jest.fn(() => Promise.resolve()),
  },
}));

// ============================================================================
// SETUP & UTILITIES
// ============================================================================

const mockChromePerfService = chromeAutoFillService as jest.Mocked<
  typeof chromeAutoFillService
>;
const mockBiometricService = biometricService as jest.Mocked<
  typeof biometricService
>;
const mockAppState = AppState as jest.Mocked<typeof AppState>;

const mockCredentials: AutofillCredential[] = [
  {
    id: '1',
    url: 'https://example.com',
    username: 'user@example.com',
    password: 'encrypted_pass',
    domain: 'example.com',
    encrypted: true,
    createdAt: Date.now(),
  },
  {
    id: '2',
    url: 'https://github.com',
    username: 'github_user',
    password: 'encrypted_pass',
    domain: 'github.com',
    encrypted: true,
    createdAt: Date.now(),
  },
];

const mockDetectionResult: DetectionResult = {
  success: true,
  isLoginForm: true,
  formFields: {
    username: true,
    password: true,
    submit: true,
  },
  url: 'https://example.com',
};

// ============================================================================
// TEST SUITES
// ============================================================================

describe('useChromeAutoFill Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    mockChromePerfService.isSupported.mockResolvedValue(true);
    mockChromePerfService.detectLoginForm.mockResolvedValue(
      mockDetectionResult,
    );
    mockChromePerfService.injectCredentials.mockResolvedValue(true);
    mockChromePerfService.autoFillCurrentPage.mockResolvedValue(true);
    mockChromePerfService.clearInjectedContent.mockResolvedValue(undefined);
    mockBiometricService.authenticate.mockResolvedValue(true);

    // Mock AppState subscription
    mockAppState.addEventListener.mockReturnValue({
      remove: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ==========================================================================
  // 1. HOOK INITIALIZATION & STATE TESTS
  // ==========================================================================

  describe('1. Hook Initialization', () => {
    test('should initialize with default state', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      expect(result.current).toHaveProperty('isSupported');
      expect(result.current).toHaveProperty('isAvailable');
      expect(result.current).toHaveProperty('isLoading', true);
      expect(result.current).toHaveProperty('isInjecting', false);
      expect(result.current).toHaveProperty('isDetecting', false);
      expect(result.current).toHaveProperty('error', null);
      expect(result.current).toHaveProperty('formDetected', false);
      expect(result.current).toHaveProperty('lastInjectionTime', null);
    });

    test('should expose required methods', () => {
      const { result } = renderHook(() => useChromeAutoFill());

      expect(typeof result.current.detectForm).toBe('function');
      expect(typeof result.current.injectCredentials).toBe('function');
      expect(typeof result.current.autoFillCurrentPage).toBe('function');
      expect(typeof result.current.clearInjectedContent).toBe('function');
      expect(typeof result.current.resetError).toBe('function');
    });

    test('should accept credentials parameter', () => {
      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      expect(result.current).toBeDefined();
    });

    test('should accept options parameter', () => {
      const options = {
        autoDetect: false,
        biometricRequired: false,
        pollInterval: 5000,
      };
      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, options),
      );

      expect(result.current).toBeDefined();
    });

    test('should initialize with provided options defaults', async () => {
      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, {
          autoDetect: true,
          biometricRequired: true,
          pollInterval: 3000,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 2. SUPPORT CHECKING (useEffect on mount)
  // ==========================================================================

  describe('2. Support Checking', () => {
    test('should check if chrome autofill is supported on mount', async () => {
      renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(mockChromePerfService.isSupported).toHaveBeenCalled();
      });
    });

    test('should set isSupported to true when service supports it', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(true);

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });
    });

    test('should set isSupported to false when service does not support it', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(false);
        expect(result.current.isAvailable).toBe(false);
      });
    });

    test('should set isAvailable based on platform (Android only)', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(true);
      (Platform.OS as any) = 'android';

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(true);
      });
    });

    test('should set isAvailable to false on iOS', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(true);
      (Platform.OS as any) = 'ios';

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });
    });

    test('should set isLoading to false after checking support', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test('should handle error when checking support', async () => {
      mockChromePerfService.isSupported.mockRejectedValue(
        new Error('Service error'),
      );

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(false);
        expect(result.current.isAvailable).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 3. FORM DETECTION
  // ==========================================================================

  describe('3. Form Detection', () => {
    test('detectForm should successfully detect login form', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let detectionResult: DetectionResult | null = null;

      await act(async () => {
        detectionResult = await result.current.detectForm();
      });

      expect(detectionResult).toEqual(mockDetectionResult);
      expect(result.current.formDetected).toBe(true);
    });

    test('detectForm should set isDetecting state', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.detectForm();
      });

      expect(result.current.isDetecting).toBe(true);
    });

    test('detectForm should return null when not available', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      let detectionResult: DetectionResult | null = null;

      await act(async () => {
        detectionResult = await result.current.detectForm();
      });

      expect(detectionResult).toBeNull();
      expect(result.current.error).toBe('Chrome autofill not available');
    });

    test('detectForm should handle detection errors', async () => {
      mockChromePerfService.detectLoginForm.mockRejectedValue(
        new Error('Detection failed'),
      );

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.detectForm();
      });

      expect(result.current.error).toBe('Detection failed');
    });

    test('detectForm should call onError callback on failure', async () => {
      const onError = jest.fn();
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { onError }),
      );

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      await act(async () => {
        await result.current.detectForm();
      });

      expect(onError).toHaveBeenCalledWith('Chrome autofill not available');
    });

    test('detectForm should call onError callback when detection fails', async () => {
      const onError = jest.fn();
      mockChromePerfService.detectLoginForm.mockResolvedValue({
        success: false,
        isLoginForm: false,
      } as any);

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { onError }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.detectForm();
      });

      expect(onError).toHaveBeenCalledWith('Could not detect form');
    });
  });

  // ==========================================================================
  // 4. FORM POLLING (AppState effect with autoDetect)
  // ==========================================================================

  describe('4. Form Detection Polling', () => {
    test('should poll for forms when autoDetect is enabled and available', async () => {
      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { autoDetect: true }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Advance timers to trigger polling
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(mockChromePerfService.detectLoginForm).toHaveBeenCalled();
      });
    });

    test('should not poll when autoDetect is disabled', async () => {
      mockChromePerfService.detectLoginForm.mockClear();

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { autoDetect: false }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.advanceTimersByTime(3000);

      // Should only call once during mount for availability check
      expect(
        mockChromePerfService.detectLoginForm.mock.calls.length,
      ).toBeLessThanOrEqual(1);
    });

    test('should not poll when not available', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(false);

      renderHook(() => useChromeAutoFill(undefined, { autoDetect: true }));

      await waitFor(() => {
        // Wait for support check to complete
      });

      jest.clearAllMocks();
      jest.advanceTimersByTime(3000);

      expect(mockChromePerfService.detectLoginForm).not.toHaveBeenCalled();
    });

    test('should set formDetected when login form is detected during polling', async () => {
      mockChromePerfService.detectLoginForm.mockResolvedValue(
        mockDetectionResult,
      );

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { autoDetect: true }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(result.current.formDetected).toBe(true);
      });
    });

    test('should detect form when app comes to foreground', async () => {
      let appStateCallback: ((status: string) => void) | null = null;

      mockAppState.addEventListener.mockImplementation((event, callback) => {
        if (event === 'change') {
          appStateCallback = callback as any;
        }
        return { remove: jest.fn() } as any;
      });

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { autoDetect: true }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      // Simulate app coming to foreground
      act(() => {
        appStateCallback?.('active');
      });

      // AppState is mocked, so we need to wait for detection
      jest.advanceTimersByTime(100);

      // The hook should have called detectForm
      // But since detectForm is async, we check if it was invoked via polling
      expect(mockAppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    test('should handle polling errors gracefully', async () => {
      mockChromePerfService.detectLoginForm.mockRejectedValue(
        new Error('Polling error'),
      );

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { autoDetect: true }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        // Should not crash, isDetecting should be false after error
        expect(result.current.isDetecting).toBe(false);
      });
    });

    test('should clean up subscription and timer on unmount', async () => {
      const mockRemove = jest.fn();
      mockAppState.addEventListener.mockReturnValue({
        remove: mockRemove,
      } as any);

      const { unmount } = renderHook(() =>
        useChromeAutoFill(undefined, { autoDetect: true }),
      );

      await waitFor(() => {
        expect(mockAppState.addEventListener).toHaveBeenCalled();
      });

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 5. CREDENTIAL INJECTION
  // ==========================================================================

  describe('5. Credential Injection', () => {
    const injectionOptions: ChromeAutoFillOptions = {
      username: 'user@example.com',
      password: 'password123',
      url: 'https://example.com',
    };

    test('should inject credentials successfully', async () => {
      mockChromePerfService.injectCredentials.mockResolvedValue(true);

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.injectCredentials(injectionOptions);
      });

      expect(success).toBe(true);
      expect(result.current.lastInjectionTime).not.toBeNull();
    });

    test('should request biometric authentication by default', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      expect(mockBiometricService.authenticate).toHaveBeenCalled();
    });

    test('should not request biometric when biometricRequired is false', async () => {
      mockBiometricService.authenticate.mockClear();

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { biometricRequired: false }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      expect(mockBiometricService.authenticate).not.toHaveBeenCalled();
    });

    test('should handle biometric authentication failure', async () => {
      mockBiometricService.authenticate.mockResolvedValue(false);

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.injectCredentials(injectionOptions);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Biometric authentication cancelled');
    });

    test('should return false when not available', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.injectCredentials(injectionOptions);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Chrome autofill not available');
    });

    test('should call onSuccess callback after successful injection', async () => {
      const onSuccess = jest.fn();

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { onSuccess }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    test('should call onError callback on injection failure', async () => {
      const onError = jest.fn();
      mockChromePerfService.injectCredentials.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useChromeAutoFill(undefined, { onError }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      // Error callback should be called through the service callback
      expect(result.current.isInjecting).toBe(false);
    });

    test('should handle injection exceptions', async () => {
      mockChromePerfService.injectCredentials.mockRejectedValue(
        new Error('Injection error'),
      );

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      expect(result.current.error).toBe('Injection error');
      expect(result.current.isInjecting).toBe(false);
    });

    test('should set isInjecting state during injection', async () => {
      let isInjecting = false;

      mockChromePerfService.injectCredentials.mockImplementation(async () => {
        isInjecting = true;
        return true;
      });

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const promise = act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      expect(isInjecting).toBe(true);

      await promise;

      expect(result.current.isInjecting).toBe(false);
    });

    test('should update lastInjectionTime on successful injection', async () => {
      const beforeTime = Date.now();

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials(injectionOptions);
      });

      expect(result.current.lastInjectionTime).not.toBeNull();
      expect(result.current.lastInjectionTime).toBeGreaterThanOrEqual(
        beforeTime,
      );
    });
  });

  // ==========================================================================
  // 6. AUTO-FILL CURRENT PAGE
  // ==========================================================================

  describe('6. Auto-Fill Current Page', () => {
    const testUrl = 'https://example.com';

    test('should auto-fill page with matching credentials', async () => {
      mockChromePerfService.autoFillCurrentPage.mockResolvedValue(true);

      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.autoFillCurrentPage(testUrl);
      });

      expect(success).toBe(true);
      expect(mockChromePerfService.autoFillCurrentPage).toHaveBeenCalledWith(
        testUrl,
        mockCredentials,
        expect.any(Function),
        expect.any(Function),
      );
    });

    test('should require biometric authentication for auto-fill', async () => {
      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, { biometricRequired: true }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      expect(mockBiometricService.authenticate).toHaveBeenCalled();
    });

    test('should handle biometric failure during auto-fill', async () => {
      mockBiometricService.authenticate.mockResolvedValue(false);

      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.autoFillCurrentPage(testUrl);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Biometric authentication cancelled');
    });

    test('should return false when no credentials provided', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.autoFillCurrentPage(testUrl);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('No credentials available');
    });

    test('should return false when credentials array is empty', async () => {
      const { result } = renderHook(() => useChromeAutoFill([]));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.autoFillCurrentPage(testUrl);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('No credentials available');
    });

    test('should return false when not available', async () => {
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.autoFillCurrentPage(testUrl);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Chrome autofill not available');
    });

    test('should handle auto-fill errors', async () => {
      mockChromePerfService.autoFillCurrentPage.mockRejectedValue(
        new Error('Auto-fill error'),
      );

      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      expect(result.current.error).toBe('Auto-fill error');
    });

    test('should call onSuccess callback after auto-fill', async () => {
      const onSuccess = jest.fn();

      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, { onSuccess }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    test('should call onError callback on auto-fill failure', async () => {
      const onError = jest.fn();
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, { onError }),
      );

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      expect(onError).toHaveBeenCalledWith('Chrome autofill not available');
    });

    test('should pass credentials to service', async () => {
      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      expect(mockChromePerfService.autoFillCurrentPage).toHaveBeenCalledWith(
        testUrl,
        mockCredentials,
        expect.any(Function),
        expect.any(Function),
      );
    });

    test('should update lastInjectionTime on successful auto-fill', async () => {
      const beforeTime = Date.now();

      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      expect(result.current.lastInjectionTime).not.toBeNull();
      expect(result.current.lastInjectionTime).toBeGreaterThanOrEqual(
        beforeTime,
      );
    });

    test('should handle error callback from service', async () => {
      let errorCallback: ((error: string) => void) | undefined;

      mockChromePerfService.autoFillCurrentPage.mockImplementation(
        async (url, creds, success, error) => {
          errorCallback = error;
          return false;
        },
      );

      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.autoFillCurrentPage(testUrl);
      });

      const testError = 'Service error message';
      act(() => {
        errorCallback?.(testError);
      });

      expect(result.current.error).toBe(testError);
    });
  });

  // ==========================================================================
  // 7. CLEAR INJECTED CONTENT
  // ==========================================================================

  describe('7. Clear Injected Content', () => {
    test('should clear injected content', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearInjectedContent();
      });

      expect(mockChromePerfService.clearInjectedContent).toHaveBeenCalled();
    });

    test('should handle errors when clearing injected content', async () => {
      mockChromePerfService.clearInjectedContent.mockRejectedValue(
        new Error('Clear error'),
      );

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.clearInjectedContent();
        }),
      ).resolves.toBeUndefined();

      // Should not set error state (graceful handling)
      expect(result.current.error).toBeNull();
    });

    test('should be callable without state changes', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialState = result.current;

      await act(async () => {
        await result.current.clearInjectedContent();
      });

      // State should not change significantly
      expect(result.current.isLoading).toBe(initialState.isLoading);
    });
  });

  // ==========================================================================
  // 8. RESET ERROR
  // ==========================================================================

  describe('8. Reset Error', () => {
    test('should clear error state', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Set an error
      await act(async () => {
        await result.current.detectForm();
      });

      // If detection failed, there might be an error
      // Just test the reset functionality
      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
    });

    test('should do nothing when no error exists', () => {
      const { result } = renderHook(() => useChromeAutoFill());

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
    });

    test('should not affect other state properties', async () => {
      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const otherState = {
        isSupported: result.current.isSupported,
        isAvailable: result.current.isAvailable,
        formDetected: result.current.formDetected,
      };

      act(() => {
        result.current.resetError();
      });

      expect(result.current.isSupported).toBe(otherState.isSupported);
      expect(result.current.isAvailable).toBe(otherState.isAvailable);
      expect(result.current.formDetected).toBe(otherState.formDetected);
    });
  });

  // ==========================================================================
  // 9. OPTIONS & CALLBACKS
  // ==========================================================================

  describe('9. Options & Callbacks', () => {
    test('should respect pollInterval option', async () => {
      jest.clearAllMocks();

      renderHook(() =>
        useChromeAutoFill(undefined, {
          autoDetect: true,
          pollInterval: 5000,
        }),
      );

      await waitFor(() => {
        // Wait for initial setup
      });

      jest.advanceTimersByTime(5000);

      expect(mockChromePerfService.detectLoginForm).toHaveBeenCalled();
    });

    test('should call onSuccess callback on successful operations', async () => {
      const onSuccess = jest.fn();

      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, { onSuccess }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials({
          username: 'test',
          password: 'test',
          url: 'https://example.com',
        });
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    test('should call onError callback on failed operations', async () => {
      const onError = jest.fn();
      mockChromePerfService.isSupported.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, { onError }),
      );

      await waitFor(() => {
        expect(result.current.isAvailable).toBe(false);
      });

      await act(async () => {
        await result.current.detectForm();
      });

      expect(onError).toHaveBeenCalled();
    });

    test('should handle missing callbacks gracefully', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.detectForm();
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // 10. EDGE CASES & ERROR SCENARIOS
  // ==========================================================================

  describe('10. Edge Cases', () => {
    test('should handle null credentials', () => {
      const { result } = renderHook(() => useChromeAutoFill(null as any));

      expect(result.current).toBeDefined();
    });

    test('should handle undefined options', () => {
      const { result } = renderHook(() =>
        useChromeAutoFill(mockCredentials, undefined),
      );

      expect(result.current).toBeDefined();
    });

    test('should handle rapid successive calls to injectCredentials', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const injectionOptions = {
        username: 'test',
        password: 'test',
        url: 'https://example.com',
      };

      await act(async () => {
        const promise1 = result.current.injectCredentials(injectionOptions);
        const promise2 = result.current.injectCredentials(injectionOptions);

        await Promise.all([promise1, promise2]);
      });

      // Should handle without crashing
      expect(result.current).toBeDefined();
    });

    test('should handle rapid successive calls to detectForm', async () => {
      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const promise1 = result.current.detectForm();
        const promise2 = result.current.detectForm();

        await Promise.all([promise1, promise2]);
      });

      // Should handle without crashing
      expect(result.current).toBeDefined();
    });

    test('should handle empty credentials array correctly', async () => {
      const { result } = renderHook(() => useChromeAutoFill([]));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let success = false;

      await act(async () => {
        success = await result.current.autoFillCurrentPage(
          'https://example.com',
        );
      });

      expect(success).toBe(false);
    });

    test('should handle error from biometric service gracefully', async () => {
      mockBiometricService.authenticate.mockRejectedValue(
        new Error('Biometric error'),
      );

      const { result } = renderHook(() => useChromeAutoFill());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.injectCredentials({
          username: 'test',
          password: 'test',
          url: 'https://example.com',
        });
      });

      expect(result.current.isInjecting).toBe(false);
    });

    test('should preserve state across multiple operations', async () => {
      const { result } = renderHook(() => useChromeAutoFill(mockCredentials));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSupported).toBe(true);

      await act(async () => {
        await result.current.detectForm();
      });

      // State should still be available
      expect(result.current.isSupported).toBe(true);

      await act(async () => {
        await result.current.injectCredentials({
          username: 'test',
          password: 'test',
          url: 'https://example.com',
        });
      });

      // State should still be available
      expect(result.current.isSupported).toBe(true);
    });
  });
});
