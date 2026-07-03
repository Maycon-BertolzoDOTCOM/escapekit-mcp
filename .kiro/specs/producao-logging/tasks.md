# Tarefas — Logging Estruturado

## Tarefas

- [x] 1. Atualizar `logger.js` para JSON estruturado
  - Adicionar campos `timestamp`, `level`, `component`, `event`
  - Suportar `LOG_LEVEL` via env var
  - Direcionar warn/error para stderr, info/debug para stdout
  - _Requisitos: 1.1, 1.2_

- [x] 2. Adicionar logs nos pontos críticos do ProviderRouter
  - Log `provider_success` após simulação bem-sucedida
  - Log `provider_failed` quando provider lança exceção
  - Log `fallback_activated` quando todos os providers falham
  - Log `all_providers_failed` com lista de providers tentados
  - _Requisitos: 1.3, 1.4, 2.1_

- [x] 3. Adicionar logs no validator e middleware
  - Log `invariant_violated` quando validator retorna violated: true
  - Log `api_key_invalid` quando middleware rejeita requisição
  - _Requisitos: 1.5_

- [ ] 4. Adicionar `LOG_LEVEL` ao `.env.example` e Railway dashboard
  - Valor padrão: `info` em produção, `debug` em desenvolvimento
  - _Requisitos: 1.2_
