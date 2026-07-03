# Plano de Implementação: validation-result-cache

## Visão Geral

Implementação em três frentes: (1) cache de `ValidationResult` na estratégia `thorough` do `GovernanceEngine`, (2) campo `cacheSource` no `GovernancePassport` com serialização no SQLite, e (3) flag `--no-cache` na CLI. A Fase 2 (ASTNgramExtractor) é opcional.

## Tarefas

- [x] 1. Adicionar tipos e interfaces base
  - [x] 1.1 Adicionar `cacheSource?: 'engram' | 'vector' | 'full'` em `GovernancePassport` em `src/governance/types.ts`
    - _Requisitos: 2.1_
  - [x] 1.2 Adicionar interface `ValidationCacheMetrics` em `src/governance/types.ts`
    - Campos: `validation_cache_hits`, `validation_cache_misses`, `avg_validation_time_ms`, `tokens_saved_estimate`
    - _Requisitos: 3.1_
  - [x] 1.3 Expandir `ClientMetricsPayload` em `src/governance/types.ts` com `validationCacheHits`, `validationCacheMisses`, `avgValidationTimeMs`
    - _Requisitos: 3.5_
  - [x] 1.4 Adicionar `recallExact?(fingerprint: CodeFingerprint): Promise<GovernancePassport[]>` como método opcional em `IHybridMemory` em `src/governance/interfaces.ts`
    - _Requisitos: 1.1_

- [x] 2. Atualizar HybridMemoryAdapter para serializar/desserializar cacheSource
  - [x] 2.1 Adicionar `cacheSource?: string` em `PassportJson` interno do `HybridMemoryAdapter`
    - _Requisitos: 2.5_
  - [x] 2.2 Serializar `cacheSource` no método `save()` do `HybridMemoryAdapter`
    - _Requisitos: 2.5_
  - [x] 2.3 Desserializar `cacheSource` com fallback `'full'` no método de leitura do `HybridMemoryAdapter`
    - Atribuir `cacheSource: json.cacheSource ?? 'full'`
    - _Requisitos: 2.5, 6.2_
  - [x]* 2.4 Escrever teste de propriedade para round-trip de cacheSource (Propriedade 4)
    - **Propriedade 4: Round-trip de serialização do cacheSource**
    - **Valida: Requisito 2.5**
    - Arquivo: `tests/governance/HybridMemoryAdapter.cache.test.ts`
  - [x]* 2.5 Escrever teste unitário de compatibilidade retroativa (passaporte sem cacheSource recebe `'full'`)
    - Arquivo: `tests/governance/HybridMemoryAdapter.cache.test.ts`
    - _Requisitos: 6.2_

- [x] 3. Implementar cache de ValidationResult no GovernanceEngine
  - [x] 3.1 Adicionar contadores internos `_validationCacheHits`, `_validationCacheMisses` e array `_validationTimes` em `GovernanceEngine`
    - _Requisitos: 1.7, 1.8, 3.1_
  - [x] 3.2 Adicionar campo `noCache?: boolean` em `GovernanceContext` em `src/governance/types.ts`
    - _Requisitos: 4.3_
  - [x] 3.3 Implementar lógica de cache na estratégia `thorough` do `GovernanceEngine`
    - Chamar `recallExact?.(fingerprint)` quando `noCache` não for `true`
    - Reutilizar `validations[0]` do passaporte mais recente se disponível, definindo `cacheSource: 'engram'` e incrementando `_validationCacheHits`
    - Chamar `validationEngine.validate()` no miss, definindo `cacheSource: 'full'` e incrementando `_validationCacheMisses`
    - Capturar exceções de `recallExact` silenciosamente e tratar como miss
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8_
  - [x] 3.4 Propagar `cacheSource` para o `GovernancePassport` resultante em todas as estratégias
    - Estratégias `fast` e `compliance-first` devem receber `cacheSource: 'full'`
    - _Requisitos: 1.5, 1.6, 2.2, 2.4_
  - [x] 3.5 Implementar método público `getValidationCacheMetrics(): ValidationCacheMetrics` no `GovernanceEngine`
    - Calcular `avg_validation_time_ms` como média aritmética de `_validationTimes`
    - Calcular `tokens_saved_estimate` como `hits * avg * 0.1`
    - Retornar zeros quando não houver execuções
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_
  - [x]* 3.6 Escrever teste de propriedade para cache hit (Propriedade 1)
    - **Propriedade 1: Cache hit evita revalidação e define cacheSource correto**
    - **Valida: Requisitos 1.1, 1.3, 1.7**
    - Arquivo: `tests/governance/GovernanceEngine.cache.test.ts`
  - [x]* 3.7 Escrever teste de propriedade para cache miss (Propriedade 2)
    - **Propriedade 2: Cache miss dispara validação e define cacheSource correto**
    - **Valida: Requisitos 1.2, 1.4, 1.8**
    - Arquivo: `tests/governance/GovernanceEngine.cache.test.ts`
  - [x]* 3.8 Escrever teste de propriedade para invariante estrutural do passaporte (Propriedade 3)
    - **Propriedade 3: Invariante estrutural do GovernancePassport**
    - **Valida: Requisitos 2.1, 6.1, 6.3**
    - Arquivo: `tests/governance/GovernanceEngine.cache.test.ts`
  - [x]* 3.9 Escrever teste de propriedade para cálculo de métricas (Propriedade 5)
    - **Propriedade 5: Cálculo correto de métricas de cache**
    - **Valida: Requisitos 3.3, 3.4**
    - Arquivo: `tests/governance/GovernanceEngine.cache.test.ts`
  - [x]* 3.10 Escrever teste de propriedade para equivalência de riskLevel com e sem cache (Propriedade 11)
    - **Propriedade 11: Equivalência de riskLevel com e sem cache**
    - **Valida: Requisito 6.4**
    - Arquivo: `tests/governance/GovernanceEngine.cache.test.ts`
  - [x]* 3.11 Escrever teste de propriedade para preservação da estratégia fast (Propriedade 12)
    - **Propriedade 12: Estratégia fast preservada**
    - **Valida: Requisito 1.5**
    - Arquivo: `tests/governance/GovernanceEngine.cache.test.ts`

