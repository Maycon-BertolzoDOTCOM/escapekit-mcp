/**
 * Memoization Utilities
 *
 * Caching wrappers with TTL and stale-while-revalidate support.
 * Inspired by Claude Code's utils/memoize.ts.
 *
 * Usage:
 *   import { memoizeWithTTL, memoizeWithTTLAsync } from './utils/memoize.js'
 *
 *   // Sync: returns stale value immediately, refreshes in background
 *   const getCached = memoizeWithTTL(() => expensiveCall(), 5 * 60 * 1000)
 *
 *   // Async: deduplicates concurrent calls with same args
 *   const getAsync = memoizeWithTTLAsync(async () => fetch(url), 60_000)
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  refreshing: boolean;
}

/**
 * Memoize a sync function with TTL.
 * Returns stale value immediately and refreshes in background.
 */
export function memoizeWithTTL<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
  ttlMs: number = 5 * 60 * 1000,
): ((...args: Args) => Result) & { cache: { clear: () => void } } {
  const cache = new Map<string, CacheEntry<Result>>();

  const memoized = (...args: Args): Result => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    const now = Date.now();

    if (!cached) {
      const value = fn(...args);
      cache.set(key, { value, timestamp: now, refreshing: false });
      return value;
    }

    // Stale? Refresh in background, return stale value
    if (now - cached.timestamp > ttlMs && !cached.refreshing) {
      cached.refreshing = true;
      const staleEntry = cached;
      Promise.resolve()
        .then(() => {
          const newValue = fn(...args);
          if (cache.get(key) === staleEntry) {
            cache.set(key, { value: newValue, timestamp: Date.now(), refreshing: false });
          }
        })
        .catch(() => {
          if (cache.get(key) === staleEntry) {
            cache.delete(key);
          }
        });
    }

    return cached.value;
  };

  return Object.assign(memoized, {
    cache: { clear: () => cache.clear() },
  });
}

/**
 * Memoize an async function with TTL.
 * Deduplicates concurrent calls with the same arguments.
 */
export function memoizeWithTTLAsync<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  ttlMs: number = 5 * 60 * 1000,
): ((...args: Args) => Promise<Result>) & { cache: { clear: () => void } } {
  const cache = new Map<string, CacheEntry<Result>>();
  const inFlight = new Map<string, Promise<Result>>();

  const memoized = async (...args: Args): Promise<Result> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    const now = Date.now();

    if (!cached) {
      // Deduplicate concurrent calls
      const pending = inFlight.get(key);
      if (pending) return pending;

      const promise = fn(...args);
      inFlight.set(key, promise);

      try {
        const result = await promise;
        if (inFlight.get(key) === promise) {
          cache.set(key, { value: result, timestamp: now, refreshing: false });
        }
        return result;
      } finally {
        if (inFlight.get(key) === promise) {
          inFlight.delete(key);
        }
      }
    }

    // Stale? Refresh in background
    if (now - cached.timestamp > ttlMs && !cached.refreshing) {
      cached.refreshing = true;
      const staleEntry = cached;
      fn(...args)
        .then((newValue) => {
          if (cache.get(key) === staleEntry) {
            cache.set(key, { value: newValue, timestamp: Date.now(), refreshing: false });
          }
        })
        .catch(() => {
          if (cache.get(key) === staleEntry) {
            cache.delete(key);
          }
        });
    }

    return cached.value;
  };

  return Object.assign(memoized, {
    cache: { clear: () => { cache.clear(); inFlight.clear(); } },
  });
}

/**
 * Simple memoize without TTL — caches forever until cleared
 */
export function memoize<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): ((...args: Args) => Result) & { cache: { clear: () => void; size: number } } {
  const cache = new Map<string, Result>();

  const memoized = (...args: Args): Result => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  return Object.assign(memoized, {
    cache: {
      clear: () => cache.clear(),
      get size() { return cache.size; },
    },
  });
}
