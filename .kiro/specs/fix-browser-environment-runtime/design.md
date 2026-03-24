# Design Document

## Overview

Este documento descreve as mudanças técnicas necessárias para conectar o `BrowserEnvironment.test(projectPath)` ao `testUrl()`, adicionar suporte a Firefox, expor erros de browser como `HealthCheck` estruturados, e integrar o `BrowserEnvironment` no fluxo `'both'` do `ValidationEngine`.

Todas as mudanças são cirúrgicas: a interface `Environment` não muda, `testUrl()` continua público, e os fluxos `'local'` e `'docker'` não são afetados.

---

## Architecture

### Componentes afetados

```
src/validate/
├── environments/
│   ├── BrowserEnvironment.ts   ← mudanças principais
│   └── LocalEnvironment.ts     ← expõe detectedUrl (sem mudança de interface)
└── ValidationEngine.ts         ← integra BrowserEnvironment em 'both'
```

### Fluxo `environment: 'both'` após a mudança

```
ValidationEngine.validate()
  └─ createEnvironments('both')
       ├─ LocalEnvironment.test(projectPath)
       │    └─ startDevServer() → detectedUrl
       │    └─ runHealthChecks(detectedUrl)
       │    └─ retorna EnvironmentResult + expõe detectedUrl
       └─ BrowserEnvironment.testUrl(detectedUrl)   ← chamado diretamente
            └─ lança browser (chromium | firefox)
            └─ navega para detectedUrl
            └─ captura jsErrors + consoleErrors
            └─ retorna EnvironmentResult com HealthChecks estruturados
```

### Fluxo `BrowserEnvironment.test(projectPath)` standalone

```
BrowserEnvironment.test(projectPath)
  └─ startDevServer(projectPath)   ← lógica extraída de LocalEnvironment
  └─ testUrl(detectedUrl)
  └─ cleanup do processo
```

---

## Detailed Design

### 1. `BrowserEnvironment` — opção `browser`

Adicionar `browser` ao `BrowserEnvironmentOptions`:

```typescript
export interface BrowserEnvironmentOptions {
  timeoutMs?: number;
  headless?: boolean;
  viewport?: { width: number; height: number };
  browser?: 'chromium' | 'firefox';  // novo, default: 'chromium'
}
```

No construtor, armazenar o valor com default:

```typescript
this.options.browser = options.browser ?? 'chromium';
```

Em `testUrl()`, selecionar o launcher dinamicamente:

```typescript
const { chromium, firefox } = await import('@playwright/test');
const launcher = this.options.browser === 'firefox' ? firefox : chromium;
browser = await launcher.launch({ ... });
```

### 2. `BrowserEnvironment.test(projectPath)` — startup do servidor

Extrair a lógica de `startDevServer` do `LocalEnvironment` como método privado no `BrowserEnvironment`. A implementação é idêntica à do `LocalEnvironment` (spawn `npm run dev`, regex de URL, patterns de ready, timeout).

```typescript
async test(projectPath: string): Promise<EnvironmentResult> {
  const logs: string[] = [];
  const startTime = Date.now();

  const serverUrl = await this.startDevServer(projectPath, logs);

  if (!serverUrl) {
    return {
      name: this.name,
      passed: false,
      startupTimeMs: Date.now() - startTime,
      healthChecks: [],
      apiTests: [],
      logs,
      error: 'Dev server failed to start within timeout',
    };
  }

  const result = await this.testUrl(serverUrl);
  result.logs = [...logs, ...result.logs];
  await this.cleanupProcess();
  return result;
}
```

O processo do servidor é armazenado em `this.serverProcess: ChildProcess | null` e encerrado em `cleanupProcess()` (chamado também em `cleanup()`).

### 3. `BrowserEnvironment.testUrl()` — HealthChecks estruturados

O comportamento atual já cria os `HealthCheck` entries corretos. Nenhuma mudança necessária neste método além da seleção dinâmica do browser (item 1).

