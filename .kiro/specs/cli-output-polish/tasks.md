# Implementation Plan

## Tasks

- [ ] 1. Criar a classe `Spinner` em `src/cli/Spinner.ts`
  - Definir constantes `FRAMES`, `INTERVAL_MS = 80` e `ANSI_CLEAR = '\r\x1b[K'` no topo do arquivo
  - Implementar `start(message: string): void` que para intervalo anterior (se ativo) e inicia novo `setInterval` de 80ms
  - Implementar `stop(): void` que chama `clearInterval`, limpa `intervalId` para `null` e escreve `ANSI_CLEAR` em `process.stdout`
  - Garantir que `stop()` chamado sem `start()` prévio não lança exceção (verificar `intervalId !== null`)
  - Garantir que `start()` chamado duas vezes consecutivas não cria dois intervalos simultâneos
  - Arquivo: `src/cli/Spinner.ts`

- [ ] 2. Criar testes unitários para o `Spinner`
  - Criar `tests/cli/Spinner.test.ts`
  - Usar `vi.useFakeTimers()` para controlar `setInterval` sem esperar tempo real
  - Mockar `process.stdout.write` com `vi.spyOn` para capturar output sem escrever no terminal
  - Testar: `start()` → após `vi.advanceTimersByTime(80)` → `process.stdout.write` chamado com frame de `FRAMES`
  - Testar: `stop()` → `process.stdout.write` chamado com `ANSI_CLEAR`
  - Testar: `stop()` antes de `start()` → sem exceção, sem escrita em stdout
  - Testar: após 10 ticks, frame retorna ao índice 0 (ciclo correto)
  - Testar: `start()` duplo → apenas um intervalo ativo (P4 — sem vazamento)
  - Testar: `stop()` múltiplos → `clearInterval` chamado apenas uma vez por par `start/stop`
  - Arquivo: `tests/cli/Spinner.test.ts`

- [ ] 3. Escrever property-based tests para o `Spinner` (P4)
  - No mesmo arquivo `tests/cli/Spinner.test.ts`, adicionar testes PBT com fast-check
  - P4: para qualquer sequência de N chamadas `start()`/`stop()`, o número de chamadas a `clearInterval` é igual ao número de chamadas a `setInterval` (sem vazamento de recursos)
  - Arquivo: `tests/cli/Spinner.test.ts`

- [ ] 4. Inspecionar `ValidationResult.checks` para confirmar estrutura de duração por fase
  - Ler `src/validate/types.ts` e `src/validate/ValidationEngine.ts` para verificar se `checks` expõe `duration` por fase
  - Se `duration` por fase não existir, documentar o fallback a usar (ex.: `result.duration / Object.keys(result.checks).length`)
  - Registrar a estrutura exata de `checks` como comentário no início da seção de fases em `src/cli/index.ts`
  - Arquivos: `src/validate/types.ts`, `src/validate/ValidationEngine.ts` (leitura), `src/cli/index.ts` (comentário)

- [ ] 5. Adicionar import do `Spinner` e constantes de fase ao `src/cli/index.ts`
  - Adicionar `import { Spinner } from './Spinner.js'` no topo do arquivo
  - Adicionar constante `PHASE_LABELS: Record<string, string>` com mapeamento de chaves de `checks` para labels legíveis
  - Adicionar função auxiliar `buildSummaryLine(result: ValidationResult): string` que calcula erros, warnings e duração
  - Arquivo: `src/cli/index.ts`

- [ ] 6. Integrar spinner e mensagem inicial no action do `validate`
  - Instanciar `const spinner = new Spinner()` antes do bloco `try/catch`
  - Após verificação do `projectPath` e antes da supressão de stdout, adicionar: `if (!isJsonMode) { process.stdout.write('🔍 Validating project...\n'); spinner.start('Running validation...'); }`
  - No bloco `catch`, adicionar `spinner.stop()` antes de `process.stdout.write = originalWrite`
  - Arquivo: `src/cli/index.ts`

- [ ] 7. Exibir mensagens de fase e resumo após `engine.validate()`
  - Após restaurar `process.stdout.write = originalWrite`, adicionar bloco `if (!isJsonMode)`
  - Dentro do bloco: chamar `spinner.stop()`, iterar sobre `Object.entries(result.checks)` e exibir linha de fase para cada check presente
  - Após as fases: chamar `process.stdout.write(buildSummaryLine(result))`
  - Garantir que o bloco de fases e resumo fica antes do bloco de enriquecimento acadêmico e antes do `reporter?.report(result)`
  - Arquivo: `src/cli/index.ts`

- [ ] 8. Verificar diagnósticos após as mudanças
  - Executar `getDiagnostics` em `src/cli/index.ts` e `src/cli/Spinner.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos
  - Verificar que o import de `Spinner` usa extensão `.js` (ESM)

- [ ] 9. Escrever testes de integração do CLI para P1, P2 e P3
  - Criar ou estender `tests/cli/validate.test.ts`
  - Mockar `ValidationEngine.validate` para retornar `ValidationResult` controlados
  - Mockar `process.stdout.write` para capturar todo output emitido durante a execução
  - P1: com `--json`, nenhum caractere de `FRAMES` aparece no output capturado
  - P2: com `--quiet`, nenhum caractere de `FRAMES` aparece no output capturado
  - P3 (exemplo): com `canDeploy: true`, 3 errors e 1 warning, o resumo contém `"3 errors, 1 warning"`
  - P3 (PBT): para qualquer `ValidationResult` gerado por fast-check, `buildSummaryLine` contém o número correto de erros e warnings
  - Arquivo: `tests/cli/validate.test.ts`
