# Requirements Document

## Introduction

Memória Federada é uma feature do CodeMemória / EscapeKit que cria um efeito de rede entre instâncias distribuídas (browser, edge, on-premise). Cada instância aprende com suas validações e compartilha esse conhecimento — anonimizado — com um servidor central. O servidor agrega os padrões por similaridade e os distribui de volta. Quanto mais instâncias participam, mais rico fica o conhecimento coletivo, sem que nenhum dado bruto (código-fonte, credenciais, IPs) seja transmitido.

O sistema é composto por dois componentes principais: o **FederatedMemoryAdapter** (TypeScript, lado cliente) e o **FederatedMemoryServer** (Python/FastAPI, lado servidor).

## Glossary

- **FederatedMemoryAdapter**: Componente TypeScript que implementa `IHybridMemory` e orquestra cache local + consulta federada.
- **FederatedMemoryServer**: Servidor Python/FastAPI que agrega embeddings anonimizados e responde a queries de similaridade.
- **Embedding**: Vetor numérico de dimensão fixa derivado do `CodeFingerprint`. Não permite reconstrução do código-fonte.
- **FederatedPattern**: Padrão agregado retornado pelo servidor, contendo `pattern_id`, `confidence`, `rules_applied` e `success_rate`.
- **DifferentialPrivacyNoise**: Ruído Laplace ou Gaussiano adicionado ao embedding antes do envio, garantindo privacidade diferencial.
- **SharePatternsToggle**: Flag de opt-in por instância que controla se embeddings são enviados ao servidor federado.
- **GovernanceEngine**: Orquestrador central de governança que usa `IHybridMemory` via injeção de dependências.
- **CodeFingerprint**: Estrutura existente com `hash`, `astSignature`, `dependencies` e `complexity`.
- **IHybridMemory**: Interface existente com `save()`, `recall()` e `getSuccessRate()`.
- **HybridMemoryAdapter**: Implementação existente de `IHybridMemory` usando SQLite + Chroma opcional.
- **LocalCache**: Cache local (SQLite/Chroma) gerenciado pelo `HybridMemoryAdapter` existente.
- **Sector**: Metadado opcional de setor de negócio (ex: `fintech`, `saude`, `educacao`).
- **RuleType**: Tipo de regra de conformidade (ex: `LGPD`, `OWASP`, `PCI-DSS`).

## Requirements

### Requirement 1: Geração de Embedding a partir do CodeFingerprint

**User Story:** Como desenvolvedor integrando o CodeMemória, quero que o sistema derive um embedding numérico do `CodeFingerprint` sem expor o código-fonte, para que padrões possam ser comparados de forma privada.

#### Acceptance Criteria

1. THE `FederatedMemoryAdapter` SHALL derivar um embedding de dimensão fixa (384 dimensões) a partir dos campos `hash`, `astSignature`, `dependencies` e `complexity` do `CodeFingerprint`.
2. THE `FederatedMemoryAdapter` SHALL produzir embeddings determinísticos: para o mesmo `CodeFingerprint`, o embedding gerado SHALL ser idêntico.
3. THE `FederatedMemoryAdapter` SHALL produzir embeddings não-inversíveis: dado um embedding, o `FederatedMemoryAdapter` SHALL ser incapaz de reconstruir o código-fonte original.
4. WHEN dois `CodeFingerprint`s com `computeSimilarity()` >= 0.9 são fornecidos, THE `FederatedMemoryAdapter` SHALL produzir embeddings com distância cosseno <= 0.15.

---

### Requirement 2: Privacidade Diferencial no Envio de Embeddings

**User Story:** Como responsável pela privacidade do produto, quero que ruído seja adicionado aos embeddings antes do envio ao servidor, para que padrões individuais não possam ser rastreados de volta a uma instância específica.

#### Acceptance Criteria

1. WHEN o `FederatedMemoryAdapter` prepara um embedding para envio, THE `FederatedMemoryAdapter` SHALL adicionar ruído `DifferentialPrivacyNoise` ao vetor antes da transmissão.
2. THE `FederatedMemoryAdapter` SHALL suportar dois mecanismos de ruído: Laplace e Gaussiano, configuráveis via parâmetro `noiseType`.
3. THE `FederatedMemoryAdapter` SHALL aceitar um parâmetro `epsilon` (número real > 0) que controla a magnitude do ruído: valores menores de `epsilon` produzem maior privacidade.
4. IF o parâmetro `epsilon` fornecido for <= 0, THEN THE `FederatedMemoryAdapter` SHALL lançar um `InvalidPrivacyParameterError` com mensagem descritiva.
5. THE `FederatedMemoryAdapter` SHALL garantir que o embedding com ruído tenha a mesma dimensão (384) que o embedding original.

