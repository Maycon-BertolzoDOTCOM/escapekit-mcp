import { describe, it, expect } from 'vitest';
import { OfflinePackageCache } from '../../src/cache/OfflinePackageCache';

describe('OfflinePackageCache', () => {
  describe('constructor', () => {
    it('should create cache with default directory', () => {
      const cache = new OfflinePackageCache();
      expect(cache).toBeDefined();
      expect(cache.size()).toBe(0);
    });

    it('should create cache with custom directory', () => {
      const cache = new OfflinePackageCache({ cacheDir: '/tmp/test-cache' });
      expect(cache).toBeDefined();
    });
  });

  describe('getCached', () => {
    it('should return null for non-existent package', () => {
      const cache = new OfflinePackageCache();
      const result = cache.getCached('non-existent');
      expect(result).toBeNull();
    });

    it('should return cached package info', async () => {
      const cache = new OfflinePackageCache();
      await cache.populate([
        { name: 'test-package', version: '1.0.0', exists: true, cachedAt: new Date().toISOString() }
      ]);
      const result = cache.getCached('test-package');
      expect(result).toBeDefined();
      expect(result?.name).toBe('test-package');
    });
  });

  describe('size', () => {
    it('should return zero for empty cache', () => {
      const cache = new OfflinePackageCache();
      expect(cache.size()).toBe(0);
    });

    it('should return count after populate', async () => {
      const cache = new OfflinePackageCache();
      await cache.populate([
        { name: 'pkg1', version: '1.0.0', exists: true, cachedAt: new Date().toISOString() },
        { name: 'pkg2', version: '2.0.0', exists: true, cachedAt: new Date().toISOString() }
      ]);
      expect(cache.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear cache', async () => {
      const cache = new OfflinePackageCache();
      await cache.populate([
        { name: 'test', version: '1.0.0', exists: true, cachedAt: new Date().toISOString() }
      ]);
      expect(cache.size()).toBe(1);
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });
});
