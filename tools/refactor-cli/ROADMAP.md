# ROADMAP - CLI Unificadora com Princípios de Invariantes Sistêmicos

## 📊 Status Atual

**Estado:** 🟡 Pausado (em branch separado)
**Completado:** 20% (Tarefas 1-2)
**Próxima tarefa:** Task 3 - Sistema de validação de invariantes
**Branch:** `feature/cli-refactor-tool` (isolado)

## ✅ Tarefas Concluídas

### Task 1: Estrutura Base da CLI (Completada)
- [x] **1.1:** Criar estrutura de diretórios da CLI
- [x] **1.2:** Configurar package.json com dependências específicas
- [x] **1.3:** Implementar cli.js principal com commander.js
- [x] **1.4:** Configurar sistema de logging estruturado

### Task 2: Sistema de Gerenciamento de Estado (Completada)
- [x] **2.1:** Implementar backup-manager.js com backup automático
- [x] **2.2:** Criar checkpoint system para operações reversíveis
- [x] **2.3:** Desenvolver progress-tracker.js com histórico
- [x] **2.4:** Sistema de rollback baseado em checkpoints

## 📋 Tarefas Pendentes (80% restante)

### Task 3: Sistema de Validação de Invariantes
- [x] **3.1:** Criar utils/invariant-checkers.js com validação de compilação
- [ ] **3.2:** Implementar validação de imports e dependências
- [ ] **3.3:** Criar system de invariantes configuráveis por projeto
- [ ] **3.4:** Implementar mecanismo de auto-reparo para invariantes violados

### Task 4: Comandos de Análise e Diagnóstico
- [ ] **4.1:** Comando analyze-structure com relatórios detalhados
- [ ] **4.2:** Sistema de identificação de padrões arquiteturais
- [ ] **4.3:** Análise de dependências circulares
- [ ] **4.4:** Geração de relatórios em múltiplos formatos

### Task 5: Comandos de Validação de Invariantes
- [ ] **5.1:** Comando validate-invariants com opções de auto-fix
- [ ] **5.2:** Sistema de progress tracking para validações
- [ ] **5.3:** Checkpoint automático antes de modificações
- [ ] **5.4:** Relatório de violações e estatísticas

### Task 6: Comandos de Refatoração de Módulos
- [ ] **6.1:** Sistema de migração controlada migrate-modules
- [ ] **6.2:** Correção automática de imports com fix-imports
- [ ] **6.3:** Validação de integridade pós-refatoração
- [ ] **6.4:** Rollback automático em caso de falha

### Task 7: Comandos de Setup Backend/Frontend
- [ ] **7.1:** Setup de backend Express com autoconfiguração
- [ ] **7.2:** Setup de frontend React + Vite integrado
- [ ] **7.3:** Configuração automática de CORS e roteamento
- [ ] **7.4:** Validação de ambiente e dependências

### Task 8: Comandos de Validação Completa
- [ ] **8.1:** Integração com ValidationEngine existente
- [ ] **8.2:** Execução de testes automatizados
- [ ] **8.3:** Validação cross-environment
- [ ] **8.4:** Relatórios de cobertura e métricas

### Task 9: Finalização e Integração
- [ ] **9.1:** Workflow completo de refatoração (comando `all`)
- [ ] **9.2:** Sistema de relatórios consolidados
- [ ] **9.3:** Validação final de invariantes
- [ ] **9.4:** Documentação e exemplos de uso

### Task 10: Otimização e Refinamento
- [ ] **10.1:** Otimização de performance
- [ ] **10.2:** Testes unitários para todos os módulos
- [ ] **10.3:** Configurações avançadas e customizações
- [ ] **10.4:** Integração com CI/CD

## ⏱️ Estimativa de Esforço Remanescente

**Total estimado:** 12-16 horas de desenvolvimento

- **Tarefas 3-4:** 4-5 horas (validação e análise)
- **Tarefas 5-6:** 3-4 horas (refatoração)  
- **Tarefas 7-8:** 3-4 horas (setup e validação final)
- **Tarefas 9-10:** 2-3 horas (integração e otimização)

## 🔄 Pré-requisitos para Retomada

### Cenário Ideal
1. **Projeto principal estável:** `pisosrealview-pro-transformed` funcionando (backend + frontend)
2. **Validação comercial:** Confirmado com Raildo que a estrutura está correta
3. **Teste real:** Usar a CLI no projeto já refatorado como caso de teste

### Condições Mínimas
- Projeto principal compilando sem erros
- Estrutura de diretórios consistente
- Dependências instaladas e funcionais

## 🎯 Plano de Retomada

### Fase 1: Teste e Validação (30 min)
```bash
git checkout feature/cli-refactor-tool
cd tools/refactor-cli
npm install
# Testar comandos básicos no projeto principal
./cli.js validate-invariants --dry-run
./cli.js analyze-structure --output summary
```

### Fase 2: Implementação Core (6-8 horas)
- Completar Task 3 (sistema de validação)
- Implementar Task 4 (análise detalhada)
- Testar no projeto real

### Fase 3: Refatoração e Setup (4-5 horas)
- Completar Tasks 5-8
- Validar comandos de refatoração
- Executar workflow completo

### Fase 4: Finalização (2-3 horas)
- Otimizações e testes
- Documentação final
- Integração com CI/CD

## 🔧 Comandos Implementados (Disponíveis Agora)

```bash
# Comandos funcionais já testados
./cli.js validate-invariants [--auto-fix] [--strict] [--json]
./cli.js analyze-structure [--deep] [--target <target>] [--report <path>]
./cli.js migrate-modules [--checkpoint] [--dry-run] [--force]
./cli.js fix-imports [--interactive] [--validate]
./cli.js setup-backend [--port <port>] [--cors <origin>]
./cli.js setup-frontend [--template <template>] [--with-typescript]
./cli.js run-validation [--environment <env>] [--level <level>] [--auto-fix]
./cli.js run-tests [--coverage] [--watch] [--reporters <list>]

# Workflow completo
./cli.js all [--checkpoint] [--validate-each] [--report]
```

## 📁 Arquivos Implementados

```
tools/refactor-cli/
├── cli.js                 # CLI principal (comandos organizados)
├── package.json           # Dependências e configuração
└── utils/
    ├── backup-manager.js  # Sistema de backup e rollback
    ├── invariant-checkers.js # Validação de invariantes 
    └── progress-tracker.js   # Tracking estruturado
```

## 🚨 Notas Importantes

- **Não usar em produção:** A CLI ainda não foi validada em projetos reais
- **Backup obrigatório:** Sempre rodar em modo `--dry-run` primeiro
- **Compatibilidade:** Testada apenas com ES modules e TypeScript
- **Dependências:** Verificar `package.json` para instalação completa

## 📞 Contato para Retomada

Quando estiver pronto para retomar o desenvolvimento:

1. **Verificar pré-requisitos** (projeto principal estável)
2. **Testar comandos básicos** no projeto refatorado
3. **Executar** tasks seguindo a ordem do roadmap
4. **Validar** resultados com Raildo antes de avançar

---
*Documento atualizado em: 2026-04-07*
*Último commit: 7fe179f - Estrutura base da CLI (tasks 1-2)*