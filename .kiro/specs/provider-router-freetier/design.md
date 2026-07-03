# Documento de Design

## Visão Geral

O `ProviderRouter` substitui o arquivo `backend/services/gateway/index.js` por uma arquitetura modular orientada a custo. A lógica de cascata estática é substituída por um roteador dinâmico que ordena provedores por `costTier`, verifica disponibilidade de créditos via `CreditTracker` e executa cada provedor com timeout controlado.

A interface pública permanece idêntica ao gateway atual (`requestSimulation`), garantindo zero alterações no `materialApplier` e no frontend.

## Arquitetura de Componentes

```
backend/services/gateway/
├── index.js                  ← ponto de entrada público (mantém interface atual)
├── ProviderRouter.js         ← lógica central de roteamento
├── CreditTracker.js          ← rastreamento e persistência de créditos
├── providers/
│   ├── pikaLabs.js           ← adaptador Pika Labs
│   ├── zhipuCogView.js       ← adaptador Zhipu CogVideoX-Flash (existente, refatorado)
│   ├── waveSpeedAI.js        ← adaptador WaveSpeedAI (existente, refatorado)
│   ├── cometAPI.js           ← adaptador CometAPI
│   └── localFallback.js      ← fallback local textual (existente, extraído)
└── credits.json              ← estado persistido dos contadores (gerado em runtime)
```

## Modelo de Dados

### Definição de Provedor

```js
{
  id: 'pika-labs',           // identificador único
  costTier: 0,               // 0 = gratuito, 1 = créditos iniciais, 2 = pago, 3 = agregador
  freeCreditLimit: 80,       // 0 = sem limite gratuito (ilimitado ou pago direto)
  envKey: 'PIKA_API_KEY',    // variável de ambiente da chave de API
  call: async (imageBase64, material, context) => { ... }
}
```

### Estado de Créditos (credits.json)

```json
{
  "month": "2025-07",
  "counters": {
    "pika-labs": 12,
    "zhipu-cogview": 0,
    "wavespeed-ai": 0,
    "comet-api": 0
  }
}
```

### Objeto de Resposta

```js
{
  success: true | false,
  editedImageBase64: "data:image/jpeg;base64,...",  // null no fallback
  fidelity: 0.85,                                   // 0.0 no fallback
  provider: 'pika-labs',
  fallback: false,
  fallbackDescription: undefined                    // string no fallback
}
```

## Fluxo de Roteamento

```
requestSimulation(imageBase64, material, context)
  │
  ▼
ProviderRouter.route()
  │
  ├─ Para cada provedor em ordem de costTier:
  │   ├─ [1] Verificar se API key está configurada → pular se não
  │   ├─ [2] Verificar CreditTracker → pular se FreeTier esgotado
  │   ├─ [3] Chamar provider.call() com AbortController (timeout)
  │   ├─ [4] Se sucesso → CreditTracker.increment() → log → retornar
  │   └─ [5] Se falha → log warning → tentar próximo
  │
  └─ Se todos falharam → retornar Fallback Local
```

## Implementação dos Componentes

### ProviderRouter.js

