# Design Document — Federated Memory

## Overview

Memória Federada adiciona uma camada de conhecimento coletivo ao CodeMemória. Cada instância (browser, edge, on-premise) aprende com suas próprias validações e contribui — de forma anonimizada — com um servidor central. O servidor agrega padrões por similaridade vetorial e os distribui de volta. O resultado é um efeito de rede: quanto mais instâncias participam, mais rico fica o conhecimento compartilhado, sem que nenhum dado bruto (código-fonte, credenciais, IPs) seja transmitido.

O design é composto por dois componentes principais:

- **FederatedMemoryAdapter** (TypeScript) — implementa `IHybridMemory`, compõe o `HybridMemoryAdapter` como cache local e orquestra pull/push federado.
- **FederatedMemoryServer** (Python/FastAPI) — agrega embeddings anonimizados, responde a queries de similaridade e persiste padrões em banco vetorial configurável.

Ambos se comunicam via HTTP REST. O `GovernanceEngine` existente não precisa de nenhuma modificação — o `FederatedMemoryAdapter` é um drop-in replacement para `HybridMemoryAdapter`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GovernanceEngine                         │
│  (sem modificação — usa IHybridMemory via GovernanceEngineDeps) │
└────────────────────────────┬────────────────────────────────────┘
                             │ IHybridMemory
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FederatedMemoryAdapter                        │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐   │
│  │  HybridMemoryAdapter │   │     EmbeddingGenerator       │   │
│  │  (LocalCache)        │   │  CodeFingerprint → float[384]│   │
│  │  SQLite + Chroma?    │   └──────────────────────────────┘   │
│  └──────────────────────┘   ┌──────────────────────────────┐   │
│                             │     DifferentialPrivacy      │   │
│                             │  Laplace / Gaussian noise    │   │
│                             └──────────────────────────────┘   │
└──────────┬──────────────────────────────────┬───────────────────┘
           │ cache miss → GET /query          │ riskLevel=low → POST /push (async)
           ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FederatedMemoryServer (Python/FastAPI)        │
│                                                                 │
│   POST /push   ──►  aggregate by cosine similarity >= 0.85     │
│   GET  /query  ──►  ANN search → FederatedPattern[]            │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │  Vector Store (Chroma | Qdrant | pgvector)               │  │
│   │  configurável via VECTOR_STORE env var                   │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de recall() — cache miss → pull federado

```
GovernanceEngine.govern()
  │
  ├─► FederatedMemoryAdapter.recall(fingerprint, threshold)
  │     │
  │     ├─► LocalCache.recall(fingerprint, threshold)
  │     │     └─► [resultados]  ──► se len > 0: retorna imediatamente
  │     │
  │     │   (cache miss: len == 0)
  │     │
  │     ├─► EmbeddingGenerator.generate(fingerprint)  → float[384]
  │     │
  │     ├─► HTTP GET /query?embedding=...&limit=5  (timeout 3000ms)
  │     │     ├─► timeout / HTTP 5xx → retorna []  (fallback silencioso)
  │     │     └─► FederatedPattern[]
  │     │
  │     ├─► filtra confidence >= 0.7
  │     ├─► converte FederatedPattern → GovernancePassport sintético
  │     ├─► armazena no LocalCache (para uso futuro)
  │     └─► retorna GovernancePassport[]
  │
  └─► memoryEnriched = (resultados.length > 0)
```

### Fluxo de save() — push assíncrono

```
GovernanceEngine.govern()  →  memory.save(passport)
  │
  └─► FederatedMemoryAdapter.save(passport)
        │
        ├─► LocalCache.save(passport)  (síncrono, aguarda)
        │
        └─► se sharePatterns=true AND passport.riskLevel='low':
              │  (fire-and-forget, não bloqueia retorno)
              ├─► EmbeddingGenerator.generate(passport.codeFingerprint)
              ├─► DifferentialPrivacy.addNoise(embedding, epsilon, noiseType)
              ├─► monta PushPayload { embedding, rule_type, success_count, sector? }
              └─► HTTP POST /push  (timeout 5000ms)
                    ├─► timeout / erro → log warn, descarta silenciosamente
                    └─► 200 OK → sucesso (ignorado pelo chamador)
```

