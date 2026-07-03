/**
 * Chinese Technological Sovereignty Features - Integration Tests (自主创新)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { OfflinePackageCache } from '../../src/cache/OfflinePackageCache.js';
import { SecurityValidator } from '../../src/security/SecurityValidator.js';
import { AuditLogger } from '../../src/audit/AuditLogger.js';
import { MirrorRegistry } from '../../src/mirrors/MirrorRegistry.js';
import { LockFileGenerator } from '../../src/lockfile/LockFileGenerator.js';
import { RateLimiter } from '../../src/ratelimit/RateLimiter.js';

// Shared test fixtures
const SAFE_PACKAGES = [
  {
    name: 'lodash',
    version: '4.17.21',
    exists: true,
    cachedAt: new Date().toISOString(),
    metadata: { license: 'MIT', deprecated: false },
  },
  {
    name: 'express',
    version: '4.18.2',
    exists: true,
    cachedAt: new Date().toISOString(),
    metadata: { license: 'MIT', deprecated: false },
  },
  {
    name: 'typescript',
    version: '5.3.3',
    exists: true,
    cachedAt: new Date().toISOString(),
    metadata: { license: 'Apache-2.0', deprecated: false },
  },
];

const UNSAFE_PACKAGES = [
  {
    name: 'event-stream',
    version: '3.3.6',
    exists: true,
    cachedAt: new Date().toISOString(),
    metadata: { license: 'MIT', deprecated: true },
  },
  {
    name: 'node-ipc',
    version: '10.1.0',
    exists: true,
    cachedAt: new Date().toISOString(),
    metadata: { license: 'MIT', deprecated: false },
  },
];

describe('Sovereignty Integration Tests (自主创新)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `sovereignty-test-${Date.now()}`);
  });

  // ─── Test 1: Complete Offline Flow ───────────────────────────────────────────

  describe('1. Complete offline flow', () => {
    it('validates packages from cache without network, logging all operations', async () => {
      const cache = new OfflinePackageCache({ cacheDir: join(tmpDir, 'cache') });
      const validator = new SecurityValidator();
      const audit = new AuditLogger();

      // Populate cache
      await cache.populate(SAFE_PACKAGES);
      expect(cache.size()).toBe(3);

      // Validate each cached package - no network needed
      for (const pkg of SAFE_PACKAGES) {
        const cached = cache.getCached(pkg.name);
        expect(cached).not.toBeNull();

        const start = Date.now();
        const result = await validator.validate(pkg.name, {
          version: cached!.version,
          license: cached!.metadata?.license,
          deprecated: cached!.metadata?.deprecated,
        });
        const duration = Date.now() - start;

        audit.logRequest({
          operation: 'security-validate',
          packageName: pkg.name,
          mirror: 'offline-cache',
          success: result.safe,
          duration,
        });

        expect(result.safe).toBe(true);
        expect(result.vulnerabilities).toHaveLength(0);
      }

      const stats = audit.getStatistics();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(3);
      expect(stats.failedRequests).toBe(0);
      expect(stats.mirrorUsage['offline-cache']).toBe(3);
    });
  });

  // ─── Test 2: Security + Audit Integration ────────────────────────────────────

  describe('2. Security + Audit integration', () => {
    it('reflects correct counts after validating safe and unsafe packages', async () => {
      const validator = new SecurityValidator();
      const audit = new AuditLogger();

      const allPackages = [...SAFE_PACKAGES, ...UNSAFE_PACKAGES];

      for (const pkg of allPackages) {
        const start = Date.now();
        const result = await validator.validate(pkg.name, {
          version: pkg.version,
          license: pkg.metadata.license,
          deprecated: pkg.metadata.deprecated,
        });
        const duration = Date.now() - start;

        audit.logRequest({
          operation: 'security-validate',
          packageName: pkg.name,
          mirror: 'local',
          success: result.safe,
          duration,
          error: result.safe ? undefined : result.vulnerabilities[0] ?? result.warnings[0],
        });
      }

      const stats = audit.getStatistics();

      // 3 safe + 2 unsafe = 5 total
      expect(stats.totalRequests).toBe(5);
      // Only the 3 safe packages should have success=true
      expect(stats.successfulRequests).toBe(3);
      expect(stats.failedRequests).toBe(2);
      expect(stats.successRate).toBeCloseTo(0.6);

      // Verify individual entries for unsafe packages
      const entries = audit.getEntries();
      const eventStreamEntry = entries.find(e => e.packageName === 'event-stream');
      expect(eventStreamEntry?.success).toBe(false);

      const nodeIpcEntry = entries.find(e => e.packageName === 'node-ipc');
      expect(nodeIpcEntry?.success).toBe(false);
    });
  });

  // ─── Test 3: Mirror Fallback + Audit ─────────────────────────────────────────

  describe('3. Mirror fallback + Audit', () => {
    it('logs a failed audit entry when offline mode blocks network fetch', async () => {
      const registry = new MirrorRegistry({ offlineMode: true });
      const audit = new AuditLogger();

      const start = Date.now();
      let errorMessage = '';

      try {
        await registry.fetch('lodash');
      } catch (err) {
        errorMessage = (err as Error).message;
      }

      const duration = Date.now() - start;

      expect(errorMessage).toMatch(/offline/i);

      audit.logRequest({
        operation: 'mirror-fetch',
        packageName: 'lodash',
        mirror: 'npmmirror',
        success: false,
        duration,
        error: errorMessage,
      });

      const entries = audit.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].success).toBe(false);
      expect(entries[0].error).toMatch(/offline/i);
      expect(entries[0].operation).toBe('mirror-fetch');

      const stats = audit.getStatistics();
      expect(stats.failedRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
    });
  });

  // ─── Test 4: Lock File + Cache Integration ────────────────────────────────────

  describe('4. Lock file + Cache integration', () => {
    it('generates a valid lock file from cached packages with integrity hashes', async () => {
      const cache = new OfflinePackageCache({ cacheDir: join(tmpDir, 'cache') });
      const generator = new LockFileGenerator();

      await cache.populate(SAFE_PACKAGES);

      // Build dependency map from cache
      const deps = new Map<string, string>();
      for (const pkg of SAFE_PACKAGES) {
        const cached = cache.getCached(pkg.name);
        if (cached) deps.set(cached.name, cached.version);
      }

      const lockFile = generator.generate('test-project', '1.0.0', deps);

      expect(lockFile.lockfileVersion).toBe(3);
      expect(lockFile.name).toBe('test-project');
      expect(Object.keys(lockFile.packages)).toHaveLength(3);

      // Verify integrity hashes are present and correctly formatted
      for (const entry of Object.values(lockFile.packages)) {
        expect(entry.integrity).toBeTruthy();
        expect(entry.integrity).toMatch(/^sha256-/);
      }

      // Write to temp file and validate
      const lockPath = join(tmpDir, 'package-lock.json');
      await generator.writeToFile(lockFile, lockPath);

      const raw = await readFile(lockPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.name).toBe('test-project');
      expect(parsed.packages['node_modules/lodash']).toBeDefined();

      const validation = await generator.validate(lockPath);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  // ─── Test 5: Rate Limiter + Audit Integration ─────────────────────────────────

  describe('5. Rate limiter + Audit integration', () => {
    it('throttles requests and audit statistics reflect correct counts and timing', async () => {
      // Small window so the test stays fast
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 100 });
      const audit = new AuditLogger();

      const packages = ['lodash', 'express', 'typescript'];
      const start = Date.now();

      for (const pkg of packages) {
        await limiter.throttle();
        const reqStart = Date.now();

        // Simulate a fast "request"
        await Promise.resolve();

        audit.logRequest({
          operation: 'registry-fetch',
          packageName: pkg,
          mirror: 'npmmirror',
          success: true,
          duration: Date.now() - reqStart,
        });
      }

      const elapsed = Date.now() - start;

      // All 3 requests fit within the window - should be fast
      expect(elapsed).toBeLessThan(500);

      const stats = audit.getStatistics();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(3);
      expect(stats.mirrorUsage['npmmirror']).toBe(3);

      // Verify request count tracking
      expect(limiter.getRequestCount()).toBeLessThanOrEqual(3);
    });

    it('waits when window is exhausted before allowing more requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 150 });
      const audit = new AuditLogger();

      // Fill the window
      await limiter.throttle();
      audit.logRequest({ operation: 'fetch', mirror: 'npmmirror', success: true, duration: 1 });
      await limiter.throttle();
      audit.logRequest({ operation: 'fetch', mirror: 'npmmirror', success: true, duration: 1 });

      // Third request must wait for window to expire
      const waitStart = Date.now();
      await limiter.throttle();
      const waited = Date.now() - waitStart;
      audit.logRequest({ operation: 'fetch', mirror: 'npmmirror', success: true, duration: waited });

      // Should have waited at least a bit for the window
      expect(waited).toBeGreaterThan(0);

      const stats = audit.getStatistics();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(3);
    });
  });

  // ─── Test 6: Full Sovereignty Pipeline ───────────────────────────────────────

  describe('6. Full sovereignty pipeline (air-gapped)', () => {
    it('resolves, validates, audits, and locks packages entirely offline', async () => {
      const cache = new OfflinePackageCache({ cacheDir: join(tmpDir, 'pipeline-cache') });
      const validator = new SecurityValidator();
      const audit = new AuditLogger();
      const generator = new LockFileGenerator();

      const allPackages = [...SAFE_PACKAGES, ...UNSAFE_PACKAGES];

      // Step 1: Pre-populate cache
      await cache.populate(allPackages);
      expect(cache.size()).toBe(allPackages.length);

      // Step 2: Validate each cached package and log
      const validatedDeps = new Map<string, string>();

      for (const pkg of allPackages) {
        const cached = cache.getCached(pkg.name);
        expect(cached).not.toBeNull();

        const start = Date.now();
        const result = await validator.validate(pkg.name, {
          version: cached!.version,
          license: cached!.metadata?.license,
          deprecated: cached!.metadata?.deprecated,
        });
        const duration = Date.now() - start;

        audit.logRequest({
          operation: 'security-validate',
          packageName: pkg.name,
          mirror: 'offline-cache',
          success: result.safe,
          duration,
          error: result.safe ? undefined : (result.vulnerabilities[0] ?? result.warnings[0]),
        });

        if (result.safe) {
          validatedDeps.set(pkg.name, cached!.version);
        }
      }

      // Step 3: Verify audit log has an entry for every package
      const entries = audit.getEntries();
      expect(entries).toHaveLength(allPackages.length);
      for (const pkg of allPackages) {
        expect(entries.some(e => e.packageName === pkg.name)).toBe(true);
      }

      // Step 4: Only safe packages made it through
      expect(validatedDeps.size).toBe(SAFE_PACKAGES.length);
      for (const pkg of SAFE_PACKAGES) {
        expect(validatedDeps.has(pkg.name)).toBe(true);
      }
      for (const pkg of UNSAFE_PACKAGES) {
        expect(validatedDeps.has(pkg.name)).toBe(false);
      }

      // Step 5: Generate and validate lock file from safe packages only
      const lockFile = generator.generate('air-gapped-project', '1.0.0', validatedDeps);
      expect(Object.keys(lockFile.packages)).toHaveLength(SAFE_PACKAGES.length);

      const lockPath = join(tmpDir, 'pipeline-lock.json');
      await generator.writeToFile(lockFile, lockPath);

      const validation = await generator.validate(lockPath);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Step 6: Final audit statistics
      const stats = audit.getStatistics();
      expect(stats.totalRequests).toBe(allPackages.length);
      expect(stats.successfulRequests).toBe(SAFE_PACKAGES.length);
      expect(stats.failedRequests).toBe(UNSAFE_PACKAGES.length);
      expect(stats.successRate).toBeCloseTo(SAFE_PACKAGES.length / allPackages.length);
    });
  });
});
