# Knowledge Base - Contratos Factuais

Esta pasta contém **contratos factuais** YAML derivados de papers acadêmicos.

## 📄 O Que São Contratos Factuais?

Contratos factuais são documentos YAML que documentam:

- **Fatos**: Afirmações verificáveis extraídas do paper
- **Padrões**: Regularidades identificadas nos fatos
- **Regras**: Princípios de implementação derivados dos padrões
- **Casos**: Exemplos concretos de aplicação ou ataque

## 📁 Estrutura de Arquivos

```
knowledge-base/
├── README.md                                    # Este arquivo
├── compatibility-at-a-cost-mcp-clause-compliance.yaml  # Exemplo de contrato
└── paper-to-contract.log                        # Log de execução (gitignored)
```

### Nomeação de Arquivos

Os arquivos seguem o padrão: `<citekey>.yaml`

O `citekey` é gerado automaticamente a partir do título do paper:
- Minúsculas
- Hífens no lugar de espaços/pontuação
- Máximo 80 caracteres

Exemplo:
- Título: "Compatibility at a Cost: MCP Clause-Compliance Vulnerabilities"
- Citekey: `compatibility-at-a-cost-mcp-clause-compliance`

## 🚀 Como Usar

### 1. Gerar Novo Contrato

```bash
# Usando npm
npm run paper-to-contract -- 10.48550/arXiv.2603.10163

# Ou diretamente
./scripts/paper-to-contract.sh https://arxiv.org/abs/2603.10163
```

### 2. Revisar Contrato

Abra o arquivo YAML gerado em `knowledge-base/` e revise:

- Metadados (título, autores, ano)
- Fatos extraídos
- Padrões identificados
- Regras de implementação
- Casos de aplicação

### 3. Implementar Detectores

Use as regras do contrato para implementar detectores no EscapeKit:

```yaml
# Exemplo de regra no contrato
rules:
  - id: "R001"
    principle: "Toda cláusula opcional do MCP deve ter implementação segura"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "MCPComplianceAnalyzer"
    priority: "high"
```

Implemente em `src/security/<detector_name>.ts`.

### 4. Adicionar Testes

Crie testes baseados nos fatos e casos do contrato:

```yaml
# Exemplo de caso no contrato
cases:
  - id: "C001"
    description: "Adversário injeta prompt malicioso via mensagem malformada"
    attack_vector: "prompt_injection"
    mitigation: "Validação de entrada e rate limiting"
```

Implemente em `tests/security/<detector_name>.test.ts`.

### 5. Atualizar Rastreabilidade

Após implementar, atualize a seção `traceability` no contrato:

```yaml
traceability:
  F001:
    implementation: "src/security/mcp-compliance.ts"
    tests: "tests/security/mcp-compliance.test.ts"
    status: "implemented"
```

## 📊 Estrutura do Contrato

```yaml
source:
  title: "..."
  authors: "..."
  year: 2026
  url: "..."
  doi: "..."
  extracted_at: "..."

facts:
  - id: "F001"
    statement: "..."
    type: "fact"  # fact, claim, observation
    relevance: "security"  # security, portability, performance, compatibility
    location: "Section X.X"

patterns:
  - id: "P001"
    description: "..."
    evidence: ["F001", "F002"]
    confidence: "high"  # high, medium, low

rules:
  - id: "R001"
    principle: "..."
    derived_from: ["P001"]
    action: "implement_detector"  # implement_detector, add_test, create_polyfill
    detector_name: "..."
    priority: "high"  # high, medium, low

cases:
  - id: "C001"
    description: "..."
    attack_vector: "prompt_injection"  # prompt_injection, dos, data_exfiltration
    mitigation: "..."
    related_facts: ["F001"]
    related_rules: ["R001"]

metadata:
  version: "1.0"
  status: "draft"  # draft, reviewed, approved
  tags: ["security", "mcp"]
  implemented_detectors: ["Detector1", "Detector2"]

traceability:
  F001:
    implementation: "src/security/..."
    tests: "tests/security/..."
    status: "implemented"  # implemented, pending, documented
```

## 🔍 Tipos de Fatos

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `fact` | Fato verificável e objetivo | "MCP SDKs relaxam restrições em cláusulas opcionais" |
| `claim` | Afirmação dos autores que requer validação | "Nosso detector identifica 95% dos ataques" |
| `observation` | Observação empírica | "O protocolo não define comportamento seguro por padrão" |

## 🎯 Tipos de Relevância

| Relevância | Descrição |
|------------|-----------|
| `security` | Impacta segurança do sistema |
| `portability` | Impacta portabilidade do código |
| `performance` | Impacta performance |
| `compatibility` | Impacta compatibilidade entre plataformas |

## 📈 Prioridades

| Prioridade | Ação |
|------------|------|
| `high` | Implementar imediatamente |
| `medium` | Implementar na próxima sprint |
| `low` | Backlog, implementar quando possível |

## 🤖 IA Local

Os contratos são gerados automaticamente usando **Ollama + Qwen 2.5**.

### Requisitos

```bash
# Instale Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Baixe o modelo
ollama pull qwen2.5:latest

# Inicie o Ollama
ollama serve
```

### Modelos Suportados

| Modelo | RAM | Qualidade | Uso |
|--------|-----|-----------|-----|
| `qwen2.5:0.5b` | 1GB | Básica | Testes |
| `qwen2.5:1.5b` | 2GB | Boa | Uso geral |
| `qwen2.5:3b` | 4GB | Muito boa | **Recomendado** |
| `qwen2.5:7b` | 8GB | Excelente | Papers complexos |

## 🔗 Integração com Obsidian

Para visualizar os contratos no Obsidian:

1. Adicione `knowledge-base/` ao seu vault do Obsidian
2. Instale o plugin **Dataview** para consultas
3. Use links bidirecionais para conectar contratos

Exemplo de consulta Dataview:

```dataview
TABLE status, version, tags
FROM "knowledge-base"
WHERE contains(tags, "security")
SORT file.name ASC
```

## 📚 Exemplos

### Contrato Completo

Veja `compatibility-at-a-cost-mcp-clause-compliance.yaml` para um exemplo completo.

### Query para Listar Contratos

```bash
# Listar todos os contratos
ls knowledge-base/*.yaml

# Contar contratos por status
grep -h "status:" knowledge-base/*.yaml | sort | uniq -c
```

## 🧹 Manutenção

### Revisar Contratos

Periodicamente, revise os contratos para:

- Atualizar status (`draft` → `reviewed` → `approved`)
- Adicionar rastreabilidade de implementação
- Remover contratos obsoletos

### Validar Implementação

Use o script de validação (futuro):

```bash
./scripts/validate-contracts.sh
```

Isso verifica se todos os detectores listados nos contratos foram implementados.

## 📖 Referências

- [Paper to Contract Documentation](../PaperToContract.md)
- [Crossref API](https://api.crossref.org/)
- [arXiv API](http://export.arxiv.org/api/query)
- [Ollama](https://ollama.com/)

---

**Knowledge Base**: Transformando pesquisa em código, um contrato por vez. 🚀
