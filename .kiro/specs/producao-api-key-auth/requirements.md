# Requisitos — Autenticação por API Key

## Introdução

O endpoint `/v1/simulate` aceita qualquer requisição sem identificar o cliente. Para cobrar por uso, limitar consumo por plano e revogar acesso, cada cliente precisa de uma API key única.

## Requisitos

### Requisito 1: Autenticação obrigatória em endpoints de simulação

**User Story:** Como operador, quero que apenas clientes com API key válida possam usar o sistema, para que eu possa controlar acesso e cobrar pelo uso.

#### Critérios de Aceitação

1. WHEN uma requisição chega em `/v1/simulate` ou `/v1/analyze` sem header `X-API-Key`, THE sistema SHALL retornar 401 com `{ "error": "API key obrigatória" }`
2. WHEN uma requisição chega com `X-API-Key` inválida, THE sistema SHALL retornar 401 com `{ "error": "API key inválida" }`
3. WHEN uma requisição chega com `X-API-Key` válida, THE sistema SHALL processar normalmente e incluir `clientId` no contexto da requisição
4. THE endpoint `/v1/simulate` SHALL registrar o `clientId` em cada chamada para rastreamento de uso

### Requisito 2: Gerenciamento de API keys

**User Story:** Como operador, quero criar e revogar API keys sem reiniciar o servidor.

#### Critérios de Aceitação

1. THE sistema SHALL suportar múltiplas API keys ativas simultaneamente
2. WHEN uma API key é revogada, THE sistema SHALL rejeitar requisições com essa key imediatamente
3. THE sistema SHALL associar cada API key a um `clientId`, `planId` e `createdAt`
4. THE endpoint `POST /admin/keys` SHALL criar uma nova API key (requer `ADMIN_SECRET`)
5. THE endpoint `DELETE /admin/keys/:key` SHALL revogar uma API key (requer `ADMIN_SECRET`)

### Requisito 3: Planos e limites por cliente

**User Story:** Como operador, quero que clientes do plano Básico tenham limite de 200 simulações/mês.

#### Critérios de Aceitação

1. THE sistema SHALL suportar planos: `basic` (200 sim/mês), `popular` (500 sim/mês), `pro` (1000 sim/mês), `unlimited`
2. WHEN um cliente atinge 80% do limite, THE sistema SHALL incluir header `X-Usage-Warning: true` na resposta
3. WHEN um cliente excede o limite, THE sistema SHALL retornar 429 com `{ "error": "Limite mensal atingido", "resetAt": "YYYY-MM-01" }`
4. THE contador de uso SHALL resetar no primeiro dia de cada mês
