# Design: Academic Paper Validation

## Overview

Esta feature estende o EscapeKit com um sistema de rastreabilidade acadêmica que conecta cada `Issue` gerada pelos detectores ao paper científico que a fundamenta. A abordagem central é **estender o `KnowledgeBase` existente** (`src/resolvers/KnowledgeBase.ts`) em vez de criar infraestrutura paralela — o `KnowledgeBase` já gerencia um `Map` de mapeamentos e possui `loadFromFile()`/`getMapping()`, então adicionamos um segundo `Map` para referências acadêmicas com `loadPaperContracts()` e `getAcademicReference()`.

O sistema tem três responsabilidades principais:
1. **Enriquecimento**: associar `AcademicReference` a cada `Issue` via `KnowledgeBase.getAcademicReference(issueType)`
2. **Cobertura**: validar que todos os fatos/regras dos contratos YAML têm implementação registrada via `CoverageValidator`
3. **Exposição**: exibir referências na CLI via flag `--academic` nos comandos `validate` e `audit`

## Architecture

```mermaid
graph TD
    subgraph "knowledge-base/"
        REG[registry.yaml]
        C1[ieee-sp-2024.yaml]
        C2[ccs-2023.yaml]
        C3[esec-fse-2024.yaml]
        C4[icwe-2024.yaml]
        C5[ase-2023-config.yaml]
        C6[ase-2023-ghost.yaml]
        C7[icse-2024.yaml]
        REG --> C1 & C2 & C3 & C4 & C5 & C6 & C7
    end

    subgraph "src/resolvers/"
        KB[KnowledgeBase\n+ Map PackageMapping\n+ Map AcademicReference[]\n+ loadPaperContracts\(\)\n+ getAcademicReference\(\)]
    end

    subgraph "src/security/ & src/detectors/"
        DET[Detectors\nSlopsquatDetector\nPostInstallDetector\nPolyfillInjector\nWebGLDetector\nConfigUpdater\nDependencyValidator]
    end

    subgraph "src/academic/"
        CV[CoverageValidator\n+ validate\(contracts\)\n+ generateReport\(\)]
        ENR[IssueEnricher\n+ enrich\(issue, kb\)]
    end

    subgraph "CLI"
        VCMD[validate --academic]
        ACMD[audit --academic]
        CCMD[coverage]
    end

    REG -->|loadPaperContracts| KB
    KB -->|getAcademicReference| ENR
    DET -->|Issue| ENR
    ENR -->|Issue + academicReference| VCMD
    ENR -->|Issue + academicReference| ACMD
    KB -->|contracts| CV
    CV -->|CoverageReport| CCMD
```

## Components and Interfaces

### Extensão do KnowledgeBase

O `KnowledgeBase` existente recebe dois novos membros privados e dois métodos públicos:

```typescript
// src/resolvers/KnowledgeBase.ts (extensão)

export class KnowledgeBase {
  private mappings: Map<string, PackageMapping>;          // existente
  private academicRefs: Map<string, AcademicReference[]>; // novo

  // Métodos existentes mantidos sem alteração:
  // getMapping(), addMapping(), loadFromFile(), exportToFile(), size(), clear()

  async loadPaperContracts(registryPath: string): Promise<void>;
  getAcademicReference(issueType: string): AcademicReference[] | undefined;
}
```

O método `loadPaperContracts` lê o `registry.yaml`, itera sobre cada entrada, carrega o `Contrato_YAML` correspondente, e para cada `rule` com `paperRef` definido e `traceability[ruleId].status === 'implemented'`, insere uma `AcademicReference` no mapa `academicRefs` indexada pelo `detector_name` da regra (que mapeia para o `IssueType`).

### IssueEnricher

Função utilitária pura (sem estado) que recebe uma `Issue` e um `KnowledgeBase` e retorna a `Issue` com `academicReference` preenchido:

