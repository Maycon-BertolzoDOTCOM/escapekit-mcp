# Requirements Document

## Introduction

O EscapeKit MCP possui testes unitários para cada componente individualmente, mas não possui testes de integração end-to-end que validem o fluxo completo com projetos reais. Isso significa que os componentes podem funcionar corretamente em isolamento mas falhar quando integrados — por exemplo, o `DependencyValidator` pode detectar ghost imports corretamente, mas o `ValidationEngine` pode não propagar esses resultados para `remainingIssues` ou `canDeploy` como esperado.

Esta feature cria uma suíte de testes de integração que exercita o `ValidationEngine.validate()` com projetos fixture reais, verificando detecção de problemas conhecidos, propagação correta de resultados e comportamento do auto-fix end-to-end. Os fixtures são projetos mínimos com problemas controlados e conhecidos, criados em `tests/fixtures/`. Os testes de integração usam `tmpdir()` para isolar modificações e evitar poluir os fixtures originais.

## Glossary

- **ValidationEngine**: Orquestrador principal em `src/validate/ValidationEngine.ts` que coordena todos os validadores e produz o `ValidationResult`.
- **ValidationResult**: Tipo de retorno do `ValidationEngine.validate()`, contendo `canDeploy`, `checks`, `fixesApplied`, `remainingIssues` e `recommendations`.
- **DependencyValidator**: Validador em `src/validate/validators/DependencyValidator.ts` que detecta ghost imports, vulnerabilidades e dependências desatualizadas.
- **FallbackGenerator**: Fixer em `src/validate/auto-fix/FallbackGenerator.ts` que gera `src/utils/webgl-fallback.ts` quando `WEBGL_UNSUPPORTED` é detectado.
- **AutoFixEngine**: Orquestrador em `src/validate/auto-fix/AutoFixEngine.ts` que roteia issues para os fixers corretos.
- **Ghost_Import**: Import de um pacote que corresponde a um dos padrões de ghost do `DependencyValidator` (ex: prefixo `fake-`, `mock-`, `sandbox-`, `claude-`, `replit-`).
- **Fixture**: Projeto mínimo em `tests/fixtures/` com estrutura e problemas controlados, usado como entrada para os testes de integração.
- **ValidationLevel**: Union type `'basic' | 'standard' | 'thorough'` que controla a profundidade da validação.
- **Issue**: Tipo em `src/validate/types.ts` representando um problema detectado, com campos `type`, `severity`, `message` e `detector`.
- **Fix**: Tipo em `src/validate/types.ts` representando uma correção aplicada, com campos `issueType`, `applied` e `description`.
- **tmpdir**: Diretório temporário do sistema operacional, usado para criar cópias isoladas dos fixtures antes de aplicar auto-fix.
- **LocalEnvironment**: Ambiente de runtime em `src/validate/environments/LocalEnvironment.ts` que inicia um servidor de desenvolvimento — deve ser evitado nos testes de integração para não bloquear a execução.

---

## Requirements

### Requirement 1: Fixtures de projetos de teste

**User Story:** Como desenvolvedor do EscapeKit MCP, quero que existam projetos fixture mínimos com problemas conhecidos e controlados em `tests/fixtures/`, para que os testes de integração tenham entradas determinísticas e reproduzíveis.

#### Acceptance Criteria

1. THE `Fixture` `tests/fixtures/ghost-import-project/` SHALL conter um `package.json` com dependências reais (`lodash`, `axios`) e um `src/index.ts` com imports de pacotes que correspondem aos padrões de ghost do `DependencyValidator` (ex: `import { foo } from 'fake-api'`).
2. THE `Fixture` `tests/fixtures/webgl-project/` SHALL conter um `package.json` com `three` em `dependencies` e um `src/main.ts` com código Three.js básico, sem o arquivo `src/utils/webgl-fallback.ts`.
3. THE `Fixture` `tests/fixtures/vulnerable-project/` SHALL conter um `package.json` com `event-stream` em `dependencies` e um `src/index.ts` com `import 'event-stream'`.
4. THE `Fixture` `tests/fixtures/clean-project/` SHALL conter um `package.json` com dependências reais e válidas (`lodash`, `axios`) e um `src/index.ts` sem imports de ghost packages ou pacotes vulneráveis conhecidos.
5. WHEN qualquer `Fixture` for lido pelo `DependencyValidator`, THE `DependencyValidator` SHALL ser capaz de processar o `package.json` e os arquivos `src/` sem erros de I/O.

