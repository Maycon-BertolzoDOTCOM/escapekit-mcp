# Design Técnico: governance-cli-integration

## 1. Overview

Esta feature integra o `GovernanceEngine` ao CLI do EscapeKit/CodeMemória, expondo funcionalidades de governança diretamente na linha de comando. Os quatro eixos principais são:

1. **Comando `escapekit govern`** — executa governança sobre um trecho de código via CLI
2. **`FederatedMemoryAdapter` na factory** — `createGovernanceStack()` passa a suportar configuração de servidor federado
3. **Endpoint `GET /stats`** — o servidor federado expõe estatísticas agregadas dos padrões armazenados
4. **Expansão de `origin`** — `GovernanceContext.origin` passa a aceitar 11 valores de origem de IA
5. **`validate --govern`** — o comando `validate` existente ganha flag opcional para executar governança em paralelo

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI (src/cli/index.ts)                  │
│                                                                   │
│   escapekit govern [file]                escapekit validate       │
│     --origin <origin>                      --govern               │
│     --strategy <strategy>                  --federated <url>      │
│     --federated <url>                                             │
│     --output json                                                 │
└───────────────┬──────────────────────────────────┬───────────────┘
                │                                  │
                ▼                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                    createGovernanceStack(options)                  │
│                                                                    │
│   options.federatedServer?.url ?                                   │
│     → FederatedMemoryAdapter({ sqlitePath, ...federatedServer })   │
│     → HybridMemoryAdapter (comportamento atual)                    │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
              ┌─────────────────────────────────┐
              │         GovernanceEngine         │
              │   engine.govern(context)         │
              │   → GovernancePassport           │
              └─────────────────────────────────┘
                                │
              ┌─────────────────┴──────────────────┐
              │  (se FederatedMemoryAdapter ativo)  │
              ▼                                     │
┌─────────────────────────────┐                    │
│    FederatedMemoryServer    │                    │
│    (Python / FastAPI)       │                    │
│                             │                    │
│  POST /push                 │                    │
│  POST /query                │                    │
│  GET  /stats          ◄─────┘                    │
└─────────────────────────────┘
```

---

## 3. Components and Interfaces

### 3.1 Expansão de `GovernanceContext.origin` (REQ 4)

O tipo `GovernanceOrigin` é expandido de 5 para 11 valores, cobrindo as principais ferramentas de IA generativa do mercado:

```typescript
export type GovernanceOrigin =
  | 'copilot'
  | 'claude'
  | 'bolt'
  | 'cursor'
  | 'unknown'
  | 'antigravity'
  | 'gemini'
  | 'gpt'
  | 'mistral'
  | 'v0'
  | 'lovable';

export interface GovernanceContext {
  // ...campos existentes preservados...
  origin: GovernanceOrigin;  // era: 'copilot' | 'claude' | 'bolt' | 'cursor' | 'unknown'
}
```

Impacto: apenas adição de novos literais — retrocompatível com código existente que usa os 5 valores anteriores.

### 3.2 Atualização de `GovernanceStackOptions` (REQ 2)

```typescript
export interface FederatedServerConfig {
  url: string;
  sharePatterns?: boolean;
  epsilon?: number;
  noiseType?: NoiseType;
  sector?: string;
  pullTimeout?: number;
  pushTimeout?: number;
}

export interface GovernanceStackOptions {
  sqlitePath?: string;
  contractsDir?: string;
  auditLogsDir?: string;
  enableChroma?: boolean;
  federatedServer?: FederatedServerConfig;  // NOVO campo opcional
}
```

Lógica em `createGovernanceStack()`:

```
se options.federatedServer?.url está definida:
  memory = new FederatedMemoryAdapter({
    sqlitePath: options.sqlitePath,
    url: options.federatedServer.url,
    sharePatterns: options.federatedServer.sharePatterns,
    epsilon: options.federatedServer.epsilon,
    noiseType: options.federatedServer.noiseType,
    sector: options.federatedServer.sector,
    pullTimeout: options.federatedServer.pullTimeout,
    pushTimeout: options.federatedServer.pushTimeout,
  })