Os `HealthCheck` entries já existentes:
- `browser:page-load` — HTTP status da navegação
- `browser:no-js-errors` — `passed: jsErrors.length === 0`
- `browser:console-clean` — `passed: consoleErrors.length === 0`

Erros continuam também em `logs[]` com prefixos `[browser:js-error]` e `[browser:console-error]`.

### 4. `ValidationEngine` — fluxo `'both'`

Substituir `createEnvironment()` por `runEnvironments()` que lida com os três casos:

```typescript
private async runEnvironments(
  projectPath: string,
  envType: ValidationEnvironment,
  issues: Issue[]
): Promise<void> {
  if (envType === 'both') {
    const local = new LocalEnvironment();
    try {
      const localResult = await local.test(projectPath);
      this.collectEnvIssues(localResult, 'LocalEnvironment', issues);

      if (localResult.passed || localResult.healthChecks.some(h => h.name === 'root')) {
        // Detectar URL dos logs do LocalEnvironment
        const detectedUrl = this.extractUrl(localResult.logs);
        if (detectedUrl) {
          const browser = new BrowserEnvironment();
          try {
            const browserResult = await browser.testUrl(detectedUrl);
            this.collectEnvIssues(browserResult, 'BrowserEnvironment', issues);
          } finally {
            await browser.cleanup();
          }
        }
      }
    } finally {
      await local.cleanup();
    }
    return;
  }

  const env = envType === 'docker' ? new DockerEnvironment() : new LocalEnvironment();
  try {
    const result = await env.test(projectPath);
    this.collectEnvIssues(result, env.name, issues);
  } finally {
    await env.cleanup();
  }
}
```

**Extração da URL dos logs do LocalEnvironment:**

O `LocalEnvironment` já loga as linhas do servidor com prefixo `[local]`. A URL pode ser extraída com a mesma regex usada internamente:

```typescript
private extractUrl(logs: string[]): string | null {
  const urlRegex = /http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/;
  for (const log of logs) {
    const match = log.match(urlRegex);
    if (match) return match[0];
  }
  return null;
}
```

**Alternativa mais limpa:** Expor `detectedUrl` no `EnvironmentResult` como campo opcional. Isso evita parsing de logs e é mais robusto.

```typescript
// Em types.ts — adicionar campo opcional
export interface EnvironmentResult {
  // ... campos existentes ...
  detectedUrl?: string;  // URL detectada pelo ambiente (LocalEnvironment)
}
```

O `LocalEnvironment` popula `result.detectedUrl = serverUrl` antes de retornar. O `ValidationEngine` usa `localResult.detectedUrl` diretamente.

Esta é a abordagem preferida por ser mais explícita e não depender de parsing de strings.

**Conversão de HealthChecks em Issues:**

```typescript
private collectEnvIssues(result: EnvironmentResult, detector: string, issues: Issue[]): void {
  if (!result.passed && result.error) {
    issues.push({
      type: 'BUILD_ERROR',
      detector,
      severity: 'error',
      message: `Runtime test failed: ${result.error}`,
    });
  }
  for (const hc of result.healthChecks) {
    if (!hc.passed) {
      issues.push({
        type: 'BUILD_ERROR',
        detector,
        severity: 'error',
        message: `${hc.name}: ${hc.message ?? 'check failed'}`,
      });
    }
  }
}
```

---

## Data Models

### `EnvironmentResult` — adição de `detectedUrl`

```typescript
export interface EnvironmentResult {
  name: string;
  passed: boolean;
  startupTimeMs: number;
  healthChecks: HealthCheck[];
  apiTests: ApiCheck[];
  logs: string[];
  error?: string;
  detectedUrl?: string;  // novo campo opcional
}
```

### `BrowserEnvironmentOptions` — adição de `browser`

