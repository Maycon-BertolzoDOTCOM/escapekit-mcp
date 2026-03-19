# EscapeKit - Documentação Completa

## 1. Propósito Central

**EscapeKit** é um servidor MCP (Model Context Protocol) que transforma código gerado por IA em ambientes sandbox em projetos prontos para produção. O problema que resolve é o **"Ralph Loop Inverso"** - código de IA frequentemente contém "ghost dependencies" (pacotes que só existem no ambiente sandbox) que falham em produção.

### O Problema: Ralph Loop Inverso

AI-generated code often contains **"ghost dependencies"** – packages and APIs that only exist in sandbox environments. When you try to run this code in production, it fails. This creates a dependency loop where developers become resources maintaining sandbox ecosystems.

### A Solução

EscapeKit automaticamente:

- 🔍 **Detecta** ghost imports, mock APIs, e padrões específicos de sandbox
- 🔄 **Transforma** código com dependências reais e polyfills
- ✅ **Valida** que o código executa em ambientes de produção
- 📝 **Gera** projetos completos e deployáveis

---

## 2. Arquitetura de Módulos

### 2.1 Detectores (`src/detectors/`)

| Módulo               | Função                                                           |
| -------------------- | ---------------------------------------------------------------- |
| `ImportDetector.ts`  | Detecta e extrai statements de import (ES6 e CommonJS)           |
| `SandboxDetector.ts` | Identifica o tipo de sandbox (ai-studio, bolt.new, replit, etc.) |
| `WebGLDetector.ts`   | Detecta uso de WebGL/Three.js que pode falhar                    |
| `MockApiDetector.ts` | Identifica chamadas a APIs mock (mockapi.io, etc.)               |

### 2.2 Análise de Segurança (`src/security/`)

| Módulo                     | Função                                            |
| -------------------------- | ------------------------------------------------- |
| `PostInstallDetector.ts`   | Detecta scripts maliciosos pós-instalação         |
| `SlopsquatDetector.ts`     | Identifica ataques de typosquatting               |
| `UnicodeAnalyzer.ts`       | Analiza homoglyphs e caracteres Unicode suspeitos |
| `PatternMatcher.ts`        | Matching de patterns de risco                     |
| `RiskScorer.ts`            | Calcula score de risco                            |
| `PackageJsonParser.ts`     | Parseia package.json                              |
| `LockFileParser.ts`        | Parseia lockfiles                                 |
| `DeepDependencyScanner.ts` | Escaneia dependências profundas                   |

### 2.3 Resolvedores (`src/resolvers/`)

| Módulo                  | Função                                                |
| ----------------------- | ----------------------------------------------------- |
| `DependencyResolver.ts` | Resolve dependências fantasma para alternativas reais |
| `SemanticMatcher.ts`    | Matching semântico de bibliotecas similares           |
| `KnowledgeBase.ts`      | Base de conhecimento com contratos factuais           |

### 2.4 Transformadores (`src/transformers/`)

| Módulo                    | Função                                      |
| ------------------------- | ------------------------------------------- |
| `ImportReplacer.ts`       | Substitui imports fantasma por alternativas |
| `ASTTransformer.ts`       | Transforma código via AST                   |
| `DiffApplyTransformer.ts` | Aplica diffs de transformação               |

### 2.5 Geradores (`src/generators/`)

| Módulo                      | Função                                 |
| --------------------------- | -------------------------------------- |
| `ProjectGenerator.ts`       | Gera estrutura completa de projeto     |
| `EscapeContractWriter.ts`   | Escreve contrato factual (escape.json) |
| `TemplateEngine.ts`         | Engine de templates Handlebars         |
| `TransformationPipeline.ts` | Orquestra pipeline de transformação    |

### 2.6 Validadores (`src/validators/`)

| Módulo                | Função                               |
| --------------------- | ------------------------------------ |
| `ProjectValidator.ts` | Valida estrutura de arquivos         |
| `RuntimeValidator.ts` | Valida se projeto executa            |
| `E2EValidator.ts`     | Validação end-to-end (HTTP requests) |
| `ValidationScorer.ts` | Calcula score de validação           |

