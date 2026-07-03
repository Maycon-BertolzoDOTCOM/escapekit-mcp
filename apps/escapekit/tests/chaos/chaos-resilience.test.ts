/**
 * Chaos / Resilience Tests
 *
 * Simulates:
 * - Network failures (timeouts, connection refused)
 * - Cascading failures (one component breaks others)
 * - Resource exhaustion (memory, connections)
 * - Recovery after failure (circuit breaker half-open)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryHandler, CircuitBreaker, createCircuitBreaker } from '../../src/lib/retry';

// ─── Chaos Helpers ────────────────────────────────────────────────────────────

class ChaosNetwork {
  private latencyMs = 0;
  private failCount = 0;
  private failUntil = 0;
  private callCount = 0;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.callCount++;
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }
    if (this.callCount <= this.failUntil) {
      throw new Error('ECONNRESET');
    }
    return fn();
  }

  setLatency(ms: number): void { this.latencyMs = ms; }
  setFailUntil(count: number): void { this.failUntil = count; }
  reset(): void { this.callCount = 0; this.failUntil = 0; }
}

class ChaosResourcePool {
  private connections: number;
  private maxConnections: number;
  private waitQueue: Array<() => void> = [];

  constructor(maxConnections: number = 5) {
    this.maxConnections = maxConnections;
    this.connections = maxConnections;
  }

  async acquire(): Promise<void> {
    if (this.connections > 0) {
      this.connections--;
      return;
    }
    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.connections = Math.min(this.connections + 1, this.maxConnections);
    }
  }

  getAvailable(): number { return this.connections; }
  getQueueSize(): number { return this.waitQueue.length; }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Chaos: Network Failures', () => {
  let network: ChaosNetwork;

  beforeEach(() => {
    network = new ChaosNetwork();
  });

  it('should retry on ECONNRESET and eventually succeed', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 10, jitterFactor: 0 });
    let attempts = 0;

    network.setFailUntil(2); // Fail first 2 calls, succeed on 3rd
    const result = await handler.execute(async () => {
      attempts++;
      return network.call(async () => 'success');
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should exhaust retries and throw after maxRetries', async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 10, jitterFactor: 0 });
    network.setFailUntil(10); // Always fail

    await expect(
      handler.execute(async () => network.call(async () => 'success'))
    ).rejects.toThrow('ECONNRESET');
  });

  it('should handle high latency without timeout', async () => {
    const handler = new RetryHandler({ maxRetries: 1, initialDelayMs: 10 });
    network.setLatency(50);

    const start = Date.now();
    const result = await handler.execute(async () => network.call(async () => 'ok'));
    const elapsed = Date.now() - start;

    expect(result).toBe('ok');
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe('Chaos: Cascading Failures', () => {
  it('should not cascade when one component fails', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 2, timeoutMs: 100 });
    let healthyCalls = 0;
    let brokenCalls = 0;

    // Broken component
    const brokenFn = async () => {
      brokenCalls++;
      throw new Error('Component failed');
    };

    // Healthy component
    const healthyFn = async () => {
      healthyCalls++;
      return 'ok';
    };

    // Break the circuit
    await expect(cb.execute(brokenFn)).rejects.toThrow();
    await expect(cb.execute(brokenFn)).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    // Healthy component should still work
    const result = await healthyFn();
    expect(result).toBe('ok');
    expect(healthyCalls).toBe(1);
  });

  it('should recover after circuit breaker timeout', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, timeoutMs: 50, successThreshold: 1 });
    let callCount = 0;

    const flakyFn = async () => {
      callCount++;
      if (callCount <= 1) throw new Error('Temporary failure');
      return 'recovered';
    };

    // First call fails, circuit opens
    await expect(cb.execute(flakyFn)).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    // Wait for timeout
    await new Promise(r => setTimeout(r, 60));

    // Should be half-open, next success closes circuit
    const result = await cb.execute(flakyFn);
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('closed');
  });
});

describe('Chaos: Resource Exhaustion', () => {
  it('should queue requests when pool is exhausted', async () => {
    const pool = new ChaosResourcePool(2);
    const executionOrder: number[] = [];

    // Acquire all connections
    await pool.acquire();
    await pool.acquire();
    expect(pool.getAvailable()).toBe(0);

    // Third request should queue
    const queued = pool.acquire();
    expect(pool.getQueueSize()).toBe(1);

    // Release one connection
    pool.release();
    await queued;
    expect(pool.getQueueSize()).toBe(0);
  });

  it('should handle concurrent requests without deadlock', async () => {
    const pool = new ChaosResourcePool(3);
    const results: string[] = [];

    const tasks = Array(10).fill(0).map(async (_, i) => {
      await pool.acquire();
      results.push(`task-${i}`);
      pool.release();
    });

    await Promise.all(tasks);
    expect(results.length).toBe(10);
  });
});

describe('Chaos: Retry + Circuit Breaker Integration', () => {
  it('should stop retrying when circuit opens', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 2, timeoutMs: 1000 });
    const handler = new RetryHandler({ maxRetries: 5, initialDelayMs: 10, jitterFactor: 0 });
    let attempts = 0;

    const alwaysFail = async () => {
      attempts++;
      throw new Error('Persistent failure');
    };

    // Circuit breaker should open after 2 failures
    // RetryHandler should stop when circuit opens
    await expect(
      handler.execute(async () => cb.execute(alwaysFail))
    ).rejects.toThrow();

    expect(cb.getState()).toBe('open');
    // Should not have tried all 5 retries because circuit opened
    expect(attempts).toBeLessThanOrEqual(3);
  });

  it('should combine backoff with circuit breaker recovery', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 5, timeoutMs: 50, successThreshold: 1 });
    const handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 20, jitterFactor: 0 });
    let callCount = 0;

    const flakyFn = async () => {
      callCount++;
      if (callCount <= 1) throw new Error('First failure');
      return 'success';
    };

    const result = await handler.execute(async () => cb.execute(flakyFn));
    expect(result).toBe('success');
    expect(callCount).toBe(2);
    expect(cb.getState()).toBe('closed');
  });
});
