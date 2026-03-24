# Design Document

## Overview

Transformação do bloco de auto-fix do `ValidationEngine` de uma passagem única para um loop iterativo com condições de parada configuráveis. A mudança é cirúrgica: apenas `src/validate/types.ts` (dois campos novos) e `src/validate/ValidationEngine.ts` (refatoração do bloco `if (opts.autoFix)`) são modificados. Nenhum outro componente requer alteração.

---

## Architecture

### Componentes Envolvidos

```
ValidationEngine.validate(projectPath, options)
    │
    ├─ 1. Validação inicial (BuildValidator + DependencyValidator + Environment)
    │
    └─ 2. Loop iterativo de auto-fix  ← NOVO
            │
            ├─ Iteração N:
            │   ├─ AutoFixEngine.fix(projectPath, errorIssues)
            │   ├─ Acumula fixes aplicados
            │   ├─ BuildValidator.validate(projectPath)      ← revalida
            │   └─ DependencyValidator.validate(projectPath) ← revalida
            │
            └─ Condições de parada:
                ├─ Sem issues com severity === 'error'
                ├─ Nenhum fix aplicado na iteração (sem progresso)
                └─ iterationCount >= maxIterations (clampado em [1, 10])
```

### Fluxo Detalhado

```
validate(projectPath, options)
    │
    ├─ Coleta issues iniciais (build + deps + environment)
    │
    ├─ SE autoFix === false → retorna resultado sem loop (iterationCount: 0)
    │
    └─ SE autoFix === true:
        iterationCount = 0
        fixesApplied = []
        issues = [issues iniciais]

        ENQUANTO iterationCount < maxIterations:
            iterationCount++
            errorIssues = issues.filter(severity === 'error')
            SE errorIssues.length === 0 → break (sem erros)

            log.info(`Iteration ${iterationCount}: ${errorIssues.length} error(s) found`)
            fixes = await autoFixEngine.fix(projectPath, errorIssues)
            applied = fixes.filter(f.applied)
            fixesApplied.push(...applied)

            SE applied.length === 0:
                log.warn('No progress made, stopping loop')
                break

            issues = [] (revalida)
            reDep = await dependencyValidator.validate(projectPath)
            reBuild = await buildValidator.validate(projectPath)
            issues.push(...reDep issues, ...reBuild issues)

            log.info(`Iteration ${iterationCount} done: ${applied.length} fix(es), ${issues.filter(error).length} error(s) remaining`)

        SE iterationCount === maxIterations E issues.filter(error).length > 0:
            log.warn(`Max iterations reached, ${n} error(s) remaining`)

        retorna resultado com iterationCount
```

---

## Detailed Design

### 1. Alterações em `src/validate/types.ts`

#### `ValidationOptions` — campo novo

```typescript
export interface ValidationOptions {
  environment: ValidationEnvironment;
  level: ValidationLevel;
  autoFix: boolean;
  timeout: number;
  fuzzyThreshold?: number;
  maxIterations?: number; // NOVO — padrão: 3, mínimo: 1, máximo: 10
}
```

#### `ValidationResult` — campo novo

```typescript
export interface ValidationResult {
  canDeploy: boolean;
  confidence: number;
  duration: number;
  checks: { ... }; // sem alteração
  fixesApplied: Fix[];
  remainingIssues: Issue[];
  recommendations: string[];
  iterationCount: number; // NOVO — 0 quando autoFix: false
}
```

### 2. Alterações em `src/validate/ValidationEngine.ts`

#### Constante de clamp

```typescript
const MAX_ITERATIONS_LIMIT = 10;
const MIN_ITERATIONS_LIMIT = 1;
const DEFAULT_MAX_ITERATIONS = 3;
```

#### Método auxiliar `clampIterations`

```typescript
private clampIterations(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_ITERATIONS;
  return Math.min(MAX_ITERATIONS_LIMIT, Math.max(MIN_ITERATIONS_LIMIT, value));
}
```

#### Refatoração do bloco de auto-fix

O bloco `if (opts.autoFix && issues.length > 0)` é substituído pelo loop abaixo. O restante do método `validate` permanece inalterado.

```typescript
let iterationCount = 0;

if (opts.autoFix) {
  const maxIter = this.clampIterations(opts.maxIterations);

  while (iterationCount < maxIter) {
    const errorIssues = issues.filter(i => i.severity === 'error');
    if (errorIssues.length === 0) break;

    iterationCount++;
    this.log.info(`Auto-fix iteration ${iterationCount}/${maxIter}: ${errorIssues.length} error(s) found`);

    const fixes = await this.autoFixEngine.fix(projectPath, errorIssues);
    const applied = fixes.filter(f => f.applied);
    fixesApplied.push(...applied);

    if (applied.length === 0) {
      this.log.warn(`Auto-fix iteration ${iterationCount}: no progress made, stopping loop`);
      break;
    }

    issues.length = 0;
    const reDep = await this.dependencyValidator.validate(projectPath);
    for (const ghost of reDep.ghostPackages) {
      issues.push({
        type: 'GHOST_IMPORT',
        severity: 'error',
        message: `Ghost package still present: ${ghost.name}`,
        file: ghost.file,
        line: ghost.line,
        detector: 'DependencyValidator',
      });
    }
    for (const vuln of reDep.vulnerabilities) {
      issues.push({
        type: vuln.severity === 'critical' ? 'SECURITY_VULNERABILITY' : 'SECURITY_WARNING',
        severity: vuln.severity === 'critical' ? 'error' : 'warning',
        message: `${vuln.severity}: ${vuln.title} (${vuln.name})`,
        suggestion: vuln.fixAvailable ? 'Run npm audit fix' : undefined,
        detector: 'DependencyValidator',
      });
    }
    const reBuild = await this.buildValidator.validate(projectPath);
    for (const err of reBuild.errors) {
      issues.push({ ...err, detector: 'BuildValidator' });
    }

    const remainingErrors = issues.filter(i => i.severity === 'error').length;
    this.log.info(`Auto-fix iteration ${iterationCount} complete: ${applied.length} fix(es) applied, ${remainingErrors} error(s) remaining`);
  }

  const remainingErrors = issues.filter(i => i.severity === 'error').length;
  if (iterationCount === maxIter && remainingErrors > 0) {
    this.log.warn(`Auto-fix reached max iterations (${maxIter}), ${remainingErrors} error(s) remaining`);
  }
}
```

