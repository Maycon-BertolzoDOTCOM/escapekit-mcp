# Requirements Document

## Introduction

O `WebGLValidator` (`src/validate/validators/WebGLValidator.ts`) está completamente implementado com Playwright e valida suporte a WebGL em projetos 3D em execução. Porém, o `ValidationEngine` nunca o instancia nem o invoca: o campo `checks.webgl` do `ValidationResult` permanece `undefined` em todas as execuções, tornando o validador inoperante.

Esta feature conecta o `WebGLValidator` ao `ValidationEngine`, garantindo que ele seja executado no nível `'thorough'` quando uma URL de runtime estiver disponível, que falhas WebGL gerem `Issue` estruturado, e que a ausência do Playwright resulte em skip gracioso sem interromper a validação.

## Glossary

- **ValidationEngine**: Orquestrador principal em `src/validate/ValidationEngine.ts` que coordena todos os validadores e produz o `ValidationResult`.
- **WebGLValidator**: Validador em `src/validate/validators/WebGLValidator.ts` que usa Playwright para verificar suporte a WebGL em uma URL em execução.
- **WebGLCheckResult**: Tipo em `src/validate/types.ts` com os campos `passed`, `hasCanvas`, `hasWebGL`, `hasWebGL2`, `fallbackApplied`, `jsErrors` e `loadTimeMs`.
- **ValidationResult**: Tipo de retorno do `ValidationEngine.validate()`, contendo `checks.webgl?: WebGLCheckResult`.
- **ValidationLevel**: Enum `'basic' | 'standard' | 'thorough'` que controla a profundidade da validação.
- **EnvironmentResult**: Tipo de retorno da interface `Environment`, que após o spec `fix-browser-environment-runtime` expõe o campo opcional `detectedUrl?: string`.
- **detectedUrl**: URL detectada pelo `LocalEnvironment` durante o startup do servidor de desenvolvimento, exposta em `EnvironmentResult.detectedUrl`.
- **Issue**: Tipo em `src/validate/types.ts` representando um problema detectado, com campos `type`, `severity`, `message` e `detector`.
- **IssueType**: Union type em `src/validate/types.ts` com os valores possíveis de `Issue.type`.
- **CLIReporter**: Reporter em `src/cli/CLIReporter.ts` que já possui bloco de formatação para `result.checks.webgl`.
- **Graceful Skip**: Comportamento do `WebGLValidator` quando Playwright não está instalado — retorna `{ passed: true, jsErrors: ['Playwright not installed - WebGL check skipped'] }` sem lançar exceção.

---

## Requirements

### Requirement 1: Instanciar e invocar o WebGLValidator no nível thorough

**User Story:** Como desenvolvedor usando o EscapeKit MCP com nível `'thorough'`, quero que o `WebGLValidator` seja executado automaticamente, para que o campo `checks.webgl` do resultado seja populado com dados reais de validação WebGL.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL instanciar `WebGLValidator` como campo privado no construtor, com as opções padrão.
2. WHEN o nível de validação for `'thorough'` e o `EnvironmentResult` contiver `detectedUrl` definido, THE `ValidationEngine` SHALL chamar `this.webglValidator.validate(detectedUrl)` após o bloco de runtime.
3. WHEN `WebGLValidator.validate()` retornar com sucesso, THE `ValidationEngine` SHALL popular `result.checks.webgl` com o `WebGLCheckResult` retornado.
4. WHEN o nível de validação for `'basic'`, THE `ValidationEngine` SHALL não chamar `WebGLValidator.validate()` e `result.checks.webgl` SHALL ser `undefined`.
5. WHEN o nível de validação for `'standard'`, THE `ValidationEngine` SHALL não chamar `WebGLValidator.validate()` e `result.checks.webgl` SHALL ser `undefined`.

---

### Requirement 2: Condição de URL disponível

**User Story:** Como desenvolvedor, quero que o `WebGLValidator` só seja executado quando uma URL de runtime estiver disponível, para que não haja tentativas de validação sem servidor em execução.

#### Acceptance Criteria

