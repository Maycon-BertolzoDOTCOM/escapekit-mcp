# Design Document — fix-usage-billing-ratelimit

## Overview

Adicionar rate limiters específicos para `/v1/usage` e `/v1/billing` dentro do bloco `if (isProd)` em `server.js`, seguindo o mesmo padrão já usado para `/v1/analyze` e `/v1/simulate`.

## Bug Condition Methodology

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type HttpRequest
  OUTPUT: boolean

  RETURN (
    (X.path STARTS_WITH "/v1/usage" OR X.path STARTS_WITH "/v1/billing")
    AND X.env = "production"
    AND NOT hasRateLimiter(X.path)
  )
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking — Usage Rate Limit
FOR ALL X WHERE X.path = "/v1/usage" AND X.env = "production" DO
  IF requestCount(X.ip, window=60s) > 30 THEN
    result ← handleRequest'(X)
    ASSERT result.status = 429
    ASSERT result.body.retryAfter >= 0
  END IF
END FOR

// Property: Fix Checking — Billing Webhook Rate Limit
FOR ALL X WHERE X.path = "/v1/billing/webhook" AND X.env = "production" DO
  IF requestCount(X.ip, window=60s) > 60 THEN
    result ← handleRequest'(X)
    ASSERT result.status = 429
    ASSERT result.body.retryAfter >= 0
  END IF
END FOR

// Property: Fix Checking — Billing General Rate Limit
FOR ALL X WHERE X.path STARTS_WITH "/v1/billing" AND X.env = "production" DO
  IF requestCount(X.ip, window=60s) > 20 THEN
    result ← handleRequest'(X)
    ASSERT result.status = 429
    ASSERT result.body.retryAfter >= 0
  END IF
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation — requests within limits behave identically
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR

// Property: Preservation — IP isolation
FOR ALL X1, X2 WHERE X1.ip != X2.ip DO
  ASSERT rateLimit(X1).counter IS_INDEPENDENT_OF rateLimit(X2).counter
END FOR
```

## Technical Context

### Arquivo afetado

`pisosrealview-pro-transformed/backend/server.js`

O bloco `if (isProd)` já contém um `rateLimit` global aplicado a `/v1/analyze` e `/v1/simulate`. Os endpoints `/v1/usage` e `/v1/billing` não estão incluídos nesse limiter nem possuem limiters próprios.

### Padrão existente (referência)

```js
if (isProd) {
  const limiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime
        ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        : 60;
      const retryAfter = Math.max(0, resetTime);
      res.status(429).json({ error: 'Too Many Requests', retryAfter });
    },
  });
  app.use('/v1/analyze', limiter);
  app.use('/v1/simulate', limiter);
}
```

### Problema do `fs.readFileSync` por requisição

`apiKeyStore.js` chama `fs.readFileSync(KEYS_FILE)` em cada invocação de `loadKeys()`. O endpoint `GET /v1/usage` chama `loadKeys()` diretamente. Sem rate limit, um único cliente pode forçar centenas de leituras síncronas de disco por segundo, bloqueando o event loop do Node.js e degradando todos os outros endpoints.

## Solution Design

### Novos rate limiters a adicionar em `server.js`

Três limiters específicos, todos dentro do bloco `if (isProd)` existente:

| Limiter | Rota | Janela | Max req/IP |
|---|---|---|---|
| `usageLimiter` | `/v1/usage` | 60s | 30 |
| `billingWebhookLimiter` | `/v1/billing/webhook` | 60s | 60 |
| `billingLimiter` | `/v1/billing` | 60s | 20 |

**Ordem de registro importante:** `billingWebhookLimiter` deve ser registrado antes de `billingLimiter` para que o webhook tenha seu próprio limite mais permissivo antes de cair no limite geral de billing.

### Handler de resposta 429

Reutilizar o mesmo padrão do limiter existente:

```js
handler: (req, res) => {
  const resetTime = req.rateLimit?.resetTime
    ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    : 60;
  res.status(429).json({ error: 'Too Many Requests', retryAfter: Math.max(0, resetTime) });
},
```

### Código final a inserir

```js
if (isProd) {
  // ... limiter existente para /v1/analyze e /v1/simulate ...

  const usageLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = req.rateLimit?.resetTime
        ? Math.max(0, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000))
        : 60;
      res.status(429).json({ error: 'Too Many Requests', retryAfter });
    },
  });
  app.use('/v1/usage', usageLimiter);

  const billingWebhookLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = req.rateLimit?.resetTime
        ? Math.max(0, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000))
        : 60;
      res.status(429).json({ error: 'Too Many Requests', retryAfter });
    },
  });
  app.use('/v1/billing/webhook', billingWebhookLimiter);

  const billingLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retryAfter = req.rateLimit?.resetTime
        ? Math.max(0, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000))
        : 60;
      res.status(429).json({ error: 'Too Many Requests', retryAfter });
    },
  });
  app.use('/v1/billing', billingLimiter);
}
```

## Correctness Properties

### Property 1 — Fix Checking: Usage limit enforced

Após exatamente 30 requisições `GET /v1/usage` do mesmo IP em menos de 1 minuto, a 31ª requisição deve retornar HTTP 429 com campo `retryAfter` numérico >= 0.

### Property 2 — Fix Checking: Webhook limit enforced

Após exatamente 60 requisições `POST /v1/billing/webhook` do mesmo IP em menos de 1 minuto, a 61ª requisição deve retornar HTTP 429 com campo `retryAfter` numérico >= 0.

### Property 3 — Preservation: Requests within limit pass through

Para qualquer sequência de N requisições onde N <= limite configurado, todas devem retornar status diferente de 429.

### Property 4 — Preservation: IP isolation

O contador de rate limit de um IP não afeta o contador de outro IP. Dois IPs podem cada um fazer até o limite máximo de requisições sem interferência.

### Property 5 — Preservation: Dev mode unaffected

Com `NODE_ENV !== 'production'`, nenhum dos novos limiters é registrado e todas as requisições passam normalmente.