---

## Components and Interfaces

### EmbeddingGenerator

Localização: `src/governance/utils/embedding.ts`

Responsável por derivar um vetor de 384 dimensões a partir de um `CodeFingerprint`, de forma determinística e não-inversível.

**Algoritmo de geração de embedding:**

O objetivo é expandir os campos do `CodeFingerprint` em 384 floats em `[-1, 1]` sem depender de modelos de ML externos. A estratégia usa hashing determinístico com múltiplas sementes (técnica de "hash expansion"):

1. **Concatenação canônica**: serializa os campos em string canônica:
   ```
   input = `${hash}|${astSignature}|${dependencies.sort().join(',')}|${complexity}`
   ```
2. **Seed expansion**: gera 384 valores usando SHA-256 iterado com sementes incrementais:
   ```
   for i in 0..383:
     seed_input = `${input}:${Math.floor(i / 32)}:${i % 32}`
     byte_i = SHA256(seed_input)[i % 32]
     raw[i] = (byte_i - 128) / 128.0   // normaliza para [-1, 1]
   ```
   Cada grupo de 32 dimensões usa um hash SHA-256 diferente (12 hashes no total para 384 dims), garantindo que dimensões próximas não sejam trivialmente correlacionadas.
3. **L2 normalization**: normaliza o vetor resultante para norma unitária:
   ```
   norm = sqrt(sum(raw[i]^2))
   embedding[i] = raw[i] / norm
   ```

Propriedades garantidas:
- **Determinístico**: mesmo `CodeFingerprint` → mesmo embedding.
- **Não-inversível**: SHA-256 é one-way; não é possível reconstruir `hash` ou `astSignature` a partir do embedding.
- **Sensível a similaridade**: fingerprints com `computeSimilarity() >= 0.9` compartilham estrutura similar (mesmas dependências, complexidade próxima), o que resulta em embeddings com distância cosseno baixa.

```typescript
export interface IEmbeddingGenerator {
  generate(fingerprint: CodeFingerprint): Float32Array; // 384 dims, norma unitária
}
```

### DifferentialPrivacy

Localização: `src/governance/utils/privacy.ts`

Adiciona ruído calibrado ao embedding antes do envio, garantindo privacidade diferencial (ε-DP).

**Algoritmo Laplace:**
```
sensitivity = 1.0  // L1 sensitivity do embedding normalizado
scale = sensitivity / epsilon
noise[i] = Laplace(0, scale)
         = sign(u) * scale * ln(1 - 2|u|)  onde u ~ Uniform(-0.5, 0.5)
```

**Algoritmo Gaussiano:**
```
sensitivity = 1.0  // L2 sensitivity
sigma = sensitivity * sqrt(2 * ln(1.25 / delta)) / epsilon
      (com delta = 1e-5 como padrão)
noise[i] = Normal(0, sigma)
         = Box-Muller: sqrt(-2*ln(u1)) * cos(2π*u2)  onde u1,u2 ~ Uniform(0,1)
```

O vetor resultante mantém 384 dimensões (ruído adicionado elemento a elemento).

```typescript
export type NoiseType = 'laplace' | 'gaussian';

export interface IDifferentialPrivacy {
  addNoise(embedding: Float32Array, epsilon: number, noiseType: NoiseType): Float32Array;
}
```

### FederatedMemoryAdapter

Localização: `src/governance/adapters/FederatedMemoryAdapter.ts`

Implementa `IHybridMemory` compondo `HybridMemoryAdapter` como cache local.