```typescript
// src/academic/IssueEnricher.ts

export function enrichIssue(issue: Issue, kb: KnowledgeBase): Issue {
  const refs = kb.getAcademicReference(issue.type);
  if (!refs || refs.length === 0) return issue;
  return { ...issue, academicReference: refs[0] };
}

export function enrichIssues(issues: Issue[], kb: KnowledgeBase): Issue[] {
  return issues.map(i => enrichIssue(i, kb));
}
```

### CoverageValidator

```typescript
// src/academic/CoverageValidator.ts

export class CoverageValidator {
  validate(contracts: ContratoYAML[]): CoverageReport;
  formatReport(report: CoverageReport): string;
  formatMarkdown(report: CoverageReport): string;
}
```

`validate()` é uma função pura: recebe contratos em memória, retorna relatório. Sem I/O.

## Data Models

### AcademicReference

```typescript
// src/models/academic.ts

export interface AcademicReference {
  paperId: string;       // ex: "IEEE-SP-2024"
  title: string;
  venue: string;         // ex: "IEEE S&P"
  year: number;          // ex: 2024
  ruleId: string;        // ex: "R001"
  factIds: string[];     // ex: ["F001", "F002"]
}
```

### Issue estendida

```typescript
// src/models/schemas.ts (extensão)

export interface Issue {
  // campos existentes mantidos...
  id: string;
  type: IssueType;
  severity: ErrorSeverity;
  location: IssueLocation;
  message: string;
  description: string;
  suggestion?: string;
  autoFixable: boolean;
  academicReference?: AcademicReference; // novo campo opcional
}
```

### CoverageReport

```typescript
export interface ContractCoverage {
  paperId: string;
  contractFile: string;
  totalRules: number;
  totalFacts: number;
  implementedCount: number;
  pendingCount: number;
  missingCount: number;       // sem entrada traceability
  gaps: string[];             // IDs sem implementação
}

export interface CoverageReport {
  generatedAt: string;
  contracts: ContractCoverage[];
  totalRules: number;
  totalFacts: number;
  totalImplemented: number;
  coveragePercentage: number; // arredondado para 1 casa decimal
}
```

### ContratoYAML (tipo TypeScript)

```typescript
export interface TraceabilityEntry {
  implementation: string;
  tests: string;
  status: 'implemented' | 'pending' | 'not_applicable';
}

export interface YAMLRule {
  id: string;
  principle: string;
  derived_from: string[];
  action: string;
  detector_name?: string;
  paperRef?: string;          // novo campo: aponta para paperId no registry
  priority: 'high' | 'medium' | 'low';
}

export interface YAMLFact {
  id: string;
  statement: string;
  type: string;
  relevance: string;
  location?: string;
}

export interface ContratoYAML {
  source: {
    title: string;
    authors: string;
    year: number;
    url?: string;
    doi?: string;
  };
  facts: YAMLFact[];
  patterns?: unknown[];
  rules: YAMLRule[];
  cases?: unknown[];
  traceability?: Record<string, TraceabilityEntry>;
  metadata?: Record<string, unknown>;
}
```

### PaperRegistry (schema do registry.yaml)

```yaml
# knowledge-base/registry.yaml
papers:
  - paperId: "IEEE-SP-2024"
    title: "Typosquatting in Package Repositories: A Large-Scale Study"
    venue: "IEEE S&P"
    year: 2024
    contractFile: "ieee-sp-2024.yaml"
    detectors:
      - "SlopsquatDetector"

  - paperId: "CCS-2023"
    title: "Malicious Post-install Scripts in npm Packages"
    venue: "CCS"
    year: 2023
    contractFile: "ccs-2023.yaml"
    detectors:
      - "PostInstallDetector"

  # ... demais 5 papers
```

### Schema do Contrato YAML com `paperRef`