#### Campo `iterationCount` no resultado

```typescript
const result: ValidationResult = {
  canDeploy,
  confidence,
  duration,
  checks: { ... },
  fixesApplied,
  remainingIssues: issues,
  recommendations: this.generateRecommendations(issues),
  iterationCount, // NOVO
};
```

---

## Data Models

### Campos novos em `ValidationOptions`

| Campo | Tipo | Obrigatório | Padrão | Restrições |
|---|---|---|---|---|
| `maxIterations` | `number` | não | `3` | clampado em `[1, 10]` |

### Campos novos em `ValidationResult`

| Campo | Tipo | Valor quando `autoFix: false` | Valor quando `autoFix: true` |
|---|---|---|---|
| `iterationCount` | `number` | `0` | número de iterações executadas |

---

## Error Handling

| Situação | Comportamento |
|---|---|
| `maxIterations` < 1 | Clampado para `1` silenciosamente |
| `maxIterations` > 10 | Clampado para `10` silenciosamente |
| `maxIterations` não fornecido | Usa padrão `3` |
| `autoFix: false` | Loop não executa, `iterationCount: 0` |
| Nenhum progresso na iteração | Log `warn`, loop encerra com `break` |
| Limite de iterações atingido com erros restantes | Log `warn` com contagem de erros |
| Exceção em `autoFixEngine.fix` | Propaga normalmente (comportamento atual) |
| Exceção em `buildValidator.validate` ou `dependencyValidator.validate` | Propaga normalmente (comportamento atual) |

---

## Testing Strategy

### Testes Unitários

Arquivo: `tests/validate/ValidationEngine.loop.test.ts`

Todos os testes mockam `AutoFixEngine`, `BuildValidator` e `DependencyValidator` para controlar o comportamento sem I/O real.

**Condições de parada:**
1. Loop encerra quando não há issues com `severity === 'error'` após uma iteração
2. Loop encerra quando nenhum fix é aplicado (sem progresso)
3. Loop encerra ao atingir `maxIterations`
4. `autoFix: false` → nenhuma iteração executada, `iterationCount: 0`

**`maxIterations` e clamp:**
5. `maxIterations` não fornecido → usa padrão `3`
6. `maxIterations: 0` → clampado para `1`, executa no máximo 1 iteração
7. `maxIterations: 15` → clampado para `10`, executa no máximo 10 iterações
8. `maxIterations: 2` → loop executa no máximo 2 iterações

**`iterationCount`:**
9. `autoFix: false` → `iterationCount === 0`
10. Loop encerra na 1ª iteração (sem erros) → `iterationCount === 1`
11. Loop executa 3 iterações até atingir `maxIterations` → `iterationCount === 3`
12. Loop encerra na 2ª iteração por falta de progresso → `iterationCount === 2`

**Acumulação de fixes:**
13. Fixes de múltiplas iterações são acumulados em `fixesApplied` na ordem correta
14. `remainingIssues` reflete apenas os issues da última iteração

**Logs:**
15. Log `info` emitido no início de cada iteração com número e contagem de erros
16. Log `info` emitido ao final de cada iteração com fixes aplicados e erros restantes
17. Log `warn` emitido quando loop encerra por falta de progresso
18. Log `warn` emitido quando loop encerra por atingir `maxIterations` com erros restantes

**Compatibilidade:**
19. Resultado com `autoFix: false` contém todos os campos existentes mais `iterationCount: 0`
20. Resultado com `autoFix: true` contém todos os campos existentes mais `iterationCount >= 1`

### Correctness Properties

1. **Terminação garantida**: para qualquer sequência de respostas dos validators e do autoFixEngine, o loop sempre termina — `iterationCount <= maxIterations` é invariante.
2. **Monotonicidade de `fixesApplied`**: `fixesApplied.length` nunca decresce entre iterações — `f(n+1).fixesApplied.length >= f(n).fixesApplied.length`.
3. **Idempotência de `autoFix: false`**: o resultado com `autoFix: false` é idêntico ao resultado atual sem o loop — nenhum campo existente muda de semântica.
4. **Invariante de `iterationCount`**: `iterationCount === 0` se e somente se `autoFix === false` ou não há issues com `severity === 'error'` antes do loop iniciar.
5. **Clamp de `maxIterations`**: para qualquer valor de `maxIterations` fornecido, `iterationCount <= 10` é sempre verdadeiro.
