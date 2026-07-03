# Design — Variáveis de Ambiente Seguras

## Ação imediata necessária

A chave `WAVESPEED_API_KEY=c991efe84cdc51b48e213c37392090a643c46d609cf67090f518b0c86d1a014e` está visível no arquivo `backend/.env` que pode estar no histórico Git. Ação: revogar e gerar nova chave no painel WaveSpeedAI.

## .env.example

```bash
# backend/.env.example
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
WAVESPEED_API_KEY=your_wavespeed_api_key_here
ZHIPU_API_KEY=
PIKA_API_KEY=
COMET_API_KEY=
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
MAX_PAYLOAD_SIZE=10mb
ADMIN_SECRET=change_me_in_production
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
LOG_LEVEL=info
```

## Validação no startup

```javascript
// backend/server.js
const REQUIRED = ['WAVESPEED_API_KEY', 'ADMIN_SECRET'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[startup] ERRO: variável obrigatória ausente: ${key}`);
    process.exit(1);
  }
}
```

## .gitignore

```
backend/.env
backend/data/api-keys.json
backend/services/gateway/credits.json
backend/services/gateway/task-metrics.json
```
