# Tasks — fix-usage-billing-ratelimit

## Tasks

- [x] 1. Adicionar rate limiter para `/v1/usage` em `server.js`
  - Dentro do bloco `if (isProd)` existente, criar `usageLimiter` com `windowMs: 60_000` e `max: 30`
  - Registrar com `app.use('/v1/usage', usageLimiter)` antes do `app.use('/v1/usage', usageRouter)`
  - Handler de 429 deve retornar `{ error: 'Too Many Requests', retryAfter }` com o mesmo padrão do limiter existente
  - Arquivo: `pisosrealview-pro-transformed/backend/server.js`

- [x] 2. Adicionar rate limiter para `/v1/billing/webhook` em `server.js`
  - Dentro do bloco `if (isProd)` existente, criar `billingWebhookLimiter` com `windowMs: 60_000` e `max: 60`
  - Registrar com `app.use('/v1/billing/webhook', billingWebhookLimiter)` antes do limiter geral de billing
  - Handler de 429 com o mesmo padrão
  - Arquivo: `pisosrealview-pro-transformed/backend/server.js`

- [x] 3. Adicionar rate limiter geral para `/v1/billing` em `server.js`
  - Dentro do bloco `if (isProd)` existente, criar `billingLimiter` com `windowMs: 60_000` e `max: 20`
  - Registrar com `app.use('/v1/billing', billingLimiter)` após o `billingWebhookLimiter` (para que webhook tenha seu próprio limite primeiro)
  - Handler de 429 com o mesmo padrão
  - Arquivo: `pisosrealview-pro-transformed/backend/server.js`

- [x] 4. Escrever testes para os novos rate limiters
  - Criar `pisosrealview-pro-transformed/backend/__tests__/rateLimitUsageBilling.test.js`
  - Testar que a 31ª requisição para `/v1/usage` retorna 429 (Property 1)
  - Testar que a 61ª requisição para `/v1/billing/webhook` retorna 429 (Property 2)
  - Testar que a 21ª requisição para `/v1/billing` retorna 429
  - Testar que requisições dentro do limite retornam status != 429 (Property 3)
  - Testar que IPs diferentes têm contadores independentes (Property 4)
  - Usar `supertest` e `express-rate-limit` com `skip` ou store em memória para isolar testes
