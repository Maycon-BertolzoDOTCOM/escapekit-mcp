/**
 * Testes de propriedade para cache de ValidationResult no GovernanceEngine
 * Feature: validation-result-cache
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GovernanceEngine } from '../../src/governance/GovernanceEngine.js';
import { HybridMemoryAdapter } from '../../src/governance/adapters/HybridMemoryAdapter.js';
import type { IHybridMemory, IComplianceChecker, IAuditLogger } from '../../src/governance/interfaces.js';
import type {
  GovernancePassport,
  GovernanceContext,
  CodeFingerprint,
  ComplianceStamp,
  AuditTrail,
  AuditEvent,
} from '../../src/governance/types.js';
import type { ValidationResult } from '../../src/validate/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidationResult(issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }> = []): ValidationResult {
  return {
    canDeploy: issues.every((i) => i.severity !== 'error'),
    confidence: 1.0,
    duration: 10,
    checks: {
      build: { passed: true, installTime: 0, buildTime: 0, errors: [], warnings: [] },
      runtime: { passed: true, startupTime: 0, memoryUsage: 0, apiResponses: [], healthChecks: [] },
      dependencies: { passed: true, ghostPackages: [], outdatedPackages: [], vulnerabilities: [], missingPeerDeps: [] },
    },
    fixesApplied: [],
    remainingIssues: issues.map((i) => ({
      type: 'BUILD_ERROR' as const,
      severity: i.severity,
      message: i.message,
    })),
    recommendations: [],
    iterationCount: 0,
  };
}

function makeMockCompliance(stamps: ComplianceStamp[] = []): IComplianceChecker {
  return {
    async check() { return stamps; },
    async loadContract() {},
  };
}

function makeMockAudit(): IAuditLogger {
  return {
    async log(event: AuditEvent): Promise<AuditTrail> {
      return {
        chainHash: 'a'.repeat(64),
        parentHash: null,
        timestamp: new Date(),
        action: event.action,
        actor: event.actor,
        inputHash: event.inputHash,
        resultHash: event.resultHash,
      };
    },
    async getChain() { return []; },
    async verifyIntegrity() { return true; },
  };
}

/** Mock simples de IHybridMemory sem recallExact */
function makeMockMemory(passports: GovernancePassport[] = []): IHybridMemory & { saved: GovernancePassport[] } {
  const saved: GovernancePassport[] = [...passports];
  return {
    saved,
    async save(passport: GovernancePassport) { saved.push(passport); },
    async recall(_fp: CodeFingerprint, _threshold: number) { return []; },
    async getSuccessRate(_fp: CodeFingerprint) { return 0; },
  };
}

/** Mock de IHybridMemory com recallExact controlável */
function makeMockMemoryWithExact(exactResults: GovernancePassport[] = []): IHybridMemory & { saved: GovernancePassport[] } {
  const saved: GovernancePassport[] = [];
  return {
    saved,
    async save(passport: GovernancePassport) { saved.push(passport); },
    async recall(_fp: CodeFingerprint, _threshold: number) { return []; },
    async recallExact(_fp: CodeFingerprint) { return exactResults; },
    async getSuccessRate(_fp: CodeFingerprint) { return 0; },
  };
}

