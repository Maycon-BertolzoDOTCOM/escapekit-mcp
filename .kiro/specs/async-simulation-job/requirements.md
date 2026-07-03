# Requirements Document

## Introduction

O PisoRealView Pro atualmente expõe `POST /v1/simulate` que mantém a conexão HTTP aberta enquanto processa a simulação de IA, podendo levar até ~90s. Load balancers como AWS ALB e Nginx encerram conexões após 60s, causando falhas silenciosas para o cliente.

Esta feature implementa o padrão **202 Async Job**: o endpoint retorna imediatamente com um `jobId`, o processamento ocorre em background, e o cliente faz polling em `GET /v1/simulate/:jobId/status` para obter o resultado. Um mecanismo de webhook opcional notifica o cliente quando o job é concluído. Compatibilidade retroativa é mantida via header `X-Sync-Mode: true`.

---

## Glossary

- **JobManager**: Serviço singleton responsável por criar, armazenar, atualizar e expirar jobs em memória.
- **Job**: Unidade de trabalho assíncrono representando uma simulação de IA, identificada por UUID v4.
- **SimulationJob**: Estrutura de dados de um job com campos: `id`, `clientId`, `status`, `progress`, `createdAt`, `result`, `error`, `cacheKey`.
- **JobStatus**: Enum de estados possíveis de um job: `pending`, `processing`, `completed`, `failed`.
- **StatusEndpoint**: Endpoint `GET /v1/simulate/:jobId/status` que retorna o estado atual de um job.
- **SimulateEndpoint**: Endpoint `POST /v1/simulate` que aceita requisições de simulação.
- **SimulationResponse**: Objeto de resposta com campos `editedImageBase64`, `fidelity`, `context` (ou `fallbackDescription` em modo fallback).
- **WebhookUrl**: URL fornecida pelo cliente no body do POST para receber notificação HTTP quando o job for concluído.
- **TTL**: Tempo de vida de um job em memória — 1 hora a partir de `createdAt`.
- **X-Sync-Mode**: Header HTTP que, quando definido como `true`, força o comportamento síncrono legado.
- **CacheKey**: Hash SHA-256 derivado de `imageBase64` + `material`, usado para deduplicação de jobs.
- **ProviderRouter**: Serviço de gateway que roteia a simulação entre provedores de IA (WaveSpeedAI, Zhipu CogView, Pika Labs).

---

## Requirements

### Requirement 1: Resposta Imediata 202 Accepted

**User Story:** Como cliente da API, quero que `POST /v1/simulate` retorne imediatamente, para que load balancers não encerrem minha conexão durante o processamento.

#### Acceptance Criteria

1. WHEN uma requisição válida é recebida em `POST /v1/simulate` sem o header `X-Sync-Mode: true`, THE SimulateEndpoint SHALL retornar HTTP 202 com body `{ "jobId": "<uuid-v4>", "statusUrl": "/v1/simulate/<jobId>/status" }` em até 200ms.
2. WHEN o SimulateEndpoint retorna 202, THE JobManager SHALL criar um SimulationJob com `status: "pending"`, `progress: 0`, `createdAt: Date.now()`, e o `cacheKey` calculado a partir de `imageBase64` e `material`.
3. THE SimulateEndpoint SHALL validar os campos `imageBase64` e `material` (incluindo `material.type`, `material.color`, `material.dimensions`) antes de criar o job, retornando HTTP 400 se inválidos.
4. THE SimulateEndpoint SHALL aplicar o middleware de autenticação por API key antes de criar qualquer job.

---

### Requirement 2: Processamento em Background

**User Story:** Como operador do sistema, quero que o processamento de IA ocorra em background, para que a thread principal do servidor não fique bloqueada aguardando respostas de provedores externos.

#### Acceptance Criteria

1. WHEN um SimulationJob é criado com `status: "pending"`, THE JobManager SHALL iniciar o processamento via `setImmediate` ou equivalente não-bloqueante, sem aguardar a conclusão antes de retornar ao caller.
2. WHEN o processamento é iniciado, THE JobManager SHALL atualizar o `status` do job para `"processing"` e `progress` para `10` antes de invocar o ProviderRouter.
3. WHEN o ProviderRouter retorna resultado com sucesso, THE JobManager SHALL atualizar o job com `status: "completed"`, `progress: 100`, e `result: SimulationResponse`.
4. IF o ProviderRouter lança exceção ou retorna `fallback: true`, THEN THE JobManager SHALL atualizar o job com `status: "failed"` e `error` contendo a mensagem descritiva do erro ou fallback.
5. WHILE o job está em `status: "processing"`, THE JobManager SHALL atualizar o campo `progress` em incrementos refletindo as etapas: análise de sala (25), chamada ao provider (75), validação de invariantes (90).

---

### Requirement 3: Endpoint de Status do Job

**User Story:** Como cliente da API, quero consultar o status de um job pelo `jobId`, para que eu possa saber quando o resultado está disponível.

#### Acceptance Criteria

1. WHEN `GET /v1/simulate/:jobId/status` é chamado com um `jobId` existente, THE StatusEndpoint SHALL retornar HTTP 200 com o objeto `{ "jobId", "status", "progress", "createdAt" }`.
2. WHEN o job tem `status: "completed"`, THE StatusEndpoint SHALL incluir o campo `result: SimulationResponse` na resposta.
3. WHEN o job tem `status: "failed"`, THE StatusEndpoint SHALL incluir o campo `error: string` na resposta.
4. WHEN `GET /v1/simulate/:jobId/status` é chamado com um `jobId` inexistente ou expirado, THE StatusEndpoint SHALL retornar HTTP 404 com `{ "error": "Job not found or expired" }`.
5. THE StatusEndpoint SHALL aplicar o middleware de autenticação por API key antes de retornar qualquer dado de job.

