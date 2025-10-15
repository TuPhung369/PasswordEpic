// Performance monitor for Static Master Password
import { getCurrentUser } from '../services/firebase';
import { getEffectiveMasterPassword } from '../services/staticMasterPasswordService';
import { getMasterPasswordFromBiometric } from '../services/secureStorageService';

export interface PerformanceMetrics {
  operationType: 'dynamic' | 'biometric' | 'static';
  duration: number;
  success: boolean;
  cacheHit?: boolean;
  sessionId?: string;
  error?: string;
  timestamp: number;
}

class DynamicMasterPasswordPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // Keep last 100 measurements

  private addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);

    // Keep only the last maxMetrics measurements
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log performance summary
    console.log(
      `📊 [PerfMonitor] ${metric.operationType.toUpperCase()}: ${
        metric.duration
      }ms (${metric.success ? 'SUCCESS' : 'FAILED'})`,
    );
  }

  // Test dynamic master password performance
  async testDynamicMasterPassword(): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      const result = await getEffectiveMasterPassword();
      const duration = Date.now() - startTime;

      const metric: PerformanceMetrics = {
        operationType: 'dynamic',
        duration,
        success: result.success,
        sessionId: '',
        error: result.error,
        timestamp: Date.now(),
      };

      this.addMetric(metric);
      return metric;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const metric: PerformanceMetrics = {
        operationType: 'dynamic',
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };

      this.addMetric(metric);
      return metric;
    }
  }

  // Test biometric master password performance (legacy)
  async testBiometricMasterPassword(): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      const result = await getMasterPasswordFromBiometric();
      const duration = Date.now() - startTime;

      const metric: PerformanceMetrics = {
        operationType: 'biometric',
        duration,
        success: result.success,
        error: result.error,
        timestamp: Date.now(),
      };

      this.addMetric(metric);
      return metric;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const metric: PerformanceMetrics = {
        operationType: 'biometric',
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };

      this.addMetric(metric);
      return metric;
    }
  }

  // Run comprehensive performance comparison
  async runPerformanceComparison(iterations: number = 5): Promise<{
    dynamicMetrics: PerformanceMetrics[];
    biometricMetrics: PerformanceMetrics[];
    summary: {
      dynamic: {
        avgDuration: number;
        successRate: number;
        fastestCall: number;
        slowestCall: number;
      };
      biometric: {
        avgDuration: number;
        successRate: number;
        fastestCall: number;
        slowestCall: number;
      };
      recommendation: string;
    };
  }> {
    console.log(
      `🏁 [PerfMonitor] Starting performance comparison with ${iterations} iterations...`,
    );

    const dynamicMetrics: PerformanceMetrics[] = [];
    const biometricMetrics: PerformanceMetrics[] = [];

    // Test dynamic master password
    console.log('🔐 [PerfMonitor] Testing Dynamic Master Password...');
    for (let i = 0; i < iterations; i++) {
      const metric = await this.testDynamicMasterPassword();
      dynamicMetrics.push(metric);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test biometric master password
    console.log('👆 [PerfMonitor] Testing Biometric Master Password...');
    for (let i = 0; i < iterations; i++) {
      const metric = await this.testBiometricMasterPassword();
      biometricMetrics.push(metric);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate statistics
    const dynamicSuccessful = dynamicMetrics.filter(m => m.success);
    const biometricSuccessful = biometricMetrics.filter(m => m.success);

    const dynamicDurations = dynamicSuccessful.map(m => m.duration);
    const biometricDurations = biometricSuccessful.map(m => m.duration);

    const dynamicAvg =
      dynamicDurations.length > 0
        ? dynamicDurations.reduce((a, b) => a + b, 0) / dynamicDurations.length
        : 0;

    const biometricAvg =
      biometricDurations.length > 0
        ? biometricDurations.reduce((a, b) => a + b, 0) /
          biometricDurations.length
        : 0;

    // Generate recommendation
    let recommendation = '';
    if (dynamicSuccessful.length === 0 && biometricSuccessful.length === 0) {
      recommendation = '❌ Both systems failed - check authentication setup';
    } else if (dynamicSuccessful.length === 0) {
      recommendation = '⚠️ Dynamic system failed - fallback to biometric';
    } else if (biometricSuccessful.length === 0) {
      recommendation = '✅ Use Dynamic Master Password (biometric unavailable)';
    } else if (dynamicAvg < biometricAvg * 0.8) {
      recommendation = `✅ Use Dynamic Master Password (${(
        ((biometricAvg - dynamicAvg) / biometricAvg) *
        100
      ).toFixed(1)}% faster)`;
    } else if (biometricAvg < dynamicAvg * 0.8) {
      recommendation = `⚠️ Biometric is faster (${(
        ((dynamicAvg - biometricAvg) / dynamicAvg) *
        100
      ).toFixed(1)}% faster) - but dynamic is more secure`;
    } else {
      recommendation =
        '✅ Use Dynamic Master Password (similar performance, better security)';
    }

    const summary = {
      dynamic: {
        avgDuration: Math.round(dynamicAvg),
        successRate: Math.round(
          (dynamicSuccessful.length / dynamicMetrics.length) * 100,
        ),
        fastestCall:
          dynamicDurations.length > 0 ? Math.min(...dynamicDurations) : 0,
        slowestCall:
          dynamicDurations.length > 0 ? Math.max(...dynamicDurations) : 0,
      },
      biometric: {
        avgDuration: Math.round(biometricAvg),
        successRate: Math.round(
          (biometricSuccessful.length / biometricMetrics.length) * 100,
        ),
        fastestCall:
          biometricDurations.length > 0 ? Math.min(...biometricDurations) : 0,
        slowestCall:
          biometricDurations.length > 0 ? Math.max(...biometricDurations) : 0,
      },
      recommendation,
    };

    console.log('📊 [PerfMonitor] Performance Comparison Results:');
    console.log(
      `   Dynamic: ${summary.dynamic.avgDuration}ms avg, ${summary.dynamic.successRate}% success`,
    );
    console.log(
      `   Biometric: ${summary.biometric.avgDuration}ms avg, ${summary.biometric.successRate}% success`,
    );
    console.log(`   ${summary.recommendation}`);

    return {
      dynamicMetrics,
      biometricMetrics,
      summary,
    };
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // Get metrics summary
  getMetricsSummary(): {
    totalTests: number;
    dynamicTests: number;
    biometricTests: number;
    avgDynamicDuration: number;
    avgBiometricDuration: number;
    dynamicSuccessRate: number;
    biometricSuccessRate: number;
  } {
    const dynamicMetrics = this.metrics.filter(
      m => m.operationType === 'dynamic',
    );
    const biometricMetrics = this.metrics.filter(
      m => m.operationType === 'biometric',
    );

    const dynamicSuccessful = dynamicMetrics.filter(m => m.success);
    const biometricSuccessful = biometricMetrics.filter(m => m.success);

    const avgDynamicDuration =
      dynamicSuccessful.length > 0
        ? dynamicSuccessful.reduce((sum, m) => sum + m.duration, 0) /
          dynamicSuccessful.length
        : 0;

    const avgBiometricDuration =
      biometricSuccessful.length > 0
        ? biometricSuccessful.reduce((sum, m) => sum + m.duration, 0) /
          biometricSuccessful.length
        : 0;

    return {
      totalTests: this.metrics.length,
      dynamicTests: dynamicMetrics.length,
      biometricTests: biometricMetrics.length,
      avgDynamicDuration: Math.round(avgDynamicDuration),
      avgBiometricDuration: Math.round(avgBiometricDuration),
      dynamicSuccessRate:
        dynamicMetrics.length > 0
          ? Math.round((dynamicSuccessful.length / dynamicMetrics.length) * 100)
          : 0,
      biometricSuccessRate:
        biometricMetrics.length > 0
          ? Math.round(
              (biometricSuccessful.length / biometricMetrics.length) * 100,
            )
          : 0,
    };
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    console.log('🗑️ [PerfMonitor] Metrics cleared');
  }

  // Test user authentication status
  async testUserAuthentication(): Promise<{
    isAuthenticated: boolean;
    userInfo?: {
      uid: string;
      email: string | null;
      displayName: string | null;
    };
    error?: string;
  }> {
    try {
      const currentUser = getCurrentUser();

      if (currentUser) {
        return {
          isAuthenticated: true,
          userInfo: {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
          },
        };
      } else {
        return {
          isAuthenticated: false,
          error: 'No authenticated user found',
        };
      }
    } catch (error: any) {
      return {
        isAuthenticated: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export const performanceMonitor = new DynamicMasterPasswordPerformanceMonitor();

export default DynamicMasterPasswordPerformanceMonitor;
