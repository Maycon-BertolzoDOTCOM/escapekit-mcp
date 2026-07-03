# Implementation Plan

## Tasks

- [x] 1. Atualizar `SecurityCheckResult` em `types.ts`
  - Verificar a estrutura atual de `SecurityCheckResult` em `src/validate/types.ts`
  - Adicionar import de `SecurityValidationResult` de `'../security/SecurityValidator.js'`
  - Substituir a definição existente de `SecurityCheckResult` pela nova estrutura: `passed: boolean`, `packageResults: SecurityValidationResult[]`, `vulnerablePackages: string[]`, `deprecatedPackages: string[]`, `licenseIssues: string[]`
  - Verificar que `ValidationResult.checks.security?: SecurityCheckResult` já existe (não requer alteração)
  - Arquivo: `src/validate/types.ts`

- [x] 2. Importar e instanciar `SecurityValidator` no `ValidationEngine`
  - Adicionar import: `import { SecurityValidator } from '../security/SecurityValidator.js'`
  - Adicionar import de `SecurityCheckResult` e `SecurityValidationResult` ao bloco de imports de tipos
  - Adicionar campo privado `private readonly securityValidator: SecurityValidator` à classe
  - Adicionar `this.securityValidator = new SecurityValidator()` no construtor, após as instanciações existentes
  - Adicionar imports de `path` e `fs/promises` se ainda não presentes
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 3. Implementar método auxiliar `collectPackageNames`
  - Implementar `private async collectPackageNames(projectPath: string, dependencyResult: DependencyCheckResult): Promise<string[]>`
  - Ler `package.json` via `fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')`
  - Extrair chaves de `dependencies` e `devDependencies` para um `Set<string>`
  - Adicionar nomes de `dependencyResult.ghostPackages` e `dependencyResult.vulnerabilities` ao Set
  - Capturar erros de leitura/parse com log `warn` sem propagar
  - Retornar `Array.from(names)`
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 4. Invocar `SecurityValidator` após o bloco do `DependencyValidator`
  - Declarar `const securityPackageResults: SecurityValidationResult[] = []` após o bloco do `DependencyValidator`
  - Chamar `await this.collectPackageNames(projectPath, dependencyResult)` para obter a lista de pacotes
  - Iterar sobre os pacotes com `for...of`, chamando `await this.securityValidator.validate(packageName)` dentro de try/catch
  - Se `secResult.safe === false`: adicionar Issue com `type: 'SECURITY_VULNERABILITY'`, `severity: 'error'`, `detector: 'SecurityValidator'`, `message` contendo `packageName` e `vulnerabilities[0]` se disponível
  - Se `secResult.safe === true` e `secResult.warnings.length > 0`: adicionar Issue com `type: 'SECURITY_WARNING'`, `severity: 'warning'`, `detector: 'SecurityValidator'`, `message` contendo `warnings[0]`
  - Capturar exceções por pacote com log `warn` sem propagar
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 5. Construir `SecurityCheckResult` e popular `result.checks.security`
  - Após o loop de pacotes, construir `securityResult: SecurityCheckResult` com:
    - `passed`: `securityPackageResults.every(r => r.safe)`
    - `packageResults`: `securityPackageResults`
    - `vulnerablePackages`: nomes dos pacotes onde `vulnerabilities.length > 0`
    - `deprecatedPackages`: nomes dos pacotes onde `deprecated === true` ou `maintained === false`
    - `licenseIssues`: nomes dos pacotes onde `licenseCompatible === false`
  - No objeto `result.checks`, adicionar `security: securityResult`
  - Garantir que `securityResult` está no escopo correto (declarado antes do bloco de runtime)
  - Arquivo: `src/validate/ValidationEngine.ts`

- [x] 6. Escrever testes unitários em `ValidationEngine.security.test.ts`
  - Criar `tests/validate/ValidationEngine.security.test.ts`
  - Mockar `SecurityValidator` para controlar o retorno de `validate()`
  - Mockar `BuildValidator`, `DependencyValidator` e `fs/promises` para isolar o comportamento de segurança
  - **P1 — event-stream em dependencies → checks.security.passed === false:**
    - `package.json` com `event-stream` em `dependencies` + mock retornando `{ safe: false, vulnerabilities: ['CVE-2018-16462: malicious code injection'], ... }` → `result.checks.security.passed === false`
    - `result.checks.security.vulnerablePackages` contém `'event-stream'`
  - **P2 — event-stream em dependencies → canDeploy === false:**
    - Mesmo cenário do P1 → `result.canDeploy === false`
    - `result.remainingIssues` contém Issue com `type: 'SECURITY_VULNERABILITY'`, `severity: 'error'`, `detector: 'SecurityValidator'`
    - `issue.message` contém `'event-stream'` e `'CVE-2018-16462'`
  - **P3 — sem pacotes vulneráveis → checks.security.passed === true:**
    - `package.json` com pacotes seguros + mock retornando `{ safe: true, vulnerabilities: [], warnings: [], ... }` → `result.checks.security.passed === true`
    - Nenhum Issue com `type: 'SECURITY_VULNERABILITY'`
  - **P4 — checks.security definido em todos os níveis:**
    - Nível `'basic'` → `result.checks.security !== undefined`
    - Nível `'standard'` → `result.checks.security !== undefined`
    - Nível `'thorough'` → `result.checks.security !== undefined`
  - **P5 — pacotes com warnings → Issue severity warning, não error:**
    - Mock retornando `{ safe: true, deprecated: true, warnings: ['Package "x" is deprecated'], ... }` → Issue com `severity: 'warning'`, não `'error'`
    - `result.checks.security.deprecatedPackages` contém o pacote
    - `result.canDeploy` não afetado (sem issues de error)
  - **Deduplicação de pacotes:**
    - Pacote presente em `dependencies` e em `ghostPackages` → `SecurityValidator.validate` chamado exatamente uma vez para esse pacote
  - **package.json ausente:**
    - `fs.readFile` lança erro → validação continua usando apenas `ghostPackages` + `vulnerabilities`, `checks.security` definido
  - **Exceção por pacote:**
    - `securityValidator.validate('pkg-a')` lança `Error('timeout')` → `pkg-a` não incluído em `packageResults`, demais pacotes validados normalmente
  - **Lista vazia de pacotes:**
    - `package.json` sem `dependencies`/`devDependencies` e `dependencyResult` sem ghost/vulns → `checks.security.passed === true`, `packageResults` vazio
  - **licenseIssues populado:**
    - Mock retornando `{ safe: true, licenseCompatible: false, warnings: ['License "GPL-3.0" may not be compatible'], ... }` → `checks.security.licenseIssues` contém o pacote
  - Arquivo: `tests/validate/ValidationEngine.security.test.ts`

- [x] 7. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `src/validate/types.ts` e `src/validate/ValidationEngine.ts`
  - Garantir que o import circular entre `types.ts` e `SecurityValidator.ts` não existe (usar import direto de `SecurityValidator.ts` em `types.ts`)
  - Verificar que `SecurityCheckResult` atualizado não quebra outros consumidores do tipo (ex: `CLIReporter`)
  - Verificar que `result.checks.security` aceita `SecurityCheckResult` conforme a interface `ValidationResult`
  - Executar `getDiagnostics` em `tests/validate/ValidationEngine.security.test.ts`
