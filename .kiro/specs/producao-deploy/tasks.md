# Tarefas — Deploy em Produção

## Tarefas

- [x] 1. Preparar backend para deploy
  - Separar scripts `start` (sem --env-file) e `dev` (com --env-file) no `package.json`
  - Adicionar validação de variáveis obrigatórias no startup do `server.js`
  - Criar `backend/.env.example` com todas as variáveis e valores placeholder
  - Confirmar que `backend/.env` está no `.gitignore`
  - _Requisitos: 1.4, 3.1, 3.2, 3.4_

- [ ] 2. Deploy do backend no Railway
  - Criar conta Railway e novo projeto
  - Conectar repositório Git ao Railway
  - Configurar variáveis de ambiente no dashboard (WAVESPEED_API_KEY, ADMIN_SECRET, NODE_ENV, CORS_ORIGIN)
  - Definir root directory como `backend/` e start command como `node server.js`
  - Verificar que o deploy completa sem erros e `GET /` retorna 404 (sem rota raiz)
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Deploy do frontend no Vercel
  - Criar conta Vercel e importar repositório
  - Configurar root directory como `frontend/`, build command `npm run build`, output `dist`
  - Configurar variável `VITE_API_BASE_URL` apontando para URL do Railway
  - Verificar que o build completa e a página carrega no browser
  - _Requisitos: 2.1, 2.2, 2.3_

- [ ] 4. Configurar domínio e HTTPS
  - Adicionar domínio customizado no Vercel (frontend)
  - Adicionar subdomínio `api.` no Railway (backend)
  - Configurar CNAME no registrador de domínio
  - Verificar HTTPS funcionando em ambos
  - Atualizar `CORS_ORIGIN` no Railway para o domínio final
  - _Requisitos: 1.1, 2.1_

- [ ] 5. Teste de smoke em produção
  - Fazer `POST /v1/simulate` com imagem real via curl ou Postman
  - Verificar que a simulação retorna imagem editada (não fallback)
  - Verificar que o frontend conecta ao backend e exibe resultado
  - _Requisitos: 1.2, 2.2_
