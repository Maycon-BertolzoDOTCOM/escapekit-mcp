# Plano de Implementação

## Tasks

- [x] 1. Criar estrutura de diretórios e logger estruturado
  - Criar `backend/services/gateway/logger.js` com a função `log(level, provider, event, details)`
  - O logger deve emitir JSON com campos `timestamp`, `level`, `provider`, `event`, `details`
  - Criar diretório `backend/services/gateway/providers/`
  - **Arquivo:** `backend/services/gateway/logger.js`

- [x] 2. Implementar CreditTracker
  - Criar `backend/services/gateway/CreditTracker.js`
  - Implementar `isExhausted(provider)`: retorna `true` se `freeCreditLimit > 0` e `used >= freeCreditLimit`
  - Implementar `increment(providerId)`: incrementa contador e chama `_checkMonthRollover()` antes
  - Implementar `reset(providerId?)`: zera contador de um provedor ou de todos
  - Implementar `getState(providerId, freeCreditLimit)`: retorna `{ used, remaining }`
  - Implementar `_checkMonthRollover()`: reseta contadores se o mês mudou
  - Implementar `_load()` e `_save()` com persistência em `credits.json`
  - **Arquivo:** `backend/services/gateway/CreditTracker.js`

- [x] 3. Extrair adaptadores dos provedores existentes
  - Criar `backend/services/gateway/providers/waveSpeedAI.js` extraindo a função `callWaveSpeedAI` do gateway atual
  - Criar `backend/services/gateway/providers/zhipuCogView.js` extraindo a função `callZhipuCogView` do gateway atual
  - Criar `backend/services/gateway/providers/localFallback.js` extraindo a lógica de fallback do gateway atual
  - Cada adaptador deve exportar uma função `async (imageBase64, material, context, signal) => { success, editedImageBase64, fidelity }`
  - O parâmetro `signal` (AbortSignal) deve ser passado ao `fetch` para suporte a timeout
  - **Arquivos:** `providers/waveSpeedAI.js`, `providers/zhipuCogView.js`, `providers/localFallback.js`

- [x] 4. Implementar adaptadores dos novos provedores
  - Criar `backend/services/gateway/providers/pikaLabs.js` com chamada à API Pika Labs
    - Endpoint: `https://api.pika.art/v1/generate` (ou equivalente documentado)
    - Usar `PIKA_API_KEY` do ambiente
    - Retornar imagem em base64 com `fidelity: 0.75`
  - Criar `backend/services/gateway/providers/cometAPI.js` com chamada à API CometAPI
    - Usar `COMET_API_KEY` do ambiente
    - Selecionar modelo de edição de imagem disponível no agregador
    - Retornar imagem em base64 com `fidelity: 0.80`
  - **Arquivos:** `providers/pikaLabs.js`, `providers/cometAPI.js`

- [x] 5. Criar registro de provedores (providers/index.js)
  - Criar `backend/services/gateway/providers/index.js`
  - Exportar função `buildProviders()` que retorna array com os 4 provedores externos configurados
  - Cada provedor deve ter: `id`, `costTier`, `freeCreditLimit`, `envKey`, `call`
  - Ler `PIKA_FREE_CREDITS_LIMIT` (padrão 80) e `ZHIPU_FREE_CREDITS_LIMIT` (padrão 0) do ambiente
  - **Arquivo:** `backend/services/gateway/providers/index.js`

- [x] 6. Implementar ProviderRouter
  - Criar `backend/services/gateway/ProviderRouter.js`
  - Construtor recebe lista de provedores e ordena por `costTier` crescente
  - Implementar `route(imageBase64, material, context)` com o fluxo completo da cascata
  - Implementar `_callWithTimeout(provider, ...)` usando `AbortController`
  - Implementar `resetCredits(providerId?)` delegando ao `CreditTracker`
  - Integrar `CreditTracker` e `logger` em cada etapa do fluxo
  - **Arquivo:** `backend/services/gateway/ProviderRouter.js`

- [x] 7. Atualizar gateway/index.js para usar ProviderRouter
  - Substituir o conteúdo de `backend/services/gateway/index.js`
  - Instanciar `ProviderRouter` com `buildProviders()`
  - Exportar `requestSimulation(imageBase64, material, context)` delegando a `router.route()`
  - Exportar `resetCredits(providerId?)` delegando a `router.resetCredits()`
  - Manter compatibilidade total com a interface atual consumida por `materialApplier.js`
  - **Arquivo:** `backend/services/gateway/index.js`

- [x] 8. Adicionar endpoint admin de reset de créditos
  - Localizar o arquivo de rotas ou servidor Express principal do backend
  - Adicionar rota `POST /admin/credits/reset`
  - Implementar middleware `requireAdminAuth` que verifica `Authorization: Bearer <ADMIN_SECRET>`
  - Retornar HTTP 401 se autenticação falhar
  - Retornar `{ ok: true, counters: {...} }` em caso de sucesso
  - **Arquivo:** arquivo de rotas Express existente (ex: `backend/server.js` ou `backend/routes/admin.js`)

- [x] 9. Atualizar variáveis de ambiente
  - Adicionar ao `backend/.env` as novas variáveis: `PIKA_API_KEY`, `COMET_API_KEY`, `PIKA_FREE_CREDITS_LIMIT`, `ZHIPU_FREE_CREDITS_LIMIT`, `ADMIN_SECRET`
  - Garantir que `PROVIDER_TIMEOUT_MS` esteja documentado com valor padrão
  - Adicionar `credits.json` ao `.gitignore` do backend para não versionar estado de créditos
  - **Arquivo:** `backend/.env`, `backend/.gitignore`

- [x] 10. Escrever testes unitários
  - Criar `backend/services/gateway/__tests__/CreditTracker.test.js`
    - Testar `isExhausted` com limite atingido e não atingido
    - Testar rollover mensal: estado do mês anterior deve ser descartado
    - Testar idempotência do `reset`: chamar duas vezes produz mesmo resultado
  - Criar `backend/services/gateway/__tests__/ProviderRouter.test.js`
    - Testar ordenação por `costTier`: provedores sempre tentados em ordem crescente
    - Testar skip de provedor sem API key
    - Testar skip de provedor com FreeTier esgotado
    - Testar fallback local quando todos os provedores falham
    - Testar que o `provider` correto é retornado no objeto de resposta
  - **Arquivos:** `__tests__/CreditTracker.test.js`, `__tests__/ProviderRouter.test.js`