senão:
  memory = new HybridMemoryAdapter({ sqlitePath: options.sqlitePath })
  (comportamento atual — sem alteração)
```

### 3.3 Novos exports de `src/governance/index.ts` (REQ 2)

Os seguintes símbolos passam a ser exportados publicamente pelo módulo de governança:

| Símbolo | Tipo | Descrição |
|---|---|---|
| `FederatedMemoryAdapter` | classe | Adapter para servidor federado com privacidade diferencial |
| `FederatedMemoryOptions` | tipo | Opções de construção do adapter |
| `FederatedPattern` | tipo | Padrão retornado pelo servidor federado |
| `FederatedServerConfig` | tipo | Configuração do servidor na stack |
| `InvalidPrivacyParameterError` | erro | Lançado quando epsilon ou noiseType são inválidos |
| `FederatedResponseParseError` | erro | Lançado quando a resposta do servidor não é parseável |

### 3.4 Comando `govern` no CLI (REQ 1)

Localização: `src/cli/index.ts` — novo comando adicionado ao programa Commander existente.

#### Assinatura do comando

```
escapekit govern [file]
  --origin <origin>       Origem da IA (padrão: 'unknown')
  --strategy <strategy>   Estratégia de governança (padrão: 'balanced')
  --federated <url>       URL do servidor federado (opcional)
  --sector <sector>       Setor para o servidor federado (opcional)
  --output <format>       Formato de saída: 'text' | 'json' (padrão: 'text')
```

#### Funções auxiliares

```typescript
// Lê código de arquivo ou stdin
async function readCodeInput(file?: string): Promise<string>

// Monta GovernanceContext a partir das flags do CLI
function buildGovernContext(
  code: string,
  options: GovernCLIOptions
): GovernanceContext

// Exibe resumo do GovernancePassport no terminal
function printPassportSummary(passport: GovernancePassport): void

// Valida e converte string de origin para GovernanceOrigin
function parseOrigin(value: string): GovernanceOrigin

// Valida e converte string de strategy para GovernanceStrategy
function parseStrategy(value: string): GovernanceStrategy
```

#### Fluxo do comando `govern`

```
1. readCodeInput(file)
   → se file não existe: console.error + process.exit(1)
   → se stdin vazio: console.error + process.exit(1)

2. parseOrigin(options.origin)
   → se valor inválido: console.error("Origin inválida: ...") + process.exit(1)

3. parseStrategy(options.strategy)
   → se valor inválido: console.error("Strategy inválida: ...") + process.exit(1)

4. createGovernanceStack({
     federatedServer: options.federated
       ? { url: options.federated, sector: options.sector }
       : undefined
   })

5. engine.govern(context)
   → em caso de erro: console.error + process.exit(1)

6. se --output json:
     process.stdout.write(JSON.stringify(passport))
   senão:
     printPassportSummary(passport)

7. process.exit(0)
```

### 3.5 Integração `validate --govern` (REQ 5)

Nova flag adicionada ao comando `validate` existente:

```
escapekit validate [path]
  --govern              Executa governança após validação (opcional)
  --federated <url>     URL do servidor federado para governança (opcional)
  --origin <origin>     Origem da IA para governança (padrão: 'unknown')
```

#### Nova função auxiliar

```typescript
// Coleta e concatena arquivos .ts/.js/.tsx/.jsx do diretório raiz do projeto
async function collectProjectCode(projectPath: string): Promise<string>
```

Implementação: percorre recursivamente `projectPath`, filtra por extensões `.ts`, `.js`, `.tsx`, `.jsx`, concatena conteúdos separados por `\n// --- <filepath> ---\n`.

#### Fluxo `validate --govern`

```
1. Executar validação existente (sem alteração de lógica)
   → capturar exitCode da validação

2. se --govern:
   a. collectProjectCode(resolvedPath)
   b. createGovernanceStack({ federatedServer: ... })
   c. try:
        engine.govern(context)
        printPassportSummary(passport) ou incluir em JSON
      catch (err):
        console.warn("Governança falhou (não afeta validação):", err.message)
        // NÃO altera exitCode

3. process.exit(exitCode)  // determinado pela validação, não pela governança
```

