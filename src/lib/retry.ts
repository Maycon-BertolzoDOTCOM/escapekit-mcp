/**
 * Retry + Circuit Breaker with Jitter and Rate Limiting
 */

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors: string[];
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface RetryAttempt {
  attempt: number;
  delay: number;
  error: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.timeoutMs) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.successes++;
        if (this.successes >= this.options.successThreshold) {
          this.state = 'closed';
          this.failures = 0;
        }
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      if (this.failures >= this.options.failureThreshold) {
        this.state = 'open';
      }
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Extract retry delay from HTTP 429 response headers
 */
export function getRetryAfterDelay(error: any): number | null {
  // Check Retry-After header (standard)
  const retryAfter = error?.response?.headers?.['retry-after'] || error?.headers?.['retry-after'];

  if (retryAfter) {
    const parsed = parseInt(retryAfter, 10);
    if (!isNaN(parsed)) return parsed * 1000; // seconds → ms
  }

  // Check X-RateLimit-Reset (some APIs use this)
  const resetAt =
    error?.response?.headers?.['x-ratelimit-reset'] || error?.headers?.['x-ratelimit-reset'];

  if (resetAt) {
    const resetTime = parseInt(resetAt, 10);
    if (!isNaN(resetTime)) {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, (resetTime - now) * 1000);
    }
  }

  return null;
}

export class RetryHandler {
  private options: RetryOptions;
  private history: RetryAttempt[] = [];

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialDelayMs: options.initialDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 10000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      jitterFactor: options.jitterFactor ?? 0.25,
      retryableErrors: options.retryableErrors ?? [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'timeout',
        '503',
        '502',
        '504',
        '429',
      ],
    };
  }

  /**
   * Calculate delay with exponential backoff + jitter
   * jitter = random ±jitterFactor% of the base delay
   */
  private calculateDelay(attempt: number): number {
    const base = this.options.initialDelayMs * Math.pow(this.options.backoffMultiplier, attempt);
    const capped = Math.min(base, this.options.maxDelayMs);
    const jitter = capped * this.options.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(capped + jitter));
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;

    // HTTP 429 is always retryable
    if (error?.response?.status === 429) return true;

    const errorStr = String(error.message || error);
    return this.options.retryableErrors.some(retryable =>
      errorStr.toLowerCase().includes(retryable.toLowerCase())
    );
  }

  private isNonRetryableError(error: any): boolean {
    if (!error) return false;
    const msg = error.message || '';
    if (msg.includes('Authentication')) return true;
    if (msg.includes('This field is required')) return true;
    if (msg.includes('does not exist')) return true;
    // HTTP 4xx client errors (except 429)
    const status = error?.response?.status;
    if (status && status >= 400 && status < 500 && status !== 429) return true;
    return false;
  }

  getHistory(): RetryAttempt[] {
    return [...this.history];
  }

  async execute<T>(fn: () => Promise<T>, _context?: string): Promise<T> {
    this.history = [];
    let lastError: any;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (this.isNonRetryableError(error)) throw error;
        if (!this.isRetryableError(error) && attempt > 0) throw error;

        if (attempt < this.options.maxRetries) {
          // Check for 429 with Retry-After header
          let delay: number;
          const rateLimitDelay = getRetryAfterDelay(error);
          if (error?.response?.status === 429 && rateLimitDelay !== null) {
            delay = Math.min(rateLimitDelay, this.options.maxDelayMs);
          } else {
            delay = this.calculateDelay(attempt);
          }

          this.history.push({
            attempt: attempt + 1,
            delay,
            error: error.message || String(error),
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export function createRetryHandler(options?: Partial<RetryOptions>): RetryHandler {
  return new RetryHandler(options);
}

export function createCircuitBreaker(options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: options?.failureThreshold ?? 5,
    successThreshold: options?.successThreshold ?? 2,
    timeoutMs: options?.timeoutMs ?? 30000,
  });
}
