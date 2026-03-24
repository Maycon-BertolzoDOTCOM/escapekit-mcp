# Requirements Document

## Introduction

O comando `validate` do CLI do EscapeKit executa a `ValidationEngine` e obtém um `ValidationResult` completo, mas nunca exibe esse resultado ao usuário — apenas define o exit code. O `CLIReporter` e o `JSONReporter` já estão totalmente implementados em `src/validate/reporters/` e implementam a interface `Reporter`, mas nunca são instanciados no CLI. Esta feature conecta os reporters ao comando `validate`, garantindo que o usuário veja o resultado da validação no terminal ou em JSON, adiciona a opção `--quiet` para suprimir output em scripts CI, e preserva integralmente o comportamento de exit code existente.

## Glossary

- **CLI**: Interface de linha de comando do EscapeKit, implementada em `src/cli/index.ts`.
- **ValidationEngine**: Componente em `src/validate/ValidationEngine.ts` que executa a validação completa de um projeto e retorna um `ValidationResult`.
- **ValidationResult**: Tipo em `src/validate/types.ts` que agrega o resultado completo da validação, incluindo `canDeploy`, `confidence`, `duration`, `checks`, `fixesApplied`, `remainingIssues` e `recommendations`.
- **Reporter**: Interface em `src/validate/types.ts` com o método `report(result: ValidationResult): Promise<void>`.
- **CLIReporter**: Componente em `src/validate/reporters/CLIReporter.ts` que formata o `ValidationResult` para exibição no terminal via `process.stdout.write`.
- **JSONReporter**: Componente em `src/validate/reporters/JSONReporter.ts` que serializa o `ValidationResult` como JSON via `process.stdout.write`.
- **ReporterFactory**: Lógica de seleção do reporter correto com base nas opções do comando `validate`.
- **Exit_Code**: Código de saída do processo: `0` quando `result.canDeploy === true`, `1` quando `result.canDeploy === false`.

---

## Requirements

### Requirement 1: Exibição do Resultado no Terminal

**User Story:** Como usuário do EscapeKit, quero que o comando `validate` exiba o resultado da validação no terminal, para que eu possa ver se o projeto pode ser implantado e quais problemas foram encontrados.

#### Acceptance Criteria

1. WHEN o comando `validate` concluir a execução da `ValidationEngine`, THE `CLI` SHALL instanciar um `CLIReporter` e invocar `reporter.report(result)` antes de chamar `process.exit`.
2. WHEN `result.canDeploy` for `true`, THE `CLIReporter` SHALL exibir a string `"Can Deploy: YES"` no output.
3. WHEN `result.canDeploy` for `false`, THE `CLIReporter` SHALL exibir a string `"Can Deploy: NO"` no output.
4. THE `CLIReporter` SHALL exibir o valor de `result.confidence` formatado como percentual com uma casa decimal.
5. THE `CLIReporter` SHALL exibir o valor de `result.duration` formatado em segundos com uma casa decimal.

---

### Requirement 2: Saída em Formato JSON

**User Story:** Como desenvolvedor integrando o EscapeKit em pipelines de CI/CD, quero que o comando `validate` com a flag `--json` produza saída em JSON válido, para que ferramentas externas possam consumir o resultado programaticamente.

#### Acceptance Criteria

1. WHEN o comando `validate` for executado com a opção `--json`, THE `CLI` SHALL instanciar um `JSONReporter` em vez de um `CLIReporter`.
2. WHEN o `JSONReporter` for invocado, THE `JSONReporter` SHALL escrever o `ValidationResult` serializado como JSON em `process.stdout`.
3. WHEN a opção `--json` estiver ativa, THE output escrito em `process.stdout` SHALL ser parseável por `JSON.parse` sem lançar exceção.
4. WHEN a opção `--json` estiver ativa, THE `CLI` SHALL suprimir qualquer output de log intermediário para manter o JSON limpo (comportamento já existente via `isJsonMode` preservado).

---

### Requirement 3: Opção --quiet para Supressão de Output

**User Story:** Como engenheiro de DevOps, quero executar o comando `validate` com a flag `--quiet` para suprimir todo output, para que scripts de CI possam usar apenas o exit code sem poluir logs.

#### Acceptance Criteria

1. THE `CLI` SHALL aceitar a opção `--quiet` no comando `validate`.
2. WHEN o comando `validate` for executado com a opção `--quiet`, THE `CLI` SHALL não instanciar nenhum reporter.
3. WHEN a opção `--quiet` estiver ativa, THE `CLI` SHALL não escrever nada em `process.stdout` durante a execução do reporter.
4. WHEN a opção `--quiet` estiver ativa, THE Exit_Code SHALL ser definido normalmente com base em `result.canDeploy`.

