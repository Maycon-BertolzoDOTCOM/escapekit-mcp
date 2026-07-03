# Plano de Implementação: Engram Cache

## Visão Geral

Implementação incremental do Engram Cache em três frentes: (1) lookup O(1) por hash exato no `HybridMemoryAdapter`, (2) orquestração de três níveis de cache com métricas no `FederatedMemoryAdapter`, e (3) exposição de métricas via `GovernanceEngine` e endpoints Python. A Fase 2 (N-gramas de AST) é opcional.

## Tarefas

- [x] 1. Adicionar tipos `CacheMetrics` e `ClientMetricsPayload` em `src/governance/types.ts`
  - Adicionar interface `CacheMetrics` com campos: `engramHits`, `engramMisses`, `engramHitRate`, `vectorHits`, `vectorMisses`, `vectorHitRate`, `federatedHits`, `federatedMisses`, `federatedHitRate` (todos `number`)
  - Adicionar interface `ClientMetricsPayload` com campos: `engramHitRate`, `vectorHitRate`, `federatedHitRate` (todos `number` em `[0, 1]`)
  - _Requisitos: 2.9, 3.3_

- [x] 2. Implementar `recallExact` no `HybridMemoryAdapter`
  - [x] 2.1 Adicionar método `recallExact(fingerprint: CodeFingerprint): Promise<GovernancePassport[]>` em `src/governance/adapters/HybridMemoryAdapter.ts`
    - Executar `SELECT * FROM governance_passports WHERE fingerprint_hash = ?` usando `fingerprint.hash`
    - Retornar `[]` sem exceção quando hash não existe
    - Reutilizar o índice `idx_fingerprint_hash` existente (sem criar índice novo)
    - _Requisitos: 1.1, 1.2, 1.3, 4.4_

  - [x]* 2.2 Escrever teste de propriedade P1 — Filtragem exata por hash
    - **Propriedade 1: Filtragem exata por hash**
    - Usar `fc.asyncProperty` com `arbitraryPassport()` em `tests/governance/HybridMemoryAdapter.test.ts`
    - Verificar que todos os passaportes retornados por `recallExact` têm `codeFingerprint.hash` igual ao hash consultado
    - Anotar: `// Feature: engram-cache, Property 1`
    - **Valida: Requisito 1.1**

  - [x]* 2.3 Escrever teste de propriedade P2 — Round-trip save → recallExact
    - **Propriedade 2: Round-trip save → recallExact**
    - Usar `fc.asyncProperty` com `arbitraryPassport()` em `tests/governance/HybridMemoryAdapter.test.ts`
    - Verificar que passaporte salvo via `save()` é encontrado por `recallExact` com mesmo `fingerprint_hash`
    - Anotar: `// Feature: engram-cache, Property 2`
    - **Valida: Requisitos 1.2, 4.5**

