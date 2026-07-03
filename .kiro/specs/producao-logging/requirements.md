# Requisitos — Logging Estruturado

## Introdução

O sistema não tem logging estruturado em produção. Quando um provider falha ou o sistema retorna fallback, não há como saber o motivo sem acesso ao terminal. Logging estruturado permite diagnóstico remoto e alertas.

## Requisitos

### Requisito 1: Logs estruturados em JSON

**User Story:** Como operador, quero ver logs em formato JSON com contexto suficiente para diagnosticar problemas sem acesso ao servidor.

#### Critérios de Aceitação

1. THE sistema SHALL emitir logs em formato JSON com campos: `timestamp`, `level`, `event`, `clientId`, `provider`, `latencyMs`, `error`
2. THE nível de log SHALL ser configurável via variável `LOG_LEVEL` (debug, info, warn, error)
3. WHEN um provider falha, THE sistema SHALL logar `level: "warn"` com `provider`, `error.message` e `latencyMs`
4. WHEN o fallback é ativado, THE sistema SHALL logar `level: "warn"` com `clientId` e `fallbackDescription`
5. WHEN uma invariante é violada, THE sistema SHALL logar `level: "info"` com `invariant`, `score` e `provider`

### Requisito 2: Alertas de erros críticos

**User Story:** Como operador, quero ser notificado quando todos os providers falham.

#### Critérios de Aceitação

1. WHEN todos os providers falham em uma requisição, THE sistema SHALL logar `level: "error"` com todos os providers tentados
2. THE Railway/plataforma SHALL capturar logs de stderr (level error/warn) para alertas
