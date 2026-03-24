# Requirements Document

## Introduction

O comando `validate` do CLI do EscapeKit executa silenciosamente por vários segundos enquanto verifica build, dependências e runtime de projetos WebGL/3D. O usuário não recebe nenhum feedback visual durante esse período. Esta feature adiciona um spinner ASCII simples, mensagens de status por fase e um resumo final compacto ao comando `validate`, sem introduzir nenhuma dependência externa. O comportamento com `--json` e `--quiet` é preservado integralmente: nenhum caractere de progresso é emitido nesses modos.

## Glossary

- **CLI**: Interface de linha de comando do EscapeKit, implementada em `src/cli/index.ts`.
- **Spinner**: Componente em `src/cli/Spinner.ts` que exibe uma animação ASCII rotativa em `process.stdout` usando `setInterval`/`clearInterval` e códigos ANSI para limpar a linha.
- **Spinner_Frames**: Array de caracteres braille usados na animação: `['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']`.
- **Phase_Message**: Mensagem de status exibida antes e depois de cada fase de validação (ex.: `"  ⏳ Checking build..."`, `"  ✅ Build passed (2.3s)"`).
- **Summary_Line**: Linha de resumo exibida após todas as fases e antes do relatório completo do `CLIReporter` (ex.: `"✅ Validation complete — 0 errors, 2 warnings (7.2s)"`).
- **ValidationEngine**: Componente em `src/validate/ValidationEngine.ts` que executa a validação completa e retorna um `ValidationResult`.
- **ValidationResult**: Tipo em `src/validate/types.ts` que agrega o resultado completo da validação, incluindo `canDeploy`, `checks`, `remainingIssues` e `duration`.
- **CLIReporter**: Componente em `src/validate/reporters/CLIReporter.ts` que formata o `ValidationResult` para exibição no terminal.
- **Silent_Mode**: Estado ativo quando `--json` ou `--quiet` estão presentes. Nenhum output de progresso é emitido.
- **ANSI_Clear**: Sequência `\r\x1b[K` usada para apagar a linha atual do terminal antes de reescrever.

---

## Requirements

### Requirement 1: Spinner ASCII sem Dependências Externas

**User Story:** Como usuário do EscapeKit, quero ver um spinner animado durante operações longas do `validate`, para que eu saiba que o processo está em execução e não travado.

#### Acceptance Criteria

1. THE `Spinner` SHALL ser implementado em `src/cli/Spinner.ts` usando apenas `process.stdout.write`, `setInterval` e `clearInterval`, sem importar nenhum pacote externo.
2. WHEN `spinner.start(message)` for chamado, THE `Spinner` SHALL iniciar um `setInterval` com intervalo de 80ms que escreve o frame atual seguido do `message` em `process.stdout`, precedido de `ANSI_Clear`.
3. WHEN `spinner.stop()` for chamado, THE `Spinner` SHALL chamar `clearInterval`, escrever `ANSI_Clear` em `process.stdout` para limpar a linha do spinner, e não emitir nenhum outro caractere.
4. THE `Spinner` SHALL ciclar pelos `Spinner_Frames` em ordem, retornando ao primeiro frame após o último.
5. WHEN `spinner.stop()` for chamado antes de `spinner.start()`, THE `Spinner` SHALL não lançar exceção e não escrever nada em `process.stdout`.
6. WHEN `spinner.start()` for chamado enquanto o spinner já está ativo, THE `Spinner` SHALL parar o intervalo anterior antes de iniciar um novo.

---

### Requirement 2: Mensagens de Status por Fase

**User Story:** Como usuário do EscapeKit, quero ver mensagens de status para cada fase da validação, para que eu saiba qual etapa está sendo executada e quanto tempo cada uma levou.

#### Acceptance Criteria

1. WHEN o comando `validate` iniciar, THE `CLI` SHALL exibir `"🔍 Validating project..."` em `process.stdout` antes de invocar a `ValidationEngine`.
2. WHEN uma fase de validação iniciar, THE `CLI` SHALL exibir `"  ⏳ Checking <fase>..."` e iniciar o `Spinner` com essa mensagem.
3. WHEN uma fase de validação concluir com sucesso, THE `CLI` SHALL parar o `Spinner` e exibir `"  ✅ <Fase> passed (<duração>s)"` em `process.stdout`.
4. WHEN uma fase de validação concluir com falha, THE `CLI` SHALL parar o `Spinner` e exibir `"  ❌ <Fase> failed (<duração>s)"` em `process.stdout`.
5. THE `CLI` SHALL exibir mensagens de status para as fases `build`, `dependencies` e `runtime`, nessa ordem, quando cada uma estiver presente no `ValidationResult.checks`.
6. WHILE o `Silent_Mode` estiver ativo, THE `CLI` SHALL não exibir nenhuma mensagem de status de fase nem iniciar o `Spinner`.

---

### Requirement 3: Resumo Final Compacto

**User Story:** Como usuário do EscapeKit, quero ver um resumo de uma linha ao final da validação, para que eu possa avaliar o resultado rapidamente antes de ler o relatório completo.

#### Acceptance Criteria

