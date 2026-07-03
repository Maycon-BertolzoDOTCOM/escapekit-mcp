/**
 * Vicious Cycle Detection Tests
 *
 * Detects and prevents:
 * - Retry exhaustion loops (validation fails → retry → fail → repeat)
 * - Token/request amplification (one code → many requests)
 * - Cache poisoning (bad result cached → propagated)
 * - Rate limit thrashing (429 → immediate retry → 429 → repeat)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryHandler, CircuitBreaker, createCircuitBreaker } from '../../src/lib/retry';

// ─── Vicious Cycle Detector ──────────────────────────────────────────────────

class ViciousCycleDetector {
  private requestCounts = new Map<string, number>();
  private timestamps: number[] = [];
  private windowMs: number;
  private maxRequestsPerWindow: number;

  constructor(windowMs: number = 1000, maxRequestsPerWindow: number = 10) {
    this.windowMs = windowMs;
    this.maxRequestsPerWindow = maxRequestsPerWindow;
  }

  trackRequest(key: string): boolean {
    const now = Date.now();
    this.timestamps.push(now);

    // Clean old timestamps
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    // Check if we're in a vicious cycle
    if (this.timestamps.length > this.maxRequestsPerWindow) {
      return true; // Vicious cycle detected
    }

    // Track per-key
    const count = (this.requestCounts.get(key) ?? 0) + 1;
    this.requestCounts.set(key, count);

    return count > this.maxRequestsPerWindow;
  }

  getRequestRate(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length / (this.windowMs / 1000);
  }

  reset(): void {
    this.requestCounts.clear();
    this.timestamps = [];
  }
}

class TokenAmplificationTracker {
  private totalTokens = 0;
  private requestCount = 0;

  track(tokensUsed: number): void {
    this.totalTokens += tokensUsed;
    this.requestCount++;
  }

  getAmplificationRatio(): number {
    if (this.requestCount === 0) return 0;
    return this.totalTokens / this.requestCount;
  }

  isAmplified(threshold: number = 1000): boolean {
    return this.getAmplificationRatio() > threshold;
  }

  reset(): void {
    this.totalTokens = 0;
    this.requestCount = 0;
  }
}

class CachePoisoningDetector {
  private trustedSources = new Set<string>();
  private suspiciousEntries = new Map<string, number>();

  markTrusted(source: string): void {
    this.trustedSources.add(source);
  }

  recordEntry(fingerprint: string, source: string, confidence: number): boolean {
    if (!this.trustedSources.has(source) && confidence < 0.5) {
      const count = (this.suspiciousEntries.get(fingerprint) ?? 0) + 1;
      this.suspiciousEntries.set(fingerprint, count);
      return count > 3; // Too many suspicious entries for same fingerprint
    }
    return false;
  }

  getSuspiciousCount(): number {
    return this.suspiciousEntries.size;
  }

  reset(): void {
    this.trustedSources.clear();
    this.suspiciousEntries.clear();
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Vicious Cycle: Retry Exhaustion', () => {
  it('should eventually give up after max retries', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 10, jitterFactor: 0 });
    let attempts = 0;

    const alwaysFail = async () => {
      attempts++;
      throw new Error('timeout'); // Use a retryable error
    };

    await expect(handler.execute(alwaysFail)).rejects.toThrow('timeout');
    // RetryHandler makes maxRetries + 1 attempts (initial + retries)
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(attempts).toBeLessThanOrEqual(4);
  });

  it('should not retry non-retryable errors', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 10 });
    let attempts = 0;

    const authError = async () => {
      attempts++;
      throw new Error('Authentication failed');
    };

    await expect(handler.execute(authError)).rejects.toThrow('Authentication failed');
    expect(attempts).toBe(1); // No retries for auth errors
  });

  it('should track retry history', async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 10, jitterFactor: 0 });

    const fail = async () => { throw new Error('timeout'); };

    await expect(handler.execute(fail)).rejects.toThrow();
    const history = handler.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].attempt).toBe(1);
    expect(history[1].attempt).toBe(2);
  });
});

describe('Vicious Cycle: Token Amplification', () => {
  it('should detect when one request generates many sub-requests', async () => {
    const tracker = new TokenAmplificationTracker();
    const detector = new ViciousCycleDetector(1000, 5);

    // Simulate: one validation triggers 10 sub-requests rapidly
    const subRequests: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      tracker.track(100); // Each sub-request uses 100 tokens
      subRequests.push(detector.trackRequest('validation'));
    }

    // 10 * 100 = 1000 tokens / 10 requests = 100 avg, not amplified by 500 threshold
    // But the detector should flag rapid requests (10 in <100ms window)
    expect(subRequests.some(r => r === true)).toBe(true); // Some detected as cycle
  });

  it('should not flag normal request patterns', async () => {
    const tracker = new TokenAmplificationTracker();
    const detector = new ViciousCycleDetector(1000, 10);

    // Simulate: 3 normal requests
    for (let i = 0; i < 3; i++) {
      tracker.track(50);
      detector.trackRequest(`request-${i}`);
    }

    expect(tracker.isAmplified(500)).toBe(false);
  });
});

describe('Vicious Cycle: Cache Poisoning', () => {
  it('should detect suspicious entries from untrusted sources', () => {
    const detector = new CachePoisoningDetector();
    detector.markTrusted('local');

    // Federated source with low confidence
    const poisoned = detector.recordEntry('fp_123', 'federated', 0.2);
    expect(poisoned).toBe(false); // First suspicious entry

    detector.recordEntry('fp_123', 'federated', 0.1);
    detector.recordEntry('fp_123', 'federated', 0.3);
    const finallyPoisoned = detector.recordEntry('fp_123', 'federated', 0.1);
    expect(finallyPoisoned).toBe(true); // Too many suspicious entries
  });

  it('should not flag entries from trusted sources', () => {
    const detector = new CachePoisoningDetector();
    detector.markTrusted('local');

    const poisoned = detector.recordEntry('fp_123', 'local', 0.1);
    expect(poisoned).toBe(false);
  });

  it('should not flag high-confidence entries', () => {
    const detector = new CachePoisoningDetector();

    const poisoned = detector.recordEntry('fp_123', 'federated', 0.9);
    expect(poisoned).toBe(false);
  });
});

describe('Vicious Cycle: Rate Limit Thrashing', () => {
  it('should detect rapid-fire requests causing 429s', async () => {
    const detector = new ViciousCycleDetector(100, 5); // 100ms window, max 5
    let requestCount = 0;

    const simulateRateLimitedApi = async () => {
      requestCount++;
      if (requestCount > 3) {
        const err: any = new Error('Too Many Requests');
        err.response = { status: 429, headers: { 'retry-after': '1' } };
        throw err;
      }
      return 'ok';
    };

    // Fire 10 rapid requests
    const results = await Promise.allSettled(
      Array(10).fill(0).map(async () => {
        const isCycle = detector.trackRequest('api');
        try {
          return await simulateRateLimitedApi();
        } catch (e) {
          if (isCycle) throw new Error('Vicious cycle detected');
          throw e;
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    expect(failures.length).toBeGreaterThan(0);
  });

  it('should respect Retry-After header to avoid thrashing', async () => {
    const handler = new RetryHandler({ maxRetries: 1, initialDelayMs: 10000, jitterFactor: 0 });

    const error429: any = new Error('Too Many Requests');
    error429.response = { status: 429, headers: { 'retry-after': '0.1' } }; // 100ms

    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValue('ok');

    const start = Date.now();
    const result = await handler.execute(fn);
    const elapsed = Date.now() - start;

    expect(result).toBe('ok');
    // Should have waited ~100ms (Retry-After), not initialDelayMs (10s)
    expect(elapsed).toBeLessThan(500);
  });
});

describe('Vicious Cycle: Detector Integration', () => {
  it('should detect a full validation → retry → fail → retry loop', async () => {
    const detector = new ViciousCycleDetector(1000, 10); // 1 second window, max 10
    const cb = createCircuitBreaker({ failureThreshold: 10, timeoutMs: 100 });
    const handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 10, jitterFactor: 0 });
    let attempts = 0;

    const validationFn = async () => {
      attempts++;
      const isCycle = detector.trackRequest('validation');
      if (isCycle) throw new Error('Vicious cycle: too many validation attempts');
      throw new Error('timeout'); // Use retryable error
    };

    await expect(
      handler.execute(async () => cb.execute(validationFn))
    ).rejects.toThrow();

    // Should have attempted multiple times
    expect(attempts).toBeGreaterThan(1);
    expect(detector.getRequestRate()).toBeGreaterThan(0);
  });
});
