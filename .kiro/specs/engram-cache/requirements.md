# Requirements Document

## Introduction

O **Engram Cache** é uma camada de cache determinístico O(1) inspirada no conceito de engrama da DeepSeek — uma tabela de lookup por hash exato que atua como primeiro nível de cache antes da busca por similaridade vetorial no sistema CodeMemória Governance.

Atualmente, o método `recall()` do `HybridMemoryAdapter` realiza um full scan em todos os registros do SQLite e computa `computeSimilarity()` para cada um. Para código idêntico (mesmo `fingerprint_hash`), esse custo é desnecessário: o resultado já existe e pode ser retornado em O(1) via `WHERE fingerprint_hash = ?`.

O Engram Cache resolve isso em três frentes:
1. Lookup determinístico O(1) por hash exato antes de qualquer busca vetorial
2. Métricas de hit rate para rastrear a eficiência do cache em cada nível
3. (Fase 2, opcional) N-gramas de AST para cache parcial baseado em estrutura de código

## Glossary

- **EngramCache**: Componente responsável pelo lookup determinístico O(1) por `fingerprint_hash` exato no SQLite
- **HybridMemoryAdapter**: Adaptador de memória que persiste `GovernancePassport` em SQLite com índice por `fingerprint_hash`
- **FederatedMemoryAdapter**: Adaptador que orquestra a hierarquia de recall: EngramCache → cache local → servidor federado
- **GovernanceEngine**: Orquestrador principal que coordena validação, compliance e memória
- **EngramHit**: Resultado retornado pelo EngramCache quando existe passaporte com hash exato
- **EngramMiss**: Ausência de resultado no EngramCache, que dispara a busca por similaridade vetorial
- **CacheMetrics**: Estrutura que acumula contadores de hits e misses por nível de cache
- **HitRate**: Proporção de consultas resolvidas por um nível de cache, calculada como `hits / (hits + misses)`
- **ASTNgram**: Sequência ordenada de N tokens estruturais extraídos do `astSignature` de um `CodeFingerprint`
- **NgramIndex**: Tabela SQLite que mapeia ASTNgrams para passaportes associados
- **fingerprint_hash**: SHA-256 do código-fonte, campo já indexado na tabela `governance_passports`
- **computeFingerprint**: Função existente em `fingerprint.ts` que gera o `CodeFingerprint` incluindo o `hash` SHA-256

## Requirements

### Requirement 1: Lookup Determinístico O(1) por Hash Exato

**User Story:** Como desenvolvedor usando o GovernanceEngine, quero que análises de código idêntico sejam resolvidas instantaneamente pelo cache, para que o sistema não desperdice CPU em full scan e computação de similaridade quando o resultado já existe.

#### Acceptance Criteria

1. THE `HybridMemoryAdapter` SHALL expor um método `recallExact(fingerprint: CodeFingerprint): Promise<GovernancePassport[]>` que executa `SELECT * FROM governance_passports WHERE fingerprint_hash = ?` usando o campo `fingerprint.hash`
2. WHEN `recallExact` é invocado com um `fingerprint_hash` existente na base, THE `HybridMemoryAdapter` SHALL retornar todos os passaportes com aquele hash em tempo O(1) relativo ao número total de registros
3. WHEN `recallExact` é invocado com um `fingerprint_hash` inexistente na base, THE `HybridMemoryAdapter` SHALL retornar um array vazio sem lançar exceção
4. THE `FederatedMemoryAdapter` SHALL invocar `recallExact` antes de invocar `recall` no fluxo de consulta de memória
5. WHEN `recallExact` retorna um ou mais passaportes, THE `FederatedMemoryAdapter` SHALL retornar esses passaportes imediatamente sem executar busca por similaridade vetorial nem consultar o servidor federado
6. WHEN `recallExact` retorna array vazio (EngramMiss), THE `FederatedMemoryAdapter` SHALL prosseguir com o fluxo existente de `recall` por similaridade vetorial

### Requirement 2: Métricas de Hit Rate por Nível de Cache

**User Story:** Como operador do sistema, quero visualizar quantas análises foram resolvidas por cada nível de cache, para que eu possa avaliar a eficiência do Engram Cache e tomar decisões sobre otimização.

#### Acceptance Criteria

1. THE `FederatedMemoryAdapter` SHALL manter contadores internos `engramHits`, `engramMisses`, `vectorHits`, `vectorMisses`, `federatedHits` e `federatedMisses` inicializados em zero
2. WHEN `recallExact` retorna passaportes, THE `FederatedMemoryAdapter` SHALL incrementar `engramHits` em 1
3. WHEN `recallExact` retorna array vazio, THE `FederatedMemoryAdapter` SHALL incrementar `engramMisses` em 1
4. WHEN a busca por similaridade vetorial local retorna passaportes após um EngramMiss, THE `FederatedMemoryAdapter` SHALL incrementar `vectorHits` em 1
5. WHEN a busca por similaridade vetorial local retorna array vazio, THE `FederatedMemoryAdapter` SHALL incrementar `vectorMisses` em 1
6. WHEN o servidor federado retorna padrões com `confidence >= 0.7` após um VectorMiss, THE `FederatedMemoryAdapter` SHALL incrementar `federatedHits` em 1
7. WHEN o servidor federado retorna array vazio ou falha, THE `FederatedMemoryAdapter` SHALL incrementar `federatedMisses` em 1
8. THE `FederatedMemoryAdapter` SHALL expor um método `getMetrics(): CacheMetrics` que retorna os contadores acumulados e os hit rates calculados para cada nível
9. THE `CacheMetrics` SHALL conter os campos: `engramHits`, `engramMisses`, `engramHitRate`, `vectorHits`, `vectorMisses`, `vectorHitRate`, `federatedHits`, `federatedMisses`, `federatedHitRate`, todos do tipo `number`
10. WHEN `hits + misses = 0` para um nível, THE `FederatedMemoryAdapter` SHALL retornar `hitRate = 0` para aquele nível sem lançar exceção de divisão por zero

