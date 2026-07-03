/**
 * Testes de propriedade para ComplianceCheckerAdapter
 * Feature: governance-pivot
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as fc from 'fast-check';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { describe, it, expect } from 'vitest';
import { ComplianceCheckerAdapter } from '../../src/governance/adapters/ComplianceCheckerAdapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cria um diretório temporário único por teste */
function tmpDir(): string {
  const dir = path.join(os.tmpdir(), `compliance-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Escreve um contrato YAML em um diretório temporário e retorna o regulationId */
function writeContract(
  dir: string,
  fileName: string,
  title: string,
  rules: Array<{ id: string; principle: string }>,
): string {
  const contract = {
    source: { title, authors: 'Test Author', year: 2024 },
    rules,
  };
  fs.writeFileSync(path.join(dir, fileName), stringifyYaml(contract), 'utf8');
  return title;
}

/** Gera um ID de regra arbitrário */
const arbitraryRuleId = fc.stringMatching(/^R[0-9]{3}$/);

/** Gera um princípio arbitrário com pelo menos uma palavra >= 4 chars */
const arbitraryPrinciple = fc.string({ minLength: 5, maxLength: 80 }).filter(
  (s) => s.split(/\s+/).some((w) => w.replace(/[^a-z0-9]/gi, '').length >= 4),
);

/** Gera uma regra arbitrária */
const arbitraryRule = fc.record({
  id: arbitraryRuleId,
  principle: arbitraryPrinciple,
});

/** Gera um título de contrato arbitrário (sem caracteres especiais, sem espaços nas bordas) */
const arbitraryTitle = fc
  .string({ minLength: 3, maxLength: 30 })
  .filter((s) => /^[a-zA-Z0-9 _-]+$/.test(s) && s.trim().length >= 3 && s === s.trim());

// ---------------------------------------------------------------------------
// P12: check() produz exatamente um ComplianceStamp por contrato avaliado
// ---------------------------------------------------------------------------
describe('P12: check() produz exatamente um ComplianceStamp por contrato avaliado', () => {
  // Feature: governance-pivot, Property 12: check() produz exatamente um ComplianceStamp por contrato cujo regulationId corresponda aos requirements
  it('check() retorna exatamente N stamps para N contratos com regulationIds distintos', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Gera entre 1 e 5 títulos distintos
        fc.array(arbitraryTitle, { minLength: 1, maxLength: 5 }).filter(
          (titles) => new Set(titles).size === titles.length,
        ),
        fc.array(arbitraryRule, { minLength: 1, maxLength: 4 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        async (titles, rules, code) => {
          const dir = tmpDir();
          try {
            // Escreve N contratos com títulos distintos
            for (let i = 0; i < titles.length; i++) {
              writeContract(dir, `contract-${i}.yaml`, titles[i], rules);
            }

            const adapter = new ComplianceCheckerAdapter(dir);
            const stamps = await adapter.check(code, titles);

            // Deve retornar exatamente N stamps (um por contrato correspondente)
            expect(stamps).toHaveLength(titles.length);

            // Cada stamp deve ter o regulationId correto
            const stampIds = stamps.map((s) => s.regulationId);
            for (const title of titles) {
              expect(stampIds).toContain(title);
            }
          } finally {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('check() retorna array vazio quando nenhum contrato corresponde aos requirements', async () => {
    const dir = tmpDir();
    try {
      writeContract(dir, 'contract.yaml', 'Título Existente', [
        { id: 'R001', principle: 'verificar segurança' },
      ]);

      const adapter = new ComplianceCheckerAdapter(dir);
      const stamps = await adapter.check('código qualquer', ['Título Inexistente']);

      expect(stamps).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('check() retorna array vazio quando contractsDir está vazio', async () => {
    const dir = tmpDir();
    try {
      const adapter = new ComplianceCheckerAdapter(dir);
      const stamps = await adapter.check('código qualquer', ['Qualquer Regulação']);
      expect(stamps).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// P13: score = K / N onde K é o número de cláusulas satisfeitas e N o total
// ---------------------------------------------------------------------------
describe('P13: score = K / N onde K é o número de cláusulas satisfeitas e N o total', () => {
  // Feature: governance-pivot, Property 13: score = K / N onde K é o número de cláusulas satisfeitas e N o total
  it('score do ComplianceStamp é a proporção exata de cláusulas satisfeitas', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Gera N regras com princípios distintos e controláveis
        fc.integer({ min: 1, max: 8 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            // K regras que serão satisfeitas (palavras que aparecem no código)
            fc.integer({ min: 0, max: n }),
          ),
        ),
        async ([n, k]) => {
          const dir = tmpDir();
          try {
            // Cria N regras: as primeiras K usam a palavra "satisfeita" (que estará no código)
            // as demais usam "xyzwqjkl" (que não estará no código)
            const rules = Array.from({ length: n }, (_, i) => ({
              id: `R${String(i).padStart(3, '0')}`,
              principle: i < k ? `verificar satisfeita implementação` : `xyzwqjkl ausente inexistente`,
            }));

            const title = 'Test Score Contract';
            writeContract(dir, 'score-test.yaml', title, rules);

            // Código que contém "satisfeita" mas não "xyzwqjkl"
            const code = 'function satisfeita() { return implementação; }';

            const adapter = new ComplianceCheckerAdapter(dir);
            const stamps = await adapter.check(code, [title]);

            expect(stamps).toHaveLength(1);
            const stamp = stamps[0];

            const expectedScore = k / n;
            expect(stamp.score).toBeCloseTo(expectedScore, 10);
          } finally {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('score é 0 quando nenhuma cláusula é satisfeita', async () => {
    const dir = tmpDir();
    try {
      writeContract(dir, 'contract.yaml', 'Zero Score', [
        { id: 'R001', principle: 'xyzwqjkl ausente' },
        { id: 'R002', principle: 'qrstuvwx inexistente' },
      ]);

      const adapter = new ComplianceCheckerAdapter(dir);
      const stamps = await adapter.check('código sem palavras relevantes', ['Zero Score']);

      expect(stamps[0].score).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('score é 1 quando todas as cláusulas são satisfeitas', async () => {
    const dir = tmpDir();
    try {
      writeContract(dir, 'contract.yaml', 'Full Score', [
        { id: 'R001', principle: 'verificar segurança' },
        { id: 'R002', principle: 'implementar validação' },
      ]);

      const adapter = new ComplianceCheckerAdapter(dir);
      const stamps = await adapter.check(
        'verificar segurança e implementar validação do sistema',
        ['Full Score'],
      );

      expect(stamps[0].score).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// P14: round-trip do parser YAML
// ---------------------------------------------------------------------------
describe('P14: round-trip do parser YAML de contratos', () => {
  // Feature: governance-pivot, Property 14: parsear → serializar → parsear novamente produz o mesmo conjunto de regras
  it('parsear → serializar → parsear novamente produz o mesmo conjunto de regras', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTitle,
        fc.array(
          fc.record({
            id: arbitraryRuleId,
            principle: fc.string({ minLength: 1, maxLength: 80 }),
          }),
          { minLength: 1, maxLength: 6 },
        ).filter((rules) => {
          // IDs únicos
          const ids = rules.map((r) => r.id);
          return new Set(ids).size === ids.length;
        }),
        async (title, rules) => {
          const dir = tmpDir();
          try {
            // Escreve o contrato original
            const originalContract = {
              source: { title, authors: 'Test', year: 2024 },
              rules,
            };
            const yamlStr = stringifyYaml(originalContract);
            const contractPath = path.join(dir, 'roundtrip.yaml');
            fs.writeFileSync(contractPath, yamlStr, 'utf8');

            // Parse 1: carrega via adapter
            const adapter1 = new ComplianceCheckerAdapter(dir);
            const loaded1 = adapter1.getLoadedContracts().get(title);
            expect(loaded1).toBeDefined();

            // Serializa de volta para YAML
            const reserializedYaml = stringifyYaml(loaded1!.contract);

            // Parse 2: parseia o YAML re-serializado
            const reparsed = parseYaml(reserializedYaml) as { rules?: Array<{ id: string; principle: string }> };

            // As regras devem ser as mesmas
            expect(reparsed.rules).toBeDefined();
            expect(reparsed.rules).toHaveLength(rules.length);

            for (let i = 0; i < rules.length; i++) {
              const originalRule = rules[i];
              const reparsedRule = reparsed.rules!.find((r) => r.id === originalRule.id);
              expect(reparsedRule).toBeDefined();
              expect(reparsedRule!.principle).toBe(originalRule.principle);
            }
          } finally {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// P21: check() é idempotente
// ---------------------------------------------------------------------------
describe('P21: check() é idempotente', () => {
  // Feature: governance-pivot, Property 21: chamar check(code, requirements) múltiplas vezes produz o mesmo resultado
  it('check(code, requirements) produz o mesmo resultado em chamadas repetidas', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTitle,
        fc.array(arbitraryRule, { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.integer({ min: 2, max: 5 }),
        async (title, rules, code, numCalls) => {
          const dir = tmpDir();
          try {
            writeContract(dir, 'idempotent.yaml', title, rules);

            const adapter = new ComplianceCheckerAdapter(dir);

            // Chama check() múltiplas vezes
            const results = await Promise.all(
              Array.from({ length: numCalls }, () => adapter.check(code, [title])),
            );

            // Todos os resultados devem ser equivalentes
            const first = results[0];
            for (let i = 1; i < results.length; i++) {
              const current = results[i];
              expect(current).toHaveLength(first.length);

              for (let j = 0; j < first.length; j++) {
                expect(current[j].regulationId).toBe(first[j].regulationId);
                expect(current[j].score).toBe(first[j].score);
                expect(current[j].clauses).toEqual(first[j].clauses);
                expect(current[j].verifiedBy).toBe(first[j].verifiedBy);
              }
            }
          } finally {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('loadContract() seguido de check() é idempotente para o mesmo contrato', async () => {
    const dir = tmpDir();
    try {
      const contractPath = path.join(dir, 'test.yaml');
      const contract = {
        source: { title: 'Idempotent Test' },
        rules: [
          { id: 'R001', principle: 'verificar segurança' },
          { id: 'R002', principle: 'implementar validação' },
        ],
      };
      fs.writeFileSync(contractPath, stringifyYaml(contract), 'utf8');

      const adapter = new ComplianceCheckerAdapter(dir);
      const code = 'verificar segurança e implementar validação';

      // Carrega o mesmo contrato múltiplas vezes (deve sobrescrever, não duplicar)
      await adapter.loadContract(contractPath);
      await adapter.loadContract(contractPath);

      const stamps1 = await adapter.check(code, ['Idempotent Test']);
      const stamps2 = await adapter.check(code, ['Idempotent Test']);

      expect(stamps1).toHaveLength(1);
      expect(stamps2).toHaveLength(1);
      expect(stamps1[0].score).toBe(stamps2[0].score);
      expect(stamps1[0].clauses).toEqual(stamps2[0].clauses);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Testes adicionais de comportamento
// ---------------------------------------------------------------------------
describe('Comportamento de inicialização', () => {
  it('não lança exceção quando contractsDir não existe', () => {
    const nonExistentDir = path.join(os.tmpdir(), `nonexistent-${Date.now()}`);
    expect(() => new ComplianceCheckerAdapter(nonExistentDir)).not.toThrow();
  });

  it('ignora arquivos YAML inválidos sem lançar exceção', async () => {
    const dir = tmpDir();
    try {
      // Escreve um YAML inválido
      fs.writeFileSync(path.join(dir, 'invalid.yaml'), ': invalid: yaml: [unclosed', 'utf8');
      // Escreve um YAML válido
      writeContract(dir, 'valid.yaml', 'Valid Contract', [
        { id: 'R001', principle: 'verificar segurança' },
      ]);

      expect(() => new ComplianceCheckerAdapter(dir)).not.toThrow();

      const adapter = new ComplianceCheckerAdapter(dir);
      const stamps = await adapter.check('verificar segurança', ['Valid Contract']);
      expect(stamps).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('usa nome do arquivo como regulationId quando source.title está ausente', async () => {
    const dir = tmpDir();
    try {
      const contract = {
        rules: [{ id: 'R001', principle: 'verificar segurança' }],
      };
      fs.writeFileSync(path.join(dir, 'my-contract.yaml'), stringifyYaml(contract), 'utf8');

      const adapter = new ComplianceCheckerAdapter(dir);
      const stamps = await adapter.check('verificar segurança', ['my-contract']);

      expect(stamps).toHaveLength(1);
      expect(stamps[0].regulationId).toBe('my-contract');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
