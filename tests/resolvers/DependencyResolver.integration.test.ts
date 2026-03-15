/**
 * DependencyResolver - testes com mocks (sem rede)
 *
 * Valida o fluxo completo de resolução incluindo:
 * - Validação NPM com retry
 * - Modo offline
 * - Marcação UNVERIFIED
 * - Rate limiting
 * - Estatísticas de queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyResolver } from '../../src/resolvers/DependencyResolver.js';
import { NPMRegistry } from '../../src/services/NPMRegistry.js';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import { SemanticMatcher } from '../../src/resolvers/SemanticMatcher.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const { REAL_PACKAGES } = vi.hoisted(() => ({
  REAL_PACKAGES: new Set(['axios', 'lodash', 'react', 'express', 'typescript']),
}));

vi.mock('../../src/services/NPMRegistry.js', () => ({
  NPMRegistry: vi.fn().mockImplementation(() => ({
    packageExists: vi.fn().mockImplementation(async (name: string) =>
      REAL_PACKAGES.has(name)
    ),
    getLatestVersion: vi.fn().mockImplementation(async (name: string) =>
      REAL_PACKAGES.has(name) ? '^1.0.0' : 'unknown'
    ),
    getCacheStats: vi.fn().mockReturnValue({ size: 3, entries: [] }),
    clearCache: vi.fn(),
  })),
}));

vi.mock('../../src/resolvers/SemanticMatcher.js', () => ({
  SemanticMatcher: vi.fn().mockImplementation(() => ({
    findSimilar: vi.fn().mockResolvedValue([]),
    analyzePackage: vi.fn().mockResolvedValue({ name: 'unknown', deprecated: false }),
    clearCache: vi.fn(),
  })),
}));

describe('DependencyResolver Integration - NPM Registry (mocked)', () => {
  let resolver: DependencyResolver;
  let npmRegistry: NPMRegistry;
  let knowledgeBase: KnowledgeBase;
  let semanticMatcher: SemanticMatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    npmRegistry = new NPMRegistry();
    knowledgeBase = new KnowledgeBase();
    semanticMatcher = new SemanticMatcher(npmRegistry);
    resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher);
  });

  describe('NPM Registry Validation', () => {
    it('should mark resolution as VERIFIED when package exists', async () => {
      resolver.addManualMapping('test-ghost', 'axios');

      const resolution = await resolver.resolve('test-ghost');

      expect(resolution.resolvedPackage).toBe('axios');
      expect(resolution.metadata?.validationStatus).toBe('VERIFIED');
      expect(resolution.version).not.toBe('unknown');
    });

    it('should mark resolution as UNVERIFIED when package does not exist', async () => {
      resolver.addManualMapping('test-ghost', 'this-package-definitely-does-not-exist-xyz-123');

      const resolution = await resolver.resolve('test-ghost');

      expect(resolution.resolvedPackage).toBe('this-package-definitely-does-not-exist-xyz-123');
      expect(resolution.metadata?.validationStatus).toBe('UNVERIFIED');
      expect(resolution.confidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe('Offline Mode', () => {
    it('should work in offline mode with cached data', async () => {
      resolver.addManualMapping('test-ghost', 'axios');
      await resolver.resolve('test-ghost');

      const offlineResolver = new DependencyResolver(
        npmRegistry,
        knowledgeBase,
        semanticMatcher,
        { offlineMode: true }
      );
      offlineResolver.addManualMapping('test-ghost', 'axios');

      const resolution = await offlineResolver.resolve('test-ghost');

      expect(resolution.resolvedPackage).toBe('axios');
      expect(resolution.confidence).toBeGreaterThan(0);
    });
  });

  describe('NPM Query Statistics', () => {
    it('should track NPM query statistics', async () => {
      resolver.addManualMapping('ghost1', 'axios');
      resolver.addManualMapping('ghost2', 'lodash');
      resolver.addManualMapping('ghost3', 'nonexistent-package-xyz');

      await resolver.resolve('ghost1');
      await resolver.resolve('ghost2');
      await resolver.resolve('ghost3');

      const stats = resolver.getNPMQueryStats();

      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.successfulQueries).toBeGreaterThan(0);
      expect(stats.unverifiedPackages).toBeGreaterThan(0);
    });

    it('should track cache hits and misses', async () => {
      resolver.addManualMapping('test-ghost', 'axios');

      await resolver.resolve('test-ghost');
      await resolver.resolve('test-ghost');

      const cacheStats = resolver.getCacheStats();

      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting between requests', async () => {
      const resolverWithRateLimit = new DependencyResolver(
        npmRegistry,
        knowledgeBase,
        semanticMatcher,
        { enableRateLimiting: true, rateLimitDelay: 100 }
      );

      resolverWithRateLimit.addManualMapping('ghost1', 'axios');
      resolverWithRateLimit.addManualMapping('ghost2', 'lodash');

      const startTime = Date.now();
      await resolverWithRateLimit.resolve('ghost1');
      await resolverWithRateLimit.resolve('ghost2');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should work without rate limiting when disabled', async () => {
      const resolverNoRateLimit = new DependencyResolver(
        npmRegistry,
        knowledgeBase,
        semanticMatcher,
        { enableRateLimiting: false }
      );

      resolverNoRateLimit.addManualMapping('ghost1', 'axios');
      resolverNoRateLimit.addManualMapping('ghost2', 'lodash');

      const startTime = Date.now();
      await resolverNoRateLimit.resolve('ghost1');
      await resolverNoRateLimit.resolve('ghost2');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Batch Resolution', () => {
    it('should resolve multiple packages and track statistics', async () => {
      resolver.addManualMapping('ghost1', 'axios');
      resolver.addManualMapping('ghost2', 'lodash');
      resolver.addManualMapping('ghost3', 'react');

      const resolutions = await resolver.resolveBatch(['ghost1', 'ghost2', 'ghost3']);

      expect(resolutions).toHaveLength(3);
      expect(resolutions[0].resolvedPackage).toBe('axios');
      expect(resolutions[1].resolvedPackage).toBe('lodash');
      expect(resolutions[2].resolvedPackage).toBe('react');

      const stats = resolver.getNPMQueryStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
    });
  });

  describe('Validation Status in Reasoning', () => {
    it('should include UNVERIFIED status in reasoning text', async () => {
      resolver.addManualMapping('test-ghost', 'nonexistent-package-xyz-123');

      const resolution = await resolver.resolve('test-ghost');

      expect(resolution.metadata?.reasoning).toContain('UNVERIFIED');
    });

    it('should not include UNVERIFIED in reasoning for verified packages', async () => {
      resolver.addManualMapping('test-ghost', 'axios');

      const resolution = await resolver.resolve('test-ghost');

      expect(resolution.metadata?.reasoning).not.toContain('UNVERIFIED');
    });
  });
});
