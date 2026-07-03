# Tarefas — CreditTracker com Redis

## Tarefas

- [ ] 1. Instalar dependência Upstash Redis
  - `npm install @upstash/redis` no `backend/`
  - Criar conta Upstash e obter `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
  - Adicionar variáveis ao `.env.example` e ao Railway dashboard
  - _Requisitos: 1.1, 1.2_

- [ ] 2. Reescrever `CreditTracker.js` com Redis
  - Substituir persistência em JSON por `INCR`/`GET`/`SET` do Redis
  - Usar chave `credits:{providerId}:{YYYY-MM}` com TTL de 35 dias
  - Implementar fallback em memória quando Redis indisponível
  - Manter interface pública idêntica (métodos se tornam async)
  - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 3. Atualizar `ProviderRouter.js` para await nas chamadas do CreditTracker
  - Adicionar `await` em `this.tracker.isExhausted()`, `this.tracker.increment()`, `this.tracker.getState()`
  - Verificar que os testes do ProviderRouter continuam passando
  - _Requisitos: 3.1_

- [ ] 4. Atualizar testes do CreditTracker para usar mock Redis
  - Substituir mock de `fs` por mock do `redisClient`
  - Garantir que os 13 testes existentes continuam passando com a nova implementação
  - Adicionar teste específico de atomicidade: 100 incrementos concorrentes via mock
  - _Requisitos: 3.1, 3.2, 3.3_

- [ ] 5. Teste de integração com Redis real
  - Criar script `backend/scripts/test-redis.js` que conecta ao Upstash e faz INCR/GET/RESET
  - Executar manualmente antes do deploy para confirmar conectividade
  - _Requisitos: 1.1, 1.2_
