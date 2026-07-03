# Design — Deploy em Produção

## Decisões

**Backend: Railway** — suporta Node.js ESM, variáveis de ambiente via dashboard, restart automático, free tier suficiente para MVP. Alternativa: Render (mesmas características).

**Frontend: Vercel** — integração nativa com Vite/React, deploy automático via Git push, CDN global, HTTPS automático.

**Domínio:** Configurar CNAME no registrador apontando para Railway (backend) e Vercel (frontend). HTTPS provisionado automaticamente por ambas as plataformas.

## Configuração Railway (backend)

```
Start command: node --env-file=/dev/null server.js
# Variáveis carregadas pelo Railway, não por --env-file
```

Variáveis a configurar no Railway dashboard:
- `PORT` (Railway injeta automaticamente)
- `NODE_ENV=production`
- `CORS_ORIGIN=https://pisosrealview.com.br`
- `WAVESPEED_API_KEY`
- `ADMIN_SECRET`
- `RATE_LIMIT_MAX=60`
- `MAX_PAYLOAD_SIZE=10mb`

## Configuração Vercel (frontend)

Variáveis a configurar no Vercel dashboard:
- `VITE_API_BASE_URL=https://api.pisosrealview.com.br`

Build command: `npm run build`
Output directory: `dist`
Root directory: `frontend/`

## Ajuste no server.js para produção

O `--env-file=.env` no script `start` precisa ser removido ou condicional para produção, pois Railway injeta as variáveis diretamente no processo:

```javascript
// server.js — sem mudança necessária
// Railway injeta process.env automaticamente
// O --env-file só é usado localmente
```

O `package.json` precisa de dois scripts:
```json
"start": "node server.js",
"dev": "node --env-file=.env --watch server.js"
```

## Validação de variáveis obrigatórias no startup

```javascript
// backend/server.js — adicionar no topo
const REQUIRED_ENV = ['WAVESPEED_API_KEY', 'ADMIN_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Variável obrigatória ausente: ${key}`);
    process.exit(1);
  }
}
```
