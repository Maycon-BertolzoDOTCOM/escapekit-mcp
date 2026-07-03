/**
 * Abort Controller with parent-child hierarchy
 *
 * Creates AbortControllers with proper event listener limits and
 * memory-safe parent-child propagation using WeakRef.
 *
 * Inspired by Claude Code's utils/abortController.ts.
 *
 * Usage:
 *   import { createAbortController, createChildAbortController } from './utils/abortController.js'
 *
 *   const parent = createAbortController()
 *   const child = createChildAbortController(parent)
 *
 *   // Aborting parent aborts child
 *   parent.abort()
 *   child.signal.aborted  // true
 *
 *   // Aborting child does NOT abort parent
 *   const child2 = createChildAbortController(parent)
 *   child2.abort()
 *   parent.signal.aborted  // still false
 */

/**
 * Creates an AbortController with proper event listener limits set.
 */
export function createAbortController(maxListeners: number = 50): AbortController {
  const controller = new AbortController();

  // Set max listeners to prevent MaxListenersExceededWarning
  // Only available in Node.js
  try {
    const { setMaxListeners } = require('node:events');
    setMaxListeners(maxListeners, controller.signal);
  } catch {
    // Not in Node.js — browser environment handles this differently
  }

  return controller;
}

/**
 * Propagates abort from a parent to a weakly-referenced child controller.
 */
function propagateAbort(
  this: WeakRef<AbortController>,
  weakChild: WeakRef<AbortController>,
): void {
  const parent = this.deref();
  weakChild.deref()?.abort(parent?.signal.reason);
}

/**
 * Removes an abort handler from a weakly-referenced parent signal.
 */
function removeAbortHandler(
  this: WeakRef<AbortController>,
  weakHandler: WeakRef<(...args: unknown[]) => void>,
): void {
  const parent = this.deref();
  const handler = weakHandler.deref();
  if (parent && handler) {
    parent.signal.removeEventListener('abort', handler);
  }
}

/**
 * Creates a child AbortController that aborts when its parent aborts.
 * Aborting the child does NOT affect the parent.
 *
 * Memory-safe: Uses WeakRef so the parent doesn't retain abandoned children.
 */
export function createChildAbortController(
  parent: AbortController,
  maxListeners?: number,
): AbortController {
  const child = createAbortController(maxListeners);

  // Fast path: parent already aborted
  if (parent.signal.aborted) {
    child.abort(parent.signal.reason);
    return child;
  }

  const weakChild = new WeakRef(child);
  const weakParent = new WeakRef(parent);
  const handler = propagateAbort.bind(weakParent, weakChild);

  parent.signal.addEventListener('abort', handler, { once: true });

  child.signal.addEventListener(
    'abort',
    removeAbortHandler.bind(weakParent, new WeakRef(handler)),
    { once: true },
  );

  return child;
}
