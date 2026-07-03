/**
 * Hook Registry
 *
 * Centralized hook registration, execution, and lifecycle management.
 * Supports prioritized execution, abort propagation, and timing.
 *
 * Inspired by Claude Code's hook system (src/hooks.ts, src/types/hooks.ts).
 *
 * Usage:
 *   import { hookRegistry, registerHook, executeHooks } from './hooks/registry.js'
 *
 *   // Register a hook
 *   const id = registerHook('PostAnalysis', async (ctx) => {
 *     console.log('Analysis completed:', ctx.output)
 *     return { continue: true }
 *   }, { name: 'analysis-logger', priority: 100 })
 *
 *   // Execute hooks (called by the pipeline)
 *   const result = await executeHooks('PostAnalysis', {
 *     event: 'PostAnalysis',
 *     output: analysisResult,
 *     abortController: new AbortController(),
 *   })
 *
 *   if (result.blocked) {
 *     console.log('Blocked by hook:', result.blockMessage)
 *   }
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../logger.js';
import type {
  HookContext,
  HookEvent,
  HookExecutionResult,
  HookHandler,
  HookRegistration,
} from './types.js';

const logger = createLogger('Hooks');

/**
 * Options for registering a hook
 */
export interface RegisterOptions {
  /** Human-readable name for logging */
  name?: string;
  /** Priority — lower runs first (default: 100) */
  priority?: number;
}

/**
 * Hook Registry — singleton managing all hook registrations
 */
export class HookRegistry {
  private registrations: Map<HookEvent, HookRegistration[]> = new Map();
  private active = true;

  /**
   * Register a hook handler for an event
   *
   * @returns Registration ID (use to unregister later)
   */
  register(
    event: HookEvent,
    handler: HookHandler,
    options: RegisterOptions = {},
  ): string {
    const id = uuidv4();
    const registration: HookRegistration = {
      id,
      event,
      handler,
      name: options.name ?? `hook-${event}-${id.slice(0, 8)}`,
      priority: options.priority ?? 100,
    };

    if (!this.registrations.has(event)) {
      this.registrations.set(event, []);
    }

    const hooks = this.registrations.get(event)!;
    hooks.push(registration);

    // Sort by priority (lower first)
    hooks.sort((a, b) => a.priority - b.priority);

    logger.debug(`Registered hook: ${registration.name} (${event}, priority=${registration.priority})`);

    return id;
  }

  /**
   * Unregister a hook by ID
   */
  unregister(registrationId: string): boolean {
    for (const [event, hooks] of this.registrations) {
      const index = hooks.findIndex((h) => h.id === registrationId);
      if (index !== -1) {
        hooks.splice(index, 1);
        logger.debug(`Unregistered hook: ${registrationId} (${event})`);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute all hooks for an event in priority order.
   * Stops if any hook returns continue=false.
   */
  async execute(event: HookEvent, ctx: Omit<HookContext, 'event' | 'timestamp'>): Promise<HookExecutionResult> {
    const startTime = performance.now();
    const hooks = this.registrations.get(event) ?? [];

    if (hooks.length === 0 || !this.active) {
      return {
        event,
        hooksExecuted: 0,
        blocked: false,
        durationMs: Math.round(performance.now() - startTime),
        results: [],
      };
    }

    const fullCtx: HookContext = {
      ...ctx,
      event,
      timestamp: Date.now(),
    };

    const results: HookExecutionResult['results'] = [];
    let blocked = false;
    let blockMessage: string | undefined;

    for (const hook of hooks) {
      if (fullCtx.abortController.signal.aborted) {
        break;
      }

      const hookStart = performance.now();
      try {
        const result = await hook.handler(fullCtx);
        const hookDuration = Math.round(performance.now() - hookStart);

        results.push({
          id: hook.id,
          name: hook.name ?? hook.id,
          result,
          durationMs: hookDuration,
        });

        if (!result.continue) {
          blocked = true;
          blockMessage = result.message ?? `Blocked by hook: ${hook.name}`;
          logger.warn(`Hook ${hook.name} blocked execution: ${blockMessage}`);

          // Abort the parent operation if handler set it
          if (!fullCtx.abortController.signal.aborted) {
            fullCtx.abortController.abort();
          }
          break;
        }

        // Apply transformed output if provided (Pre* hooks)
        if (result.transformed !== undefined) {
          fullCtx.input = result.transformed;
        }
      } catch (error) {
        const hookDuration = Math.round(performance.now() - hookStart);
        const errorMsg = error instanceof Error ? error.message : String(error);

        logger.error(`Hook ${hook.name} threw error: ${errorMsg}`, error);

        results.push({
          id: hook.id,
          name: hook.name ?? hook.id,
          result: { continue: false, message: errorMsg },
          durationMs: hookDuration,
        });

        // Hook errors block by default (fail-safe)
        blocked = true;
        blockMessage = `Hook error in ${hook.name}: ${errorMsg}`;
        break;
      }
    }

    return {
      event,
      hooksExecuted: results.length,
      blocked,
      blockMessage,
      durationMs: Math.round(performance.now() - startTime),
      results,
    };
  }

  /**
   * Get all registered hooks for an event
   */
  getHooks(event: HookEvent): HookRegistration[] {
    const hooks = this.registrations.get(event);
    return hooks ? [...hooks] : [];
  }

  /**
   * Get total count of registered hooks
   */
  get count(): number {
    let total = 0;
    for (const hooks of Array.from(this.registrations.values())) {
      total += hooks.length;
    }
    return total;
  }

  /**
   * Activate/deactivate hook execution
   */
  setActive(active: boolean): void {
    this.active = active;
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.registrations.clear();
    logger.debug('All hooks cleared');
  }
}

/**
 * Default singleton instance
 */
export const hookRegistry = new HookRegistry();

/**
 * Convenience: register a hook
 */
export function registerHook(
  event: HookEvent,
  handler: HookHandler,
  options?: RegisterOptions,
): string {
  return hookRegistry.register(event, handler, options);
}

/**
 * Convenience: execute hooks for an event
 */
export async function executeHooks(
  event: HookEvent,
  ctx: Omit<HookContext, 'event' | 'timestamp'>,
): Promise<HookExecutionResult> {
  return hookRegistry.execute(event, ctx);
}

/**
 * Convenience: unregister a hook
 */
export function unregisterHook(registrationId: string): boolean {
  return hookRegistry.unregister(registrationId);
}
