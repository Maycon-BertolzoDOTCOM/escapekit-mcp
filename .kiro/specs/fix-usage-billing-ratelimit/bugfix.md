# Bugfix Requirements Document

## Introduction

Os endpoints `/v1/usage` e `/v1/billing` não possuem rate limiting, ao contrário de `/v1/analyze` e `/v1/simulate` que já estão protegidos. O `apiKeyStore.js` executa `fs.readFileSync` a cada requisição para ler `api-keys.json` do disco. Um cliente pode fazer polling agressivo de `/v1/usage` (ex: 1000 req/min), causando I/O excessivo no disco do Railway e degradando a performance para todos os outros clientes. O endpoint `/v1/billing/webhook` também está exposto sem rate limit, podendo ser usado para flood de webhooks falsos.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN um cliente faz polling agressivo de `GET /v1/usage` (ex: 1000 req/min) THEN o sistema executa `fs.readFileSync` em cada requisição sem nenhum controle de frequência, causando I/O excessivo no disco

1.2 WHEN um atacante envia múltiplas requisições `POST /v1/billing/webhook` em sequência THEN o sistema processa todos os webhooks sem limite, permitindo flood de webhooks falsos

1.3 WHEN um cliente faz polling agressivo de qualquer endpoint `GET /v1/billing` THEN o sistema responde a todas as requisições sem restrição de frequência por IP

### Expected Behavior (Correct)

2.1 WHEN um cliente faz mais de 30 requisições `GET /v1/usage` do mesmo IP em uma janela de 1 minuto THEN o sistema SHALL retornar HTTP 429 com `{ error: "Too Many Requests", retryAfter: <segundos> }` para a 31ª requisição em diante

2.2 WHEN um cliente faz mais de 60 requisições `POST /v1/billing/webhook` do mesmo IP em uma janela de 1 minuto THEN o sistema SHALL retornar HTTP 429 com `{ error: "Too Many Requests", retryAfter: <segundos> }` para a 61ª requisição em diante

2.3 WHEN um cliente faz mais de 20 requisições para qualquer endpoint `/v1/billing` do mesmo IP em uma janela de 1 minuto THEN o sistema SHALL retornar HTTP 429 com `{ error: "Too Many Requests", retryAfter: <segundos> }` para a 21ª requisição em diante

### Unchanged Behavior (Regression Prevention)

3.1 WHEN um cliente faz até 30 requisições `GET /v1/usage` do mesmo IP em 1 minuto THEN o sistema SHALL CONTINUE TO responder normalmente com os dados de consumo

3.2 WHEN um webhook legítimo do Asaas é enviado para `POST /v1/billing/webhook` dentro do limite de 60 req/min THEN o sistema SHALL CONTINUE TO processar o webhook normalmente

3.3 WHEN dois IPs diferentes fazem requisições simultâneas para `/v1/usage` THEN o sistema SHALL CONTINUE TO tratar os contadores de rate limit de forma independente por IP, sem interferência entre eles

3.4 WHEN a aplicação está em modo desenvolvimento (`NODE_ENV !== 'production'`) THEN o sistema SHALL CONTINUE TO não aplicar rate limiting, mantendo o comportamento atual

3.5 WHEN os endpoints `/v1/analyze` e `/v1/simulate` recebem requisições THEN o sistema SHALL CONTINUE TO aplicar o rate limiter global existente sem alteração
