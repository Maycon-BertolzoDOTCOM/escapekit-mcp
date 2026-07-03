# Requirements Document

## Introduction

O PisoRealView Pro precisa de observabilidade distribuída para diagnosticar latências, falhas de provider e gargalos no fluxo assíncrono de simulação. Esta feature adiciona OpenTelemetry Distributed Tracing ao backend Node.js (ESM), instrumentando os 5 pontos críticos do pipeline de simulação com spans manuais, propagando contexto através do `setImmediate` do JobManager, e exportando traces para Jaeger via OTLP HTTP. A instrumentação é controlada por `OTEL_ENABLED` e é completamente no-op quando desativada, sem overhead e sem dependência de Jaeger em desenvolvimento.

## Glossary

- **Tracer**: Componente OpenTelemetry responsável por criar e gerenciar spans.
- **Span**: Unidade de trabalho rastreável com início, fim, atributos e status.
- **Span_Root**: Span de nível superior que representa a duração total de um job de simulação, iniciado no POST /v1/simulate e encerrado ao final do processamento assíncrono.
- **Span_Child**: Span filho vinculado ao Span_Root via propagação de contexto.
- **OTLP_Exporter**: Exportador OpenTelemetry que envia traces via HTTP para um coletor compatível (Jaeger, Grafana Tempo, etc.).
- **Tracing_Module**: Arquivo `backend/tracing.js` responsável por inicializar o SDK OpenTelemetry antes do servidor Express.
- **JobManager**: Serviço em `services/core/JobManager.js` que gerencia o ciclo de vida dos jobs assíncronos.
- **ProviderRouter**: Serviço em `services/gateway/ProviderRouter.js` que roteia chamadas para os providers de IA (WaveSpeedAI, Zhipu, Pika).
- **RoomAnalyzer**: Serviço que analisa a geometria, obstáculos e iluminação da sala a partir da imagem.
- **Validator**: Serviço em `services/core/validator.js` que verifica invariantes da imagem editada.
- **Context_Propagation**: Mecanismo OpenTelemetry para transmitir o contexto de trace através de fronteiras assíncronas (ex: `setImmediate`).
- **No-op**: Implementação vazia que não executa nenhuma operação e não gera overhead mensurável.
- **OTEL_ENABLED**: Variável de ambiente booleana que ativa (`true`) ou desativa (`false`) toda a instrumentação OpenTelemetry.
- **OTEL_EXPORTER_OTLP_ENDPOINT**: Variável de ambiente que define o endpoint do coletor OTLP (padrão: `http://localhost:4318`).

## Requirements

### Requirement 1: Inicialização do SDK OpenTelemetry

**User Story:** Como engenheiro de operações, quero que o OpenTelemetry seja inicializado antes do servidor Express, para que toda a instrumentação automática de HTTP e Node.js esteja ativa desde o primeiro request.

#### Acceptance Criteria

1. THE Tracing_Module SHALL exportar uma função `initTracing()` que inicializa o SDK OpenTelemetry com `service.name=pisosrealview-backend` e `service.version=1.0.0`.
2. WHEN `OTEL_ENABLED` é `false` ou ausente, THE Tracing_Module SHALL retornar sem inicializar nenhum componente OpenTelemetry, resultando em operações no-op.
3. WHEN `OTEL_ENABLED` é `true`, THE Tracing_Module SHALL configurar o OTLP_Exporter com o endpoint definido em `OTEL_EXPORTER_OTLP_ENDPOINT`, usando `http://localhost:4318` como valor padrão.
4. THE Tracing_Module SHALL ser importado e executado como a primeira instrução de `server.js`, antes de qualquer import de rotas ou middlewares Express.
5. WHEN o SDK OpenTelemetry falha ao inicializar, THE Tracing_Module SHALL registrar o erro via `console.error` e continuar a execução do servidor sem lançar exceção.
6. THE Tracing_Module SHALL instalar `@opentelemetry/auto-instrumentations-node` para instrumentação automática de HTTP, Express e módulos Node.js nativos.

### Requirement 2: Span Raiz do Job de Simulação

**User Story:** Como engenheiro de operações, quero um span raiz que cubra a duração total do job de simulação, para que eu possa medir o tempo end-to-end desde o POST até a conclusão do processamento assíncrono.

#### Acceptance Criteria

1. WHEN `POST /v1/simulate` recebe uma requisição válida no modo assíncrono, THE Tracer SHALL criar um Span_Root com o nome `simulate.job` antes de chamar `jobManager.createJob`.
2. THE Span_Root SHALL incluir os atributos `job.id`, `client.id` e `client.plan` no momento da criação.
3. THE Span_Root SHALL ser encerrado com status `OK` quando o job atingir o status `completed`.
4. WHEN o job falha por qualquer motivo (fallback, invariant violation, erro inesperado), THE Span_Root SHALL ser encerrado com status `ERROR` e o atributo `error.message` preenchido.
5. WHEN `OTEL_ENABLED` é `false`, THE Tracer SHALL retornar um span no-op e o fluxo de simulação SHALL continuar sem alteração de comportamento.
6. THE Span_Root SHALL ter sua duração medida desde o recebimento do POST até o encerramento do processamento em background, não apenas até o retorno do 202.

