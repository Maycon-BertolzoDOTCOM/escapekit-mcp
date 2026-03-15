# Paper to Contract

> Transforme papers acadêmicos em contratos factuais YAML usando IA local (Ollama + Qwen 2.5)

## 📋 Visão Geral

O script `paper-to-contract.sh` automatiza a extração de metadados de papers acadêmicos e gera **contratos factuais** no formato YAML, que documentam fatos, padrões, regras e casos derivados da pesquisa.

### Por Que Contratos Factuais?

Contratos factuais são a ponte entre **teoria acadêmica** e **implementação prática**. Eles:

- 📌 **Documentam fatos verificáveis** do paper (não opiniões)
- 🔗 **Conectam fatos → padrões → regras → casos** de forma rastreável
- 🤖 **Podem ser gerados automaticamente** com IA local
- 📝 **São legíveis por humanos e máquinas**
- ✅ **Validam se a implementação segue o paper original**

## 🚀 Instalação

### Pré-requisitos

```bash
# Instale curl e jq
sudo apt install curl jq   # Linux/Debian
# ou
brew install curl jq       # macOS

# Instale Ollama (para IA local)
curl -fsSL https://ollama.com/install.sh | sh

# Baixe o modelo Qwen 2.5
ollama pull qwen2.5:latest
```

### Verifique a instalação

```bash
# Verifique se Ollama está rodando
curl http://localhost:11434/api/tags

# Verifique dependências
curl --version
jq --version
```

## 📖 Uso

### Básico

```bash
# Com DOI
./scripts/paper-to-contract.sh 10.48550/arXiv.2603.10163

# Com URL do arXiv
./scripts/paper-to-contract.sh https://arxiv.org/abs/2603.10163

# Com URL genérica (tenta extrair metadados da página)
./scripts/paper-to-contract.sh https://example.com/paper.html
```

### Opções Avançadas

```bash
# Especificar diretório de saída
./scripts/paper-to-contract.sh 10.1145/3597066 --output docs/papers

# Especificar modelo Ollama
./scripts/paper-to-contract.sh 10.48550/arXiv.2603.10163 --model qwen2.5:9b

# Ver ajuda completa
./scripts/paper-to-contract.sh --help
```

### Saída

```
📄 Paper to Contract v2.0 - Extração Inteligente com IA Local
URL/DOI: 10.48550/arXiv.2603.10163
Output dir: knowledge-base
Modelo Ollama: qwen2.5:latest

📥 Extraindo metadados...
✓ DOI detectado: arXiv:2603.10163
🔍 Consultando arXiv para ID: 2603.10163
   ✓ Título: Compatibility at a Cost: Systematic Discovery...
   ✓ Autores: Nanzi Yang; et al.
   ✓ Ano: 2026

📝 Gerando contrato factual...
   Citekey: compatibility-at-a-cost-systematic-discovery-and-exploitation-of-mcp-clause
   Arquivo: knowledge-base/compatibility-at-a-cost.yaml
🧠 Gerando contrato factual com Ollama (modelo: qwen2.5:latest)...
✅ Contrato factual gerado com IA: knowledge-base/compatibility-at-a-cost.yaml

✅ Concluído!
   Contrato: knowledge-base/compatibility-at-a-cost.yaml
   Log: knowledge-base/paper-to-contract.log
```

## 📄 Estrutura do Contrato Factual

Um contrato factual completo tem esta estrutura:

