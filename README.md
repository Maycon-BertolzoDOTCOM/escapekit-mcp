# EscapeKit MCP

> **Breaking Ralph Loop Inverso** - Transform AI sandbox code into production-ready projects

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E=18.0.0-green.svg)](https://nodejs.org/)
[![Railway](https://img.shields.io/badge/Railway-deploy-blue)](https://railway.app/new/template?template=YOUR_TEMPLATE_ID)
[![CI/CD](https://github.com/escapekit/escapekit-mcp/workflows/CI/badge.svg)](https://github.com/escapekit/escapekit-mcp/actions)
[![codecov](https://codecov.io/gh/escapekit/escapekit-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/escapekit/escapekit-mcp)


## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=YOUR_TEMPLATE_ID)

**Features**:
- ✅ One-click Railway deployment
- ✅ Automated CI/CD with GitHub Actions
- ✅ Comprehensive test coverage
- ✅ Kiwi TCMS integration for test tracking
- ✅ Multi-environment support (dev, staging, prod)
- ✅ Zero-configuration setup
## 🎯 What is EscapeKit?

EscapeKit MCP is a Model Context Protocol (MCP) server that helps developers break free from AI sandbox dependencies. It analyzes, transforms, and validates code generated in AI sandboxes (Google AI Studio, Bolt.new, Replit) to work in real production environments.

### The Problem: Ralph Loop Inverso

AI-generated code often contains **"ghost dependencies"** – packages and APIs that only exist in sandbox environments. When you try to run this code in production, it fails. This creates a dependency loop where developers become resources maintaining sandbox ecosystems.

### The Solution

EscapeKit automatically:
- 🔍 **Detects** ghost imports, mock APIs, and sandbox-specific patterns
- 🔄 **Transforms** code with real dependencies and polyfills
- ✅ **Validates** that code runs in production environments
- 📝 **Generates** complete, deployable projects

## 🚀 Quick Start

### Installation

```bash
npm install -g escapekit-mcp
```

### Analyze Code

Analyze AI-generated code to identify sandbox dependencies:

```bash
# From a file
escapekit analyze ai-generated-code.js

# From string
escapekit analyze --code "import { mockApi } from 'mockapi.io';"

# From stdin
echo "import * as THREE from 'three.js';" | escapekit analyze
```

Example output:
```
🔍 Analyzing code...
   Analysis ID: analysis-1234567890-abc123
   Sandbox: ai-studio
   Language: javascript

✅ Analysis complete!

Summary:
   Total Issues: 3
   Ghost Imports: 1
   Mock APIs: 1
   Unrealistic Assumptions: 1
   Security Risks: 0
   Confidence Score: 0.40

Issues found:
  ❌ [GHOST_IMPORT] Line 0
     Ghost import: Package "mockapi.io" does not exist on npm
     💡 Consider using a real alternative or removing this import.

  ⚠️ [MOCK_API] Line 5
     Mock API detected: mockapi.io
     💡 Replace with real API endpoints or implement proper error handling for production.

?? Next step: escapekit generate analysis-1234567890-abc123
```

### Generate Portable Project

Generate a production-ready project based on analysis:

```bash
escapekit generate analysis-1234567890-abc123 --target nextjs --output ./my-app
```

### Validate Production Code

Validate that the generated code works in real environments:

```bash
escapekit validate ./my-app --env local --level standard
```

## 🛠️ Features

### Analysis Engine

- **Ghost Import Detection**: Automatically identifies non-existent npm packages
- **Mock API Detection**: Detects mock API calls (mockapi.io, localhost, etc.)
- **WebGL Detection**: Identifies WebGL/Three.js usage that may need fallbacks
- **Sandbox Type Detection**: Automatically identifies AI Studio, Bolt.new, Replit environments
- **Confidence Scoring**: Calculates code quality score based on detected issues

### Transformation Engine

- **Dependency Resolution**: KnowledgeBase (exact match) + SemanticMatcher (fuzzy) + NPMRegistry integration
- **AST Code Transformation**: Babel + recast for formatting preservation
- **Project Generation**: Handlebars templates (package.json, tsconfig, Dockerfile, CI)
- **Escape Contract**: YAML/JSON contract documenting all transformations
- **Chinese Sovereignty (自主创新)**: Chinese mirrors, offline cache, security validation, audit logging

- **[NEW] Diff-Based Editing**: Git-style unified diffs with fuzzy matching using Levenshtein distance (94.46% test coverage)

### Validation Engine (Coming Soon)

- **Build Verification**: Ensures code compiles successfully
- **Runtime Testing**: Validates code execution in real environments
- **WebGL Support Testing**: Verifies WebGL availability and fallback behavior
- **Performance Metrics**: Measures bundle size, load times, API latency

### Knowledge Base Engine

- **Paper to Contract**: Transforma papers acadêmicos em contratos factuais YAML usando IA local (Ollama + Qwen 2.5)
- **Factual Contracts**: Documenta fatos, padrões, regras e casos derivados de pesquisa
- **Traceability**: Mapeia fatos do paper → implementação → testes
- **Local AI**: Geração automática com Ollama, sem necessidade de internet ou APIs pagas

## 📋 CLI Commands

### `analyze [options] [file]`
Analyze AI-generated code to identify sandbox dependencies and issues.

**Options**:
- `--code <string>` - Code string to analyze (alternative to file)
- `--from <sandbox>` - Source sandbox type (ai-studio, bolt, replit)
- `--to <platform>` - Target platform (nextjs, vercel, node)
- `--json` - Output results as JSON

### `generate [options] <analysis_id>`
Generate a portable project based on analysis results.

**Options**:
- `--target <platform>` - Target platform (nextjs, vercel, node) [default: nextjs]
- `--output <dir>` - Output directory [default: ./escape_output]
- `--include-docker` - Include Dockerfile
- `--include-ci` - Include CI/CD configuration
- `--json` - Output results as JSON

### `validate [options] <project_path_or_kit_id>`
Validate generated code in real environment.

**Options**:
- `--env <environment>` - Validation environment (docker, local) [default: local]
- `--level <level>` - Validation level (basic, standard, thorough) [default: standard]
- `--json` - Output results as JSON

### `monitor [options] <production_url>`
Monitor production deployment (Enterprise feature - coming soon).

**Options**:
- `--kit-id <id>` - Escape Kit ID

### `diff [command]` (NEW!)
Manipula diffs unificados (aplicar, gerar, validar) com suporte a fuzzy matching.

**Subcommands**:

#### `diff apply <file> <diff>`
Aplica um diff unificado a um arquivo.

```bash
qwen-escapekit diff apply source.ts changes.patch --fuzzy 0.8 --backup
```

**Options**:
- `-f, --fuzzy <number>` - Threshold de fuzzy matching (0.0-1.0) [default: 0.8]
- `-b, --backup` - Criar backup do arquivo original [default: false]

#### `diff generate <original> <modified>`
Gera um diff unificado entre dois arquivos.

```bash
qwen-escapekit diff generate original.ts modified.ts -o changes.patch
```

**Options**:
- `-o, --output <file>` - Caminho de saída do diff [default: diff.patch]

#### `diff validate <diff>`
Valida um arquivo de diff.

```bash
qwen-escapekit diff validate changes.patch
```

**Performance**: 94.46% test coverage, <50ms for typical files
**Docs**: [docs/roo-code-integration.md](docs/roo-code-integration.md) (coming soon)

## 🔌 MCP Integration

EscapeKit provides three MCP tools that can be used with Claude Desktop and other MCP-compatible clients:

### `analyze_sandbox_code`
Analyzes AI-generated code to identify sandbox dependencies and issues.

**Parameters**:
- `code` (required): The code to analyze
- `sandbox_type` (optional): The source sandbox type
- `target_runtime` (optional): The target runtime (default: javascript)

### `generate_escape_kit`
Generates a portable project based on analysis results.

**Parameters**:
- `analysis_id` (required): The analysis ID from `analyze_sandbox_code`
- `target_platform` (optional): Target platform (default: nextjs)
- `output_dir` (optional): Output directory (default: ./escape_output)
- `include_docker` (optional): Include Dockerfile
- `include_ci` (optional): Include CI/CD configuration
- `force` (optional): Overwrite existing output directory
- `dry_run` (optional): Preview transformations without writing files

### `validate_reality`
Validates generated code in real environment with runtime tests.

**Parameters**:
- `project_path` (required): Path to the project
- `validation_level` (optional): Validation level (default: standard)

## 🧰 Auxiliary Scripts

### `qwen-escapekit` CLI (Nova! 🚀)

CLI avançada para automatizar o fluxo completo de Paper para Contrato Factual com IA.

```bash
# Instalar
cd qwen-escapekit && npm install && npm link

# Processar paper e gerar contrato
qwen-escapekit paper 10.48550/arXiv.2603.10163

# Gerar contrato + boilerplate do detector
qwen-escapekit paper 10.48550/arXiv.2603.10163 --generate-boilerplate

# Listar contratos
qwen-escapekit list

# Validar contratos
qwen-escapekit validate --all

# Mostrar estatísticas
qwen-escapekit stats
```

**Documentação completa**: [qwen-escapekit/README.md](qwen-escapekit/README.md)

### `paper-to-contract.sh`

Script bash para extração básica de contratos factuais (legado, mas funcional).

```bash
# Com DOI
./scripts/paper-to-contract.sh 10.48550/arXiv.2603.10163

# Com URL do arXiv
./scripts/paper-to-contract.sh https://arxiv.org/abs/2603.10163
```

**Veja também**: [PaperToContract.md](PaperToContract.md) para documentação completa.

### `health-check`

Verifica a saúde do projeto (testes, lint, typecheck).

```bash
npm run health-check
# ou
./scripts/health-check.sh
```

## 🏗️ Architecture

```
┌─────────────────┐
│   CLI / MCP    │
│    Interface    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Code Analyzer  │
│                 │
│  • Parser      │
│  • Registry    │
│  • Detector    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Transformer  │
│                 │
│  • Resolver    │
│    (KnowledgeBase + SemanticMatcher)
│  • ASTTransformer │
│    (Babel + recast)
│  • ProjectGenerator │
│    (Handlebars) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Validator   │  (Coming Soon)
│                 │
│  • Builder     │
│  • E2E Tests   │
│  • Metrics     │
└─────────────────┘
```

## 📊 Progress

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Project Init | ✅ Complete | 100% |
| Phase 2: Analysis Engine | ✅ Complete | 100% |
| Phase 3: Transformation Engine | ✅ Complete | 100% |
| Phase 4: Knowledge Base Engine | ✅ Complete | 100% |
| Phase 5: qwen-escapekit CLI | ✅ Complete | 100% |
| Phase 6: Validation Engine | ⏳ Not Started | 0% |
| Phase 7: Docs & Testing | ⏳ In Progress | 70% |
| Phase 8: MVP Release | ⏳ Not Started | 0% |

**Overall Progress**: ~75% (Phase 5 complete)

## 🧠 Research

The EscapeKit project is grounded in academic research on platform dependency in AI-assisted code generation.

### Concept: The "Ralph Loop Inverso"

The "Ralph Loop Inverso" is a phenomenon where developers become trapped in AI platforms, unable to port their generated code to production environments without the platform. This creates a cycle of dependency (vendor lock-in) that affects intellectual ownership, innovation, and developer autonomy.

### Research Contributions

- **Concept**: The "Ralph Loop Inverso" as a sociotechnical phenomenon
- **Tool**: EscapeKit - An open-source tool for platform-independent code portability
- **Empirical**: Ongoing studies on developer productivity and code quality

### Publications

- **Under Review**: Breaking the Ralph Loop Inverso: EscapeKit - A Tool for Platform-Independent Code Portability

### Research Resources

- [Research Strategy](RESEARCH_STRATEGY.md) - Comprehensive academic roadmap
- [Research Abstract](RESEARCH_ABSTRACT.md) - 3-page research abstract for collaboration
- [Related Work](RESEARCH_ABSTRACT.md#related-work) - Literature review and references

### Collaborate

We invite researchers to:
- Use EscapeKit in their studies on AI-assisted programming
- Contribute to empirical evaluations (contact us for study design)
- Collaborate on theoretical work on platform dependency
- Give talks and workshops on AI platform independence

**Contact**: research@escapekit.dev

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) - Incremental parsing system
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI tool integration standard
- [Vitest](https://vitest.dev/) - Fast unit testing framework

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/escapekit/escapekit-mcp/issues)
- **Discord**: Join our [community server](https://discord.gg/escapekit)
- **Documentation**: [Full docs](https://escapekit.dev/docs)

---

**EscapeKit**: Breaking Ralph Loop Inverso, one sandbox at a time. 🚀