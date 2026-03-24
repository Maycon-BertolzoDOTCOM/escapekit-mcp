# Requirements Document

## Introduction

O `ValidationEngine` (`src/validate/ValidationEngine.ts`) executa atualmente uma única passagem de auto-fix: detecta issues, aplica fixes e revalida uma única vez. Isso é insuficiente porque um fix pode introduzir novos issues (ex: substituir um ghost import por um pacote real que possui configuração desatualizada). O MANIFESTO descreve o EscapeKit como um "orquestrador de erros que itera até o projeto estar sólido", mas o comportamento atual é um pipeline linear de passagem única.

Esta melhoria transforma a lógica de auto-fix em um **loop iterativo** dentro do `ValidationEngine`: detectar issues → aplicar fixes → revalidar → repetir até que não haja mais erros, nenhum progresso seja feito, ou o limite de iterações seja atingido. O resultado expõe o número de iterações executadas e o loop é configurável via `maxIterations` em `ValidationOptions`.

## Glossary

- **ValidationEngine**: Orquestrador principal em `src/validate/ValidationEngine.ts` que coordena validação e auto-fix.
- **ValidationOptions**: Interface em `src/validate/types.ts` com as opções de configuração passadas ao `ValidationEngine.validate`.
- **ValidationResult**: Interface em `src/validate/types.ts` com o resultado agregado retornado por `ValidationEngine.validate`.
- **AutoFixEngine**: Componente em `src/validate/auto-fix/AutoFixEngine.ts` que aplica fixes a uma lista de issues.
- **BuildValidator**: Componente em `src/validate/validators/BuildValidator.ts` que valida o build do projeto.
- **DependencyValidator**: Componente em `src/validate/validators/DependencyValidator.ts` que valida dependências do projeto.
- **Issue**: Tipo em `src/validate/types.ts` representando um problema encontrado durante a validação.
- **Fix**: Tipo em `src/validate/types.ts` representando o resultado de uma operação de auto-fix.
- **Iteration**: Uma passagem completa do ciclo detectar → fixar → revalidar dentro do loop de auto-fix.
- **maxIterations**: Opção configurável em `ValidationOptions` que define o número máximo de iterações do loop (padrão: 3, mínimo: 1, máximo: 10).
- **iterationCount**: Campo novo em `ValidationResult` que indica quantas iterações foram executadas.

---

## Requirements

### Requirement 1: Loop Iterativo de Auto-Fix

**User Story:** Como usuário do EscapeKit, quero que o `ValidationEngine` repita o ciclo de fix e revalidação automaticamente, para que fixes que introduzem novos issues sejam resolvidos sem intervenção manual.

#### Acceptance Criteria

1. WHEN `autoFix` for `true` e houver issues com `severity === 'error'`, THE `ValidationEngine` SHALL executar o ciclo detectar → fixar → revalidar em loop até que uma condição de parada seja atingida.
2. WHEN nenhum issue com `severity === 'error'` restar ao final de uma iteração, THE `ValidationEngine` SHALL encerrar o loop e retornar o resultado.
3. WHEN nenhum novo `Fix` com `applied: true` for produzido em uma iteração, THE `ValidationEngine` SHALL encerrar o loop (sem progresso).
4. WHEN o número de iterações executadas atingir `maxIterations`, THE `ValidationEngine` SHALL encerrar o loop independentemente dos issues restantes.
5. WHEN `autoFix` for `false`, THE `ValidationEngine` SHALL executar exatamente uma passagem de validação sem loop, preservando o comportamento atual integralmente.

---

### Requirement 2: Configuração de `maxIterations`

**User Story:** Como usuário do EscapeKit, quero configurar o número máximo de iterações do loop de auto-fix, para que eu possa ajustar o comportamento conforme a complexidade do projeto.

#### Acceptance Criteria

