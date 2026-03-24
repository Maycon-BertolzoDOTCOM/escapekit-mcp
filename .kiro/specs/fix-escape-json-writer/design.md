# Design Document

## Overview

Reabilitação do `EscapeJsonWriter` em três etapas: (1) renomear o arquivo `.disabled` para `.ts` e corrigir os dois erros de tipo, (2) reconectar as exportações em `src/generators/index.ts`, e (3) integrar o `EscapeJsonWriter` no pipeline `src/tools/generate.ts`, que atualmente só chama `EscapeContractWriter`. A correção é cirúrgica — nenhuma lógica de negócio é alterada, apenas a assinatura de `buildValidations` e o tipo do parâmetro de `inferFixMethod`.

---

## Architecture

### Componentes Envolvidos

```
src/tools/generate.ts (generateEscapeKit)
    ├── EscapeContractWriter   (já integrado)
    └── EscapeJsonWriter       (a integrar)
            ├── generate(params: EscapeJsonParams): EscapeJson
            └── writeToFile(escapeJson, path): Promise<void>

src/generators/index.ts
    └── export { EscapeJsonWriter, EscapeJsonParams }  (a descomentar)

src/generators/EscapeJsonWriter.ts  (renomear de .disabled)
    ├── buildValidations(kiwiTestRunId?, testResults?, timestamp: string)
    │       └── CORREÇÃO: vírgula faltante antes de `timestamp`
    └── inferFixMethod(issue: Issue)
            └── CORREÇÃO: `any` → `Issue` de schemas.ts
```

### Fluxo de Geração do escape.json

```
generateEscapeKit(analysisResult, sourceCode, platform, outputDir, options)
    │
    ├─ [existente] EscapeContractWriter.generate(...)  → escape-contract.json
    │
    └─ [novo] if options.generateEscapeJson !== false && !dryRun
            │
            ├─ new EscapeJsonWriter()
            ├─ writer.generate({
            │     analysisResult,
            │     resolutions,
            │     transformations,
            │     originalCode: sourceCode,
            │     targetPlatform,
            │     toolVersion: '1.0.0',
            │  })
            └─ writer.writeToFile(escapeJson, join(projectPath, 'escape.json'))
                    └─ filesCreated.push('escape.json')
```

---

## Detailed Design

### 1. Correção da Assinatura de `buildValidations`

O erro atual é uma vírgula faltante. O TypeScript interpreta `timestamp: string` como parte da expressão anterior em vez de um novo parâmetro, causando erro de sintaxe.

**Antes (com erro):**
```typescript
private buildValidations(
  kiwiTestRunId?: number,
  testResults?: TestResultsSummary,
  timestamp: string   // ← TypeScript não reconhece como parâmetro separado
): Validations {
```

**Depois (correto):**
```typescript
private buildValidations(
  kiwiTestRunId?: number,
  testResults?: TestResultsSummary,
  timestamp: string
): Validations {
```

Nota: a assinatura já está correta no arquivo `.disabled` — o problema real é que o TypeScript estava reclamando de algo diferente. Ao renomear o arquivo e executar `getDiagnostics`, o erro exato será identificado e corrigido.

### 2. Substituição de `any` em `inferFixMethod`

O método atual usa `issue: any`. O tipo correto é `Issue` de `src/models/schemas.ts`, que já é importado no arquivo via `AnalysisResult`.

**Antes:**
```typescript
private inferFixMethod(issue: any): FixMethod {
  if (issue.type === 'GHOST_IMPORT') return 'REPLACED_WITH_REAL_PACKAGE';
  if (issue.type === 'MOCK_API') return 'REPLACED_WITH_POLYFILL';
  if (issue.type === 'WEBGL_FALLBACK_NEEDED') return 'ADDED_FALLBACK';
  return 'REPLACED_WITH_REAL_PACKAGE';
}
```

**Depois:**
```typescript
private inferFixMethod(issue: Issue): FixMethod {
  if (issue.type === 'ghost_import') return 'REPLACED_WITH_REAL_PACKAGE';
  if (issue.type === 'mock_api') return 'REPLACED_WITH_POLYFILL';
  return 'REPLACED_WITH_REAL_PACKAGE';
}
```

