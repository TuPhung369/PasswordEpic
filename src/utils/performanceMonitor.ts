// Performance monitoring utility for password operations
export class PasswordPerformanceMonitor {
  private static timers: Map<string, number> = new Map();

  static startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
    console.log(`⏱️ [Performance] Starting ${operation}...`);
  }

  static endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      console.warn(`⚠️ [Performance] Timer for ${operation} not found`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);

    const emoji = this.getPerformanceEmoji(duration);
    console.log(
      `${emoji} [Performance] ${operation} completed in ${duration}ms`,
    );

    return duration;
  }

  private static getPerformanceEmoji(duration: number): string {
    if (duration < 1000) return '🚀'; // < 1s - Excellent
    if (duration < 3000) return '✅'; // < 3s - Good
    if (duration < 5000) return '⚡'; // < 5s - Acceptable
    if (duration < 10000) return '🐌'; // < 10s - Slow
    return '🚫'; // > 10s - Too slow
  }

  static logBreakdown(
    operation: string,
    steps: { step: string; duration: number }[],
  ): void {
    console.log(`📊 [Performance] ${operation} breakdown:`);
    steps.forEach(({ step, duration }) => {
      const percentage =
        steps.length > 0
          ? (
              (duration / steps.reduce((a, b) => a + b.duration, 0)) *
              100
            ).toFixed(1)
          : 0;
      const emoji = this.getPerformanceEmoji(duration);
      console.log(`  ${emoji} ${step}: ${duration}ms (${percentage}%)`);
    });
  }
}
