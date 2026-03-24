# Design Document

## Overview

Adição de feedback visual ao comando `validate` do CLI do EscapeKit. A mudança introduz um novo arquivo `src/cli/Spinner.ts` com uma classe `Spinner` autocontida, e modifica `src/cli/index.ts` para exibir mensagens de fase, animar o spinner e exibir um resumo final compacto. Nenhuma dependência externa é adicionada. O `Silent_Mode` (ativo com `--json` ou `--quiet`) suprime todo o output de progresso, preservando o comportamento existente dos reporters.

---

## Architecture

### Componentes Envolvidos

```
src/cli/index.ts  (comando validate)
    │
    ├── isJsonMode / isQuietMode  →  Silent_Mode
    │
    ├── [SE NÃO Silent_Mode]
    │       ├── process.stdout.write("🔍 Validating project...\n")
    │       ├── Spinner.start("  ⏳ Checking build...")
    │       │       └── setInterval(80ms) → process.stdout.write(frame + msg)
    │       ├── Spinner.stop()  →  ANSI_Clear
    │       └── process.stdout.write("  ✅ Build passed (2.3s)\n")
    │
    ├── ValidationEngine.validate()  →  ValidationResult
    │
    ├── [SE NÃO Silent_Mode]
    │       └── buildSummaryLine(result)  →  process.stdout.write(summaryLine)
    │
    ├── reporter?.report(result)
    │
    └── process.exit(result.canDeploy ? 0 : 1)

src/cli/Spinner.ts  (novo)
    └── class Spinner
            ├── start(message: string): void
            ├── stop(): void
            └── private frameIndex, intervalId
```

### Fluxo do Comando Validate (após a mudança)

```
action(projectPath, options)
    │
    ├─ 1. resolve e verifica projectPath (existente)
    ├─ 2. detecta Silent_Mode = options.json || options.quiet
    ├─ 3. suprime stdout se Silent_Mode (existente)
    │
    ├─ 4. [NOVO] se não Silent_Mode: exibe "🔍 Validating project..."
    │
    ├─ 5. engine.validate(...)  →  result
    │       (o spinner é controlado externamente via callbacks de fase — ver seção abaixo)
    │
    ├─ 6. restaura stdout (existente)
    │
    ├─ 7. [NOVO] se não Silent_Mode: exibe Phase_Messages com duração de cada check
    │
    ├─ 8. [NOVO] se não Silent_Mode: exibe Summary_Line
    │
    ├─ 9. reporter?.report(result)  (existente, via selectReporter)
    │
    └─ 10. process.exit(result.canDeploy ? 0 : 1)
```

---

## Detailed Design

### 1. Classe `Spinner` (`src/cli/Spinner.ts`)

```typescript
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;
const ANSI_CLEAR = '\r\x1b[K';

export class Spinner {
  private frameIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private message = '';

  start(message: string): void {
    if (this.intervalId !== null) {
      this.stop();
    }
    this.message = message;
    this.frameIndex = 0;
    this.intervalId = setInterval(() => {
      const frame = FRAMES[this.frameIndex % FRAMES.length];
      process.stdout.write(`${ANSI_CLEAR}${frame} ${this.message}`);
      this.frameIndex++;
    }, INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    process.stdout.write(ANSI_CLEAR);
  }
}
```

Pontos de design:
- `stop()` é idempotente: chamadas múltiplas não causam efeito adicional após a primeira.
- `start()` chamado enquanto ativo para o intervalo anterior antes de criar um novo — sem duplo intervalo.
- Nenhuma dependência externa. Apenas APIs nativas do Node.js.

### 2. Estratégia de Exibição das Fases

A `ValidationEngine` não expõe callbacks de progresso. A abordagem adotada é exibir as mensagens de fase **após** a conclusão da validação, usando os dados de `result.checks` e os timestamps de início/fim de cada check.

O `ValidationResult.checks` contém objetos com `passed`, `duration` (em ms) e `name` para cada fase executada. O CLI itera sobre esses checks após `engine.validate()` retornar e exibe as mensagens retroativamente.

Durante a execução da `ValidationEngine`, um spinner genérico `"  ⏳ Running validation..."` é exibido para indicar atividade. Ao final, o spinner é parado e as mensagens de fase são exibidas em sequência com suas durações reais.