---

### Requirement 4: Gerenciamento de Jobs em Memória (JobManager)

**User Story:** Como operador do sistema, quero que os jobs sejam gerenciados em memória com TTL automático, para que recursos não sejam consumidos indefinidamente.

#### Acceptance Criteria

1. THE JobManager SHALL armazenar todos os jobs ativos em uma estrutura `Map<string, SimulationJob>` indexada por `jobId`.
2. WHEN um job é criado, THE JobManager SHALL gerar um `jobId` único usando UUID v4.
3. WHEN o tempo decorrido desde `createdAt` de um job supera 3600 segundos (1 hora), THE JobManager SHALL remover o job do Map na próxima execução do ciclo de limpeza.
4. THE JobManager SHALL executar o ciclo de limpeza de jobs expirados a cada 300 segundos (5 minutos).
5. THE JobManager SHALL expor os métodos: `createJob(clientId, cacheKey)`, `getJob(jobId)`, `updateJob(jobId, updates)`, e `cleanup()`.

---

### Requirement 5: Deduplicação por CacheKey

**User Story:** Como cliente da API, quero que requisições idênticas em andamento não gerem jobs duplicados, para que recursos de IA não sejam desperdiçados.

#### Acceptance Criteria

1. WHEN `POST /v1/simulate` é recebido e já existe um job com o mesmo `cacheKey` em `status: "pending"` ou `"processing"`, THE SimulateEndpoint SHALL retornar HTTP 202 com o `jobId` do job existente em vez de criar um novo.
2. WHEN `POST /v1/simulate` é recebido e existe um job com o mesmo `cacheKey` em `status: "completed"`, THE SimulateEndpoint SHALL retornar HTTP 200 com o `result` do job existente diretamente (cache hit).
3. WHEN `POST /v1/simulate` é recebido e existe um job com o mesmo `cacheKey` em `status: "failed"`, THE SimulateEndpoint SHALL criar um novo job (não reutilizar jobs com falha).

---

### Requirement 6: Notificação via Webhook (Opcional)

**User Story:** Como cliente da API, quero fornecer uma `webhookUrl` no body do POST, para que meu sistema seja notificado automaticamente quando o job for concluído sem precisar fazer polling.

#### Acceptance Criteria

1. WHERE o campo `webhookUrl` é fornecido no body de `POST /v1/simulate`, THE JobManager SHALL armazenar a URL no SimulationJob.
2. WHEN um job com `webhookUrl` atinge `status: "completed"` ou `"failed"`, THE JobManager SHALL enviar uma requisição HTTP POST para a `webhookUrl` com body `{ "jobId", "status", "result" | "error" }` em até 5 segundos após a conclusão.
3. IF a requisição HTTP para a `webhookUrl` falhar ou retornar status >= 400, THEN THE JobManager SHALL registrar o erro no log sem retentar e sem alterar o status do job.
4. THE JobManager SHALL validar que `webhookUrl`, quando fornecida, é uma URL HTTP ou HTTPS válida, retornando HTTP 400 caso contrário.

---

### Requirement 7: Modo Síncrono Legado (X-Sync-Mode)

**User Story:** Como cliente legado da API, quero continuar usando o comportamento síncrono via header `X-Sync-Mode: true`, para que minha integração existente não seja quebrada.

#### Acceptance Criteria

1. WHEN `POST /v1/simulate` é recebido com o header `X-Sync-Mode: true`, THE SimulateEndpoint SHALL executar o fluxo síncrono original, aguardando o resultado completo antes de responder.
2. WHEN o fluxo síncrono é executado com sucesso, THE SimulateEndpoint SHALL retornar HTTP 200 com `SimulationResponse`, idêntico ao comportamento anterior à esta feature.
3. WHEN o fluxo síncrono é executado e ocorre violação de invariante, THE SimulateEndpoint SHALL retornar HTTP 409 com os detalhes da violação, idêntico ao comportamento anterior.
4. WHILE o header `X-Sync-Mode: true` está presente, THE SimulateEndpoint SHALL ignorar o campo `webhookUrl` e não criar nenhum SimulationJob no JobManager.

---

### Requirement 8: Expiração e Limpeza Automática de Jobs

**User Story:** Como operador do sistema, quero que jobs antigos sejam removidos automaticamente da memória, para que o processo Node.js não acumule dados indefinidamente.

#### Acceptance Criteria

1. WHEN o servidor é iniciado, THE JobManager SHALL iniciar um `setInterval` de 300 segundos para executar a limpeza periódica.
2. WHEN o servidor é encerrado (sinal SIGTERM ou SIGINT), THE JobManager SHALL cancelar o `setInterval` de limpeza para evitar vazamento de recursos.
3. WHEN a limpeza é executada, THE JobManager SHALL remover todos os jobs cujo `createdAt` seja anterior a `Date.now() - 3600000` ms.
4. WHEN um job em `status: "processing"` é encontrado durante a limpeza e seu `createdAt` supera o TTL, THE JobManager SHALL atualizar o `status` para `"failed"` com `error: "Job expired during processing"` antes de removê-lo.
