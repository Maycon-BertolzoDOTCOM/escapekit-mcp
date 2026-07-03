# Tasks — fix-timing-attack

## Tasks

- [x] 1. Criar helper `safeCompare`
  - [x] 1.1 Criar arquivo `backend/middleware/safeCompare.js` com a função `safeCompare(a, b)` usando `crypto.timingSafeEqual`
  - [x] 1.2 Implementar guard para valores falsy (retorna `false` sem exceção)
  - [x] 1.3 Implementar verificação de comprimento antes de chamar `timingSafeEqual`

- [x] 2. Corrigir `backend/routes/admin.js`
  - [x] 2.1 Importar `safeCompare` de `../middleware/safeCompare.js`
  - [x] 2.2 Substituir `token !== secret` por `!safeCompare(token, secret)` em `requireAdmin`

- [x] 3. Corrigir `backend/server.js`
  - [x] 3.1 Importar `safeCompare` de `./middleware/safeCompare.js`
  - [x] 3.2 Substituir `token !== process.env.ADMIN_SECRET` por `!safeCompare(token, process.env.ADMIN_SECRET)` em `requireAdminAuth`

- [x] 4. Corrigir `backend/routes/usage.js`
  - [x] 4.1 Importar `safeCompare` de `../middleware/safeCompare.js`
  - [x] 4.2 Substituir `keys[apiKey]` por iteração com `Object.entries(keys).find(([k]) => safeCompare(k, apiKey))`

- [x] 5. Escrever testes unitários para `safeCompare`
  - [x] 5.1 Criar `backend/middleware/__tests__/safeCompare.test.js`
  - [x] 5.2 Testar igualdade de strings idênticas (deve retornar `true`)
  - [x] 5.3 Testar strings diferentes (deve retornar `false`)
  - [x] 5.4 Testar valores falsy: `null`, `undefined`, `''` (deve retornar `false` sem exceção)
  - [x] 5.5 Testar strings de comprimentos diferentes (deve retornar `false` sem exceção)
  - [x] 5.6 Testar que o resultado é funcionalmente equivalente a `===` para strings arbitrárias (property test)
  - [ ] 5.7 Testar performance do lookup em usage.js: com 200 chaves no store, o tempo de resposta de `GET /v1/usage` deve ser < 50ms (garantia de que O(n) é aceitável para MVP)

- [x] 6. Escrever testes de integração para os middlewares corrigidos
  - [x] 6.1 Testar que `requireAdmin` rejeita tokens inválidos com 401
  - [x] 6.2 Testar que `requireAdmin` aceita o token correto
  - [x] 6.3 Testar que `requireAdminAuth` rejeita tokens inválidos com 401
  - [x] 6.4 Testar que `requireAdminAuth` aceita o token correto
  - [x] 6.5 Testar que `/v1/usage` continua funcionando com API key válida
  - [ ] 6.6 Testar que `/v1/usage` retorna 401 para API key inválida
