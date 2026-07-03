# Design — CreditTracker com Redis

## Decisões

**Redis provider: Upstash** — free tier com 10k comandos/dia, suficiente para MVP. SDK: `@upstash/redis` (HTTP-based, sem conexão persistente, ideal para serverless/Railway).

**Fallback em memória:** Se Redis indisponível, usar `Map` em memória. Aceita race condition em caso de falha do Redis — melhor que parar o sistema.

**Chave Redis:** `credits:{providerId}:{YYYY-MM}` com TTL de 35 dias.

## Interface mantida

```javascript
// Mesma interface pública — sem breaking changes
class CreditTracker {
  constructor({ clock, redisClient } = {}) {}
  isExhausted(provider) {}   // async agora
  increment(providerId) {}   // async agora
  getState(providerId, limit) {} // async agora
  reset(providerId) {}       // async agora
}
```

Nota: os métodos se tornam `async`. O `ProviderRouter` já usa `await` nas chamadas, então não há breaking change.

## Implementação

```javascript
// backend/services/gateway/CreditTracker.js
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function redisKey(providerId) {
  return `credits:${providerId}:${currentMonth()}`;
}

export class CreditTracker {
  constructor({ clock = () => new Date(), redisClient = redis } = {}) {
    this._clock = clock;
    this._redis = redisClient;
    this._fallback = new Map(); // usado quando Redis indisponível
  }

  async increment(providerId) {
    const key = redisKey(providerId);
    try {
      if (this._redis) {
        await this._redis.incr(key);
        await this._redis.expire(key, 35 * 24 * 3600);
        return;
      }
    } catch (err) {
      console.error('[CreditTracker] Redis error, usando fallback:', err.message);
    }
    // fallback em memória
    this._fallback.set(key, (this._fallback.get(key) || 0) + 1);
  }

  async isExhausted(provider) {
    if (!provider.freeCreditLimit) return false;
    const used = await this._getCount(provider.id);
    return used >= provider.freeCreditLimit;
  }

  async getState(providerId, freeCreditLimit) {
    const used = await this._getCount(providerId);
    const remaining = freeCreditLimit ? Math.max(0, freeCreditLimit - used) : null;
    return { used, remaining };
  }

  async reset(providerId) {
    const key = redisKey(providerId);
    try {
      if (this._redis) {
        if (providerId) {
          await this._redis.set(key, 0);
        }
        // reset all: não implementado em Redis sem scan — aceitar limitação no MVP
        return;
      }
    } catch (err) {
      console.error('[CreditTracker] Redis error no reset:', err.message);
    }
    this._fallback.set(key, 0);
  }

  async _getCount(providerId) {
    const key = redisKey(providerId);
    try {
      if (this._redis) {
        const val = await this._redis.get(key);
        return parseInt(val || '0', 10);
      }
    } catch (err) {
      console.error('[CreditTracker] Redis error no get:', err.message);
    }
    return this._fallback.get(key) || 0;
  }
}
```

## Variáveis de ambiente necessárias

```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

## Estratégia de testes

Os testes existentes usam mock de `fs`. Com Redis, usar mock do `redisClient`:

```javascript
const mockRedis = {
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  get: vi.fn().mockResolvedValue('0'),
  set: vi.fn().mockResolvedValue('OK'),
};
const tracker = new CreditTracker({ redisClient: mockRedis });
```
