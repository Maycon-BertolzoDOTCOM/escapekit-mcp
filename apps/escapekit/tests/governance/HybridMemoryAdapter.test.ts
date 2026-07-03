/**
 * Testes de propriedade para HybridMemoryAdapter
 * Feature: governance-pivot
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { HybridMemoryAdapter } from '../../src/governance/adapters/HybridMemoryAdapter.js';
import { computeSimilarity } from '../../src/governance/utils/fingerprint.js';
import { DuplicatePassportError } from '../../src/governance/errors.js';
import type { GovernancePassport, CodeFingerprint, ComplianceStamp, AuditTrail } from '../../src/governance/types.js';

// ---------------------------------------------------------------------------
// Arbitrários
// ---------------------------------------------------------------------------

/** Hash SHA-256 simulado (64 hex chars) */
const arbitraryHash64 = fc.stringMatching(/^[0-9a-f]{64}$/);

/** CodeFingerprint arbitrário */
const arbitraryCodeFingerprint: fc.Arbitrary<CodeFingerprint> = fc.record({
  hash: arbitraryHash64,
  astSignature: fc.string({ minLength: 0, maxLength: 100 }),
  dependencies: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
  complexity: fc.integer({ min: 0, max: 100 }),
});

/** ComplianceStamp arbitrário com score em [0,1] */
const arbitraryComplianceStamp: fc.Arbitrary<ComplianceStamp> = fc.record({
  regulationId: fc.string({ minLength: 1, maxLength: 20 }),
  clauses: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
  score: fc.float({ min: 0, max: 1, noNaN: true }),
  verifiedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01'), noInvalidDate: true }),
  verifiedBy: fc.string({ minLength: 1, maxLength: 20 }),
});

/** AuditTrail arbitrário */
const arbitraryAuditTrail: fc.Arbitrary<AuditTrail> = fc.record({
  chainHash: arbitraryHash64,
  parentHash: fc.option(arbitraryHash64, { nil: null }),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01'), noInvalidDate: true }),
  action: fc.string({ minLength: 1, maxLength: 30 }),
  actor: fc.string({ minLength: 1, maxLength: 30 }),
  inputHash: arbitraryHash64,
  resultHash: arbitraryHash64,
});

/** GovernancePassport arbitrário */
const arbitraryGovernancePassport: fc.Arbitrary<GovernancePassport> = fc.record({
  passportId: fc.uuid(),
  codeFingerprint: arbitraryCodeFingerprint,
  validations: fc.constant([]),
  complianceStamps: fc.array(arbitraryComplianceStamp, { maxLength: 3 }),
  auditTrail: fc.array(arbitraryAuditTrail, { maxLength: 3 }),
  memoryEnriched: fc.boolean(),
  riskLevel: fc.constantFrom('low', 'medium', 'high', 'critical') as fc.Arbitrary<GovernancePassport['riskLevel']>,
  estimatedRemediationCost: fc.float({ min: 0, max: 100, noNaN: true }),
});

/** Cria um HybridMemoryAdapter com SQLite em memória */
function createAdapter(): HybridMemoryAdapter {
  return new HybridMemoryAdapter({ sqlitePath: ':memory:' });
}

