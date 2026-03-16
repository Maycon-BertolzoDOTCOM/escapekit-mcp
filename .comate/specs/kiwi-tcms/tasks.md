# Plano de Tarefas - Kiwi TCMS Sprint 3 (Fase 2: Carga de Resultados)

## Fase 1: Integração Básica ✅ (Concluída)
- [✓] 3.1: Criar estrutura básica de integração
    - [✓] Cliente API (kiwi-client.ts)
    - [✓] Parser de resultados (test-parser.ts)
    - [✓] Script principal (run-kiwi-integration.ts)
    - [✓] Configuração (kiwi-tcms.json)

## Fase 2: Carga de Resultados 🔄 (Em Progresso)

- [x] Tarefa 3.2.1: Implementar VitestAdapter
    - 3.2.1.1: Criar arquivo `src/adapters/vitest-adapter.ts`
    - 3.2.1.2: Implementar interface `TestAdapter` com métodos `load()` e `parse()`
    - 3.2.1.3: Implementar parse de JSON do Vitest (suporte a vitest output format)
    - 3.2.1.4: Mapear status do Vitest (passed, failed, skipped, todo) para Kiwi TCMS
    - 3.2.1.5: Extrair metadados: nome do teste, duração, stack trace de erros
    - 3.2.1.6: Suportar test suites aninhadas (describe > test)
    - 3.2.1.7: Tratar casos especiais: beforeEach/afterEach hooks
    - 3.2.1.8: Criar testes unitários para VitestAdapter
    - 3.2.1.9: Testar com os 402+ testes do projeto testintel
    - 3.2.1.10: Validar que todos os testes são importados corretamente

- [x] Tarefa 3.2.2: Implementar MochaAdapter
    - 3.2.2.1: Criar arquivo `src/adapters/mocha-adapter.ts`
    - 3.2.2.2: Implementar parse de XML do Mocha (suporte a mocha xunit reporter)
    - 3.2.2.3: Mapear status do Mocha (pass, fail, pending) para Kiwi TCMS
    - 3.2.2.4: Tratar hooks do Mocha (before, after, beforeEach, afterEach)
    - 3.2.2.5: Criar testes unitários para MochaAdapter
    - 3.2.2.6: Criar exemplos de uso com projeto Mocha existente

- [x] Tarefa 3.2.3: Implementar CustomTestParser
    - 3.2.3.1: Criar arquivo `src/adapters/custom-parser.ts`
    - 3.2.3.2: Definir esquema JSON para formatos customizados
    - 3.2.3.3: Implementar validação de esquema usando `ajv`
    - 3.2.3.4: Criar sistema de plugins para extensibilidade
    - 3.2.3.5: Documentar API para criar plugins customizados
    - 3.2.3.6: Criar exemplos de plugins
    - 3.2.3.7: Criar testes unitários para CustomTestParser

- [x] Tarefa 3.2.4: Integrar Adapters no Script Principal
    - 3.2.4.1: Atualizar `scripts/run-kiwi-integration.ts` para selecionar adapter baseado no framework
    - 3.2.4.2: Adicionar flag `--framework` (vitest, mocha, custom)
    - 3.2.4.3: Implementar detecção automática do framework
    - 3.2.4.4: Adicionar suporte para múltiplos arquivos de resultado
    - 3.2.4.5: Implementar tratamento de erros e retry logic

- [x] Tarefa 3.2.5: Criar Documentação de Integração
    - 3.2.5.1: Criar `docs/kiwi-tcms-integration.md`
    - 3.2.5.2: Documentar como configurar Vitest para exportar resultados
    - 3.2.5.3: Documentar como configurar Mocha para exportar resultados
    - 3.2.5.4: Documentar como criar formatos customizados
    - 3.2.5.5: Criar exemplos práticos de uso
    - 3.2.5.6: Documentar troubleshooting comum

- [x] Tarefa 3.2.6: Testes de Integração
    - 3.2.6.1: Criar script de teste end-to-end com Vitest
    - 3.2.6.2: Criar script de teste end-to-end com Mocha
    - 3.2.6.3: Testar com dados reais dos 402+ testes
    - 3.2.6.4: Validar que todos os testes são importados para Kiwi TCMS
    - 3.2.6.5: Verificar dashboards do Kiwi TCMS mostram resultados corretos

## Fase 3: CI/CD (Próxima Fase)
- [ ] 3.3: Configurar workflows para:
    - [ ] GitHub Actions
    - [ ] GitLab CI
    - [ ] Execução local

## Fase 4: Monitoramento (Próxima Fase)
- [ ] 3.4: Criar dashboards:
    - [ ] Visão geral
    - [ ] Detalhes por módulo
    - [ ] Tendências históricas
    - [ ] Alertas automáticos

## Cronograma
- **Início Fase 2**: 2026-03-16
- **Entrega Tarefa 3.2.1**: 2026-03-17
- **Entrega Tarefa 3.2.2**: 2026-03-18
- **Entrega Tarefa 3.2.3**: 2026-03-19
- **Entrega Completa Fase 2**: 2026-03-20

## Critérios de Aceite
- ✅ Fase 1 concluída
- [ ] VitestAdapter processa 402+ testes do testintel
- [ ] MochaAdapter suporta pelo menos 1 projeto existente
- [ ] CustomParser é extensível
- [ ] Documentação completa
- [ ] Testes de integração passando (≥ 95%)
- [ ] Tempo de importação < 30 segundos para 402 testes

## Métricas de Sucesso
- **Cobertura de testes**: 100% dos adapters
- **Performance**: < 100ms por teste na importação
- **Confiabilidade**: 99.9% de taxa de sucesso na importação
- **Documentação**: Todos os adapters documentados com exemplos
