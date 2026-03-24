# Design Document

## Overview

Conexão do `CLIReporter` e `JSONReporter` ao comando `validate` do CLI. A mudança é cirúrgica: após `engine.validate()`, o CLI seleciona o reporter correto com base nas opções (`--json`, `--quiet`) e invoca `reporter.report(result)` dentro de um bloco `try/catch` independente, garantindo que falhas no reporter nunca alterem o exit code. O `ValidationReporter` composto já existente não é usado diretamente — o CLI instancia os reporters concretos para ter controle total sobre o fluxo de erros.

---

## Architecture

### Componentes Envolvidos

```
src/cli/index.ts  (comando validate)
    │
    ├── ValidationEngine.validate()  →  ValidationResult
    │
    ├── selectReporter(options)      →  Reporter | null
    │       ├── --quiet              →  null
    │       ├── --json               →  JSONReporter
    │       └── default              →  CLIReporter
    │
    ├── reporter?.report(result)     (try/catch independente)
    │
    └── process.exit(result.canDeploy ? 0 : 1)
```

### Fluxo do Comando Validate (após a mudança)

```
action(projectPath, options)
    │
    ├─ 1. resolve e verifica projectPath (existente)
    ├─ 2. suprime stdout se isJsonMode (existente)
    ├─ 3. engine.validate(...)  →  result
    ├─ 4. restaura stdout (existente)
    ├─ 5. enriquece issues com --academic (existente)
    │
    ├─ 6. [NOVO] selectReporter(options)  →  reporter | null
    │
    ├─ 7. [NOVO] if (reporter) {
    │       try { await reporter.report(result) }
    │       catch (err) { console.error('Reporter error:', err) }
    │     }
    │
    └─ 8. process.exit(result.canDeploy ? 0 : 1)
```

---

## Detailed Design

### 1. Função `selectReporter`

Função auxiliar local no arquivo `src/cli/index.ts`, sem necessidade de arquivo separado:

```typescript
function selectReporter(options: { json?: boolean; quiet?: boolean }): Reporter | null {
  if (options.quiet) return null;
  if (options.json) return new JSONReporter();
  return new CLIReporter();
}
```

A precedência `quiet > json > cli` é implementada pela ordem dos guards. Quando `--quiet` e `--json` são fornecidos simultaneamente, `quiet` vence e nenhum reporter é instanciado.

### 2. Integração no Action do Comando Validate

O trecho a ser adicionado fica entre o bloco de enriquecimento acadêmico e o `process.exit`:

```typescript
// [NOVO] Selecionar e invocar reporter
const reporter = selectReporter(options);
if (reporter) {
  try {
    await reporter.report(result);
  } catch (reporterErr) {
    console.error('Reporter error:', reporterErr instanceof Error ? reporterErr.message : reporterErr);
  }
}

process.exit(result.canDeploy ? 0 : 1);
```

### 3. Interação com o Modo JSON Existente

O CLI já possui lógica para suprimir stdout durante a validação quando `--json` ou `--quiet` estão ativos:

```typescript
const isJsonMode = options.json || options.quiet;
if (isJsonMode) {
  process.stdout.write = () => true;  // suprime logs da ValidationEngine
}
// ... engine.validate() ...
process.stdout.write = originalWrite;  // restaura antes do reporter
```

Com a mudança, o `JSONReporter` escreve em `process.stdout` após a restauração — o comportamento está correto. O bloco de supressão existente não precisa ser alterado.

O bloco `if (options.json) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); }` existente deve ser **removido**, pois o `JSONReporter` assume essa responsabilidade.

### 4. Opção --quiet

A opção `--quiet` já está declarada no comando `validate` (`src/cli/index.ts` linha `.option('--quiet', 'Suppress verbose output', false)`). Não é necessário adicionar a declaração — apenas usar `options.quiet` na lógica de seleção do reporter.

### 5. Imports Necessários

Adicionar ao topo do arquivo (imports dinâmicos já são usados no CLI, mas os reporters podem ser importados estaticamente):