---

### Requirement 3: Opt-in via SharePatternsToggle

**User Story:** Como operador de uma instância do CodeMemória, quero controlar se minha instância contribui com padrões para o servidor federado, para que eu possa cumprir políticas internas de dados.

#### Acceptance Criteria

1. THE `FederatedMemoryAdapter` SHALL expor uma propriedade `sharePatterns` do tipo booleano, com valor padrão `true`.
2. WHEN `sharePatterns` é `false`, THE `FederatedMemoryAdapter` SHALL omitir o envio de embeddings ao `FederatedMemoryServer` após validações bem-sucedidas.
3. WHEN `sharePatterns` é `false`, THE `FederatedMemoryAdapter` SHALL continuar realizando consultas ao `FederatedMemoryServer` normalmente (somente o push é desabilitado).
4. WHERE a instância opera em ambiente `on-premise` com `sharePatterns = false`, THE `FederatedMemoryAdapter` SHALL operar exclusivamente com o `LocalCache` sem degradação de funcionalidade.

---

### Requirement 4: Consulta ao Servidor Federado (Pull)

**User Story:** Como instância do CodeMemória com cache local vazio, quero consultar o servidor federado para obter padrões similares, para que eu possa aplicar regras sem depender de LLM como primeiro recurso.

#### Acceptance Criteria

1. WHEN o `LocalCache` não retorna passaportes para um `CodeFingerprint` (cache miss), THE `FederatedMemoryAdapter` SHALL consultar o `FederatedMemoryServer` via `GET /query?embedding=...&limit=5`.
2. WHEN o `FederatedMemoryServer` retorna `FederatedPattern`s com `confidence` >= 0.7, THE `FederatedMemoryAdapter` SHALL armazenar os padrões recebidos no `LocalCache` para uso futuro.
3. WHEN o `FederatedMemoryServer` retorna `FederatedPattern`s, THE `FederatedMemoryAdapter` SHALL retornar os padrões como `GovernancePassport`s sintéticos para o `GovernanceEngine`.
4. IF o `FederatedMemoryServer` não responder dentro de 3000ms, THEN THE `FederatedMemoryAdapter` SHALL retornar lista vazia e registrar o timeout em log de aviso, sem lançar exceção.
5. IF o `FederatedMemoryServer` retornar status HTTP >= 500, THEN THE `FederatedMemoryAdapter` SHALL retornar lista vazia e registrar o erro, sem interromper o fluxo de governança.

---

### Requirement 5: Envio de Padrões ao Servidor Federado (Push)

**User Story:** Como instância do CodeMemória após uma validação bem-sucedida, quero contribuir com o padrão aprendido para o servidor federado, para que outras instâncias se beneficiem do conhecimento coletivo.

#### Acceptance Criteria

1. WHEN uma validação resulta em `riskLevel` igual a `low` e `sharePatterns` é `true`, THE `FederatedMemoryAdapter` SHALL enviar o embedding com `DifferentialPrivacyNoise` ao `FederatedMemoryServer` via `POST /push`.
2. THE `FederatedMemoryAdapter` SHALL incluir no payload de push apenas: embedding com ruído, `sector` (opcional), `ruleType`, e `successCount` (inteiro >= 1).
3. THE `FederatedMemoryAdapter` SHALL garantir que o payload de push NÃO contenha: código-fonte, credenciais, IPs, timestamps exatos, nomes de projetos ou nomes de usuários.
4. IF o `FederatedMemoryServer` não responder ao push dentro de 5000ms, THEN THE `FederatedMemoryAdapter` SHALL descartar o envio silenciosamente e registrar em log de aviso.
5. THE `FederatedMemoryAdapter` SHALL realizar o push de forma assíncrona, sem bloquear o retorno do `GovernancePassport` ao chamador.

---

### Requirement 6: Implementação da Interface IHybridMemory

**User Story:** Como desenvolvedor usando o `GovernanceEngine`, quero que o `FederatedMemoryAdapter` seja um substituto direto do `HybridMemoryAdapter`, para que a integração não exija mudanças no `GovernanceEngine`.

#### Acceptance Criteria