1. WHEN o nível for `'thorough'` e `EnvironmentResult.detectedUrl` for `undefined`, THE `ValidationEngine` SHALL não chamar `WebGLValidator.validate()` e `result.checks.webgl` SHALL ser `undefined`.
2. WHEN o nível for `'thorough'` e o bloco de runtime não for executado (ambiente não disponível), THE `ValidationEngine` SHALL não chamar `WebGLValidator.validate()`.
3. WHEN o nível for `'thorough'` e `EnvironmentResult.detectedUrl` for uma string não vazia, THE `ValidationEngine` SHALL usar essa URL como argumento para `WebGLValidator.validate()`.
4. IF o `EnvironmentResult` não contiver o campo `detectedUrl` (spec `fix-browser-environment-runtime` ainda não aplicado), THEN THE `ValidationEngine` SHALL tentar extrair a URL dos `logs` do `EnvironmentResult` usando a regex `http:\/\/(?:localhost|127\.0\.0\.1):\d+` como fallback.

---

### Requirement 3: Geração de Issue para falha WebGL

**User Story:** Como desenvolvedor, quero que uma falha na validação WebGL gere um `Issue` estruturado no resultado, para que o problema apareça em `remainingIssues` e possa ser tratado pelo auto-fix.

#### Acceptance Criteria

1. WHEN `WebGLCheckResult.passed === false`, THE `ValidationEngine` SHALL adicionar um `Issue` com `type: 'WEBGL_ERROR'`, `severity: 'error'` e `detector: 'WebGLValidator'` à lista de issues.
2. WHEN `WebGLCheckResult.passed === false` e `jsErrors` não estiver vazio, THE `ValidationEngine` SHALL incluir o primeiro elemento de `jsErrors` no campo `message` do `Issue`.
3. WHEN `WebGLCheckResult.passed === true`, THE `ValidationEngine` SHALL não adicionar nenhum `Issue` relacionado ao WebGL.
4. THE `IssueType` em `src/validate/types.ts` SHALL incluir o valor `'WEBGL_ERROR'` na union type.
5. WHEN `WebGLCheckResult.passed === false`, THE `ValidationEngine` SHALL garantir que `result.canDeploy === false` (via mecanismo existente de contagem de issues com `severity: 'error'`).

---

### Requirement 4: Graceful skip quando Playwright não está instalado

**User Story:** Como desenvolvedor em ambiente sem Playwright instalado, quero que a validação continue normalmente sem o check WebGL, para que a ausência do Playwright não bloqueie o fluxo de validação.

#### Acceptance Criteria

1. WHEN Playwright não estiver instalado e `WebGLValidator.validate()` retornar `{ passed: true, jsErrors: ['Playwright not installed - WebGL check skipped'] }`, THE `ValidationEngine` SHALL popular `result.checks.webgl` com esse resultado.
2. WHEN o graceful skip ocorrer, THE `ValidationEngine` SHALL não adicionar nenhum `Issue` com `severity: 'error'` relacionado ao WebGL (pois `passed === true`).
3. WHEN o graceful skip ocorrer, `result.canDeploy` SHALL não ser afetado pela ausência do Playwright.
4. THE `WebGLValidator` SHALL continuar sendo responsável pelo graceful skip internamente — o `ValidationEngine` não precisa verificar se Playwright está instalado.

---

### Requirement 5: Preservação do comportamento existente

**User Story:** Como desenvolvedor que já usa o EscapeKit MCP, quero que a adição do `WebGLValidator` não altere o comportamento dos níveis `'basic'` e `'standard'`, para que meus fluxos atuais continuem funcionando sem mudanças.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL manter a assinatura pública do método `validate(projectPath, options)` sem alterações.
2. WHEN o nível for `'basic'`, THE `ValidationEngine` SHALL executar apenas `BuildValidator` e `DependencyValidator`, sem mudança de comportamento.
3. WHEN o nível for `'standard'`, THE `ValidationEngine` SHALL executar `BuildValidator`, `DependencyValidator` e o ambiente de runtime, sem mudança de comportamento.
4. THE `ValidationResult` SHALL continuar sendo compatível com o `CLIReporter` existente — o campo `checks.webgl` já é tratado condicionalmente pelo reporter.
5. THE `AutoFixEngine` e os fixers existentes SHALL não requerer nenhuma modificação para suportar `'WEBGL_ERROR'` como novo `IssueType`.