function makeContext(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    code: 'const x = 1;',
    origin: 'unknown',
    projectId: 'proj-test',
    requirements: [],
    actor: 'test-actor',
    strategy: 'thorough',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// P1: Cache hit evita revalidação e define cacheSource correto
// Feature: validation-result-cache, Property 1
// Valida: Requisitos 1.1, 1.3, 1.7
// ---------------------------------------------------------------------------
describe('P1: Cache hit evita revalidação e define cacheSource correto', () => {
  it('deve reutilizar ValidationResult do cache, não chamar validate(), e definir cacheSource=engram', async () => {
    // Feature: validation-result-cache, Property 1: Cache hit evita revalidação e define cacheSource correto
    // Valida: Requisitos 1.1, 1.3, 1.7
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code) => {
          // Arrange: criar adapter com SQLite :memory: e salvar passaporte com validations preenchidas
          const adapter = new HybridMemoryAdapter({ sqlitePath: ':memory:' });
          const validateFn = vi.fn().mockResolvedValue(makeValidationResult());
          const engine = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory: adapter,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });

          // Primeiro govern() — popula o cache
          await engine.govern(makeContext({ code }));
          validateFn.mockClear();

          // Cria nova instância com mesma memória para testar cache hit
          const engine2 = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory: adapter,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });

          // Act: govern() com strategy thorough e noCache: false
          const passport = await engine2.govern(makeContext({ code, noCache: false }));

          // Assert: validate() NÃO chamado, cacheSource === 'engram', validation_cache_hits === 1
          expect(validateFn).not.toHaveBeenCalled();
          expect(passport.cacheSource).toBe('engram');
          expect(engine2.getValidationCacheMetrics().validation_cache_hits).toBe(1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// P2: Cache miss dispara validação e define cacheSource correto
// Feature: validation-result-cache, Property 2
// Valida: Requisitos 1.2, 1.4, 1.8
// ---------------------------------------------------------------------------
describe('P2: Cache miss dispara validação e define cacheSource correto', () => {
  it('deve chamar validate() 1x, definir cacheSource=full e incrementar cache_misses', async () => {
    // Feature: validation-result-cache, Property 2: Cache miss dispara validação e define cacheSource correto
    // Valida: Requisitos 1.2, 1.4, 1.8
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code) => {
          // Arrange: memória vazia (sem recallExact retornando resultados)
          const memory = makeMockMemoryWithExact([]);
          const validateFn = vi.fn().mockResolvedValue(makeValidationResult());
          const engine = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });

          // Act: govern() com strategy thorough
          const passport = await engine.govern(makeContext({ code }));

          // Assert: validate() chamado 1x, cacheSource === 'full', cache_misses === 1
          expect(validateFn).toHaveBeenCalledTimes(1);
          expect(passport.cacheSource).toBe('full');
          expect(engine.getValidationCacheMetrics().validation_cache_misses).toBe(1);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// P3: Invariante estrutural do GovernancePassport
// Feature: validation-result-cache, Property 3
// Valida: Requisitos 2.1, 6.1, 6.3
// ---------------------------------------------------------------------------
describe('P3: Invariante estrutural do GovernancePassport', () => {
  it('passport deve ter cacheSource válido, estimatedRemediationCost >= 0 e passportId como UUID', async () => {
    // Feature: validation-result-cache, Property 3: Invariante estrutural do GovernancePassport
    // Valida: Requisitos 2.1, 6.1, 6.3
    const validCacheSources = new Set(['engram', 'vector', 'full']);

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('fast', 'thorough', 'compliance-first' as const),
        async (code, strategy) => {
          const memory = makeMockMemoryWithExact([]);
          const engine = new GovernanceEngine({
            validationEngine: { validate: vi.fn().mockResolvedValue(makeValidationResult()) },
            memory,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });

          const passport = await engine.govern(makeContext({ code, strategy }));

          // cacheSource deve ser um dos valores válidos
          expect(validCacheSources.has(passport.cacheSource ?? 'full')).toBe(true);

          // estimatedRemediationCost >= 0
          expect(passport.estimatedRemediationCost).toBeGreaterThanOrEqual(0);

          // passportId como string UUID
          expect(typeof passport.passportId).toBe('string');
          expect(passport.passportId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );

          // Campos obrigatórios presentes
          expect(passport.codeFingerprint).toBeDefined();
          expect(Array.isArray(passport.validations)).toBe(true);
          expect(Array.isArray(passport.complianceStamps)).toBe(true);
          expect(Array.isArray(passport.auditTrail)).toBe(true);
          expect(typeof passport.memoryEnriched).toBe('boolean');
          expect(['low', 'medium', 'high', 'critical']).toContain(passport.riskLevel);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// P5: Cálculo correto de métricas de cache
// Feature: validation-result-cache, Property 5
// Valida: Requisitos 3.3, 3.4
// ---------------------------------------------------------------------------
describe('P5: Cálculo correto de métricas de cache', () => {
  it('avg_validation_time_ms e tokens_saved_estimate devem seguir as fórmulas corretas', async () => {
    // Feature: validation-result-cache, Property 5: Cálculo correto de métricas de cache
    // Valida: Requisitos 3.3, 3.4
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (numMisses) => {
          const memory = makeMockMemoryWithExact([]);
          const validateFn = vi.fn().mockResolvedValue(makeValidationResult());
          const engine = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });

          // Executa numMisses chamadas (todas serão misses pois memória está vazia)
          for (let i = 0; i < numMisses; i++) {
            await engine.govern(makeContext({ code: `const x = ${i};` }));
          }

          const metrics = engine.getValidationCacheMetrics();

          // validation_cache_misses deve ser igual ao número de chamadas
          expect(metrics.validation_cache_misses).toBe(numMisses);
          expect(metrics.validation_cache_hits).toBe(0);

          // avg_validation_time_ms deve ser >= 0
          expect(metrics.avg_validation_time_ms).toBeGreaterThanOrEqual(0);

          // tokens_saved_estimate = hits * avg * 0.1 = 0 * avg * 0.1 = 0
          expect(metrics.tokens_saved_estimate).toBe(0);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('tokens_saved_estimate = hits * avg_validation_time_ms * 0.1', async () => {
    // Feature: validation-result-cache, Property 5: fórmula de tokens_saved_estimate
    // Valida: Requisito 3.4
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (code) => {
          // Arrange: adapter com SQLite :memory: para ter cache hit real
          const adapter = new HybridMemoryAdapter({ sqlitePath: ':memory:' });
          const validateFn = vi.fn().mockResolvedValue(makeValidationResult());

          // Primeiro govern() — popula o cache
          const engine1 = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory: adapter,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });
          await engine1.govern(makeContext({ code }));

          // Segunda instância — terá 1 hit
          const validateFn2 = vi.fn().mockResolvedValue(makeValidationResult());
          const engine2 = new GovernanceEngine({
            validationEngine: { validate: validateFn2 },
            memory: adapter,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });
          await engine2.govern(makeContext({ code, noCache: false }));

          const metrics = engine2.getValidationCacheMetrics();

          // Verifica fórmula: tokens_saved_estimate = hits * avg * 0.1
          const expected = metrics.validation_cache_hits * metrics.avg_validation_time_ms * 0.1;
          expect(metrics.tokens_saved_estimate).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('getValidationCacheMetrics() retorna zeros sem execuções prévias', () => {
    const memory = makeMockMemory();
    const engine = new GovernanceEngine({
      validationEngine: { validate: vi.fn() },
      memory,
      compliance: makeMockCompliance(),
      audit: makeMockAudit(),
    });

    const metrics = engine.getValidationCacheMetrics();
    expect(metrics).toEqual({
      validation_cache_hits: 0,
      validation_cache_misses: 0,
      avg_validation_time_ms: 0,
      tokens_saved_estimate: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// P11: Equivalência de riskLevel com e sem cache
// Feature: validation-result-cache, Property 11
// Valida: Requisito 6.4
// ---------------------------------------------------------------------------
describe('P11: Equivalência de riskLevel com e sem cache', () => {
  it('riskLevel deve ser igual com e sem cache para o mesmo código', async () => {
    // Feature: validation-result-cache, Property 11: Equivalência de riskLevel com e sem cache
    // Valida: Requisito 6.4
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code) => {
          // Arrange: adapter com SQLite :memory:
          const adapter = new HybridMemoryAdapter({ sqlitePath: ':memory:' });
          const validationResult = makeValidationResult([
            { severity: 'warning', message: 'test warning' },
          ]);
          const validateFn = vi.fn().mockResolvedValue(validationResult);

          // Primeiro govern() — validação completa (miss)
          const engine1 = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory: adapter,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });
          const passport1 = await engine1.govern(makeContext({ code }));

          // Segundo govern() — deve usar cache (hit)
          const validateFn2 = vi.fn().mockResolvedValue(validationResult);
          const engine2 = new GovernanceEngine({
            validationEngine: { validate: validateFn2 },
            memory: adapter,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });
          const passport2 = await engine2.govern(makeContext({ code, noCache: false }));

          // Assert: riskLevel deve ser igual
          expect(passport2.riskLevel).toBe(passport1.riskLevel);
          // E o segundo deve ter vindo do cache
          expect(passport2.cacheSource).toBe('engram');
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// P12: Estratégia fast preservada
// Feature: validation-result-cache, Property 12
// Valida: Requisito 1.5
// ---------------------------------------------------------------------------
describe('P12: Estratégia fast preservada', () => {
  it('strategy fast nunca deve chamar validationEngine.validate()', async () => {
    // Feature: validation-result-cache, Property 12: Estratégia fast preservada
    // Valida: Requisito 1.5
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (code) => {
          const memory = makeMockMemoryWithExact([]);
          const validateFn = vi.fn().mockResolvedValue(makeValidationResult());
          const engine = new GovernanceEngine({
            validationEngine: { validate: validateFn },
            memory,
            compliance: makeMockCompliance(),
            audit: makeMockAudit(),
          });

          await engine.govern(makeContext({ code, strategy: 'fast' }));

          // validate() nunca deve ser chamado para strategy: 'fast'
          expect(validateFn).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });
});
