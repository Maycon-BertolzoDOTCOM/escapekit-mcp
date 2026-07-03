# Tasks — fix-security-headers

## Task List

- [x] 1. Instalar dependência helmet
  - [x] 1.1 Adicionar `helmet` ao `package.json` do backend executando `npm install helmet` em `pisosrealview-pro-transformed/backend/`
  - Acceptance: `helmet` aparece em `dependencies` no `package.json`

- [x] 2. Substituir middleware manual pelo helmet em server.js
  - [x] 2.1 Remover o bloco `if (isProd)` que define apenas `X-Content-Type-Options: nosniff` manualmente
  - [x] 2.2 Adicionar `import helmet from 'helmet'` no topo de `server.js`
  - [x] 2.3 Inserir `app.use(helmet({ ... }))` após `correlationIdMiddleware` e antes do middleware de request logging, com a configuração de `contentSecurityPolicy`, `crossOriginResourcePolicy` e `referrerPolicy` definida no design
  - Acceptance: o bloco manual é removido e o helmet está registrado como middleware global

- [x] 3. Verificar headers em resposta de desenvolvimento
  - [x] 3.1 Confirmar que o servidor inicia sem erros com `NODE_ENV=development`
  - [x] 3.2 Confirmar que `GET /health` retorna status 200 com os headers de segurança presentes
  - Acceptance: nenhum erro de startup; `/health` responde com `X-Frame-Options`, `X-Content-Type-Options` e sem `X-Powered-By`

- [x] 4. Escrever teste de integração para headers de segurança
  - [x] 4.1 Criar `pisosrealview-pro-transformed/backend/__tests__/securityHeaders.test.js` usando `supertest` e `app` exportado de `server.js`
  - [x] 4.2 Testar que `GET /health` retorna `X-Frame-Options: DENY`
  - [x] 4.3 Testar que `GET /health` retorna `Strict-Transport-Security` com `max-age`
  - [x] 4.4 Testar que `GET /health` retorna `X-Content-Type-Options: nosniff`
  - [x] 4.5 Testar que `GET /health` retorna `X-XSS-Protection: 0`
  - [x] 4.6 Testar que `GET /health` retorna `Referrer-Policy: no-referrer`
  - [x] 4.7 Testar que `GET /health` NÃO retorna `X-Powered-By`
  - [x] 4.8 Testar que `GET /health` ainda retorna status 200 e body `{ ok: true }` (preservação)
  - Acceptance: todos os assertions passam com `npm test`