```typescript
export interface FederatedMemoryOptions {
  // Opções repassadas ao HybridMemoryAdapter interno
  sqlitePath: string;
  enableChroma?: boolean;
  // Configuração federada
  serverUrl: string;           // ex: "http://federated-server:8000"
  sharePatterns?: boolean;     // padrão: true
  epsilon?: number;            // padrão: 1.0, deve ser > 0
  noiseType?: NoiseType;       // padrão: 'laplace'
  sector?: string;             // ex: 'fintech', 'saude'
  pullTimeout?: number;        // ms, padrão: 3000
  pushTimeout?: number;        // ms, padrão: 5000
}

export class FederatedMemoryAdapter implements IHybridMemory {
  readonly sharePatterns: boolean;
  // ...
  async save(passport: GovernancePassport): Promise<void>;
  async recall(fingerprint: CodeFingerprint, threshold: number): Promise<GovernancePassport[]>;
  async getSuccessRate(fingerprint: CodeFingerprint): Promise<number>;
}
```

### FederatedMemoryServer

Localização: `federated-server/main.py`

API REST FastAPI com dois endpoints. Persiste padrões em banco vetorial configurável via `VECTOR_STORE` env var (`chroma` | `qdrant` | `pgvector`).

---

## Data Models

### Novos tipos em `src/governance/types.ts`

```typescript
/** Padrão agregado retornado pelo FederatedMemoryServer */
export interface FederatedPattern {
  pattern_id: string;           // UUID
  confidence: number;           // [0, 1]
  rules_applied: string[];      // ex: ['LGPD-art13', 'OWASP-A01']
  success_rate: number;         // [0, 1]
}

/** Payload enviado ao servidor no POST /push */
export interface PushPayload {
  embedding: number[];          // 384 floats com ruído DP
  rule_type: string;
  success_count: number;        // >= 1
  sector?: string;
}

/** Erros específicos da feature */
export class InvalidPrivacyParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPrivacyParameterError';
  }
}

export class FederatedResponseParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FederatedResponseParseError';
  }
}
```

### Contrato da API REST

#### `POST /push`

Request body (JSON):
```json
{
  "embedding":     [0.012, -0.034, ...],  // array de exatamente 384 floats
  "rule_type":     "LGPD",                // string obrigatória
  "success_count": 3,                     // inteiro >= 1
  "sector":        "fintech"              // string opcional
}
```

Response `200 OK`:
```json
{ "status": "ok", "pattern_id": "uuid-v4" }
```

Response `422 Unprocessable Entity` (embedding com dimensão errada):
```json
{ "detail": "embedding must have exactly 384 dimensions, got 128" }
```

#### `GET /query`

Query params:
- `embedding`: JSON array de 384 floats (URL-encoded)
- `limit`: inteiro em [1, 20], padrão 5

Response `200 OK`:
```json
[
  {
    "pattern_id":    "uuid-v4",
    "confidence":    0.92,
    "rules_applied": ["LGPD-art13", "OWASP-A01"],
    "success_rate":  0.87
  }
]
```
Ordenado por `confidence` decrescente.

### Modelos Pydantic (servidor Python)