- [x] 3. Atualizar `FederatedMemoryAdapter` com contadores, orquestração e `getMetrics`
  - [x] 3.1 Adicionar contadores privados em `src/governance/adapters/FederatedMemoryAdapter.ts`
    - Declarar `_engramHits`, `_engramMisses`, `_vectorHits`, `_vectorMisses`, `_federatedHits`, `_federatedMisses` inicializados em `0`
    - _Requisitos: 2.1_

  - [x] 3.2 Atualizar lógica interna de `recall()` para orquestrar três níveis
    - Chamar `recallExact` antes de `recall` no fluxo de consulta
    - Se `recallExact` retornar passaportes: incrementar `engramHits`, retornar imediatamente (sem HTTP)
    - Se `recallExact` retornar `[]`: incrementar `engramMisses`, prosseguir para busca vetorial local
    - Após busca vetorial: incrementar `vectorHits` ou `vectorMisses` conforme resultado
    - Após consulta federada: incrementar `federatedHits` ou `federatedMisses` conforme resultado
    - Manter assinatura de `recall()` idêntica à atual
    - _Requisitos: 1.4, 1.5, 1.6, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.2_

  - [x] 3.3 Implementar `getMetrics(): CacheMetrics`
    - Calcular hit rates com proteção contra divisão por zero: `hits / (hits + misses)` ou `0` se total = 0
    - Retornar objeto `CacheMetrics` completo
    - _Requisitos: 2.8, 2.10_

  - [x]* 3.4 Escrever teste de propriedade P3 — Curto-circuito no EngramHit
    - **Propriedade 3: Curto-circuito no EngramHit**
    - Usar `fc.asyncProperty` em `tests/governance/FederatedMemoryAdapter.test.ts`
    - Verificar que quando `recallExact` retorna passaportes, nenhuma chamada HTTP é feita ao servidor federado
    - Anotar: `// Feature: engram-cache, Property 3`
    - **Valida: Requisito 1.5**

  - [x]* 3.5 Escrever teste de propriedade P4 — Consistência dos contadores de métricas
    - **Propriedade 4: Consistência dos contadores de métricas**
    - Usar `fc.asyncProperty` com sequência de N chamadas a `recall()` em `tests/governance/FederatedMemoryAdapter.test.ts`
    - Verificar que `engramHits + engramMisses === N` após N chamadas
    - Verificar que `vectorHits + vectorMisses` é igual ao número de chamadas que chegaram ao nível vetorial
    - Verificar que `federatedHits + federatedMisses` é igual ao número de chamadas que chegaram ao nível federado
    - Anotar: `// Feature: engram-cache, Property 4`
    - **Valida: Requisitos 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

- [x] 4. Adicionar `getCacheMetrics` no `GovernanceEngine`
  - Adicionar método `getCacheMetrics(): CacheMetrics` em `src/governance/GovernanceEngine.ts`
  - Se `this.memory instanceof FederatedMemoryAdapter`: delegar para `this.memory.getMetrics()`
  - Caso contrário: retornar `CacheMetrics` com todos os campos zerados
  - _Requisitos: 3.1, 3.2, 4.3_

- [x] 5. Checkpoint — Garantir que todos os testes TypeScript passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 6. Adicionar endpoints de métricas no servidor Python
  - [x] 6.1 Criar modelo Pydantic `ClientMetricsRequest` em `federated-server/main.py`
    - Campos: `engram_hit_rate`, `vector_hit_rate`, `federated_hit_rate` — todos `float` em `[0, 1]`
    - Usar `field_validator` para rejeitar valores fora de `[0, 1]` com HTTP 422
    - _Requisitos: 3.3, 3.6_

  - [x] 6.2 Implementar `POST /stats/client-metrics`
    - Receber `ClientMetricsRequest` e armazenar em variável de módulo
    - _Requisitos: 3.3_

  - [x] 6.3 Expandir `GET /stats` com campos de métricas de cliente
    - Adicionar `client_engram_hit_rate`, `client_vector_hit_rate`, `client_federated_hit_rate` ao response
    - Retornar `0.0` para cada campo quando nenhum POST foi recebido
    - _Requisitos: 3.4, 3.5_

  - [x]* 6.4 Escrever teste de propriedade P5 — Round-trip POST → GET /stats
    - **Propriedade 5: Round-trip POST → GET /stats para métricas de cliente**
    - Usar `@given` com `st.floats(min_value=0.0, max_value=1.0)` em `federated-server/tests/test_stats.py`
    - Verificar que valores enviados via POST aparecem corretamente no GET /stats
    - Anotar: `# Feature: engram-cache, Property 5`
    - **Valida: Requisito 3.4**

  - [x]* 6.5 Escrever teste de propriedade P6 — Rejeição de payload inválido
    - **Propriedade 6: Rejeição de payload inválido em /stats/client-metrics**
    - Usar `@given` com `st.floats().filter(lambda x: x < 0 or x > 1)` em `federated-server/tests/test_stats.py`
    - Verificar que POST com qualquer campo fora de `[0, 1]` retorna HTTP 422
    - Anotar: `# Feature: engram-cache, Property 6`
    - **Valida: Requisito 3.6**

