# Implementation Plan: OpenTelemetry Distributed Tracing

## Overview

Adicionar observabilidade distribuída ao backend Node.js do PisoRealView Pro via OpenTelemetry. A implementação é controlada por `OTEL_ENABLED` e opera em modo completamente no-op quando desativada, preservando os 159 testes existentes.

## Tasks

- [x] 1. Adicionar dependências OpenTelemetry ao package.json
  - Adicionar `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http` e `@opentelemetry/api` como dependências de produção em `backend/package.json`
  - Adicionar `fast-check` como dependência de desenvolvimento
  - _Requirements: 1.1, 1.6, 8.2_

- [x] 2. Criar módulo central `backend/tracing.js`
  - [x] 2.1 Implementar `initTracing()` com importação dinâmica condicional
    - Quando `OTEL_ENABLED=false`: retornar imediatamente sem importar nenhum pacote `@opentelemetry/*`
    - Quando `OTEL_ENABLED=true`: importar dinamicamente `NodeSDK`, configurar `OTLPTraceExporter` com endpoint de `OTEL_EXPORTER_OTLP_ENDPOINT` (padrão `http://localhost:4318`), instalar `getNodeAutoInstrumentations()`, e chamar `sdk.start()`
    - Quando endpoint ausente: emitir `console.warn` antes de usar o padrão
    - Capturar exceções de inicialização com `console.error` sem relançar
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 8.1, 8.2, 8.4_
  - [x] 2.2 Implementar `getTracer()` com retorno no-op ou tracer real
    - Quando `OTEL_ENABLED=false`: retornar objeto no-op com `startSpan` e `startActiveSpan` que retornam span no-op (métodos `end`, `setStatus`, `setAttribute`, `setAttributes`, `spanContext` sem efeito)
    - Quando `OTEL_ENABLED=true`: retornar `trace.getTracer('pisosrealview-backend', '1.0.0')` da API OpenTelemetry
    - _Requirements: 1.1, 8.1, 8.2_
  - [x] 2.3 Implementar `withSpan(name, attributes, fn)` helper
    - Criar span via `getTracer().startSpan(name, { attributes })`
    - Executar `fn(span)` em try/catch/finally
    - Em exceção: chamar `span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })` e `span.setAttribute('error.message', err.message)`, depois relançar
    - Em finally: sempre chamar `span.end()`
    - _Requirements: 4.5, 4.6, 5.6, 5.7, 6.5, 6.6_
  - [ ]* 2.4 Escrever testes unitários para `tracing.js` em `backend/__tests__/tracing.test.js`
    - Testar `initTracing()` com `OTEL_ENABLED=false`: nenhum pacote `@opentelemetry/*` importado
    - Testar `initTracing()` com `OTEL_ENABLED=true`: SDK configurado com `service.name=pisosrealview-backend`
    - Testar `initTracing()` com SDK falhando: `console.error` chamado, sem exceção lançada
    - Testar `getTracer()` com `OTEL_ENABLED=false`: retorna objeto com métodos `startSpan` e `startActiveSpan`
    - Testar `OTEL_EXPORTER_OTLP_ENDPOINT` ausente: usa `http://localhost:4318` e emite `console.warn`
    - Testar que imports de `simulate.js` e `JobManager.js` não causam erros com `OTEL_ENABLED=false`
    - Testar que o módulo usa apenas sintaxe ESM (sem `require()`)
    - _Requirements: 1.2, 1.3, 1.5, 8.1, 8.2, 8.5, 10.1, 10.3, 10.4_

- [x] 3. Checkpoint — Verificar módulo tracing.js
  - Garantir que todos os testes do módulo `tracing.js` passam e que `OTEL_ENABLED=false` não gera nenhum import de `@opentelemetry/*`. Perguntar ao usuário se há dúvidas antes de continuar.

- [x] 4. Modificar `backend/services/gateway/logger.js` para correlação de logs
  - [x] 4.1 Injetar `traceId` e `spanId` no objeto de log quando span está ativo
    - Após construir o objeto `entry`, verificar `process.env.OTEL_ENABLED === 'true'`
    - Se verdadeiro: usar `import()` dinâmico de `@opentelemetry/api`, obter span ativo via `trace.getActiveSpan()`, e se span existir, adicionar `entry.traceId = ctx.traceId` e `entry.spanId = ctx.spanId`
    - Se falso ou sem span ativo: omitir campos, preservando formato JSON existente
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 4.2 Escrever property test para Property 10 e Property 11
    - **Property 10: Logger inclui traceId e spanId quando span está ativo**
    - **Validates: Requirements 9.1, 9.2, 9.4**
    - **Property 11: Logger omite campos de trace quando sem span ativo**
    - **Validates: Requirements 9.3, 9.4**
    - Localização: `backend/__tests__/tracing.property.test.js`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 5. Modificar `backend/server.js` para inicializar tracing
  - Adicionar `import { initTracing } from './tracing.js';` como primeira linha do arquivo, antes de qualquer outro import
  - Adicionar `await initTracing();` imediatamente após o import, usando top-level await ESM
  - _Requirements: 1.4, 10.4_

