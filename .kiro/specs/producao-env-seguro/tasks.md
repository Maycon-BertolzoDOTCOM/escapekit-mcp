# Tarefas — Variáveis de Ambiente Seguras

## Tarefas

- [ ] 1. Revogar chave WaveSpeedAI exposta
  - Acessar painel WaveSpeedAI e revogar a chave atual
  - Gerar nova chave
  - Atualizar `backend/.env` local com a nova chave
  - _Requisitos: 2.1, 2.2_

- [x] 2. Criar `backend/.env.example`
  - Listar todas as variáveis com valores placeholder
  - Incluir comentários explicando cada variável
  - _Requisitos: 1.3_

- [x] 3. Atualizar `.gitignore`
  - Adicionar `backend/.env` se não estiver
  - Adicionar `backend/data/api-keys.json`
  - Adicionar `backend/services/gateway/credits.json`
  - Adicionar `backend/services/gateway/task-metrics.json`
  - _Requisitos: 1.2_

- [x] 4. Adicionar validação de variáveis obrigatórias no startup
  - Adicionar verificação de `WAVESPEED_API_KEY` e `ADMIN_SECRET` no início do `server.js`
  - Falhar com `process.exit(1)` e mensagem clara se ausente
  - _Requisitos: 1.4_

- [ ] 5. Verificar histórico Git
  - Executar `git log --all --full-history -- backend/.env` para verificar se o arquivo foi commitado
  - Se sim, usar `git filter-branch` ou BFG Repo Cleaner para remover do histórico
  - _Requisitos: 1.1_