```python
class PushRequest(BaseModel):
    embedding: list[float]      # validado: len == 384
    rule_type: str
    success_count: int          # >= 1
    sector: str | None = None

    @validator('embedding')
    def check_dims(cls, v):
        if len(v) != 384:
            raise ValueError(f'embedding must have exactly 384 dimensions, got {len(v)}')
        return v

class FederatedPatternResponse(BaseModel):
    pattern_id: str
    confidence: float           # [0, 1]
    rules_applied: list[str]
    success_rate: float         # [0, 1]
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Dimensão do embedding

*For any* `CodeFingerprint` válido, `EmbeddingGenerator.generate()` deve retornar um `Float32Array` com exatamente 384 elementos.

**Validates: Requirements 1.1**

---

### Property 2: Determinismo do embedding

*For any* `CodeFingerprint`, chamar `EmbeddingGenerator.generate()` duas vezes com o mesmo input deve produzir vetores idênticos elemento a elemento.

**Validates: Requirements 1.2**

---

### Property 3: Similaridade preservada no espaço de embedding

*For any* par de `CodeFingerprint`s onde `computeSimilarity(a, b) >= 0.9`, a distância cosseno entre `generate(a)` e `generate(b)` deve ser `<= 0.15`.

**Validates: Requirements 1.4**

---

### Property 4: Epsilon controla magnitude do ruído

*For any* embedding de 384 dims e qualquer par `0 < epsilon1 < epsilon2`, a norma L2 do ruído produzido com `epsilon1` deve ser maior ou igual à norma do ruído produzido com `epsilon2` (em média sobre múltiplas amostras — verificado estatisticamente).

**Validates: Requirements 2.3**

---

### Property 5: Epsilon inválido lança erro

*For any* valor de `epsilon <= 0`, chamar `DifferentialPrivacy.addNoise()` deve lançar `InvalidPrivacyParameterError` com mensagem descritiva.

**Validates: Requirements 2.4**

---

### Property 6: Dimensão preservada após adição de ruído

*For any* `Float32Array` de 384 dims e qualquer `epsilon > 0`, `DifferentialPrivacy.addNoise()` deve retornar um `Float32Array` com exatamente 384 elementos.

**Validates: Requirements 2.5**

---

### Property 7: Push ocorre se e somente se sharePatterns=true AND riskLevel=low

*For any* `GovernancePassport`, o `FederatedMemoryAdapter` deve enviar `POST /push` se e somente se `sharePatterns === true` e `passport.riskLevel === 'low'`. Para qualquer outra combinação (sharePatterns=false, ou riskLevel != 'low'), nenhum push deve ser disparado.

**Validates: Requirements 3.2, 5.1**

---

### Property 8: sharePatterns=false não bloqueia pull

*For any* `CodeFingerprint` que resulta em cache miss, quando `sharePatterns === false`, o `FederatedMemoryAdapter` deve ainda realizar `GET /query` ao servidor federado.

**Validates: Requirements 3.3**

---

### Property 9: Cache miss dispara pull federado

*For any* `CodeFingerprint` para o qual o `LocalCache` retorna lista vazia, `FederatedMemoryAdapter.recall()` deve realizar uma chamada `GET /query` ao `FederatedMemoryServer`.

**Validates: Requirements 4.1, 6.2**

---

### Property 10: Padrões com confidence >= 0.7 são cacheados após pull

*For any* lista de `FederatedPattern`s retornada pelo servidor, apenas os padrões com `confidence >= 0.7` devem ser persistidos no `LocalCache` para uso futuro.

**Validates: Requirements 4.2**

---

### Property 11: HTTP 5xx retorna lista vazia sem exceção

*For any* status HTTP `>= 500` retornado pelo `FederatedMemoryServer`, `FederatedMemoryAdapter.recall()` deve retornar `[]` sem lançar exceção.

**Validates: Requirements 4.5**

---

### Property 12: Payload de push não contém dados sensíveis

*For any* `GovernancePassport`, o payload enviado via `POST /push` deve conter apenas os campos `embedding`, `rule_type`, `success_count` e opcionalmente `sector` — nunca código-fonte, credenciais, IPs, timestamps exatos, nomes de projetos ou usuários.

**Validates: Requirements 5.2, 5.3**

---

### Property 13: Push é assíncrono (não bloqueia save)

*For any* `GovernancePassport` com `riskLevel=low` e `sharePatterns=true`, `FederatedMemoryAdapter.save()` deve retornar antes de o push HTTP completar (o push é fire-and-forget).

**Validates: Requirements 5.5**

---

### Property 14: getSuccessRate retorna valor em [0, 1]

*For any* `CodeFingerprint`, `FederatedMemoryAdapter.getSuccessRate()` deve retornar um número no intervalo `[0, 1]`.

**Validates: Requirements 6.4**

---

### Property 15: Resultados do servidor ordenados por confidence decrescente

*For any* query ao `FederatedMemoryServer`, a lista de `FederatedPattern`s retornada deve estar ordenada por `confidence` em ordem decrescente.

**Validates: Requirements 7.3**

---

### Property 16: Servidor rejeita embedding com dimensão errada

*For any* array com comprimento diferente de 384 enviado ao `POST /push`, o servidor deve retornar HTTP 422 com mensagem de erro descritiva.

**Validates: Requirements 7.4**

---

### Property 17: Servidor agrega padrões similares em vez de duplicar

*For any* par de embeddings com similaridade cosseno `>= 0.85`, realizar dois pushes consecutivos deve resultar em um único padrão no banco vetorial com `success_count` incrementado, não dois padrões separados.

**Validates: Requirements 7.6**

---

### Property 18: Round-trip de FederatedPattern

*For any* `FederatedPattern` válido (com todos os campos obrigatórios em seus domínios corretos), serializar para JSON e depois deserializar deve produzir um objeto equivalente ao original.

**Validates: Requirements 8.3**

---

### Property 19: JSON malformado lança FederatedResponseParseError

*For any* string que não seja JSON válido, a função de deserialização do `FederatedMemoryAdapter` deve lançar `FederatedResponseParseError` com a causa original.

**Validates: Requirements 8.4**

---

### Property 20: Campos obrigatórios validados na deserialização

*For any* objeto JSON que não contenha todos os campos obrigatórios de `FederatedPattern` (`pattern_id`, `confidence`, `rules_applied`, `success_rate`) ou que contenha valores fora de seus domínios (`confidence` fora de [0,1], `success_rate` fora de [0,1]), a validação deve falhar com erro descritivo.

**Validates: Requirements 8.5**

---

### Property 21: memoryEnriched=true quando padrões federados retornados

*For any* execução do `GovernanceEngine` onde o `FederatedMemoryAdapter.recall()` retorna lista não-vazia (incluindo padrões vindos do servidor federado), o `GovernancePassport` resultante deve ter `memoryEnriched === true`.

**Validates: Requirements 9.2**

---

### Property 22: GovernanceEngine resiliente a servidor indisponível

*For any* `GovernanceContext` válido, se o `FederatedMemoryServer` estiver indisponível (timeout ou HTTP 5xx), o `GovernanceEngine` deve retornar um `GovernancePassport` válido usando apenas o `LocalCache`, sem lançar exceção.

**Validates: Requirements 9.4, 4.4, 4.5**

---

## Error Handling

| Erro | Condição | Comportamento |
|------|----------|---------------|
| `InvalidPrivacyParameterError` | `epsilon <= 0` | Lançado imediatamente em `addNoise()` |
| `FederatedResponseParseError` | JSON malformado ou schema inválido na resposta do servidor | Lançado em `deserializeFederatedPattern()` |
| `DuplicatePassportError` (existente) | Passaporte duplicado no SQLite | Propagado do `HybridMemoryAdapter` |
| Timeout no pull (3000ms) | Servidor não responde ao `GET /query` | `recall()` retorna `[]`, log `warn` |
| Timeout no push (5000ms) | Servidor não responde ao `POST /push` | Descartado silenciosamente, log `warn` |
| HTTP 5xx no pull | Servidor retorna erro | `recall()` retorna `[]`, log `warn` |
| HTTP 5xx no push | Servidor retorna erro | Descartado silenciosamente, log `warn` |
| HTTP 422 no push | Embedding com dimensão errada | Nunca deve ocorrer no cliente (gerado internamente com 384 dims) |

**Princípio geral**: erros no servidor federado nunca devem interromper o fluxo de governança. O sistema degrada graciosamente para operação local.

---

## Testing Strategy

### Abordagem dual: unit tests + property-based tests

Unit tests cobrem exemplos específicos, casos de borda e pontos de integração. Property-based tests (PBT) verificam propriedades universais sobre espaços de input gerados aleatoriamente. Ambos são complementares e necessários.

**Biblioteca PBT**: [`fast-check`](https://github.com/dubzzz/fast-check) (TypeScript/JavaScript).
**Configuração mínima**: 100 iterações por propriedade (`numRuns: 100`).

### Arbitrários (geradores fast-check)

```typescript
// Gerador de CodeFingerprint aleatório
const arbFingerprint = fc.record({
  hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
  astSignature: fc.string({ minLength: 1, maxLength: 200 }),
  dependencies: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
  complexity: fc.integer({ min: 0, max: 100 }),
});

