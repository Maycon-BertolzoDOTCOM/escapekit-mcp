/**
 * Sistema de Retry com Circuit Breaker
 * Implementa retry inteligente com backoff exponencial e circuit breaker
 */

import { getLogger } from './kiwi-logger';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  
  constructor(
    private options: CircuitBreakerOptions,
    private logger = getLogger()
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.timeoutMs) {
        this.logger.debug(`Circuit breaker: transitioning to half-open`);
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
          this.logger.debug(`Circuit breaker: transitioning to closed`);
          this.state = 'closed';
          this.failures = 0;
        }
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.options.failureThreshold) {
        this.logger.warn(`Circuit breaker: transitioning to open after ${this.failures} failures`);
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

export class RetryHandler {
  private options: RetryOptions;
  private logger = getLogger();

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialDelayMs: options.initialDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 10000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      retryableErrors: options.retryableErrors ?? [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'timeout',
        '503',
        '502',
        '504',
      ],
    };
  }

  private calculateDelay(attempt: number): number {
    const delay = this.options.initialDelayMs * Math.pow(this.options.backoffMultiplier, attempt);
    return Math.min(delay, this.options.maxDelayMs);
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = String(error.message || error);
    
    return this.options.retryableErrors!.some(
      retryable => errorStr.toLowerCase().includes(retryable.toLowerCase())
    );
  }

  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication errors
        if (error.message?.includes('Authentication')) {
          this.logger.error(`Authentication error, not retrying: ${error.message}`);
          throw error;
        }

        // Don't retry on validation errors
        if (error.message?.includes('This field is required') || 
            error.message?.includes('does not exist')) {
          this.logger.debug(`Validation error, not retrying: ${error.message}`);
          throw error;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error) && attempt > 0) {
          this.logger.debug(`Non-retryable error: ${error.message}`);
          throw error;
        }

        if (attempt < this.options.maxRetries) {
          const delay = this.calculateDelay(attempt);
          const contextStr = context ? `[${context}] ` : '';
          this.logger.warn(
            `${contextStr}Attempt ${attempt + 1}/${this.options.maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
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