### Requirement 3: Span Filho — JobManager.createJob

**User Story:** Como engenheiro de operações, quero um span filho para a criação do job, para que eu possa identificar se a deduplicação ou o cache estão sendo acionados corretamente.

#### Acceptance Criteria

1. WHEN `jobManager.createJob` é chamado durante o processamento de `POST /v1/simulate`, THE Tracer SHALL criar um Span_Child com o nome `jobManager.createJob` vinculado ao Span_Root ativo.
2. THE Span_Child SHALL incluir o atributo `cache.key` com os primeiros 8 caracteres do cacheKey (para evitar dados sensíveis em traces).
3. THE Span_Child SHALL incluir o atributo `webhook.present` com valor booleano indicando se `webhookUrl` foi fornecida.
4. THE Span_Child SHALL ser encerrado imediatamente após o retorno de `jobManager.createJob`.
5. WHEN `jobManager.findActiveJobByCacheKey` retorna um job existente (deduplicação), THE Tracer SHALL criar um Span_Child com o nome `jobManager.deduplicated` em vez de `jobManager.createJob`, com o atributo `job.existing_id`.

### Requirement 4: Span Filho — RoomAnalyzer.analyzeRoom

**User Story:** Como engenheiro de operações, quero um span filho para a análise de sala, para que eu possa medir a latência desta etapa e identificar gargalos relacionados à geometria da imagem.

#### Acceptance Criteria

1. WHEN `analyzeRoom` é chamado no processamento em background do `setImmediate`, THE Tracer SHALL criar um Span_Child com o nome `roomAnalyzer.analyzeRoom` vinculado ao Span_Root propagado.
2. THE Span_Child SHALL incluir o atributo `room.geometry` com o valor retornado pelo RoomAnalyzer (ex: `rectangular`, `irregular`).
3. THE Span_Child SHALL incluir o atributo `room.obstacles_count` com o número de obstáculos detectados.
4. THE Span_Child SHALL incluir o atributo `room.lighting` com o tipo de iluminação detectado (ex: `natural`, `artificial`, `mixed`).
5. THE Span_Child SHALL ser encerrado imediatamente após o retorno de `analyzeRoom`, independentemente de sucesso ou falha.
6. WHEN `analyzeRoom` lança uma exceção, THE Span_Child SHALL ser encerrado com status `ERROR` e o atributo `error.message` preenchido antes de propagar a exceção.

### Requirement 5: Span Filho — ProviderRouter.route

**User Story:** Como engenheiro de operações, quero um span filho para o roteamento de provider, para que eu possa rastrear qual provider foi tentado, a dificuldade estimada, a fidelidade retornada e se houve fallback.

#### Acceptance Criteria

1. WHEN `ProviderRouter.route` é chamado no processamento em background, THE Tracer SHALL criar um Span_Child com o nome `providerRouter.route` vinculado ao Span_Root propagado.
2. THE Span_Child SHALL incluir o atributo `provider.id` com o identificador do provider que retornou sucesso (ex: `wavespeed-ai`, `zhipu-cogview`, `pika-labs`).
3. THE Span_Child SHALL incluir o atributo `provider.difficulty` com o nível de dificuldade estimado (ex: `easy`, `medium`, `hard`).
4. THE Span_Child SHALL incluir o atributo `provider.fidelity` com o score de fidelidade retornado pelo provider (valor entre 0.0 e 1.0).
5. WHEN o ProviderRouter ativa o fallback local, THE Span_Child SHALL incluir o atributo `provider.fallback` com valor `true` e `provider.id` com valor `local-fallback`.
6. THE Span_Child SHALL ser encerrado imediatamente após o retorno de `ProviderRouter.route`.
7. WHEN `ProviderRouter.route` lança uma exceção, THE Span_Child SHALL ser encerrado com status `ERROR` e o atributo `error.message` preenchido antes de propagar a exceção.

### Requirement 6: Span Filho — Validator.validateInvariants

**User Story:** Como engenheiro de operações, quero um span filho para a validação de invariantes, para que eu possa monitorar a taxa de violações e os scores de qualidade da imagem editada.

#### Acceptance Criteria

1. WHEN `validateInvariants` é chamado no processamento em background, THE Tracer SHALL criar um Span_Child com o nome `validator.validateInvariants` vinculado ao Span_Root propagado.
2. THE Span_Child SHALL incluir o atributo `validation.overall_score` com o score geral retornado pelo Validator (valor entre 0.0 e 1.0).
3. WHEN `validateInvariants` retorna `violated: true`, THE Span_Child SHALL incluir o atributo `validation.violated` com valor `true` e `validation.invariant` com o nome da invariante violada.
4. WHEN `validateInvariants` retorna `violated: false`, THE Span_Child SHALL incluir o atributo `validation.violated` com valor `false`.
5. THE Span_Child SHALL ser encerrado imediatamente após o retorno de `validateInvariants`.
6. WHEN `validateInvariants` lança uma exceção, THE Span_Child SHALL ser encerrado com status `ERROR` e o atributo `error.message` preenchido antes de propagar a exceção.

