/**
 * RateLimiter — Unified sliding-window throttle + semaphore concurrency control
 *
 * Combines two orthogonal control mechanisms:
 *   1. Token Bucket (sliding window): limits how many calls proceed within `windowMs`.
 *   2. Semaphore: limits how many `execute()` calls run simultaneously.
 *
 * Both mechanisms compose sequentially inside `execute()`:
 *   throttle() → acquireSemaphore() → fn() → releaseSemaphore() in finally
 *
 * `throttle()` is also callable directly (used by sovereignty tests).
 */
import { logger } from '../logger.js';

export interface RateLimiterConfig {
  /** Window-based request limit. Default: Infinity (unlimited) */
  maxRequests?: number;
  /** Time window in milliseconds. Default: 60000 */
  windowMs?: number;
  /** Maximum concurrent in-flight execute() calls. Default: Infinity (unlimited) */
  maxConcurrent?: number;
  /** Minimum delay between requests in milliseconds. Default: 0 */
  minDelayMs?: number;
}

const DEFAULTS = {
  maxRequests: Infinity,
  windowMs: 60_000,
  maxConcurrent: Infinity,
  minDelayMs: 0,
};

export class RateLimiter {
  private readonly log = logger.child('RateLimiter');
  private readonly config: Required<RateLimiterConfig>;

  // Sliding-window token bucket state
  private readonly requests: number[] = [];
  private lastRequestTime = 0;

  // Semaphore state
  private activeCount = 0;
  private readonly semaphoreQueue: Array<() => void> = [];

  constructor(config?: RateLimiterConfig) {
    this.config = {
      maxRequests: config?.maxRequests ?? DEFAULTS.maxRequests,
      windowMs: config?.windowMs ?? DEFAULTS.windowMs,
      maxConcurrent: config?.maxConcurrent ?? DEFAULTS.maxConcurrent,
      minDelayMs: config?.minDelayMs ?? DEFAULTS.minDelayMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Throttle API (used by sovereignty tests)
  // ---------------------------------------------------------------------------

  /** Wait until a request can proceed (respects minDelayMs and sliding-window limit) */
  async throttle(): Promise<void> {
    // 1. Enforce minimum delay between requests
    if (this.config.minDelayMs > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.config.minDelayMs) {
        const wait = this.config.minDelayMs - elapsed + 1;
        this.log.debug('Rate limiting: min delay', { wait });
        await this.sleep(wait);
      }
    }

    // 2. Enforce sliding-window rate limit
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove expired entries
    while (this.requests.length > 0 && this.requests[0] < windowStart) {
      this.requests.shift();
    }

    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.config.windowMs - now;
      if (waitTime > 0) {
        this.log.debug('Rate limiting: window full', { waitTime, requests: this.requests.length });
        await this.sleep(waitTime);
      }
      // After sleeping, prune again so the count is accurate
      const newWindowStart = Date.now() - this.config.windowMs;
      while (this.requests.length > 0 && this.requests[0] < newWindowStart) {
        this.requests.shift();
      }
    }

    this.requests.push(Date.now());
    this.lastRequestTime = Date.now();
  }

  /** Count of throttle() calls that completed within the current windowMs */
  getRequestCount(): number {
    const windowStart = Date.now() - this.config.windowMs;
    return this.requests.filter(t => t >= windowStart).length;
  }

  /** Clear all internal state */
  reset(): void {
    this.requests.length = 0;
    this.lastRequestTime = 0;
  }

  // ---------------------------------------------------------------------------
  // Execute API (used by DeepDependencyScanner and CLI)
  // ---------------------------------------------------------------------------

  /**
   * Execute `fn` subject to rate limiting and concurrency control.
   *
   * Steps:
   *   1. throttle() — consume a sliding-window token
   *   2. acquireSemaphore() — wait for a concurrency slot
   *   3. fn() — run the user function
   *   4. releaseSemaphore() — always, in finally
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.throttle();
    await this.acquireSemaphore();
    try {
      return await fn();
    } finally {
      this.releaseSemaphore();
    }
  }

  /** Snapshot of current limiter state */
  getStats(): { queued: number; active: number; remaining?: number } {
    const stats: { queued: number; active: number; remaining?: number } = {
      queued: this.semaphoreQueue.length,
      active: this.activeCount,
    };
    if (this.config.maxRequests !== Infinity) {
      stats.remaining = this.config.maxRequests - this.getRequestCount();
    }
    return stats;
  }

  // ---------------------------------------------------------------------------
  // Semaphore internals
  // ---------------------------------------------------------------------------

  private acquireSemaphore(): Promise<void> {
    if (this.activeCount < this.config.maxConcurrent) {
      this.activeCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.semaphoreQueue.push(resolve);
    });
  }

  private releaseSemaphore(): void {
    const next = this.semaphoreQueue.shift();
    if (next) {
      // Hand the slot directly to the next waiter (activeCount stays the same)
      next();
    } else {
      this.activeCount--;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
