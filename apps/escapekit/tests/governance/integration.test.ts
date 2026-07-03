/**
 * Testes de integração para createGovernanceStack()
 * Feature: governance-pivot
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { createGovernanceStack } from '../../src/governance/index.js';
import type {
  IValidationEngine,
} from '../../src/governance/GovernanceEngine.js';
import type { ValidationResult } from '../../src/validate/types.js';
import type { GovernanceContext } from '../../src/governance/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cria um diretório temporário único por teste */
function tmpDir(): string {
  const dir = path.join(
    os.tmpdir(),
    `governance-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Cria um ValidationResult sem issues */
function makeCleanValidationResult(): ValidationResult {
  return {
    canDeploy: true,
    confidence: 1.0,
    duration: 0,
    checks: {
      build: { passed: true, installTime: 0, buildTime: 0, errors: [], warnings: [] },
      runtime: { passed: true, startupTime: 0, memoryUsage: 0, apiResponses: [], healthChecks: [] },
      dependencies: {
        passed: true,
        ghostPackages: [],
        outdatedPackages: [],
        vulnerabilities: [],
        missingPeerDeps: [],
      },
    },
    fixesApplied: [],
    remainingIssues: [],
    recommendations: [],
    iterationCount: 0,
  };
}

/** Mock simples de IValidationEngine */
function makeMockValidationEngine(
  result: ValidationResult = makeCleanValidationResult(),
): IValidationEngine & { callCount: number } {
  let callCount = 0;
  return {
    get callCount() { return callCount; },
    async validate(_code: string) {
      callCount++;
      return result;
    },
  };
}

/** Contexto de governança mínimo válido */
function makeContext(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    code: 'const x = 1;',
    origin: 'unknown',
    projectId: 'proj-integration',
    requirements: [],
    actor: 'integration-test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Fluxo completo com estratégia `thorough`
// ---------------------------------------------------------------------------
describe('Fluxo completo com estratégia thorough', () => {
  it('govern() retorna GovernancePassport válido com todos os campos', async () => {
    const auditLogsDir = tmpDir();
    const sqlitePath = path.join(tmpDir(), 'governance.db');

    const mockVE = makeMockValidationEngine();
    const stack = createGovernanceStack(mockVE, {
      sqlitePath,
      contractsDir: tmpDir(), // diretório vazio — sem contratos
      auditLogsDir,
    });

    const passport = await stack.engine.govern(makeContext({ strategy: 'thorough' }));

    // Verifica todos os campos obrigatórios
    expect(typeof passport.passportId).toBe('string');
    expect(passport.passportId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(typeof passport.codeFingerprint.hash).toBe('string');
    expect(typeof passport.codeFingerprint.astSignature).toBe('string');
    expect(Array.isArray(passport.codeFingerprint.dependencies)).toBe(true);
    expect(passport.codeFingerprint.complexity).toBeGreaterThanOrEqual(0);

    expect(Array.isArray(passport.validations)).toBe(true);
    expect(Array.isArray(passport.complianceStamps)).toBe(true);
    expect(Array.isArray(passport.auditTrail)).toBe(true);
    expect(passport.auditTrail).toHaveLength(1);

    expect(typeof passport.memoryEnriched).toBe('boolean');
    expect(['low', 'medium', 'high', 'critical']).toContain(passport.riskLevel);
    expect(passport.estimatedRemediationCost).toBeGreaterThanOrEqual(0);

    // Com estratégia thorough, o ValidationEngine deve ter sido chamado
    expect(mockVE.callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Fluxo com estratégia `fast`
// ---------------------------------------------------------------------------
describe('Fluxo com estratégia fast', () => {
  it('govern() retorna passaporte sem chamar ValidationEngine', async () => {
    const auditLogsDir = tmpDir();
    const sqlitePath = path.join(tmpDir(), 'governance.db');

    const mockVE = makeMockValidationEngine();
    const stack = createGovernanceStack(mockVE, {
      sqlitePath,
      contractsDir: tmpDir(),
      auditLogsDir,
    });

    const passport = await stack.engine.govern(makeContext({ strategy: 'fast' }));

    // Passaporte deve ser válido
    expect(typeof passport.passportId).toBe('string');
    expect(passport.auditTrail).toHaveLength(1);

    // Com estratégia fast, o ValidationEngine NÃO deve ter sido chamado
    expect(mockVE.callCount).toBe(0);

    // validations deve estar vazio (sem chamada ao VE)
    expect(passport.validations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Fluxo com estratégia `compliance-first` com score alto
// ---------------------------------------------------------------------------
describe('Fluxo com estratégia compliance-first — score alto', () => {
  it('govern() chama ValidationEngine quando score médio >= 0.5', async () => {
    const auditLogsDir = tmpDir();
    const contractsDir = tmpDir();
    const sqlitePath = path.join(tmpDir(), 'governance.db');

    // Cria um contrato YAML com regras que serão satisfeitas pelo código
    const contractContent = `
source:
  title: "High Score Contract"
rules:
  - id: R001
    principle: "verificar implementação"
  - id: R002
    principle: "implementar validação"
`;
    fs.writeFileSync(path.join(contractsDir, 'high-score.yaml'), contractContent, 'utf8');

    const mockVE = makeMockValidationEngine();
    const stack = createGovernanceStack(mockVE, {
      sqlitePath,
      contractsDir,
      auditLogsDir,
    });

    // Código que satisfaz as regras do contrato
    const code = 'function verificar() { return implementar(); } // validação implementação';
    const passport = await stack.engine.govern(
      makeContext({
        strategy: 'compliance-first',
        code,
        requirements: ['High Score Contract'],
      }),
    );

    // Com score alto, o ValidationEngine deve ter sido chamado
    expect(mockVE.callCount).toBe(1);
    expect(passport.complianceStamps).toHaveLength(1);
    expect(passport.complianceStamps[0].score).toBeGreaterThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// 4. Fluxo com estratégia `compliance-first` com score baixo
// ---------------------------------------------------------------------------
describe('Fluxo com estratégia compliance-first — score baixo', () => {
  it('govern() não chama ValidationEngine quando score médio < 0.5', async () => {
    const auditLogsDir = tmpDir();
    const contractsDir = tmpDir();
    const sqlitePath = path.join(tmpDir(), 'governance.db');

    // Cria um contrato YAML com regras que NÃO serão satisfeitas pelo código
    const contractContent = `
source:
  title: "Low Score Contract"
rules:
  - id: R001
    principle: "xyzwqjkl ausente inexistente"
  - id: R002
    principle: "qrstuvwx faltando completamente"
`;
    fs.writeFileSync(path.join(contractsDir, 'low-score.yaml'), contractContent, 'utf8');

    const mockVE = makeMockValidationEngine();
    const stack = createGovernanceStack(mockVE, {
      sqlitePath,
      contractsDir,
      auditLogsDir,
    });

    // Código que NÃO satisfaz as regras do contrato
    const passport = await stack.engine.govern(
      makeContext({
        strategy: 'compliance-first',
        code: 'const x = 1;',
        requirements: ['Low Score Contract'],
      }),
    );

    // Com score baixo, o ValidationEngine NÃO deve ter sido chamado
    expect(mockVE.callCount).toBe(0);
    expect(passport.complianceStamps).toHaveLength(1);
    expect(passport.complianceStamps[0].score).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// 5. Verificar que o ValidationEngine existente é composto sem modificação
// ---------------------------------------------------------------------------
describe('Composição do ValidationEngine sem modificação', () => {
  it('o mock de ValidationEngine é chamado corretamente com o código fornecido', async () => {
    const auditLogsDir = tmpDir();
    const sqlitePath = path.join(tmpDir(), 'governance.db');

    const receivedCodes: string[] = [];
    const mockVE: IValidationEngine = {
      async validate(code: string) {
        receivedCodes.push(code);
        return makeCleanValidationResult();
      },
    };

    const stack = createGovernanceStack(mockVE, {
      sqlitePath,
      contractsDir: tmpDir(),
      auditLogsDir,
    });

    const testCode = 'function hello() { return "world"; }';
    await stack.engine.govern(makeContext({ strategy: 'thorough', code: testCode }));

    // O ValidationEngine deve ter recebido exatamente o código fornecido
    expect(receivedCodes).toHaveLength(1);
    expect(receivedCodes[0]).toBe(testCode);
  });

  it('o resultado do ValidationEngine é refletido no passaporte', async () => {
    const auditLogsDir = tmpDir();
    const sqlitePath = path.join(tmpDir(), 'governance.db');

    const resultWithWarning: ValidationResult = {
      ...makeCleanValidationResult(),
      canDeploy: true,
      remainingIssues: [
        { type: 'BUILD_ERROR', severity: 'warning', message: 'aviso de teste' },
      ],
    };

    const mockVE = makeMockValidationEngine(resultWithWarning);
    const stack = createGovernanceStack(mockVE, {
      sqlitePath,
      contractsDir: tmpDir(),
      auditLogsDir,
    });

    const passport = await stack.engine.govern(makeContext({ strategy: 'thorough' }));

    // O passaporte deve refletir o resultado do ValidationEngine
    expect(passport.validations).toHaveLength(1);
    expect(passport.riskLevel).toBe('medium'); // warning sem erro → medium
    expect(passport.estimatedRemediationCost).toBe(0.5); // 1 issue * 0.5
  });
});

// ---------------------------------------------------------------------------
// 6. Múltiplas chamadas a createGovernanceStack() retornam pilhas independentes
// ---------------------------------------------------------------------------
describe('Independência de pilhas criadas por createGovernanceStack()', () => {
  it('múltiplas chamadas com os mesmos parâmetros retornam pilhas sem estado compartilhado', async () => {
    const auditLogsDir1 = tmpDir();
    const auditLogsDir2 = tmpDir();
    const sqlitePath1 = path.join(tmpDir(), 'governance1.db');
    const sqlitePath2 = path.join(tmpDir(), 'governance2.db');

    const mockVE1 = makeMockValidationEngine();
    const mockVE2 = makeMockValidationEngine();

    const stack1 = createGovernanceStack(mockVE1, {
      sqlitePath: sqlitePath1,
      contractsDir: tmpDir(),
      auditLogsDir: auditLogsDir1,
    });

    const stack2 = createGovernanceStack(mockVE2, {
      sqlitePath: sqlitePath2,
      contractsDir: tmpDir(),
      auditLogsDir: auditLogsDir2,
    });

    // Salva um passaporte na pilha 1
    const passport1 = await stack1.engine.govern(makeContext({ code: 'const a = 1;' }));

    // A pilha 2 não deve ter o passaporte da pilha 1
    const recalled = await stack2.memory.recall(passport1.codeFingerprint, 0);
    expect(recalled.find((p) => p.passportId === passport1.passportId)).toBeUndefined();

    // A pilha 1 deve ter o passaporte
    const recalled1 = await stack1.memory.recall(passport1.codeFingerprint, 0);
    expect(recalled1.find((p) => p.passportId === passport1.passportId)).toBeDefined();
  });

  it('passaportes salvos em uma pilha não afetam a cadeia de auditoria da outra', async () => {
    const auditLogsDir1 = tmpDir();
    const auditLogsDir2 = tmpDir();

    const mockVE = makeMockValidationEngine();

    const stack1 = createGovernanceStack(mockVE, {
      sqlitePath: path.join(tmpDir(), 'g1.db'),
      contractsDir: tmpDir(),
      auditLogsDir: auditLogsDir1,
    });

    const stack2 = createGovernanceStack(mockVE, {
      sqlitePath: path.join(tmpDir(), 'g2.db'),
      contractsDir: tmpDir(),
      auditLogsDir: auditLogsDir2,
    });

    const passport1 = await stack1.engine.govern(makeContext());

    // A cadeia de auditoria da pilha 2 não deve conter o passaporte da pilha 1
    const chain2 = await stack2.audit.getChain(passport1.passportId);
    expect(chain2).toHaveLength(0);

    // A cadeia de auditoria da pilha 1 deve conter o passaporte
    const chain1 = await stack1.audit.getChain(passport1.passportId);
    expect(chain1).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// P22: createGovernanceStack() é idempotente
// Feature: governance-pivot, Property 22: múltiplas chamadas a createGovernanceStack() com os mesmos parâmetros retornam pilhas funcionalmente equivalentes sem estado compartilhado
// ---------------------------------------------------------------------------
describe('P22: createGovernanceStack() é idempotente', () => {
  it('múltiplas chamadas retornam pilhas funcionalmente equivalentes sem estado compartilhado', async () => {
    // Feature: governance-pivot, Property 22: múltiplas chamadas a createGovernanceStack() com os mesmos parâmetros retornam pilhas funcionalmente equivalentes sem estado compartilhado
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('copilot', 'claude', 'bolt', 'cursor', 'unknown' as const),
        async (code, origin) => {
          // Cada pilha usa caminhos únicos para garantir isolamento
          const auditLogsDir1 = tmpDir();
          const auditLogsDir2 = tmpDir();
          const sqlitePath1 = path.join(tmpDir(), 'g1.db');
          const sqlitePath2 = path.join(tmpDir(), 'g2.db');
          const contractsDir = tmpDir();

          const mockVE1 = makeMockValidationEngine();
          const mockVE2 = makeMockValidationEngine();

          const stack1 = createGovernanceStack(mockVE1, {
            sqlitePath: sqlitePath1,
            contractsDir,
            auditLogsDir: auditLogsDir1,
          });

          const stack2 = createGovernanceStack(mockVE2, {
            sqlitePath: sqlitePath2,
            contractsDir,
            auditLogsDir: auditLogsDir2,
          });

          const ctx = makeContext({ code, origin });

          // Ambas as pilhas devem produzir passaportes válidos
          const passport1 = await stack1.engine.govern(ctx);
          const passport2 = await stack2.engine.govern(ctx);

          // Passaportes devem ter IDs distintos (sem estado compartilhado)
          expect(passport1.passportId).not.toBe(passport2.passportId);

          // Ambos devem ter estrutura válida
          expect(passport1.passportId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          expect(passport2.passportId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );

          // Salvar na pilha 1 não deve afetar a pilha 2
          const recalled2 = await stack2.memory.recall(passport1.codeFingerprint, 0);
          const found = recalled2.find((p) => p.passportId === passport1.passportId);
          expect(found).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
