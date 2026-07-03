/**
 * Idle Timeout Manager
 *
 * Manages a timeout that triggers after a period of inactivity.
 * Resets on each activity signal.
 *
 * Inspired by Claude Code's utils/idleTimeout.ts.
 *
 * Usage:
 *   import { IdleTimeout } from './utils/idleTimeout.js'
 *
 *   const idle = new IdleTimeout({
 *     timeoutMs: 30000,
 *     onIdle: () => console.log('Idle for 30s'),
 *     onWarning: () => console.log('About to go idle...'),
 *     warningMs: 5000,
 *   })
 *
 *   idle.start()
 *   // ... later ...
 *   idle.reset()  // Reset the timer
 *   idle.stop()   // Stop monitoring
 */

export interface IdleTimeoutOptions {
  /** Timeout in ms before onIdle fires */
  timeoutMs: number;
  /** Callback when idle timeout is reached */
  onIdle: () => void;
  /** Optional warning callback fired before actual timeout */
  onWarning?: () => void;
  /** Time before timeout to fire warning (default: timeoutMs / 2) */
  warningMs?: number;
  /** Whether to auto-restart after idle (default: false) */
  autoRestart?: boolean;
}

export class IdleTimeout {
  private timeoutMs: number;
  private warningMs: number;
  private onIdle: () => void;
  private onWarning?: () => void;
  private autoRestart: boolean;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private lastResetTime = 0;

  constructor(options: IdleTimeoutOptions) {
    this.timeoutMs = options.timeoutMs;
    this.warningMs = options.warningMs ?? options.timeoutMs / 2;
    this.onIdle = options.onIdle;
    this.onWarning = options.onWarning;
    this.autoRestart = options.autoRestart ?? false;
  }

  /**
   * Start the idle timer
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleTimers();
  }

  /**
   * Reset the idle timer (activity detected)
   */
  reset(): void {
    if (!this.running) return;
    this.cancelTimers();
    this.scheduleTimers();
  }

  /**
   * Stop the idle timer
   */
  stop(): void {
    this.running = false;
    this.cancelTimers();
  }

  /**
   * Whether the timer is running
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Time since last reset in ms
   */
  get timeSinceReset(): number {
    if (this.lastResetTime === 0) return 0;
    return Date.now() - this.lastResetTime;
  }

  /**
   * Remaining time until idle in ms
   */
  get remainingMs(): number {
    return Math.max(0, this.timeoutMs - this.timeSinceReset);
  }

  private scheduleTimers(): void {
    this.lastResetTime = Date.now();

    if (this.warningMs > 0 && this.onWarning) {
      this.warningTimer = setTimeout(() => {
        if (this.running) this.onWarning?.();
      }, this.warningMs);
    }

    this.timer = setTimeout(() => {
      if (!this.running) return;
      this.onIdle();
      if (this.autoRestart) {
        this.scheduleTimers();
      } else {
        this.running = false;
      }
    }, this.timeoutMs);
  }

  private cancelTimers(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }
}
