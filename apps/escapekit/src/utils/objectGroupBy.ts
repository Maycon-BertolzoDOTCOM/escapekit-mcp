/**
 * Object GroupBy
 *
 * Polyfill for Object.groupBy (ES2024).
 * Inspired by Claude Code's objectGroupBy utility.
 *
 * Usage:
 *   import { objectGroupBy } from './utils/objectGroupBy.js'
 *
 *   const items = [
 *     { type: 'a', value: 1 },
 *     { type: 'b', value: 2 },
 *     { type: 'a', value: 3 },
 *   ]
 *
 *   const grouped = objectGroupBy(items, item => item.type)
 *   // { a: [{ type: 'a', value: 1 }, { type: 'a', value: 3 }], b: [{ type: 'b', value: 2 }] }
 */

/**
 * Group items by a key selector function.
 * Returns a partial record where each key maps to an array of items.
 */
export function objectGroupBy<T, K extends PropertyKey>(
  items: Iterable<T>,
  keySelector: (item: T, index: number) => K,
): Partial<Record<K, T[]>> {
  const result = Object.create(null) as Partial<Record<K, T[]>>;
  let index = 0;

  for (const item of items) {
    const key = keySelector(item, index++);
    if (result[key] === undefined) {
      result[key] = [];
    }
    (result[key] as T[]).push(item);
  }

  return result;
}

/**
 * Count items by a key selector function.
 */
export function objectCountBy<T, K extends PropertyKey>(
  items: Iterable<T>,
  keySelector: (item: T, index: number) => K,
): Partial<Record<K, number>> {
  const result = Object.create(null) as Partial<Record<K, number>>;
  let index = 0;

  for (const item of items) {
    const key = keySelector(item, index++);
    result[key] = ((result[key] as number) ?? 0) + 1;
  }

  return result;
}

/**
 * Index items by a unique key. Later items overwrite earlier ones.
 */
export function objectIndexBy<T, K extends PropertyKey>(
  items: Iterable<T>,
  keySelector: (item: T, index: number) => K,
): Partial<Record<K, T>> {
  const result = Object.create(null) as Partial<Record<K, T>>;
  let index = 0;

  for (const item of items) {
    const key = keySelector(item, index++);
    result[key] = item;
  }

  return result;
}
