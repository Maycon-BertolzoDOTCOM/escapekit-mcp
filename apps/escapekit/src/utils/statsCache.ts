/**
 * Stats Cache with Migration
 *
 * Persisted cache with version migration support.
 * Uses atomic file writes (write to temp, then rename) for crash safety.
 *
 * Inspired by Claude Code's utils/statsCache.ts.
 *
 * Usage:
 *   import { StatsCache } from './utils/statsCache.js'
 *
 *   const cache = new StatsCache<{ hits: number }>({
 *     path: '.escapekit/stats.json',
 *     version: 2,
 *     migrations: {
 *       '1': (data) => ({ ...data, hits: 0 }),
 *       '2': (data) => ({ ...data, lastReset: new Date().toISOString() }),
 *     },
 *   })
 *
 *   await cache.load()
 *   cache.data.hits++
 *   await cache.save()
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createLogger } from '../logger.js';

const logger = createLogger('StatsCache');

export interface StatsCacheOptions<T> {
  /** Path to the cache file */
  path: string;
  /** Current schema version */
  version: number;
  /** Migration functions keyed by source version */
  migrations?: Record<string, (data: unknown) => T>;
  /** Factory for default data */
  defaultFactory?: () => T;
}

export class StatsCache<T extends Record<string, unknown>> {
  public data: T;
  private readonly path: string;
  private readonly version: number;
  private readonly migrations: Record<string, (data: unknown) => T>;
  private readonly defaultFactory: () => T;

  constructor(options: StatsCacheOptions<T>) {
    this.path = options.path;
    this.version = options.version;
    this.migrations = options.migrations ?? {};
    this.defaultFactory = options.defaultFactory ?? (() => ({} as T));
    this.data = this.defaultFactory();
  }

  /**
   * Load data from disk, applying migrations if needed.
   */
  async load(): Promise<void> {
    if (!existsSync(this.path)) {
      this.data = this.defaultFactory();
      return;
    }

    try {
      const raw = readFileSync(this.path, 'utf-8');
      const parsed = JSON.parse(raw) as { version?: number; data: unknown };

      if (parsed.version === this.version) {
        this.data = parsed.data as T;
        return;
      }

      // Apply migrations
      this.data = this._migrate(parsed.version ?? 0, parsed.data);
      logger.info(`Migrated stats cache v${parsed.version ?? 0} → v${this.version}`);
      await this.save();
    } catch (error) {
      logger.warn(`Failed to load stats cache, using defaults: ${error}`);
      this.data = this.defaultFactory();
    }
  }

  /**
   * Save data to disk atomically (write temp + rename).
   */
  async save(): Promise<void> {
    const dir = dirname(this.path);
    mkdirSync(dir, { recursive: true });

    const envelope = {
      version: this.version,
      data: this.data,
      savedAt: new Date().toISOString(),
    };

    const content = JSON.stringify(envelope, null, 2);
    const tmpPath = join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    try {
      writeFileSync(tmpPath, content, 'utf-8');
      renameSync(tmpPath, this.path);
    } catch (error) {
      // Clean up temp file on failure
      try {
        const { unlinkSync } = require('node:fs');
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Reset data to defaults
   */
  reset(): void {
    this.data = this.defaultFactory();
  }

  /**
   * Apply version migrations sequentially
   */
  private _migrate(fromVersion: number, data: unknown): T {
    let current = data as T;
    for (let v = fromVersion + 1; v <= this.version; v++) {
      const migration = this.migrations[String(v)];
      if (migration) {
        current = migration(current);
      }
    }
    return current;
  }
}