1. THE `ValidationOptions` SHALL incluir o campo opcional `maxIterations` do tipo `number`.
2. WHEN `maxIterations` não for fornecido, THE `ValidationEngine` SHALL usar o valor padrão `3`.
3. WHEN `maxIterations` for fornecido com valor menor que `1`, THE `ValidationEngine` SHALL usar o valor mínimo `1`.
4. WHEN `maxIterations` for fornecido com valor maior que `10`, THE `ValidationEngine` SHALL usar o valor máximo `10`.
5. THE `ValidationOptions` SHALL manter todos os campos existentes (`environment`, `level`, `autoFix`, `timeout`, `fuzzyThreshold`) sem alteração.

---

### Requirement 3: Campo `iterationCount` no Resultado

**User Story:** Como usuário do EscapeKit, quero saber quantas iterações de auto-fix foram executadas, para que eu possa entender o esforço de correção aplicado ao projeto.

#### Acceptance Criteria

1. THE `ValidationResult` SHALL incluir o campo `iterationCount` do tipo `number`.
2. WHEN `autoFix` for `false`, THE `ValidationEngine` SHALL retornar `iterationCount` igual a `0`.
3. WHEN `autoFix` for `true` e o loop for executado, THE `ValidationEngine` SHALL retornar `iterationCount` igual ao número de iterações completas executadas.
4. THE `ValidationResult` SHALL manter todos os campos existentes (`canDeploy`, `confidence`, `duration`, `checks`, `fixesApplied`, `remainingIssues`, `recommendations`) sem alteração.

---

### Requirement 4: Log por Iteração

**User Story:** Como desenvolvedor do EscapeKit, quero que cada iteração do loop seja registrada no log, para que eu possa diagnosticar o progresso do auto-fix em projetos complexos.

#### Acceptance Criteria

1. WHEN uma iteração do loop for iniciada, THE `ValidationEngine` SHALL emitir um log de nível `info` contendo o número da iteração atual e o total de issues com `severity === 'error'` encontrados.
2. WHEN uma iteração do loop for concluída, THE `ValidationEngine` SHALL emitir um log de nível `info` contendo o número de fixes com `applied: true` e o número de issues com `severity === 'error'` restantes.
3. WHEN o loop encerrar por ausência de progresso (nenhum fix aplicado), THE `ValidationEngine` SHALL emitir um log de nível `warn` indicando que nenhum progresso foi feito e o loop foi encerrado.
4. WHEN o loop encerrar por atingir `maxIterations`, THE `ValidationEngine` SHALL emitir um log de nível `warn` contendo o número de issues com `severity === 'error'` restantes.

---

### Requirement 5: Acumulação de Fixes Entre Iterações

**User Story:** Como usuário do EscapeKit, quero que todos os fixes aplicados em todas as iterações sejam reportados no resultado final, para que eu tenha visibilidade completa das correções realizadas.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL acumular todos os `Fix` com `applied: true` de todas as iterações no campo `fixesApplied` do `ValidationResult`.
2. WHEN múltiplas iterações forem executadas, THE `ValidationResult.fixesApplied` SHALL conter a união de todos os fixes aplicados em cada iteração, na ordem em que foram aplicados.
3. THE `ValidationResult.remainingIssues` SHALL refletir apenas os issues da última iteração executada.

---

### Requirement 6: Preservação da Interface Pública

**User Story:** Como desenvolvedor do EscapeKit, quero que a interface pública do `ValidationEngine` não mude, para que nenhum código consumidor precise ser alterado.

#### Acceptance Criteria

1. THE `ValidationEngine` SHALL manter a assinatura do método `validate(projectPath: string, options?: Partial<ValidationOptions>): Promise<ValidationResult>` sem alteração.
2. THE `AutoFixEngine` SHALL não requerer nenhuma modificação para suportar o loop iterativo.
3. THE `BuildValidator` SHALL não requerer nenhuma modificação para suportar o loop iterativo.
4. THE `DependencyValidator` SHALL não requerer nenhuma modificação para suportar o loop iterativo.
5. WHEN `maxIterations` não for fornecido em `ValidationOptions`, THE `ValidationEngine` SHALL se comportar de forma compatível com o comportamento anterior (máximo de 3 iterações com parada antecipada por ausência de progresso ou ausência de erros).