---

### Requirement 2: Detecção de ghost imports em projeto fixture

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que `validate(ghostImportProject)` retorne issues com `type: 'GHOST_IMPORT'`, para que eu possa confirmar que o fluxo completo de detecção funciona end-to-end.

#### Acceptance Criteria

1. WHEN `ValidationEngine.validate(ghostImportProjectPath, { level: 'basic' })` for chamado, THE `ValidationEngine` SHALL retornar um `ValidationResult` com `remainingIssues` contendo ao menos um `Issue` com `type: 'GHOST_IMPORT'`.
2. WHEN ghost imports forem detectados, THE `ValidationResult` SHALL ter `canDeploy === false`.
3. WHEN ghost imports forem detectados, THE `Issue` com `type: 'GHOST_IMPORT'` SHALL ter `severity: 'error'`.
4. WHEN `ValidationEngine.validate(ghostImportProjectPath, { level: 'basic' })` for chamado, THE `ValidationEngine` SHALL completar a validação sem lançar exceções não tratadas.

---

### Requirement 3: Detecção de vulnerabilidade de segurança em projeto fixture

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que `validate(vulnerableProject)` retorne `checks.security.passed === false` ou issues de segurança, para que eu possa confirmar que pacotes vulneráveis conhecidos são detectados end-to-end.

#### Acceptance Criteria

1. WHEN `ValidationEngine.validate(vulnerableProjectPath, { level: 'basic' })` for chamado com um projeto contendo `event-stream` em `dependencies`, THE `ValidationEngine` SHALL retornar um `ValidationResult` onde `checks.security` está definido e `checks.security.passed === false`, OU `remainingIssues` contém ao menos um `Issue` com `type: 'SECURITY_VULNERABILITY'`.
2. WHEN a vulnerabilidade de segurança for detectada via `checks.security.passed === false`, THE `ValidationResult` SHALL ter `canDeploy === false`.
3. WHEN `ValidationEngine.validate(vulnerableProjectPath, { level: 'basic' })` for chamado, THE `ValidationEngine` SHALL completar a validação sem lançar exceções não tratadas.

---

### Requirement 4: Projeto limpo retorna canDeploy === true

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que `validate(cleanProject)` retorne `canDeploy === true`, para que eu possa confirmar que projetos sem problemas conhecidos não são incorretamente bloqueados.

#### Acceptance Criteria

1. WHEN `ValidationEngine.validate(cleanProjectPath, { level: 'basic' })` for chamado com um projeto sem ghost imports e sem pacotes vulneráveis conhecidos, THE `ValidationEngine` SHALL retornar um `ValidationResult` com `canDeploy === true`.
2. WHEN o projeto limpo for validado, THE `ValidationResult` SHALL ter `remainingIssues` sem nenhum `Issue` com `severity: 'error'`.
3. WHEN `ValidationEngine.validate(cleanProjectPath, { level: 'basic' })` for chamado, THE `ValidationEngine` SHALL completar a validação sem lançar exceções não tratadas.

---

### Requirement 5: Auto-fix de ghost imports reduz o número de issues

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que `validate(ghostImportProject, { autoFix: true })` aplique correções e reduza o número de ghost imports, para que eu possa confirmar que o fluxo de auto-fix funciona end-to-end.

#### Acceptance Criteria

1. WHEN `ValidationEngine.validate(ghostImportProjectPath, { level: 'basic', autoFix: true })` for chamado em uma cópia temporária do fixture, THE `ValidationEngine` SHALL retornar um `ValidationResult` com `fixesApplied.length > 0`.
2. WHEN o auto-fix for aplicado, THE `ValidationResult.fixesApplied` SHALL conter ao menos um `Fix` com `applied: true` e `issueType: 'GHOST_IMPORT'`.
3. WHEN o auto-fix for aplicado, THE `ValidationResult.remainingIssues` SHALL conter menos issues com `type: 'GHOST_IMPORT'` do que antes do auto-fix.
4. WHEN o auto-fix for executado, THE `ValidationEngine` SHALL usar uma cópia do fixture em `tmpdir()` para não modificar o fixture original.