### 3.6 Endpoint `GET /stats` (REQ 3)

Adicionado ao servidor FastAPI em `federated-server/main.py`.

#### Modelos Pydantic

```python
class SectorCount(BaseModel):
    sector: str
    count: int

class StatsResponse(BaseModel):
    total_patterns: int
    patterns_by_rule_type: dict[str, int]
    avg_success_rate: float  # intervalo [0, 1]
    top_sectors: list[SectorCount]  # até 5 entradas, ordenado por count desc
```

#### Algoritmo de cálculo

```python
@app.get("/stats", response_model=StatsResponse)
def get_stats():
    patterns = store.get_all()

    total_patterns = len(patterns)

    patterns_by_rule_type = Counter(
        p["meta"]["rule_type"] for p in patterns
    )

    if patterns:
        avg_success_rate = mean(
            p["meta"]["success_count"] / max(1, p["meta"]["total_pushes"])
            for p in patterns
        )
    else:
        avg_success_rate = 0.0

    sector_counter = Counter(
        p["meta"]["sector"]
        for p in patterns
        if p["meta"].get("sector")
    )
    top_sectors = [
        SectorCount(sector=s, count=c)
        for s, c in sector_counter.most_common(5)
    ]

    return StatsResponse(
        total_patterns=total_patterns,
        patterns_by_rule_type=dict(patterns_by_rule_type),
        avg_success_rate=avg_success_rate,
        top_sectors=top_sectors,
    )
```

---

## 4. Data Models

Resumo de todos os tipos novos ou modificados por esta feature:

| Tipo | Arquivo | Mudança |
|---|---|---|
| `GovernanceOrigin` | `src/governance/types.ts` | Expandido de 5 para 11 literais |
| `GovernanceContext.origin` | `src/governance/types.ts` | Usa novo `GovernanceOrigin` |
| `FederatedServerConfig` | `src/governance/types.ts` | NOVO — configuração do servidor na stack |
| `GovernanceStackOptions` | `src/governance/factory.ts` | Adicionado campo `federatedServer?` |
| `GovernCLIOptions` | `src/cli/index.ts` | NOVO — opções internas do comando govern |
| `SectorCount` | `federated-server/main.py` | NOVO — modelo Pydantic para /stats |
| `StatsResponse` | `federated-server/main.py` | NOVO — modelo Pydantic para /stats |

---

## 5. Correctness Properties

| ID | Propriedade | Requisito |
|---|---|---|
| P1 | `govern` com arquivo inexistente → exit 1 com mensagem de erro | REQ 1.2 |
| P2 | `govern` com `--strategy` inválida → exit 1 com mensagem específica | REQ 1.7 |
| P3 | `govern` com `--origin` inválida → exit 1 com mensagem específica | REQ 4.5 |
| P4 | `govern` com `--output json` → stdout é JSON válido com todos os campos do `GovernancePassport` | REQ 1.5 |
| P5 | `createGovernanceStack` com `federatedServer.url` → retorna `FederatedMemoryAdapter` no campo `memory` | REQ 2.1 |
| P6 | `createGovernanceStack` sem `federatedServer` → retorna `HybridMemoryAdapter` no campo `memory` | REQ 2.2 |
| P7 | `GET /stats` com store vazio → retorna objeto com zeros | REQ 3.2 |
| P8 | `GET /stats` → `top_sectors` tem no máximo 5 entradas | REQ 3.4 |
| P9 | `GET /stats` → `avg_success_rate` está em `[0, 1]` | REQ 3.3 |
| P10 | `GovernanceContext.origin` aceita todos os 11 valores sem erro de tipo | REQ 4.1 |
| P11 | `validate --govern` com servidor indisponível → exit code determinado pela validação, não pelo erro de governança | REQ 5.6 |
| P12 | `collectProjectCode` → retorna string não-vazia para projeto com pelo menos um arquivo `.ts`/`.js` | REQ 5.5 |
| P13 | `govern` sem `--federated` → não faz chamadas HTTP ao servidor federado | REQ 1.9 (negativo) |

