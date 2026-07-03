/**
 * Testes de integração para FederatedMemoryAdapter + GovernanceEngine
 * Feature: federated-memory
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FederatedMemoryAdapter } from '../../src/governance/adapters/FederatedMemoryAdapter.js';
import { GovernanceEngine } from '../../src/governance/GovernanceEngine.js';
import type { IHybridMemory, IComplianceChecker, IAuditLogger } from '../../src/governance/interfaces.js';
import type {
  GovernancePassport,
  GovernanceContext,
  CodeFingerprint,
  FederatedPattern,
  ComplianceStamp,
  AuditTrail,
  AuditEvent,
} from '../../src/governance/types.js';
import type { ValidationResult } from '../../src/validate/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidationResult(): ValidationResult {
  return {
    canDeploy: true,
    confidence: 1.0,
    duration: 0,
    checks: {
      build: { passed: true, installTime: 0, buildTime: 0, errors: [], warnings: [] },
      runtime: { passed: true, startupTime: 0, memoryUsage: 0, apiResponses: [], healthChecks: [] },
      dependencies: { passed: true, ghostPackages: [], outdatedPackages: [], vulnerabilities: [], missingPeerDeps: [] },
    },
    fixesApplied: [],
    remainingIssues: [],
    recommendations: [],
    iterationCount: 0,
  };
}

function makeMockCompliance(stamps: ComplianceStamp[] = []): IComplianceChecker {
  return {
    async check(_code: string, _requirements: string[]) { return stamps; },
    async loadContract(_path: string) {},
  };
}

function makeMockAudit(): IAuditLogger & { calls: AuditEvent[] } {
  const calls: AuditEvent[] = [];
  return {
    calls,
    async log(event: AuditEvent): Promise<AuditTrail> {
      calls.push(event);
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
    async getChain(_passportId: string) { return []; },
    async verifyIntegrity(_passportId: string) { return true; },
  };
}

function makeContext(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    code: 'const x = 1;',
    origin: 'unknown',
    projectId: 'proj-test',
    requirements: [],
    actor: 'test-actor',
    ...overrides,
  };
}

/** Cria um FederatedPattern válido com confidence alta */
function makeFederatedPattern(confidence = 0.9): FederatedPattern {
  return {
    pattern_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    confidence,
    rules_applied: ['LGPD-art13', 'OWASP-A01'],
    success_rate: 0.87,
  };
}

