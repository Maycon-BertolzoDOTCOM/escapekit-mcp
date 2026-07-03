# Implementation Plan: Async Simulation Job

## Overview

Implementação do padrão 202 Async Job para `POST /v1/simulate`, com JobManager em memória, endpoint de status, deduplicação por cacheKey, webhook opcional e compatibilidade retroativa via `X-Sync-Mode: true`.

## Tasks

- [x] 1. Implementar JobManager singleton
  - [x] 1.1 Criar `backend/services/core/JobManager.js` com classe `JobManager extends EventEmitter`
    - Campos privados: `#jobs = new Map()`, `#cacheKeyIndex = new Map()`, `#cleanupTimer = null`
    - Constantes estáticas: `TTL_MS = 3_600_000`, `CLEANUP_INTERVAL_MS = 300_000`
    - Método `createJob(clientId, cacheKey, webhookUrl)`: gera UUID v4 via `crypto.randomUUID()`, cria `SimulationJob` com `status: "pending"`, `progress: 0`, `createdAt: Date.now()`, atualiza `#cacheKeyIndex`
    - Método `getJob(jobId)`: retorna job ou `null`
    - Método `updateJob(jobId, updates)`: merge parcial no job existente
    - Método `cleanup()`: remove jobs com `createdAt < Date.now() - TTL_MS`; jobs em `"processing"` expirados recebem `status: "failed"`, `error: "Job expired during processing"` antes da remoção; limpa entradas do `#cacheKeyIndex`
    - Métodos `findActiveJobByCacheKey(cacheKey)` e `findCompletedJobByCacheKey(cacheKey)` usando o índice secundário
    - Métodos `start()` e `stop()` para gerenciar o `setInterval` de limpeza
    - Exportar instância singleton: `export const jobManager = new JobManager()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 1.2 Escrever property test — Property 2: invariantes de criação do job
    - **Property 2: Invariantes de criação do job**
    - **Validates: Requirements 1.2, 4.1, 4.2**
    - Usar `fc.string(), fc.string(), fc.option(fc.webUrl())` como arbitrários para `clientId`, `cacheKey`, `webhookUrl`
    - Verificar: `status === "pending"`, `progress === 0`, `createdAt` recente, job recuperável via `getJob(jobId)`

  - [ ]* 1.3 Escrever property test — Property 8: limpeza de jobs expirados
    - **Property 8: Limpeza de jobs expirados**
    - **Validates: Requirements 4.3, 8.3, 8.4**
    - Usar `fc.array(fc.record({ ...jobFields, createdAt: fc.integer() }))` para gerar conjuntos mistos de jobs expirados e válidos
    - Verificar: após `cleanup()`, nenhum job expirado permanece; jobs `"processing"` expirados têm `status: "failed"` com `error: "Job expired during processing"`

  - [ ]* 1.4 Escrever property test — Property 9: deduplicação por cacheKey
    - **Property 9: Deduplicação por cacheKey**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Usar `fc.string()` como arbitrário para `cacheKey`
    - Verificar: `findActiveJobByCacheKey` retorna o job existente quando `pending`/`processing`; `findCompletedJobByCacheKey` retorna quando `completed`; retorna `null` quando `failed`

  - [x]* 1.5 Escrever testes unitários para JobManager
    - `createJob` retorna job com todos os campos corretos
    - `getJob` retorna `null` para `jobId` inexistente
    - `start()` / `stop()` configuram e cancelam o intervalo
    - `findActiveJobByCacheKey` e `findCompletedJobByCacheKey` cobrem todos os status
    - _Requirements: 4.1–4.5, 8.1, 8.2_

- [x] 2. Implementar webhookNotifier
  - [x] 2.1 Criar `backend/services/core/webhookNotifier.js`
    - Função `sendWebhookNotification(webhookUrl, payload)`: HTTP POST com `fetch` nativo, `AbortController` com timeout de 5s
    - Retorna `true` se resposta 2xx, `false` caso contrário
    - Em caso de falha (timeout, erro de rede, status >= 400): registra no log com `console.error`, não retenta, não lança exceção
    - _Requirements: 6.2, 6.3_

  - [x]* 2.2 Escrever testes unitários para webhookNotifier
    - Mock de `fetch` para simular sucesso (2xx), falha de rede e status >= 400
    - Verificar que falhas não propagam exceção e retornam `false`
    - _Requirements: 6.2, 6.3_

- [x] 3. Checkpoint — Verificar núcleo antes de prosseguir
  - Garantir que todos os testes do JobManager e webhookNotifier passam antes de avançar para os endpoints.

- [x] 4. Implementar endpoint de status
  - [x] 4.1 Criar `backend/routes/simulate/status.js` com `GET /:jobId/status`
    - Aplicar `apiKeyMiddleware` antes de qualquer lógica
    - Buscar job via `jobManager.getJob(jobId)`
    - Retornar 404 com `{ "error": "Job not found or expired" }` se job não encontrado
    - Retornar 403 com `{ "error": "Forbidden" }` se `job.clientId !== req.client.clientId`
    - Retornar 200 com `{ jobId, status, progress, createdAt }` sempre; incluir `result` se `completed`, `error` se `failed`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Escrever property test — Property 7: completude condicional da resposta do status endpoint
    - **Property 7: Completude condicional da resposta do status endpoint**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Gerar jobs em todos os status possíveis e verificar que os campos condicionais (`result`, `error`) aparecem apenas quando esperado

  - [ ]* 4.3 Escrever property test — Property 4: autenticação obrigatória
    - **Property 4: Autenticação obrigatória em todos os endpoints**
    - **Validates: Requirements 1.4, 3.5**
    - Verificar que requisições sem API key válida retornam 401/403 sem expor dados de jobs

- [x] 5. Modificar simulate.js para suporte assíncrono
  - [x] 5.1 Adicionar lógica assíncrona em `backend/routes/simulate.js`
    - Importar `jobManager` de `../services/core/JobManager.js`
    - Importar `sendWebhookNotification` de `../services/core/webhookNotifier.js`
    - Validar `webhookUrl` com `isValidWebhookUrl()` quando fornecida; retornar 400 se inválida
    - Branch `X-Sync-Mode: true`: preservar fluxo síncrono legado integralmente, ignorar `webhookUrl`, não criar job
    - Branch assíncrono (sem `X-Sync-Mode`):
      1. Calcular `cacheKey` via `getSimulationCacheKey(imageBase64, material)`
      2. `findActiveJobByCacheKey` → 202 com `jobId` existente se `pending`/`processing`
      3. `findCompletedJobByCacheKey` → 200 com `result` direto se `completed`
      4. `jobManager.createJob(clientId, cacheKey, webhookUrl)` → 202 com novo `jobId` e `statusUrl`
      5. `setImmediate` inicia processamento em background: `updateJob(processing, 10)` → `analyzeRoom` (progress=25) → `applyMaterial` (progress=75) → `validateInvariants` (progress=90) → `updateJob(completed, 100, result)` ou `updateJob(failed, error)` → `sendWebhookNotification` se `webhookUrl`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 6.1, 6.4, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 5.2 Escrever property test — Property 1: resposta 202 imediata
    - **Property 1: Resposta 202 imediata para requisições válidas**
    - **Validates: Requirements 1.1**
    - Usar `fc.record({ imageBase64: validBase64Arb, material: validMaterialArb })` como arbitrário
    - Verificar: status 202, body contém `jobId` (UUID v4) e `statusUrl` no formato `/v1/simulate/<jobId>/status`

  - [ ]* 5.3 Escrever property test — Property 3: rejeição de inputs inválidos
    - **Property 3: Rejeição de inputs inválidos**
    - **Validates: Requirements 1.3, 6.4**
    - Gerar bodies com campos ausentes ou inválidos (`imageBase64: ""`, `material` incompleto)
    - Verificar: retorna 400 e nenhum job é criado no JobManager

  - [ ]* 5.4 Escrever property test — Property 5: processamento não-bloqueante
    - **Property 5: Processamento não-bloqueante**
    - **Validates: Requirements 2.1**
    - Verificar que o job está em `"pending"` ou `"processing"` no momento em que o 202 é enviado (antes do `setImmediate` completar)

  - [ ]* 5.5 Escrever property test — Property 11: isolamento do modo síncrono
    - **Property 11: Isolamento do modo síncrono**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
    - Verificar que requisições com `X-Sync-Mode: true` não criam jobs no JobManager e retornam 200 com `SimulationResponse`

- [x] 6. Modificar server.js para wiring final
  - [x] 6.1 Atualizar `backend/server.js`
    - Importar `jobManager` de `./services/core/JobManager.js`
    - Importar `statusRouter` de `./routes/simulate/status.js`
    - Montar `app.use('/v1/simulate', statusRouter)` antes das demais rotas de simulate
    - Chamar `jobManager.start()` após configurar todas as rotas
    - Registrar `process.on('SIGTERM', () => jobManager.stop())` e `process.on('SIGINT', () => jobManager.stop())`
    - _Requirements: 8.1, 8.2_

- [x] 7. Testes de integração do fluxo completo
  - [ ]* 7.1 Escrever property test — Property 6: transições de estado do job
    - **Property 6: Transições de estado do job**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
    - Usar `validSimulationInputArb` para gerar inputs válidos
    - Verificar sequência `pending → processing → completed` com `progress` em ordem crescente `0 → 10 → 25 → 75 → 90 → 100`; jobs com falha terminam em `failed` com `error` preenchido

  - [ ]* 7.2 Escrever property test — Property 10: webhook enviado na conclusão
    - **Property 10: Webhook enviado na conclusão**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Verificar que jobs com `webhookUrl` válida disparam POST ao concluir/falhar; falha no webhook não altera `status` do job

  - [x]* 7.3 Escrever testes de integração em `backend/__tests__/asyncSimulate.test.js`
    - Fluxo completo: `POST /v1/simulate` → 202 → polling `GET /:jobId/status` → 200 com `result`
    - `X-Sync-Mode: true` retorna 200 diretamente (Property 11)
    - Cache hit retorna 200 com `result` sem criar novo job (Property 9)
    - Job falhado expõe `error` no status endpoint (Property 7)
    - Requisição sem API key retorna 401 (Property 4)
    - _Requirements: 1.1, 2.3, 3.1–3.5, 5.2, 7.1_

- [x] 8. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, verificar cobertura dos 11 correctness properties, perguntar ao usuário se há dúvidas antes de encerrar.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada property test deve rodar com mínimo de 100 iterações: `fc.configureGlobal({ numRuns: 100 })`
- Cada property test deve ter a tag: `// Feature: async-simulation-job, Property {N}: {texto}`
- A ordem de implementação (1→2→4→5→6→7) garante que cada passo integra sobre uma base testada
- `setImmediate` é suficiente pois o processamento é I/O-bound (chamadas HTTP ao ProviderRouter)
- O índice secundário `#cacheKeyIndex` garante deduplicação em O(1) sem iterar sobre todos os jobs
