# Requirements Document

## Introduction

O `BrowserEnvironment` possui uma implementação funcional de testes via Playwright no método `testUrl(url)`, mas o método `test(projectPath)` — chamado pela interface `Environment` — retorna um placeholder sem executar nenhum teste real. Este bugfix conecta os dois métodos, adiciona suporte a Firefox, expõe erros de browser como `HealthCheck` entries estruturadas, e integra o `BrowserEnvironment` no fluxo `'both'` do `ValidationEngine`.

## Glossary

- **BrowserEnvironment**: Classe que implementa a interface `Environment` usando Playwright para testar uma aplicação web em browser real.
- **ValidationEngine**: Orquestrador principal que coordena todos os validadores e ambientes de runtime.
- **LocalEnvironment**: Ambiente que sobe o servidor local via `npm run dev` e retorna a URL detectada.
- **EnvironmentResult**: Tipo de retorno da interface `Environment`, contendo `healthChecks`, `apiTests`, `logs` e `passed`.
- **HealthCheck**: Entrada estruturada com `name`, `passed`, `message` e `latencyMs` usada para reportar resultados de verificações individuais.
- **Playwright**: Biblioteca de automação de browser usada pelo `BrowserEnvironment`.
- **testUrl**: Método público do `BrowserEnvironment` que recebe uma URL e executa os testes de browser.
- **ServerStartup**: Processo de inicialização do servidor de desenvolvimento local via `npm run dev`.

## Requirements

### Requirement 1: Conectar `test(projectPath)` ao `testUrl()`

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que o `BrowserEnvironment.test(projectPath)` execute testes reais de browser, para que a validação em ambiente browser funcione de ponta a ponta.

#### Acceptance Criteria

1. WHEN `BrowserEnvironment.test(projectPath)` é chamado, THE `BrowserEnvironment` SHALL iniciar o servidor de desenvolvimento do projeto via `npm run dev` no `projectPath`.
2. WHEN o servidor de desenvolvimento iniciar com sucesso e uma URL for detectada, THE `BrowserEnvironment` SHALL chamar `testUrl(url)` com a URL detectada e retornar o resultado.
3. WHEN o servidor de desenvolvimento não iniciar dentro do timeout configurado, THE `BrowserEnvironment` SHALL retornar um `EnvironmentResult` com `passed: false` e `error` descrevendo a falha de startup.
4. WHEN `BrowserEnvironment.test(projectPath)` concluir (com sucesso ou falha), THE `BrowserEnvironment` SHALL encerrar o processo do servidor de desenvolvimento iniciado.
5. THE `BrowserEnvironment` SHALL expor o método `testUrl(url)` como método público para chamadas diretas sem startup de servidor.

### Requirement 2: Suporte a múltiplos browsers

**User Story:** Como desenvolvedor, quero poder escolher entre Chromium e Firefox para os testes de browser, para que eu possa validar compatibilidade cross-browser.

#### Acceptance Criteria

1. THE `BrowserEnvironment` SHALL aceitar uma opção `browser` do tipo `'chromium' | 'firefox'` no construtor.
2. WHEN a opção `browser` não for fornecida, THE `BrowserEnvironment` SHALL usar `'chromium'` como valor padrão.
3. WHEN `browser: 'firefox'` for configurado, THE `BrowserEnvironment` SHALL lançar o Firefox via Playwright em vez do Chromium.
4. WHEN `browser: 'chromium'` for configurado, THE `BrowserEnvironment` SHALL lançar o Chromium via Playwright.
5. IF Playwright não estiver instalado, THEN THE `BrowserEnvironment` SHALL retornar um `EnvironmentResult` com `passed: true` e um `HealthCheck` de skip, independente do browser configurado.

### Requirement 3: Expor erros de browser como HealthChecks estruturados

**User Story:** Como desenvolvedor, quero que erros de JavaScript e erros de console capturados pelo browser apareçam como `HealthCheck` entries com `passed: false`, para que o `ValidationEngine` possa tratá-los como issues estruturadas.

#### Acceptance Criteria

1. WHEN erros de JavaScript forem capturados durante a navegação, THE `BrowserEnvironment` SHALL incluir um `HealthCheck` com `name: 'browser:no-js-errors'` e `passed: false` no `EnvironmentResult`.
2. WHEN erros de console forem capturados durante a navegação, THE `BrowserEnvironment` SHALL incluir um `HealthCheck` com `name: 'browser:console-clean'` e `passed: false` no `EnvironmentResult`.
3. WHEN nenhum erro de JavaScript for capturado, THE `BrowserEnvironment` SHALL incluir um `HealthCheck` com `name: 'browser:no-js-errors'` e `passed: true`.
4. WHEN nenhum erro de console for capturado, THE `BrowserEnvironment` SHALL incluir um `HealthCheck` com `name: 'browser:console-clean'` e `passed: true`.
5. THE `BrowserEnvironment` SHALL manter os erros capturados também no array `logs[]` do `EnvironmentResult` com os prefixos `[browser:js-error]` e `[browser:console-error]`.

### Requirement 4: Integrar BrowserEnvironment no ValidationEngine com `environment: 'both'`

**User Story:** Como desenvolvedor usando `environment: 'both'`, quero que o `ValidationEngine` execute o `BrowserEnvironment` após o `LocalEnvironment`, para que a validação inclua testes reais de browser sem precisar subir o servidor duas vezes.

#### Acceptance Criteria

1. WHEN `ValidationOptions.environment` for `'both'`, THE `ValidationEngine` SHALL executar o `LocalEnvironment` e, em seguida, o `BrowserEnvironment` usando a URL detectada pelo `LocalEnvironment`.
2. WHEN o `BrowserEnvironment` retornar `HealthCheck` entries com `passed: false`, THE `ValidationEngine` SHALL converter cada uma em um `Issue` com `severity: 'error'` e `detector: 'BrowserEnvironment'`.
3. WHEN `ValidationOptions.environment` for `'local'` ou `'docker'`, THE `ValidationEngine` SHALL executar apenas o ambiente correspondente, sem alteração no comportamento atual.
4. WHEN `ValidationOptions.environment` for `'both'` e o `LocalEnvironment` falhar em iniciar o servidor, THE `ValidationEngine` SHALL registrar o erro do `LocalEnvironment` como issue e não executar o `BrowserEnvironment`.
5. THE `ValidationEngine` SHALL chamar `cleanup()` no `BrowserEnvironment` após a execução, independente do resultado.

### Requirement 5: Compatibilidade retroativa

**User Story:** Como desenvolvedor que já usa o EscapeKit MCP, quero que as mudanças não quebrem o comportamento existente de `LocalEnvironment` e `DockerEnvironment`, para que meus fluxos atuais continuem funcionando.

#### Acceptance Criteria

1. THE `Environment` interface SHALL permanecer inalterada com os métodos `test(projectPath)`, `cleanup()` e a propriedade `name`.
2. WHEN `ValidationOptions.environment` for `'local'`, THE `ValidationEngine` SHALL executar apenas o `LocalEnvironment`, sem mudança de comportamento.
3. WHEN `ValidationOptions.environment` for `'docker'`, THE `ValidationEngine` SHALL executar apenas o `DockerEnvironment`, sem mudança de comportamento.
4. THE `testUrl(url)` SHALL continuar funcionando como método público do `BrowserEnvironment` para chamadas diretas.
5. WHEN Playwright não estiver instalado no ambiente, THE `BrowserEnvironment` SHALL retornar skip gracioso com `passed: true` em vez de lançar exceção.