// Gerador de FederatedPattern válido
const arbFederatedPattern = fc.record({
  pattern_id: fc.uuid(),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
  rules_applied: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
  success_rate: fc.float({ min: 0, max: 1, noNaN: true }),
});

// Gerador de epsilon válido
const arbEpsilon = fc.float({ min: 0.001, max: 10.0, noNaN: true });

// Gerador de epsilon inválido
const arbInvalidEpsilon = fc.oneof(
  fc.constant(0),
  fc.float({ max: -0.001, noNaN: true }),
);
```

### Mapeamento propriedades → testes PBT

Cada propriedade do design é implementada por um único teste PBT com tag de rastreabilidade:

```typescript
// Tag format: Feature: federated-memory, Property N: <texto>

// Property 1
it('embedding sempre tem 384 dimensões', () => {
  // Feature: federated-memory, Property 1: Dimensão do embedding
  fc.assert(fc.property(arbFingerprint, (fp) => {
    const emb = generator.generate(fp);
    return emb.length === 384;
  }), { numRuns: 100 });
});

// Property 2
it('embedding é determinístico', () => {
  // Feature: federated-memory, Property 2: Determinismo do embedding
  fc.assert(fc.property(arbFingerprint, (fp) => {
    const a = generator.generate(fp);
    const b = generator.generate(fp);
    return a.every((v, i) => v === b[i]);
  }), { numRuns: 100 });
});