---

### Requirement 4: Preservação do Exit Code

**User Story:** Como usuário do EscapeKit, quero que o exit code do comando `validate` continue sendo determinado exclusivamente por `result.canDeploy`, para que scripts que dependem do exit code não sejam afetados pela adição dos reporters.

#### Acceptance Criteria

1. WHEN `result.canDeploy` for `true`, THE `CLI` SHALL chamar `process.exit(0)` após a execução do reporter.
2. WHEN `result.canDeploy` for `false`, THE `CLI` SHALL chamar `process.exit(1)` após a execução do reporter.
3. WHEN o reporter lançar uma exceção durante `reporter.report(result)`, THE `CLI` SHALL capturar a exceção, registrar o erro no `console.error`, e chamar `process.exit` com o código determinado por `result.canDeploy`.
4. FOR ALL combinações de opções (`--json`, `--quiet`, `--auto-fix`, `--academic`), o Exit_Code SHALL depender exclusivamente de `result.canDeploy`.

---

### Requirement 5: Seleção do Reporter via ReporterFactory

**User Story:** Como desenvolvedor do EscapeKit, quero que a lógica de seleção do reporter seja centralizada, para que futuras adições de reporters não exijam modificações espalhadas no código do CLI.

#### Acceptance Criteria

1. THE `CLI` SHALL selecionar o reporter com base na seguinte precedência: se `--quiet` → nenhum reporter; se `--json` → `JSONReporter`; caso contrário → `CLIReporter`.
2. WHEN a opção `--quiet` e a opção `--json` forem fornecidas simultaneamente, THE `CLI` SHALL tratar como modo `--quiet` e não instanciar nenhum reporter.
3. THE `CLI` SHALL invocar `reporter.report(result)` dentro de um bloco `try/catch` independente do bloco `try/catch` que envolve a chamada à `ValidationEngine`.

---

### Requirement 6: Compatibilidade com Opções Existentes

**User Story:** Como usuário do EscapeKit, quero que as opções existentes do comando `validate` (`--level`, `--env`, `--auto-fix`, `--timeout`, `--academic`) continuem funcionando normalmente após a adição dos reporters, para que não haja regressão de comportamento.

#### Acceptance Criteria

1. THE `CLI` SHALL manter todas as opções existentes do comando `validate` sem alteração de nome, tipo ou valor padrão.
2. WHEN a opção `--academic` estiver ativa e a opção `--json` não estiver ativa, THE `CLI` SHALL exibir as referências acadêmicas após a saída do `CLIReporter`.
3. WHEN a opção `--academic` estiver ativa e a opção `--json` estiver ativa, THE `CLI` SHALL enriquecer o `result` antes de passá-lo ao `JSONReporter`, de modo que as referências acadêmicas estejam presentes no JSON.
4. THE `CLI` SHALL manter o comportamento de suprimir logs intermediários quando `--json` ou `--quiet` estiverem ativos.

---

### Requirement 7: Testes do Comando Validate

**User Story:** Como desenvolvedor do EscapeKit, quero que o comportamento do comando `validate` seja coberto por testes automatizados, para que regressões sejam detectadas rapidamente.

#### Acceptance Criteria

1. THE `tests/cli/validate.test.ts` SHALL verificar que `CLIReporter.report` é invocado quando nenhuma opção especial está ativa.
2. THE `tests/cli/validate.test.ts` SHALL verificar que `JSONReporter.report` é invocado quando `--json` está ativo.
3. THE `tests/cli/validate.test.ts` SHALL verificar que nenhum reporter é invocado quando `--quiet` está ativo.
4. THE `tests/cli/validate.test.ts` SHALL verificar que o exit code é `0` quando `result.canDeploy` é `true`, independentemente do reporter usado.
5. THE `tests/cli/validate.test.ts` SHALL verificar que o exit code é `1` quando `result.canDeploy` é `false`, independentemente do reporter usado.
6. THE `tests/cli/validate.test.ts` SHALL verificar que uma exceção lançada pelo reporter não altera o exit code determinado por `result.canDeploy`.
7. FOR ALL `ValidationResult` com `canDeploy: true`, o output do `CLIReporter` SHALL conter a string `"Can Deploy: YES"` (propriedade de correção P1).
8. FOR ALL `ValidationResult` com `canDeploy: false`, o output do `CLIReporter` SHALL conter a string `"Can Deploy: NO"` (propriedade de correção P2).
9. FOR ALL `ValidationResult`, o output do `JSONReporter` SHALL ser parseável por `JSON.parse` sem lançar exceção (propriedade de correção P3).
10. WHEN `--quiet` estiver ativo, nenhum byte SHALL ser escrito em `process.stdout` pelo reporter (propriedade de correção P4).