```typescript
export interface BrowserEnvironmentOptions {
  timeoutMs?: number;
  headless?: boolean;
  viewport?: { width: number; height: number };
  browser?: 'chromium' | 'firefox';  // novo campo opcional
}
```

---

## Correctness Properties

### P1 — HealthCheck invariant: erros JS → passed: false

Para qualquer execução de `testUrl()` onde `jsErrors.length > 0`, o `EnvironmentResult` retornado DEVE conter um `HealthCheck` com `name === 'browser:no-js-errors'` e `passed === false`.

Formalmente: `jsErrors.length > 0 → ∃ hc ∈ result.healthChecks: hc.name === 'browser:no-js-errors' ∧ hc.passed === false`

### P2 — HealthCheck invariant: erros console → passed: false

Para qualquer execução de `testUrl()` onde `consoleErrors.length > 0`, o `EnvironmentResult` retornado DEVE conter um `HealthCheck` com `name === 'browser:console-clean'` e `passed === false`.

Formalmente: `consoleErrors.length > 0 → ∃ hc ∈ result.healthChecks: hc.name === 'browser:console-clean' ∧ hc.passed === false`

### P3 — Logs contêm todos os erros capturados

Para qualquer erro capturado (JS ou console), o mesmo erro DEVE aparecer em `result.logs[]` com o prefixo correspondente. Nenhum erro capturado pode estar apenas no `HealthCheck` sem estar nos logs.

Formalmente: `∀ err ∈ jsErrors: ∃ log ∈ result.logs: log.startsWith('[browser:js-error]') ∧ log.includes(err)`

### P4 — HealthChecks com passed: false viram Issues no ValidationEngine

Para qualquer `HealthCheck` com `passed: false` retornado pelo `BrowserEnvironment`, DEVE existir um `Issue` correspondente em `ValidationResult.remainingIssues` com `detector === 'BrowserEnvironment'`.

Formalmente: `∀ hc ∈ browserResult.healthChecks: ¬hc.passed → ∃ issue ∈ result.remainingIssues: issue.detector === 'BrowserEnvironment'`

### P5 — Idempotência do skip sem Playwright

Chamar `testUrl()` N vezes em um ambiente sem Playwright DEVE sempre retornar `passed: true` com o mesmo `HealthCheck` de skip, sem efeitos colaterais.

Formalmente: `¬playwright_installed → testUrl(url) = testUrl(testUrl(url).logs[0])` (resultado estável)

---

## Error Handling

| Cenário | Comportamento |
|---|---|
| Playwright não instalado | Skip gracioso: `passed: true`, HealthCheck `browser-skip` |
| Servidor não sobe no timeout | `passed: false`, `error: 'Dev server failed to start within timeout'` |
| Navegação retorna HTTP 4xx/5xx | `passed: false`, HealthCheck `browser:page-load` com `passed: false` |
| `page.goto()` lança exceção | `passed: false`, `error` com mensagem da exceção |
| LocalEnvironment falha em `'both'` | BrowserEnvironment não é executado; issue do LocalEnvironment registrado |
| Firefox não instalado (Playwright presente) | Playwright lança exceção capturada → `passed: false` com `error` descritivo |

---

## Implementation Notes

- A lógica de `startDevServer` no `BrowserEnvironment` é uma cópia da do `LocalEnvironment`. Não há abstração compartilhada para evitar acoplamento desnecessário entre os dois ambientes. Se no futuro houver um terceiro ambiente com a mesma necessidade, extrair para um `ServerStarter` utilitário.
- O campo `detectedUrl` em `EnvironmentResult` é opcional para manter compatibilidade retroativa. Ambientes que não detectam URL simplesmente não o populam.
- O `ValidationEngine` usa `BrowserEnvironment.testUrl()` diretamente no fluxo `'both'` (não `test()`), pois o servidor já está rodando via `LocalEnvironment`. Isso evita subir o servidor duas vezes.
