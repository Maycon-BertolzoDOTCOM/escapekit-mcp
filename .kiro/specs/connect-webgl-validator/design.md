# Design Document

## Overview

Mudança cirúrgica no `ValidationEngine` para conectar o `WebGLValidator` já implementado ao fluxo de validação. São três alterações: (1) adicionar `'WEBGL_ERROR'` ao `IssueType` em `types.ts`; (2) instanciar `WebGLValidator` no construtor do `ValidationEngine`; (3) invocar `webglValidator.validate(url)` no bloco `'thorough'` após o runtime, populando `result.checks.webgl` e gerando `Issue` se `passed === false`. Nenhuma interface pública é alterada.

---

## Architecture

### Componentes afetados

```
src/validate/
├── types.ts                          ← adicionar 'WEBGL_ERROR' ao IssueType
├── ValidationEngine.ts               ← instanciar WebGLValidator, invocar no thorough
└── validators/
    └── WebGLValidator.ts             ← sem alterações (já implementado)
```

### Fluxo do método `validate()` após a mudança

```
ValidationEngine.validate(projectPath, options)
  │
  ├─ 1. BuildValidator.validate()          (todos os níveis)
  ├─ 2. DependencyValidator.validate()     (todos os níveis)
  ├─ 3. environment.test(projectPath)      (standard + thorough)
  │       └─ retorna EnvironmentResult com detectedUrl?
  ├─ 4. webglValidator.validate(url)       (thorough + detectedUrl definido)  ← NOVO
  │       └─ retorna WebGLCheckResult
  │       └─ se passed === false → push Issue { type: 'WEBGL_ERROR', ... }
  ├─ 5. autoFix loop                       (se opts.autoFix)
  └─ 6. montar ValidationResult
          └─ checks.webgl = webglResult    ← NOVO
```

---

## Detailed Design

### 1. Adição de `'WEBGL_ERROR'` ao `IssueType`

```typescript
// src/validate/types.ts
export type IssueType =
  | 'BUILD_ERROR'
  | 'GHOST_IMPORT'
  | 'SECURITY_VULNERABILITY'
  | 'SECURITY_WARNING'
  | 'WEBGL_UNSUPPORTED'
  | 'WEBGL_ERROR'          // ← novo
  | 'MISSING_POLYFILL'
  | 'OUTDATED_CONFIG'
  | 'MISSING_DEPENDENCY';
```

### 2. Instanciar `WebGLValidator` no construtor

```typescript
// src/validate/ValidationEngine.ts
import { WebGLValidator } from './validators/WebGLValidator.js';

export class ValidationEngine {
  private readonly webglValidator: WebGLValidator;  // ← novo campo

  constructor() {
    this.buildValidator = new BuildValidator();
    this.dependencyValidator = new DependencyValidator();
    this.autoFixEngine = new AutoFixEngine();
    this.webglValidator = new WebGLValidator();      // ← nova linha
  }
}
```

### 3. Invocar `WebGLValidator` no bloco `'thorough'`

O bloco de runtime atual executa para `'standard'` e `'thorough'`. A chamada ao `WebGLValidator` é adicionada dentro do mesmo bloco, mas condicionada a `opts.level === 'thorough'` e à presença de `detectedUrl`.

```typescript
// Dentro do bloco if (opts.level === 'standard' || opts.level === 'thorough')
let webglResult: WebGLCheckResult | undefined;

if (opts.level === 'standard' || opts.level === 'thorough') {
  const environment = this.createEnvironment(opts.environment);
  try {
    const envResult = await environment.test(projectPath);
    if (!envResult.passed) {
      issues.push({
        type: 'BUILD_ERROR',
        detector: 'BuildValidator',
        severity: 'error',
        message: `Runtime test failed: ${envResult.error || 'server did not start'}`,
      });
    }

    // WebGL: apenas no nível thorough, com URL disponível
    if (opts.level === 'thorough') {
      const url = envResult.detectedUrl ?? this.extractUrlFromLogs(envResult.logs);
      if (url) {
        webglResult = await this.webglValidator.validate(url);
        if (!webglResult.passed) {
          issues.push({
            type: 'WEBGL_ERROR',
            detector: 'WebGLValidator',
            severity: 'error',
            message: webglResult.jsErrors.length > 0
              ? `WebGL validation failed: ${webglResult.jsErrors[0]}`
              : 'WebGL validation failed',
          });
        }
      }
    }
  } finally {
    await environment.cleanup();
  }
}
```

### 4. Método auxiliar `extractUrlFromLogs`

Fallback para quando `detectedUrl` não estiver disponível no `EnvironmentResult` (spec `fix-browser-environment-runtime` ainda não aplicado):

```typescript
private extractUrlFromLogs(logs: string[]): string | null {
  const urlRegex = /http:\/\/(?:localhost|127\.0\.0\.1):\d+/;
  for (const log of logs) {
    const match = log.match(urlRegex);
    if (match) return match[0];
  }
  return null;
}
```

### 5. Popular `result.checks.webgl`

```typescript
const result: ValidationResult = {
  // ...campos existentes...
  checks: {
    build: buildResult,
    runtime: { ... },
    dependencies: dependencyResult,
    webgl: webglResult,   // ← novo: undefined quando não executado
  },
  // ...
};
```

