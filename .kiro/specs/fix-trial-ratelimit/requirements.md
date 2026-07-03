# Bugfix Requirements Document

## Introduction

O endpoint `POST /v1/auth/trial` não possui rate limiting, permitindo que bots criem milhares de contas trial em segundos. Cada conta trial concede 50 simulações gratuitas, o que esgota rapidamente os créditos dos provedores de IA (Pika Labs: 80 simulações/mês, Zhipu CogView: free tier). 100 contas criadas por bot = 5.000 simulações consumidas sem receita. O rate limiter existente em `server.js` cobre apenas `/v1/analyze` e `/v1/simulate`, deixando `/v1/auth/trial` completamente desprotegido.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN um IP envia múltiplas requisições `POST /v1/auth/trial` em sequência THEN o sistema processa todas sem restrição de frequência
1.2 WHEN um bot envia 100 requisições `POST /v1/auth/trial` em menos de 1 hora THEN o sistema cria 100 contas trial, consumindo 5.000 simulações dos provedores de IA
1.3 WHEN o rate limiter de produção é aplicado THEN o sistema aplica restrições apenas em `/v1/analyze` e `/v1/simulate`, ignorando `/v1/auth/trial`
1.4 WHEN um IP envia múltiplas requisições `POST /v1/auth` (login) em sequência THEN o sistema processa todas sem restrição de frequência

### Expected Behavior (Correct)

2.1 WHEN um IP envia mais de 5 requisições `POST /v1/auth/trial` dentro de uma janela de 1 hora THEN o sistema SHALL retornar HTTP 429 com corpo `{ "error": "Too Many Requests", "retryAfter": <segundos> }`
2.2 WHEN um IP tenta criar a 6ª conta trial dentro de 1 hora THEN o sistema SHALL bloquear a requisição antes de chegar ao router de auth, retornando 429
2.3 WHEN um IP envia mais de 20 requisições para `/v1/auth` dentro de uma janela de 15 minutos THEN o sistema SHALL retornar HTTP 429 com corpo `{ "error": "Too Many Requests", "retryAfter": <segundos> }`
2.4 WHEN o rate limiter de trial retorna 429 THEN o sistema SHALL incluir o campo `retryAfter` com o número de segundos até a janela expirar

### Unchanged Behavior (Regression Prevention)

3.1 WHEN um IP envia até 5 requisições `POST /v1/auth/trial` dentro de 1 hora THEN o sistema SHALL CONTINUE TO processar cada requisição normalmente, criando a conta trial
3.2 WHEN a janela de 1 hora expira após o bloqueio THEN o sistema SHALL CONTINUE TO aceitar novas requisições `POST /v1/auth/trial` do mesmo IP
3.3 WHEN dois IPs diferentes enviam requisições `POST /v1/auth/trial` THEN o sistema SHALL CONTINUE TO aplicar o rate limit de forma independente por IP, sem interferência entre eles
3.4 WHEN um IP envia até 20 requisições para `/v1/auth` dentro de 15 minutos THEN o sistema SHALL CONTINUE TO processar login e demais rotas de auth normalmente
3.5 WHEN o rate limiter de `/v1/analyze` e `/v1/simulate` está ativo THEN o sistema SHALL CONTINUE TO aplicar as mesmas restrições existentes nesses endpoints sem alteração

---

## Bug Condition (Pseudocódigo)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type HttpRequest
  OUTPUT: boolean

  RETURN X.method = "POST"
     AND X.path = "/v1/auth/trial"
     AND countRequestsFromIP(X.ip, window=1h) > 5
END FUNCTION
```

```pascal
// Property: Fix Checking — Trial Rate Limit
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleTrialRequest'(X)
  ASSERT result.status = 429
  ASSERT result.body.retryAfter >= 0
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleTrialRequest(X) = handleTrialRequest'(X)
END FOR
```
