/**
 * Sticky-On Latch Pattern
 *
 * Prevents cache invalidation from dynamic feature flags by "latching"
 * flags to true once activated. A toggled flag changes the API request
 * signature, which busts server-side prompt caches (50-70K tokens).
 *
 * The insight: the cost of keeping a header/flag on (minor behavioral change)
 * is vastly cheaper than cache re-creation.
 *
 * Inspired by Claude Code's latched beta headers pattern
 * (afkModeHeaderLatched, fastModeHeaderLatched, cacheEditingHeaderLatched).
 *
 * Usage:
 *   import { StickyLatch } from './utils/latch.js'
 *
 *   const fastModeLatch = new StickyLatch('fast-mode')
 *
 *   // On feature activation:
 *   fastModeLatch.activate()
 *
 *   // Check if header should be sent:
 *   const isActive = isFeatureEnabled()
 *   const shouldSend = fastModeLatch.shouldInclude(isActive)
 *   // → true if either live state OR latched state is true
 *
 *   // Reset on session clear:
 *   fastModeLatch.reset()
 */

export class StickyLatch {
  public readonly name: string;
  private latched: boolean | null = null;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Evaluate whether the flag should be included in the request.
   *
   * Logic: liveValue || latchedValue
   * Once latched to true, stays true until explicit reset.
   */
  shouldInclude(liveValue: boolean): boolean {
    if (liveValue) {
      // Latch on first live activation
      if (this.latched === null) {
        this.latched = true;
      }
      return true;
    }
    return this.latched === true;
  }

  /**
   * Explicitly activate the latch
   */
  activate(): void {
    this.latched = true;
  }

  /**
   * Check if the latch has been activated (regardless of live state)
   */
  get isLatched(): boolean {
    return this.latched === true;
  }

  /**
   * Get current latch state (null = not yet evaluated)
   */
  get state(): boolean | null {
    return this.latched;
  }

  /**
   * Reset the latch to initial state.
   * Call this on session clear/reset.
   */
  reset(): void {
    this.latched = null;
  }
}

/**
 * Registry of named latches for bulk management
 */
export class LatchRegistry {
  private latches = new Map<string, StickyLatch>();

  /**
   * Get or create a latch by name
   */
  get(name: string): StickyLatch {
    let latch = this.latches.get(name);
    if (!latch) {
      latch = new StickyLatch(name);
      this.latches.set(name, latch);
    }
    return latch;
  }

  /**
   * Evaluate a flag with latching
   */
  shouldInclude(name: string, liveValue: boolean): boolean {
    return this.get(name).shouldInclude(liveValue);
  }

  /**
   * Get all latch states (for logging/debugging)
   */
  getStates(): Record<string, boolean | null> {
    const states: Record<string, boolean | null> = {};
    for (const [name, latch] of this.latches) {
      states[name] = latch.state;
    }
    return states;
  }

  /**
   * Reset all latches (e.g., on session clear)
   */
  resetAll(): void {
    for (const latch of this.latches.values()) {
      latch.reset();
    }
  }

  /**
   * Clear all latches entirely
   */
  clear(): void {
    this.latches.clear();
  }
}
