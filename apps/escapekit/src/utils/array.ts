/**
 * Array Utilities
 *
 * Common array manipulation functions.
 * Inspired by Claude Code's utils/array.ts.
 *
 * Usage:
 *   import { intersperse, count, uniq, uniqueBy, chunk, flatten } from './utils/array.js'
 */

/**
 * Intersperse separator elements between array items
 */
export function intersperse<A>(items: A[], separator: (index: number) => A): A[] {
  const result: A[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i > 0) result.push(separator(i - 1));
    result.push(items[i]);
  }
  return result;
}

/**
 * Count items matching a predicate
 */
export function count<T>(arr: readonly T[], pred: (x: T) => unknown): number {
  let c = 0;
  for (const item of arr) {
    if (pred(item)) c++;
  }
  return c;
}

/**
 * Remove duplicates from an iterable (preserves order)
 */
export function uniq<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

/**
 * Remove duplicates by a key function (preserves first occurrence)
 */
export function uniqueBy<T, K>(items: Iterable<T>, keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Split an array into chunks of a given size
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be positive');
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Flatten a nested array one level
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  const result: T[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...item);
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Partition an array into two arrays based on a predicate
 */
export function partition<T>(arr: T[], pred: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of arr) {
    if (pred(item)) pass.push(item);
    else fail.push(item);
  }
  return [pass, fail];
}

/**
 * Get the last element of an array
 */
export function last<T>(arr: readonly T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/**
 * Get the first element of an array
 */
export function first<T>(arr: readonly T[]): T | undefined {
  return arr.length > 0 ? arr[0] : undefined;
}

/**
 * Shuffle an array (Fisher-Yates, returns new array)
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Group array items by a key
 */
export function groupBy<T, K extends PropertyKey>(
  arr: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