```js
import { CreditTracker } from './CreditTracker.js';
import { buildProviders } from './providers/index.js';
import { log } from './logger.js';

export class ProviderRouter {
  constructor(providers = buildProviders()) {
    // Ordena por costTier crescente na inicialização
    this.providers = [...providers].sort((a, b) => a.costTier - b.costTier);
    this.tracker = new CreditTracker();
    this.timeoutMs = parseInt(process.env.PROVIDER_TIMEOUT_MS || '45000', 10);
    
    // Log de inicialização: quais provedores estão disponíveis
    const available = this.providers
      .filter(p => !p.envKey || process.env[p.envKey])
      .map(p => p.id);
    log('info', 'ProviderRouter', 'initialized', { available, total: this.providers.length });
  }

  async route(imageBase64, material, context) {
    for (const provider of this.providers) {
      // Pular se sem API key
      if (provider.envKey && !process.env[provider.envKey]) {
        log('info', provider.id, 'skipped', { reason: 'no_api_key' });
        continue;
      }

      // Pular se FreeTier esgotado
      if (this.tracker.isExhausted(provider)) {
        log('info', provider.id, 'skipped', { reason: 'free_tier_exhausted' });
        continue;
      }

      try {
        const result = await this._callWithTimeout(provider, imageBase64, material, context);
        if (result.success) {
          this.tracker.increment(provider.id);
          const credits = this.tracker.getState(provider.id, provider.freeCreditLimit);
          log('info', provider.id, 'success', { used: credits.used, remaining: credits.remaining });
          return { ...result, provider: provider.id };
        }
      } catch (err) {
        log('warn', provider.id, 'failed', { reason: err.message });
      }
    }

    // Fallback local sempre disponível
    return {
      success: false,
      fallback: true,
      editedImageBase64: null,
      fidelity: 0.0,
      provider: 'local-fallback',
      fallbackDescription: `Simulação indisponível. O material '${material.type} ${material.color} ${material.dimensions}' seria aplicado ao piso.`,
    };
  }

  async _callWithTimeout(provider, imageBase64, material, context) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await provider.call(imageBase64, material, context, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  resetCredits(providerId) {
    return this.tracker.reset(providerId);
  }
}
```

### CreditTracker.js

```js
import fs from 'fs';
import path from 'path';

const CREDITS_FILE = path.join(process.cwd(), 'backend/services/gateway/credits.json');

export class CreditTracker {
  constructor() {
    this.state = this._load();
  }

  isExhausted(provider) {
    this._ensureMonth();
    if (!provider.freeCreditLimit) return false;
    const used = this.state.counters[provider.id] || 0;
    return used >= provider.freeCreditLimit;
  }

  increment(providerId) {
    this._ensureMonth();
    this.state.counters[providerId] = (this.state.counters[providerId] || 0) + 1;
    this._save();
  }

  getState(providerId, freeCreditLimit) {
    this._ensureMonth();
    const used = this.state.counters[providerId] || 0;
    const remaining = freeCreditLimit ? Math.max(0, freeCreditLimit - used) : null;
    return { used, remaining };
  }

  reset(providerId) {
    this._ensureMonth();
    if (providerId) {
      this.state.counters[providerId] = 0;
    } else {
      Object.keys(this.state.counters).forEach(k => { this.state.counters[k] = 0; });
    }
    this._save();
    return this.state.counters;
  }

  _ensureMonth() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (this.state.month !== currentMonth) {
      this.state = { month: currentMonth, counters: {} };
      this._save();
    }
  }

  _load() {
    try {
      const raw = fs.readFileSync(CREDITS_FILE, 'utf8');
      const data = JSON.parse(raw);
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (data.month !== currentMonth) return { month: currentMonth, counters: {} };
      return data;
    } catch {
      return { month: new Date().toISOString().slice(0, 7), counters: {} };
    }
  }

  _save() {
    fs.writeFileSync(CREDITS_FILE, JSON.stringify(this.state, null, 2));
  }
}
```

### providers/index.js — Registro de Provedores

```js
import { pikaLabs }      from './pikaLabs.js';
import { zhipuCogView }  from './zhipuCogView.js';
import { waveSpeedAI }   from './waveSpeedAI.js';
import { cometAPI }      from './cometAPI.js';

export function buildProviders() {
  return [
    {
      id: 'pika-labs',
      costTier: 0,
      freeCreditLimit: parseInt(process.env.PIKA_FREE_CREDITS_LIMIT || '80', 10),
      envKey: 'PIKA_API_KEY',
      call: pikaLabs,
    },
    {
      id: 'zhipu-cogview',
      costTier: 0,
      freeCreditLimit: parseInt(process.env.ZHIPU_FREE_CREDITS_LIMIT || '0', 10),
      envKey: 'ZHIPU_API_KEY',
      call: zhipuCogView,
    },
    {
      id: 'wavespeed-ai',
      costTier: 1,
      freeCreditLimit: 0,
      envKey: 'WAVESPEED_API_KEY',
      call: waveSpeedAI,
    },
    {
      id: 'comet-api',
      costTier: 2,
      freeCreditLimit: 0,
      envKey: 'COMET_API_KEY',
      call: cometAPI,
    },
  ];
}
```

