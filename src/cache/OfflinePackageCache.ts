/**
 * OfflinePackageCache - Air-gapped environment support (自主创新)
 * Pre-populates and distributes package cache for offline operation.
 */
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../logger.js';

export interface CachedPackageInfo {
  name: string;
  version: string;
  exists: boolean;
  cachedAt: string;
  metadata?: {
    description?: string;
    keywords?: string[];
    license?: string;
    deprecated?: boolean;
  };
}

export interface OfflinePackageCacheOptions {
  /** Cache directory (default: ./package-cache) */
  cacheDir?: string;
}

export class OfflinePackageCache {
  private readonly log = logger.child('OfflinePackageCache');
  private readonly cacheDir: string;
  private readonly memoryCache = new Map<string, CachedPackageInfo>();

  constructor(options: OfflinePackageCacheOptions = {}) {
    this.cacheDir = options.cacheDir ?? './package-cache';
  }

  /** Pre-populate cache with package info */
  async populate(packages: CachedPackageInfo[]): Promise<void> {
    for (const pkg of packages) {
      this.memoryCache.set(pkg.name, pkg);
    }
    await this.persistCache();
    this.log.info('Cache populated', { count: packages.length });
  }

  /** Get cached package info */
  getCached(packageName: string): CachedPackageInfo | null {
    return this.memoryCache.get(packageName) ?? null;
  }

  /** Load cache from disk */
  async loadFromDisk(): Promise<void> {
    const cachePath = join(this.cacheDir, 'packages.json');
    try {
      await access(cachePath);
      const raw = await readFile(cachePath, 'utf-8');
      const entries: CachedPackageInfo[] = JSON.parse(raw);
      for (const entry of entries) {
        this.memoryCache.set(entry.name, entry);
      }
      this.log.info('Cache loaded from disk', { count: this.memoryCache.size, path: cachePath });
    } catch {
      this.log.debug('No cache file found, starting empty', { path: cachePath });
    }
  }

  /** Export cache to a distributable file */
  async exportCache(outputPath: string): Promise<void> {
    const entries = Array.from(this.memoryCache.values());
    await mkdir(join(outputPath, '..'), { recursive: true }).catch(() => {});
    await writeFile(outputPath, JSON.stringify(entries, null, 2), 'utf-8');
    this.log.info('Cache exported', { path: outputPath, entries: entries.length });
  }

  /** Get cache size */
  size(): number {
    return this.memoryCache.size;
  }

  /** Clear memory cache */
  clear(): void {
    this.memoryCache.clear();
  }

  private async persistCache(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    const cachePath = join(this.cacheDir, 'packages.json');
    const entries = Array.from(this.memoryCache.values());
    await writeFile(cachePath, JSON.stringify(entries, null, 2), 'utf-8');
  }
}
