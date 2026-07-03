# Design — Autenticação por API Key

## Decisões

**Armazenamento das keys:** JSON em arquivo `backend/data/api-keys.json` para MVP. Migrar para Redis/banco quando necessário. Estrutura:

```json
{
  "sk_live_abc123": {
    "clientId": "loja-joao",
    "planId": "basic",
    "active": true,
    "createdAt": "2026-04-11T00:00:00Z",
    "usage": { "2026-04": 45 }
  }
}
```

**Middleware de autenticação:** `backend/middleware/apiKey.js` — lido antes de qualquer rota de simulação.

**Limites por plano:**
```javascript
const PLAN_LIMITS = {
  basic: 200,
  popular: 500,
  pro: 1000,
  unlimited: Infinity,
};
```

## Fluxo de autenticação

```
Request → apiKeyMiddleware
  → sem header X-API-Key → 401
  → key não encontrada → 401
  → key inativa → 401
  → limite excedido → 429
  → ok → req.client = { clientId, planId } → next()
```

## Implementação do middleware

```javascript
// backend/middleware/apiKey.js
import { loadKeys, incrementUsage, getUsage } from '../services/apiKeyStore.js';

export async function apiKeyMiddleware(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'API key obrigatória' });

  const keys = loadKeys();
  const client = keys[key];
  if (!client || !client.active) return res.status(401).json({ error: 'API key inválida' });

  const limit = PLAN_LIMITS[client.planId] ?? 200;
  const usage = getUsage(client, currentMonth());

  if (usage >= limit) {
    return res.status(429).json({
      error: 'Limite mensal atingido',
      resetAt: nextMonthFirst(),
    });
  }

  if (usage >= limit * 0.8) {
    res.setHeader('X-Usage-Warning', 'true');
  }

  req.client = { clientId: client.clientId, planId: client.planId };
  next();
}
```

## Endpoints admin

```
POST /admin/keys
  Body: { clientId, planId }
  Response: { key: "sk_live_...", clientId, planId }

DELETE /admin/keys/:key
  Response: { ok: true }

GET /admin/keys
  Response: { keys: [...] }
```

## Geração de API key

```javascript
import { randomBytes } from 'crypto';
const key = 'sk_live_' + randomBytes(16).toString('hex');
```
