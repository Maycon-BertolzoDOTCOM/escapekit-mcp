# Implementation Plan

## Tasks

- [ ] 1. Adicionar campos novos em `src/validate/types.ts`
  - Adicionar campo opcional `maxIterations?: number` à interface `ValidationOptions`
  - Adicionar campo `iterationCount: number` à interface `ValidationResult`
  - Arquivo: `src/validate/types.ts`

- [ ] 2. Adicionar constantes e método `clampIterations` ao `ValidationEngine`
  - Definir constantes `DEFAULT_MAX_ITERATIONS = 3`, `MIN_ITERATIONS_LIMIT = 1`, `MAX_ITERATIONS_LIMIT = 10` no topo do arquivo
  - Implementar `private clampIterations(value: number | undefined): number` que retorna o valor clampado em `[1, 10]` ou o padrão `3`
  - Arquivo: `src/validate/ValidationEngine.ts`

- [ ] 3. Substituir o bloco `if (opts.autoFix)` pelo loop iterativo
  - Inicializar `iterationCount = 0` antes do bloco de auto-fix
  - Substituir o bloco `if (opts.autoFix && issues.length > 0)` pelo loop `while (iterationCount < maxIter)`
  - Condição de parada 1: `errorIssues.length === 0` → `break`
  - Condição de parada 2: `applied.length === 0` → log `warn` + `break`
  - Condição de parada 3: `iterationCount >= maxIter` (controlada pelo `while`)
  - Acumular todos os fixes aplicados em `fixesApplied` a cada iteração
  - Revalidar com `DependencyValidator` e `BuildValidator` ao final de cada iteração com progresso
  - Emitir log `warn` ao final se `iterationCount === maxIter` e ainda houver erros
  - Arquivo: `src/validate/ValidationEngine.ts`

- [ ] 4. Adicionar logs por iteração
  - Log `info` no início de cada iteração: número da iteração, total de erros encontrados
  - Log `info` ao final de cada iteração: fixes aplicados, erros restantes
  - Log `warn` ao encerrar por falta de progresso
  - Log `warn` ao encerrar por atingir `maxIterations` com erros restantes
  - Arquivo: `src/validate/ValidationEngine.ts`

- [ ] 5. Incluir `iterationCount` no `ValidationResult` retornado
  - Adicionar `iterationCount` ao objeto `result` construído ao final do método `validate`
  - Garantir que `iterationCount === 0` quando `autoFix: false`
  - Arquivo: `src/validate/ValidationEngine.ts`

- [ ] 6. Escrever testes unitários para o loop iterativo
  - Criar `tests/validate/ValidationEngine.loop.test.ts`
  - Mockar `AutoFixEngine`, `BuildValidator` e `DependencyValidator`
  - Testar as três condições de parada: sem erros, sem progresso, limite atingido
  - Testar clamp de `maxIterations`: valor 0 → 1, valor 15 → 10, undefined → 3
  - Testar `iterationCount` correto em cada cenário de parada
  - Testar acumulação de `fixesApplied` de múltiplas iterações
  - Testar que `autoFix: false` preserva comportamento atual com `iterationCount: 0`
  - Testar emissão dos logs `info` e `warn` nos momentos corretos

- [ ] 7. Verificar diagnósticos e compatibilidade
  - Executar `getDiagnostics` em `src/validate/types.ts` e `src/validate/ValidationEngine.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos
  - Verificar que nenhum consumidor existente de `ValidationResult` quebra com o campo novo
