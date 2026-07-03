/**
 * Streaming Tool Executor
 *
 * Executes operations as they stream in with concurrency control:
 * - Concurrent-safe operations execute in parallel
 * - Exclusive operations must run alone (serialized)
 * - Results are buffered and emitted in order
 * - Progress messages are yielded immediately
 * - Sibling abort: one error cancels parallel siblings
 *
 * Inspired by Claude Code's StreamingToolExecutor.
 *
 * Usage:
 *   import { StreamingExecutor } from './utils/streamingExecutor.js'
 *
 *   const executor = new StreamingExecutor()
 *
 *   // Add operations (start executing when conditions allow)
 *   executor.addOperation('scan-files', () => scanFiles(), { concurrencySafe: true })
 *   executor.addOperation('check-deps', () => checkDeps(), { concurrencySafe: true })
 *   executor.addOperation('write-report', () => writeReport(), { concurrencySafe: false })
 *
 *   // Stream results as they complete (in order)
 *   for await (const result of executor.getResults()) {
 *     console.log(`${result.id}: ${result.status}`)
 *   }
 */

import { createChildAbortController } from './abortController.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type OperationStatus = 'queued' | 'executing' | 'completed' | 'yielded' | 'failed';

export interface OperationResult<T = unknown> {
  id: string;
  status: 'completed' | 'failed';
  result?: T;
  error?: Error;
  durationMs: number;
}

export interface OperationProgress {
  id: string;
  type: 'progress';
  message: string;
  data?: unknown;
}

export interface ExecutorOptions {
  /** Abort controller for the whole executor */
  abortController?: AbortController;
  /** Max concurrent operations (default: Infinity) */
  maxConcurrency?: number;
  /** Whether to abort siblings when one fails (default: false) */
  abortSiblingsOnError?: boolean;
}

interface TrackedOperation<T = unknown> {
  id: string;
  execute: () => Promise<T>;
  status: OperationStatus;
  concurrencySafe: boolean;
  promise?: Promise<void>;
  result?: OperationResult<T>;
  progressMessages: OperationProgress[];
  startTime: number;
}

// ─── Streaming Executor ─────────────────────────────────────────────────────

export class StreamingExecutor {
  private operations: TrackedOperation[] = [];
  private siblingAbortController: AbortController;
  private discarded = false;
  private progressResolve?: () => void;

  private readonly maxConcurrency: number;
  private readonly abortSiblingsOnError: boolean;

  constructor(options: ExecutorOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? Infinity;
    this.abortSiblingsOnError = options.abortSiblingsOnError ?? false;

    if (options.abortController) {
      this.siblingAbortController = createChildAbortController(options.abortController);
    } else {
      this.siblingAbortController = new AbortController();
    }
  }

  /**
   * Add an operation to the execution queue.
   * Starts executing immediately if concurrency conditions allow.
   */
  addOperation<T>(
    id: string,
    execute: () => Promise<T>,
    options: { concurrencySafe?: boolean } = {},
  ): void {
    const op: TrackedOperation<T> = {
      id,
      execute,
      status: 'queued',
      concurrencySafe: options.concurrencySafe ?? true,
      progressMessages: [],
      startTime: 0,
    };
    this.operations.push(op as TrackedOperation);
    void this.processQueue();
  }

  /**
   * Discard all pending and in-progress operations.
   */
  discard(): void {
    this.discarded = true;
    this.siblingAbortController.abort();
  }

  /**
   * Check if an operation can execute based on concurrency state
   */
  private canExecute(isConcurrencySafe: boolean): boolean {
    const executing = this.operations.filter((o) => o.status === 'executing');

    if (executing.length >= this.maxConcurrency) return false;
    if (executing.length === 0) return true;
    if (!isConcurrencySafe) return false; // exclusive op must wait
    return executing.every((o) => o.concurrencySafe);
  }

  /**
   * Process the queue, starting operations when conditions allow
   */
  private async processQueue(): Promise<void> {
    for (const op of this.operations) {
      if (op.status !== 'queued') continue;

      if (this.canExecute(op.concurrencySafe)) {
        void this.executeOperation(op);
      } else if (!op.concurrencySafe) {
        break; // exclusive op blocks queue
      }
    }
  }