// ---------------------------------------------------------------------------
// P8: recall() respeita threshold de similaridade
// ---------------------------------------------------------------------------
describe('P8: recall() respeita threshold de similaridade', () => {
  // Feature: governance-pivot, Property 8: recall(fingerprint, T) retorna apenas passaportes com similaridade >= T
  it('recall() retorna apenas passaportes com similaridade >= threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryGovernancePassport, { minLength: 1, maxLength: 5 }),
        arbitraryCodeFingerprint,
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (passports, queryFingerprint, threshold) => {
          // Garante passportIds únicos
          const uniquePassports = passports.filter(
            (p, i, arr) => arr.findIndex((x) => x.passportId === p.passportId) === i,
          );

          const adapter = createAdapter();

          for (const passport of uniquePassports) {
            await adapter.save(passport);
          }

          const recalled = await adapter.recall(queryFingerprint, threshold);

          // Todos os passaportes retornados devem ter similaridade >= threshold
          for (const passport of recalled) {
            const similarity = computeSimilarity(queryFingerprint, passport.codeFingerprint);
            expect(similarity).toBeGreaterThanOrEqual(threshold);
          }

          // Nenhum passaporte com similaridade >= threshold deve estar ausente
          for (const passport of uniquePassports) {
            const similarity = computeSimilarity(queryFingerprint, passport.codeFingerprint);
            if (similarity >= threshold) {
              const found = recalled.some((r) => r.passportId === passport.passportId);
              expect(found).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P9: computeSimilarity() retorna valor em [0, 1]
// ---------------------------------------------------------------------------
describe('P9: computeSimilarity() retorna valor em [0, 1]', () => {
  // Feature: governance-pivot, Property 9: computeSimilarity() retorna valor em [0, 1] para qualquer par de CodeFingerprints
  it('computeSimilarity() retorna valor em [0, 1] para qualquer par de fingerprints', () => {
    fc.assert(
      fc.property(
        arbitraryCodeFingerprint,
        arbitraryCodeFingerprint,
        (a, b) => {
          const similarity = computeSimilarity(a, b);
          expect(similarity).toBeGreaterThanOrEqual(0);
          expect(similarity).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P10: getSuccessRate() retorna proporção correta em [0, 1]
// ---------------------------------------------------------------------------
describe('P10: getSuccessRate() retorna proporção correta em [0, 1]', () => {
  // Feature: governance-pivot, Property 10: getSuccessRate() retorna proporção de passaportes com riskLevel "low" em [0, 1]
  it('getSuccessRate() retorna proporção correta de riskLevel "low" em [0, 1]', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Gera passaportes com o mesmo fingerprint.hash para testar getSuccessRate
        fc.array(
          fc.record({
            riskLevel: fc.constantFrom('low', 'medium', 'high', 'critical') as fc.Arbitrary<GovernancePassport['riskLevel']>,
          }),
          { minLength: 1, maxLength: 10 },
        ),
        arbitraryHash64,
        async (riskLevels, sharedHash) => {
          const adapter = createAdapter();

          const passports: GovernancePassport[] = riskLevels.map((r, i) => ({
            passportId: `passport-${sharedHash.slice(0, 8)}-${i}`,
            codeFingerprint: {
              hash: sharedHash,
              astSignature: 'sig',
              dependencies: [],
              complexity: 0,
            },
            validations: [],
            complianceStamps: [],
            auditTrail: [],
            memoryEnriched: false,
            riskLevel: r.riskLevel,
            estimatedRemediationCost: 0,
          }));

          for (const p of passports) {
            await adapter.save(p);
          }

          const rate = await adapter.getSuccessRate({ hash: sharedHash, astSignature: '', dependencies: [], complexity: 0 });

          // Deve estar em [0, 1]
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(1);

          // Deve ser a proporção correta
          const lowCount = passports.filter((p) => p.riskLevel === 'low').length;
          const expected = lowCount / passports.length;
          expect(rate).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('getSuccessRate() retorna 0.0 quando não há registros', async () => {
    const adapter = createAdapter();
    const rate = await adapter.getSuccessRate({
      hash: 'a'.repeat(64),
      astSignature: '',
      dependencies: [],
      complexity: 0,
    });
    expect(rate).toBe(0.0);
  });
});

// ---------------------------------------------------------------------------
// P11: round-trip JSON do GovernancePassport
// ---------------------------------------------------------------------------
describe('P11: round-trip JSON do GovernancePassport', () => {
  // Feature: governance-pivot, Property 11: serializar e desserializar um GovernancePassport em JSON produz objeto equivalente
  it('serializar e desserializar um GovernancePassport preserva todos os campos', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryGovernancePassport,
        async (passport) => {
          const adapter = createAdapter();
          await adapter.save(passport);

          // Recupera com threshold 0 para garantir que retorna o passaporte
          const recalled = await adapter.recall(passport.codeFingerprint, 0);
          const found = recalled.find((r) => r.passportId === passport.passportId);

          expect(found).toBeDefined();
          if (!found) return;

          // Verifica campos escalares
          expect(found.passportId).toBe(passport.passportId);
          expect(found.memoryEnriched).toBe(passport.memoryEnriched);
          expect(found.riskLevel).toBe(passport.riskLevel);
          expect(found.estimatedRemediationCost).toBeCloseTo(passport.estimatedRemediationCost, 5);

          // Verifica codeFingerprint
          expect(found.codeFingerprint.hash).toBe(passport.codeFingerprint.hash);
          expect(found.codeFingerprint.astSignature).toBe(passport.codeFingerprint.astSignature);
          expect(found.codeFingerprint.dependencies).toEqual(passport.codeFingerprint.dependencies);
          expect(found.codeFingerprint.complexity).toBe(passport.codeFingerprint.complexity);

          // Verifica complianceStamps (datas como Date)
          expect(found.complianceStamps).toHaveLength(passport.complianceStamps.length);
          for (let i = 0; i < passport.complianceStamps.length; i++) {
            expect(found.complianceStamps[i].regulationId).toBe(passport.complianceStamps[i].regulationId);
            expect(found.complianceStamps[i].score).toBeCloseTo(passport.complianceStamps[i].score, 5);
            expect(found.complianceStamps[i].verifiedAt).toBeInstanceOf(Date);
            expect(found.complianceStamps[i].verifiedAt.getTime()).toBe(
              passport.complianceStamps[i].verifiedAt.getTime(),
            );
          }

          // Verifica auditTrail (datas como Date)
          expect(found.auditTrail).toHaveLength(passport.auditTrail.length);
          for (let i = 0; i < passport.auditTrail.length; i++) {
            expect(found.auditTrail[i].chainHash).toBe(passport.auditTrail[i].chainHash);
            expect(found.auditTrail[i].timestamp).toBeInstanceOf(Date);
            expect(found.auditTrail[i].timestamp.getTime()).toBe(
              passport.auditTrail[i].timestamp.getTime(),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P20: round-trip de persistência de passaporte
// ---------------------------------------------------------------------------
describe('P20: round-trip de persistência de passaporte', () => {
  // Feature: governance-pivot, Property 20: save(passport) seguido de recall(passport.codeFingerprint, 1.0) retorna array contendo o passaporte salvo
  it('save() seguido de recall(fingerprint, 1.0) retorna o passaporte salvo', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Gera passaportes com dependências não-vazias para garantir similaridade 1.0 consigo mesmo
        fc.record({
          passportId: fc.uuid(),
          codeFingerprint: fc.record({
            hash: arbitraryHash64,
            astSignature: fc.string({ minLength: 0, maxLength: 100 }),
            // Pelo menos uma dependência para que jaccardDeps(f,f) = 1.0
            dependencies: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
            complexity: fc.integer({ min: 1, max: 100 }),
          }),
          validations: fc.constant([]),
          complianceStamps: fc.constant([]),
          auditTrail: fc.constant([]),
          memoryEnriched: fc.boolean(),
          riskLevel: fc.constantFrom('low', 'medium', 'high', 'critical') as fc.Arbitrary<GovernancePassport['riskLevel']>,
          estimatedRemediationCost: fc.float({ min: 0, max: 100, noNaN: true }),
        }),
        async (passport) => {
          const adapter = createAdapter();
          await adapter.save(passport as unknown as GovernancePassport);

          // Com threshold 1.0, só retorna passaportes com similaridade exata (hash igual)
          // Garantido pois: hashMatch=1, jaccardDeps(f,f)=1 (deps não-vazio), complexityScore(f,f)=1
          const recalled = await adapter.recall(passport.codeFingerprint, 1.0);

          // O passaporte salvo deve estar no resultado
          const found = recalled.some((r) => r.passportId === passport.passportId);
          expect(found).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('save() com passportId duplicado lança DuplicatePassportError', async () => {
    const adapter = createAdapter();
    const passport: GovernancePassport = {
      passportId: 'test-duplicate-id',
      codeFingerprint: { hash: 'a'.repeat(64), astSignature: '', dependencies: [], complexity: 0 },
      validations: [],
      complianceStamps: [],
      auditTrail: [],
      memoryEnriched: false,
      riskLevel: 'low',
      estimatedRemediationCost: 0,
    };

    await adapter.save(passport);
    await expect(adapter.save(passport)).rejects.toThrow(DuplicatePassportError);
  });
});

// ---------------------------------------------------------------------------
// P1: Filtragem exata por hash
// ---------------------------------------------------------------------------
// Feature: engram-cache, Property 1
describe('P1: recallExact() retorna apenas passaportes com hash exato', () => {
  // Validates: Requirement 1.1
  it('todos os passaportes retornados têm codeFingerprint.hash igual ao hash consultado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryGovernancePassport, { minLength: 1, maxLength: 5 }),
        arbitraryHash64,
        async (passports, queryHash) => {
          // Garante passportIds únicos
          const uniquePassports = passports.filter(
            (p, i, arr) => arr.findIndex((x) => x.passportId === p.passportId) === i,
          );

          const adapter = createAdapter();
          for (const passport of uniquePassports) {
            await adapter.save(passport);
          }

          const results = await adapter.recallExact({ hash: queryHash, astSignature: '', dependencies: [], complexity: 0 });

          for (const passport of results) {
            expect(passport.codeFingerprint.hash).toBe(queryHash);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P2: Round-trip save → recallExact
// ---------------------------------------------------------------------------
// Feature: engram-cache, Property 2
describe('P2: save() seguido de recallExact() retorna o passaporte salvo', () => {
  // Validates: Requirements 1.2, 4.5
  it('passaporte salvo via save() é encontrado por recallExact com mesmo fingerprint_hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryGovernancePassport,
        async (passport) => {
          const adapter = createAdapter();
          await adapter.save(passport as GovernancePassport);

          const results = await adapter.recallExact(passport.codeFingerprint);
          const found = results.some((r) => r.passportId === passport.passportId);
          expect(found).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