### 2.7 Serviços (`src/services/`)

| Módulo           | Função                                     |
| ---------------- | ------------------------------------------ |
| `NPMRegistry.ts` | Consulta NPM com cache e retry exponencial |

---

## 3. Ferramentas MCP

O servidor expõe 3 ferramentas:

### 3.1 `analyze_sandbox_code`

Analisa código e detecta:

- Ghost imports (pacotes que não existem no npm)
- Mock APIs (endpoints fake)
- Padrões de sandbox específicos
- Riscos de segurança (scripts pós-install, typosquatting)

**Parâmetros:**

- `code`: Código a analisar
- `sandbox_type`: Tipo de sandbox (opcional)
- `target_runtime`: Runtime alvo (javascript, typescript)
- `enable_security_analysis`: Ativar análise de segurança

### 3.2 `generate_escape_kit`

Gera projeto produção-ready a partir de análise:

- Resolve ghost imports para alternativas reais
- Transforma código AST
- Gera estrutura de projeto
- Escreve contrato factual (escape.json)

**Opções:**

- `include_docker`: Include Dockerfile
- `include_ci`: Include CI/CD workflow
- `generate_escape_json`: Generate escape.json protocol
- `force`: Force processing non-autoFixable issues
- `dry_run`: Plan without writing files

### 3.3 `validate_reality`

Valida projeto em ambiente real:

- Valida estrutura de arquivos
- Valida runtime (build + start)
- Validação E2E (HTTP requests)

**Níveis:**

- `basic`: Apenas estrutura
- `standard`: Estrutura + runtime
- `thorough`: Estrutura + runtime + E2E

---

## 4. Integrações Externas

| Serviço          | Uso                          | Método           |
| ---------------- | ---------------------------- | ---------------- |
| **NPM Registry** | Consulta pacotes             | API REST pública |
| **Kiwi TCMS**    | Upload resultados de teste   | XML-RPC          |
| **Railway**      | Deploy automático            | GitHub Actions   |
| **ngrok**        | Exposição temporária         | Tunnel HTTP      |
| **Ollama**       | IA local para qwen-escapekit | REST local       |

### 4.1 NPM Registry

- Cache com TTL configurável
- Retry exponencial
- Fallback para cache offline

### 4.2 Kiwi TCMS

- Cliente XML-RPC unificado
- Batch upload (20 por vez)
- Autenticação por cookie de sessão

---

## 5. CLI e Scripts

### Comandos npm

```bash
npm run dev          # Desenvolvimento MCP (tsx watch)
npm run test         # Testes (1141 testes)
npm run build        # Compila TypeScript
npm run start        # Inicia servidor MCP
npm run cli          # CLI do EscapeKit
npm run lint         # Linting
npm run format       # Prettier
npm run typecheck    # TypeScript check
```

### Scripts Bash

```bash
scripts/kiwi-upload-enhanced.mts  # Upload em batch para Kiwi TCMS
scripts/deploy-to-railway.sh      # Deploy automático
scripts/health-check.sh           # Health check
scripts/paper-to-contract.sh      # Extrai contratos de papers
```

---

## 6. Workflows CI/CD

| Workflow             | Gatilho   | Função                 |
| -------------------- | --------- | ---------------------- |
| `ci.yml`             | Push/PR   | Testes + lint + build  |
| `audit.yml`          | PR/Manual | Auditoria de segurança |
| `deploy-railway.yml` | Push main | Deploy Railway         |
| `release.yml`        | Tag       | Release npm            |

---

## 7. Módulo Acadêmico: qwen-escapekit

Submódulo que extrai **contratos factuais** de papers acadêmicos usando IA local (Ollama + Qwen 2.5):

### Comandos

```bash
# Extrai contrato de paper
qwen-escapekit paper <doi|arxiv|url>

# Lista contratos existentes
qwen-escapekit list

# Gera boilerplate de detector
qwen-escapekit implement <citekey>

# Valida contratos
qwen-escapekit validate

# Estatísticas
qwen-escapekit stats
```

### Features

