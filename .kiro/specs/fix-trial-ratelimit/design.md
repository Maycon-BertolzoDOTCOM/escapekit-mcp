# Design Document — fix-trial-ratelimit

## Technical Context

O servidor usa Express com `express-rate-limit`. O rate limiter existente é instanciado dentro do bloco `if (isProd)` em `server.js` e registrado apenas para `/v1/analyze` e `/v1/simulate`. O router de auth é montado em `/v1/auth` sem qualquer middleware de rate limiting.

Arquivo afetado: `pisosrealview-pro-transformed/backend/server.js`

## Approach

Adicionar dois novos limiters dentro do bloco `if (isProd)`, registrados **antes** do `app.use('/v1/auth', authRouter)`:

1. `trialLimiter` — específico para `POST /v1/auth/trial`
2. `authLimiter` — geral para `/v1/auth`

A ordem de registro garante que `trialLimiter` (mais restritivo) seja avaliado antes de `authLimiter` para requisições ao endpoint de trial.

## Rate Limiter Specifications

### trialLimiter

| Parâmetro | Valor |
|-----------|-------|
| windowMs | 3.600.000 ms (1 hora) |
| max | 5 |
| keyGenerator | `req.ip` (padrão) |
| standardHeaders | true |
| legacyHeaders | false |
| handler | HTTP 429 `{ error: "Too Many Requests", retryAfter: <segundos> }` |

### authLimiter

| Parâmetro | Valor |
|-----------|-------|
| windowMs | 900.000 ms (15 minutos) |
| max | 20 |
| keyGenerator | `req.ip` (padrão) |
| standardHeaders | true |
| legacyHeaders | false |
| handler | HTTP 429 `{ error: "Too Many Requests", retryAfter: <segundos> }` |

## Implementation Delta

```js
// Dentro do bloco if (isProd), após o limiter existente:

const trialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      : 3600;
    res.status(429).json({ error: 'Too Many Requests', retryAfter: Math.max(0, resetTime) });
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      : 900;
    res.status(429).json({ error: 'Too Many Requests', retryAfter: Math.max(0, resetTime) });
  },
});

app.post('/v1/auth/trial', trialLimiter);
app.use('/v1/auth', authLimiter);
```

Os dois `app.use`/`app.post` acima devem ser inseridos **antes** de `app.use('/v1/auth', authRouter)`.

## Correctness Properties

### Property 1 — Fix Checking: bloqueio após 5 tentativas

```pascal
FOR ALL ip IN IPs DO
  FOR i IN 1..5 DO
    send POST /v1/auth/trial from ip
    ASSERT response.status != 429
  END FOR
  send POST /v1/auth/trial from ip  // 6ª tentativa
  ASSERT response.status = 429
  ASSERT response.body.retryAfter >= 0
END FOR
```

### Property 2 — Preservation: janela expira e IP é liberado

```pascal
FOR ALL ip IN IPs DO
  exhaust limit (5 requests)
  advance clock by 1 hour
  send POST /v1/auth/trial from ip
  ASSERT response.status != 429
END FOR
```

### Property 3 — Preservation: isolamento por IP

```pascal
FOR ALL ip1, ip2 IN IPs WHERE ip1 != ip2 DO
  exhaust limit for ip1 (5 requests)
  send POST /v1/auth/trial from ip2
  ASSERT response.status != 429  // ip2 não é afetado
END FOR
```

### Property 4 — Preservation: requisições legítimas dentro do limite

```pascal
FOR ALL n IN 1..5 DO
  send n requests POST /v1/auth/trial from same ip
  ASSERT all responses.status != 429
END FOR
```

## Test Strategy

- Usar `express-rate-limit` com store em memória e `skipSuccessfulRequests: false`
- Em testes, instanciar o app com `NODE_ENV=production` e usar `supertest`
- Para simular expiração de janela: usar store customizado com clock mockado ou `jest.useFakeTimers`
- Arquivo de teste sugerido: `backend/__tests__/trialRateLimit.test.js`
