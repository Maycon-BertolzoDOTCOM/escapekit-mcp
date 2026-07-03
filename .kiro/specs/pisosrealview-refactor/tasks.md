# Implementation Plan: pisosrealview-refactor

## Overview

Refatoração do projeto `pisosrealview-pro-transformed` para separar backend (Node.js + Express) e frontend (React + Vite). Os módulos existentes são movidos sem reescrita de lógica. O backend expõe `/v1/analyze` e `/v1/simulate`. O frontend passa a consumir a API via `fetch`, sem nenhuma dependência de módulos Node.js.

## Tasks

- [-] 0. Preparação — estado inicial do repositório
  - [x] 0.1 Criar branch de refatoração
    - Executar `git checkout -b refactor/separate-backend-frontend`
    - _Requirements: 7.1_

  - [x] 0.2 Fazer commit do estado atual (backup antes de mover arquivos)
    - Executar `git add -A && git commit -m "chore: backup before refactor"`
    - _Requirements: 7.1_

- [x] 1. Criar estrutura de diretórios
  - [x] 1.1 Criar pastas `backend/` e `frontend/` na raiz do projeto
    - `mkdir -p backend frontend`
    - _Requirements: 7.1_

  - [x] 1.2 Criar subdiretórios do backend
    - `mkdir -p backend/routes backend/services/ai backend/services/gateway backend/services/core/invariants`
    - _Requirements: 7.1_

  - [x] 1.3 Criar subdiretórios do frontend
    - `mkdir -p frontend/src/components frontend/src/api`
    - _Requirements: 5.1, 5.2_

- [x] 2. Mover módulos existentes (sem reescrever lógica)
  - [x] 2.1 Mover módulos de IA para `backend/services/ai/`
    - Mover `services/ai/roomAnalyzer.js`, `materialApplier.js`, `invariants.js`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.2 Mover gateway para `backend/services/gateway/`
    - Mover todos os arquivos de `services/gateway/*`
    - _Requirements: 7.2, 7.3_

  - [x] 2.3 Mover invariants core para `backend/services/core/invariants/`
    - Mover todos os arquivos de `services/core/invariants/*`
    - _Requirements: 7.1, 7.3_

  - [x] 2.4 Ajustar imports relativos nos arquivos movidos
    - Corrigir manualmente os caminhos relativos em cada arquivo movido (profundidade de diretório muda)
    - Verificar cada arquivo com `node --check <arquivo>` após ajuste
    - Não usar `sed` — ajuste manual ou refatoração de IDE
    - _Requirements: 7.3, 7.4_

- [x] 3. Criar backend Express com rotas
  - [x] 3.1 Inicializar `backend/package.json` e instalar dependências
    - `cd backend && npm init -y && npm install express cors dotenv express-rate-limit`
    - _Requirements: 6.1, 8.1_

  - [x] 3.2 Criar `backend/server.js` conforme esqueleto do design
    - Middleware stack: `express.json` com limite de payload, CORS, header de segurança (produção), rate limiting (produção)
    - Registrar rotas `/v1/analyze` e `/v1/simulate`
    - Error handler global para 413 e 500
    - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.3, 8.4_

  - [x] 3.3 Criar `backend/routes/analyze.js`
    - Validar presença e formato de `imageBase64` → 400 se inválido
    - Chamar `roomAnalyzer.analyzeRoom(imageBase64)` e retornar RoomContext com status 200
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Criar `backend/routes/simulate.js`
    - Validar `imageBase64` e schema completo de `material` (`type`, `color`, `dimensions`) → 400 com campo identificado
    - Chamar `analyzeRoom` → `applyMaterial` → `validateInvariants`
    - Retornar fallback textual (200) quando provedor indisponível
    - Registrar log JSON e retornar 409 em caso de violação de invariante
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.5 Criar `backend/.env` com todas as variáveis de ambiente
    - `PORT`, `NODE_ENV`, `CORS_ORIGIN`, chaves de API (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.), `USE_LOCAL_FALLBACK`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `MAX_PAYLOAD_SIZE`
    - _Requirements: 7.4, 8.1_

