import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../../src/ratelimit/RateLimiter';

describe('RateLimiter (Expanded Tests)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor and defaults', () => {
    it('should create with default unlimited configuration', () => {
      const limiter = new RateLimiter();
      
      expect(limiter).toBeDefined();
      expect(limiter['config'].maxRequests).toBe(Infinity);
      expect(limiter['config'].maxConcurrent).toBe(Infinity);
      expect(limiter['config'].windowMs).toBe(60000);
      expect(limiter['config'].minDelayMs).toBe(0);
    });

    it('should accept custom configuration', () => {
      const config = {
        maxRequests: 10,
        windowMs: 1000,
        maxConcurrent: 5,
        minDelayMs: 100
      };
      
      const limiter = new RateLimiter(config);
      
      expect(limiter['config'].maxRequests).toBe(10);
      expect(limiter['config'].windowMs).toBe(1000);
      expect(limiter['config'].maxConcurrent).toBe(5);
      expect(limiter['config'].minDelayMs).toBe(100);
    });
  });

  describe('basic functionality', () => {
    it('should throttle resolve immediately for unlimited config', async () => {
      const limiter = new RateLimiter();
      await expect(limiter.throttle()).resolves.toBeUndefined();
    });

    it('should execute function with rate limiting', async () => {
      const limiter = new RateLimiter();
      const mockFn = vi.fn().mockResolvedValue('test-result');
      
      const result = await limiter.execute(mockFn);
      
      expect(result).toBe('test-result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRequestCount method', () => {
    it('should count requests within current window', () => {
      const limiter = new RateLimiter({ windowMs: 1000 });
      
      // Simulate requests at different times
      limiter['requests'] = [
        Date.now() - 800,  // within window (800ms ago)
        Date.now() - 400,  // within window (400ms ago)
        Date.now() - 1200, // expired (1200ms ago)
      ];
      
      expect(limiter.getRequestCount()).toBe(2);
    });

    it('should return 0 when no recent requests', () => {
      const limiter = new RateLimiter();
      expect(limiter.getRequestCount()).toBe(0);
    });
  });

  describe('getStats method', () => {
    it('should return correct stats for unlimited configuration', () => {
      const limiter = new RateLimiter();
      
      const stats = limiter.getStats();
      
      expect(stats).toEqual({
        queued: 0,
        active: 0
      });
    });

    it('should show remaining requests for limited configuration', () => {
      const limiter = new RateLimiter({ maxRequests: 5 });
      
      // Simulate 2 recent requests
      limiter['requests'] = [Date.now() - 500, Date.now() - 200];
      
      const stats = limiter.getStats();
      
      expect(stats.remaining).toBe(3); // 5 - 2
    });
  });

  describe('reset method', () => {
    it('should clear all internal state', () => {
      const limiter = new RateLimiter({ maxRequests: 3 });
      
      limiter['requests'] = [Date.now(), Date.now() - 100];
      limiter['lastRequestTime'] = Date.now();
      limiter['activeCount'] = 2;
      
      limiter.reset();
      
      expect(limiter.getRequestCount()).toBe(0);
      expect(limiter['requests']).toHaveLength(0);
      expect(limiter['lastRequestTime']).toBe(0);
      expect(limiter['activeCount']).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle Infinity values correctly', () => {
      const limiter = new RateLimiter({
        maxRequests: Infinity,
        maxConcurrent: Infinity
      });
      
      // Should not throw errors with infinite values
      expect(() => limiter.getStats()).not.toThrow();
      expect(() => limiter.getRequestCount()).not.toThrow();
    });

    it('should handle zero values in configuration', () => {
      const limiter = new RateLimiter({
        maxRequests: 0,
        maxConcurrent: 0,
        minDelayMs: 0,
        windowMs: 0
      });
      
      expect(limiter['config'].maxRequests).toBe(0);
      expect(limiter['config'].maxConcurrent).toBe(0);
      expect(limiter['config'].minDelayMs).toBe(0);
      expect(limiter['config'].windowMs).toBe(0);
    });
  });
});