1. WHEN a `ValidationEngine` concluir e `result.canDeploy` for `true`, THE `CLI` SHALL exibir `"✅ Validation complete — <N> errors, <M> warnings (<T>s)"` em `process.stdout` antes de invocar o `CLIReporter`.
2. WHEN a `ValidationEngine` concluir e `result.canDeploy` for `false`, THE `CLI` SHALL exibir `"❌ Validation failed — <N> errors, <M> warnings (<T>s)"` em `process.stdout` antes de invocar o `CLIReporter`.
3. THE `Summary_Line` SHALL calcular `<N>` como o número de itens em `result.remainingIssues` com `severity === 'error'`.
4. THE `Summary_Line` SHALL calcular `<M>` como o número de itens em `result.remainingIssues` com `severity === 'warning'`.
5. THE `Summary_Line` SHALL calcular `<T>` como `result.duration / 1000` formatado com uma casa decimal.
6. WHILE o `Silent_Mode` estiver ativo, THE `CLI` SHALL não exibir o `Summary_Line`.

---

### Requirement 4: Compatibilidade com --json e --quiet

**User Story:** Como engenheiro de DevOps, quero que as flags `--json` e `--quiet` suprimam completamente o output de progresso, para que scripts de CI não sejam poluídos por caracteres de spinner ou mensagens de status.

#### Acceptance Criteria

1. WHEN o comando `validate` for executado com `--json`, THE `CLI` SHALL não escrever nenhum caractere de `Spinner_Frames` em `process.stdout`.
2. WHEN o comando `validate` for executado com `--json`, THE `CLI` SHALL não escrever nenhuma `Phase_Message` em `process.stdout`.
3. WHEN o comando `validate` for executado com `--json`, THE `CLI` SHALL não escrever o `Summary_Line` em `process.stdout`.
4. WHEN o comando `validate` for executado com `--quiet`, THE `CLI` SHALL não escrever nenhum caractere de `Spinner_Frames` em `process.stdout`.
5. WHEN o comando `validate` for executado com `--quiet`, THE `CLI` SHALL não escrever nenhuma `Phase_Message` em `process.stdout`.
6. WHEN o comando `validate` for executado com `--quiet`, THE `CLI` SHALL não escrever o `Summary_Line` em `process.stdout`.
7. FOR ALL execuções com `--json` ou `--quiet`, o output escrito em `process.stdout` pelo reporter SHALL ser idêntico ao output produzido sem as melhorias de progresso desta feature.

---

### Requirement 5: Resiliência a Exceções

**User Story:** Como usuário do EscapeKit, quero que o spinner seja sempre encerrado corretamente, mesmo quando a validação lança uma exceção, para que o terminal não fique com o cursor preso em uma linha de spinner.

#### Acceptance Criteria

1. WHEN a `ValidationEngine.validate()` lançar uma exceção, THE `CLI` SHALL chamar `spinner.stop()` antes de propagar ou tratar o erro.
2. WHEN `spinner.stop()` for chamado após uma exceção, THE `CLI` SHALL limpar a linha do spinner em `process.stdout` antes de exibir a mensagem de erro.
3. THE `Spinner` SHALL garantir que `clearInterval` seja chamado exatamente uma vez por `stop()`, mesmo que `stop()` seja chamado múltiplas vezes consecutivas.
4. IF o `setInterval` do `Spinner` lançar uma exceção interna, THEN THE `Spinner` SHALL capturar a exceção e chamar `clearInterval` para evitar vazamento de recursos.

---

### Requirement 6: Testes Unitários do Spinner e do CLI

**User Story:** Como desenvolvedor do EscapeKit, quero que o `Spinner` e o comportamento de progresso do CLI sejam cobertos por testes automatizados, para que regressões sejam detectadas rapidamente.

#### Acceptance Criteria

1. THE `tests/cli/Spinner.test.ts` SHALL verificar que `spinner.start()` inicia o `setInterval` e escreve frames em `process.stdout`.
2. THE `tests/cli/Spinner.test.ts` SHALL verificar que `spinner.stop()` chama `clearInterval` e escreve `ANSI_Clear` em `process.stdout`.
3. THE `tests/cli/Spinner.test.ts` SHALL verificar que `spinner.stop()` chamado antes de `spinner.start()` não lança exceção.
4. THE `tests/cli/Spinner.test.ts` SHALL verificar que os frames ciclam corretamente após o último `Spinner_Frame`.
5. THE `tests/cli/Spinner.test.ts` SHALL verificar que `spinner.start()` chamado duas vezes consecutivas não cria dois intervalos simultâneos.
6. FOR ALL sequências de `start()`/`stop()`, o número de chamadas a `clearInterval` SHALL ser igual ao número de chamadas a `setInterval` (propriedade de correção P4 — sem vazamento de recursos).
7. FOR ALL execuções com `--json`, nenhum caractere de `Spinner_Frames` SHALL aparecer no output capturado de `process.stdout` (propriedade de correção P1).
8. FOR ALL execuções com `--quiet`, nenhum caractere de `Spinner_Frames` SHALL aparecer no output capturado de `process.stdout` (propriedade de correção P2).
9. FOR ALL `ValidationResult`, o `Summary_Line` gerado SHALL conter exatamente o número de `remainingIssues` com `severity === 'error'` e `severity === 'warning'` (propriedade de correção P3).
