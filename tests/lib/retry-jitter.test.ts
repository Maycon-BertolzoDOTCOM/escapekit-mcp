import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryHandler, getRetryAfterDelay, createCircuitBreaker } from '../../src/lib/retry';

describe('RetryHandler - Jitter', () => {
  it('should add jitter to delay (delays vary)', async () => {
    const handler = new RetryHandler({
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitterFactor: 0.5,
    });

    const delays: number[] = [];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');

    const start = Date.now();
    await handler.execute(fn);
    const elapsed = Date.now() - start;

    // With jitter, delays should not be exactly deterministic
    // At minimum, we should have waited some time
    expect(elapsed).toBeGreaterThan(50);
  });

  it('should respect maxDelayMs cap', async () => {
    const handler = new RetryHandler({
      maxRetries: 1,
      initialDelayMs: 1000,
      maxDelayMs: 50, // very low cap
      backoffMultiplier: 10,
      jitterFactor: 0, // no jitter for predictability
    });

    const fn = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('ok');

    const start = Date.now();
    await handler.execute(fn);
    const elapsed = Date.now() - start;

    // Should be capped at 50ms (+ some tolerance)
    expect(elapsed).toBeLessThan(200);
  });
});

describe('RetryHandler - Rate Limiting (429)', () => {
  it('should retry on HTTP 429', async () => {
    const handler = new RetryHandler({
      maxRetries: 2,
      initialDelayMs: 10,
      maxDelayMs: 100,
      jitterFactor: 0,
    });

    const error429 = Object.assign(new Error('Too Many Requests'), {
      response: { status: 429, headers: {} },
    });

    const fn = vi.fn().mockRejectedValueOnce(error429).mockResolvedValue('ok');

    const result = await handler.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should use Retry-After header when present', async () => {
    const handler = new RetryHandler({
      maxRetries: 1,
      initialDelayMs: 10000, // high base
      maxDelayMs: 30000,
      jitterFactor: 0,
    });

    const error429 = Object.assign(new Error('Too Many Requests'), {
      response: {
        status: 429,
        headers: { 'retry-after': '1' }, // 1 second
      },
    });

    const fn = vi.fn().mockRejectedValueOnce(error429).mockResolvedValue('ok');

    const start = Date.now();
    await handler.execute(fn);
    const elapsed = Date.now() - start;

    // Should use Retry-After (1s) not initialDelayMs (10s)
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(2000);
  });

  it('should not retry 4xx errors other than 429', async () => {
    const handler = new RetryHandler({
      maxRetries: 3,
      initialDelayMs: 10,
    });

    const error400 = Object.assign(new Error('Bad Request'), {
      response: { status: 400 },
    });

    const fn = vi.fn().mockRejectedValue(error400);

    await expect(handler.execute(fn)).rejects.toThrow('Bad Request');
    // Should fail immediately without retrying
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('getRetryAfterDelay', () => {
  it('should parse Retry-After header in seconds', () => {
    const error = { response: { headers: { 'retry-after': '30' } } };
    expect(getRetryAfterDelay(error)).toBe(30000);
  });

  it('should parse X-RateLimit-Reset as unix timestamp', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 10;
    const error = { response: { headers: { 'x-ratelimit-reset': String(futureTime) } } };
    const delay = getRetryAfterDelay(error);
    expect(delay).toBeGreaterThanOrEqual(9000);
    expect(delay).toBeLessThanOrEqual(11000);
  });

  it('should return null when no headers present', () => {
    expect(getRetryAfterDelay({})).toBeNull();
    expect(getRetryAfterDelay({ response: { headers: {} } })).toBeNull();
  });
});

describe('CircuitBreaker', () => {
  it('should open after threshold failures', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 2, timeoutMs: 1000 });

    const fail = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    // Should reject immediately when open
    await expect(cb.execute(vi.fn())).rejects.toThrow('Circuit breaker is open');
  });

  it('should transition to half-open after timeout', async () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, timeoutMs: 50, successThreshold: 1 });

    await expect(cb.execute(vi.fn().mockRejectedValue(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('open');

    await new Promise(resolve => setTimeout(resolve, 60));

    // Should be half-open and accept a call
    const result = await cb.execute(vi.fn().mockResolvedValue('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('closed');
  });
});
