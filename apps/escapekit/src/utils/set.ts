/**
 * Set Operations
 *
 * Optimized set operations for hot paths.
 * Uses raw for-of loops instead of reduce/filter to avoid intermediate allocations.
 *
 * Inspired by Claude Code's utils/set.ts.
 *
 * Usage:
 *   import { difference, intersects, union, isSubset } from './utils/set.js'
 *
 *   const a = new Set([1, 2, 3])
 *   const b = new Set([2, 3, 4])
 *
 *   difference(a, b)   // Set([1])
 *   intersects(a, b)   // true
 *   union(a, b)        // Set([1, 2, 3, 4])
 *   isSubset(a, b)     // false
 *   isSubset(new Set([2, 3]), b)  // true
 */

/**
 * Returns elements in A that are NOT in B
 */
export function difference<A>(a: ReadonlySet<A>, b: ReadonlySet<A>): Set<A> {
  const result = new Set<A>();
  for (const item of a) {
    if (!b.has(item)) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Returns true if A and B share at least one element.
 * Short-circuits on first match.
 */
export function intersects<A>(a: ReadonlySet<A>, b: ReadonlySet<A>): boolean {
  if (a.size === 0 || b.size === 0) {
    return false;
  }
  // Iterate over the smaller set
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of smaller) {
    if (larger.has(item)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the union of A and B
 */
export function union<A>(a: ReadonlySet<A>, b: ReadonlySet<A>): Set<A> {
  const result = new Set<A>(a);
  for (const item of b) {
    result.add(item);
  }
  return result;
}

/**
 * Returns true if A is a subset of B (every element of A is in B)
 */
export function isSubset<A>(a: ReadonlySet<A>, b: ReadonlySet<A>): boolean {
  if (a.size > b.size) return false;
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the symmetric difference (elements in A or B but not both)
 */
export function symmetricDifference<A>(a: ReadonlySet<A>, b: ReadonlySet<A>): Set<A> {
  const result = new Set<A>();
  for (const item of a) {
    if (!b.has(item)) {
      result.add(item);
    }
  }
  for (const item of b) {
    if (!a.has(item)) {
      result.add(item);
    }
  }
  return result;
}
