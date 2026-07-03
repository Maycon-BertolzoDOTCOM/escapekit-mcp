/**
 * Sequential Executor
 *
 * Wraps an async function to ensure concurrent calls are executed
 * one at a time in order, preventing race conditions.
 *
 * Inspired by Claude Code's sequential() in utils/sequential.ts.
 *
 * Usage:
 *   const safeWrite = sequential(writeFile)
 *   // These run sequentially even if called concurrently
 *   safeWrite('file1.txt', 'data1')
 *   safeWrite('file2.txt', 'data2')
 */

type QueueItem<T extends unknown[], R> = {
  args: T;
  resolve: (value: R) => void;
  reject: (reason?: unknown) => void;
  context: unknown;
};

/**
 * Creates a sequential execution wrapper for async functions.
 */
export function sequential<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  const queue: QueueItem<T, R>[] = [];
  let processing = false;

  async function processQueue(): Promise<void> {
    if (processing) return;
    if (queue.length === 0) return;

    processing = true;

    while (queue.length > 0) {
      const { args, resolve, reject, context } = queue.shift()!;

      try {
        const result = await fn.apply(context, args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    processing = false;

    if (queue.length > 0) {
      void processQueue();
    }
  }

  return function (this: unknown, ...args: T): Promise<R> {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject, context: this });
      void processQueue();
    });
  };
}

/**
 * Sequential with timeout — wraps each call with a timeout
 */
export function sequentialWithTimeout<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  timeoutMs: number,
): (...args: T) => Promise<R> {
  const seq = sequential(fn);

  return async function (...args: T): Promise<R> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Sequential call timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([seq(...args), timeoutPromise]);
  };
}
