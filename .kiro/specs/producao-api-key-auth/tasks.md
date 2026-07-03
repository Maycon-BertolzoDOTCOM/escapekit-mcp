# Tarefas — Autenticação por API Key

## Tarefas

- [x] 1. Criar `apiKeyStore.js` — armazenamento e leitura de keys
  - Criar `backend/data/api-keys.json` com estrutura inicial (vazio `{}`)
  - Implementar `loadKeys()`, `saveKeys()`, `incrementUsage()`, `getUsage()`
  - Implementar rollover mensal: zerar contador quando mês muda
  - _Requisitos: 2.1, 2.2, 2.3, 3.4_

- [x] 2. Criar `middleware/apiKey.js`
  - Implementar verificação de header `X-API-Key`
  - Retornar 401 quando ausente ou inválida
  - Retornar 429 quando limite excedido, com `resetAt`
  - Adicionar header `X-Usage-Warning` quando uso >= 80%
  - Injetar `req.client` com `clientId` e `planId`
  - _Requisitos: 1.1, 1.2, 1.3, 3.2, 3.3_

- [x] 3. Aplicar middleware nas rotas de simulação
  - Importar e aplicar `apiKeyMiddleware` em `routes/simulate.js` e `routes/analyze.js`
  - Registrar `req.client.clientId` no log de cada simulação
  - _Requisitos: 1.3, 1.4_

- [x] 4. Criar endpoints admin de gerenciamento de keys
  - `POST /admin/keys` — gera nova key com `crypto.randomBytes`
  - `DELETE /admin/keys/:key` — desativa key (não remove, seta `active: false`)
  - `GET /admin/keys` — lista todas as keys (sem expor o valor da key, apenas clientId e stats)
  - Proteger com `requireAdminAuth` existente
  - _Requisitos: 2.1, 2.2, 2.4, 2.5_

- [ ] 5. Testes unitários do middleware
  - Teste: requisição sem header → 401
  - Teste: key inválida → 401
  - Teste: key válida → next() chamado, req.client preenchido
  - Teste: limite excedido → 429 com resetAt
  - Teste: 80% do limite → header X-Usage-Warning presente
  - _Requisitos: 1.1, 1.2, 3.2, 3.3_

- [ ] 6. Criar primeira API key para piloto
  - Usar `POST /admin/keys` para criar key do cliente piloto
  - Documentar como o cliente deve incluir a key nas requisições
  - _Requisitos: 2.3_
