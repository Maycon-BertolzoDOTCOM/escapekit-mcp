/**
 * Testes de cache para HybridMemoryAdapter
 * Feature: validation-result-cache
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { HybridMemoryAdapter } from '../../src/governance/adapters/HybridMemoryAdapter.js';
import type { GovernancePassport } from '../../src/governance/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash SHA-256 simulado (64 hex chars) */
const arbitraryHash64 = fc.stringMatching(/^[0-9a-f]{64}$/);

/** Cria um passaporte mínimo com cacheSource definido */
function makePassport(
  id: string,
  hash: string,
  cacheSource: 'engram' | 'vector' | 'full',
): GovernancePassport {
  return {
    passportId: id,
    codeFingerprint: { hash, astSignature: 'sig', dependencies: [], complexity: 0 },
    validations: [],
    complianceStamps: [],
    auditTrail: [],
    memoryEnriched: false,
    riskLevel: 'low',
    estimatedRemediationCost: 0,
    cacheSource,
  };
}

/** Cria um HybridMemoryAdapter com SQLite em memória */
function createAdapter(): HybridMemoryAdapter {
  return new HybridMemoryAdapter({ sqlitePath: ':memory:' });
}

// ---------------------------------------------------------------------------
// P4: Round-trip de serialização do cacheSource
// ---------------------------------------------------------------------------
describe('P4: Round-trip de serialização do cacheSource', () => {
  // Feature: validation-result-cache, Property 4: Round-trip de serialização do cacheSource
  // Validates: Requisito 2.5
  it('save() + recallExact() preserva o cacheSource do passaporte', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('engram', 'vector', 'full' as const),
        arbitraryHash64,
        fc.uuid(),
        async (cacheSource, hash, passportId) => {
          const adapter = createAdapter();
          const passport = makePassport(passportId, hash, cacheSource);

          await adapter.save(passport);

          const results = await adapter.recallExact(passport.codeFingerprint);
          const found = results.find((r) => r.passportId === passportId);

          expect(found).toBeDefined();
          expect(found?.cacheSource).toBe(cacheSource);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Compatibilidade retroativa: passaporte sem cacheSource recebe 'full'
// ---------------------------------------------------------------------------
describe('Compatibilidade retroativa: passaporte sem cacheSource', () => {
  // Validates: Requisito 6.2
  it('passaporte persistido sem cacheSource recebe cacheSource: "full" na desserialização', async () => {
    // Simula dado antigo: insere JSON sem o campo cacheSource diretamente no SQLite
    const adapter = createAdapter();

    // Acessa o banco interno para inserir um registro legado sem cacheSource
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (adapter as any).db;

    const legacyJson = JSON.stringify({
      passportId: 'legacy-passport-001',
      codeFingerprint: {
        hash: 'a'.repeat(64),
        astSignature: 'legacy-sig',
        dependencies: [],
        complexity: 0,
      },
      validations: [],
      complianceStamps: [],
      auditTrail: [],
      memoryEnriched: false,
      riskLevel: 'low',
      estimatedRemediationCost: 0,
      // cacheSource ausente — simula dado persistido antes da feature
    });

    db.prepare(
      `INSERT INTO governance_passports (id, fingerprint_hash, risk_level, passport_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('legacy-passport-001', 'a'.repeat(64), 'low', legacyJson, new Date().toISOString());

    const results = await adapter.recallExact({
      hash: 'a'.repeat(64),
      astSignature: '',
      dependencies: [],
      complexity: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].passportId).toBe('legacy-passport-001');
    expect(results[0].cacheSource).toBe('full');
  });
});