### Requirement 3: Exposição de Métricas no Endpoint /stats

**User Story:** Como operador do sistema, quero que o endpoint `/stats` do servidor federado inclua métricas de cache do cliente TypeScript, para que eu tenha visibilidade centralizada da eficiência do sistema de memória.

#### Acceptance Criteria

1. THE `GovernanceEngine` SHALL expor um método `getCacheMetrics(): CacheMetrics` que delega para `FederatedMemoryAdapter.getMetrics()` quando o adaptador de memória for uma instância de `FederatedMemoryAdapter`
2. IF o adaptador de memória não for uma instância de `FederatedMemoryAdapter`, THEN THE `GovernanceEngine` SHALL retornar um `CacheMetrics` com todos os contadores zerados
3. THE servidor federado `FederatedMemoryServer` SHALL aceitar métricas de cache via `POST /stats/client-metrics` com payload contendo os campos de `CacheMetrics`
4. WHEN `GET /stats` é invocado, THE `FederatedMemoryServer` SHALL incluir no response os campos `client_engram_hit_rate`, `client_vector_hit_rate` e `client_federated_hit_rate` com os últimos valores recebidos via `POST /stats/client-metrics`
5. WHEN nenhum `POST /stats/client-metrics` foi recebido, THE `FederatedMemoryServer` SHALL retornar `0.0` para os campos de métricas de cliente em `GET /stats`
6. IF o payload de `POST /stats/client-metrics` contiver campos inválidos (não numéricos ou fora de [0, 1] para hit rates), THEN THE `FederatedMemoryServer` SHALL retornar HTTP 422 com mensagem descritiva

### Requirement 4: Preservação do Comportamento Existente

**User Story:** Como desenvolvedor, quero que a introdução do Engram Cache não quebre nenhum comportamento existente do sistema, para que a feature seja adicionada com segurança sem regressões.

#### Acceptance Criteria

1. THE `HybridMemoryAdapter` SHALL continuar expondo o método `recall(fingerprint, threshold)` com comportamento idêntico ao atual após a adição de `recallExact`
2. THE `FederatedMemoryAdapter` SHALL continuar expondo a interface `IHybridMemory` completa sem alterações de assinatura nos métodos existentes
3. WHEN o `GovernanceEngine` opera com `HybridMemoryAdapter` diretamente (sem `FederatedMemoryAdapter`), THE `GovernanceEngine` SHALL funcionar sem acesso a métricas de engram, retornando métricas zeradas
4. THE `HybridMemoryAdapter` SHALL garantir que o índice `idx_fingerprint_hash` já existente na tabela `governance_passports` seja utilizado pela query de `recallExact`, sem criar índices duplicados
5. FOR ALL passaportes salvos via `save()`, THE `HybridMemoryAdapter` SHALL garantir que `recallExact` com o mesmo `fingerprint_hash` retorna aquele passaporte em consultas subsequentes (propriedade round-trip save → recallExact)

### Requirement 5: N-gramas de AST para Cache Parcial (Fase 2 — Opcional)

**User Story:** Como desenvolvedor, quero que o sistema reconheça padrões estruturais de código mesmo quando o hash exato não existe, para que análises de código estruturalmente similar (mas não idêntico) possam ser parcialmente aceleradas.

#### Acceptance Criteria

1. THE `ASTNgramExtractor` SHALL extrair sequências de N tokens consecutivos do campo `astSignature` de um `CodeFingerprint`, onde N é configurável com valor padrão 3
2. WHEN `astSignature` contém menos tokens que N, THE `ASTNgramExtractor` SHALL retornar um array vazio sem lançar exceção
3. THE `HybridMemoryAdapter` SHALL manter uma tabela `ngram_index` no SQLite com colunas `ngram` (TEXT), `passport_id` (TEXT) e `fingerprint_hash` (TEXT), com índice em `ngram`
4. WHEN um passaporte é salvo via `save()`, THE `HybridMemoryAdapter` SHALL extrair os N-gramas do `astSignature` e inserir entradas correspondentes na tabela `ngram_index`
5. THE `HybridMemoryAdapter` SHALL expor um método `recallByNgrams(fingerprint: CodeFingerprint, minOverlap: number): Promise<GovernancePassport[]>` que retorna passaportes cujos N-gramas têm sobreposição >= `minOverlap` com os N-gramas do fingerprint consultado
6. WHEN `recallByNgrams` é invocado, THE `HybridMemoryAdapter` SHALL posicionar essa busca como terceiro nível de cache, após `recallExact` e antes de `recall` por similaridade vetorial completa
7. FOR ALL `astSignature` strings, THE `ASTNgramExtractor` SHALL garantir que extrair N-gramas e reconstruir a sequência original produz a mesma sequência de tokens (propriedade round-trip de extração)
