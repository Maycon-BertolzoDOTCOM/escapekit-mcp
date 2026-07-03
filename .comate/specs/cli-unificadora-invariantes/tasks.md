# CLI Unificadora Com Princípios de Invariantes Sistêmicos - Plano de Tarefas

- [x] Task 1: Criar estrutura base da CLI
    - 1.1: Criar diretório tools/refactor-cli com estrutura organizada
    - 1.2: Implementar package.json com dependências necessárias
    - 1.3: Criar cli.js principal com sistema de comandos
    - 1.4: Implementar sistema de logging estruturado
    - 1.5: Adicionar configuração workspace no package.json principal

- [x] Task 2: Implementar sistema de gerenciamento de estado e backup
    - 2.1: Criar utils/backup-manager.js com backup automático
    - 2.2: Implementar checkpoint system para operações reversíveis
    - 2.3: Criar utils/progress-tracker.js com histórico de operações
    - 2.4: Implementar sistema de rollback baseado em checkpoints

- [x] Task 3: Implementar sistema de validação de invariantes
    - 3.1: Criar utils/invariant-checkers.js com validação de compilação
    - 3.2: Implementar validação de imports e dependências
    - 3.3: Criar system de invariantes configuráveis por projeto
    - 3.4: Implementar mecaminmo de auto-reparo para invariantes violados

- [ ] Task 4: Comandos de análise e diagnóstico
    - 4.1: Criar commands/analyze/project-structure.js com análise completa
    - 4.2: Implementar análise de padrões problemáticos no código
    - 4.3: Criar gerador automático de plano de refatoração
    - 4.4: Implementar relatórios estruturados de diagnóstico

- [ ] Task 5: Comandos de validação de invariantes
    - 5.1: Criar commands/invariants/validate-invariants.js
    - 5.2: Implementar pipeline completa de pré/duante/pós-validação
    - 5.3: Criar commands/invariants/check-progression.js para tracking
    - 5.4: Implementar relatórios de progresso consistentes

- [ ] Task 6: Comandos de refatoração de módulos
    - 6.1: Criar commands/refactor/migrate-modules.js
    - 6.2: Implementar migração controlada com checkpoint
    - 6.3: Criar commands/refactor/fix-imports.js com auto-correção
    - 6.4: Implementar integração com análise existente do EscapeKit

- [ ] Task 7: Comandos de setup backend/frontend
    - 7.1: Criar commands/refactor/setup-backend.js com configuração Express
    - 7.2: Implementar commands/refactor/setup-frontend.js com React+Vite
    - 7.3: Criar generator automático de rotas baseado em análise
    - 7.4: Implementar validação de integração entre backend/frontend

- [ ] Task 8: Comandos de validação completa
    - 8.1: Criar commands/validate/run-validation.js
    - 8.2: Implementar integration com ValidationEngine do EscapeKit
    - 8.3: Criar commands/validate/run-tests.js com execução automatizada
    - 8.4: Implementar pipeline de validação end-to-end

- [ ] Task 9: Finalização e integração
    - 9.1: Testar todos os comandos em cenários reais
    - 9.2: Validar sistema de invariantes com projeto pisosrealview-pro
    - 9.3: Documentar uso e exemplos da CLI
    - 9.4: Criar validação final de todos os invariantes propostos

- [ ] Task 10: Otimização e refinamento
    - 10.1: Implementar cache de resultados de validação
    - 10.2: Adicionar configuração via arquivo YAML
    - 10.3: Otimizar performance com execução incremental
    - 10.4: Criar sistema extensível para novos invariantes
