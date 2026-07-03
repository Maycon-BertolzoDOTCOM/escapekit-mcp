/**
 * Cleanup Registry
 *
 * Global registry for cleanup functions that should run during graceful shutdown.
 * Returns an unregister function for cleanup.
 *
 * Inspired by Claude Code's utils/cleanupRegistry.ts.
 *
 * Usage:
 *   import { registerCleanup, runCleanupFunctions } from './utils/cleanupRegistry.js'
 *
 *   // Register cleanup
 *   const unregister = registerCleanup(async () => {
 *     await db.close()
 *   })
 *
 *   // Later, unregister if no longer needed
 *   unregister()
 *
 *   // On shutdown:
 *   await runCleanupFunctions()
 */

const cleanupFunctions = new Set<() => Promise<void>>();

/**
 * Register a cleanup function to run during graceful shutdown.
 * @returns Unregister function that removes the cleanup handler
 */
export function registerCleanup(cleanupFn: () => Promise<void>): () => void {
  cleanupFunctions.add(cleanupFn);
  return () => cleanupFunctions.delete(cleanupFn);
}

/**
 * Run all registered cleanup functions in parallel.
 */
export async function runCleanupFunctions(): Promise<void> {
  await Promise.all(Array.from(cleanupFunctions).map((fn) => fn()));
}

/**
 * Get count of registered cleanup functions
 */
export function getCleanupCount(): number {
  return cleanupFunctions.size;
}