- [x] 4. Checkpoint — garantir que todos os testes passam
  - Garantir que todos os testes passam; perguntar ao usuário se houver dúvidas.

- [x] 5. Adicionar flag `--no-cache` na CLI
  - [x] 5.1 Registrar opção `--no-cache` no comando `govern` em `src/cli/index.ts`
    - _Requisitos: 4.1_
  - [x] 5.2 Implementar lógica de `--no-cache`: forçar `strategy: 'thorough'` e passar `noCache: true` ao `GovernanceEngine`
    - Emitir aviso em stderr quando `--no-cache` for combinado com `--strategy fast` ou `--strategy compliance-first`
    - _Requisitos: 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Expandir FederatedMemoryAdapter e servidor Python com métricas de validação
  - [x] 6.1 Expandir `ClientMetricsPayload` no envio do `FederatedMemoryAdapter` para incluir os campos de validação ao chamar `/stats/client-metrics`
    - _Requisitos: 3.5_
  - [x] 6.2 Expandir `ClientMetricsRequest` no servidor Python (`federated-server/main.py`) com campos `validation_cache_hits`, `validation_cache_misses`, `avg_validation_time_ms` (todos com default 0)
    - _Requisitos: 3.5_
  - [x] 6.3 Expandir `StatsResponse` no servidor Python com campos `client_validation_cache_hits`, `client_validation_cache_misses`, `client_avg_validation_time_ms`
    - Acumular valores recebidos via `/stats/client-metrics` nos campos do `StatsResponse`
    - _Requisitos: 3.1_
  - [-]* 6.4 Escrever testes de propriedade Python para `ClientMetricsRequest` e `StatsResponse` (hypothesis)
    - Verificar que campos de validação são aceitos e preservados corretamente
    - Arquivo: `federated-server/tests/test_validation_metrics.py`
    - _Requisitos: 3.5_

- [ ] 7. Checkpoint final — garantir que todos os testes passam
  - Garantir que todos os testes passam; perguntar ao usuário se houver dúvidas.

- [ ] 8. (Fase 2 — opcional) Implementar ASTNgramExtractor com @babel/parser
  - [ ]* 8.1 Instalar dependência `@babel/parser` e tipos `@babel/types` em `package.json`
    - _Requisitos: 5.1_
  - [ ]* 8.2 Criar `src/governance/utils/astNgrams.ts` com função `extractAstNgrams(code: string, n?: number): string`
    - Percorrer AST em depth-first coletando `node.type`
    - Gerar n-gramas de tamanho `n=3`, serializar como `"A|B|C,B|C|D,..."`
    - Retornar fallback `buildAstSignature(code)` em caso de falha do parser
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 8.3 Integrar `extractAstNgrams` em `computeFingerprint` em `src/governance/utils/fingerprint.ts`
    - _Requisitos: 5.1, 5.5_
  - [ ]* 8.4 Criar tabela SQLite `ast_ngram_cache` no `HybridMemoryAdapter`
    - Schema: `ngram_hash TEXT PRIMARY KEY, partial_result_json TEXT NOT NULL, confidence REAL NOT NULL, created_at TEXT NOT NULL`
    - _Requisitos: 5.6_
  - [ ]* 8.5 Escrever teste de propriedade para determinismo do ASTNgramExtractor (Propriedade 7)
    - **Propriedade 7: Determinismo do ASTNgramExtractor**
    - **Valida: Requisito 5.5**
    - Arquivo: `tests/governance/ASTNgramExtractor.test.ts`
  - [ ]* 8.6 Escrever teste de propriedade para formato correto dos n-gramas (Propriedade 8)
    - **Propriedade 8: Formato correto dos n-gramas**
    - **Valida: Requisito 5.3**
    - Arquivo: `tests/governance/ASTNgramExtractor.test.ts`
  - [ ]* 8.7 Escrever teste de propriedade para fallback sem exceção (Propriedade 9)
    - **Propriedade 9: Fallback sem exceção para código inválido**
    - **Valida: Requisito 5.2**
    - Arquivo: `tests/governance/ASTNgramExtractor.test.ts`
  - [ ]* 8.8 Escrever teste de propriedade para round-trip do astSignature (Propriedade 10)
    - **Propriedade 10: Round-trip do astSignature**
    - **Valida: Requisito 5.8**
    - Arquivo: `tests/governance/ASTNgramExtractor.test.ts`

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Toda a Fase 2 (tarefa 8 e sub-tarefas) é opcional
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os checkpoints nas tarefas 4 e 7 garantem validação incremental
- Testes de propriedade usam fast-check (TypeScript) e hypothesis (Python)
