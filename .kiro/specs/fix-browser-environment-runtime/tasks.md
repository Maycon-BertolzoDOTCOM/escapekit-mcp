# Implementation Plan

## Tasks

- [ ] 1. Adicionar `browser` option ao `BrowserEnvironmentOptions` e ao construtor
  - Adicionar campo `browser?: 'chromium' | 'firefox'` à interface `BrowserEnvironmentOptions` em `BrowserEnvironment.ts`
  - Inicializar `this.options.browser = options.browser ?? 'chromium'` no construtor
  - Atualizar `testUrl()` para selecionar o launcher dinamicamente: `const launcher = this.options.browser === 'firefox' ? firefox : chromium`
  - Arquivo: `src/validate/environments/BrowserEnvironment.ts`

- [ ] 2. Adicionar campo `detectedUrl` ao `EnvironmentResult`
  - Adicionar `detectedUrl?: string` à interface `EnvironmentResult` em `types.ts`
  - Arquivo: `src/validate/types.ts`

- [ ] 3. Expor `detectedUrl` no `LocalEnvironment`
  - Após `startDevServer()` retornar a URL, popular `result.detectedUrl = serverUrl` antes de retornar o `EnvironmentResult`
  - Arquivo: `src/validate/environments/LocalEnvironment.ts`

- [ ] 4. Implementar `startDevServer` e `cleanupProcess` no `BrowserEnvironment`
  - Adicionar campo privado `serverProcess: ChildProcess | null = null`
  - Implementar método privado `startDevServer(projectPath, logs): Promise<string | null>` com a mesma lógica do `LocalEnvironment` (spawn `npm run dev`, regex de URL, ready patterns, timeout)
  - Implementar método privado `cleanupProcess(): Promise<void>` que encerra `this.serverProcess`
  - Atualizar `cleanup()` para chamar `cleanupProcess()`
  - Arquivo: `src/validate/environments/BrowserEnvironment.ts`

- [ ] 5. Implementar `BrowserEnvironment.test(projectPath)` conectado ao `testUrl()`
  - Substituir o placeholder atual pelo fluxo real: `startDevServer` → `testUrl(url)` → `cleanupProcess`
  - Retornar erro estruturado se o servidor não subir
  - Mesclar logs do startup com logs do `testUrl()`
  - Arquivo: `src/validate/environments/BrowserEnvironment.ts`

- [ ] 6. Refatorar `ValidationEngine` para suportar `environment: 'both'`
  - Adicionar import de `BrowserEnvironment` em `ValidationEngine.ts`
  - Extrair método privado `collectEnvIssues(result, detector, issues)` que converte `HealthCheck` com `passed: false` em `Issue[]`
  - Substituir o bloco de runtime no `validate()` por chamada ao novo método `runEnvironments(projectPath, opts.environment, issues)`
  - Implementar `runEnvironments()` com os três casos: `'local'`, `'docker'`, `'both'`
  - No caso `'both'`: executar `LocalEnvironment.test()`, usar `localResult.detectedUrl` para chamar `BrowserEnvironment.testUrl()`, garantir cleanup de ambos
  - Arquivo: `src/validate/ValidationEngine.ts`

- [ ] 7. Escrever testes unitários para `BrowserEnvironment`
  - Testar que `test(projectPath)` chama `testUrl()` com a URL detectada pelo servidor (mock do spawn)
  - Testar que `test(projectPath)` retorna `passed: false` quando o servidor não sobe
  - Testar que `cleanup()` encerra o processo do servidor
  - Testar que `browser: 'firefox'` seleciona o launcher correto (mock do Playwright)
  - Testar skip gracioso quando Playwright não está instalado
  - Testar P1: `jsErrors.length > 0` → HealthCheck `browser:no-js-errors` com `passed: false`
  - Testar P2: `consoleErrors.length > 0` → HealthCheck `browser:console-clean` com `passed: false`
  - Testar P3: erros capturados aparecem em `logs[]` com prefixos corretos
  - Arquivo: `tests/validate/BrowserEnvironment.test.ts`

- [ ] 8. Escrever testes unitários para `ValidationEngine` com `environment: 'both'`
  - Testar que `BrowserEnvironment.testUrl()` é chamado com a URL do `LocalEnvironment` quando `environment: 'both'`
  - Testar P4: HealthChecks com `passed: false` do BrowserEnvironment viram Issues com `detector: 'BrowserEnvironment'`
  - Testar que BrowserEnvironment não é executado quando LocalEnvironment falha
  - Testar que `environment: 'local'` e `environment: 'docker'` não instanciam BrowserEnvironment
  - Arquivo: `tests/validate/ValidationEngine.browser.test.ts`
