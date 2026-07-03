/**
 * Confluence Tests — Interactions between ValidationEngine, FederatedMemory, Cache
 *
 * These tests verify that component interactions don't cause:
 * - Duplicated effort (validation + federated push of same result)
 * - Inconsistency (cache says valid, federated says invalid)
 * - Cascading failures (one component failure breaks others)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Components ─────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
  fingerprint: string;
  timestamp: number;
}

interface CacheEntry {
  fingerprint: string;
  result: ValidationResult;
  source: 'local' | 'federated';
  expiresAt: number;
}

interface FederatedPattern {
  pattern_id: string;
  confidence: number;
  rules_applied: string[];
  success_rate: number;
}

class MockValidationEngine {
  private results = new Map<string, ValidationResult>();
  private callCount = 0;

  async validate(code: string): Promise<ValidationResult> {
    this.callCount++;
    const fingerprint = this._fingerprint(code);
    const existing = this.results.get(fingerprint);
    if (existing) return existing;

    const result: ValidationResult = {
      valid: !code.includes('eval(') && !code.includes('process.env'),
      errors: code.includes('eval(') ? ['eval() detected'] : [],
      fingerprint,
      timestamp: Date.now(),
    };
    this.results.set(fingerprint, result);
    return result;
  }

  private _fingerprint(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
    }
    return `fp_${Math.abs(hash).toString(16)}`;
  }

  getCallCount(): number { return this.callCount; }
  clear(): void { this.results.clear(); this.callCount = 0; }
}

class MockDeterministicCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  get(fingerprint: string): CacheEntry | null {
    const entry = this.store.get(fingerprint);
    if (entry && entry.expiresAt > Date.now()) {
      this.hits++;
      return entry;
    }
    if (entry) this.store.delete(fingerprint);
    this.misses++;
    return null;
  }

  set(fingerprint: string, result: ValidationResult, source: 'local' | 'federated' = 'local'): void {
    this.store.set(fingerprint, {
      fingerprint, result, source,
      expiresAt: Date.now() + 3600000,
    });
  }

  invalidate(fingerprint: string): void { this.store.delete(fingerprint); }
  getMetrics() { return { hits: this.hits, misses: this.misses, size: this.store.size }; }
  clear(): void { this.store.clear(); this.hits = 0; this.misses = 0; }
}

class MockFederatedMemory {
  private patterns = new Map<string, FederatedPattern>();
  private pushCount = 0;
  private pullCount = 0;
  private failureRate = 0;

  async push(fingerprint: string, result: ValidationResult): Promise<void> {
    if (Math.random() < this.failureRate) throw new Error('Federated server unavailable');
    this.pushCount++;
    this.patterns.set(fingerprint, {
      pattern_id: fingerprint,
      confidence: result.valid ? 0.9 : 0.3,
      rules_applied: result.errors,
      success_rate: result.valid ? 0.95 : 0.1,
    });
  }

  async pull(fingerprint: string): Promise<FederatedPattern | null> {
    if (Math.random() < this.failureRate) throw new Error('Federated server unavailable');
    this.pullCount++;
    return this.patterns.get(fingerprint) ?? null;
  }

  setFailureRate(rate: number): void { this.failureRate = rate; }
  getMetrics() { return { pushes: this.pushCount, pulls: this.pullCount, patterns: this.patterns.size }; }
  clear(): void { this.patterns.clear(); this.pushCount = 0; this.pullCount = 0; }
}

// ─── Confluence Orchestrator ──────────────────────────────────────────────────

class ValidationOrchestrator {
  constructor(
    private engine: MockValidationEngine,
    private cache: MockDeterministicCache,
    private federated: MockFederatedMemory,
  ) {}

  async validate(code: string): Promise<ValidationResult> {
    const fingerprint = this._fingerprint(code);

    // 1. Check cache first
    const cached = this.cache.get(fingerprint);
    if (cached) return cached.result;

    // 2. Check federated memory
    try {
      const pattern = await this.federated.pull(fingerprint);
      if (pattern && pattern.confidence > 0.7) {
        const result: ValidationResult = {
          valid: pattern.success_rate > 0.5,
          errors: pattern.rules_applied,
          fingerprint,
          timestamp: Date.now(),
        };
        this.cache.set(fingerprint, result, 'federated');
        return result;
      }
    } catch { /* Federated unavailable */ }

    // 3. Local validation
    const result = await this.engine.validate(code);

    // 4. Cache locally
    this.cache.set(fingerprint, result, 'local');

    // 5. Push to federated (fire-and-forget)
    this.federated.push(fingerprint, result).catch(() => {});

    return result;
  }

  private _fingerprint(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
    }
    return `fp_${Math.abs(hash).toString(16)}`;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Confluence: ValidationEngine + Cache + FederatedMemory', () => {
  let engine: MockValidationEngine;
  let cache: MockDeterministicCache;
  let federated: MockFederatedMemory;
  let orchestrator: ValidationOrchestrator;

  beforeEach(() => {
    engine = new MockValidationEngine();
    cache = new MockDeterministicCache();
    federated = new MockFederatedMemory();
    orchestrator = new ValidationOrchestrator(engine, cache, federated);
  });

  afterEach(() => {
    engine.clear();
    cache.clear();
    federated.clear();
  });

  describe('Cache hit prevents duplicate validation', () => {
    it('should not re-validate when cache has result', async () => {
      const code = 'const x = 1;';
      await orchestrator.validate(code);
      expect(engine.getCallCount()).toBe(1);
      await orchestrator.validate(code);
      expect(engine.getCallCount()).toBe(1);
      expect(cache.getMetrics().hits).toBe(1);
    });

    it('should track cache hit rate correctly', async () => {
      for (const code of ['const a = 1;', 'const b = 2;', 'const a = 1;']) {
        await orchestrator.validate(code);
      }
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(2);
      expect(metrics.size).toBe(2);
    });
  });

  describe('Federated memory integration', () => {
    it('should use federated result when confidence is high', async () => {
      const code = 'const x = 1;';
      const fingerprint = (orchestrator as any)._fingerprint(code);
      await federated.push(fingerprint, { valid: true, errors: [], fingerprint, timestamp: Date.now() });
      (federated as any).patterns.set(fingerprint, {
        pattern_id: fingerprint, confidence: 0.95, rules_applied: [], success_rate: 0.95,
      });
      const result = await orchestrator.validate(code);
      expect(result.valid).toBe(true);
      expect(engine.getCallCount()).toBe(0);
    });

    it('should fall back to local when federated is unavailable', async () => {
      federated.setFailureRate(1.0);
      const result = await orchestrator.validate('const x = 1;');
      expect(result.valid).toBe(true);
      expect(engine.getCallCount()).toBe(1);
    });

    it('should fall back to local when federated confidence is low', async () => {
      const code = 'const x = 1;';
      const fingerprint = (orchestrator as any)._fingerprint(code);
      (federated as any).patterns.set(fingerprint, {
        pattern_id: fingerprint, confidence: 0.3, rules_applied: [], success_rate: 0.3,
      });
      await orchestrator.validate(code);
      expect(engine.getCallCount()).toBe(1);
    });
  });

  describe('No duplicated effort', () => {
    it('should not push to federated when result came from federated', async () => {
      const code = 'const x = 1;';
      const fingerprint = (orchestrator as any)._fingerprint(code);
      (federated as any).patterns.set(fingerprint, {
        pattern_id: fingerprint, confidence: 0.95, rules_applied: [], success_rate: 0.95,
      });
      await orchestrator.validate(code);
      expect(federated.getMetrics().pushes).toBe(0);
    });

    it('should push to federated only after local validation', async () => {
      await orchestrator.validate('const x = 1;');
      await new Promise(r => setTimeout(r, 10));
      expect(federated.getMetrics().pushes).toBe(1);
    });
  });

  describe('Consistency between sources', () => {
    it('should return consistent results regardless of source', async () => {
      const code = 'const x = 1;';
      const fingerprint = (orchestrator as any)._fingerprint(code);
      const localResult = await orchestrator.validate(code);
      cache.invalidate(fingerprint);
      (federated as any).patterns.set(fingerprint, {
        pattern_id: fingerprint, confidence: 0.95, rules_applied: [], success_rate: 0.95,
      });
      const federatedResult = await orchestrator.validate(code);
      expect(federatedResult.valid).toBe(localResult.valid);
    });

    it('should handle conflicting results gracefully', async () => {
      const code = 'const x = 1;';
      const fingerprint = (orchestrator as any)._fingerprint(code);
      (federated as any).patterns.set(fingerprint, {
        pattern_id: fingerprint, confidence: 0.95, rules_applied: ['fake error'], success_rate: 0.1,
      });
      const result = await orchestrator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('fake error');
      expect(engine.getCallCount()).toBe(0);
    });
  });

  describe('Cascading failure prevention', () => {
    it('should continue working when federated fails mid-operation', async () => {
      await orchestrator.validate('const a = 1;');
      federated.setFailureRate(1.0);
      const result2 = await orchestrator.validate('const b = 2;');
      expect(result2.valid).toBe(true);
      expect(engine.getCallCount()).toBe(2);
    });

    it('should not corrupt cache when federated returns bad data', async () => {
      const code = 'const x = 1;';
      const fingerprint = (orchestrator as any)._fingerprint(code);
      (federated as any).patterns.set(fingerprint, {
        pattern_id: fingerprint, confidence: -1, rules_applied: [], success_rate: 2.0,
      });
      const result = await orchestrator.validate(code);
      expect(result.valid).toBe(true);
      expect(engine.getCallCount()).toBe(1);
    });
  });
});