```typescript
// Durante a validação
if (!isJsonMode) {
  spinner.start('Running validation...');
}

const result = await engine.validate(resolvedPath, { ... });

if (!isJsonMode) {
  spinner.stop();

  // Exibir fases retroativamente
  for (const [key, check] of Object.entries(result.checks)) {
    if (!check) continue;
    const icon = check.passed ? '✅' : '❌';
    const status = check.passed ? 'passed' : 'failed';
    const dur = ((check.duration ?? 0) / 1000).toFixed(1);
    const label = PHASE_LABELS[key] ?? key;
    process.stdout.write(`  ${icon} ${label} ${status} (${dur}s)\n`);
  }
}
```

Mapeamento de labels de fase:

```typescript
const PHASE_LABELS: Record<string, string> = {
  build:        'Build',
  dependencies: 'Dependencies',
  runtime:      'Runtime',
  security:     'Security',
  webgl:        'WebGL',
};
```

### 3. Função `buildSummaryLine`

```typescript
function buildSummaryLine(result: ValidationResult): string {
  const errors   = result.remainingIssues.filter(i => i.severity === 'error').length;
  const warnings = result.remainingIssues.filter(i => i.severity === 'warning').length;
  const duration = (result.duration / 1000).toFixed(1);
  const icon     = result.canDeploy ? '✅' : '❌';
  const status   = result.canDeploy ? 'Validation complete' : 'Validation failed';
  return `${icon} ${status} — ${errors} errors, ${warnings} warnings (${duration}s)\n`;
}
```

Chamada no CLI:

```typescript
if (!isJsonMode) {
  process.stdout.write(buildSummaryLine(result));
}
```

### 4. Integração no Action do Validate

Trecho completo da seção modificada (entre a restauração do stdout e o `process.exit`):

```typescript
// Restaura stdout
process.stdout.write = originalWrite;

// [NOVO] Exibir fases e resumo
if (!isJsonMode) {
  for (const [key, check] of Object.entries(result.checks)) {
    if (!check) continue;
    const icon  = check.passed ? '✅' : '❌';
    const label = PHASE_LABELS[key] ?? key;
    const dur   = ((check.duration ?? 0) / 1000).toFixed(1);
    process.stdout.write(`  ${icon} ${label} ${check.passed ? 'passed' : 'failed'} (${dur}s)\n`);
  }
  process.stdout.write(buildSummaryLine(result));
}

// Enriquecimento acadêmico (existente)
if (options.academic) { ... }

// Reporter (existente via selectReporter)
const reporter = selectReporter(options);
if (reporter) { ... }

process.exit(result.canDeploy ? 0 : 1);
```

### 5. Tratamento de Exceções

O spinner é parado no bloco `catch` existente:

```typescript
} catch (error) {
  spinner.stop();  // [NOVO] garante limpeza da linha
  process.stdout.write = originalWrite;  // existente
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
```

O `Spinner` é instanciado fora do `try/catch` para que `spinner.stop()` seja acessível no `catch`. Em `Silent_Mode`, o spinner nunca é iniciado, então `stop()` é chamado mas não faz nada (idempotente).

### 6. Posicionamento do Spinner no Fluxo

```typescript
const spinner = new Spinner();

// Antes da validação
if (!isJsonMode) {
  process.stdout.write('🔍 Validating project...\n');
  spinner.start('Running validation...');
}

// Supressão de stdout para a ValidationEngine (existente)
if (isJsonMode) {
  process.stdout.write = () => true;
}

const result = await engine.validate(...);

// Restaura stdout
process.stdout.write = originalWrite;

// Para o spinner e exibe fases
if (!isJsonMode) {
  spinner.stop();
  // ... exibe fases e resumo
}
```

Nota: a supressão de stdout (`process.stdout.write = () => true`) ocorre **após** o spinner ser iniciado, pois o spinner precisa escrever antes da supressão. Em `Silent_Mode`, o spinner nunca é iniciado, então a supressão não interfere.

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são suficientes:

- `ValidationResult.checks` — objeto com chaves de fase e valores `{ passed: boolean, duration?: number }`.
- `ValidationResult.remainingIssues` — array de `Issue` com campo `severity`.
- `ValidationResult.duration` — duração total em ms.
- `ValidationResult.canDeploy` — booleano que determina o ícone do resumo.

### Verificação do Tipo `checks`