### Requirement 7: Propagação de Contexto Assíncrono

**User Story:** Como engenheiro de operações, quero que o contexto de trace seja propagado corretamente através do `setImmediate` do JobManager, para que os spans filhos do processamento em background apareçam como filhos do Span_Root no Jaeger.

#### Acceptance Criteria

1. WHEN o processamento em background é iniciado via `setImmediate` em `routes/simulate.js`, THE Context_Propagation SHALL capturar o contexto ativo no momento do POST e vinculá-lo ao callback do `setImmediate`.
2. THE Context_Propagation SHALL usar `context.with(activeContext, callback)` da API OpenTelemetry para envolver o callback do `setImmediate`, garantindo que o contexto seja restaurado corretamente na execução assíncrona.
3. WHEN `OTEL_ENABLED` é `false`, THE Context_Propagation SHALL usar o contexto nativo do Node.js sem nenhuma instrumentação adicional, preservando o comportamento original do `setImmediate`.
4. THE Span_Root SHALL permanecer ativo (não encerrado) durante toda a execução do callback do `setImmediate`, sendo encerrado apenas ao final do processamento.

### Requirement 8: Controle de Ativação via OTEL_ENABLED

**User Story:** Como desenvolvedor, quero poder desativar completamente a instrumentação OpenTelemetry sem reiniciar o servidor, para que os testes existentes não sejam afetados e o ambiente de desenvolvimento não dependa de Jaeger.

#### Acceptance Criteria

1. WHEN `OTEL_ENABLED` é `false` ou ausente, THE Tracing_Module SHALL exportar um objeto `tracer` com métodos `startSpan` e `startActiveSpan` que retornam spans no-op sem nenhuma operação de I/O.
2. WHEN `OTEL_ENABLED` é `false`, THE Tracing_Module SHALL não importar nem inicializar nenhum pacote `@opentelemetry/*` que realize conexões de rede.
3. THE Tracing_Module SHALL ler `OTEL_ENABLED` no momento da importação do módulo, sem necessidade de restart para alteração em runtime.
4. WHEN `OTEL_ENABLED` é `true` e `OTEL_EXPORTER_OTLP_ENDPOINT` não está definido, THE Tracing_Module SHALL usar `http://localhost:4318` como endpoint padrão e registrar um aviso via `console.warn`.
5. THE Tracing_Module SHALL ser compatível com o ambiente de testes Vitest, não causando falhas nos 159 testes existentes quando `OTEL_ENABLED` é `false`.

### Requirement 9: Correlação com Logging Estruturado Existente

**User Story:** Como engenheiro de operações, quero que o traceId e spanId do OpenTelemetry sejam incluídos nos logs JSON existentes, para que eu possa correlacionar logs e traces no Jaeger e em ferramentas de log aggregation.

#### Acceptance Criteria

1. WHEN um log é emitido pela função `log` em `services/gateway/logger.js` durante o processamento de um span ativo, THE Logger SHALL incluir o campo `traceId` com o ID do trace ativo.
2. WHEN um log é emitido durante o processamento de um span ativo, THE Logger SHALL incluir o campo `spanId` com o ID do span ativo.
3. WHEN `OTEL_ENABLED` é `false` ou nenhum span está ativo, THE Logger SHALL omitir os campos `traceId` e `spanId` dos logs, mantendo o formato JSON existente.
4. THE Logger SHALL manter compatibilidade total com o formato de log existente, adicionando `traceId` e `spanId` apenas como campos opcionais.

### Requirement 10: Compatibilidade com Testes Existentes

**User Story:** Como desenvolvedor, quero que a adição do OpenTelemetry não quebre nenhum dos 159 testes existentes, para que a suite de testes continue passando sem modificações.

#### Acceptance Criteria

1. WHEN os testes Vitest são executados com `OTEL_ENABLED` ausente ou `false`, THE Tracing_Module SHALL operar em modo no-op sem nenhuma dependência de rede ou processo externo.
2. THE Tracing_Module SHALL não alterar o comportamento observável de `JobManager`, `ProviderRouter`, `RoomAnalyzer` ou `Validator` quando `OTEL_ENABLED` é `false`.
3. WHEN os testes importam `routes/simulate.js` ou `services/core/JobManager.js`, THE Tracing_Module SHALL não causar erros de importação ou efeitos colaterais não esperados.
4. THE Tracing_Module SHALL ser compatível com o ambiente ESM do projeto (Node.js com `"type": "module"` no `package.json`), sem uso de `require()` ou CommonJS.
