# API Gateway com Fallback para Provedores Chineses

- [ ] Criar estrutura base do gateway
    - 1.1: Criar diretório service-core/gateway/
    - 1.2: Implementar interface comum AIProvider
    - 1.3: Criar tipos e estruturas de dados
    - 1.4: Implementar collector de métricas

- [ ] Implementar provedores chineses
    - 2.1: Implementar Alibaba Qwen Provider
    - 2.2: Implementar Tencent Hunyuan Provider  
    - 2.3: Implementar Huawei Pangu Provider
    - 2.4: Implementar Fallback Local Provider

- [ ] Implementar orquestrador inteligente
    - 3.1: Criar GatewayOrchestrator com fallback
    - 3.2: Implementar lógica de reordenação dinâmica
    - 3.3: Adicionar health checks automáticos
    - 3.4: Implementar sistema de métricas e scores

- [ ] Integrar com sistema existente
    - 4.1: Identificar ponto de integração no renderWithSelfAudit
    - 4.2: Substituir chamada direta à IA pelo gateway
    - 4.3: Configurar variáveis de ambiente
    - 4.4: Testar integração em modo local

- [ ] Testes e validações
    - 5.1: Criar testes unitários para cada provedor
    - 5.2: Criar testes de integração do gateway
    - 5.3: Testar cenários de fallback
    - 5.4: Validar métricas e reordenação