- [x] 4. Checkpoint — verificar backend isoladamente
  - Iniciar `node backend/server.js` e testar com `curl` ou Postman
  - Verificar que `POST /v1/analyze` e `POST /v1/simulate` respondem corretamente (200, 400, 409)
  - Garantir que não há erros de módulo não encontrado (`Cannot find module`)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Criar frontend React + Vite
  - [x] 5.1 Inicializar projeto Vite com React em `frontend/`
    - `cd frontend && npm create vite@latest . -- --template react`
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 Remover dependências Node.js do `package.json` do frontend
    - Remover `sharp`, `fs`, `path`, `buffer` e quaisquer outros módulos Node.js
    - _Requirements: 1.1, 1.4_

  - [x] 5.3 Criar `frontend/src/api/client.js`
    - Exportar funções `simulate(imageBase64, material)` e `analyze(imageBase64)` usando `fetch` para o backend
    - Usar `import.meta.env.VITE_API_BASE_URL` como base URL
    - _Requirements: 1.3, 5.3_

  - [x] 5.4 Criar `frontend/src/components/ImageUploader.jsx`
    - Input `type="file"` com `accept="image/*"`
    - Usar `FileReader.readAsDataURL` para converter arquivo para base64
    - Chamar `onImage(base64)` ao concluir
    - _Requirements: 5.1_

  - [x] 5.5 Criar `frontend/src/components/MaterialSelector.jsx`
    - Dropdown (`<select>`) com lista de materiais recebida via props
    - Chamar `onChange(material)` ao selecionar
    - _Requirements: 5.2_

  - [x] 5.6 Criar `frontend/src/components/ResultViewer.jsx`
    - Renderizar `<img src={result.editedImageBase64}>` quando imagem disponível
    - Renderizar `<p role="alert">` para mensagens de erro
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 5.7 Criar `frontend/src/App.jsx`
    - Estado: `imageBase64`, `material`, `result`, `error`, `loading`
    - Tratar resposta 200 com `editedImageBase64` (exibir imagem) e com `fallbackDescription` (exibir como erro)
    - Tratar resposta 409 com mensagem sugerindo outro material
    - Tratar demais erros com mensagem genérica sem detalhes internos
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 5.8 Criar `frontend/.env`
    - `VITE_API_BASE_URL=http://localhost:3001`
    - _Requirements: 6.1_

  - [x] 5.9 Verificar ausência de imports Node.js no frontend
    - Executar: `grep -r "require('fs')\|require('path')\|require('sharp')\|require('buffer')" frontend/src`
    - O comando deve retornar vazio
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 6. Checkpoint — integração e testes manuais
  - Iniciar backend (`node backend/server.js`) e frontend (`npm run dev` em `frontend/`) em terminais separados
  - Testar fluxo completo: upload de imagem → seleção de material → clique em "Simular"
  - Verificar resposta de sucesso (imagem exibida) e fallback (texto descritivo)
  - Simular indisponibilidade de provedor (desligar chave API) e verificar fallback textual
  - Verificar logs de violação de invariante em formato JSON no console do backend
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Property-based tests
  - [ ]* 7.1 Instalar `fast-check` no backend e no frontend
    - `npm install --save-dev fast-check` em `backend/` e em `frontend/`
    - _Requirements: 2.1, 3.1_

  - [ ]* 7.2 Implementar testes de propriedade P2 e P3 — endpoint `/v1/analyze`
    - **Property 2: POST /v1/analyze retorna RoomContext para inputs válidos**
    - **Validates: Requirements 2.1, 2.2**
    - **Property 3: POST /v1/analyze rejeita inputs inválidos com 400**
    - **Validates: Requirements 2.3**
    - Usar `fast-check` + `supertest`

  - [ ]* 7.3 Implementar testes de propriedade P4, P5 e P6 — endpoint `/v1/simulate`
    - **Property 4: POST /v1/simulate retorna campos obrigatórios para inputs válidos**
    - **Validates: Requirements 3.1, 3.3**
    - **Property 5: Validação de campos obrigatórios retorna 400 com campo faltante identificado**
    - **Validates: Requirements 3.2, 3.4, 3.5**
    - **Property 6: fidelity está sempre no intervalo [0.0, 1.0]**
    - **Validates: Requirements 3.7**
    - Usar `fast-check` + `supertest`

  - [ ]* 7.4 Implementar testes de propriedade P7, P8 e P9 — Invariant_Validator
    - **Property 7: Invariant_Validator executa todas as quatro verificações**
    - **Validates: Requirements 4.1, 4.5**
    - **Property 8: Log de violação de invariante contém todos os campos obrigatórios**
    - **Validates: Requirements 4.3**
    - **Property 9: Violação de invariante retorna 409 com campos obrigatórios**
    - **Validates: Requirements 4.4**
    - Usar `fast-check` + `sinon` para mock das verificações

  - [ ]* 7.5 Implementar testes de propriedade P10, P11, P12 e P13 — componentes React
    - **Property 10: FileReader converte qualquer arquivo de imagem para base64**
    - **Validates: Requirements 5.1**
    - **Property 11: Botão "Simular" envia payload correto**
    - **Validates: Requirements 5.3**
    - **Property 12: Resposta 200 renderiza a imagem resultante**
    - **Validates: Requirements 5.4**
    - **Property 13: Erros não-200/não-409 exibem mensagem genérica sem detalhes internos**
    - **Validates: Requirements 5.6**
    - Usar `fast-check` + `@testing-library/react` + `jsdom`

  - [ ]* 7.6 Implementar testes de propriedade P14 e P15 — rate limiting e payload
    - **Property 14: Rate limiter retorna 429 com retryAfter após exceder 60 req/min**
    - **Validates: Requirements 8.1, 8.2, 8.5**
    - **Property 15: Payloads acima de 10 MB retornam 413**
    - **Validates: Requirements 8.4**
    - Usar `fast-check` + `supertest` com `NODE_ENV=production`

  - [ ]* 7.7 Configurar script `npm test` para rodar todos os testes
    - Adicionar script `"test"` no `package.json` do backend e do frontend
    - _Requirements: 2.1, 3.1, 4.1, 5.1, 8.1_

- [x] 8. Deploy e validação final
  - [x] 8.1 Configurar backend para produção
    - Definir `NODE_ENV=production` no ambiente de deploy
    - Verificar que rate limiting e header `X-Content-Type-Options` estão ativos
    - _Requirements: 8.1, 8.3_

  - [x] 8.2 Construir frontend e verificar bundle
    - Executar `npm run build` em `frontend/`
    - Verificar que o bundle não contém módulos Node.js (`fs`, `sharp`, `path`, `buffer`)
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 8.3 Testar em ambiente de homologação
    - Validar fluxo completo no ambiente de staging
    - _Requirements: 2.1, 3.1, 5.3_

  - [x] 8.4 Criar/atualizar `README.md` com instruções de execução
    - Documentar como iniciar backend e frontend em dois terminais separados
    - Incluir variáveis de ambiente necessárias

- [x] 9. Checkpoint final — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os módulos existentes são apenas movidos — nenhuma lógica é reescrita (Requirements 7.1–7.4)
- Checkpoints garantem validação incremental antes de avançar para a próxima fase
- Testes de propriedade validam comportamentos universais; testes unitários validam exemplos específicos
