/**
 * Retry Utility
 *
 * Generic retry with exponential backoff, jitter, and configurable
 * retry conditions. Inspired by the retry state machine in
 * Anthropic's query engine (withRetry pattern).
 *
 * Usage:
 *   const result = await withRetry(
 *     () => fetchSomething(),
 *     { maxRetries: 3, isRetryable: (err) => err.code !== 'NOT_FOUND' }
 *   )
 */

export interface RetryOptions {
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 500) */
  baseDelay?: number;
  /** Max delay in ms (default: 32000) */
  maxDelay?: number;
  /** Jitter factor 0-1 (default: 0.25) */
  jitterFactor?: number;
  /** Optional abort signal */
  signal?: AbortSignal;
  /** Called before each retry */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
  /** Determine if an error is retryable. Default: retry all errors */
  isRetryable?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Compute retry delay with exponential backoff and jitter
 */
export function computeRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitterFactor: number,
): number {
  const exponential = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * jitterFactor * exponential;
  return exponential + jitter;
}

/**
 * Check if an error is retryable by default.
 * Non-retryable: AbortError, any error with code containing 'NOT_FOUND' or 'NOT_FOUND'.
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return false;
    if ((error as { code?: string }).code === 'NOT_FOUND') return false;
  }
  return true;
}

/**
 * Execute an operation with retry and exponential backoff.
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration
 * @returns The operation result
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 500,
    maxDelay = 32000,
    jitterFactor = 0.25,
    signal,
    onRetry,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Retry aborted');
    }

    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryable(error)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = computeRetryDelay(attempt, baseDelay, maxDelay, jitterFactor);
        onRetry?.(attempt + 1, delay, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

/**
 * Execute an operation with retry, returning detailed result.
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 500,
    maxDelay = 32000,
    jitterFactor = 0.25,
    signal,
    onRetry,
    isRetryable = defaultIsRetryable,
  } = options;

  let lastError: Error | undefined;
  let totalDelayMs = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Retry aborted');
    }

    try {
      const value = await operation();
      return { value, attempts: attempt + 1, totalDelayMs };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryable(error)) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = computeRetryDelay(attempt, baseDelay, maxDelay, jitterFactor);
        totalDelayMs += delay;
        onRetry?.(attempt + 1, delay, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