/** Cria um FederatedMemoryAdapter com SQLite em memória */
function createFederatedAdapter(serverUrl = 'http://federated-server:8000'): FederatedMemoryAdapter {
  return new FederatedMemoryAdapter({
    sqlitePath: ':memory:',
    serverUrl,
    sharePatterns: true,
    epsilon: 1.0,
    noiseType: 'laplace',
    pullTimeout: 3000,
    pushTimeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// Arbitrários
// ---------------------------------------------------------------------------

const arbFingerprint: fc.Arbitrary<CodeFingerprint> = fc.record({
  hash: fc.stringMatching(/^[0-9a-f]{64}$/),
  astSignature: fc.string({ minLength: 1, maxLength: 100 }),
  dependencies: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }),
  complexity: fc.integer({ min: 0, max: 50 }),
});

const arbFederatedPattern: fc.Arbitrary<FederatedPattern> = fc.record({
  pattern_id: fc.uuid(),
  confidence: fc.float({ min: Math.fround(0.7), max: Math.fround(1.0), noNaN: true }),
  rules_applied: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
  success_rate: fc.float({ min: 0, max: Math.fround(1.0), noNaN: true }),
});

// ---------------------------------------------------------------------------
// Cleanup: restaura fetch após cada teste
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// P21: memoryEnriched=true quando padrões federados retornados
// ---------------------------------------------------------------------------
describe('P21: memoryEnriched=true quando padrões federados retornados', () => {
  // Feature: federated-memory, Property 21: memoryEnriched=true quando padrões federados retornados
  it('GovernancePassport deve ter memoryEnriched=true quando FederatedMemoryAdapter retorna padrões federados', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFederatedPattern,
        fc.string({ minLength: 1, maxLength: 100 }),
        async (pattern, code) => {
          // Mock fetch para retornar um FederatedPattern com confidence >= 0.7
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            text: async () => JSON.stringify([pattern]),
          }));

          const adapter = createFederatedAdapter();
          const audit = makeMockAudit();

          const engine = new GovernanceEngine({
            validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
            memory: adapter,
            compliance: makeMockCompliance([]),
            audit,
          });

          const passport = await engine.govern(makeContext({ code }));

          // O GovernanceEngine chama recall() antes de save().
          // Como o cache está vazio (SQLite :memory: novo), haverá cache miss
          // e o adapter consultará o servidor federado (fetch mockado).
          // Os padrões retornados com confidence >= 0.7 resultam em memoryEnriched=true.
          expect(passport.memoryEnriched).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('memoryEnriched=true com padrão de confidence=0.9 (exemplo concreto)', async () => {
    const pattern = makeFederatedPattern(0.9);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify([pattern]),
    }));

    const adapter = createFederatedAdapter();
    const audit = makeMockAudit();

    const engine = new GovernanceEngine({
      validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
      memory: adapter,
      compliance: makeMockCompliance([]),
      audit,
    });

    const passport = await engine.govern(makeContext());
    expect(passport.memoryEnriched).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P22: GovernanceEngine resiliente a servidor indisponível
// ---------------------------------------------------------------------------
describe('P22: GovernanceEngine resiliente a servidor indisponível', () => {
  // Feature: federated-memory, Property 22: GovernanceEngine resiliente a servidor indisponível
  it('deve retornar GovernancePassport válido quando servidor retorna HTTP 500', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code) => {
          // Mock fetch para simular HTTP 500
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 500,
            text: async () => 'Internal Server Error',
          }));

          const adapter = createFederatedAdapter();
          const audit = makeMockAudit();

          const engine = new GovernanceEngine({
            validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
            memory: adapter,
            compliance: makeMockCompliance([]),
            audit,
          });

          // Não deve lançar exceção
          const passport = await engine.govern(makeContext({ code }));

          // Deve retornar um GovernancePassport válido
          expect(typeof passport.passportId).toBe('string');
          expect(passport.passportId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          expect(['low', 'medium', 'high', 'critical']).toContain(passport.riskLevel);
          // Com servidor indisponível, cache miss retorna [] → memoryEnriched=false
          expect(passport.memoryEnriched).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('deve retornar GovernancePassport válido quando servidor simula timeout (AbortError)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code) => {
          // Mock fetch para simular AbortError (timeout)
          vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
            Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
          ));

          const adapter = new FederatedMemoryAdapter({
            sqlitePath: ':memory:',
            serverUrl: 'http://federated-server:8000',
            sharePatterns: false, // desabilita push para não interferir
            pullTimeout: 100,
          });

          const audit = makeMockAudit();

          const engine = new GovernanceEngine({
            validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
            memory: adapter,
            compliance: makeMockCompliance([]),
            audit,
          });

          // Não deve lançar exceção
          const passport = await engine.govern(makeContext({ code }));

          expect(typeof passport.passportId).toBe('string');
          expect(['low', 'medium', 'high', 'critical']).toContain(passport.riskLevel);
          expect(passport.memoryEnriched).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('deve retornar GovernancePassport válido quando fetch lança erro genérico de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const adapter = createFederatedAdapter();
    const audit = makeMockAudit();

    const engine = new GovernanceEngine({
      validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
      memory: adapter,
      compliance: makeMockCompliance([]),
      audit,
    });

    await expect(engine.govern(makeContext())).resolves.toBeDefined();
    const passport = await engine.govern(makeContext({ code: 'const y = 2;' }));
    expect(typeof passport.passportId).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Integração: GovernanceEngine aceita FederatedMemoryAdapter via GovernanceEngineDeps
// ---------------------------------------------------------------------------
describe('Integração: FederatedMemoryAdapter como drop-in replacement de IHybridMemory', () => {
  it('FederatedMemoryAdapter deve satisfazer IHybridMemory (type-check via atribuição)', () => {
    // Verifica em tempo de compilação que FederatedMemoryAdapter implementa IHybridMemory
    const adapter = createFederatedAdapter();

    // Atribuição a IHybridMemory — se compilar, o type-check passou
    const memory: IHybridMemory = adapter;

    expect(typeof memory.save).toBe('function');
    expect(typeof memory.recall).toBe('function');
    expect(typeof memory.getSuccessRate).toBe('function');
  });

  it('GovernanceEngine deve aceitar FederatedMemoryAdapter no lugar de HybridMemoryAdapter', async () => {
    // Servidor indisponível — testa apenas que a integração funciona
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 503,
      text: async () => 'Service Unavailable',
    }));

    const adapter = createFederatedAdapter();
    const audit = makeMockAudit();

    // Cria GovernanceEngine com FederatedMemoryAdapter — sem modificação no GovernanceEngine
    const engine = new GovernanceEngine({
      validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
      memory: adapter,  // FederatedMemoryAdapter no lugar de HybridMemoryAdapter
      compliance: makeMockCompliance([]),
      audit,
    });

    // govern() deve funcionar normalmente
    const passport = await engine.govern(makeContext());

    expect(passport).toBeDefined();
    expect(typeof passport.passportId).toBe('string');
    expect(typeof passport.memoryEnriched).toBe('boolean');
    expect(['low', 'medium', 'high', 'critical']).toContain(passport.riskLevel);
  });

  it('GovernanceEngine com FederatedMemoryAdapter deve chamar save() após govern()', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify([]),
    }));

    const adapter = createFederatedAdapter();
    const saveSpy = vi.spyOn(adapter, 'save');
    const audit = makeMockAudit();

    const engine = new GovernanceEngine({
      validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
      memory: adapter,
      compliance: makeMockCompliance([]),
      audit,
    });

    await engine.govern(makeContext());

    // GovernanceEngine deve ter chamado save() no adapter
    expect(saveSpy).toHaveBeenCalledOnce();
    const savedPassport = saveSpy.mock.calls[0][0] as GovernancePassport;
    expect(typeof savedPassport.passportId).toBe('string');
  });

  it('GovernanceEngine com FederatedMemoryAdapter deve chamar recall() durante govern()', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify([]),
    }));

    const adapter = createFederatedAdapter();
    const recallSpy = vi.spyOn(adapter, 'recall');
    const audit = makeMockAudit();

    const engine = new GovernanceEngine({
      validationEngine: { async validate(_c: string) { return makeValidationResult(); } },
      memory: adapter,
      compliance: makeMockCompliance([]),
      audit,
    });

    await engine.govern(makeContext());

    // GovernanceEngine deve ter chamado recall() no adapter
    expect(recallSpy).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// P3: Curto-circuito no EngramHit (Feature: engram-cache, Property 3)