- Detecta automaticamente tipo de fonte (DOI, arXiv, PDF)
- Extrai metadados via Crossref API
- Gera contrato factual usando Ollama
- Valida estrutura YAML do contrato
- Salva em `knowledge-base/<citekey>.yaml`

---

## 8. Testes

- **1141+ testes** passando
- **Tipos**: Unitários, Integração, E2E
- **Frameworks**: Vitest + fast-check (property-based testing)
- **Cobertura**: Alta cobertura de detectores e transformadores

### Estrutura de testes

```
tests/
├── detectors/     # Testes de detectores
├── security/      # Testes de segurança
├── resolvers/     # Testes de resolvedores
├── transformers/  # Testes de transformadores
├── generators/    # Testes de geradores
├── validators/    # Testes de validadores
└── generated/     # Testes gerados automaticamente
```

---

## 9. Estado Atual

| Funcionalidade                   | Status                            |
| -------------------------------- | --------------------------------- |
| Analyze (detecção ghost imports) | ✅ Funcional                      |
| Generate (transformação código)  | ✅ Funcional                      |
| Validate (projeto)               | ✅ Funcional                      |
| Kiwi TCMS upload                 | ✅ Funcional                      |
| Railway deploy                   | ✅ Funcional                      |
| qwen-escapekit                   | ✅ Funcional                      |
| validate_reality (MCP)           | ⚠️ Mock (retorna dados hardcoded) |

---

## 10. Estrutura de Diretórios

```
escapekit-mcp/
├── src/
│   ├── analyzers/        # Analisadores de código
│   ├── commands/         # Comandos CLI
│   ├── detectors/        # Detectores de issues
│   ├── generators/      # Geradores de projeto
│   ├── lib/             # Bibliotecas (kiwi-client, etc.)
│   ├── locks/           # Geradores de lockfile
│   ├── mirrors/         # Registros mirror
│   ├── models/          # Schemas e tipos
│   ├── recommendations/ # Motor de recomendações
│   ├── resolvers/       # Resolvedores de dependências
│   ├── security/        # Análise de segurança
│   ├── services/        # Serviços (NPM Registry)
│   ├── tools/           # Ferramentas MCP
│   ├── transformers/    # Transformadores de código
│   ├── validators/      # Validadores
│   ├── cache/           # Cache offline
│   ├── audit/           # Auditoria
│   ├── ratelimit/       # Rate limiting
│   ├── server.ts        # Ponto de entrada MCP
│   ├── config.ts        # Configurações
│   └── logger.ts        # Logger
├── scripts/             # Scripts utilitários
├── tests/               # Testes
├── cli/                 # CLI do EscapeKit
├── qwen-escapekit/      # Módulo acadêmico
├── config/              # Configurações JSON
├── .github/workflows/   # CI/CD
└── package.json
```

---

## 11. Diferenciais

1. **Arquitetura Clean Architecture** - 4 camadas com dependências controladas por ESLint
2. **Cache agressivo** - NPM Registry com TTL e retry
3. **Batch processing** - Upload Kiwi em lotes de 20
4. **Type safety** - TypeScript strict mode
5. **Multi-sandbox** - Suporte a AI Studio, Bolt.new, Replit
6. **Property-based testing** - fast-check para geração automática de casos de teste

---

## 12. Configuração

### Variáveis de Ambiente

```bash
# Kiwi TCMS
KIWI_URL=https://kiwi.example.com
KIWI_USERNAME=admin
KIWI_PASSWORD=secret
KIWI_PRODUCT_NAME=EscapeKit
KIWI_TEST_PLAN_ID=1

# NPM
NPM_CACHE_TTL=3600000
NPM_REGISTRY_URL=https://registry.npmjs.org

# Deploy
RAILWAY_TOKEN=xxx
NGROK_AUTHTOKEN=xxx
```

### Config Files

- `config/kiwi-tcms.json` - Configuração Kiwi TCMS com substituição de env vars

---

## 13. Histórico de Versões

- **v2.0.0** - CLI completa, batch upload, workflows consolidados
- **v1.0.0** - Servidor MCP básico com analyze e generate
