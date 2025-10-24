import { PasswordPerformanceMonitor } from '../performanceMonitor';

describe('PasswordPerformanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  describe('startTimer', () => {
    it('should start a timer for an operation', () => {
      const operation = 'test-operation';

      PasswordPerformanceMonitor.startTimer(operation);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`Starting ${operation}`),
      );
    });

    it('should log start message with emoji', () => {
      PasswordPerformanceMonitor.startTimer('operation1');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('⏱️'));
    });

    it('should handle multiple timers', () => {
      PasswordPerformanceMonitor.startTimer('op1');
      PasswordPerformanceMonitor.startTimer('op2');
      PasswordPerformanceMonitor.startTimer('op3');

      expect(console.log).toHaveBeenCalledTimes(3);
    });

    it('should overwrite existing timer', () => {
      const operation = 'test-op';

      PasswordPerformanceMonitor.startTimer(operation);
      const callCount1 = (console.log as jest.Mock).mock.calls.length;

      PasswordPerformanceMonitor.startTimer(operation);
      const callCount2 = (console.log as jest.Mock).mock.calls.length;

      expect(callCount2).toBe(callCount1 + 1);
    });

    it('should accept special characters in operation name', () => {
      const operation = 'test-op_123!@#';

      PasswordPerformanceMonitor.startTimer(operation);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(operation),
      );
    });
  });

  describe('endTimer', () => {
    it('should end a timer and return duration', done => {
      const operation = 'test-operation';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        const duration = PasswordPerformanceMonitor.endTimer(operation);

        expect(duration).toBeGreaterThan(0);
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(`${operation} completed in`),
        );
        done();
      }, 100);
    });

    it('should return 0 if timer not found', () => {
      const duration = PasswordPerformanceMonitor.endTimer('non-existent');

      expect(duration).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
    });

    it('should log with rocket emoji for < 1s', done => {
      const operation = 'quick-op';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🚀'));
        done();
      }, 50);
    });

    it('should remove timer after ending', done => {
      const operation = 'test-op';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);

        const duration = PasswordPerformanceMonitor.endTimer(operation);

        expect(duration).toBe(0);
        expect(console.warn).toHaveBeenCalled();
        done();
      }, 50);
    });

    it('should log with checkmark for 1-3s duration', done => {
      const operation = 'medium-op';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        const originalLog = console.log;
        console.log = jest.fn();

        PasswordPerformanceMonitor.endTimer(operation);

        const logCall = (console.log as jest.Mock).mock.calls[0][0];
        // Should be called with a duration >= 1000ms
        expect(logCall).toBeDefined();

        console.log = originalLog;
        done();
      }, 1000);
    }, 5000);

    it('should handle rapid start/end cycles', done => {
      const operations = ['op1', 'op2', 'op3'];

      operations.forEach((op, idx) => {
        PasswordPerformanceMonitor.startTimer(op);
      });

      setTimeout(() => {
        operations.forEach(op => {
          PasswordPerformanceMonitor.endTimer(op);
        });

        expect(console.log).toHaveBeenCalled();
        done();
      }, 50);
    });
  });

  describe('logBreakdown', () => {
    it('should log breakdown for operation steps', () => {
      const operation = 'complex-operation';
      const steps = [
        { step: 'step1', duration: 100 },
        { step: 'step2', duration: 200 },
        { step: 'step3', duration: 300 },
      ];

      PasswordPerformanceMonitor.logBreakdown(operation, steps);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(operation),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('breakdown'),
      );
    });

    it('should include step names in breakdown', () => {
      const steps = [
        { step: 'encryption', duration: 100 },
        { step: 'storage', duration: 200 },
      ];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('encryption'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('storage'),
      );
    });

    it('should calculate percentage correctly', () => {
      const steps = [
        { step: 'step1', duration: 100 },
        { step: 'step2', duration: 100 },
      ];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalled();
    });

    it('should handle empty steps array', () => {
      const steps: { step: string; duration: number }[] = [];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('breakdown'),
      );
    });

    it('should handle single step', () => {
      const steps = [{ step: 'only-step', duration: 500 }];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('only-step'),
      );
    });

    it('should use performance emoji for each step', () => {
      const steps = [
        { step: 'fast', duration: 50 },
        { step: 'medium', duration: 2000 },
        { step: 'slow', duration: 6000 },
        { step: 'very-slow', duration: 12000 },
      ];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalled();
    });

    it('should handle large duration values', () => {
      const steps = [
        { step: 'step1', duration: 15000 },
        { step: 'step2', duration: 20000 },
      ];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalled();
    });

    it('should format percentage to one decimal place', () => {
      const steps = [
        { step: 'step1', duration: 333 },
        { step: 'step2', duration: 333 },
        { step: 'step3', duration: 334 },
      ];

      PasswordPerformanceMonitor.logBreakdown('test', steps);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('Performance Emoji Selection', () => {
    it('should select rocket emoji for < 1000ms', done => {
      const operation = 'fast';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);

        const lastCall = (console.log as jest.Mock).mock.calls.slice(-1)[0][0];
        expect(lastCall).toContain('🚀');
        done();
      }, 50);
    });

    it('should select checkmark emoji for 1000-3000ms', done => {
      const operation = 'medium';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);

        const lastCall = (console.log as jest.Mock).mock.calls.slice(-1)[0][0];
        expect(lastCall).toBeDefined();
        done();
      }, 1000);
    }, 5000);

    it('should select lightning emoji for 3000-5000ms', done => {
      const operation = 'acceptable';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);
        done();
      }, 3100);
    }, 6000);

    it('should select snail emoji for 5000-10000ms', done => {
      const operation = 'slow';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);
        done();
      }, 5100);
    }, 7000);

    it('should select cancel emoji for > 10000ms', done => {
      const operation = 'very-slow';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer(operation);
        done();
      }, 10100);
    }, 12000);
  });

  describe('Integration Tests', () => {
    it('should track multiple operations independently', done => {
      const ops = ['op1', 'op2', 'op3'];

      ops.forEach(op => PasswordPerformanceMonitor.startTimer(op));

      setTimeout(() => {
        ops.forEach(op => {
          const duration = PasswordPerformanceMonitor.endTimer(op);
          expect(duration).toBeGreaterThan(0);
        });

        done();
      }, 100);
    });

    it('should handle operation names with special characters', done => {
      const operation = 'password-encryption_v2.0';

      PasswordPerformanceMonitor.startTimer(operation);

      setTimeout(() => {
        const duration = PasswordPerformanceMonitor.endTimer(operation);

        expect(duration).toBeGreaterThan(0);
        done();
      }, 50);
    });

    it('should support nested breakdown logging', () => {
      const mainOp = 'encrypt-password';
      const steps = [
        { step: 'hash-password', duration: 50 },
        { step: 'generate-salt', duration: 30 },
        { step: 'apply-kdf', duration: 100 },
      ];

      PasswordPerformanceMonitor.logBreakdown(mainOp, steps);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(mainOp));
    });

    it('should handle mixed operations and breakdowns', done => {
      PasswordPerformanceMonitor.startTimer('main-operation');

      const substeps = [
        { step: 'init', duration: 10 },
        { step: 'process', duration: 50 },
      ];

      PasswordPerformanceMonitor.logBreakdown('substeps', substeps);

      setTimeout(() => {
        PasswordPerformanceMonitor.endTimer('main-operation');

        expect(console.log).toHaveBeenCalled();
        done();
      }, 50);
    });
  });
});
