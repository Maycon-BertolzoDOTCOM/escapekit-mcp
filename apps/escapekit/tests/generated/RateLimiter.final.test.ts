import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../../src/ratelimit/RateLimiter';

describe('RateLimiter (Final Tests)', () => {
  describe('concurrent limit enforcement', () => {
    it('should respect maxConcurrent limit', async () => {
      const limiter = new RateLimiter({ maxConcurrent: 2 });
      let concurrent = 0;
      let maxConcurrent = 0;

      const tasks = Array(5).fill(0).map(async (_, i) => {
        await limiter.execute(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrent--;
        });
      });

      await Promise.all(tasks);
      expect(maxConcurrent).toBe(2);
    });

    it('should queue tasks when concurrent limit reached', async () => {
      const limiter = new RateLimiter({ maxConcurrent: 1 });
      const executionOrder: number[] = [];

      const task1 = limiter.execute(async () => {
        executionOrder.push(1);
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      const task2 = limiter.execute(async () => {
        executionOrder.push(2);
      });

      await Promise.all([task1, task2]);
      expect(executionOrder).toEqual([1, 2]);
    });
  });

  describe('error handling', () => {
    it('should handle function failures gracefully', async () => {
      const limiter = new RateLimiter();
      const failingFn = () => Promise.reject(new Error('Test error'));

      await expect(limiter.execute(failingFn)).rejects.toThrow('Test error');
    });

    it('should continue processing after failures', async () => {
      const limiter = new RateLimiter({ maxConcurrent: 1 });
      let successCount = 0;

      const tasks = [
        limiter.execute(() => Promise.reject(new Error('Fail'))),
        limiter.execute(() => { successCount++; return Promise.resolve(); })
      ];

      await Promise.allSettled(tasks);
      expect(successCount).toBe(1);
    });
  });

  describe('configuration validation', () => {
    it('should validate negative values in config', () => {
      expect(() => new RateLimiter({ maxRequests: -1 })).toThrow();
      expect(() => new RateLimiter({ maxConcurrent: -1 })).toThrow();
      expect(() => new RateLimiter({ windowMs: -1000 })).toThrow();
    });

    it('should validate zero values correctly', () => {
      const limiter = new RateLimiter({ maxRequests: 0, maxConcurrent: 0 });
      expect(limiter['config'].maxRequests).toBe(0);
      expect(limiter['config'].maxConcurrent).toBe(0);
    });
  });
});