---

## 6. Error Handling

| Situação | Comportamento | Exit Code |
|---|---|---|
| Arquivo passado ao `govern` não existe | `console.error("Arquivo não encontrado: <path>")` | 1 |
| stdin vazio (sem arquivo e sem pipe) | `console.error("Nenhum código fornecido via arquivo ou stdin")` | 1 |
| `--origin` com valor não reconhecido | `console.error("Origin inválida: '<value>'. Valores aceitos: copilot, claude, ...")` | 1 |
| `--strategy` com valor não reconhecido | `console.error("Strategy inválida: '<value>'. Valores aceitos: ...")` | 1 |
| `engine.govern()` lança exceção no `govern` | `console.error("Erro durante governança: <message>")` | 1 |
| `engine.govern()` lança exceção no `validate --govern` | `console.warn("Governança falhou (não afeta validação): <message>")` | determinado pela validação |
| Servidor federado indisponível no `govern` | `console.error("Servidor federado inacessível: <url>")` | 1 |
| Servidor federado indisponível no `validate --govern` | `console.warn(...)` | determinado pela validação |
| `InvalidPrivacyParameterError` | propagado como erro de configuração | 1 |
| `FederatedResponseParseError` | propagado como erro de runtime | 1 |
| `GET /stats` com store corrompido | HTTP 500 com `{"detail": "Erro interno ao calcular estatísticas"}` | — |

---

## 7. Testing Strategy

### TypeScript — fast-check (P1–P6, P10, P12–P13)

Arquivo: `tests/governance/cli-integration.property.test.ts`

```typescript
// P1: arquivo inexistente → exit 1
fc.assert(fc.asyncProperty(
  fc.string({ minLength: 1 }).filter(s => !existsSync(s)),
  async (fakePath) => {
    const result = await runCLI(['govern', fakePath]);
    return result.exitCode === 1 && result.stderr.includes('não encontrado');
  }
));

// P2: strategy inválida → exit 1 com mensagem
fc.assert(fc.asyncProperty(
  fc.string().filter(s => !VALID_STRATEGIES.includes(s as any)),
  async (badStrategy) => {
    const result = await runCLI(['govern', '--strategy', badStrategy, '--'], { stdin: 'const x = 1' });
    return result.exitCode === 1 && result.stderr.includes('Strategy inválida');
  }
));

// P3: origin inválida → exit 1 com mensagem
fc.assert(fc.asyncProperty(
  fc.string().filter(s => !VALID_ORIGINS.includes(s as any)),
  async (badOrigin) => {
    const result = await runCLI(['govern', '--origin', badOrigin, '--'], { stdin: 'const x = 1' });
    return result.exitCode === 1 && result.stderr.includes('Origin inválida');
  }
));

// P4: --output json → JSON válido com campos do passport
fc.assert(fc.asyncProperty(
  fc.constant('const x = 1;'),
  async (code) => {
    const result = await runCLI(['govern', '--output', 'json', '--'], { stdin: code });
    const parsed = JSON.parse(result.stdout);
    return 'passportId' in parsed && 'violations' in parsed && 'score' in parsed;
  }
));

// P5: createGovernanceStack com federatedServer.url → FederatedMemoryAdapter
fc.assert(fc.property(
  fc.webUrl(),
  (url) => {
    const stack = createGovernanceStack({ federatedServer: { url } });
    return stack.memory instanceof FederatedMemoryAdapter;
  }
));

// P6: createGovernanceStack sem federatedServer → HybridMemoryAdapter
fc.assert(fc.property(
  fc.record({ sqlitePath: fc.option(fc.string()) }),
  (opts) => {
    const stack = createGovernanceStack(opts);
    return stack.memory instanceof HybridMemoryAdapter;
  }
));

// P10: todos os 11 valores de origin são aceitos sem erro
const ALL_ORIGINS: GovernanceOrigin[] = [
  'copilot', 'claude', 'bolt', 'cursor', 'unknown',
  'antigravity', 'gemini', 'gpt', 'mistral', 'v0', 'lovable'
];
fc.assert(fc.property(
  fc.constantFrom(...ALL_ORIGINS),
  (origin) => {
    const ctx: GovernanceContext = { code: 'x', origin, strategy: 'balanced', projectId: 'test' };
    return ctx.origin === origin; // sem erro de tipo em runtime
  }
));

// P12: collectProjectCode retorna string não-vazia para projeto com .ts/.js
fc.assert(fc.asyncProperty(
  fc.constant(process.cwd()),
  async (projectPath) => {
    const code = await collectProjectCode(projectPath);
    return typeof code === 'string' && code.length > 0;
  }
));

// P13: govern sem --federated não faz chamadas HTTP
fc.assert(fc.asyncProperty(
  fc.constant('const x = 1;'),
  async (code) => {
    const httpCalls: string[] = [];
    // interceptar via mock de fetch/axios
    const result = await runCLIWithHttpSpy(['govern', '--'], { stdin: code, onHttpCall: (url) => httpCalls.push(url) });
    return httpCalls.length === 0;
  }
));
```

