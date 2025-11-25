/**
 * Performance Logger - Detects render loops and performance issues
 * 
 * Usage:
 * import { perfLogger } from '../utils/performanceLogger';
 * 
 * // In component:
 * useEffect(() => {
 *   perfLogger.logRender('ComponentName');
 * });
 */

interface RenderMetrics {
  count: number;
  lastTime: number;
  firstTime: number;
  avgTimeBetweenRenders: number;
  maxTimeBetweenRenders: number;
  minTimeBetweenRenders: number;
}

class PerformanceLogger {
  private renderCounts: Map<string, number> = new Map();
  private lastRenderTimes: Map<string, number> = new Map();
  private firstRenderTimes: Map<string, number> = new Map();
  private warningShown: Set<string> = new Set();
  private allRenderTimes: Map<string, number[]> = new Map();
  private enabled: boolean = __DEV__; // Only in development

  /**
   * Log a component render
   * Automatically detects render loops
   */
  logRender(componentName: string, additionalInfo?: string) {
    if (!this.enabled) return;

    const count = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, count);

    const now = Date.now();
    const last = this.lastRenderTimes.get(componentName) || now;
    const delta = now - last;

    // Track first render time
    if (count === 1) {
      this.firstRenderTimes.set(componentName, now);
    }

    // Track all render times for statistics
    const times = this.allRenderTimes.get(componentName) || [];
    if (count > 1) {
      times.push(delta);
    }
    this.allRenderTimes.set(componentName, times);

    // Log selectively to avoid spam
    const shouldLog = count <= 3 || count % 10 === 0 || delta < 50;
    if (shouldLog) {
      const info = additionalInfo ? ` [${additionalInfo}]` : '';
      console.log(
        `🎨 [PERF] ${componentName}${info} - Render #${count} (+${delta}ms)`,
      );
    }

    // Detect render loop
    if (count > 10 && delta < 50 && !this.warningShown.has(componentName)) {
      const avgDelta = times.reduce((a, b) => a + b, 0) / times.length;
      console.error(`⚠️ [PERF] ${componentName} - RENDER LOOP DETECTED!`);
      console.error(`   Total renders: ${count}`);
      console.error(`   Average time between renders: ${avgDelta.toFixed(2)}ms`);
      console.error(`   Last render delta: ${delta}ms`);
      console.trace('Stack trace:');
      this.warningShown.add(componentName);
    }

    this.lastRenderTimes.set(componentName, now);
  }

  /**
   * Get metrics for a component
   */
  getMetrics(componentName: string): RenderMetrics | null {
    const count = this.renderCounts.get(componentName);
    if (!count) return null;

    const times = this.allRenderTimes.get(componentName) || [];
    const lastTime = this.lastRenderTimes.get(componentName) || 0;
    const firstTime = this.firstRenderTimes.get(componentName) || 0;

    const avgTimeBetweenRenders =
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const maxTimeBetweenRenders = times.length > 0 ? Math.max(...times) : 0;
    const minTimeBetweenRenders = times.length > 0 ? Math.min(...times) : 0;

    return {
      count,
      lastTime,
      firstTime,
      avgTimeBetweenRenders,
      maxTimeBetweenRenders,
      minTimeBetweenRenders,
    };
  }

  /**
   * Print summary of all tracked components
   */
  printSummary() {
    if (!this.enabled) return;

    console.log('\n📊 ===== PERFORMANCE SUMMARY =====');
    
    const components = Array.from(this.renderCounts.keys());
    if (components.length === 0) {
      console.log('No components tracked');
      return;
    }

    // Sort by render count (descending)
    components.sort((a, b) => {
      const countA = this.renderCounts.get(a) || 0;
      const countB = this.renderCounts.get(b) || 0;
      return countB - countA;
    });

    components.forEach(name => {
      const metrics = this.getMetrics(name);
      if (!metrics) return;

      const duration = metrics.lastTime - metrics.firstTime;
      const fps = duration > 0 ? (metrics.count / duration) * 1000 : 0;

      console.log(`\n📱 ${name}:`);
      console.log(`   Renders: ${metrics.count}`);
      console.log(`   Duration: ${duration.toFixed(0)}ms`);
      console.log(`   Avg time between renders: ${metrics.avgTimeBetweenRenders.toFixed(2)}ms`);
      console.log(`   Min/Max delta: ${metrics.minTimeBetweenRenders}ms / ${metrics.maxTimeBetweenRenders}ms`);
      console.log(`   Render rate: ${fps.toFixed(2)} renders/sec`);

      if (metrics.count > 20) {
        console.warn(`   ⚠️ High render count - check for optimization`);
      }
      if (metrics.avgTimeBetweenRenders < 100) {
        console.warn(`   ⚠️ Fast re-renders - possible render loop`);
      }
    });

    console.log('\n===== END SUMMARY =====\n');
  }

  /**
   * Reset tracking for specific component or all
   */
  reset(componentName?: string) {
    if (componentName) {
      this.renderCounts.delete(componentName);
      this.lastRenderTimes.delete(componentName);
      this.firstRenderTimes.delete(componentName);
      this.warningShown.delete(componentName);
      this.allRenderTimes.delete(componentName);
      console.log(`🧹 [PERF] Reset tracking for: ${componentName}`);
    } else {
      this.renderCounts.clear();
      this.lastRenderTimes.clear();
      this.firstRenderTimes.clear();
      this.warningShown.clear();
      this.allRenderTimes.clear();
      console.log('🧹 [PERF] Reset all tracking');
    }
  }

  /**
   * Enable or disable tracking
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(`🎯 [PERF] Performance tracking ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if a component has render loop
   */
  hasRenderLoop(componentName: string, threshold: number = 20): boolean {
    const count = this.renderCounts.get(componentName) || 0;
    const times = this.allRenderTimes.get(componentName) || [];
    
    if (count < 10) return false;
    
    const avgDelta = times.length > 0 
      ? times.reduce((a, b) => a + b, 0) / times.length 
      : 0;
    
    return avgDelta < threshold;
  }

  /**
   * Get list of components with potential issues
   */
  getProblematicComponents(): string[] {
    const problematic: string[] = [];

    this.renderCounts.forEach((count, name) => {
      if (count > 20 || this.hasRenderLoop(name)) {
        problematic.push(name);
      }
    });

    return problematic;
  }
}

// Singleton instance
export const perfLogger = new PerformanceLogger();

// Expose to global for debugging in React Native Debugger
if (__DEV__ && global) {
  (global as any).perfLogger = perfLogger;
  console.log('🎯 [PERF] Performance logger available globally as window.perfLogger');
  console.log('   Commands: perfLogger.printSummary(), perfLogger.reset()');
}
