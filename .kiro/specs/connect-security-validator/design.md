# Design Document

## Overview

Mudança cirúrgica no `ValidationEngine` para conectar o `SecurityValidator` já implementado ao fluxo de validação. São quatro alterações: (1) atualizar `SecurityCheckResult` em `types.ts` para incluir `packageResults` e listas de pacotes problemáticos; (2) instanciar `SecurityValidator` no construtor do `ValidationEngine`; (3) após o bloco do `DependencyValidator`, coletar pacotes do `package.json` + ghost packages + vulnerabilidades, chamar `securityValidator.validate()` para cada um e agregar em `SecurityCheckResult`; (4) popular `result.checks.security` e gerar Issues com severidade adequada. O `SecurityValidator` roda em todos os níveis (`basic`, `standard`, `thorough`). Nenhuma interface pública é alterada.

---

## Architecture

### Componentes afetados

```
src/
├── security/
│   └── SecurityValidator.ts              ← sem alterações (já implementado)
└── validate/
    ├── types.ts                          ← atualizar SecurityCheckResult
    └── ValidationEngine.ts              ← instanciar SecurityValidator, invocar após DependencyValidator
```

### Fluxo do método `validate()` após a mudança

```
ValidationEngine.validate(projectPath, options)
  │
  ├─ 1. BuildValidator.validate()              (todos os níveis)
  ├─ 2. DependencyValidator.validate()         (todos os níveis)
  ├─ 3. SecurityValidator (loop por pacote)    (todos os níveis) ← NOVO
  │       ├─ ler package.json → dependencies + devDependencies
  │       ├─ adicionar ghostPackages + vulnerabilities do DependencyResult
  │       ├─ deduplicar lista
  │       ├─ para cada pacote: securityValidator.validate(name)
  │       ├─ safe === false → Issue { type: 'SECURITY_VULNERABILITY', severity: 'error' }
  │       ├─ warnings não vazio + safe === true → Issue { type: 'SECURITY_WARNING', severity: 'warning' }
  │       └─ agregar em SecurityCheckResult
  ├─ 4. environment.test(projectPath)          (standard + thorough)
  ├─ 5. autoFix loop                           (se opts.autoFix)
  └─ 6. montar ValidationResult
          └─ checks.security = securityResult  ← NOVO
```

---

## Detailed Design

### 1. Atualização de `SecurityCheckResult` em `types.ts`

O tipo `SecurityCheckResult` já existe em `types.ts` mas com estrutura diferente da especificada. Precisa ser atualizado para incluir `packageResults` e as listas de pacotes problemáticos:

```typescript
// src/validate/types.ts
import type { SecurityValidationResult } from '../security/SecurityValidator.js';

export interface SecurityCheckResult {
  passed: boolean;
  packageResults: SecurityValidationResult[];
  vulnerablePackages: string[];
  deprecatedPackages: string[];
  licenseIssues: string[];
}
```

O campo `checks.security?: SecurityCheckResult` já existe em `ValidationResult` — nenhuma alteração necessária nessa interface.

### 2. Instanciar `SecurityValidator` no construtor

```typescript
// src/validate/ValidationEngine.ts
import { SecurityValidator } from '../security/SecurityValidator.js';

export class ValidationEngine {
  private readonly securityValidator: SecurityValidator;  // ← novo campo

  constructor() {
    this.buildValidator = new BuildValidator();
    this.dependencyValidator = new DependencyValidator();
    this.autoFixEngine = new AutoFixEngine();
    this.securityValidator = new SecurityValidator();     // ← nova linha
  }
}
```

### 3. Método auxiliar `collectPackageNames`

Lê o `package.json` do projeto e combina com os pacotes detectados pelo `DependencyValidator`:

