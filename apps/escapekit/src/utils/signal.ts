/**
 * Signal — Lightweight Event Emitter
 *
 * Minimal pub/sub primitive without stored state.
 * Inspired by Claude Code's createSignal in utils/signal.ts.
 *
 * Usage:
 *   const onChanged = createSignal<[string, number]>()
 *
 *   const unsubscribe = onChanged.subscribe((name, value) => {
 *     console.log(`${name}: ${value}`)
 *   })
 *
 *   onChanged.emit('count', 42)
 *   unsubscribe()
 *   onChanged.clear()
 */

export type Signal<Args extends unknown[] = []> = {
  subscribe: (listener: (...args: Args) => void) => () => void;
  emit: (...args: Args) => void;
  clear: () => void;
};

/**
 * Create a new signal
 */
export function createSignal<Args extends unknown[] = []>(): Signal<Args> {
  const listeners = new Set<(...args: Args) => void>();

  return {
    subscribe(listener: (...args: Args) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    emit(...args: Args): void {
      for (const listener of listeners) {
        listener(...args);
      }
    },

    clear(): void {
      listeners.clear();
    },
  };
}

/**
 * Signal that stores the last emitted value.
 * New subscribers immediately receive the current value.
 *
 * Usage:
 *   const count = createBehaviorSignal(0)
 *   count.subscribe(v => console.log(v))  // immediately logs 0
 *   count.emit(5)  // logs 5
 */
export function createBehaviorSignal<T>(initialValue: T): Signal<[T]> & { getValue: () => T } {
  const signal = createSignal<[T]>();
  let currentValue = initialValue;

  return {
    subscribe(listener: (value: T) => void): () => void {
      listener(currentValue);
      return signal.subscribe(listener);
    },
    emit(value: T): void {
      currentValue = value;
      signal.emit(value);
    },
    clear(): void {
      signal.clear();
    },
    getValue(): T {
      return currentValue;
    },
  };
}