Observação importante: os valores de `IssueType` em `src/models/schemas.ts` são em `snake_case` (`'ghost_import'`, `'mock_api'`), enquanto o arquivo `.disabled` compara com `'GHOST_IMPORT'` (UPPER_CASE). Os comparadores devem ser ajustados para os valores corretos do enum. O tipo `'WEBGL_FALLBACK_NEEDED'` não existe em `IssueType` de `schemas.ts`, portanto a comparação é removida.

### 3. Reconexão das Exportações em `index.ts`

```typescript
// src/generators/index.ts — descomentar as duas linhas:
export { EscapeJsonWriter } from './EscapeJsonWriter.js';
export type { EscapeJsonParams } from './EscapeJsonWriter.js';
```

### 4. Integração em `generate.ts`

O `generate.ts` já possui a opção `generateEscapeJson` em `GenerateOptions` mas não a usa. A integração adiciona um bloco após a escrita do `escape-contract.json`:

```typescript
// ── Step 6: Generate escape.json (se habilitado) ──────────────────────────
if (options.generateEscapeJson !== false && !dryRun) {
  try {
    const { EscapeJsonWriter } = await import('../generators/EscapeJsonWriter.js');
    const escapeJsonWriter = new EscapeJsonWriter();
    const escapeJson = escapeJsonWriter.generate({
      analysisResult,
      resolutions,
      transformations,
      originalCode: sourceCode,
      targetPlatform,
      toolVersion: '1.0.0',
    });
    const escapeJsonPath = join(projectPath, 'escape.json');
    await escapeJsonWriter.writeToFile(escapeJson, escapeJsonPath);
    filesCreated.push('escape.json');
    log.info('escape.json generated', { path: escapeJsonPath });
  } catch (err) {
    log.warn('Failed to generate escape.json, continuing', { error: err });
  }
}
```

O import dinâmico evita dependência circular e mantém o padrão já usado no CLI para imports condicionais.

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são suficientes:

- `EscapeJson`, `EscapeJsonParams` — já definidos em `src/models/escape-json-schema.ts` e `EscapeJsonWriter.ts`
- `Issue` — de `src/models/schemas.ts`, usado para tipar `inferFixMethod`
- `AnalysisResult`, `DependencyResolution`, `CodeTransformation` — já importados no `EscapeJsonWriter`

---

## Error Handling

| Situação | Comportamento |
|---|---|
| `writeToFile` falha por permissão ou diretório inexistente | Lança `FileSystemError` com mensagem descritiva |
| `EscapeJsonWriter.generate` lança exceção no pipeline | `generate.ts` captura, loga `warn` e continua sem o `escape.json` |
| Arquivo `.disabled` não encontrado ao renomear | Erro de build — tarefa 1 deve ser executada primeiro |
| `getDiagnostics` reporta erros após renomear | Corrigir antes de prosseguir para as demais tarefas |

---

## Testing Strategy

### Testes Unitários

Arquivo: `tests/generators/EscapeJsonWriter.test.ts`

**Testes de correção de tipo:**
1. Instanciar `EscapeJsonWriter` sem erros de runtime.
2. Chamar `generate(params)` com `EscapeJsonParams` mínimo válido — não deve lançar exceção.

**Testes de consistência interna:**
3. `generate(params).escapeId === params.analysisResult.analysisId`
4. `generate(params).analysis.totalIssues === params.analysisResult.issues.length`
5. `generate(params).transformations.totalTransformations === generate(params).transformations.applied.length`

**Testes de `buildValidations`:**
6. Com `testResults.failed > 0` → `overallStatus: 'partial'`
7. Com `testResults.failed === 0` → `overallStatus: 'passed'`
8. Sem `testResults` → `overallStatus: 'pending'`, contadores zerados

**Testes de `inferFixMethod`:**
9. `issue.type === 'ghost_import'` → `'REPLACED_WITH_REAL_PACKAGE'`
10. `issue.type === 'mock_api'` → `'REPLACED_WITH_POLYFILL'`
11. Tipo não mapeado → `'REPLACED_WITH_REAL_PACKAGE'`

**Testes de `writeToFile`:**
12. Escreve arquivo JSON válido parseável (round-trip)
13. Lança `FileSystemError` para caminho inválido