### gateway/index.js — Interface Pública (compatibilidade)

```js
import { ProviderRouter } from './ProviderRouter.js';

const router = new ProviderRouter();

// Mantém a mesma assinatura do gateway atual
export async function requestSimulation(imageBase64, material, context) {
  return router.route(imageBase64, material, context);
}

// Expõe reset para o endpoint admin
export function resetCredits(providerId) {
  return router.resetCredits(providerId);
}
```

## Endpoint Admin

O endpoint admin é registrado no servidor Express existente:

```js
// backend/server.js (ou routes/admin.js)
import { resetCredits } from './services/gateway/index.js';

function requireAdminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/admin/credits/reset', requireAdminAuth, (req, res) => {
  const { providerId } = req.body;
  const state = resetCredits(providerId);
  res.json({ ok: true, counters: state });
});
```

A autenticação `requireAdminAuth` verifica o header `Authorization: Bearer <ADMIN_SECRET>` contra a variável de ambiente `ADMIN_SECRET`.

## Logger Estruturado

```js
// gateway/logger.js
export function log(level, provider, event, details = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    provider,
    event,
    details,
  }));
}
```

## Cascata de Provedores — Tabela de Referência

| Ordem | ID | costTier | FreeTier | Env Key |
|---|---|---|---|---|
| 1 | `pika-labs` | 0 | 80 créditos/mês | `PIKA_API_KEY` |
| 2 | `zhipu-cogview` | 0 | ilimitado (0) | `ZHIPU_API_KEY` |
| 3 | `wavespeed-ai` | 1 | nenhum | `WAVESPEED_API_KEY` |
| 4 | `comet-api` | 2 | nenhum | `COMET_API_KEY` |
| 5 | `local-fallback` | 99 | sempre disponível | — |

> Provedores com mesmo `costTier` (Pika e Zhipu, ambos 0) são tentados na ordem de declaração em `buildProviders()`.

## Variáveis de Ambiente

```env
# Chaves de API
PIKA_API_KEY=
ZHIPU_API_KEY=
WAVESPEED_API_KEY=
COMET_API_KEY=

# Limites de FreeTier
PIKA_FREE_CREDITS_LIMIT=80
ZHIPU_FREE_CREDITS_LIMIT=0

# Configuração geral
PROVIDER_TIMEOUT_MS=45000
ADMIN_SECRET=
```

## Propriedades de Correção

### P1 — Invariante de Ordenação
Para qualquer lista de provedores fornecida ao `ProviderRouter`, após a inicialização, `providers[i].costTier <= providers[i+1].costTier` para todo `i`.

### P2 — Propriedade de Idempotência do Reset
`resetCredits(id)` seguido de `resetCredits(id)` produz o mesmo estado que uma única chamada a `resetCredits(id)`.

### P3 — Propriedade de Rollover Mensal
Para qualquer mês `M` diferente do mês atual, `CreditTracker._ensureMonth()` garante que `state.counters` seja `{}` e `state.month` seja o mês atual.

### P4 — Disponibilidade do Fallback
Para qualquer combinação de provedores externos falhando ou sendo pulados, `ProviderRouter.route()` sempre retorna um objeto com `provider: 'local-fallback'` e `fallback: true`.

### P5 — Compatibilidade de Interface
A assinatura `requestSimulation(imageBase64, material, context)` exportada por `gateway/index.js` é funcionalmente equivalente à do gateway anterior: aceita os mesmos parâmetros e retorna um objeto com os campos `success`, `editedImageBase64`, `fidelity`, `provider`, `fallback` e `fallbackDescription`.
