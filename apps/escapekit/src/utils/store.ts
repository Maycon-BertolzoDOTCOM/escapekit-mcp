/**
 * Simple Store
 *
 * Minimal reactive state container with subscribe/notify pattern.
 * Inspired by Claude Code's createStore in utils/store.ts.
 *
 * Usage:
 *   const store = createStore({ count: 0, name: 'test' })
 *
 *   const unsub = store.subscribe(() => {
 *     console.log(store.getState())
 *   })
 *
 *   store.setState(prev => ({ ...prev, count: prev.count + 1 }))
 *   unsub()
 */

type Listener = () => void;
type OnChange<T> = (args: { newState: T; oldState: T }) => void;

export type Store<T> = {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: Listener) => () => void;
};

/**
 * Create a simple reactive store
 */
export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,

    setState: (updater: (prev: T) => T) => {
      const prev = state;
      const next = updater(prev);
      if (Object.is(next, prev)) return;
      state = next;
      onChange?.({ newState: next, oldState: prev });
      for (const listener of listeners) listener();
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Create a derived store that computes from another store
 */
export function deriveStore<T, U>(
  source: Store<T>,
  selector: (state: T) => U,
): Store<U> {
  let current = selector(source.getState());
  const listeners = new Set<Listener>();

  source.subscribe(() => {
    const next = selector(source.getState());
    if (Object.is(next, current)) return;
    current = next;
    for (const listener of listeners) listener();
  });

  return {
    getState: () => current,
    setState: () => { throw new Error('Derived store is read-only'); },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