- [x] 7. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes TypeScript e Python passam, perguntar ao usuário se houver dúvidas.

- [ ] 8. [Fase 2] Implementar `ASTNgramExtractor`
  - [ ]* 8.1 Criar `src/governance/utils/ngram.ts` com classe `ASTNgramExtractor`
    - Implementar `constructor(options?: NgramExtractorOptions)` com `n` padrão `3`
    - Implementar `extract(astSignature: string): string[]` tokenizando por espaço e retornando N-gramas como `"t1|t2|t3"`
    - Retornar `[]` sem exceção quando `astSignature` tem menos tokens que N
    - _Requisitos: 5.1, 5.2_

  - [ ]* 8.2 Escrever teste de propriedade P7 — Contagem correta de N-gramas
    - **Propriedade 7: Contagem correta de N-gramas**
    - Usar `fc.property` com strings de tokens em `tests/governance/ngram.test.ts`
    - Verificar que para K tokens e extrator com N, o resultado tem `max(0, K - N + 1)` elementos
    - Anotar: `// Feature: engram-cache, Property 7`
    - **Valida: Requisito 5.1**

  - [ ]* 8.3 Escrever teste de propriedade P8 — Round-trip de extração de N-gramas
    - **Propriedade 8: Round-trip de extração de N-gramas**
    - Usar `fc.property` com arrays de tokens em `tests/governance/ngram.test.ts`
    - Verificar que o primeiro token de cada N-grama consecutivo avança exatamente uma posição na sequência original
    - Anotar: `// Feature: engram-cache, Property 8`
    - **Valida: Requisito 5.7**

- [ ] 9. [Fase 2] Adicionar tabela `ngram_index` e `recallByNgrams` no `HybridMemoryAdapter`
  - [ ]* 9.1 Criar tabela `ngram_index` no schema SQLite de `HybridMemoryAdapter`
    - Adicionar `CREATE TABLE IF NOT EXISTS ngram_index (ngram TEXT NOT NULL, passport_id TEXT NOT NULL, fingerprint_hash TEXT NOT NULL)`
    - Adicionar `CREATE INDEX IF NOT EXISTS idx_ngram ON ngram_index(ngram)`
    - _Requisitos: 5.3_

  - [ ]* 9.2 Atualizar `save()` para inserir N-gramas na `ngram_index`
    - Extrair N-gramas do `astSignature` via `ASTNgramExtractor` e inserir na `ngram_index`
    - _Requisitos: 5.4_

  - [ ]* 9.3 Implementar `recallByNgrams(fingerprint, minOverlap): Promise<GovernancePassport[]>`
    - Buscar passaportes com sobreposição de N-gramas >= `minOverlap`
    - Posicionar como terceiro nível de cache (após `recallExact`, antes de `recall` vetorial)
    - _Requisitos: 5.5, 5.6_

  - [ ]* 9.4 Escrever teste de propriedade P9 — Filtragem por sobreposição mínima
    - **Propriedade 9: Filtragem por sobreposição mínima em recallByNgrams**
    - Usar `fc.asyncProperty` em `tests/governance/HybridMemoryAdapter.test.ts`
    - Verificar que todos os passaportes retornados por `recallByNgrams(fp, minOverlap)` têm sobreposição de N-gramas >= `minOverlap`
    - Anotar: `// Feature: engram-cache, Property 9`
    - **Valida: Requisito 5.5**

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Tarefas da Fase 2 (8 e 9) são inteiramente opcionais
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os checkpoints nas tarefas 5 e 7 garantem validação incremental
- Testes de propriedade usam `fast-check` (TypeScript) e `hypothesis` (Python)
- Nenhuma assinatura de método existente é alterada — a feature é puramente aditiva
