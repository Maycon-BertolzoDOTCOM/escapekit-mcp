/**
 * Testes de propriedade para AuditLoggerAdapter
 * Feature: governance-pivot
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { AuditLoggerAdapter } from '../../src/governance/adapters/AuditLoggerAdapter.js';
import { chainHash } from '../../src/governance/utils/hash.js';
import type { AuditEvent } from '../../src/governance/types.js';

/** Cria um diretório temporário único por teste */
function tmpDir(): string {
  return path.join(os.tmpdir(), `audit-test-${Date.now()}-${Math.random()}`);
}

/** Gera um passportId arbitrário (UUID-like) */
const arbitraryPassportId = fc.uuid();

/** Gera uma string hexadecimal de 64 caracteres (SHA-256 simulado) */
const arbitraryHash64 = fc.stringMatching(/^[0-9a-f]{64}$/);

/** Gera dados de evento arbitrários (sem passportId) */
const arbitraryEventData = fc.record({
  action: fc.string({ minLength: 1, maxLength: 30 }),
  actor: fc.string({ minLength: 1, maxLength: 30 }),
  inputHash: arbitraryHash64,
  resultHash: arbitraryHash64,
});

// ---------------------------------------------------------------------------
// P15: chainHash calculado corretamente pela fórmula
// ---------------------------------------------------------------------------
describe('P15: chainHash calculado corretamente pela fórmula', () => {
  // Feature: governance-pivot, Property 15: chainHash calculado corretamente pela fórmula
  it('o chainHash armazenado deve ser igual ao recalculado pela fórmula', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPassportId,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        arbitraryHash64,
        arbitraryHash64,
        async (passportId, action, actor, inputHash, resultHash) => {
          const dir = tmpDir();
          const logger = new AuditLoggerAdapter(dir);

          const event: AuditEvent = { passportId, action, actor, inputHash, resultHash };
          const trail = await logger.log(event);

          // Recalcula o chainHash usando a mesma fórmula
          const recalculated = chainHash(
            trail.parentHash,
            trail.timestamp,
            trail.action,
            trail.actor,
            trail.inputHash,
            trail.resultHash,
          );

          expect(trail.chainHash).toBe(recalculated);

          // Cleanup
          fs.rmSync(dir, { recursive: true, force: true });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P16: Encadeamento correto de parentHash
// ---------------------------------------------------------------------------
describe('P16: Encadeamento correto de parentHash', () => {
  // Feature: governance-pivot, Property 16: Encadeamento correto de parentHash
  it('entry[i].parentHash === entry[i-1].chainHash e entry[0].parentHash === null', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPassportId,
        fc.array(arbitraryEventData, { minLength: 2, maxLength: 8 }),
        async (passportId, eventDataList) => {
          const dir = tmpDir();
          const logger = new AuditLoggerAdapter(dir);

          const trails = [];
          for (const data of eventDataList) {
            const trail = await logger.log({ passportId, ...data });
            trails.push(trail);
          }

          // Verifica encadeamento
          expect(trails[0].parentHash).toBeNull();
          for (let i = 1; i < trails.length; i++) {
            expect(trails[i].parentHash).toBe(trails[i - 1].chainHash);
          }

          // Cleanup
          fs.rmSync(dir, { recursive: true, force: true });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P17: Integridade da cadeia de auditoria
// ---------------------------------------------------------------------------
describe('P17: Integridade da cadeia de auditoria', () => {
  // Feature: governance-pivot, Property 17: Integridade da cadeia — verifyIntegrity() retorna true para cadeias íntegras e false para adulteradas
  it('verifyIntegrity() retorna true para cadeia não adulterada', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPassportId,
        fc.array(arbitraryEventData, { minLength: 1, maxLength: 5 }),
        async (passportId, eventDataList) => {
          const dir = tmpDir();
          const logger = new AuditLoggerAdapter(dir);

          for (const data of eventDataList) {
            await logger.log({ passportId, ...data });
          }

          const result = await logger.verifyIntegrity(passportId);
          expect(result).toBe(true);

          // Cleanup
          fs.rmSync(dir, { recursive: true, force: true });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: governance-pivot, Property 17: Integridade da cadeia — verifyIntegrity() retorna false para cadeia adulterada sem lançar exceção
  it('verifyIntegrity() retorna false para cadeia adulterada sem lançar exceção', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPassportId,
        fc.array(arbitraryEventData, { minLength: 1, maxLength: 5 }),
        async (passportId, eventDataList) => {
          const dir = tmpDir();
          const logger = new AuditLoggerAdapter(dir);

          for (const data of eventDataList) {
            await logger.log({ passportId, ...data });
          }

          // Adultera um arquivo JSON: modifica o campo `action` de um arquivo
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
          const targetFile = path.join(dir, files[0]);
          const content = JSON.parse(fs.readFileSync(targetFile, 'utf8')) as Record<string, unknown>;
          content['action'] = String(content['action']) + '_ADULTERADO';
          fs.writeFileSync(targetFile, JSON.stringify(content), 'utf8');

          // Não deve lançar exceção
          let result: boolean;
          try {
            result = await logger.verifyIntegrity(passportId);
          } catch {
            // Se lançar exceção, o teste falha
            expect(false).toBe(true);
            return;
          }

          expect(result).toBe(false);

          // Cleanup
          fs.rmSync(dir, { recursive: true, force: true });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P18: getChain() retorna N entradas em ordem cronológica
// ---------------------------------------------------------------------------
describe('P18: getChain() retorna N entradas em ordem cronológica', () => {
  // Feature: governance-pivot, Property 18: getChain() retorna exatamente N entradas ordenadas por timestamp
  it('getChain() retorna exatamente N entradas ordenadas por timestamp crescente', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPassportId,
        fc.integer({ min: 1, max: 8 }),
        async (passportId, n) => {
          const dir = tmpDir();
          const logger = new AuditLoggerAdapter(dir);

          for (let i = 0; i < n; i++) {
            await logger.log({
              passportId,
              action: `action-${i}`,
              actor: 'test-actor',
              inputHash: 'a'.repeat(64),
              resultHash: 'b'.repeat(64),
            });
          }

          const chain = await logger.getChain(passportId);

          // Deve retornar exatamente N entradas
          expect(chain).toHaveLength(n);

          // Deve estar ordenado por timestamp crescente
          for (let i = 1; i < chain.length; i++) {
            expect(chain[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              chain[i - 1].timestamp.getTime(),
            );
          }

          // Cleanup
          fs.rmSync(dir, { recursive: true, force: true });
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P19: Sensibilidade temporal do chainHash
// ---------------------------------------------------------------------------
describe('P19: Sensibilidade temporal do chainHash', () => {
  // Feature: governance-pivot, Property 19: Dois eventos com mesmos dados mas timestamps diferentes produzem chainHashes distintos
  it('dois eventos com mesmos dados mas timestamps diferentes produzem chainHashes distintos', () => {
    fc.assert(
      fc.property(
        fc.option(arbitraryHash64, { nil: null }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        arbitraryHash64,
        arbitraryHash64,
        fc.date({ min: new Date('2020-01-01'), max: new Date('2029-12-31') }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2029-12-31') }),
        (parentHash, action, actor, inputHash, resultHash, date1, date2) => {
          // Só testa quando os timestamps são diferentes e válidos
          fc.pre(date1.getTime() !== date2.getTime());
          fc.pre(!isNaN(date1.getTime()));
          fc.pre(!isNaN(date2.getTime()));

          const hash1 = chainHash(parentHash, date1, action, actor, inputHash, resultHash);
          const hash2 = chainHash(parentHash, date2, action, actor, inputHash, resultHash);

          expect(hash1).not.toBe(hash2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
