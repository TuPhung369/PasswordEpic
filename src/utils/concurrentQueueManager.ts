/**
 * Concurrent Queue Manager
 * Manages concurrent execution of async tasks with a configurable limit
 * Useful for batch operations like downloading multiple files
 */

export interface QueueTask<R> {
  id: string;
  execute: () => Promise<R>;
  onProgress?: (current: number, total: number) => void;
}

export interface QueueOptions {
  concurrency: number;
  onProgress?: (current: number, total: number) => void;
  onError?: (error: Error, taskId: string) => void;
}

export class ConcurrentQueueManager {
  private concurrency: number;
  private running: number = 0;
  private queue: Array<{
    task: QueueTask<any>;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private results: Map<string, any> = new Map();
  private errors: Map<string, Error> = new Map();
  private onProgress?: (current: number, total: number) => void;
  private onError?: (error: Error, taskId: string) => void;
  private totalTasks: number = 0;
  private completedTasks: number = 0;

  constructor(options: QueueOptions) {
    this.concurrency = options.concurrency;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  /**
   * Add task to queue and execute when possible
   */
  async execute<R>(task: QueueTask<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.totalTasks++;
      this.processQueue();
    });
  }

  /**
   * Execute all tasks and return results in order
   */
  async executeAll<R>(
    tasks: QueueTask<R>[],
  ): Promise<{ results: R[]; errors: Map<string, Error> }> {
    this.totalTasks = tasks.length;
    this.completedTasks = 0;
    this.results.clear();
    this.errors.clear();

    const promises = tasks.map(task =>
      this.execute(task).catch(error => {
        this.errors.set(task.id, error);
        return null; // Return null for failed tasks, don't break the chain
      }),
    );

    const results = await Promise.all(promises);

    return {
      results: results.filter(r => r !== null) as R[],
      errors: this.errors,
    };
  }

  /**
   * Process queue - execute tasks up to concurrency limit
   */
  private async processQueue(): Promise<void> {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift()!;

    try {
      const result = await task.execute();
      this.results.set(task.id, result);
      this.completedTasks++;

      if (this.onProgress) {
        this.onProgress(this.completedTasks, this.totalTasks);
      }

      resolve(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errors.set(task.id, err);
      this.completedTasks++;

      if (this.onError) {
        this.onError(err, task.id);
      }

      reject(err);
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * Get all results collected so far
   */
  getResults(): Map<string, any> {
    return this.results;
  }

  /**
   * Get all errors collected so far
   */
  getErrors(): Map<string, Error> {
    return this.errors;
  }

  /**
   * Get progress as percentage (0-100)
   */
  getProgress(): number {
    if (this.totalTasks === 0) return 0;
    return Math.round((this.completedTasks / this.totalTasks) * 100);
  }

  /**
   * Clear all data
   */
  reset(): void {
    this.queue = [];
    this.results.clear();
    this.errors.clear();
    this.running = 0;
    this.totalTasks = 0;
    this.completedTasks = 0;
  }
}

/**
 * Helper function to batch execute tasks with concurrency limit
 * @param tasks - Array of async functions to execute
 * @param concurrency - Maximum concurrent tasks (default: 3)
 * @param onProgress - Callback for progress updates
 * @returns Promise resolving to array of results
 */
export async function executeConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 3,
  onProgress?: (current: number, total: number) => void,
): Promise<T[]> {
  const manager = new ConcurrentQueueManager({ concurrency, onProgress });

  const queueTasks = tasks.map((execute, index) => ({
    id: `task-${index}`,
    execute,
  }));

  const { results, errors } = await manager.executeAll(queueTasks);

  if (errors.size > 0) {
    console.warn(`⚠️ ${errors.size} tasks failed during concurrent execution`);
  }

  return results;
}