```typescript
private async collectPackageNames(
  projectPath: string,
  dependencyResult: DependencyCheckResult
): Promise<string[]> {
  const names = new Set<string>();

  // Pacotes do package.json
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    for (const name of Object.keys(pkg.dependencies ?? {})) names.add(name);
    for (const name of Object.keys(pkg.devDependencies ?? {})) names.add(name);
  } catch {
    this.log.warn('Could not read package.json for security scan', { projectPath });
  }

  // Ghost packages e vulnerabilidades do DependencyValidator
  for (const ghost of dependencyResult.ghostPackages) names.add(ghost.name);
  for (const vuln of dependencyResult.vulnerabilities) names.add(vuln.name);

  return Array.from(names);
}
```

### 4. Bloco principal do SecurityValidator no método `validate()`

Inserido após o bloco do `DependencyValidator`, antes do bloco de runtime:

```typescript
// Coletar pacotes e executar SecurityValidator
const packageNames = await this.collectPackageNames(projectPath, dependencyResult);
const securityPackageResults: SecurityValidationResult[] = [];

for (const packageName of packageNames) {
  try {
    const secResult = await this.securityValidator.validate(packageName);
    securityPackageResults.push(secResult);

    if (!secResult.safe) {
      issues.push({
        type: 'SECURITY_VULNERABILITY',
        detector: 'SecurityValidator',
        severity: 'error',
        message: secResult.vulnerabilities.length > 0
          ? `Security vulnerability in ${packageName}: ${secResult.vulnerabilities[0]}`
          : `Unsafe package detected: ${packageName}`,
      });
    } else if (secResult.warnings.length > 0) {
      issues.push({
        type: 'SECURITY_WARNING',
        detector: 'SecurityValidator',
        severity: 'warning',
        message: secResult.warnings[0],
      });
    }
  } catch (err) {
    this.log.warn('SecurityValidator threw unexpectedly', { packageName, error: err });
  }
}

const securityResult: SecurityCheckResult = {
  passed: securityPackageResults.every(r => r.safe),
  packageResults: securityPackageResults,
  vulnerablePackages: securityPackageResults
    .filter(r => r.vulnerabilities.length > 0)
    .map(r => r.packageName),
  deprecatedPackages: securityPackageResults
    .filter(r => r.deprecated || !r.maintained)
    .map(r => r.packageName),
  licenseIssues: securityPackageResults
    .filter(r => !r.licenseCompatible)
    .map(r => r.packageName),
};
```

### 5. Popular `result.checks.security`

```typescript
const result: ValidationResult = {
  // ...campos existentes...
  checks: {
    build: buildResult,
    runtime: { ... },
    dependencies: dependencyResult,
    security: securityResult,   // ← novo
  },
  // ...
};
```

---

## Data Models

### `SecurityCheckResult` — estrutura atualizada

| Campo | Tipo | Descrição |
|---|---|---|
| `passed` | `boolean` | `true` se nenhum pacote tiver `safe === false` |
| `packageResults` | `SecurityValidationResult[]` | Resultado individual de cada pacote validado |
| `vulnerablePackages` | `string[]` | Nomes dos pacotes com CVEs conhecidos |
| `deprecatedPackages` | `string[]` | Nomes dos pacotes deprecados ou desatualizados |
| `licenseIssues` | `string[]` | Nomes dos pacotes com licença incompatível |

### Campos adicionados ao `ValidationEngine`

| Campo | Tipo | Descrição |
|---|---|---|
| `securityValidator` | `SecurityValidator` | Instância privada criada no construtor |

### Variáveis locais no método `validate()`

| Variável | Tipo | Descrição |
|---|---|---|
| `packageNames` | `string[]` | Lista deduplicada de pacotes a validar |
| `securityPackageResults` | `SecurityValidationResult[]` | Resultados individuais acumulados |
| `securityResult` | `SecurityCheckResult` | Resultado agregado populado em `checks.security` |

---

## Correctness Properties

### P1 — event-stream em dependencies → checks.security.passed === false

Para qualquer projeto com `event-stream` em `dependencies`, `result.checks.security.passed` DEVE ser `false`.

Formalmente: `'event-stream' ∈ pkg.dependencies → result.checks.security.passed === false`

Mecanismo: `SecurityValidator.checkVulnerabilities('event-stream')` retorna `['CVE-2018-16462: malicious code injection']`, portanto `safe === false`, portanto `passed === false`.