// Property 18
it('FederatedPattern round-trip JSON', () => {
  // Feature: federated-memory, Property 18: Round-trip de FederatedPattern
  fc.assert(fc.property(arbFederatedPattern, (pattern) => {
    const serialized = JSON.stringify(pattern);
    const deserialized = deserializeFederatedPattern(serialized);
    return deepEqual(deserialized, pattern);
  }), { numRuns: 100 });
});
```

### Unit tests (exemplos e casos de borda)

- `sharePatterns` padrão é `true` (Property 3.1 — exemplo)
- `FederatedMemoryAdapter` é aceito pelo `GovernanceEngine` sem modificação (Property 6.5 — integração)
- Timeout de pull retorna `[]` sem exceção (Property 4.4 — exemplo com mock de servidor)
- Timeout de push é descartado silenciosamente (Property 5.4 — exemplo com mock)
- `VECTOR_STORE` env var configura o banco vetorial correto (Property 7.5 — exemplo)
- `GovernanceEngine` inicializado com `FederatedMemoryAdapter` usa-o para todas as operações (Property 9.1 — integração)

### Testes do servidor Python

O `FederatedMemoryServer` é testado com `pytest` + `hypothesis` (PBT para Python):

```python
from hypothesis import given, settings
from hypothesis import strategies as st

# Property 15: ordenação por confidence
@given(st.lists(federated_pattern_strategy(), min_size=1))
@settings(max_examples=100)
def test_query_results_ordered_by_confidence(patterns):
    # Feature: federated-memory, Property 15: Resultados ordenados por confidence
    ...

# Property 16: rejeição de embedding com dimensão errada
@given(st.lists(st.floats(), min_size=1).filter(lambda x: len(x) != 384))
@settings(max_examples=100)
def test_push_rejects_wrong_dimension(embedding):
    # Feature: federated-memory, Property 16: Servidor rejeita embedding com dimensão errada
    ...
```

### Cobertura esperada

| Componente | Unit | PBT |
|------------|------|-----|
| `EmbeddingGenerator` | casos de borda (fingerprint vazio, complexity=0) | P1, P2, P3 |
| `DifferentialPrivacy` | Laplace vs Gaussian, epsilon=0.001 | P4, P5, P6 |
| `FederatedMemoryAdapter` | timeout, HTTP 5xx, sharePatterns toggle | P7, P8, P9, P10, P11, P12, P13, P14 |
| Serialização | campos ausentes, tipos errados | P18, P19, P20 |
| `GovernanceEngine` + adapter | integração end-to-end | P21, P22 |
| `FederatedMemoryServer` | validação de schema, agregação | P15, P16, P17 |
