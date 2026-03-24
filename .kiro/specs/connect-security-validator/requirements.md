# Requirements Document

## Introduction

O `SecurityValidator` (`src/security/SecurityValidator.ts`) está completamente implementado com verificações de CVEs conhecidos, deprecação, compatibilidade de licença e status de manutenção. Porém, o `ValidationEngine` nunca o instancia nem o invoca: o campo `checks.security` do `ValidationResult` permanece `undefined` em todas as execuções, tornando o validador inoperante.

Esta feature conecta o `SecurityValidator` ao `ValidationEngine`, garantindo que ele seja executado em todos os níveis de validação (`basic`, `standard`, `thorough`) para todos os pacotes do projeto, que resultados de segurança populem `checks.security`, e que pacotes vulneráveis ou com avisos gerem `Issue` estruturado com severidade adequada.

## Glossary

- **ValidationEngine**: Orquestrador principal em `src/validate/ValidationEngine.ts` que coordena todos os validadores e produz o `ValidationResult`.
- **SecurityValidator**: Validador em `src/security/SecurityValidator.ts` que verifica pacotes contra CVEs conhecidos, deprecação, licença e status de manutenção.
- **SecurityValidationResult**: Tipo retornado por `SecurityValidator.validate()`, com campos `packageName`, `safe`, `vulnerabilities`, `warnings`, `licenseCompatible`, `maintained` e `deprecated`.
- **SecurityCheckResult**: Novo tipo a ser adicionado em `src/validate/types.ts` que agrega os resultados de segurança de todos os pacotes validados.
- **ValidationResult**: Tipo de retorno do `ValidationEngine.validate()`, contendo `checks.security?: SecurityCheckResult`.
- **ValidationLevel**: Union type `'basic' | 'standard' | 'thorough'` que controla a profundidade da validação.
- **DependencyCheckResult**: Resultado do `DependencyValidator`, contendo `ghostPackages` e `vulnerabilities` que servem como fonte de pacotes para o `SecurityValidator`.
- **Issue**: Tipo em `src/validate/types.ts` representando um problema detectado, com campos `type`, `severity`, `message` e `detector`.
- **IssueType**: Union type em `src/validate/types.ts` com os valores possíveis de `Issue.type`.
- **knownVulnerablePackages**: Mapa interno do `SecurityValidator` com CVEs hardcoded para 6 pacotes conhecidamente maliciosos.
- **package.json**: Arquivo de manifesto do projeto validado, cujos campos `dependencies` e `devDependencies` são a fonte primária de pacotes a validar.
- **Ghost Package**: Pacote importado no código mas ausente do `package.json`, detectado pelo `DependencyValidator` e exposto em `dependencyResult.ghostPackages`.

---

## Requirements

### Requirement 1: Adicionar `SecurityCheckResult` aos tipos

**User Story:** Como desenvolvedor do EscapeKit MCP, quero que o tipo `SecurityCheckResult` esteja definido em `types.ts` com a estrutura correta, para que o `ValidationEngine` possa popular `checks.security` de forma tipada.

#### Acceptance Criteria

1. THE `SecurityCheckResult` em `src/validate/types.ts` SHALL conter os campos `passed: boolean`, `packageResults: SecurityValidationResult[]`, `vulnerablePackages: string[]`, `deprecatedPackages: string[]` e `licenseIssues: string[]`.
2. THE `ValidationChecks` em `src/validate/types.ts` SHALL conter o campo `security?: SecurityCheckResult` como campo opcional.
3. THE `SecurityValidationResult` SHALL ser importado de `src/security/SecurityValidator.ts` ou redeclarado em `types.ts` para uso no campo `packageResults`.

---

### Requirement 2: Instanciar e invocar o SecurityValidator em todos os níveis

**User Story:** Como desenvolvedor usando o EscapeKit MCP, quero que o `SecurityValidator` seja executado automaticamente em qualquer nível de validação, para que vulnerabilidades de segurança conhecidas sejam sempre detectadas independentemente da profundidade escolhida.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL instanciar `SecurityValidator` como campo privado no construtor, com as opções padrão.
2. WHEN o `ValidationEngine.validate()` for chamado com nível `'basic'`, THE `ValidationEngine` SHALL executar o `SecurityValidator` para os pacotes do projeto e popular `result.checks.security`.
3. WHEN o `ValidationEngine.validate()` for chamado com nível `'standard'`, THE `ValidationEngine` SHALL executar o `SecurityValidator` para os pacotes do projeto e popular `result.checks.security`.
4. WHEN o `ValidationEngine.validate()` for chamado com nível `'thorough'`, THE `ValidationEngine` SHALL executar o `SecurityValidator` para os pacotes do projeto e popular `result.checks.security`.
5. THE `ValidationEngine` SHALL executar o bloco do `SecurityValidator` após o bloco do `DependencyValidator` e antes da construção do `ValidationResult`.

---

### Requirement 3: Coletar pacotes do projeto para validação

**User Story:** Como desenvolvedor, quero que o `SecurityValidator` verifique todos os pacotes relevantes do projeto, para que nenhuma dependência vulnerável passe despercebida.

#### Acceptance Criteria