### P2 — event-stream em dependencies → canDeploy === false

Para qualquer projeto com `event-stream` em `dependencies`, `result.canDeploy` DEVE ser `false`.

Formalmente: `'event-stream' ∈ pkg.dependencies → result.canDeploy === false`

Mecanismo: `safe === false` gera Issue com `severity: 'error'`; `canDeploy = issues.filter(i => i.severity === 'error').length === 0` resulta em `false`.

### P3 — sem pacotes vulneráveis → checks.security.passed === true

Para qualquer projeto sem pacotes da lista `knownVulnerablePackages`, `result.checks.security.passed` DEVE ser `true`.

Formalmente: `∀ pkg ∈ packageNames: checkVulnerabilities(pkg) = [] ∧ !deprecated → result.checks.security.passed === true`

### P4 — checks.security definido em todos os níveis

`result.checks.security` DEVE ser definido (não `undefined`) para qualquer nível de validação.

Formalmente: `∀ level ∈ {'basic', 'standard', 'thorough'}: result.checks.security !== undefined`

### P5 — pacotes com warnings → Issue severity warning, não error

Pacotes com `deprecated === true` ou `maintained === false` mas `safe === true` DEVEM gerar Issue com `severity: 'warning'`, não `'error'`.

Formalmente: `safe === true ∧ warnings.length > 0 → ∃ issue: issue.severity === 'warning' ∧ ¬∃ issue: issue.type === 'SECURITY_VULNERABILITY' ∧ issue.severity === 'error'`

---

## Error Handling

| Cenário | Comportamento |
|---|---|
| `package.json` não encontrado | Log `warn`, usar apenas pacotes de `ghostPackages` + `vulnerabilities` |
| `package.json` com JSON inválido | Log `warn`, usar apenas pacotes de `ghostPackages` + `vulnerabilities` |
| `SecurityValidator.validate()` lança exceção | Log `warn`, continuar para próximo pacote, pacote não incluído em `packageResults` |
| Nenhum pacote encontrado | `securityResult` com `passed: true` e todas as listas vazias |
| Pacote com `safe === false` | Issue `SECURITY_VULNERABILITY` com `severity: 'error'`, sem Issue de warning duplicado |
| Pacote com `safe === true` e warnings | Issue `SECURITY_WARNING` com `severity: 'warning'` |

---

## Implementation Notes

- O `SecurityValidator` já implementa toda a lógica de verificação internamente. O `ValidationEngine` apenas o orquestra.
- O `SecurityCheckResult` existente em `types.ts` tem estrutura diferente (`vulnerabilities: Vulnerability[]`, `warnings: string[]`, `licenseIssues: string[]`). Precisa ser substituído pela nova estrutura com `packageResults: SecurityValidationResult[]` e listas de nomes de pacotes.
- O import de `SecurityValidationResult` em `types.ts` cria uma dependência de `src/security/SecurityValidator.ts`. Alternativa: redeclarar a interface em `types.ts` e importar de lá no `SecurityValidator`. A abordagem mais simples é importar diretamente de `SecurityValidator.ts`.
- O `DependencyValidator` continua gerando seus próprios Issues via `npm audit` — o `SecurityValidator` é complementar, verificando a lista hardcoded de CVEs e metadados de pacotes.
- A variável `securityResult` é declarada e populada antes do bloco de runtime para que esteja disponível na construção do `ValidationResult` independentemente do nível.
- O `CLIReporter` já possui bloco `if (result.checks.security)` — nenhuma alteração necessária.

### Estrutura de arquivos

| Arquivo | Status | Descrição |
|---|---|---|
| `src/validate/types.ts` | Modificado | Atualiza `SecurityCheckResult`, adiciona import de `SecurityValidationResult` |
| `src/validate/ValidationEngine.ts` | Modificado | Instancia `SecurityValidator`, coleta pacotes, invoca em todos os níveis, popula `checks.security` |
| `src/security/SecurityValidator.ts` | Sem alteração | Já implementado |
| `tests/validate/ValidationEngine.security.test.ts` | Novo | Testes unitários para a integração |