```typescript
import { CLIReporter } from '../validate/reporters/CLIReporter.js';
import { JSONReporter } from '../validate/reporters/JSONReporter.js';
import type { Reporter } from '../validate/types.js';
```

Alternativamente, usar imports dinâmicos dentro do action para manter consistência com o padrão existente do arquivo:

```typescript
const { CLIReporter } = await import('../validate/reporters/CLIReporter.js');
const { JSONReporter } = await import('../validate/reporters/JSONReporter.js');
```

A abordagem de import dinâmico é preferida para manter consistência com o padrão já adotado no arquivo para `ValidationEngine`, `KnowledgeBase` e outros módulos.

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são suficientes:

- `ValidationResult` (de `src/validate/types.ts`) — passado diretamente ao reporter.
- `Reporter` (de `src/validate/types.ts`) — interface implementada por `CLIReporter` e `JSONReporter`.

---

## Error Handling

| Situação | Comportamento |
|---|---|
| `reporter.report(result)` lança exceção | Log `console.error`, exit code determinado por `result.canDeploy` |
| `engine.validate()` lança exceção | Comportamento existente: `console.error` + `process.exit(1)` |
| `--quiet` + `--json` simultâneos | Modo `--quiet` vence, nenhum reporter instanciado |
| `projectPath` não encontrado | Comportamento existente: `console.error` + `process.exit(1)` |

---

## Testing Strategy

### Arquivo de Testes

`tests/cli/validate.test.ts`

### Abordagem

Mockar `ValidationEngine.validate` para retornar `ValidationResult` controlados, e mockar `process.stdout.write` e `process.exit` para capturar output e exit code sem executar o processo real.

### Casos de Teste

1. **CLIReporter invocado por padrão**: sem opções especiais, verificar que `CLIReporter.report` é chamado com o `result` correto.
2. **JSONReporter invocado com --json**: verificar que `JSONReporter.report` é chamado e que o output é JSON válido.
3. **Nenhum reporter com --quiet**: verificar que `process.stdout.write` não é chamado pelo reporter.
4. **Exit code 0 com canDeploy: true**: para qualquer reporter, verificar `process.exit(0)`.
5. **Exit code 1 com canDeploy: false**: para qualquer reporter, verificar `process.exit(1)`.
6. **Exceção no reporter não altera exit code**: `reporter.report` lança erro, exit code ainda é `0` ou `1` conforme `canDeploy`.
7. **--quiet + --json simultâneos**: nenhum reporter instanciado, exit code correto.

### Correctness Properties (PBT)

As propriedades abaixo devem ser verificadas com fast-check ou equivalente:

- **P1**: Para qualquer `ValidationResult` com `canDeploy: true`, o output capturado de `CLIReporter.report` contém `"Can Deploy: YES"`.
- **P2**: Para qualquer `ValidationResult` com `canDeploy: false`, o output capturado de `CLIReporter.report` contém `"Can Deploy: NO"`.
- **P3**: Para qualquer `ValidationResult`, `JSON.parse(output de JSONReporter.report)` não lança exceção.
- **P4**: Com `--quiet`, nenhum byte é escrito em `process.stdout` pelo reporter.
- **P5**: Para qualquer `ValidationResult` e qualquer exceção lançada pelo reporter, o exit code é `result.canDeploy ? 0 : 1`.

---

## Implementation Notes

- A remoção do bloco `if (options.json) { process.stdout.write(...) }` existente é necessária para evitar output duplicado quando `--json` está ativo.
- O bloco de exibição de referências acadêmicas no terminal (`if (options.academic && !options.json)`) deve ser mantido após o reporter, pois é output adicional ao relatório principal.
- O `JSONReporter` já aceita `output: 'stdout' | 'return'` no construtor; instanciar com o padrão `'stdout'` é suficiente.
- Nenhuma alteração é necessária em `CLIReporter`, `JSONReporter` ou `ValidationReporter`.
- O comando `generate` não tem o mesmo problema: ele já exibe output diretamente via `console.log` e não usa a interface `Reporter`.
