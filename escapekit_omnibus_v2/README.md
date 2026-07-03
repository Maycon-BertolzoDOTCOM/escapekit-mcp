# EscapeKit Omnibus v2.0

7-Phase Autonomous R&D Pipeline with MCP, Swarms, Memory, and Knowledge Graph.

## Installation

```bash
cd escapekit_omnibus_v2
pip install -r requirements.txt
```

## Usage

```bash
# Help
python escapekit_omnibus_v2.py --help

# Dry run (safe simulation)
python escapekit_omnibus_v2.py "multi-agent workflows" --dry-run

# Full execution with all v2.0 features
python escapekit_omnibus_v2.py "multi-agent workflows with safety guards" \
    --enable-falkordb \
    --enable-letta \
    --enable-swarm \
    --enable-mcp \
    --generate-boilerplate \
    --validate-in-sandbox \
    --deploy-target railway \
    --preserve-to-ipfs \
    --share-to-network

# JSON output
python escapekit_omnibus_v2.py "LLM safety" --output-format json

# YAML output
python escapekit_omnibus_v2.py "circuit breaker patterns" --output-format yaml

# As module
python -m escapekit_omnibus_v2 "query" --dry-run
```

## Pipeline Phases

| Phase | Feature      | Description                                                                  |
| ----- | ------------ | ---------------------------------------------------------------------------- |
| 1     | Discovery    | Multi-source search (OpenAlex, Semantic Scholar, arXiv) with Circuit Breaker |
| 2     | Synthesis    | Pattern extraction + factual verification + Letta Memory                     |
| 3     | Code Gen     | 19 boilerplate files + Swarm agent orchestration                             |
| 4     | Validation   | Docker sandbox security scan                                                 |
| 5     | Deployment   | Railway/Vercel/Local + MCP endpoint                                          |
| 6     | Preservation | IPFS CID + FalkorDB Knowledge Graph                                          |
| 7     | Learning     | Continuous strategy optimization                                             |

## v2.0 Features

| Feature      | Flag                 | Description                         |
| ------------ | -------------------- | ----------------------------------- |
| FalkorDB     | `--enable-falkordb`  | Knowledge Graph with Cypher queries |
| Letta Memory | `--enable-letta`     | STM/MTM/LPM memory tiers            |
| Agent Swarms | `--enable-swarm`     | Lead-Teammate architecture          |
| MCP Server   | `--enable-mcp`       | Model Context Protocol server       |
| IPFS         | `--preserve-to-ipfs` | Decentralized preservation          |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FASE 1: DISCOVERY AUTÔNOMO                                 │
│  ├── Circuit Breaker: CLOSED/OPEN/HALF_OPEN por fonte       │
│  ├── Fallback Learning: SQLite com histórico de tentativas  │
│  ├── Multi-source: OpenAlex → Semantic Scholar → arXiv      │
│  └── Output: Papers adquiridos + métricas de resiliência    │
├─────────────────────────────────────────────────────────────┤
│  FASE 2: SÍNTESE FACTUAL                                    │
│  ├── Extração de padrões (multi_agent_orchestration, etc.)  │
│  ├── Verificação factual (triangulação multi-fonte)         │
│  ├── Letta Memory: STM/MTM/LPM tiers                        │
│  └── Output: YAML Contract com traceability                  │
├─────────────────────────────────────────────────────────────┤
│  FASE 3: GERAÇÃO DE CÓDIGO                                  │
│  ├── Boilerplate: Next.js + Agents + Safeguards             │
│  ├── Agent Swarms: Lead-Teammate pattern                    │
│  └── Output: 19 arquivos, 3 swarm agents                    │
├─────────────────────────────────────────────────────────────┤
│  FASE 4: VALIDAÇÃO                                          │
│  ├── Docker Sandbox isolado                                 │
│  ├── Security scan (0 vulnerabilidades críticas)            │
│  └── Output: Relatório de conformidade                       │
├─────────────────────────────────────────────────────────────┤
│  FASE 5: DEPLOYMENT                                         │
│  ├── Railway/Vercel/Local                                   │
│  ├── MCP endpoint                                           │
│  └── Output: URL de produção                                 │
├─────────────────────────────────────────────────────────────┤
│  FASE 6: PRESERVAÇÃO                                        │
│  ├── IPFS pinning (CID permanente)                          │
│  ├── FalkorDB Knowledge Graph                               │
│  └── Output: ipfs://QmXyZ... + gateway HTTP                 │
├─────────────────────────────────────────────────────────────┤
│  FASE 7: CONTINUOUS LEARNING                                │
│  ├── Strategy optimization via SQLite                       │
│  ├── Memory-based recall                                    │
│  └── Output: Learned strategies for future runs             │
└─────────────────────────────────────────────────────────────┘
```