- [x] 6. Modificar `backend/routes/simulate.js` para instrumentar os 5 spans
  - [x] 6.1 Adicionar imports de `getTracer`, `withSpan` e API OpenTelemetry
    - Importar `{ getTracer, withSpan }` de `'../tracing.js'`
    - Importar `{ context, SpanStatusCode }` de `'@opentelemetry/api'` (no-op quando `OTEL_ENABLED=false`)
    - _Requirements: 2.1, 7.2, 10.3_
  - [x] 6.2 Criar Span_Root `simulate.job` antes do `setImmediate`
    - Criar span com `getTracer().startSpan('simulate.job', { attributes: { 'job.id': jobId, 'client.id': clientId, 'client.plan': planId } })`
    - Capturar contexto ativo com `context.active()` antes do `setImmediate`
    - Envolver callback do `setImmediate` com `context.with(activeCtx, async () => { ... })`
    - _Requirements: 2.1, 2.2, 2.6, 7.1, 7.2, 7.3, 7.4_
  - [x] 6.3 Implementar span filho `jobManager.createJob` com `withSpan`
    - Atributos: `cache.key` (primeiros 8 chars do cacheKey), `webhook.present` (booleano)
    - Quando deduplicação ativa: criar span `jobManager.deduplicated` com atributo `job.existing_id`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.4 Implementar span filho `roomAnalyzer.analyzeRoom` com `withSpan`
    - Atributos pós-execução: `room.geometry`, `room.obstacles_count`, `room.lighting`
    - Usar `span.setAttributes()` após retorno de `analyzeRoom`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 6.5 Implementar span filho `providerRouter.route` com `withSpan`
    - Atributos: `provider.id`, `provider.difficulty`, `provider.fidelity`, `provider.fallback`
    - Quando fallback: `provider.fallback=true` e `provider.id='local-fallback'`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 6.6 Implementar span filho `validator.validateInvariants` com `withSpan`
    - Atributos: `validation.overall_score`, `validation.violated`
    - Quando `violated=true`: adicionar `validation.invariant` com nome da invariante
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 6.7 Encerrar Span_Root com status correto no finally do callback
    - Em sucesso: `rootSpan.setStatus({ code: SpanStatusCode.OK })`
    - Em falha: `rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message })` e `rootSpan.setAttribute('error.message', err.message)`
    - Em finally: sempre `rootSpan.end()`
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [x] 7. Checkpoint — Verificar instrumentação completa
  - Garantir que todos os testes existentes (159) continuam passando com `OTEL_ENABLED=false`. Perguntar ao usuário se há dúvidas antes de continuar.

- [ ] 8. Escrever property-based tests em `backend/__tests__/tracing.property.test.js`
  - [ ]* 8.1 Property 1: No-op quando OTEL_ENABLED é false
    - `getTracer()` retorna no-op para qualquer valor falsy de `OTEL_ENABLED` (`undefined`, `'false'`, `'0'`, `''`)
    - Span no-op não lança exceção em nenhuma operação
    - **Property 1: No-op quando OTEL_ENABLED é false**
    - **Validates: Requirements 1.2, 2.5, 7.3, 8.1, 8.2, 10.1**
  - [ ]* 8.2 Property 2: Span raiz criado com atributos corretos
    - Para qualquer combinação de `jobId` (uuid), `clientId` (string), `planId` (`basic`|`pro`|`enterprise`), os atributos do span `simulate.job` devem corresponder exatamente
    - **Property 2: Span raiz criado com atributos corretos**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 8.3 Property 4: Span de createJob com atributos corretos
    - Para qualquer `cacheKey` com ≥8 chars, `cache.key` deve ser exatamente `cacheKey.slice(0, 8)`
    - Para qualquer `webhookUrl` (presente ou null), `webhook.present` deve refletir corretamente `!!webhookUrl`
    - **Property 4: Span de createJob com atributos corretos**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [ ]* 8.4 Property 7: provider.fidelity sempre no intervalo [0.0, 1.0]
    - Para qualquer resultado de `ProviderRouter.route`, `provider.fidelity` deve estar em [0.0, 1.0]
    - **Property 7: Span de route com atributos corretos e fidelity no intervalo válido**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  - [ ]* 8.5 Property 8: validation.violated reflete resultado de violação
    - `validation.violated=true` se e somente se `result.violated=true`
    - Quando `violated=true`, `validation.invariant` deve estar presente
    - Quando `violated=false`, `validation.invariant` deve ser `undefined`
    - **Property 8: Span de validateInvariants reflete resultado de violação**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  - [ ]* 8.6 Property 10: Logger inclui traceId e spanId com span ativo
    - Para qualquer `level`, `component`, `event`, `traceId` (hex 32 chars), `spanId` (hex 16 chars), o log deve conter os campos corretos
    - **Property 10: Logger inclui traceId e spanId quando span está ativo**
    - **Validates: Requirements 9.1, 9.2, 9.4**
  - [ ]* 8.7 Property 11: Logger omite campos de trace sem span ativo
    - Para qualquer entrada de log com `OTEL_ENABLED=false`, `traceId` e `spanId` devem ser `undefined`
    - **Property 11: Logger omite campos de trace quando sem span ativo**
    - **Validates: Requirements 9.3, 9.4**
  - [ ]* 8.8 Property 12: Transparência comportamental com OTEL_ENABLED=false
    - Para qualquer entrada de `JobManager`, o resultado deve ser estruturalmente idêntico com e sem `OTEL_ENABLED`
    - **Property 12: Transparência comportamental com OTEL_ENABLED=false**
    - **Validates: Requirements 10.2**

- [x] 9. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam (159 existentes + novos testes de tracing). Perguntar ao usuário se há dúvidas antes de finalizar.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- `OTEL_ENABLED=false` é o padrão — zero overhead, zero imports `@opentelemetry/*` em testes
- Compatibilidade ESM obrigatória: usar apenas `import`/`export`, sem `require()`
- Os 159 testes existentes não devem ser afetados em nenhuma circunstância
- Property tests usam `fast-check` com mínimo 100 iterações por propriedade (`{ numRuns: 100 }`)
- Cada property test deve incluir comentário `// Feature: opentelemetry-tracing, Property N: <texto>`
