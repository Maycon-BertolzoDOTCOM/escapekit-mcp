# Plano de Implementação: Federated Memory (Memória Federada)

## Visão Geral

Implementação em 6 fases incrementais: utilitários base (embedding + privacidade) → adapter TypeScript → servidor Python → testes PBT TypeScript → testes Python → verificação de integração drop-in com GovernanceEngine.

## Tasks

- [x] 1. Adicionar tipos e erros base
  - Adicionar `FederatedPattern`, `PushPayload` e `FederatedMemoryOptions` em `src/governance/types.ts`
  - Adicionar `InvalidPrivacyParameterError` e `FederatedResponseParseError` em `src/governance/errors.ts`
  - _Requirements: 1.1, 2.4, 5.2, 8.4, 8.5_

- [x] 2. Implementar EmbeddingGenerator
  - [x] 2.1 Criar `src/governance/utils/embedding.ts` com `IEmbeddingGenerator` e `EmbeddingGenerator`
    - Concatenação canônica dos campos do `CodeFingerprint`
    - Seed expansion com SHA-256 iterado (12 hashes × 32 dims = 384 dims)
    - L2 normalization para norma unitária
    - Usar `sha256()` de `src/governance/utils/hash.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 Escrever property test P1: dimensão do embedding
    - **Property 1: Dimensão do embedding**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Escrever property test P2: determinismo do embedding
    - **Property 2: Determinismo do embedding**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Escrever property test P3: similaridade preservada no espaço de embedding
    - **Property 3: Similaridade preservada no espaço de embedding**
    - Usar `computeSimilarity()` de `src/governance/utils/fingerprint.ts`
    - **Validates: Requirements 1.4**

- [x] 3. Implementar DifferentialPrivacy
  - [x] 3.1 Criar `src/governance/utils/privacy.ts` com `IDifferentialPrivacy` e `DifferentialPrivacy`
    - Mecanismo Laplace: `scale = 1.0 / epsilon`, transformação via Uniform(-0.5, 0.5)
    - Mecanismo Gaussiano: Box-Muller com `sigma = sqrt(2 * ln(1.25 / 1e-5)) / epsilon`
    - Lançar `InvalidPrivacyParameterError` se `epsilon <= 0`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Escrever property test P4: epsilon controla magnitude do ruído
    - **Property 4: Epsilon controla magnitude do ruído**
    - Verificação estatística: norma L2 do ruído com epsilon1 < epsilon2 deve ser maior em média
    - **Validates: Requirements 2.3**

  - [ ]* 3.3 Escrever property test P5: epsilon inválido lança erro
    - **Property 5: Epsilon inválido lança InvalidPrivacyParameterError**
    - Usar `arbInvalidEpsilon` (valores <= 0)
    - **Validates: Requirements 2.4**

  - [ ]* 3.4 Escrever property test P6: dimensão preservada após adição de ruído
    - **Property 6: Dimensão preservada após adição de ruído**
    - **Validates: Requirements 2.5**

- [x] 4. Checkpoint — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 5. Implementar FederatedMemoryAdapter
  - [x] 5.1 Criar `src/governance/adapters/FederatedMemoryAdapter.ts` implementando `IHybridMemory`
    - Compor `HybridMemoryAdapter` como `LocalCache` interno
    - Injetar `EmbeddingGenerator` e `DifferentialPrivacy`
    - Expor propriedade `sharePatterns` (padrão: `true`)
    - _Requirements: 3.1, 6.1, 6.5_

  - [x] 5.2 Implementar `recall()` com fluxo cache-miss → pull federado
    - Consultar `LocalCache` primeiro; retornar imediatamente se não-vazio
    - Em cache miss: gerar embedding, `GET /query` com timeout `pullTimeout` (padrão 3000ms)
    - Filtrar padrões com `confidence >= 0.7`, converter para `GovernancePassport` sintético
    - Persistir padrões filtrados no `LocalCache`
    - Retornar `[]` silenciosamente em timeout ou HTTP 5xx (log `warn`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.2_

  - [x] 5.3 Implementar `save()` com push assíncrono fire-and-forget
    - Persistir no `LocalCache` de forma síncrona
    - Se `sharePatterns=true` e `riskLevel='low'`: gerar embedding, adicionar ruído DP, montar `PushPayload`, `POST /push` (fire-and-forget, timeout `pushTimeout` padrão 5000ms)
    - Payload deve conter apenas `embedding`, `rule_type`, `success_count`, `sector?`
    - Descartar silenciosamente em timeout ou erro (log `warn`)
    - _Requirements: 3.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.3_

  - [x] 5.4 Implementar `getSuccessRate()` e `deserializeFederatedPattern()`
    - `getSuccessRate()` delega ao `LocalCache`
    - `deserializeFederatedPattern()`: parse JSON, validar campos obrigatórios e domínios, lançar `FederatedResponseParseError` em falha
    - _Requirements: 6.4, 8.2, 8.4, 8.5_

  - [ ]* 5.5 Escrever property test P7: push ocorre se e somente se sharePatterns=true AND riskLevel=low
    - **Property 7: Push ocorre se e somente se sharePatterns=true AND riskLevel=low**
    - **Validates: Requirements 3.2, 5.1**

  - [ ]* 5.6 Escrever property test P8: sharePatterns=false não bloqueia pull
    - **Property 8: sharePatterns=false não bloqueia pull**
    - **Validates: Requirements 3.3**

  - [ ]* 5.7 Escrever property test P9: cache miss dispara pull federado
    - **Property 9: Cache miss dispara pull federado**
    - **Validates: Requirements 4.1, 6.2**

  - [ ]* 5.8 Escrever property test P10: padrões com confidence >= 0.7 são cacheados após pull
    - **Property 10: Padrões com confidence >= 0.7 são cacheados após pull**
    - **Validates: Requirements 4.2**

  - [ ]* 5.9 Escrever property test P11: HTTP 5xx retorna lista vazia sem exceção
    - **Property 11: HTTP 5xx retorna lista vazia sem exceção**
    - **Validates: Requirements 4.5**

  - [ ]* 5.10 Escrever property test P12: payload de push não contém dados sensíveis
    - **Property 12: Payload de push não contém dados sensíveis**
    - Verificar ausência de `hash`, `astSignature`, IPs, timestamps, nomes de projeto/usuário
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 5.11 Escrever property test P13: push é assíncrono (não bloqueia save)
    - **Property 13: Push é assíncrono (não bloqueia save)**
    - **Validates: Requirements 5.5**

  - [ ]* 5.12 Escrever property test P14: getSuccessRate retorna valor em [0, 1]
    - **Property 14: getSuccessRate retorna valor em [0, 1]**
    - **Validates: Requirements 6.4**

  - [ ]* 5.13 Escrever property tests P18–P20: serialização/deserialização
    - **Property 18: Round-trip de FederatedPattern**
    - **Property 19: JSON malformado lança FederatedResponseParseError**
    - **Property 20: Campos obrigatórios validados na deserialização**
    - **Validates: Requirements 8.3, 8.4, 8.5**

- [x] 6. Checkpoint — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 7. Implementar FederatedMemoryServer (Python/FastAPI)
  - [x] 7.1 Criar `federated-server/requirements.txt`
    - Incluir: `fastapi`, `uvicorn`, `pydantic`, `chromadb`, `numpy`, `pytest`, `httpx`, `hypothesis`
    - _Requirements: 7.5_

  - [x] 7.2 Criar `federated-server/main.py` com modelos Pydantic e endpoints
    - Modelos `PushRequest` (com validator `check_dims`) e `FederatedPatternResponse`
    - `POST /push`: validar schema, verificar similaridade cosseno >= 0.85 com padrões existentes, agregar ou inserir
    - `GET /query`: ANN search no banco vetorial, retornar lista ordenada por `confidence` decrescente, respeitar `limit` em [1, 20]
    - Banco vetorial configurável via `VECTOR_STORE` env var (`chroma` | `qdrant` | `pgvector`), padrão `chroma`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.3 Criar `federated-server/tests/test_server.py` com testes pytest + hypothesis
    - Property test P15: resultados do `GET /query` ordenados por confidence decrescente
    - Property test P16: `POST /push` rejeita embedding com dimensão != 384 com HTTP 422
    - Property test P17: dois pushes com similaridade cosseno >= 0.85 resultam em um único padrão com success_count incrementado
    - _Requirements: 7.3, 7.4, 7.6_

- [x] 8. Checkpoint — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 9. Verificar integração drop-in com GovernanceEngine
  - [x] 9.1 Escrever testes de integração em `tests/governance/FederatedMemoryAdapter.test.ts`
    - Property test P21: `memoryEnriched=true` quando padrões federados retornados
    - Property test P22: `GovernanceEngine` resiliente a servidor indisponível
    - Verificar que `GovernanceEngine` aceita `FederatedMemoryAdapter` via `GovernanceEngineDeps` sem modificação de código
    - _Requirements: 6.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 9.2 Confirmar que nenhuma modificação em `GovernanceEngine.ts` é necessária
    - Verificar que `FederatedMemoryAdapter` satisfaz `IHybridMemory` via type-check
    - Verificar que `GovernanceEngineDeps.memory` aceita `FederatedMemoryAdapter`
    - _Requirements: 6.5, 9.1_

- [x] 10. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requirements específicos para rastreabilidade
- O `GovernanceEngine` não deve ser modificado — `FederatedMemoryAdapter` é drop-in replacement
- Erros no servidor federado nunca devem interromper o fluxo de governança (degradação graciosa)
- Property tests usam `fast-check` (TypeScript) e `hypothesis` (Python) com mínimo 100 iterações
