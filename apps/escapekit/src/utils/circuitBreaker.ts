/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern with 3 states:
 *   CLOSED  → operations execute normally
 *   OPEN    → operations fail fast without executing
 *   HALF_OPEN → one test operation allowed to check recovery
 *
 * Inspired by the Vigilante circuit breaker in AnimeThree
 * and the circuit breaker patterns in Claude Code's retry system.
 *
 * Usage:
 *   const breaker = new CircuitBreaker('npm-registry', {
 *     failureThreshold: 5,
 *     recoveryTimeoutMs: 60000,
 *   })
 *
 *   const result = await breaker.execute(() => fetchFromRegistry(pkg))
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 60000) */
  recoveryTimeoutMs?: number;
  /** Optional callback when state changes */
  onStateChange?: (
    name: string,
    from: CircuitState,
    to: CircuitState,
    context: Record<string, unknown>,
  ) => void;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastStateChange: number;
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number;
  private readonly clock: () => number;

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly onStateChange?: CircuitBreakerOptions['onStateChange'];

  constructor(name: string, options: CircuitBreakerOptions = {}, clock: () => number = Date.now) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 60000;
    this.onStateChange = options.onStateChange;
    this.clock = clock;
    this.lastStateChange = this.clock();
  }

  /**
   * Execute an operation through the circuit breaker.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptRecovery()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(
          `Circuit "${this.name}" is OPEN. ` +
            `Retry after ${this.recoveryTimeoutMs}ms.`,
          this.name,
          this.failureCount,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Check if an operation would be allowed.
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    return this.shouldAttemptRecovery();
  }

  /**
   * Get current stats.
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Force reset to CLOSED state.
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failureCount = 0;
  }

  /**
   * Force the circuit to OPEN state.
   */
  trip(): void {
    this.transitionTo('OPEN');
  }

  private onSuccess(): void {
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED');
      this.failureCount = 0;
    }
  }

  private onFailure(_error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = this.clock();

    if (this.state === 'HALF_OPEN') {
      // Recovery failed, go back to OPEN
      this.transitionTo('OPEN');
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  private shouldAttemptRecovery(): boolean {
    if (this.lastFailureTime === null) return true;
    return this.clock() - this.lastFailureTime >= this.recoveryTimeoutMs;
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = this.clock();
    this.onStateChange?.(this.name, oldState, newState, {
      failureCount: this.failureCount,
      successCount: this.successCount,
    });
  }
}

/**
 * Error thrown when circuit is OPEN
 */
export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly failureCount: number;

  constructor(message: string, circuitName: string, failureCount: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.failureCount = failureCount;
  }
}
