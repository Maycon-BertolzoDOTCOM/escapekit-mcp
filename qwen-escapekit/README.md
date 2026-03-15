# Qwen EscapeKit CLI

> **Automatizando o fluxo de Paper para Contrato Factual** com IA local (Ollama + Qwen)

[![npm version](https://img.shields.io/npm/v/qwen-escapekit.svg)](https://www.npmjs.com/package/qwen-escapekit)
[![npm downloads](https://img.shields.io/npm/dm/qwen-escapekit.svg)](https://www.npmjs.com/package/qwen-escapekit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E=18.0.0-green.svg)](https://nodejs.org/)
[![CI](https://github.com/escapekit/escapekit-mcp/actions/workflows/qwen-escapekit-ci.yml/badge.svg)](https://github.com/escapekit/escapekit-mcp/actions/workflows/qwen-escapekit-ci.yml)

## 🎯 Visão Geral

A CLI `qwen-escapekit` automatiza a criação de **contratos factuais** a partir de papers acadêmicos, usando IA local (Ollama + Qwen 2.5) para extrair fatos, padrões, regras e casos de forma inteligente.

### Por Que Usar?

- ⚡ **Rápido**: Transforma um paper em contrato YAML em < 30 segundos
- 🤖 **IA Local**: Usa Ollama, sem necessidade de internet ou APIs pagas
- 📋 **Padronizado**: Segue o formato de contratos factuais do EscapeKit
- 🔨 **Produtivo**: Gera boilerplate de código para detectores
- ✅ **Validado**: Valida automaticamente a estrutura dos contratos
- 🧪 **Testado**: 70+ testes unitários com ~85% de cobertura

## 🚀 Instalação

### Opção 1: Via npm (Recomendado após publicação)

```bash
# Instale globalmente
npm install -g qwen-escapekit

# Verifique a instalação
qwen-escapekit --version
```

### Opção 2: Instalação local (Desenvolvimento)

```bash
# Clone o repositório
cd qwen-escapekit

# Instale dependências
npm install

# Build
npm run build

# Link global (opcional)
npm link

# Verifique
qwen-escapekit --help
```

### Pré-requisitos

```bash
# Instale Ollama (necessário para IA local)
curl -fsSL https://ollama.com/install.sh | sh

# Baixe o modelo Qwen 2.5
ollama pull qwen2.5:latest

# Inicie o Ollama (em background)
ollama serve &
```

### Verificação

```bash
# Verifique a versão
qwen-escapekit --version

# Veja a ajuda
qwen-escapekit --help
```

## 📖 Uso

### Comando Principal: `paper`

Processa um paper e gera contrato factual:

```bash
# Uso básico com DOI
qwen-escapekit paper 10.48550/arXiv.2603.10163

# Com URL do arXiv
qwen-escapekit paper https://arxiv.org/abs/2603.10163

# Gerar boilerplate do detector junto
qwen-escapekit paper 10.48550/arXiv.2603.10163 --generate-boilerplate

# Especificar modelo e diretório de saída
qwen-escapekit paper 10.1145/3597066 --output docs/papers --model qwen2.5:7b

# Modo interativo (revisar antes de salvar)
qwen-escapekit paper 10.48550/arXiv.2603.10163 --interactive
```

### Comando Auxiliar: `list`

Lista todos os contratos no knowledge-base:

```bash
# Lista todos
qwen-escapekit list

# Apenas pendentes de implementação
qwen-escapekit list --pending

# Apenas implementados
qwen-escapekit list --implemented

# Filtrar por tag
qwen-escapekit list --tag security

# Saída JSON
qwen-escapekit list --json
```

### Comando Auxiliar: `implement`

Gera código de detector baseado em contrato existente:

```bash
# Gerar boilerplate
qwen-escapekit implement compatibility-at-a-cost-mcp-clause-compliance

# Com testes
qwen-escapekit implement compatibility-at-a-cost-mcp-clause-compliance --tests

# Sobrescrever existente
qwen-escapekit implement compatibility-at-a-cost-mcp-clause-compliance --force
```

### Comando Auxiliar: `validate`

Valida estrutura de contratos:

```bash
# Validar todos os contratos
qwen-escapekit validate --all

# Validar contrato específico
qwen-escapekit validate compatibility-at-a-cost-mcp-clause-compliance

# Modo estrito (falha em warnings)
qwen-escapekit validate --all --strict
```

### Comando Auxiliar: `stats`

Mostra estatísticas dos contratos:

```bash
qwen-escapekit stats
```

**Exemplo de saída:**

```
📊 Qwen EscapeKit - Estatísticas
============================================================

📁 Geral
------------------------------------------------------------
Total de contratos: 5
Implementados: 3
Pendentes: 2

📈 Elementos Extraídos
------------------------------------------------------------
Fatos: 25
Padrões: 15
Regras: 18
Casos: 12

🏷️  Tags
------------------------------------------------------------
  security: 5
  mcp: 3
  ai-safety: 2
  prompt-injection: 2

📅 Por Ano
------------------------------------------------------------
  2026: 3
  2025: 2

📐 Médias por Contrato
------------------------------------------------------------
Fatos: 5.0
Padrões: 3.0
Regras: 3.6
Casos: 2.4
```

## 📋 Comandos

| Comando | Descrição |
|---------|-----------|
| `paper <source>` | Processa paper e gera contrato factual |
| `list` | Lista contratos no knowledge-base |
| `implement <citekey>` | Gera boilerplate de detector |
| `validate [contract]` | Valida estrutura de contratos |
| `stats` | Mostra estatísticas dos contratos |

### Opções do Comando `paper`

| Opção | Descrição | Padrão |
|-------|-----------|--------|
| `-o, --output <dir>` | Diretório de saída | `./knowledge-base/` |
| `-m, --model <name>` | Modelo Ollama | `qwen2.5:latest` |
| `--generate-boilerplate` | Gera código do detector | `false` |
| `--no-validate` | Pula validação | `false` |
| `--interactive` | Modo de revisão | `false` |
| `--ollama-url <url>` | URL do Ollama | `http://localhost:11434` |

## 🏗️ Arquitetura

```
┌─────────────────┐
│  CLI (Commander)│
│   Interface     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│  Paper  │ │  List    │
│ Command │ │ Command  │
└────┬────┘ └──────────┘
     │
     ▼
┌─────────────────┐
│ Source Resolver │
│ (DOI, arXiv,    │
│  PDF, URL)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Contract      │
│   Generator     │
│   (Ollama)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Contract      │
│   Validator     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Boilerplate    │
│  Generator      │
│  (Ollama)       │
└─────────────────┘
```

## 📄 Estrutura do Contrato Factual

```yaml
source:
  title: "Paper Title"
  authors: "Author One; Author Two"
  year: 2026
  url: "https://arxiv.org/abs/..."
  doi: "arXiv:..."

facts:
  - id: "F001"
    statement: "Fato verificável do paper"
    type: "fact"
    relevance: "security"

patterns:
  - id: "P001"
    description: "Padrão observado"
    evidence: ["F001"]
    confidence: "high"

rules:
  - id: "R001"
    principle: "Princípio de implementação"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "MyDetector"
    priority: "high"

cases:
  - id: "C001"
    description: "Caso de aplicação"
    attack_vector: "prompt_injection"
    mitigation: "Mitigação"

metadata:
  version: "1.0"
  status: "draft"
  tags: ["security", "mcp"]
```

## 🤖 Modelos Ollama Suportados

| Modelo | RAM | Qualidade | Velocidade | Uso |
|--------|-----|-----------|------------|-----|
| `qwen2.5:0.5b` | 1GB | Básica | ⚡⚡⚡ | Testes |
| `qwen2.5:1.5b` | 2GB | Boa | ⚡⚡ | Uso geral |
| `qwen2.5:3b` | 4GB | Muito boa | ⚡ | **Recomendado** |
| `qwen2.5:7b` | 8GB | Excelente | 🐌 | Papers complexos |
| `qwen2.5:14b` | 16GB | Superior | 🐌🐌 | Pesquisa avançada |

## 🔄 Fluxo de Trabalho

### Fluxo Completo

```
1. Usuário executa: qwen-escapekit paper <DOI>
                    ↓
2. Source Resolver extrai metadados (título, autores, abstract)
                    ↓
3. Contract Generator chama Ollama com prompt estruturado
                    ↓
4. IA retorna contrato YAML preenchido
                    ↓
5. Contract Validator verifica estrutura
                    ↓
6. Contrato salvo em knowledge-base/<citekey>.yaml
                    ↓
7. (Opcional) Boilerplate Generator cria código do detector
                    ↓
8. Código salvo em src/security/<DetectorName>.ts
```

### Exemplo de Sessão

```bash
# 1. Processar paper
$ qwen-escapekit paper 10.48550/arXiv.2603.10163

📄 Qwen EscapeKit - Paper to Contract
============================================
✓ Metadados extraídos: Compatibility at a Cost...
   Citekey: compatibility-at-a-cost-mcp-clause-compliance
✓ Contrato gerado com sucesso
✓ Contrato válido
✓ Contrato salvo em: knowledge-base/compatibility-at-a-cost.yaml

✅ Processo concluído!
Próximos passos:
   1. Revise o contrato em knowledge-base/compatibility-at-a-cost.yaml
   2. Execute: qwen-escapekit implement compatibility-at-a-cost-mcp-clause-compliance

# 2. Gerar detector
$ qwen-escapekit implement compatibility-at-a-cost-mcp-clause-compliance --tests

🔨 Qwen EscapeKit - Implementar Detector
==================================================
✓ Contrato carregado
✓ Código gerado
   ✓ Detector salvo em: src/security/MCPComplianceAnalyzer.ts
   ✓ Testes salvos em: tests/security/MCPComplianceAnalyzer.test.ts

✅ Boilerplate gerado!

# 3. Validar todos os contratos
$ qwen-escapekit validate --all

✅ Qwen EscapeKit - Validar Contratos
==================================================
✓ compatibility-at-a-cost-mcp-clause-compliance.yaml
✓ another-paper.yaml

==================================================
Total: 2 | 2 válidos | 0 inválidos
```

## 🧪 Desenvolvimento

```bash
# Instalar dependências
npm install

# Modo de desenvolvimento
npm run dev

# Build
npm run build

# Testes
npm test
npm run test:coverage

# Lint
npm run lint
npm run lint:fix
```

## 📊 Status do Projeto

| Status | Badge |
|--------|-------|
| **Versão** | [![npm version](https://img.shields.io/npm/v/qwen-escapekit.svg)](https://www.npmjs.com/package/qwen-escapekit) |
| **Downloads** | [![npm downloads](https://img.shields.io/npm/dm/qwen-escapekit.svg)](https://www.npmjs.com/package/qwen-escapekit) |
| **Build** | [![CI](https://github.com/escapekit/escapekit-mcp/actions/workflows/qwen-escapekit-ci.yml/badge.svg)](https://github.com/escapekit/escapekit-mcp/actions/workflows/qwen-escapekit-ci.yml) |
| **Licença** | [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) |

### Roadmap

- [x] Fase 1: Fundação e MVP
- [x] Fase 2: Testes Unitários (70+ testes)
- [x] Fase 3: Publicação no npm
- [ ] Fase 4: Modo Interativo
- [ ] Fase 5: Suporte a PDFs IEEE/ACM
- [ ] Fase 6: Integração com Obsidian/Dory

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja como contribuir:

1. **Fork** o projeto
2. Crie um branch para sua feature (`git checkout -b feature/minha-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona minha feature'`)
4. Push para o branch (`git push origin feature/minha-feature`)
5. Abra um **Pull Request**

### Desenvolvendo

```bash
# Clone seu fork
git clone https://github.com/seu-usuario/qwen-escapekit.git

# Instale dependências
npm install

# Modo de desenvolvimento
npm run dev

# Testes
npm test

# Build
npm run build
```

## 📚 Referências

- [Paper to Contract Documentation](../PaperToContract.md)
- [Ollama Documentation](https://ollama.com/)
- [Qwen Code](https://github.com/QwenLM/qwen-code)
- [EscapeKit MCP](../README.md)

## 📄 Licença

MIT - Veja [LICENSE](LICENSE) para detalhes.

---

**Qwen EscapeKit**: Transformando pesquisa em código, um paper por vez. 🚀