1. THE `FederatedMemoryAdapter` SHALL implementar a interface `IHybridMemory` com os métodos `save()`, `recall()` e `getSuccessRate()`.
2. WHEN `recall()` é chamado, THE `FederatedMemoryAdapter` SHALL primeiro consultar o `LocalCache` e, em caso de cache miss, consultar o `FederatedMemoryServer`.
3. WHEN `save()` é chamado com um `GovernancePassport`, THE `FederatedMemoryAdapter` SHALL persistir o passaporte no `LocalCache` e, se `sharePatterns` for `true` e `riskLevel` for `low`, disparar o push federado.
4. WHEN `getSuccessRate()` é chamado, THE `FederatedMemoryAdapter` SHALL retornar a taxa de sucesso do `LocalCache` combinada com a taxa agregada do `FederatedMemoryServer` para o fingerprint fornecido.
5. THE `GovernanceEngine` SHALL aceitar um `FederatedMemoryAdapter` no lugar de `HybridMemoryAdapter` sem modificação de código.

---

### Requirement 7: API REST do FederatedMemoryServer

**User Story:** Como operador do servidor federado, quero uma API REST bem definida para receber e distribuir padrões, para que instâncias heterogêneas (browser, edge, on-premise) possam interoperar.

#### Acceptance Criteria

1. THE `FederatedMemoryServer` SHALL expor o endpoint `POST /push` que aceita payload JSON com campos `embedding` (array de 384 floats), `rule_type` (string), `success_count` (inteiro >= 1) e `sector` (string opcional).
2. THE `FederatedMemoryServer` SHALL expor o endpoint `GET /query` que aceita parâmetros `embedding` (array de 384 floats serializado) e `limit` (inteiro entre 1 e 20, padrão 5).
3. WHEN `GET /query` é chamado, THE `FederatedMemoryServer` SHALL retornar uma lista de `FederatedPattern`s ordenada por `confidence` decrescente.
4. IF o payload de `POST /push` contiver `embedding` com dimensão diferente de 384, THEN THE `FederatedMemoryServer` SHALL retornar HTTP 422 com mensagem de erro descritiva.
5. THE `FederatedMemoryServer` SHALL persistir padrões recebidos em banco vetorial (Chroma, Qdrant ou PostgreSQL pgvector) configurável via variável de ambiente `VECTOR_STORE`.
6. THE `FederatedMemoryServer` SHALL agregar padrões com similaridade cosseno >= 0.85 incrementando o `success_count` do padrão existente em vez de criar duplicata.

---

### Requirement 8: Serialização e Deserialização do FederatedPattern

**User Story:** Como desenvolvedor integrando cliente e servidor, quero que o formato de `FederatedPattern` seja serializado e deserializado de forma confiável, para que dados não sejam corrompidos em trânsito.

#### Acceptance Criteria

1. THE `FederatedMemoryAdapter` SHALL serializar `FederatedPattern` para JSON antes do envio via HTTP.
2. THE `FederatedMemoryAdapter` SHALL deserializar a resposta JSON do `FederatedMemoryServer` para objetos `FederatedPattern` tipados.
3. FOR ALL `FederatedPattern`s válidos, serializar e depois deserializar SHALL produzir um objeto equivalente ao original (propriedade round-trip).
4. IF a resposta do `FederatedMemoryServer` contiver JSON malformado, THEN THE `FederatedMemoryAdapter` SHALL lançar um `FederatedResponseParseError` com a causa original.
5. THE `FederatedMemoryAdapter` SHALL validar que cada `FederatedPattern` deserializado contém os campos obrigatórios `pattern_id` (string), `confidence` (número em [0,1]), `rules_applied` (array de strings) e `success_rate` (número em [0,1]).

---

### Requirement 9: Integração com GovernanceEngine

**User Story:** Como desenvolvedor usando o `GovernanceEngine`, quero que ele consulte automaticamente a memória federada quando o cache local falha, para que o sistema aproveite o conhecimento coletivo sem configuração adicional.

#### Acceptance Criteria

1. WHEN o `GovernanceEngine` é inicializado com um `FederatedMemoryAdapter` via `GovernanceEngineDeps`, THE `GovernanceEngine` SHALL usar o `FederatedMemoryAdapter` para todas as operações de memória.
2. WHEN o `GovernanceEngine` executa `recall()` e o `FederatedMemoryAdapter` retorna padrões federados, THE `GovernanceEngine` SHALL marcar o `GovernancePassport` resultante com `memoryEnriched = true`.
3. WHEN o `GovernanceEngine` conclui uma validação com `riskLevel = low`, THE `GovernanceEngine` SHALL chamar `save()` no `FederatedMemoryAdapter`, que por sua vez dispara o push federado assíncrono.
4. THE `GovernanceEngine` SHALL continuar funcionando normalmente se o `FederatedMemoryServer` estiver indisponível, usando apenas o `LocalCache`.
