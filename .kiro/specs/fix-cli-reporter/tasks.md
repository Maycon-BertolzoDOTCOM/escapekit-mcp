# Implementation Plan

## Tasks

- [x] 1. Adicionar imports dos reporters ao comando validate
  - Adicionar import dinâmico de `CLIReporter` de `'../validate/reporters/CLIReporter.js'`
  - Adicionar import dinâmico de `JSONReporter` de `'../validate/reporters/JSONReporter.js'`
  - Manter consistência com o padrão de imports dinâmicos já usado no arquivo para `ValidationEngine`
  - Arquivo: `src/cli/index.ts`

- [x] 2. Implementar função `selectReporter` no CLI
  - Adicionar função auxiliar `selectReporter(options)` que retorna `Reporter | null`
  - Implementar precedência: `--quiet` → `null`; `--json` → `JSONReporter`; padrão → `CLIReporter`
  - Garantir que `--quiet` + `--json` simultâneos resultem em `null` (quiet vence)
  - Arquivo: `src/cli/index.ts`

- [x] 3. Integrar chamada ao reporter no action do comando validate
  - Após o bloco de enriquecimento acadêmico e antes do `process.exit`, invocar `selectReporter(options)`
  - Envolver `reporter.report(result)` em bloco `try/catch` independente
  - No `catch`, registrar o erro via `console.error` sem relançar
  - Garantir que `process.exit(result.canDeploy ? 0 : 1)` seja chamado após o bloco do reporter
  - Arquivo: `src/cli/index.ts`

- [x] 4. Remover output JSON duplicado
  - Remover o bloco `if (options.json) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); }` existente
  - Verificar que o `JSONReporter` instanciado em `selectReporter` assume essa responsabilidade
  - Arquivo: `src/cli/index.ts`

- [x] 5. Verificar diagnósticos do CLI após as mudanças
  - Executar `getDiagnostics` em `src/cli/index.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos

- [x] 6. Criar testes unitários para o comando validate
  - Criar `tests/cli/validate.test.ts`
  - Mockar `ValidationEngine` para retornar `ValidationResult` controlados
  - Mockar `process.stdout.write` e `process.exit` para capturar output e exit code
  - Testar: CLIReporter invocado por padrão (sem opções especiais)
  - Testar: JSONReporter invocado com `--json`, output é JSON válido parseável
  - Testar: nenhum reporter com `--quiet`, stdout não recebe bytes do reporter
  - Testar: exit code `0` quando `canDeploy: true` para cada modo de reporter
  - Testar: exit code `1` quando `canDeploy: false` para cada modo de reporter
  - Testar: exceção no reporter não altera exit code (P5)
  - Testar: `--quiet` + `--json` simultâneos → nenhum reporter, exit code correto

- [x] 7. Escrever property-based tests para as propriedades de correção
  - No mesmo arquivo `tests/cli/validate.test.ts`, adicionar testes PBT com fast-check
  - P1: para qualquer `ValidationResult` com `canDeploy: true`, output do CLIReporter contém `"Can Deploy: YES"`
  - P2: para qualquer `ValidationResult` com `canDeploy: false`, output do CLIReporter contém `"Can Deploy: NO"`
  - P3: para qualquer `ValidationResult`, output do JSONReporter é parseável por `JSON.parse`
  - P4: com `--quiet`, nenhum byte escrito em `process.stdout` pelo reporter
  - P5: para qualquer `ValidationResult` e qualquer exceção no reporter, exit code é `canDeploy ? 0 : 1`