### Correctness Properties (PBT)

As propriedades abaixo devem ser verificadas com `fast-check` no arquivo de testes:

**P1 — Invariante de não-exceção:**
Para qualquer `EscapeJsonParams` válido gerado arbitrariamente, `new EscapeJsonWriter().generate(params)` não lança exceção.

```typescript
fc.assert(fc.property(arbitraryEscapeJsonParams(), (params) => {
  expect(() => new EscapeJsonWriter().generate(params)).not.toThrow();
}));
```

**P2 — Invariante de identidade do escapeId:**
```typescript
fc.assert(fc.property(arbitraryEscapeJsonParams(), (params) => {
  const result = new EscapeJsonWriter().generate(params);
  expect(result.escapeId).toBe(params.analysisResult.analysisId);
}));
```

**P3 — Invariante de contagem de issues:**
```typescript
fc.assert(fc.property(arbitraryEscapeJsonParams(), (params) => {
  const result = new EscapeJsonWriter().generate(params);
  expect(result.analysis.totalIssues).toBe(params.analysisResult.issues.length);
}));
```

**P4 — Invariante de consistência de transformações:**
```typescript
fc.assert(fc.property(arbitraryEscapeJsonParams(), (params) => {
  const result = new EscapeJsonWriter().generate(params);
  expect(result.transformations.totalTransformations).toBe(result.transformations.applied.length);
}));
```

**P5 — Round-trip de serialização JSON:**
```typescript
fc.assert(fc.property(arbitraryEscapeJsonParams(), async (params) => {
  const writer = new EscapeJsonWriter();
  const escapeJson = writer.generate(params);
  const tmpPath = join(tmpdir(), `escape-test-${Date.now()}.json`);
  await writer.writeToFile(escapeJson, tmpPath);
  const content = await readFile(tmpPath, 'utf-8');
  const parsed = JSON.parse(content);
  expect(parsed.escapeId).toBe(escapeJson.escapeId);
  expect(parsed.version).toBe(escapeJson.version);
}));
```

### Arbitrários para PBT

```typescript
function arbitraryIssue() {
  return fc.record({
    id: fc.string({ minLength: 1 }),
    type: fc.constantFrom('ghost_import', 'mock_api', 'unrealistic_assumption', 'security_risk'),
    severity: fc.constantFrom('error', 'warning', 'info'),
    location: fc.record({ line: fc.nat(), column: fc.option(fc.nat()) }),
    message: fc.string({ minLength: 1 }),
    description: fc.string(),
    autoFixable: fc.boolean(),
    fixed: fc.boolean(),
  });
}

function arbitraryEscapeJsonParams() {
  return fc.record({
    analysisResult: fc.record({
      analysisId: fc.string({ minLength: 1 }),
      timestamp: fc.string(),
      language: fc.constant('javascript'),
      issues: fc.array(arbitraryIssue()),
      confidenceScore: fc.float({ min: 0, max: 1 }),
      summary: fc.record({
        totalIssues: fc.nat(),
        ghostImports: fc.nat(),
        mockApis: fc.nat(),
        unrealisticAssumptions: fc.nat(),
        securityRisks: fc.nat(),
        infiniteLoops: fc.nat(),
      }),
    }),
    resolutions: fc.constant([]),
    transformations: fc.constant([]),
  });
}
```

---

## Implementation Notes

- O arquivo `.disabled` deve ser renomeado manualmente (ou via tarefa de implementação) — não há API de rename no TypeScript compiler.
- O `generate.ts` usa import dinâmico para `EscapeJsonWriter` para evitar que um eventual erro de import quebre o pipeline inteiro.
- Os valores de `IssueType` em `schemas.ts` são `snake_case`; os valores em `escape-json-schema.ts` são `UPPER_CASE`. O `EscapeJsonWriter` faz a conversão via `mapIssueType` — essa função deve ser verificada para garantir que os valores de entrada (`issue.type` de `schemas.ts`) sejam mapeados corretamente.
- O `ProjectGenerator` já recebe `generateEscapeJson` como opção mas não usa `EscapeJsonWriter` diretamente — a geração do `escape.json` é responsabilidade do `generate.ts`.