```yaml
# Contrato Factual - Título do Paper
# Gerado automaticamente por paper-to-contract.sh

source:
  title: "Compatibility at a Cost: Systematic Discovery and Exploitation of MCP Clause-Compliance Vulnerabilities"
  authors: "Nanzi Yang; et al."
  year: 2026
  url: "https://arxiv.org/abs/2603.10163"
  doi: "arXiv:2603.10163"
  extracted_at: "2026-03-14T10:30:00-03:00"

# Fatos extraídos do paper
# Cada fato deve ser uma afirmação verificável e objetiva
facts:
  - id: "F001"
    statement: "MCP SDKs relaxam restrições comportamentais em cláusulas opcionais"
    type: "fact"  # fact, claim, observation
    relevance: "security"  # security, portability, performance, compatibility
    location: "Section 3.1"

  - id: "F002"
    statement: "Adversários podem explorar lacunas de conformidade para injeção de prompt"
    type: "fact"
    relevance: "security"

# Padrões observados
# Padrões são regularidades identificadas nos fatos
patterns:
  - id: "P001"
    description: "Vulnerabilidades de conformidade ocorrem em múltiplas linguagens"
    evidence: ["F001", "F002"]  # fatos que suportam este padrão
    confidence: "high"  # high, medium, low

  - id: "P002"
    description: "Ataques usam mensagens malformadas entre cliente e servidor"
    evidence: ["F002"]
    confidence: "medium"

# Regras derivadas
# Regras são princípios de implementação derivados dos padrões
rules:
  - id: "R001"
    principle: "Toda cláusula opcional do MCP deve ter implementação segura por padrão"
    derived_from: ["P001"]
    action: "implement_detector"  # implement_detector, add_test, create_polyfill
    detector_name: "MCPComplianceAnalyzer"
    priority: "high"  # high, medium, low

  - id: "R002"
    principle: "Validar estrutura de mensagens antes de processar"
    derived_from: ["P002"]
    action: "create_polyfill"
    priority: "medium"

# Casos de aplicação/ataque
# Casos concretos que ilustram os conceitos
cases:
  - id: "C001"
    description: "Adversário injeta prompt malicioso via mensagem malformada"
    attack_vector: "prompt_injection"  # prompt_injection, dos, data_exfiltration
    mitigation: "Validação de entrada e rate limiting"
    related_facts: ["F001"]
    related_rules: ["R001"]

# Metadados do contrato
metadata:
  version: "1.0"
  status: "draft"  # draft, reviewed, approved
  tags: ["security", "mcp", "ai-safety"]
  related_papers: []  # citekeys de papers relacionados
```

## 🧠 Como Funciona a IA Local

### Fluxo de Geração

1. **Extração de metadados**: O script consulta Crossref API ou arXiv API
2. **Preparação do prompt**: Metadados + abstract são formatados em um prompt estruturado
3. **Geração com Ollama**: O modelo Qwen 2.5 gera o YAML completo
4. **Validação**: O YAML é verificado e salvo

### Modelos Recomendados

| Modelo | RAM | Qualidade | Velocidade | Uso |
|--------|-----|-----------|------------|-----|
| `qwen2.5:0.5b` | 1GB | Básica | Muito rápida | Testes |
| `qwen2.5:1.5b` | 2GB | Boa | Rápida | Uso geral |
| `qwen2.5:3b` | 4GB | Muito boa | Média | **Recomendado** |
| `qwen2.5:7b` | 8GB | Excelente | Lenta | Papers complexos |
| `qwen2.5:14b` | 16GB | Superior | Muito lenta | Pesquisa avançada |

### Configurar Modelo

```bash
# Use modelo específico
./scripts/paper-to-contract.sh 10.48550/arXiv.2603.10163 --model qwen2.5:7b

# Ou defina variável de ambiente
export PAPER_CONTRACT_MODEL=qwen2.5:7b
./scripts/paper-to-contract.sh 10.48550/arXiv.2603.10163
```

## 🔄 Integração com o EscapeKit

### Fluxo Completo

```
Paper Acadêmico
     ↓
paper-to-contract.sh
     ↓
Contrato Factual (YAML)
     ↓
Regras de Implementação
     ↓
Detectores EscapeKit
     ↓
Código de Produção
```

### Exemplo Prático

```bash
# 1. Gere contrato factual a partir do paper
./scripts/paper-to-contract.sh 10.48550/arXiv.2603.10163

# 2. Revise o contrato em knowledge-base/compatibility-at-a-cost.yaml

# 3. Use as regras do contrato para implementar detectores
#    (veja a seção rules[].action e rules[].detector_name)

# 4. Analise código com EscapeKit
escapekit analyze src/security/mcp-compliance.ts

# 5. Valide a implementação
escapekit validate ./src --level thorough
```

## 🛠️ Scripts Relacionados

### health-check.sh

Verifica a saúde do projeto:

```bash
./scripts/health-check.sh
```

### validate-contracts.sh (Futuro)

Valida se todos os contratos factuais têm implementações correspondentes:

```bash
# Script futuro (ainda não implementado)
./scripts/validate-contracts.sh
```

## 📊 Exemplos de Uso

### Processar Múltiplos Papers

```bash
#!/bin/bash
# process-all-papers.sh

papers=(
    "10.48550/arXiv.2603.10163"
    "10.1145/3597066"
    "https://arxiv.org/abs/2401.12345"
)

for paper in "${papers[@]}"; do
    echo "Processando: $paper"
    ./scripts/paper-to-contract.sh "$paper" --output knowledge-base
done

echo "Todos os papers processados!"
```

### Integração com GitHub Actions

```yaml
# .github/workflows/paper-to-contract.yml
name: Process New Papers

on:
  workflow_dispatch:
    inputs:
      paper_url:
        description: 'URL ou DOI do paper'
        required: true

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Ollama
        run: |
          curl -fsSL https://ollama.com/install.sh | sh
          ollama pull qwen2.5:latest
      
      - name: Generate Contract
        run: |
          ./scripts/paper-to-contract.sh ${{ github.event.inputs.paper_url }}
      
      - name: Commit Contract
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "Add contract for ${{ github.event.inputs.paper_url }}"
          file_pattern: knowledge-base/*.yaml
```

## 🔧 Troubleshooting

### Ollama não está rodando

```bash
# Inicie o Ollama
ollama serve

# Ou verifique se já está rodando
curl http://localhost:11434/api/tags
```

### Modelo não encontrado

```bash
# Baixe o modelo
ollama pull qwen2.5:latest

# Liste modelos disponíveis
ollama list
```

### Erro na extração de DOI

```bash
# Verifique se o DOI é válido
curl "https://api.crossref.org/works/10.1145/3597066"

# Para arXiv, verifique o ID
curl "http://export.arxiv.org/api/query?id_list=2603.10163"
```

### YAML mal formatado

Se a IA gerar YAML inválido:

1. Revise o log em `knowledge-base/paper-to-contract.log`
2. Use o template manual (IA indisponível gera template válido)
3. Preencha manualmente os campos

## 🧰 Scripts Relacionados

### `validate-contracts.sh`

Valida se todos os detectores listados nos contratos foram implementados:

```bash
# Usando npm
npm run validate-contracts

# Ou diretamente
./scripts/validate-contracts.sh
```

**Saída de exemplo:**

```
🔍 Validando Contratos Factuais
Diretório: knowledge-base

📄 Verificando: compatibility-at-a-cost-mcp-clause-compliance.yaml
   ❌ Detector faltando: MCPComplianceAnalyzer
      Local esperado: src/security/MCPComplianceAnalyzer.ts
   ✓ Detector: MCPMessageValidator
      ✓ Testes: tests/security/mcp-message-validator.test.ts

==================================
📊 Resumo
==================================
✓ Implementados: 1
⚠️  Pendentes: 0
❌ Faltando: 1
```

### `health-check.sh`

Verifica a saúde geral do projeto:

```bash
npm run health-check
```

## 📚 Referências

### APIs Usadas

- [Crossref API](https://api.crossref.org/) - Metadados de DOI
- [arXiv API](http://export.arxiv.org/api/query) - Papers do arXiv
- [Ollama API](https://ollama.com/) - IA local

### Formatos

- [YAML](https://yaml.org/) - Formato do contrato
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) - Integração com IA

### Papers Relacionados

- [Compatibility at a Cost: MCP Clause-Compliance Vulnerabilities](https://arxiv.org/abs/2603.10163)
- [Breaking Ralph Loop Inverso](docs/chinese-sovereignty.md)

## 🤝 Contribuindo

1. Crie um branch para sua feature (`git checkout -b feature/paper-contract`)
2. Teste com múltiplos papers
3. Adicione exemplos em `examples/papers/`
4. Atualize esta documentação
5. Submeta um PR

## 📄 Licença

MIT - Veja [LICENSE](LICENSE) para detalhes.

---

**Paper to Contract**: Transformando pesquisa em código, um paper por vez. 🚀