---

## Data Models

### `IssueType` — adição de `'WEBGL_ERROR'`

| Valor | Quando usado |
|---|---|
| `'WEBGL_ERROR'` | `WebGLCheckResult.passed === false` após execução do `WebGLValidator` |

### Campos adicionados ao `ValidationEngine`

| Campo | Tipo | Descrição |
|---|---|---|
| `webglValidator` | `WebGLValidator` | Instância privada criada no construtor |

### Variável local no método `validate()`

| Variável | Tipo | Descrição |
|---|---|---|
| `webglResult` | `WebGLCheckResult \| undefined` | Resultado do WebGLValidator; `undefined` se não executado |

---

## Correctness Properties

### P1 — thorough + three.js → checks.webgl definido

Para qualquer projeto com `three` em `dependencies` e nível `'thorough'`, se `detectedUrl` estiver disponível, `result.checks.webgl` DEVE ser definido (não `undefined`).

Formalmente: `opts.level === 'thorough' ∧ detectedUrl !== undefined → result.checks.webgl !== undefined`

### P2 — WebGL failed → canDeploy false

Se `WebGLCheckResult.passed === false`, então `result.canDeploy` DEVE ser `false`.

Formalmente: `webglResult.passed === false → result.canDeploy === false`

Mecanismo: `canDeploy = issues.filter(i => i.severity === 'error').length === 0`. Como o `Issue` gerado tem `severity: 'error'`, a propriedade é satisfeita pelo mecanismo existente.

### P3 — basic/standard → checks.webgl undefined

Para nível `'basic'` ou `'standard'`, `result.checks.webgl` DEVE ser `undefined`.

Formalmente: `opts.level !== 'thorough' → result.checks.webgl === undefined`

### P4 — Playwright ausente → passed true, sem Issue de erro

Quando Playwright não estiver instalado, `WebGLValidator.validate()` retorna `{ passed: true, ... }`. Portanto `result.checks.webgl.passed === true` e nenhum `Issue` com `severity: 'error'` é gerado.

Formalmente: `!playwright_installed → result.checks.webgl.passed === true ∧ ¬∃ issue: issue.type === 'WEBGL_ERROR'`

### P5 — thorough sem URL → checks.webgl undefined

Quando `detectedUrl` for `undefined` e os logs não contiverem URL, `result.checks.webgl` DEVE ser `undefined`.

Formalmente: `detectedUrl === undefined ∧ extractUrlFromLogs(logs) === null → result.checks.webgl === undefined`

---

## Error Handling

| Cenário | Comportamento |
|---|---|
| Playwright não instalado | `WebGLValidator` retorna `passed: true` com skip — sem Issue, `checks.webgl` populado |
| `detectedUrl` ausente e logs sem URL | `WebGLValidator` não é chamado — `checks.webgl === undefined` |
| `WebGLValidator.validate()` lança exceção | Capturar com try/catch, emitir log `warn`, `checks.webgl` permanece `undefined` |
| `WebGLCheckResult.passed === false` | Issue `WEBGL_ERROR` adicionado, `canDeploy === false` |
| Nível `'basic'` ou `'standard'` | `WebGLValidator` não é instanciado nem chamado no fluxo |

### Tratamento de exceção no bloco WebGL

Para garantir que uma falha inesperada do `WebGLValidator` não interrompa a validação:

```typescript
try {
  webglResult = await this.webglValidator.validate(url);
  if (!webglResult.passed) {
    issues.push({ type: 'WEBGL_ERROR', ... });
  }
} catch (err) {
  this.log.warn('WebGL validation threw unexpectedly', { error: err });
  // webglResult permanece undefined — não bloqueia o resultado
}
```

---

## Implementation Notes

- O `WebGLValidator` já implementa graceful skip internamente para Playwright ausente. O `ValidationEngine` não precisa verificar a disponibilidade do Playwright.
- O campo `detectedUrl` em `EnvironmentResult` é definido pelo spec `fix-browser-environment-runtime`. O método `extractUrlFromLogs` é o fallback para ambientes onde esse spec ainda não foi aplicado — a mesma regex já usada no design daquele spec.
- A variável `webglResult` é declarada fora do bloco `try/finally` do ambiente para que possa ser usada na construção do `ValidationResult` após o bloco.
- O `CLIReporter` já possui o bloco `if (result.checks.webgl)` implementado — nenhuma alteração necessária no reporter.
- O `AutoFixEngine` não precisa de alteração para `'WEBGL_ERROR'`: o tipo é adicionado ao `IssueType` mas não precisa ter um fixer registrado para que a validação funcione.

### Estrutura de arquivos

| Arquivo | Status | Descrição |
|---|---|---|
| `src/validate/types.ts` | Modificado | Adiciona `'WEBGL_ERROR'` ao `IssueType` |
| `src/validate/ValidationEngine.ts` | Modificado | Instancia `WebGLValidator`, invoca no nível `'thorough'`, popula `checks.webgl` |
| `src/validate/validators/WebGLValidator.ts` | Sem alteração | Já implementado |
| `tests/validate/ValidationEngine.webgl.test.ts` | Novo | Testes unitários para a integração |
