# Plano de Unificação de Simulação Visual

## Objetivo
Eliminar redundância arquitetural entre 3 sistemas concorrentes de simulação visual, consolidando tudo no gateway orquestrador.

- [x] **Tarefa 1: Eliminar sistemas redundantes**
  - 1.1: Remover arquivo materialSimulator.ts completamente
  - 1.2: Remover arquivo rendering.ts (Gemini) se for redundante
  - 1.3: Verificar imports em outros arquivos que referenciam os sistemas removidos
  - 1.4: Atualizar package.json se houver dependências específicas

- [x] **Tarefa 2: Modificar frontend para usar gateway unificado**
  - 2.1: Analisar App.tsx para identificar chamadas ao materialSimulator
  - 2.2: Substituir materialSimulator.renderFlooring() por gatewayOrchestrator.callWithFallback()
  - 2.3: Ajustar parâmetros da chamada para formato do gateway
  - 2.4: Adicionar tratamento de erro específico para gateway
  - 2.5: Testar integração frontend-gateway localmente

- [x] **Tarefa 3: Corrigir erros TypeScript restantes**
  - 3.1: Identificar todos os 7 erros de TypeScript após build
  - 3.2: Corrigir parâmetros não utilizados (renomear com _)
  - 3.3: Remover imports não utilizados  
  - 3.4: Verificar se métricas não utilizadas precisam ser implementadas ou removidas
  - 3.5: Executar npm run build para confirmar correções

- [x] **Tarefa 4: Validar gateway orquestrador**
  - 4.1: Testar gateway com WaveSpeedAI provider ativo
  - 4.2: Verificar fallback chain: WaveSpeedAI → AlibabaQwen → TencentHunyuan → HuaweiPangu → FallbackLocal
  - 4.3: Validar métricas de latência e sucesso
  - 4.4: Testar circuit breaker com provedores simulados offline

- [x] **Tarefa 5: Teste completo após unificação**
  - 5.1: Executar npm run build para confirmar build limpa
  - 5.2: Testar CLI com comando analyze em arquivo de teste
  - 5.3: Testar frontend com imagem real de piso
  - 5.4: Validar simulação visual no navegador
  - 5.5: Verificar logs de métricas do gateway

- [x] **Tarefa 6: Validação final e documentação**
  - 6.1: Confirmar que apenas gateway é usado para simulação visual
  - 6.2: Verificar que fallback funciona corretamente
  - 6.3: Documentar arquitetura unificada
  - 6.4: Atualizar README se necessário