---

### Requirement 6: Auto-fix de WebGL gera arquivo de fallback

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que `validate(webglProject, { autoFix: true })` crie o arquivo `src/utils/webgl-fallback.ts`, para que eu possa confirmar que o `FallbackGenerator` funciona end-to-end com um projeto Three.js real.

#### Acceptance Criteria

1. WHEN `ValidationEngine.validate(webglProjectPath, { level: 'basic', autoFix: true })` for chamado em uma cópia temporária do fixture, THE `FallbackGenerator` SHALL criar o arquivo `src/utils/webgl-fallback.ts` no diretório do projeto.
2. WHEN o arquivo `src/utils/webgl-fallback.ts` for criado, THE arquivo SHALL conter a função `checkWebGLSupport` exportada.
3. WHEN o auto-fix de WebGL for aplicado, THE `ValidationResult.fixesApplied` SHALL conter ao menos um `Fix` com `applied: true` e `issueType: 'WEBGL_UNSUPPORTED'`.
4. WHEN o auto-fix for executado, THE `ValidationEngine` SHALL usar uma cópia do fixture em `tmpdir()` para não modificar o fixture original.

---

### Requirement 7: Isolamento dos testes de integração

**User Story:** Como desenvolvedor do EscapeKit MCP, quero que os testes de integração não iniciem servidores de desenvolvimento nem modifiquem os fixtures originais, para que os testes sejam rápidos, determinísticos e não deixem efeitos colaterais.

#### Acceptance Criteria

1. THE `ValidationEngine` nos testes de integração SHALL ser chamado com `environment: 'local'` e `level: 'basic'` para evitar a execução do `LocalEnvironment` (que requer `standard` ou `thorough`).
2. WHEN um teste de integração precisar aplicar auto-fix, THE teste SHALL copiar o fixture para um diretório temporário via `tmpdir()` antes de chamar `validate()` com `autoFix: true`.
3. WHEN o teste de integração for concluído, THE diretório temporário SHALL ser removido no bloco `afterEach` ou `afterAll` para não acumular arquivos temporários.
4. THE testes de integração SHALL ser executados sem dependência de rede externa (sem chamadas reais ao npm registry ou servidores externos).
5. THE arquivo de testes de integração SHALL ser criado em `tests/integration/ValidationEngine.integration.test.ts`.

---

### Requirement 8: Propriedades de correção (PBT)

**User Story:** Como desenvolvedor do EscapeKit MCP, quero que as propriedades de correção do `ValidationEngine` sejam verificadas com testes baseados em propriedades, para que o comportamento seja garantido para qualquer entrada válida, não apenas para os fixtures específicos.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL satisfazer a propriedade P1: para qualquer projeto com ao menos um ghost import (pacote com prefixo `fake-`, `mock-`, `sandbox-`, `claude-` ou `replit-`), `validate(project, { level: 'basic' }).remainingIssues` DEVE conter ao menos um `Issue` com `type: 'GHOST_IMPORT'`.
2. THE `ValidationEngine` SHALL satisfazer a propriedade P2: para qualquer projeto com `event-stream` em `dependencies`, `validate(project, { level: 'basic' })` DEVE retornar `checks.security.passed === false` OU `remainingIssues` com ao menos um `Issue` com `type: 'SECURITY_VULNERABILITY'`.
3. THE `ValidationEngine` SHALL satisfazer a propriedade P3: para qualquer projeto sem ghost imports e sem pacotes vulneráveis conhecidos, `validate(project, { level: 'basic' }).canDeploy` DEVE ser `true`.
4. THE `ValidationEngine` SHALL satisfazer a propriedade P4: para qualquer projeto com ao menos um ghost import, `validate(project, { level: 'basic', autoFix: true }).fixesApplied.length` DEVE ser maior que zero.