### Python — pytest + hypothesis (P7–P9, P11)

Arquivo: `federated-server/tests/test_stats.py`

```python
from hypothesis import given, settings
from hypothesis import strategies as st
from fastapi.testclient import TestClient
from main import app, store

client = TestClient(app)

# P7: store vazio → zeros
def test_stats_empty_store():
    store.clear()
    response = client.get("/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_patterns"] == 0
    assert data["patterns_by_rule_type"] == {}
    assert data["avg_success_rate"] == 0.0
    assert data["top_sectors"] == []

# P8: top_sectors tem no máximo 5 entradas
@given(st.lists(
    st.fixed_dictionaries({
        "embedding": st.lists(st.floats(allow_nan=False), min_size=1, max_size=10),
        "meta": st.fixed_dictionaries({
            "rule_type": st.sampled_from(["security", "style", "performance", "other"]),
            "success_count": st.integers(min_value=0, max_value=100),
            "total_pushes": st.integers(min_value=1, max_value=100),
            "sector": st.one_of(st.none(), st.text(min_size=1, max_size=20)),
        })
    }),
    min_size=0, max_size=50
))
def test_stats_top_sectors_max_5(patterns):
    store.clear()
    for p in patterns:
        store.push(p)
    response = client.get("/stats")
    assert response.status_code == 200
    assert len(response.json()["top_sectors"]) <= 5

# P9: avg_success_rate em [0, 1]
@given(st.lists(
    st.fixed_dictionaries({
        "embedding": st.lists(st.floats(allow_nan=False), min_size=1, max_size=10),
        "meta": st.fixed_dictionaries({
            "rule_type": st.sampled_from(["security", "style"]),
            "success_count": st.integers(min_value=0, max_value=1000),
            "total_pushes": st.integers(min_value=1, max_value=1000),
            "sector": st.none(),
        })
    }),
    min_size=1, max_size=100
))
def test_stats_avg_success_rate_in_range(patterns):
    store.clear()
    for p in patterns:
        store.push(p)
    response = client.get("/stats")
    rate = response.json()["avg_success_rate"]
    assert 0.0 <= rate <= 1.0

# P11: validate --govern com servidor indisponível → exit code da validação
@given(st.booleans())
def test_validate_govern_exit_code_from_validation(validation_passes):
    """Exit code deve ser determinado pela validação, não pela governança."""
    # Simula servidor federado indisponível (porta fechada)
    result = run_cli_validate(
        project_path="fixtures/sample_project",
        govern=True,
        federated_url="http://localhost:19999",  # porta fechada
        expected_validation_result=validation_passes
    )
    expected_exit = 0 if validation_passes else 1
    assert result.returncode == expected_exit
```