```yaml
rules:
  - id: "R001"
    principle: "Detectar pacotes com nomes similares a pacotes populares"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "SlopsquatDetector"
    paperRef: "IEEE-SP-2024"      # campo novo
    priority: "high"

traceability:
  R001:
    implementation: "src/security/SlopsquatDetector.ts"
    tests: "tests/security/SlopsquatDetector.test.ts"
    status: "implemented"
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: TraceabilityIndex round-trip

*For any* array de `ContratoYAML` válidos onde uma `rule` tem `detector_name: X`, `paperRef` definido e `traceability[ruleId].status === 'implemented'`, chamar `getAcademicReference(X)` após `loadPaperContracts` deve retornar um array não vazio contendo uma referência com o `paperId` correto.

**Validates: Requirements 2.3, 2.4, 8.3**

### Property 2: Apenas regras implementadas com paperRef contribuem para o índice

*For any* `ContratoYAML` onde uma `rule` tem `status: 'pending'` ou não tem `paperRef`, o `issueType` correspondente NÃO deve aparecer no `TraceabilityIndex`. O índice deve conter apenas entradas derivadas de regras com `paperRef` definido e `status: 'implemented'`.

**Validates: Requirements 5.7, 1.9**

### Property 3: Cálculo do coveragePercentage

*For any* array de `ContratoYAML`, o `coveragePercentage` retornado pelo `CoverageValidator` deve ser matematicamente igual a `(totalImplemented / (totalRules + totalFacts)) * 100`, arredondado para uma casa decimal. Para arrays vazios, deve retornar `0.0`.

**Validates: Requirements 4.5**

### Property 4: Cobertura total quando todos implementados

*For any* array de `ContratoYAML` onde todos os fatos e regras têm `traceability[id].status === 'implemented'`, o `CoverageValidator` deve retornar `coveragePercentage === 100.0`.

**Validates: Requirements 4.6, 8.4**

### Property 5: Determinismo do TraceabilityIndex

*For any* array de `ContratoYAML`, chamar `loadPaperContracts` duas vezes com o mesmo input e comparar os resultados de `getAcademicReference` para todos os `issueTypes` deve produzir resultados idênticos (mesma estrutura, mesma ordem).

**Validates: Requirements 2.6, 8.5**

### Property 6: Formatação da linha de referência acadêmica

*For any* `AcademicReference` válida, a função de formatação da CLI deve produzir uma string que contém o `title`, o `venue`, o `year` e o `ruleId` da referência.

**Validates: Requirements 6.1**

### Property 7: Detecção de lacunas

*For any* `ContratoYAML` onde um subconjunto de `rules[].id` e `facts[].id` não possui entrada na seção `traceability`, o `CoverageReport` deve listar exatamente esses IDs no campo `gaps` do `ContractCoverage` correspondente.

**Validates: Requirements 4.3**

## Error Handling

| Situação | Comportamento |
|---|---|
| `registry.yaml` não encontrado | `loadPaperContracts` loga warning, `academicRefs` permanece vazio |
| `contractFile` referenciado não existe | Loga erro, ignora aquela entrada do registry |
| YAML malformado (sintaxe inválida) | Loga warning com nome do arquivo, ignora o contrato |
| Campos obrigatórios ausentes (`source`, `facts`, `rules`) | Loga warning, ignora o contrato |
| `IssueType` sem mapeamento | `getAcademicReference` retorna `undefined`, sem exceção |
| `paperRef` aponta para paperId inexistente no registry | Loga warning, ignora aquela rule |
| Array de contratos vazio | `CoverageReport` com todos os totais zerados e `coveragePercentage: 0.0` |

Todos os erros de I/O em `loadPaperContracts` são capturados e logados via `this.log.warn/error` (usando o logger existente do `KnowledgeBase`). Nenhum erro de carregamento de contratos deve propagar para o chamador — o sistema degrada graciosamente com um índice parcial ou vazio.

## Testing Strategy

### Abordagem dual: unit tests + property-based tests

Unit tests cobrem exemplos concretos e casos de borda. Property tests (via `fast-check`) verificam invariantes universais com 100+ iterações.

**Biblioteca PBT**: `fast-check` (já instalado no projeto)
**Framework de testes**: Vitest

### Estrutura de arquivos de teste

```
tests/academic/
  KnowledgeBase.academic.test.ts   # unit + PBT para extensão do KB
  CoverageValidator.test.ts        # unit + PBT para cobertura
  IssueEnricher.test.ts            # unit tests para enriquecimento
  formatters.test.ts               # unit tests para formatação CLI
