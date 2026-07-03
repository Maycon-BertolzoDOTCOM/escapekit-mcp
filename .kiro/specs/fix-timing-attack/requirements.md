# Bugfix Requirements Document

## Introduction

Comparações de secrets e API keys no backend utilizam o operador `===` do JavaScript, que é vulnerável a timing attacks. Um atacante pode medir o tempo de resposta de requisições para inferir o valor correto do `ADMIN_SECRET` ou de API keys de clientes byte a byte, comprometendo a segurança de toda a plataforma.

Os pontos afetados são:
- `backend/routes/admin.js` — `requireAdmin`: `token !== secret`
- `backend/server.js` — `requireAdminAuth`: `token !== process.env.ADMIN_SECRET`
- `backend/routes/usage.js` — lookup `keys[apiKey]` (comparação implícita por chave de objeto)

A correção consiste em substituir todas essas comparações por `timingSafeEqual` do módulo nativo `crypto` do Node.js, centralizado em um helper `safeCompare`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN um token de admin é comparado com `ADMIN_SECRET` em `requireAdmin` THEN o sistema usa `token !== secret` (operador `===`), expondo o tempo de comparação proporcional ao prefixo correto

1.2 WHEN um token de admin é comparado com `ADMIN_SECRET` em `requireAdminAuth` THEN o sistema usa `token !== process.env.ADMIN_SECRET` (operador `===`), expondo o tempo de comparação proporcional ao prefixo correto

1.3 WHEN uma API key é validada em `usage.js` THEN o sistema usa `keys[apiKey]` para lookup direto no objeto, realizando comparação de string nativa que pode vazar informação de tempo

1.4 WHEN qualquer um dos valores comparados é `null`, `undefined` ou string vazia THEN o sistema pode lançar exceção ou retornar resultado inconsistente

### Expected Behavior (Correct)

2.1 WHEN um token de admin é comparado com `ADMIN_SECRET` em `requireAdmin` THEN o sistema SHALL usar `safeCompare(token, secret)` com tempo de execução constante independente do conteúdo

2.2 WHEN um token de admin é comparado com `ADMIN_SECRET` em `requireAdminAuth` THEN o sistema SHALL usar `safeCompare(token, process.env.ADMIN_SECRET)` com tempo de execução constante independente do conteúdo

2.3 WHEN uma API key é validada em `usage.js` THEN o sistema SHALL iterar sobre as chaves conhecidas usando `safeCompare` para encontrar a correspondência, sem expor tempo de comparação

2.4 WHEN qualquer um dos valores comparados é `null`, `undefined` ou string vazia THEN o sistema SHALL retornar `false` imediatamente sem lançar exceção

2.5 WHEN os dois valores têm comprimentos diferentes THEN o sistema SHALL retornar `false` sem chamar `timingSafeEqual` (que lançaria erro com buffers de tamanhos distintos)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN um token de admin válido e correto é fornecido THEN o sistema SHALL CONTINUE TO conceder acesso às rotas protegidas normalmente

3.2 WHEN um token de admin inválido ou incorreto é fornecido THEN o sistema SHALL CONTINUE TO retornar HTTP 401 Unauthorized

3.3 WHEN uma API key válida e ativa é fornecida em `/v1/usage` THEN o sistema SHALL CONTINUE TO retornar os dados de consumo do cliente

3.4 WHEN uma API key inválida ou inativa é fornecida em `/v1/usage` THEN o sistema SHALL CONTINUE TO retornar HTTP 401 com mensagem de erro

3.5 WHEN nenhuma API key é fornecida em `/v1/usage` THEN o sistema SHALL CONTINUE TO retornar HTTP 401 solicitando autenticação
