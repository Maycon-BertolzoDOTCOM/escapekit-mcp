/**
 * Async Generator Utilities
 *
 * Utilities for running async generators concurrently.
 * Inspired by Claude Code's generators.ts.
 *
 * Usage:
 *   import { all, toArray, fromArray } from './utils/generators.js'
 *
 *   // Run generators concurrently, yield values as they arrive
 *   async function* gen1() { yield 1; yield 2 }
 *   async function* gen2() { yield 3; yield 4 }
 *
 *   for await (const value of all([gen1(), gen2()])) {
 *     console.log(value)  // 1, 3, 2, 4 (interleaved)
 *   }
 */

/**
 * Collect all values from an async generator into an array
 */
export async function toArray<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of generator) {
    result.push(item);
  }
  return result;
}

/**
 * Create an async generator from an array
 */
export async function* fromArray<T>(values: T[]): AsyncGenerator<T> {
  for (const value of values) {
    yield value;
  }
}

/**
 * Get the last value from an async generator
 */
export async function lastValue<T>(generator: AsyncGenerator<T>): Promise<T> {
  let last: T | undefined;
  let hasValue = false;

  for await (const item of generator) {
    last = item;
    hasValue = true;
  }

  if (!hasValue) {
    throw new Error('No items in generator');
  }

  return last as T;
}

/**
 * Run multiple async generators concurrently, yielding values as they arrive.
 *
 * @param generators - Array of async generators
 * @param concurrencyCap - Max concurrent generators (default: all)
 */
export async function* all<T>(
  generators: AsyncGenerator<T>[],
  concurrencyCap: number = Infinity,
): AsyncGenerator<T> {
  const next = (
    generator: AsyncGenerator<T>,
  ): Promise<{ done: boolean | void; value: T | void; gen: AsyncGenerator<T> }> => {
    return generator.next().then(({ done, value }) => ({ done, value, gen: generator }));
  };

  const waiting = [...generators];
  const active = new Map<AsyncGenerator<T>, Promise<{ done: boolean | void; value: T | void; gen: AsyncGenerator<T> }>>();

  // Start initial batch
  while (active.size < concurrencyCap && waiting.length > 0) {
    const gen = waiting.shift()!;
    active.set(gen, next(gen));
  }

  while (active.size > 0) {
    const result = await Promise.race(active.values());
    active.delete(result.gen);

    if (!result.done) {
      const promise = next(result.gen);
      active.set(result.gen, promise);
      if (result.value !== undefined) {
        yield result.value as T;
      }
    } else if (waiting.length > 0) {
      const gen = waiting.shift()!;
      active.set(gen, next(gen));
    }
  }
}

/**
 * Map values from an async generator through a transform function
 */
export async function* map<T, U>(
  generator: AsyncGenerator<T>,
  transform: (value: T) => U | Promise<U>,
): AsyncGenerator<U> {
  for await (const item of generator) {
    yield await transform(item);
  }
}

/**
 * Filter values from an async generator
 */
export async function* filter<T>(
  generator: AsyncGenerator<T>,
  predicate: (value: T) => boolean | Promise<boolean>,
): AsyncGenerator<T> {
  for await (const item of generator) {
    if (await predicate(item)) {
      yield item;
    }
  }
}
