# Design — Logging Estruturado

## Decisões

**Sem biblioteca externa** — usar `console.log(JSON.stringify(...))` diretamente. Railway captura stdout/stderr automaticamente. Sem overhead de dependência.

**Logger centralizado:** `backend/services/gateway/logger.js` já existe. Expandir para suportar JSON estruturado.

## Implementação

```javascript
// backend/services/gateway/logger.js (atualizado)
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

export function log(level, component, event, data = {}) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    event,
    ...data,
  };

  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(output);
  } else {
    console.log(output);
  }
}
```

## Eventos a logar

| Evento | Level | Campos extras |
|---|---|---|
| `provider_success` | info | provider, latencyMs, fidelity, difficulty |
| `provider_failed` | warn | provider, error, latencyMs, difficulty |
| `fallback_activated` | warn | clientId, reason |
| `invariant_violated` | info | invariant, score, provider |
| `all_providers_failed` | error | providers_tried, clientId |
| `api_key_invalid` | warn | ip, path |
| `rate_limit_exceeded` | warn | clientId, usage, limit |
