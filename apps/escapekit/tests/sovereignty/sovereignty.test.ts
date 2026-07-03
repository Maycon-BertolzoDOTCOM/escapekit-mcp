/**
 * Chinese Technological Sovereignty Features - Unit Tests (自主创新)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { SecurityValidator } from '../../src/security/SecurityValidator.js';
import { AuditLogger } from '../../src/audit/AuditLogger.js';
import { MirrorRegistry, DEFAULT_MIRRORS } from '../../src/mirrors/MirrorRegistry.js';
import { OfflinePackageCache } from '../../src/cache/OfflinePackageCache.js';
import { LockFileGenerator } from '../../src/lockfile/LockFileGenerator.js';
import { RateLimiter } from '../../src/ratelimit/RateLimiter.js';

// ── SecurityValidator ─────────────────────────────────────────────────────────
describe('SecurityValidator', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  it('should return safe=true for a clean package', async () => {
    const result = await validator.validate('axios', {
      license: 'MIT',
      lastUpdate: new Date().toISOString(),
      deprecated: false,
    });
    expect(result.safe).toBe(true);
    expect(result.vulnerabilities).toHaveLength(0);
    expect(result.deprecated).toBe(false);
  });

  it('should detect known CVE vulnerabilities', async () => {
    const result = await validator.validate('event-stream');
    expect(result.safe).toBe(false);
    expect(result.vulnerabilities.length).toBeGreaterThan(0);
    expect(result.vulnerabilities[0]).toContain('CVE');
  });

  it('should mark deprecated packages as unsafe', async () => {
    const result = await validator.validate('old-package', { deprecated: true });
    expect(result.deprecated).toBe(true);
    expect(result.safe).toBe(false);
    expect(result.warnings.some(w => w.includes('deprecated'))).toBe(true);
  });

  it('should check license compatibility', () => {
    expect(validator.checkLicense('MIT')).toBe(true);
    expect(validator.checkLicense('Apache-2.0')).toBe(true);
    expect(validator.checkLicense('GPL-3.0')).toBe(false);
    expect(validator.checkLicense(undefined)).toBe(true); // unknown = assume ok
  });

  it('should check maintenance status', () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 25 * 30 * 24 * 60 * 60 * 1000).toISOString(); // 25 months ago
    expect(validator.checkLastUpdate(recent)).toBe(true);
    expect(validator.checkLastUpdate(old)).toBe(false);
    expect(validator.checkLastUpdate(undefined)).toBe(true); // unknown = assume ok
  });

  it('should warn on stale packages', async () => {
    const oldDate = new Date(Date.now() - 25 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = await validator.validate('stale-pkg', { lastUpdate: oldDate });
    expect(result.maintained).toBe(false);
    expect(result.warnings.some(w => w.includes('updated'))).toBe(true);
  });

  it('should check maintainer count', () => {
    expect(validator.checkMaintainers(1)).toBe(true);
    expect(validator.checkMaintainers(0)).toBe(false);
  });

  it('should use isSafe() helper', async () => {
    const result = await validator.validate('axios', { license: 'MIT' });
    expect(validator.isSafe(result)).toBe(result.safe);
  });

  it('should respect custom allowed licenses', async () => {
    const strictValidator = new SecurityValidator({ allowedLicenses: ['MIT'] });
    const result = await strictValidator.validate('pkg', { license: 'Apache-2.0' });
    expect(result.licenseCompatible).toBe(false);
  });
});

// ── AuditLogger ───────────────────────────────────────────────────────────────
describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    auditLogger = new AuditLogger();
  });

  it('should log requests and retrieve entries', () => {
    auditLogger.logRequest({ operation: 'packageExists', packageName: 'axios', mirror: 'npmjs', success: true, duration: 50 });
    auditLogger.logRequest({ operation: 'getLatestVersion', packageName: 'lodash', mirror: 'npmmirror', success: true, duration: 30 });

    const entries = auditLogger.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].operation).toBe('packageExists');
    expect(entries[0].packageName).toBe('axios');
    expect(entries[0].timestamp).toBeDefined();
  });

  it('should calculate statistics correctly', () => {
    auditLogger.logRequest({ operation: 'op1', mirror: 'npmjs', success: true, duration: 100 });
    auditLogger.logRequest({ operation: 'op2', mirror: 'npmmirror', success: true, duration: 200 });
    auditLogger.logRequest({ operation: 'op3', mirror: 'npmjs', success: false, duration: 50, error: 'timeout' });

    const stats = auditLogger.getStatistics();
    expect(stats.totalRequests).toBe(3);
    expect(stats.successfulRequests).toBe(2);
    expect(stats.failedRequests).toBe(1);
    expect(stats.successRate).toBeCloseTo(2/3);
    expect(stats.averageDuration).toBeCloseTo((100 + 200 + 50) / 3);
    expect(stats.mirrorUsage['npmjs']).toBe(2);
    expect(stats.mirrorUsage['npmmirror']).toBe(1);
  });

  it('should return zero stats when empty', () => {
    const stats = auditLogger.getStatistics();
    expect(stats.totalRequests).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.averageDuration).toBe(0);
  });

  it('should export logs to file', async () => {
    auditLogger.logRequest({ operation: 'test', mirror: 'npmjs', success: true, duration: 10 });
    const outputPath = join(tmpdir(), `audit-test-${Date.now()}.json`);
    await auditLogger.exportLogs(outputPath);
    const content = await readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].operation).toBe('test');
  });

  it('should clear entries', () => {
    auditLogger.logRequest({ operation: 'op', mirror: 'npmjs', success: true, duration: 10 });
    auditLogger.clear();
    expect(auditLogger.getEntries()).toHaveLength(0);
  });
});

// ── MirrorRegistry ────────────────────────────────────────────────────────────
describe('MirrorRegistry', () => {
  it('should include Chinese mirrors by default', () => {
    const registry = new MirrorRegistry();
    const mirrors = registry.getMirrors();
    expect(mirrors.some(m => m.name === 'npmmirror')).toBe(true);
    expect(mirrors.some(m => m.name === 'npmjs')).toBe(true);
  });

  it('should prioritize Chinese mirrors (lower priority number = higher priority)', () => {
    const registry = new MirrorRegistry();
    const mirrors = registry.getMirrors();
    const npmmirror = mirrors.find(m => m.name === 'npmmirror')!;
    const npmjs = mirrors.find(m => m.name === 'npmjs')!;
    expect(npmmirror.priority).toBeLessThan(npmjs.priority);
  });

  it('should exclude Chinese mirrors when disabled', () => {
    const registry = new MirrorRegistry({ enableChineseMirrors: false });
    const mirrors = registry.getMirrors();
    expect(mirrors.some(m => m.name === 'npmmirror')).toBe(false);
    expect(mirrors.some(m => m.name === 'npmjs')).toBe(true);
  });

  it('should throw in offline mode', async () => {
    const registry = new MirrorRegistry({ offlineMode: true });
    await expect(registry.fetch('axios')).rejects.toThrow('Offline mode');
  });

  it('should include custom mirrors', () => {
    const custom = { name: 'custom', url: 'https://custom.registry.com', priority: 0, timeout: 3000 };
    const registry = new MirrorRegistry({ customMirrors: [custom] });
    const mirrors = registry.getMirrors();
    expect(mirrors.some(m => m.name === 'custom')).toBe(true);
  });

  it('should have correct timeouts: 5s for Chinese, 10s for global', () => {
    const registry = new MirrorRegistry();
    const mirrors = registry.getMirrors();
    const npmmirror = mirrors.find(m => m.name === 'npmmirror')!;
    const npmjs = mirrors.find(m => m.name === 'npmjs')!;
    expect(npmmirror.timeout).toBe(5000);
    expect(npmjs.timeout).toBe(10000);
  });

  it('DEFAULT_MIRRORS should have 3 entries', () => {
    expect(DEFAULT_MIRRORS).toHaveLength(3);
  });
});

// ── OfflinePackageCache ───────────────────────────────────────────────────────
describe('OfflinePackageCache', () => {
  let cache: OfflinePackageCache;
  const tmpDir = join(tmpdir(), `pkg-cache-test-${Date.now()}`);

  beforeEach(() => {
    cache = new OfflinePackageCache({ cacheDir: tmpDir });
  });

  afterEach(() => {
    cache.clear();
  });

  it('should return null for uncached packages', () => {
    expect(cache.getCached('axios')).toBeNull();
  });

  it('should populate and retrieve packages', async () => {
    await cache.populate([
      { name: 'axios', version: '1.6.0', exists: true, cachedAt: new Date().toISOString() },
      { name: 'lodash', version: '4.17.21', exists: true, cachedAt: new Date().toISOString() },
    ]);

    expect(cache.getCached('axios')).not.toBeNull();
    expect(cache.getCached('axios')!.version).toBe('1.6.0');
    expect(cache.getCached('lodash')).not.toBeNull();
    expect(cache.size()).toBe(2);
  });

  it('should export cache to file', async () => {
    await cache.populate([
      { name: 'react', version: '18.0.0', exists: true, cachedAt: new Date().toISOString() },
    ]);

    const exportPath = join(tmpDir, 'export.json');
    await cache.exportCache(exportPath);

    const content = await readFile(exportPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('react');
  });

  it('should clear memory cache', async () => {
    await cache.populate([
      { name: 'axios', version: '1.0.0', exists: true, cachedAt: new Date().toISOString() },
    ]);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.getCached('axios')).toBeNull();
  });

  it('should load from disk after populate', async () => {
    await cache.populate([
      { name: 'express', version: '4.18.0', exists: true, cachedAt: new Date().toISOString() },
    ]);

    // Create new cache instance pointing to same dir
    const cache2 = new OfflinePackageCache({ cacheDir: tmpDir });
    await cache2.loadFromDisk();
    expect(cache2.getCached('express')).not.toBeNull();
    expect(cache2.getCached('express')!.version).toBe('4.18.0');
  });
});

// ── LockFileGenerator ─────────────────────────────────────────────────────────
describe('LockFileGenerator', () => {
  let generator: LockFileGenerator;

  beforeEach(() => {
    generator = new LockFileGenerator();
  });

  it('should generate a lock file with correct structure', () => {
    const deps = new Map([['axios', '^1.6.0'], ['lodash', '^4.17.21']]);
    const lockFile = generator.generate('my-project', '1.0.0', deps);

    expect(lockFile.lockfileVersion).toBe(3);
    expect(lockFile.name).toBe('my-project');
    expect(lockFile.version).toBe('1.0.0');
    expect(lockFile.generatedAt).toBeDefined();
    expect(Object.keys(lockFile.packages)).toHaveLength(2);
  });

  it('should include resolved URLs for each package', () => {
    const deps = new Map([['axios', '^1.6.0']]);
    const lockFile = generator.generate('test', '1.0.0', deps);
    const entry = lockFile.packages['node_modules/axios'];
    expect(entry.resolved).toContain('registry.npmjs.org');
    expect(entry.resolved).toContain('axios');
  });

  it('should calculate integrity hashes', () => {
    const integrity = generator.calculateIntegrity('axios', '1.6.0');
    expect(integrity).toMatch(/^sha256-/);
    // Deterministic - same input = same output
    expect(generator.calculateIntegrity('axios', '1.6.0')).toBe(integrity);
  });

  it('should write and validate lock file', async () => {
    const deps = new Map([['axios', '^1.6.0']]);
    const lockFile = generator.generate('test', '1.0.0', deps);
    const outputPath = join(tmpdir(), `lockfile-test-${Date.now()}.json`);
    await generator.writeToFile(lockFile, outputPath);

    const result = await generator.validate(outputPath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid lock file', async () => {
    const invalidPath = join(tmpdir(), `invalid-lock-${Date.now()}.json`);
    const { writeFile } = await import('fs/promises');
    await writeFile(invalidPath, JSON.stringify({ invalid: true }), 'utf-8');

    const result = await generator.validate(invalidPath);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle empty dependencies', () => {
    const lockFile = generator.generate('empty-project', '0.1.0', new Map());
    expect(Object.keys(lockFile.packages)).toHaveLength(0);
  });
});

// ── RateLimiter ───────────────────────────────────────────────────────────────
describe('RateLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
    const start = Date.now();
    await limiter.throttle();
    await limiter.throttle();
    await limiter.throttle();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500); // Should be fast
    expect(limiter.getRequestCount()).toBe(3);
  });

  it('should enforce minimum delay between requests', async () => {
    const limiter = new RateLimiter({ maxRequests: 100, windowMs: 10000, minDelayMs: 50 });
    const start = Date.now();
    await limiter.throttle();
    await limiter.throttle();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it('should reset state', async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
    await limiter.throttle();
    await limiter.throttle();
    limiter.reset();
    expect(limiter.getRequestCount()).toBe(0);
  });

  it('should track request count in window', async () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 5000 });
    await limiter.throttle();
    await limiter.throttle();
    expect(limiter.getRequestCount()).toBe(2);
  });

  it('should work with no minDelay', async () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
    const start = Date.now();
    await limiter.throttle();
    await limiter.throttle();
    await limiter.throttle();
    expect(Date.now() - start).toBeLessThan(200);
  });
});
