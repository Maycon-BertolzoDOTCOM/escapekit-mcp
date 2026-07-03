# Tasks — fix-trial-ratelimit

## Tasks

- [x] 1. Adicionar rate limiters para `/v1/auth/trial` e `/v1/auth` em `server.js`
  - [x] 1.1 Criar `trialLimiter` com windowMs=3.600.000, max=5, handler retornando 429 com `retryAfter`
  - [x] 1.2 Criar `authLimiter` com windowMs=900.000, max=20, handler retornando 429 com `retryAfter`
  - [x] 1.3 Registrar `app.post('/v1/auth/trial', trialLimiter)` antes de `app.use('/v1/auth', authRouter)`
  - [x] 1.4 Registrar `app.use('/v1/auth', authLimiter)` antes de `app.use('/v1/auth', authRouter)`

- [ ] 2. Escrever testes para o rate limiter de trial
  - [x] 2.1 Criar `backend/__tests__/trialRateLimit.test.js`
  - [x] 2.2 Testar que as primeiras 5 requisições do mesmo IP retornam status diferente de 429
  - [x] 2.3 Testar que a 6ª requisição do mesmo IP retorna 429 com campo `retryAfter`
  - [x] 2.4 Testar que após expiração da janela o IP é liberado (clock mockado)
  - [x] 2.5 Testar isolamento: IP diferente não é bloqueado quando outro IP esgotou o limite
  - [x] 2.6 Testar que `/v1/auth` (não-trial) usa o limite de 20 requisições em 15 minutos
