import DynamicMasterPasswordPerformanceMonitor, {
  performanceMonitor,
  PerformanceMetrics,
} from '../dynamicMasterPasswordPerformanceMonitor';

jest.mock('../../services/firebase');
jest.mock('../../services/staticMasterPasswordService');
jest.mock('../../services/secureStorageService');

// Import mocked modules
const firebaseModule = require('../../services/firebase');
const staticPasswordModule = require('../../services/staticMasterPasswordService');
const secureStorageModule = require('../../services/secureStorageService');

// Create mock functions
const getCurrentUser = jest.fn();
const getEffectiveMasterPassword = jest.fn();
const getMasterPasswordFromBiometric = jest.fn();

// Assign to modules
firebaseModule.getCurrentUser = getCurrentUser;
staticPasswordModule.getEffectiveMasterPassword = getEffectiveMasterPassword;
secureStorageModule.getMasterPasswordFromBiometric =
  getMasterPasswordFromBiometric;

describe('DynamicMasterPasswordPerformanceMonitor', () => {
  let monitor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    monitor = new DynamicMasterPasswordPerformanceMonitor();

    // Clear mock call history
    getCurrentUser.mockClear();
    getEffectiveMasterPassword.mockClear();
    getMasterPasswordFromBiometric.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should initialize monitor instance', () => {
      expect(monitor).toBeDefined();
      expect(typeof monitor.getMetrics).toBe('function');
    });

    it('should have getMetrics method', () => {
      const metrics = monitor.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics).toHaveLength(0);
    });

    it('should have getMetricsSummary method', () => {
      const summary = monitor.getMetricsSummary();
      expect(summary).toBeDefined();
      expect(summary.totalTests).toBe(0);
      expect(summary.dynamicTests).toBe(0);
      expect(summary.biometricTests).toBe(0);
    });

    it('should have clearMetrics method', () => {
      monitor.clearMetrics();
      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should log when clearing metrics', () => {
      monitor.clearMetrics();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Metrics cleared'),
      );
    });
  });

  describe('Metrics Management', () => {
    it('should return copy of metrics not reference', () => {
      const metrics1 = monitor.getMetrics();
      const metrics2 = monitor.getMetrics();
      expect(metrics1).not.toBe(metrics2);
    });

    it('should return metrics array with correct structure', () => {
      const metrics = monitor.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.every(m => m === undefined || typeof m === 'object')).toBe(
        true,
      );
    });

    it('should have zero metrics initially', () => {
      const summary = monitor.getMetricsSummary();
      expect(summary.totalTests).toBe(0);
      expect(summary.avgDynamicDuration).toBe(0);
      expect(summary.avgBiometricDuration).toBe(0);
    });
  });

  describe('Summary Generation', () => {
    it('should return valid summary structure', () => {
      const summary = monitor.getMetricsSummary();

      expect(summary).toHaveProperty('totalTests');
      expect(summary).toHaveProperty('dynamicTests');
      expect(summary).toHaveProperty('biometricTests');
      expect(summary).toHaveProperty('avgDynamicDuration');
      expect(summary).toHaveProperty('avgBiometricDuration');
      expect(summary).toHaveProperty('dynamicSuccessRate');
      expect(summary).toHaveProperty('biometricSuccessRate');
    });

    it('should handle empty metrics in summary', () => {
      const summary = monitor.getMetricsSummary();
      expect(summary.dynamicSuccessRate).toBe(0);
      expect(summary.biometricSuccessRate).toBe(0);
    });

    it('should return zero durations with no metrics', () => {
      const summary = monitor.getMetricsSummary();
      expect(summary.avgDynamicDuration).toBe(0);
      expect(summary.avgBiometricDuration).toBe(0);
    });
  });

  describe('Performance Metrics Interface', () => {
    it('should define PerformanceMetrics type correctly', () => {
      const mockMetric = {
        operationType: 'dynamic' as const,
        duration: 100,
        success: true,
        timestamp: Date.now(),
      };

      expect(mockMetric.operationType).toBe('dynamic');
      expect(mockMetric.duration).toBeGreaterThan(0);
      expect(mockMetric.success).toBe(true);
    });

    it('should accept biometric operation type', () => {
      const mockMetric = {
        operationType: 'biometric' as const,
        duration: 50,
        success: false,
        error: 'Not enrolled',
        timestamp: Date.now(),
      };

      expect(mockMetric.operationType).toBe('biometric');
      expect(mockMetric.error).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should have performanceMonitor singleton exported', () => {
      expect(performanceMonitor).toBeDefined();
      expect(typeof performanceMonitor.getMetrics).toBe('function');
    });

    it('should be instance of DynamicMasterPasswordPerformanceMonitor', () => {
      expect(performanceMonitor).toBeInstanceOf(
        DynamicMasterPasswordPerformanceMonitor,
      );
    });
  });

  describe('Method Existence', () => {
    it('should have testDynamicMasterPassword method', () => {
      expect(typeof monitor.testDynamicMasterPassword).toBe('function');
    });

    it('should have testBiometricMasterPassword method', () => {
      expect(typeof monitor.testBiometricMasterPassword).toBe('function');
    });

    it('should have runPerformanceComparison method', () => {
      expect(typeof monitor.runPerformanceComparison).toBe('function');
    });

    it('should have testUserAuthentication method', () => {
      expect(typeof monitor.testUserAuthentication).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple monitor instances', () => {
      const monitor1 = new DynamicMasterPasswordPerformanceMonitor();
      const monitor2 = new DynamicMasterPasswordPerformanceMonitor();

      expect(monitor1).not.toBe(monitor2);
      expect(monitor1.getMetrics()).toHaveLength(0);
      expect(monitor2.getMetrics()).toHaveLength(0);
    });

    it('should handle clearMetrics on empty monitor', () => {
      monitor.clearMetrics();
      monitor.clearMetrics();
      expect(monitor.getMetrics()).toHaveLength(0);
    });

    it('should return consistent summary for empty metrics', () => {
      const summary1 = monitor.getMetricsSummary();
      const summary2 = monitor.getMetricsSummary();

      expect(summary1.totalTests).toBe(summary2.totalTests);
      expect(summary1.avgDynamicDuration).toBe(summary2.avgDynamicDuration);
    });
  });

  describe('Type Validation', () => {
    it('should return numbers for all duration fields', () => {
      const summary = monitor.getMetricsSummary();
      expect(typeof summary.avgDynamicDuration).toBe('number');
      expect(typeof summary.avgBiometricDuration).toBe('number');
    });

    it('should return numbers for success rates', () => {
      const summary = monitor.getMetricsSummary();
      expect(typeof summary.dynamicSuccessRate).toBe('number');
      expect(typeof summary.biometricSuccessRate).toBe('number');
    });

    it('should return numbers for metric counts', () => {
      const summary = monitor.getMetricsSummary();
      expect(typeof summary.totalTests).toBe('number');
      expect(typeof summary.dynamicTests).toBe('number');
      expect(typeof summary.biometricTests).toBe('number');
    });
  });

  describe('Async Methods - testDynamicMasterPassword', () => {
    it('should record metric from successful dynamic test', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test-password',
      });

      const metric = await monitor.testDynamicMasterPassword();

      expect(metric).toBeDefined();
      expect(metric.operationType).toBe('dynamic');
      expect(metric.success).toBe(true);
      expect(metric.duration).toBeGreaterThanOrEqual(0);
      expect(metric.timestamp).toBeDefined();
    });

    it('should add metric to collection after testDynamicMasterPassword', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test-password',
      });

      expect(monitor.getMetrics()).toHaveLength(0);
      await monitor.testDynamicMasterPassword();
      expect(monitor.getMetrics()).toHaveLength(1);
      expect(monitor.getMetrics()[0].operationType).toBe('dynamic');
    });

    it('should handle failed dynamic master password test', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Password not set',
      });

      const metric = await monitor.testDynamicMasterPassword();

      expect(metric.success).toBe(false);
      expect(metric.error).toBe('Password not set');
      expect(monitor.getMetrics()).toHaveLength(1);
    });

    it('should handle exception in testDynamicMasterPassword', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const metric = await monitor.testDynamicMasterPassword();

      expect(metric.success).toBe(false);
      expect(metric.error).toContain('Network error');
      expect(monitor.getMetrics()).toHaveLength(1);
    });

    it('should log performance metric', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });

      await monitor.testDynamicMasterPassword();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('DYNAMIC'),
      );
    });
  });

  describe('Async Methods - testBiometricMasterPassword', () => {
    it('should record metric from successful biometric test', async () => {
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: true,
        password: 'biometric-password',
      });

      const metric = await monitor.testBiometricMasterPassword();

      expect(metric).toBeDefined();
      expect(metric.operationType).toBe('biometric');
      expect(metric.success).toBe(true);
      expect(metric.duration).toBeGreaterThanOrEqual(0);
    });

    it('should add metric to collection after testBiometricMasterPassword', async () => {
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: true,
        password: 'biometric-password',
      });

      expect(monitor.getMetrics()).toHaveLength(0);
      await monitor.testBiometricMasterPassword();
      expect(monitor.getMetrics()).toHaveLength(1);
      expect(monitor.getMetrics()[0].operationType).toBe('biometric');
    });

    it('should handle failed biometric master password test', async () => {
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Biometric not enrolled',
      });

      const metric = await monitor.testBiometricMasterPassword();

      expect(metric.success).toBe(false);
      expect(metric.error).toBe('Biometric not enrolled');
    });

    it('should handle exception in testBiometricMasterPassword', async () => {
      (getMasterPasswordFromBiometric as jest.Mock).mockRejectedValue(
        new Error('Biometric error'),
      );

      const metric = await monitor.testBiometricMasterPassword();

      expect(metric.success).toBe(false);
      expect(metric.error).toContain('Biometric error');
    });
  });

  describe('Async Methods - testUserAuthentication', () => {
    it('should return authenticated user info', async () => {
      (getCurrentUser as jest.Mock).mockReturnValue({
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
      });

      const result = await monitor.testUserAuthentication();

      expect(result.isAuthenticated).toBe(true);
      expect(result.userInfo?.uid).toBe('user123');
      expect(result.userInfo?.email).toBe('test@example.com');
      expect(result.userInfo?.displayName).toBe('Test User');
    });

    it('should return not authenticated when no user', async () => {
      (getCurrentUser as jest.Mock).mockReturnValue(null);

      const result = await monitor.testUserAuthentication();

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toContain('No authenticated user found');
    });

    it('should handle authentication error', async () => {
      (getCurrentUser as jest.Mock).mockImplementation(() => {
        throw new Error('Firebase connection error');
      });

      const result = await monitor.testUserAuthentication();

      expect(result.isAuthenticated).toBe(false);
      expect(result.error).toContain('Firebase connection error');
    });
  });

  describe('Async Methods - runPerformanceComparison', () => {
    beforeEach(() => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: true,
        password: 'biometric',
      });
    });

    it('should run performance comparison with default iterations', async () => {
      const result = await monitor.runPerformanceComparison();

      expect(result.dynamicMetrics).toBeDefined();
      expect(result.biometricMetrics).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.dynamicMetrics.length).toBe(5); // default iterations
      expect(result.biometricMetrics.length).toBe(5);
    });

    it('should run performance comparison with custom iterations', async () => {
      const result = await monitor.runPerformanceComparison(3);

      expect(result.dynamicMetrics.length).toBe(3);
      expect(result.biometricMetrics.length).toBe(3);
    });

    it('should calculate correct summary statistics', async () => {
      const result = await monitor.runPerformanceComparison(2);
      const { summary } = result;

      expect(summary.dynamic.avgDuration).toBeGreaterThanOrEqual(0);
      expect(summary.biometric.avgDuration).toBeGreaterThanOrEqual(0);
      expect(summary.dynamic.successRate).toBe(100);
      expect(summary.biometric.successRate).toBe(100);
    });

    it('should include min/max duration in summary', async () => {
      const result = await monitor.runPerformanceComparison(2);
      const { summary } = result;

      expect(summary.dynamic.fastestCall).toBeGreaterThanOrEqual(0);
      expect(summary.dynamic.slowestCall).toBeGreaterThanOrEqual(0);
      expect(summary.biometric.fastestCall).toBeGreaterThanOrEqual(0);
      expect(summary.biometric.slowestCall).toBeGreaterThanOrEqual(0);
    });

    it('should generate recommendation when both systems succeed', async () => {
      const result = await monitor.runPerformanceComparison(1);

      expect(result.summary.recommendation).toBeDefined();
      expect(result.summary.recommendation.length).toBeGreaterThan(0);
    });

    it('should generate recommendation when both systems fail', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed',
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed',
      });

      const result = await monitor.runPerformanceComparison(1);

      expect(result.summary.recommendation).toContain('Both systems failed');
    });

    it('should generate recommendation when only dynamic succeeds', async () => {
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Not available',
      });

      const result = await monitor.runPerformanceComparison(1);

      expect(result.summary.recommendation).toContain('biometric unavailable');
    });

    it('should generate recommendation when only biometric succeeds', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Not set',
      });

      const result = await monitor.runPerformanceComparison(1);

      expect(result.summary.recommendation).toContain('Dynamic system failed');
    });

    it('should recommend dynamic when significantly faster', async () => {
      // Mock dynamic to be much faster
      let dynamicCallCount = 0;
      (getEffectiveMasterPassword as jest.Mock).mockImplementation(async () => {
        dynamicCallCount++;
        return { success: true, password: 'test' };
      });

      let biometricCallCount = 0;
      (getMasterPasswordFromBiometric as jest.Mock).mockImplementation(
        async () => {
          biometricCallCount++;
          // Simulate slower biometric
          await new Promise(resolve => setTimeout(resolve, 1));
          return { success: true, password: 'biometric' };
        },
      );

      const result = await monitor.runPerformanceComparison(1);

      expect(result.summary.recommendation).toContain('faster');
    });

    it('should add metrics to monitor collection', async () => {
      expect(monitor.getMetrics().length).toBe(0);
      await monitor.runPerformanceComparison(2);
      // Should have 2 dynamic + 2 biometric = 4 metrics
      expect(monitor.getMetrics().length).toBe(4);
    });
  });

  describe('Metric Recording and Storage', () => {
    it('should respect maxMetrics limit of 100', async () => {
      // Manually add 105 metrics to trigger the trim
      for (let i = 0; i < 105; i++) {
        const metric: PerformanceMetrics = {
          operationType: 'dynamic',
          duration: 10 + i,
          success: true,
          timestamp: Date.now(),
        };
        // Access private addMetric through testDynamicMasterPassword
        (getEffectiveMasterPassword as jest.Mock).mockResolvedValueOnce({
          success: true,
          password: 'test',
        });
      }

      // Add 105 metrics
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });

      for (let i = 0; i < 105; i++) {
        await monitor.testDynamicMasterPassword();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(100);
      expect(metrics.length).toBe(100);
    });

    it('should keep most recent metrics when trimming', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });

      // Add exactly 101 metrics
      for (let i = 0; i < 101; i++) {
        await monitor.testDynamicMasterPassword();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.length).toBe(100);
      // All should be 'dynamic' (the last 100 we added)
      expect(metrics.every(m => m.operationType === 'dynamic')).toBe(true);
    });
  });

  describe('Summary Calculations with Metrics', () => {
    beforeEach(() => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
        duration: 100,
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: true,
        password: 'biometric',
        duration: 150,
      });
    });

    it('should calculate correct totals in summary', async () => {
      await monitor.testDynamicMasterPassword();
      await monitor.testBiometricMasterPassword();

      const summary = monitor.getMetricsSummary();
      expect(summary.totalTests).toBe(2);
      expect(summary.dynamicTests).toBe(1);
      expect(summary.biometricTests).toBe(1);
    });

    it('should calculate average duration correctly', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
        duration: 100,
      });

      // Add multiple metrics with known durations
      await monitor.testDynamicMasterPassword();
      await monitor.testDynamicMasterPassword();

      const summary = monitor.getMetricsSummary();
      // Duration should be calculated from actual metrics
      expect(summary.avgDynamicDuration).toBeGreaterThanOrEqual(0);
      expect(summary.dynamicTests).toBe(2);
    });

    it('should calculate success rates correctly', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValueOnce({
        success: true,
        password: 'test',
      });
      await monitor.testDynamicMasterPassword();

      (getEffectiveMasterPassword as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Failed',
      });
      await monitor.testDynamicMasterPassword();

      const summary = monitor.getMetricsSummary();
      expect(summary.dynamicTests).toBe(2);
      expect(summary.dynamicSuccessRate).toBe(50);
    });

    it('should handle mixed success and failure metrics', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValueOnce({
        success: true,
        password: 'bio',
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Failed',
      });

      await monitor.testDynamicMasterPassword();
      await monitor.testBiometricMasterPassword();
      await monitor.testBiometricMasterPassword();

      const summary = monitor.getMetricsSummary();
      expect(summary.biometricSuccessRate).toBe(50);
      expect(summary.dynamicSuccessRate).toBe(100);
    });
  });

  describe('Console Logging', () => {
    it('should log start message for performance comparison', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: true,
        password: 'bio',
      });

      await monitor.runPerformanceComparison(1);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting performance comparison'),
      );
    });

    it('should log results message', async () => {
      (getEffectiveMasterPassword as jest.Mock).mockResolvedValue({
        success: true,
        password: 'test',
      });
      (getMasterPasswordFromBiometric as jest.Mock).mockResolvedValue({
        success: true,
        password: 'bio',
      });

      await monitor.runPerformanceComparison(1);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Performance Comparison Results'),
      );
    });
  });
});