// ---------------------------------------------------------------------------
describe('P3: Curto-circuito no EngramHit', () => {
  // Feature: engram-cache, Property 3: Curto-circuito no EngramHit
  // Valida: Requisito 1.5
  it('quando recallExact retorna passaportes, nenhuma chamada HTTP deve ser feita', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbFingerprint,
        async (fingerprint) => {
          const mockFetch = vi.fn();
          vi.stubGlobal('fetch', mockFetch);

          const adapter = createFederatedAdapter();

          // Salvar um passaporte com o fingerprint fornecido
          const passport: GovernancePassport = {
            passportId: `test-${fingerprint.hash.slice(0, 8)}`,
            codeFingerprint: fingerprint,
            validations: [],
            complianceStamps: [],
            auditTrail: [],
            memoryEnriched: false,
            riskLevel: 'low',
            estimatedRemediationCost: 0,
          };
          await adapter.save(passport);

          // Resetar o mock após o save (que pode ter chamado fetch via push)
          mockFetch.mockClear();

          // Chamar recall com o mesmo fingerprint — deve encontrar via recallExact
          const results = await adapter.recall(fingerprint, 0.8);

          // Deve retornar passaportes
          expect(results.length).toBeGreaterThan(0);

          // Nenhuma chamada HTTP deve ter sido feita (curto-circuito no EngramHit)
          expect(mockFetch).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// P4: Consistência dos contadores de métricas (Feature: engram-cache, Property 4)
// ---------------------------------------------------------------------------
describe('P4: Consistência dos contadores de métricas', () => {
  // Feature: engram-cache, Property 4: Consistência dos contadores de métricas
  // Valida: Requisitos 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
  it('engramHits + engramMisses === N após N chamadas a recall()', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbFingerprint, { minLength: 1, maxLength: 10 }),
        async (fingerprints) => {
          // Mock fetch retornando [] para simular federatedMiss
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            status: 200,
            text: async () => JSON.stringify([]),
          }));

          const adapter = createFederatedAdapter();
          const N = fingerprints.length;

          // Executar N chamadas a recall()
          for (const fp of fingerprints) {
            await adapter.recall(fp, 0.8);
          }

          const metrics = adapter.getMetrics();

          // Invariante 1: engramHits + engramMisses === N (toda chamada passa pelo nível engram)
          expect(metrics.engramHits + metrics.engramMisses).toBe(N);

          // Invariante 2: vectorHits + vectorMisses === engramMisses
          // (apenas chamadas que passaram pelo engram chegam ao nível vetorial)
          expect(metrics.vectorHits + metrics.vectorMisses).toBe(metrics.engramMisses);

          // Invariante 3: federatedHits + federatedMisses === vectorMisses
          // (apenas chamadas que passaram pelo vetor chegam ao nível federado)
          expect(metrics.federatedHits + metrics.federatedMisses).toBe(metrics.vectorMisses);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('contadores refletem corretamente hits e misses em cenário misto', async () => {
    // Mock fetch retornando [] para simular federatedMiss
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify([]),
    }));

    const adapter = createFederatedAdapter();

    const fp1: CodeFingerprint = {
      hash: 'a'.repeat(64),
      astSignature: 'fn main',
      dependencies: [],
      complexity: 1,
    };
    const fp2: CodeFingerprint = {
      hash: 'b'.repeat(64),
      astSignature: 'fn other',
      dependencies: [],
      complexity: 2,
    };

    // Salvar passaporte para fp1 (vai gerar engramHit na segunda chamada)
    const passport: GovernancePassport = {
      passportId: 'passport-fp1',
      codeFingerprint: fp1,
      validations: [],
      complianceStamps: [],
      auditTrail: [],
      memoryEnriched: false,
      riskLevel: 'low',
      estimatedRemediationCost: 0,
    };
    await adapter.save(passport);

    // Resetar fetch mock após save
    (fetch as ReturnType<typeof vi.fn>).mockClear();

    // Chamada 1: fp1 — deve ser engramHit (passaporte salvo)
    await adapter.recall(fp1, 0.8);
    // Chamada 2: fp2 — deve ser engramMiss → vectorMiss → federatedMiss
    await adapter.recall(fp2, 0.8);
    // Chamada 3: fp1 novamente — deve ser engramHit
    await adapter.recall(fp1, 0.8);

    const metrics = adapter.getMetrics();

    // 3 chamadas totais
    expect(metrics.engramHits + metrics.engramMisses).toBe(3);
    // 2 engramHits (fp1 duas vezes), 1 engramMiss (fp2)
    expect(metrics.engramHits).toBe(2);
    expect(metrics.engramMisses).toBe(1);
    // 1 chamada chegou ao nível vetorial (fp2)
    expect(metrics.vectorHits + metrics.vectorMisses).toBe(1);
    // 1 chamada chegou ao nível federado (fp2 sem match vetorial)
    expect(metrics.federatedHits + metrics.federatedMisses).toBe(1);
    expect(metrics.federatedMisses).toBe(1);
  });
});