O campo `result.checks` precisa ser verificado para confirmar a estrutura exata. Se `duration` não estiver disponível por check, o CLI usa `0` como fallback e omite a duração da linha de fase.

---

## Error Handling

| Situação | Comportamento |
|---|---|
| `engine.validate()` lança exceção | `spinner.stop()` → restaura stdout → `console.error` → `process.exit(1)` |
| `spinner.stop()` chamado sem `start()` | Idempotente, não faz nada |
| `spinner.start()` chamado duas vezes | Para o intervalo anterior, inicia novo |
| `result.checks` não tem campo `duration` | Usa `0` como fallback, exibe `(0.0s)` |
| `Silent_Mode` ativo | Spinner nunca iniciado, nenhum output de progresso |

---

## Testing Strategy

### Arquivos de Testes

- `tests/cli/Spinner.test.ts` — testes unitários da classe `Spinner`

### Abordagem para o Spinner

Usar `vi.useFakeTimers()` do Vitest para controlar o `setInterval` sem esperar tempo real. Mockar `process.stdout.write` para capturar o output sem escrever no terminal.

### Casos de Teste — Spinner

1. **start() inicia o intervalo**: após `vi.advanceTimersByTime(80)`, `process.stdout.write` foi chamado com um frame de `Spinner_Frames`.
2. **stop() limpa a linha**: após `stop()`, `process.stdout.write` foi chamado com `ANSI_CLEAR`.
3. **stop() antes de start()**: não lança exceção, não chama `process.stdout.write`.
4. **ciclo de frames**: após 10 ticks, o frame volta ao índice 0.
5. **start() duplo**: apenas um intervalo ativo; `clearInterval` chamado uma vez antes do segundo `start()`.
6. **stop() múltiplos**: `clearInterval` chamado apenas uma vez (idempotência).

### Casos de Teste — Integração CLI (em `tests/cli/validate.test.ts` existente ou novo)

7. **Silent_Mode com --json**: output capturado não contém nenhum caractere de `Spinner_Frames`.
8. **Silent_Mode com --quiet**: output capturado não contém nenhum caractere de `Spinner_Frames`.
9. **Summary_Line com canDeploy: true**: output contém `"✅ Validation complete"`.
10. **Summary_Line com canDeploy: false**: output contém `"❌ Validation failed"`.
11. **Contagem de erros e warnings no resumo**: para `result` com 3 errors e 1 warning, o resumo contém `"3 errors, 1 warning"`.

### Correctness Properties (PBT)

- **P1**: Para qualquer execução com `--json`, nenhum caractere de `Spinner_Frames` aparece no output de `process.stdout`.
- **P2**: Para qualquer execução com `--quiet`, nenhum caractere de `Spinner_Frames` aparece no output de `process.stdout`.
- **P3**: Para qualquer `ValidationResult`, `buildSummaryLine(result)` contém exatamente `result.remainingIssues.filter(i => i.severity === 'error').length` erros e `result.remainingIssues.filter(i => i.severity === 'warning').length` warnings.
- **P4**: Para qualquer sequência de chamadas `start()`/`stop()`, o número de chamadas a `clearInterval` é igual ao número de chamadas a `setInterval` (sem vazamento de recursos).

---

## Implementation Notes

- O `Spinner` deve ser instanciado uma única vez por execução do comando `validate`, fora do `try/catch`, para garantir acesso no `catch`.
- A supressão de stdout (`process.stdout.write = () => true`) já existente no CLI ocorre após o início do spinner — isso é intencional: o spinner precisa escrever a mensagem inicial antes da supressão entrar em vigor. Em `Silent_Mode`, o spinner nunca é iniciado, então não há conflito.
- O campo `result.checks` deve ser inspecionado no código real de `ValidationEngine` para confirmar a estrutura exata antes da implementação. Se `duration` não existir por check, o CLI deve omitir a duração ou usar `result.duration` dividido pelo número de checks como estimativa.
- Não modificar `CLIReporter`, `JSONReporter` nem `ValidationEngine` — todas as mudanças ficam em `src/cli/index.ts` e no novo `src/cli/Spinner.ts`.
- O output do spinner usa `process.stdout.write` diretamente (não `console.log`) para permitir o uso de `\r` e `ANSI_CLEAR` sem quebra de linha indesejada.
