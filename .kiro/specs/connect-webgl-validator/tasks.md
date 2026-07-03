# Implementation Plan

## Tasks

- [x] 1. Adicionar `'WEBGL_ERROR'` ao `IssueType` em `types.ts`
  - Verificar se `'WEBGL_ERROR'` já existe na union type `IssueType`
  - Se não existir, adicionar `'WEBGL_ERROR'` à union type `IssueType` em `src/validate/types.ts`
  - Arquivo: `src/validate/types.ts`

- [x] 2. Importar e instanciar `WebGLValidator` no `ValidationEngine`
  - Adicionar import: `import { WebGLValidator } from './validators/WebGLValidator.js'`
  - Adicionar campo privado `private readonly webglValidator: WebGLValidator` à classe
  - Adicionar `this.webglValidator = new WebGLValidator()` no construtor, após as instanciações existentes
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 3. Adicionar método auxiliar `extractUrlFromLogs`
  - Implementar `private extractUrlFromLogs(logs: string[]): string | null`
  - Iterar sobre `logs` e aplicar a regex `/http:\/\/(?:localhost|127\.0\.0\.1):\d+/`
  - Retornar o primeiro match encontrado ou `null`
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 4. Invocar `WebGLValidator` no bloco de runtime do nível `'thorough'`
  - Declarar `let webglResult: WebGLCheckResult | undefined` antes do bloco de runtime
  - Dentro do bloco `if (opts.level === 'standard' || opts.level === 'thorough')`, após o `environment.test()`, adicionar bloco condicional `if (opts.level === 'thorough')`
  - Dentro do bloco `'thorough'`: extrair URL via `envResult.detectedUrl ?? this.extractUrlFromLogs(envResult.logs)`
  - Se URL disponível: chamar `await this.webglValidator.validate(url)` dentro de try/catch
  - Se `webglResult.passed === false`: adicionar `Issue` com `type: 'WEBGL_ERROR'`, `severity: 'error'`, `detector: 'WebGLValidator'`, `message` contendo `jsErrors[0]` se disponível
  - Capturar exceções inesperadas do `WebGLValidator` com log `warn` sem propagar
  - Adicionar import de `WebGLCheckResult` ao bloco de imports de tipos
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 5. Popular `result.checks.webgl` na construção do `ValidationResult`
  - No objeto `result.checks`, adicionar `webgl: webglResult` (será `undefined` quando não executado)
  - Garantir que a variável `webglResult` está no escopo correto (declarada antes do bloco de runtime)
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 6. Escrever testes unitários em `ValidationEngine.webgl.test.ts`
  - Criar `tests/validate/ValidationEngine.webgl.test.ts`
  - Mockar `WebGLValidator` para controlar o retorno de `validate()`
  - Mockar `BuildValidator`, `DependencyValidator` e `LocalEnvironment` para isolar o comportamento WebGL
  - **P1 — thorough + detectedUrl → checks.webgl definido:**
    - Nível `'thorough'` + `envResult.detectedUrl = 'http://localhost:3000'` → `result.checks.webgl !== undefined`
  - **P2 — WebGL failed → canDeploy false:**
    - `webglValidator.validate()` retorna `{ passed: false, jsErrors: ['WebGL not supported'] }` → `result.canDeploy === false`
    - `result.remainingIssues` contém Issue com `type: 'WEBGL_ERROR'` e `detector: 'WebGLValidator'`
    - `issue.message` contém `'WebGL not supported'`
  - **P3 — basic/standard → checks.webgl undefined:**
    - Nível `'basic'` → `result.checks.webgl === undefined`, `WebGLValidator.validate` não chamado
    - Nível `'standard'` → `result.checks.webgl === undefined`, `WebGLValidator.validate` não chamado
  - **P4 — Playwright ausente → passed true, sem Issue de erro:**
    - `webglValidator.validate()` retorna `{ passed: true, jsErrors: ['Playwright not installed - WebGL check skipped'] }` → sem Issue `WEBGL_ERROR`, `result.canDeploy` não afetado
    - `result.checks.webgl.passed === true`
  - **P5 — thorough sem URL → checks.webgl undefined:**
    - `envResult.detectedUrl = undefined` e `envResult.logs = []` → `result.checks.webgl === undefined`
    - `WebGLValidator.validate` não chamado
  - **Fallback de URL via logs:**
    - `envResult.detectedUrl = undefined` e `envResult.logs = ['[local] http://localhost:5173 ready']` → `WebGLValidator.validate` chamado com `'http://localhost:5173'`
  - **Exceção inesperada do WebGLValidator:**
    - `webglValidator.validate()` lança `Error('timeout')` → `result.checks.webgl === undefined`, sem propagação, `canDeploy` não afetado pelo WebGL
  - **WebGL passed → sem Issue:**
    - `webglValidator.validate()` retorna `{ passed: true }` → nenhum Issue com `type: 'WEBGL_ERROR'`
  - Arquivo: `tests/validate/ValidationEngine.webgl.test.ts`

- [x] 7. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `src/validate/ValidationEngine.ts` e `src/validate/types.ts`
  - Garantir que o import de `WebGLCheckResult` está correto e sem conflitos
  - Verificar que `'WEBGL_ERROR'` não causa erros de tipo em outros consumidores de `IssueType`
  - Verificar que `result.checks.webgl` aceita `WebGLCheckResult | undefined` conforme a interface `ValidationResult`
