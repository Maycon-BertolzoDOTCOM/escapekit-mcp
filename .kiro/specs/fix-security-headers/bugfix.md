# Bugfix Requirements Document

## Introduction

O backend Express em produção define apenas `X-Content-Type-Options: nosniff` manualmente no bloco `if (isProd)` de `server.js`. Faltam cinco headers de segurança HTTP críticos recomendados pelo OWASP e pela indústria, expondo o painel admin e os usuários a ataques de clickjacking, downgrade de HTTPS, XSS e vazamento de referrer. A correção substitui o bloco manual pelo middleware `helmet`, que aplica todos os headers com configuração segura por padrão.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN qualquer requisição HTTP é feita ao backend em produção THEN o sistema retorna apenas `X-Content-Type-Options: nosniff`, sem `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `X-XSS-Protection` ou `Referrer-Policy`

1.2 WHEN o frontend é carregado em um browser moderno em produção THEN o sistema não envia `Strict-Transport-Security`, permitindo que o browser aceite conexões HTTP sem upgrade automático para HTTPS

1.3 WHEN uma página maliciosa embute o painel admin em um `<iframe>` THEN o sistema não envia `X-Frame-Options`, permitindo ataques de clickjacking

1.4 WHEN o browser executa conteúdo injetado via XSS no painel admin THEN o sistema não envia `Content-Security-Policy`, sem restrição de origens de scripts

1.5 WHEN qualquer resposta HTTP é enviada em produção THEN o sistema inclui o header `X-Powered-By: Express`, expondo a stack tecnológica

1.6 WHEN uma requisição cross-origin é feita a partir do painel admin THEN o sistema não envia `Referrer-Policy`, podendo vazar a URL de origem para terceiros

### Expected Behavior (Correct)

2.1 WHEN qualquer requisição HTTP é feita ao backend em produção THEN o sistema SHALL retornar `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 0`, `Referrer-Policy: no-referrer` e `Content-Security-Policy` em todas as respostas

2.2 WHEN o frontend é carregado em um browser moderno em produção THEN o sistema SHALL enviar `Strict-Transport-Security: max-age=15552000; includeSubDomains`, forçando HTTPS por 180 dias

2.3 WHEN uma página maliciosa tenta embutir o painel admin em um `<iframe>` THEN o sistema SHALL enviar `X-Frame-Options: DENY`, bloqueando o carregamento no iframe

2.4 WHEN o browser processa respostas do painel admin THEN o sistema SHALL enviar `Content-Security-Policy` restringindo scripts a `'self'` e aos domínios dos provedores de IA (`wavespeed.ai`, `pika.art`, `zhipuai.cn`)

2.5 WHEN qualquer resposta HTTP é enviada em produção THEN o sistema SHALL omitir o header `X-Powered-By` em todas as respostas

2.6 WHEN uma requisição cross-origin é feita a partir do painel admin THEN o sistema SHALL enviar `Referrer-Policy: no-referrer`, impedindo vazamento de URL de origem

### Unchanged Behavior (Regression Prevention)

3.1 WHEN uma requisição válida é feita a `/v1/analyze` THEN o sistema SHALL CONTINUE TO retornar o mesmo status code e body que retornava antes da correção

3.2 WHEN uma requisição válida é feita a `/v1/simulate` THEN o sistema SHALL CONTINUE TO retornar o mesmo status code e body que retornava antes da correção

3.3 WHEN uma requisição válida é feita a `/v1/billing`, `/v1/auth`, `/v1/admin` ou `/v1/usage` THEN o sistema SHALL CONTINUE TO retornar os mesmos status codes e bodies que retornava antes da correção

3.4 WHEN o frontend Vercel faz requisições cross-origin à API THEN o sistema SHALL CONTINUE TO responder com os headers CORS corretos, sem bloqueio por `Cross-Origin-Resource-Policy`

3.5 WHEN o ambiente é `development` (não produção) THEN o sistema SHALL CONTINUE TO funcionar normalmente sem exigir os headers de segurança adicionais

3.6 WHEN o rate limiter rejeita uma requisição com status 429 THEN o sistema SHALL CONTINUE TO retornar `{ error: 'Too Many Requests', retryAfter }` com o mesmo formato

---

## Bug Condition (Pseudocódigo)

```pascal
FUNCTION isBugCondition(response)
  INPUT: response de qualquer rota do backend em produção
  OUTPUT: boolean

  RETURN NOT response.headers.has('X-Frame-Options')
      OR NOT response.headers.has('Strict-Transport-Security')
      OR NOT response.headers.has('Content-Security-Policy')
      OR NOT response.headers.has('X-XSS-Protection')
      OR NOT response.headers.has('Referrer-Policy')
      OR response.headers.has('X-Powered-By')
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL response WHERE isProd AND isBugCondition(response) DO
  result ← applyHelmet(response)
  ASSERT result.headers['X-Frame-Options'] = 'DENY'
  ASSERT result.headers['Strict-Transport-Security'] EXISTS
  ASSERT result.headers['X-Content-Type-Options'] = 'nosniff'
  ASSERT result.headers['X-XSS-Protection'] = '0'
  ASSERT result.headers['Referrer-Policy'] = 'no-referrer'
  ASSERT result.headers['Content-Security-Policy'] EXISTS
  ASSERT NOT result.headers.has('X-Powered-By')
END FOR

// Property: Preservation Checking
FOR ALL request WHERE NOT isBugCondition(F(request)) DO
  ASSERT F(request).statusCode = F'(request).statusCode
  ASSERT F(request).body = F'(request).body
END FOR
```
