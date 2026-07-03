/**
 * Query Guard — State machine for preventing concurrent operations.
 *
 * Guards against concurrent analysis operations on the same target.
 * Uses generation numbers to prevent stale cleanup.
 *
 * Inspired by Claude Code's QueryGuard and AnimeThree's query_guard.py.
 *
 * Usage:
 *   import { QueryGuard, GuardRegistry } from './utils/queryGuard.js'
 *
 *   const guard = new QueryGuard()
 *   if (guard.reserve()) {
 *     const gen = guard.tryStart()
 *     if (gen) {
 *       try { await analyze(code) }
 *       finally { guard.end(gen) }
 *     }
 *   }
 */

import { createSignal } from './signal.js';

export type GuardStatus = 'idle' | 'dispatching' | 'running';

export class QueryGuard {
  private status: GuardStatus = 'idle';
  private generation = 0;
  private readonly changed = createSignal();

  /**
   * Reserve the guard. Transitions idle → dispatching.
   * Returns false if not idle.
   */
  reserve(): boolean {
    if (this.status !== 'idle') return false;
    this.status = 'dispatching';
    this.changed.emit();
    return true;
  }

  /**
   * Cancel a reservation. Transitions dispatching → idle.
   */
  cancelReservation(): void {
    if (this.status !== 'dispatching') return;
    this.status = 'idle';
    this.changed.emit();
  }

  /**
   * Start execution. Returns generation number or null if already running.
   */
  tryStart(): number | null {
    if (this.status === 'running') return null;
    this.status = 'running';
    this.generation++;
    this.changed.emit();
    return this.generation;
  }

  /**
   * End execution. Returns true if generation matches.
   */
  end(gen: number): boolean {
    if (this.generation !== gen) return false;
    if (this.status !== 'running') return false;
    this.status = 'idle';
    this.changed.emit();
    return true;
  }

  /**
   * Force end. Invalidates pending end() calls.
   */
  forceEnd(): void {
    if (this.status === 'idle') return;
    this.status = 'idle';
    this.generation++;
    this.changed.emit();
  }

  get isActive(): boolean {
    return this.status !== 'idle';
  }

  get currentStatus(): GuardStatus {
    return this.status;
  }

  subscribe = this.changed.subscribe;
}

/**
 * Per-target guard registry.
 */
export class GuardRegistry {
  private guards = new Map<string, QueryGuard>();

  getGuard(target: string): QueryGuard {
    let guard = this.guards.get(target);
    if (!guard) {
      guard = new QueryGuard();
      this.guards.set(target, guard);
    }
    return guard;
  }

  reserve(target: string): boolean {
    return this.getGuard(target).reserve();
  }

  release(target: string): void {
    this.guards.get(target)?.forceEnd();
  }

  isActive(target: string): boolean {
    return this.guards.get(target)?.isActive ?? false;
  }

  activeTargets(): string[] {
    return Array.from(this.guards.entries())
      .filter(([, g]) => g.isActive)
      .map(([t]) => t);
  }
}
