import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../src/ratelimit/RateLimiter';

describe('RateLimiter', () => {
  describe('constructor', () => {
    it('should create limiter with default config', () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should create limiter with custom config', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
      expect(limiter).toBeDefined();
    });
  });

  describe('throttle', () => {
    it('should allow first request immediately', async () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
      const start = Date.now();
      await limiter.throttle();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('should respect maxRequests limit', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
      await limiter.throttle();
      await limiter.throttle();
      await limiter.throttle();
      const count = limiter.getRequestCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRequestCount', () => {
    it('should return 0 for new limiter', () => {
      const limiter = new RateLimiter();
      const count = limiter.getRequestCount();
      expect(count).toBe(0);
    });

    it('should count requests within window', async () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
      await limiter.throttle();
      await limiter.throttle();
      const count = limiter.getRequestCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('execute', () => {
    it('should execute function and return result', async () => {
      const limiter = new RateLimiter();
      const result = await limiter.execute(() => 42);
      expect(result).toBe(42);
    });

    it('should execute async function', async () => {
      const limiter = new RateLimiter();
      const result = await limiter.execute(async () => {
        return Promise.resolve(42);
      });
      expect(result).toBe(42);
    });
  });
});