1. WHEN o `ValidationEngine` executar o `SecurityValidator`, THE `ValidationEngine` SHALL ler o `package.json` do projeto validado e extrair os nomes de pacotes de `dependencies` e `devDependencies`.
2. WHEN o `DependencyCheckResult` contiver `ghostPackages`, THE `ValidationEngine` SHALL incluir os nomes desses pacotes na lista de pacotes a validar.
3. WHEN o `DependencyCheckResult` contiver `vulnerabilities`, THE `ValidationEngine` SHALL incluir os nomes desses pacotes na lista de pacotes a validar.
4. THE `ValidationEngine` SHALL deduplicar a lista de pacotes antes de chamar `SecurityValidator.validate()`, garantindo que cada pacote seja validado exatamente uma vez.
5. IF o `package.json` do projeto não existir ou não puder ser lido, THEN THE `ValidationEngine` SHALL usar apenas os pacotes de `ghostPackages` e `vulnerabilities` do `DependencyCheckResult`, sem interromper a validação.

---

### Requirement 4: Agregar resultados em `SecurityCheckResult`

**User Story:** Como desenvolvedor, quero que os resultados individuais de cada pacote sejam agregados em um `SecurityCheckResult` coeso, para que o campo `checks.security` reflita o estado geral de segurança do projeto.

#### Acceptance Criteria

1. WHEN todos os pacotes forem validados, THE `ValidationEngine` SHALL construir um `SecurityCheckResult` com `packageResults` contendo todos os `SecurityValidationResult` individuais.
2. THE `SecurityCheckResult.passed` SHALL ser `true` se e somente se nenhum pacote tiver `safe === false`.
3. THE `SecurityCheckResult.vulnerablePackages` SHALL conter os nomes de todos os pacotes onde `SecurityValidationResult.vulnerabilities` não estiver vazio.
4. THE `SecurityCheckResult.deprecatedPackages` SHALL conter os nomes de todos os pacotes onde `SecurityValidationResult.deprecated === true` ou `SecurityValidationResult.maintained === false`.
5. THE `SecurityCheckResult.licenseIssues` SHALL conter os nomes de todos os pacotes onde `SecurityValidationResult.licenseCompatible === false`.
6. WHEN nenhum pacote for encontrado para validar, THE `ValidationEngine` SHALL popular `result.checks.security` com `SecurityCheckResult` com `passed: true` e todas as listas vazias.

---

### Requirement 5: Gerar Issues para pacotes vulneráveis

**User Story:** Como desenvolvedor, quero que pacotes com CVEs conhecidos gerem um `Issue` com `severity: 'error'`, para que `canDeploy` seja `false` e o problema apareça em `remainingIssues`.

#### Acceptance Criteria

1. WHEN `SecurityValidationResult.safe === false` para algum pacote, THE `ValidationEngine` SHALL adicionar um `Issue` com `type: 'SECURITY_VULNERABILITY'`, `severity: 'error'` e `detector: 'SecurityValidator'` à lista de issues.
2. WHEN `SecurityValidationResult.vulnerabilities` não estiver vazio, THE `ValidationEngine` SHALL incluir o primeiro elemento de `vulnerabilities` no campo `message` do `Issue`.
3. WHEN `SecurityValidationResult.safe === false`, THE `ValidationEngine` SHALL garantir que `result.canDeploy === false` via o mecanismo existente de contagem de issues com `severity: 'error'`.
4. WHEN `SecurityValidationResult.safe === true`, THE `ValidationEngine` SHALL não adicionar nenhum `Issue` com `type: 'SECURITY_VULNERABILITY'` para esse pacote.

---

### Requirement 6: Gerar Issues de aviso para pacotes com warnings

**User Story:** Como desenvolvedor, quero que pacotes deprecados ou desatualizados gerem um `Issue` com `severity: 'warning'`, para que apareçam em `remainingIssues` sem bloquear o deploy.

#### Acceptance Criteria

1. WHEN `SecurityValidationResult.warnings` não estiver vazio e `SecurityValidationResult.safe === true`, THE `ValidationEngine` SHALL adicionar um `Issue` com `type: 'SECURITY_WARNING'`, `severity: 'warning'` e `detector: 'SecurityValidator'` à lista de issues.
2. WHEN `SecurityValidationResult.deprecated === true`, THE `ValidationEngine` SHALL incluir a mensagem de deprecação no campo `message` do `Issue` de aviso.
3. WHEN `SecurityValidationResult.maintained === false`, THE `ValidationEngine` SHALL incluir a mensagem de staleness no campo `message` do `Issue` de aviso.
4. WHEN `SecurityValidationResult.safe === false`, THE `ValidationEngine` SHALL emitir apenas o `Issue` de `severity: 'error'`, não duplicando com um `Issue` de `severity: 'warning'` para o mesmo pacote.
5. WHEN `SecurityValidationResult.warnings` estiver vazio, THE `ValidationEngine` SHALL não adicionar nenhum `Issue` com `type: 'SECURITY_WARNING'` para esse pacote.

---

### Requirement 7: Preservação do comportamento existente

**User Story:** Como desenvolvedor que já usa o EscapeKit MCP, quero que a adição do `SecurityValidator` não altere o comportamento dos validadores existentes, para que meus fluxos atuais continuem funcionando sem mudanças.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL manter a assinatura pública do método `validate(projectPath, options)` sem alterações.
2. THE `DependencyValidator` SHALL continuar gerando seus próprios Issues de `SECURITY_VULNERABILITY` via `npm audit` — o `SecurityValidator` é complementar, não substituto.
3. THE `ValidationResult` SHALL continuar sendo compatível com o `CLIReporter` existente — o campo `checks.security` já é tratado condicionalmente pelo reporter.
4. THE `AutoFixEngine` e os fixers existentes SHALL não requerer nenhuma modificação para suportar os novos Issues gerados pelo `SecurityValidator`.
5. WHEN o `SecurityValidator.validate()` lançar uma exceção inesperada para um pacote, THE `ValidationEngine` SHALL capturar a exceção, emitir log de aviso e continuar a validação dos demais pacotes sem interrupção.
