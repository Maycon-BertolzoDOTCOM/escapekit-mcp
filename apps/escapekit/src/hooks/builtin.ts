/**
 * Built-in Hooks
 *
 * Pre-configured hooks for common tasks:
 *   - LoggingHook: logs duration and outcome of each phase
 *   - MetricsHook: collects timing metrics
 *
 * Usage:
 *   import { registerBuiltinHooks, metricsCollector } from './hooks/builtin.js'
 *
 *   // At startup:
 *   registerBuiltinHooks()
 *
 *   // After pipeline completes:
 *   const metrics = metricsCollector.getMetrics()
 */

import { registerHook } from './registry.js';
import { createLogger } from '../logger.js';
import type { HookContext, HookResult } from './types.js';

const logger = createLogger('BuiltinHooks');

// ─── Logging Hook ──────────────────────────────────────────────────────────

/**
 * Log hook execution with duration and outcome
 */
function createLoggingHook(event: string) {
  return async (ctx: HookContext): Promise<HookResult> => {
    const inputSize = ctx.input ? JSON.stringify(ctx.input).length : 0;
    const outputSize = ctx.output ? JSON.stringify(ctx.output).length : 0;

    logger.info(`${event} hook fired`, {
      event: ctx.event,
      hasInput: !!ctx.input,
      hasOutput: !!ctx.output,
      inputSize,
      outputSize,
      meta: ctx.meta,
    });

    return { continue: true };
  };
}

// ─── Metrics Hook ──────────────────────────────────────────────────────────

interface PhaseMetrics {
  event: string;
  count: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastTimestamp: number;
}

/**
 * Collects timing metrics for each hook event
 */
export class MetricsCollector {
  private metrics: Map<string, PhaseMetrics> = new Map();

  /**
   * Record a hook execution
   */
  record(event: string, durationMs: number): void {
    const existing = this.metrics.get(event);
    if (existing) {
      existing.count++;
      existing.totalDurationMs += durationMs;
      existing.minDurationMs = Math.min(existing.minDurationMs, durationMs);
      existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
      existing.lastTimestamp = Date.now();
    } else {
      this.metrics.set(event, {
        event,
        count: 1,
        totalDurationMs: durationMs,
        minDurationMs: durationMs,
        maxDurationMs: durationMs,
        lastTimestamp: Date.now(),
      });
    }
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PhaseMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for a specific event
   */
  getMetricsForEvent(event: string): PhaseMetrics | undefined {
    return this.metrics.get(event);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Get summary string
   */
  getSummary(): string {
    const lines = this.getMetrics().map(
      (m) =>
        `  ${m.event}: ${m.count} calls, avg ${Math.round(m.totalDurationMs / m.count)}ms, ` +
        `min ${m.minDurationMs}ms, max ${m.maxDurationMs}ms`,
    );
    return `Metrics Summary:\n${lines.join('\n')}`;
  }
}

export const metricsCollector = new MetricsCollector();

function createMetricsHook() {
  return async (ctx: HookContext): Promise<HookResult> => {
    // Duration is tracked by the registry's execute() method,
    // but we also record the event type for counting
    metricsCollector.record(ctx.event, 0);
    return { continue: true };
  };
}

// ─── Registration ──────────────────────────────────────────────────────────

/**
 * Register all built-in hooks.
 * Call this once at application startup.
 */
export function registerBuiltinHooks(): void {
  const events = [
    'PreAnalysis',
    'PostAnalysis',
    'PreTransform',
    'PostTransform',
    'PreValidation',
    'PostValidation',
    'PreGeneration',
    'PostGeneration',
  ] as const;

  for (const event of events) {
    // Logging hook (priority 50 — runs first)
    registerHook(event, createLoggingHook(event), {
      name: `logging-${event}`,
      priority: 50,
    });

    // Metrics hook (priority 60 — runs second)
    registerHook(event, createMetricsHook(), {
      name: `metrics-${event}`,
      priority: 60,
    });
  }

  logger.info(`Registered ${events.length * 2} built-in hooks`);
}
