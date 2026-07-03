/**
 * Lazy Schema Factory
 *
 * Memoized factory that defers construction until first call.
 * Inspired by Claude Code's utils/lazySchema.ts.
 *
 * Usage:
 *   const schema = lazySchema(() => z.object({ name: z.string() }))
 *   // Schema is only created on first access
 *   schema() // creates and returns
 *   schema() // returns cached
 */

export function lazySchema<T>(factory: () => T): () => T {
  let value: T | undefined;
  let initialized = false;

  return (): T => {
    if (!initialized) {
      value = factory();
      initialized = true;
    }
    return value as T;
  };
}