  /**
   * Execute a single operation
   */
  private executeOperation(op: TrackedOperation): void {
    op.status = 'executing';
    op.startTime = Date.now();

    const collectResults = async () => {
      // Check for pre-existing abort
      if (this.discarded || this.siblingAbortController.signal.aborted) {
        op.result = {
          id: op.id,
          status: 'failed',
          error: new Error(this.discarded ? 'Executor discarded' : 'Sibling error'),
          durationMs: Date.now() - op.startTime,
        };
        op.status = 'failed';
        return;
      }

      try {
        const result = await op.execute();

        op.result = {
          id: op.id,
          status: 'completed',
          result,
          durationMs: Date.now() - op.startTime,
        };
        op.status = 'completed';
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        op.result = {
          id: op.id,
          status: 'failed',
          error: err,
          durationMs: Date.now() - op.startTime,
        };
        op.status = 'failed';

        // Sibling abort on error
        if (this.abortSiblingsOnError) {
          this.siblingAbortController.abort();
        }
      }

      // Notify progress resolve
      if (this.progressResolve) {
        this.progressResolve();
        this.progressResolve = undefined;
      }
    };

    const promise = collectResults();
    op.promise = promise;

    void promise.finally(() => {
      void this.processQueue();
    });
  }

  /**
   * Yield completed results in order (synchronous generator).
   * Also yields progress messages immediately.
   */
  *getCompletedResults(): Generator<OperationResult | OperationProgress, void> {
    if (this.discarded) return;

    for (const op of this.operations) {
      // Yield progress messages
      while (op.progressMessages.length > 0) {
        yield op.progressMessages.shift()!;
      }

      if (op.status === 'yielded') continue;

      if ((op.status === 'completed' || op.status === 'failed') && op.result) {
        op.status = 'yielded';
        yield op.result;
      } else if (op.status === 'executing' && !op.concurrencySafe) {
        break; // can't yield past an exclusive executing op
      }
    }
  }

  /**
   * Wait for all operations to complete, yielding results as they finish.
   */
  async *getResults(): AsyncGenerator<OperationResult | OperationProgress, void> {
    if (this.discarded) return;

    while (this.hasUnfinished()) {
      await this.processQueue();

      for (const result of this.getCompletedResults()) {
        yield result;
      }

      if (this.hasExecuting() && !this.hasCompleted()) {
        const promises = this.operations
          .filter((o) => o.status === 'executing' && o.promise)
          .map((o) => o.promise!);

        if (promises.length > 0) {
          await Promise.race(promises);
        }
      }
    }

    // Final yield
    for (const result of this.getCompletedResults()) {
      yield result;
    }
  }

  /**
   * Get all results after all operations complete
   */
  async collectAll(): Promise<OperationResult[]> {
    const results: OperationResult[] = [];
    for await (const item of this.getResults()) {
      if ('status' in item) {
        results.push(item);
      }
    }
    return results;
  }

  /**
   * Record a progress message for an operation
   */
  reportProgress(id: string, message: string, data?: unknown): void {
    const op = this.operations.find((o) => o.id === id);
    if (op) {
      op.progressMessages.push({ id, type: 'progress', message, data });
      if (this.progressResolve) {
        this.progressResolve();
        this.progressResolve = undefined;
      }
    }
  }

  // ─── State queries ─────────────────────────────────────────────────────

  private hasUnfinished(): boolean {
    return this.operations.some((o) => o.status !== 'yielded');
  }

  private hasExecuting(): boolean {
    return this.operations.some((o) => o.status === 'executing');
  }

  private hasCompleted(): boolean {
    return this.operations.some((o) => o.status === 'completed' || o.status === 'failed');
  }

  get isRunning(): boolean {
    return this.hasExecuting();
  }

  get operationCount(): number {
    return this.operations.length;
  }

  get completedCount(): number {
    return this.operations.filter((o) => o.status === 'completed' || o.status === 'yielded').length;
  }

  get failedCount(): number {
    return this.operations.filter((o) => o.status === 'failed').length;
  }
}
