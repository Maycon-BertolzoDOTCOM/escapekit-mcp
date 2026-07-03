# CLI Capabilities Documentation - EscapeKit

## Visão Geral da CLI
A CLI do EscapeKit fornece um fluxo de trabalho completo para transformar código gerado por IA em projetos prontos para produção. Atualmente implementa **7 comandos principais** com funcionalidades robustas.

## Comandos Disponíveis

### 1. **`analyze`** - Análise de Código
**🎯 Função:** Identifica dependências de sandbox e problemas em código gerado por IA
**Comando:** `escapekit analyze [arquivo]`

**Capacidades atuais:**
- **Detecção de Ghost Imports**: Identifica imports inexistentes em bibliotecas públicas
- **APIs Mock**: Detecta funções de mock que não funcionariam em produção
- **Assunções Irrealistas**: Identifica código que depende de APIs específicas de sandbox
- **Análise Transitiva**: Com `--deep-scan`, analisa dependências secundárias
- **Classificação de Severidade**: Issues classificadas como error/warning com score de confiança

**Exemplo de uso:**
```bash
escapekit analyze app.js --from bolt --to vercel --deep-scan
```

### 2. **`generate`** - Geração de Projetos
**🎯 Função:** Cria projetos portáteis baseados nos resultados da análise
**Comando:** `escapekit generate [arquivo_análise]`

**Capacidades atuais:**
- **Resolução de Imports**: Substitui imports fantasmas por implementações reais
- **Geração de Dockerfile**: Opção `--include-docker`
- **CI/CD Integration**: Configurações para GitHub Actions, Vercel, Netlify
- **Plataformas Suportadas**: Vercel, Netlify, Docker, local
- **Preview Mode**: `--dry-run` para visualizar mudanças sem aplicar

**Exemplo:**
```bash
escapekit generate analysis.json --platform vercel --include-docker
```

### 3. **`validate`** - Validação de Projetos
**🎯 Função:** Testa projetos gerados em ambientes reais
**Comando:** `escapekit validate <caminho_do_projeto>`

**Capacidades atuais:**
- **Ambientes Multiplos**: Local, Docker, ou ambos (`--env both`)
- **Níveis de Teste**: Básico, padrão, rigoroso (`--level thorough`)
- **Auto-fixação**: `--auto-fix` para correção automática de problemas
- **Integração Governance**: `--govern` gera passaporte de governança
- **Referências Acadêmicas**: `--academic` mostra papers relacionados a cada issue

**Exemplo:**
```bash
escapekit validate ./my-project --env both --level thorough --govern
```

### 4. **`audit`** - Auditoria de Protocolos
**🎯 Função:** Gera relatórios de arquivos escape.json
**Comando:** `escapekit audit --file escape.json`

**Capacidades atuais:**
- **Formatos Múltiplos**: JSON, Markdown, HTML, terminal
- **Referências Acadêmicas**: Inclui links para papers relevantes
- **Análise de Compliance**: Verifica conformidade com contratos

### 5. **`coverage`** - Cobertura Acadêmica
**🎯 Função:** Mostra relatório de cobertura de papers acadêmicos
**Comando:** `escapekit coverage`

### 6. **`govern`** - Análise de Governança
**🎯 Função:** Analisa código e produz GovernancePassport
**Comando:** `escapekit govern [arquivo]`

**Capacidades atuais:**
- **Estratégias**: fast, thorough, compliance-first
- **Cache Inteligente**: Otimiza análises recorrentes (exceto em `--no-cache`)
- **Audit Trail**: Registra histórico completo de decisões

### 7. **`monitor`** - Monitoramento (Em Desenvolvimento)
**🎯 Função:** Monitoramento de deployments em produção
**Status:** Enterprise feature - placeholder implementado

## Sistema de Governança

### GovernancePassport
- **Risk Level**: Low, Medium, High, Critical com ícones visuais
- **Memory Enrichment**: Enriquecimento com memória federada
- **Compliance Stamps**: Selos de conformidade automatizados
- **Remediation Cost**: Estimativa de horas para correção

## Arquitetura Técnica

### Dependências Principais
- **Commander.js**: Framework CLI
- **ValidationEngine**: Sistema de validação abrangente
- **AuditLogger**: Sistema de logging e relatórios
- **GovernanceStack**: Pilha de governança com memória federada

### Fluxo de Trabalho Completo
1. **Analyze** → Identifica problemas
2. **Generate** → Resolve problemas e gera projeto
3. **Validate** → Testa em ambiente real
4. **Audit/Govern** → Gera documentação e compliance

## Status Atual

### ✅ Implementado
- Todos os 7 comandos principais funcionais
- Sistema de governança completo
- Validação multi-ambiente
- Relatórios em múltiplos formatos
- Cache inteligente para performance

### 🚧 Em Desenvolvimento
- Sistema de monitoramento de produção
- Federação completa de memória
- Extensões enterprise

### 📊 Estatísticas
- **Múltiplas plataformas** suportadas: 4
- **Formatos de saída**: 5+ (JSON, HTML, Markdown, terminal, etc.)
- **Níveis de validação**: 3
- **Estratégias de governança**: 3

A CLI está **produtiva e eficaz** para transformar código de IA em projetos de produção, com métricas reais de confiança e validações abrangentes.