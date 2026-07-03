/**
 * Promise.withResolvers() Polyfill
 *
 * Polyfill for ES2024 Promise.withResolvers().
 * Inspired by Claude Code's withResolvers utility.
 *
 * Usage:
 *   import { withResolvers } from './utils/withResolvers.js'
 *
 *   const { promise, resolve, reject } = withResolvers<string>()
 *
 *   // Use resolve/reject from outside the promise
 *   setTimeout(() => resolve('done'), 1000)
 *   const result = await promise
 */

export type PromiseWithResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

/**
 * Create a promise with externally-accessible resolve and reject functions.
 */
export function withResolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
