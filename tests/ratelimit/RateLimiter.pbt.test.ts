import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { RateLimiter } from '../../src/ratelimit/RateLimiter.js';

// Feature: ratelimiter-unification, Property 1: Window count invariant
// Validates: Requirements 7.1, 2.4
describe('Property 1: Window count invariant', () => {
  it('getRequestCount() equals N after N sequential throttle() calls within one window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }).chain(R =>
          fc.tuple(fc.constant(R), fc.integer({ min: 1, max: R }))
        ),
        async ([R, N]) => {
          const limiter = new RateLimiter({ maxRequests: R, windowMs: 60_000 });
          for (let i = 0; i < N; i++) {
            await limiter.throttle();
          }
          return limiter.getRequestCount() === N;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: ratelimiter-unification, Property 2: Token bucket invariant
// Validates: Requirements 7.3, 2.1, 2.3
describe('Property 2: Token bucket invariant', () => {
  it('no more than R calls resolve within any W-ms interval without waiting', { timeout: 60_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (R) => {
          const windowMs = 80;
          const limiter = new RateLimiter({ maxRequests: R, windowMs });
          const start = Date.now();
          // Make R+1 calls; the (R+1)th must have waited at least windowMs
          for (let i = 0; i <= R; i++) {
            await limiter.throttle();
          }
          const elapsed = Date.now() - start;
          // Allow a small tolerance for timer imprecision (10ms)
          return elapsed >= windowMs - 10;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: ratelimiter-unification, Property 3: Concurrency invariant
// Validates: Requirements 7.2, 3.2
describe('Property 3: Concurrency invariant', () => {
  it('active in-flight count never exceeds maxConcurrent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        async (K, extra) => {
          const limiter = new RateLimiter({ maxConcurrent: K });
          let maxActive = 0;
          let currentActive = 0;

          const slowFn = async () => {
            currentActive++;
            if (currentActive > maxActive) maxActive = currentActive;
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            currentActive--;
          };

          const total = K + extra;
          const calls = Array.from({ length: total }, () => limiter.execute(slowFn));
          await Promise.all(calls);

          return maxActive <= K;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: ratelimiter-unification, Property 4: Reset invariant
// Validates: Requirements 7.4, 2.5
describe('Property 4: Reset invariant', () => {
  it('getRequestCount() returns 0 immediately after reset() regardless of prior state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),
        async (N) => {
          const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
          for (let i = 0; i < N; i++) {
            await limiter.throttle();
          }
          limiter.reset();
          return limiter.getRequestCount() === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: ratelimiter-unification, Property 5: Error-release invariant
// Validates: Requirements 7.5, 4.1, 3.3
describe('Property 5: Error-release invariant', () => {
  it('after execute(throwingFn), a subsequent execute(successFn) completes successfully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        async (msg) => {
          const limiter = new RateLimiter({ maxConcurrent: 1 });
          try {
            await limiter.execute(() => Promise.reject(new Error(msg)));
          } catch {
            // expected
          }
          const result = await limiter.execute(() => Promise.resolve(42));
          return result === 42;
        }
      ),
      { numRuns: 100 }
    );
  });
});