```

### Exemplos de testes

```typescript
// tests/academic/KnowledgeBase.academic.test.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import { arbitraryContratoYAML } from './arbitraries.js';

describe('KnowledgeBase - academic extension', () => {

  // Unit test: mapeamento concreto SlopsquatDetector → IEEE-SP-2024
  it('maps slopsquat_risk to IEEE-SP-2024', async () => {
    const kb = new KnowledgeBase();
    await kb.loadPaperContracts('knowledge-base/registry.yaml');
    const refs = kb.getAcademicReference('slopsquat_risk');
    expect(refs).toBeDefined();
    expect(refs![0].paperId).toBe('IEEE-SP-2024');
  });

  // Unit test: issueType desconhecido retorna undefined sem exceção
  it('returns undefined for unknown issueType', async () => {
    const kb = new KnowledgeBase();
    await kb.loadPaperContracts('knowledge-base/registry.yaml');
    expect(() => kb.getAcademicReference('nonexistent_type')).not.toThrow();
    expect(kb.getAcademicReference('nonexistent_type')).toBeUndefined();
  });

  // Property 1: round-trip — Feature: academic-paper-validation, Property 1: TraceabilityIndex round-trip
  it('Property 1: round-trip — implemented rules with paperRef appear in index', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 1, maxLength: 10 }), (contracts) => {
        const kb = new KnowledgeBase();
        kb.loadContractsSync(contracts); // método de teste sem I/O
        const implementedRules = contracts.flatMap(c =>
          c.rules.filter(r =>
            r.paperRef &&
            r.detector_name &&
            c.traceability?.[r.id]?.status === 'implemented'
          )
        );
        for (const rule of implementedRules) {
          const refs = kb.getAcademicReference(rule.detector_name!);
          expect(refs).toBeDefined();
          expect(refs!.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 5: determinismo — Feature: academic-paper-validation, Property 5: Determinismo
  it('Property 5: deterministic output for same input', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 0, maxLength: 10 }), (contracts) => {
        const kb1 = new KnowledgeBase();
        kb1.loadContractsSync(contracts);
        const kb2 = new KnowledgeBase();
        kb2.loadContractsSync(contracts);

        const allIssueTypes = contracts.flatMap(c =>
          c.rules.map(r => r.detector_name).filter(Boolean)
        );
        for (const issueType of allIssueTypes) {
          expect(kb1.getAcademicReference(issueType!)).toEqual(
            kb2.getAcademicReference(issueType!)
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// tests/academic/CoverageValidator.test.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CoverageValidator } from '../../src/academic/CoverageValidator.js';
import { arbitraryContratoYAML, arbitraryFullyImplementedContratoYAML } from './arbitraries.js';

describe('CoverageValidator', () => {

  // Property 3: cálculo matemático — Feature: academic-paper-validation, Property 3: coveragePercentage
  it('Property 3: coveragePercentage = (implemented / total) * 100', () => {
    fc.assert(
      fc.property(fc.array(arbitraryContratoYAML(), { minLength: 1, maxLength: 10 }), (contracts) => {
        const validator = new CoverageValidator();
        const report = validator.validate(contracts);
        const total = report.totalRules + report.totalFacts;
        if (total === 0) {
          expect(report.coveragePercentage).toBe(0.0);
        } else {
          const expected = Math.round((report.totalImplemented / total) * 1000) / 10;
          expect(report.coveragePercentage).toBe(expected);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Property 4: todos implementados → 100% — Feature: academic-paper-validation, Property 4: all-implemented
  it('Property 4: all implemented → coveragePercentage === 100.0', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryFullyImplementedContratoYAML(), { minLength: 1, maxLength: 10 }),
        (contracts) => {
          const validator = new CoverageValidator();
          const report = validator.validate(contracts);
          expect(report.coveragePercentage).toBe(100.0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 7: detecção de lacunas — Feature: academic-paper-validation, Property 7: gap detection
  it('Property 7: rules/facts without traceability appear as gaps', () => {
    fc.assert(
      fc.property(arbitraryContratoYAML(), (contract) => {
        const validator = new CoverageValidator();
        const report = validator.validate([contract]);
        const contractReport = report.contracts[0];

        const allIds = [
          ...contract.rules.map(r => r.id),
          ...contract.facts.map(f => f.id),
        ];
        const tracedIds = Object.keys(contract.traceability ?? {});
        const expectedGaps = allIds.filter(id => !tracedIds.includes(id));

        expect(contractReport.gaps).toEqual(expect.arrayContaining(expectedGaps));
        expect(contractReport.gaps.length).toBe(expectedGaps.length);
      }),
      { numRuns: 100 }
    );
  });
});
```

```typescript
// tests/academic/arbitraries.ts — geradores fast-check
import * as fc from 'fast-check';
import type { ContratoYAML } from '../../src/models/academic.js';

const paperIds = ['IEEE-SP-2024', 'CCS-2023', 'ESEC-FSE-2024', 'ICWE-2024', 'ASE-2023-Config', 'ASE-2023-Ghost', 'ICSE-2024'];
const detectorNames = ['SlopsquatDetector', 'PostInstallDetector', 'PolyfillInjector', 'WebGLDetector', 'ConfigUpdater', 'DependencyValidator'];
const statuses = ['implemented', 'pending', 'not_applicable'] as const;

export function arbitraryContratoYAML(): fc.Arbitrary<ContratoYAML> {
  return fc.record({
    source: fc.record({
      title: fc.string({ minLength: 1 }),
      authors: fc.string({ minLength: 1 }),
      year: fc.integer({ min: 2000, max: 2030 }),
    }),
    facts: fc.array(
      fc.record({ id: fc.string({ minLength: 1 }), statement: fc.string(), type: fc.string(), relevance: fc.string() }),
      { minLength: 1, maxLength: 5 }
    ),
    rules: fc.array(
      fc.record({
        id: fc.string({ minLength: 1 }),
        principle: fc.string(),
        derived_from: fc.array(fc.string()),
        action: fc.string(),
        detector_name: fc.option(fc.constantFrom(...detectorNames), { nil: undefined }),
        paperRef: fc.option(fc.constantFrom(...paperIds), { nil: undefined }),
        priority: fc.constantFrom('high', 'medium', 'low'),
      }),
      { minLength: 1, maxLength: 5 }
    ),
    traceability: fc.option(
      fc.dictionary(fc.string({ minLength: 1 }), fc.record({
        implementation: fc.string(),
        tests: fc.string(),
        status: fc.constantFrom(...statuses),
      })),
      { nil: undefined }
    ),
  });
}

export function arbitraryFullyImplementedContratoYAML(): fc.Arbitrary<ContratoYAML> {
  return arbitraryContratoYAML().map(contract => {
    const traceability: ContratoYAML['traceability'] = {};
    for (const rule of contract.rules) {
      traceability![rule.id] = { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' };
    }
    for (const fact of contract.facts) {
      traceability![fact.id] = { implementation: 'src/x.ts', tests: 'tests/x.ts', status: 'implemented' };
    }
    return { ...contract, traceability };
  });
}
```

### Cobertura esperada

| Componente | Unit tests | Property tests |
|---|---|---|
| `KnowledgeBase.loadContractsSync` | mapeamentos concretos, YAML inválido, registry vazio | P1, P2, P5 |
| `CoverageValidator.validate` | contrato sem traceability, contrato vazio | P3, P4, P7 |
| `IssueEnricher.enrichIssue` | issue com ref, issue sem ref | — |
| Formatação CLI `--academic` | linha com todos os campos | P6 |
