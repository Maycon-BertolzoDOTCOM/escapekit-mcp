# Plano de Implementação: PisosRealView Pro SaaS

## Visão Geral

Plano de 60 dias para implementação solo do PisosRealView Pro. Stack: Node.js/TypeScript (backend), React (frontend), Supabase (PostgreSQL + RLS), Upstash Redis, Cloudflare R2, BullMQ, Stripe/Pagar.me.

Planos: Starter R$197/mês · Pro R$497/mês · Enterprise R$1.497/mês

Testes PBT com `fast-check` — 36 propriedades, uma por arquivo em `tests/properties/`.

---

## Tarefas


---

## Fase 1 — Semanas 1–2: Infraestrutura e Fundação

- [ ] 1. Configurar projeto base e infraestrutura
  - Inicializar repositório TypeScript com `tsconfig.json`, ESLint, Prettier e Vitest
  - Criar estrutura de diretórios conforme design: `backend/src/modules/`, `backend/src/services/`, `backend/src/middleware/`, `backend/src/db/`
  - Configurar conexão com Supabase (PostgreSQL via `pg`/Knex) e Upstash Redis
  - Configurar Cloudflare R2 via SDK S3-compatible (`@aws-sdk/client-s3`)
  - Criar `docker-compose.yml` para desenvolvimento local (PostgreSQL + Redis)
  - _Requisitos: 1.1, 1.7_

- [ ] 2. Criar migrations do banco de dados
  - [ ] 2.1 Criar migrations para tabelas core: `tenants`, `users`, `subscriptions`
    - Incluir campos `plan_id`, `status`, `trial_ends_at` em `tenants`
    - Incluir campos `role`, `failed_logins`, `blocked_until` em `users`
    - _Requisitos: 1.1, 1.3, 12.1_
  - [ ] 2.2 Criar migrations para tabelas de negócio: `products`, `suppliers`, `stock_movements`, `stock_balance` (view)
    - _Requisitos: 2.1, 3.1, 3.4_
  - [ ] 2.3 Criar migrations para `quotes`, `quote_items`, `orders`, `order_status_log`
    - _Requisitos: 4.1, 5.1, 5.3_
  - [ ] 2.4 Criar migrations para `customers`, `render_jobs`, `financial_entries`, `whatsapp_messages`, `installation_jobs`
    - _Requisitos: 6.1, 7.3, 8.4, 9.1, 10.1_
  - [ ] 2.5 Implementar políticas RLS no PostgreSQL para todas as tabelas de negócio
    - Criar arquivo `backend/src/db/rls.sql` com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` e `CREATE POLICY tenant_isolation`
    - _Requisitos: 1.2, 1.7_

- [ ] 3. Implementar TenantModule — autenticação e multi-tenancy
  - [ ] 3.1 Implementar registro de Tenant com validação de CNPJ e criação de conta isolada
    - Endpoint `POST /tenants` com validação de CNPJ (formato e unicidade)
    - Criar subscription inicial no plano trial (14 dias, limites Pro)
    - _Requisitos: 1.1, 12.7_
  - [ ] 3.2 Implementar autenticação JWT — login, refresh token e logout
    - Emitir JWT com `exp = iat + 28800` (8h), claims: `sub`, `tenantId`, `role`
    - Armazenar refresh token no Redis com chave `refresh:{userId}:{tokenHash}`, TTL 30 dias
    - Implementar bloqueio após 5 tentativas inválidas consecutivas por 15 minutos
    - _Requisitos: 1.4, 1.5_
  - [ ] 3.3 Implementar middleware de tenant (`middleware/tenant.ts`)
    - Extrair `tenant_id` do JWT ou API Key e executar `SET app.current_tenant_id`
    - _Requisitos: 1.2, 1.7_
  - [ ] 3.4 Implementar gestão de usuários — convite, ativação e perfis de acesso
    - Endpoint `POST /users/invite` com envio de link de ativação (TTL 48h)
    - Perfis: `admin`, `seller`, `stockist`, `installer` com permissões distintas
    - Middleware de autorização por perfil (`middleware/auth.ts`)
    - _Requisitos: 1.3, 1.6_
  - [ ]* 3.5 Escrever teste de propriedade — Propriedade 1: Isolamento de dados entre Tenants
    - Arquivo: `tests/properties/prop-01-tenant-isolation.test.ts`
    - **Propriedade 1: Isolamento de dados entre Tenants**
    - **Valida: Requisitos 1.1, 1.2, 1.7**
  - [ ]* 3.6 Escrever teste de propriedade — Propriedade 2: Controle de acesso por perfil
    - Arquivo: `tests/properties/prop-02-role-access-control.test.ts`
    - **Propriedade 2: Controle de acesso por perfil**
    - **Valida: Requisito 1.3**
  - [ ]* 3.7 Escrever teste de propriedade — Propriedade 3: Validade do token JWT
    - Arquivo: `tests/properties/prop-03-jwt-expiry.test.ts`
    - **Propriedade 3: Validade do token JWT (`exp = iat + 28800`)**
    - **Valida: Requisito 1.4**
  - [ ]* 3.8 Escrever teste de propriedade — Propriedade 4: Bloqueio por tentativas inválidas
    - Arquivo: `tests/properties/prop-04-login-lockout.test.ts`
    - **Propriedade 4: Bloqueio após 5 tentativas consecutivas inválidas**
    - **Valida: Requisito 1.5**

- [ ] 4. Implementar SubscriptionModule — planos e limites
  - [ ] 4.1 Implementar verificação de limites por plano (users, render jobs, funcionalidades)
    - Starter: 2 users, 50 renders/mês, sem WhatsApp
    - Pro: 10 users, 300 renders/mês, com WhatsApp
    - Enterprise: ilimitado, todas as funcionalidades
    - _Requisitos: 12.1, 12.2, 12.3_
  - [ ] 4.2 Implementar lógica de trial (14 dias com permissões Pro) e acesso somente leitura pós-vencimento (7 dias)
    - Middleware que retorna 402 para escritas quando assinatura vencida
    - _Requisitos: 12.5, 12.7_
  - [ ]* 4.3 Escrever teste de propriedade — Propriedade 31: Acesso somente leitura após vencimento
    - Arquivo: `tests/properties/prop-31-readonly-after-expiry.test.ts`
    - **Propriedade 31: GET permitido, POST/PUT/DELETE retornam 402 após vencimento**
    - **Valida: Requisito 12.5**
  - [ ]* 4.4 Escrever teste de propriedade — Propriedade 32: Permissões de trial equivalentes ao Pro
    - Arquivo: `tests/properties/prop-32-trial-pro-parity.test.ts`
    - **Propriedade 32: Limites e permissões do trial idênticos ao plano Pro**
    - **Valida: Requisito 12.7**

- [ ] 5. Implementar rate limiting e API Key
  - Configurar `express-rate-limit` com Redis store, limites por plano (Starter 500/h, Pro 1000/h, Enterprise 5000/h)
  - Implementar lookup de API Key no Redis com TTL 1h
  - _Requisitos: 13.1, 13.6_
  - [ ]* 5.1 Escrever teste de propriedade — Propriedade 33: Autenticação por API Key
    - Arquivo: `tests/properties/prop-33-api-key-auth.test.ts`
    - **Propriedade 33: Requisição sem API Key válida retorna 401; com chave válida processa com tenant_id correto**
    - **Valida: Requisito 13.1**
  - [ ]* 5.2 Escrever teste de propriedade — Propriedade 36: Rate limiting por plano
    - Arquivo: `tests/properties/prop-36-rate-limiting.test.ts`
    - **Propriedade 36: Exceder limite retorna 429 com header `Retry-After`**
    - **Valida: Requisito 13.6**

- [ ] 6. Checkpoint — Fase 1
  - Garantir que todas as migrations rodam sem erro, RLS está ativo, autenticação JWT funciona end-to-end e rate limiting responde corretamente. Perguntar ao usuário se há ajustes antes de avançar.


---

## Fase 2 — Semanas 3–4: Módulos Core de Negócio

- [ ] 7. Implementar CatalogModule — produtos e categorias
  - [ ] 7.1 Implementar CRUD de produtos com geração automática de SKU
    - Formato SKU: `{categoria}-{sequencial}` quando não informado
    - Validar unicidade de SKU por tenant
    - _Requisitos: 2.1, 2.2, 2.5_
  - [ ] 7.2 Implementar upload de imagem de textura para Cloudflare R2
    - Aceitar JPEG, PNG, WebP; rejeitar outros formatos e arquivos > 10 MB
    - Gerar versão otimizada (resize/compress) para uso no AIRenderer
    - Prefixo de path: `{tenantId}/textures/{productId}/`
    - _Requisitos: 2.3, 2.4_
  - [ ] 7.3 Implementar importação em lote via CSV com relatório de erros
    - Validar campos obrigatórios, retornar relatório com linhas com erro
    - _Requisito: 2.7_
  - [ ] 7.4 Implementar lógica de produto inativo (ocultar de novos Quotes/Orders, preservar histórico)
    - _Requisito: 2.6_
  - [ ]* 7.5 Escrever teste de propriedade — Propriedade 5: Unicidade de SKU por Tenant
    - Arquivo: `tests/properties/prop-05-sku-uniqueness.test.ts`
    - **Propriedade 5: SKUs gerados automaticamente são únicos e seguem formato `{categoria}-{sequencial}`**
    - **Valida: Requisito 2.2**
  - [ ]* 7.6 Escrever teste de propriedade — Propriedade 6: Validação de formato de imagem de textura
    - Arquivo: `tests/properties/prop-06-texture-image-validation.test.ts`
    - **Propriedade 6: Formatos inválidos ou > 10 MB rejeitados; válidos geram versão otimizada**
    - **Valida: Requisitos 2.3, 2.4**
  - [ ]* 7.7 Escrever teste de propriedade — Propriedade 7: Produtos inativos excluídos de novos Quotes
    - Arquivo: `tests/properties/prop-07-inactive-product-exclusion.test.ts`
    - **Propriedade 7: Produto inativo não aparece em listagem para novos Quotes/Orders**
    - **Valida: Requisito 2.6**

- [ ] 8. Implementar StockModule — estoque e movimentações
  - [ ] 8.1 Implementar registro de movimentações de estoque (entrada, saída, ajuste, reserva, cancelamento de reserva)
    - Campos obrigatórios: `product_id`, `type`, `quantity`, `user_id`, `created_at`
    - Campo `reason` obrigatório para ajustes manuais
    - _Requisitos: 3.1, 3.4, 3.6_
  - [ ] 8.2 Implementar reserva automática de estoque ao confirmar Order e estorno ao cancelar
    - _Requisitos: 3.2, 5.5_
  - [ ] 8.3 Implementar alertas de estoque mínimo (notificação ao estoquista e admin)
    - _Requisito: 3.5_
  - [ ] 8.4 Implementar relatório de posição de estoque com valorização por custo médio
    - _Requisito: 3.7_
  - [ ]* 8.5 Escrever teste de propriedade — Propriedade 8: Round-trip de reserva e estorno de estoque
    - Arquivo: `tests/properties/prop-08-stock-reservation-roundtrip.test.ts`
    - **Propriedade 8: Saldo após reserva = S - Q; após cancelamento = S**
    - **Valida: Requisitos 3.2, 5.5**
  - [ ]* 8.6 Escrever teste de propriedade — Propriedade 9: Completude do log de movimentações
    - Arquivo: `tests/properties/prop-09-stock-movement-completeness.test.ts`
    - **Propriedade 9: Todo registro de movimentação contém `product_id`, `type`, `quantity`, `user_id`, `created_at`**
    - **Valida: Requisito 3.4**
  - [ ]* 8.7 Escrever teste de propriedade — Propriedade 10: Rejeição de ajuste sem justificativa
    - Arquivo: `tests/properties/prop-10-adjustment-requires-reason.test.ts`
    - **Propriedade 10: Ajuste manual sem `reason` é rejeitado com erro de validação**
    - **Valida: Requisito 3.6**

- [ ] 9. Implementar QuoteModule — orçamentos e cálculo de área
  - [ ] 9.1 Implementar cálculo automático de quantidade com percentual de perda
    - Fórmula: `ceil(area_m2 / product_area_m2) * (1 + waste_pct / 100)`
    - Validar `waste_pct` no intervalo [5, 20]
    - _Requisitos: 4.1, 4.2_
  - [ ] 9.2 Implementar Quote com múltiplos ambientes, subtotais e total
    - Aplicar tabela de preços vigente e descontos por volume
    - Calcular `expires_at = created_at + tenant.quote_validity_days`
    - _Requisitos: 4.3, 4.4, 4.6_
  - [ ] 9.3 Implementar geração de PDF do Quote com logo do tenant, dados do cliente e itens
    - _Requisito: 4.5_
  - [ ] 9.4 Implementar notificação de Quote expirado sem conversão (alerta ao vendedor)
    - Job agendado no BullMQ para verificar quotes expirados
    - _Requisito: 4.7_
  - [ ]* 9.5 Escrever teste de propriedade — Propriedade 11: Cálculo de quantidade com percentual de perda
    - Arquivo: `tests/properties/prop-11-waste-percentage-calculation.test.ts`
    - **Propriedade 11: `quantity = ceil(area/productArea) * (1 + waste/100)` para waste ∈ [5,20]**
    - **Valida: Requisitos 4.1, 4.2**
  - [ ]* 9.6 Escrever teste de propriedade — Propriedade 12: Consistência de subtotais do Quote
    - Arquivo: `tests/properties/prop-12-quote-subtotals-consistency.test.ts`
    - **Propriedade 12: `SUM(quote_items.subtotal) == quote.total`**
    - **Valida: Requisito 4.4**
  - [ ]* 9.7 Escrever teste de propriedade — Propriedade 13: Validade do Quote conforme configuração do Tenant
    - Arquivo: `tests/properties/prop-13-quote-expiry-date.test.ts`
    - **Propriedade 13: `expires_at == created_at + tenant.quote_validity_days`**
    - **Valida: Requisito 4.6**

- [ ] 10. Implementar OrderModule — pedidos e ciclo de vida
  - [ ] 10.1 Implementar criação de Order a partir de Quote aprovado com status inicial `awaiting_payment`
    - _Requisitos: 5.1, 5.2_
  - [ ] 10.2 Implementar máquina de estados do Order com log de transições
    - Estados: `awaiting_payment → payment_confirmed → separation → ready_for_delivery → delivered | canceled`
    - Registrar `from_status`, `to_status`, `user_id`, `created_at` em `order_status_log`
    - _Requisitos: 5.2, 5.3_
  - [ ] 10.3 Implementar geração de romaneio de entrega em PDF para Orders `ready_for_delivery`
    - _Requisito: 5.6_
  - [ ]* 10.4 Escrever teste de propriedade — Propriedade 14: Status inicial do Order ao aprovar Quote
    - Arquivo: `tests/properties/prop-14-order-initial-status.test.ts`
    - **Propriedade 14: Order criado de Quote aprovado tem status `awaiting_payment` e `quote_id` correto**
    - **Valida: Requisito 5.1**
  - [ ]* 10.5 Escrever teste de propriedade — Propriedade 15: Completude do histórico de transições de status
    - Arquivo: `tests/properties/prop-15-order-status-log-completeness.test.ts`
    - **Propriedade 15: Toda transição de status cria registro com `from_status`, `to_status`, `user_id`, `created_at`**
    - **Valida: Requisito 5.3**

- [ ] 11. Implementar CRMModule — clientes e fornecedores
  - [ ] 11.1 Implementar CRUD de Customers com validação de CPF/CNPJ e unicidade por tenant
    - _Requisitos: 6.1, 6.2_
  - [ ] 11.2 Implementar histórico de Quotes e Orders por Customer com filtros
    - _Requisito: 6.3_
  - [ ] 11.3 Implementar CRUD de Suppliers com associação a Products
    - _Requisitos: 6.4, 6.5_
  - [ ] 11.4 Implementar classificação automática de Customer inativo (sem compras em 90 dias)
    - Job agendado no BullMQ para atualizar `status = 'inactive'`
    - _Requisito: 6.6_
  - [ ] 11.5 Implementar registro de interações no histórico do Customer
    - _Requisito: 6.7_
  - [ ]* 11.6 Escrever teste de propriedade — Propriedade 16: Validação de CPF/CNPJ e unicidade por Tenant
    - Arquivo: `tests/properties/prop-16-document-validation-uniqueness.test.ts`
    - **Propriedade 16: CPF/CNPJ inválido rejeitado; documento duplicado no mesmo tenant rejeitado**
    - **Valida: Requisito 6.2**
  - [ ]* 11.7 Escrever teste de propriedade — Propriedade 17: Completude do histórico de Customer
    - Arquivo: `tests/properties/prop-17-customer-history-completeness.test.ts`
    - **Propriedade 17: Histórico retorna todos os Quotes e Orders do Customer sem omissões**
    - **Valida: Requisito 6.3**
  - [ ]* 11.8 Escrever teste de propriedade — Propriedade 18: Classificação automática de Customer inativo
    - Arquivo: `tests/properties/prop-18-customer-inactive-classification.test.ts`
    - **Propriedade 18: `last_purchase_at > 90 dias → status = inactive`; `≤ 90 dias → status = active`**
    - **Valida: Requisito 6.6**

- [ ] 12. Checkpoint — Fase 2
  - Garantir que todos os módulos core funcionam end-to-end: criar produto → gerar orçamento → confirmar pedido → reservar estoque → registrar cliente. Perguntar ao usuário se há ajustes antes de avançar.


---

## Fase 3 — Semana 5: AIRenderer + ProviderRouter com Weighted Selection

- [ ] 13. Refatorar ProviderRouter para weighted random selection
  - [ ] 13.1 Implementar tabela/estrutura de métricas históricas por provider
    - Armazenar no Redis: `provider_metrics:{providerId}` com campos `avg_latency_ms`, `success_rate`, `cost_per_render`, `last_updated`
    - Atualizar métricas após cada RenderJob concluído ou falho
    - _Requisito: 7.2, 7.9_
  - [ ] 13.2 Implementar algoritmo de weighted random selection no ProviderRouter
    - Peso de cada provider: `weight = quality_score / (cost_per_render * avg_latency_ms)`
    - Normalizar pesos para seleção probabilística (não determinística como round-robin)
    - Manter fallback para próximo provider disponível se o selecionado falhar
    - _Requisito: 7.2_
  - [ ] 13.3 Implementar health check periódico dos providers (verificar disponibilidade a cada 60s)
    - Armazenar status no Redis: `provider_status:{providerId}` com TTL 90s
    - Excluir providers indisponíveis do pool de seleção
    - _Requisitos: 7.2, 7.5_

- [ ] 14. Implementar AIRendererModule — fila e processamento assíncrono
  - [ ] 14.1 Implementar `AIRendererService.submitJob` com verificação de limite do plano
    - Upload da imagem de entrada para Cloudflare R2 com prefixo `{tenantId}/renders/input/`
    - Inserir `render_job` com status `queued` e enfileirar no BullMQ
    - Retornar `202 Accepted` com `jobId`
    - _Requisitos: 7.3, 7.6, 12.1_
  - [ ] 14.2 Implementar `RenderWorker` com integração ao ProviderRouter refatorado
    - Configurar BullMQ: 3 tentativas, backoff exponencial (5s, 10s, 20s)
    - Atualizar `render_jobs` com `provider_used`, `processing_ms`, `fidelity` após conclusão
    - Incrementar `subscriptions.render_jobs_used` após job concluído
    - _Requisitos: 7.3, 7.7, 7.9_
  - [ ] 14.3 Implementar endpoint de status do RenderJob e expiração de output em 24h
    - `GET /render-jobs/:jobId` retorna status e `output_image_url` quando concluído
    - Configurar TTL de 24h no R2 ou job de limpeza no BullMQ
    - _Requisito: 7.4_
  - [ ] 14.4 Implementar notificação ao admin quando job falha após 3 tentativas
    - _Requisito: 7.7_
  - [ ] 14.5 Implementar armazenamento de imagens renderizadas associadas a Product e Customer
    - _Requisito: 7.8_
  - [ ]* 14.6 Escrever teste de propriedade — Propriedade 19: Round-trip de RenderJob
    - Arquivo: `tests/properties/prop-19-renderjob-roundtrip.test.ts`
    - **Propriedade 19: Submissão retorna `jobId` com status `queued`; após processamento `completed` com `output_image_url`; imagem acessível por ≥ 24h**
    - **Valida: Requisitos 7.3, 7.4**
  - [ ]* 14.7 Escrever teste de propriedade — Propriedade 20: Enfileiramento quando todos os providers indisponíveis
    - Arquivo: `tests/properties/prop-20-queue-when-providers-down.test.ts`
    - **Propriedade 20: Job permanece `queued` (não `failed`) quando todos os providers estão indisponíveis**
    - **Valida: Requisito 7.5**
  - [ ]* 14.8 Escrever teste de propriedade — Propriedade 21: Limite de RenderJobs por plano
    - Arquivo: `tests/properties/prop-21-renderjob-plan-limit.test.ts`
    - **Propriedade 21: Submissão rejeitada com 429 quando `render_jobs_used >= render_jobs_limit`**
    - **Valida: Requisitos 7.6, 12.2, 12.3**
  - [ ]* 14.9 Escrever teste de propriedade — Propriedade 22: Registro de metadados de RenderJob concluído
    - Arquivo: `tests/properties/prop-22-renderjob-metadata.test.ts`
    - **Propriedade 22: `provider_used`, `processing_ms` e `fidelity` preenchidos em todo job concluído**
    - **Valida: Requisito 7.9**

- [ ] 15. Checkpoint — Fase 3
  - Garantir que o ProviderRouter com weighted selection roteia corretamente, métricas são atualizadas no Redis e RenderJobs completam o ciclo queued → processing → completed. Perguntar ao usuário se há ajustes.


---

## Fase 4 — Semana 6: Integrações Externas

- [ ] 16. Implementar WhatsApp Business Integration (Meta Cloud API)
  - [ ] 16.1 Implementar `WhatsAppService` com envio de templates e registro de histórico
    - Endpoint Meta Cloud API: `POST /v18.0/{phoneNumberId}/messages`
    - Inserir registro em `whatsapp_messages` com `status='sent'` e `meta_message_id`
    - _Requisitos: 8.1, 8.4_
  - [ ] 16.2 Implementar templates padrão por evento e configuração por tenant
    - Templates: `quote_ready`, `order_confirmed`, `order_status_update`, `delivery_confirmed`, `installation_scheduled`
    - Templates customizáveis por tenant no plano Pro+
    - _Requisitos: 8.2, 8.3, 8.6_
  - [ ] 16.3 Implementar webhook de status da Meta (atualizar `delivered_at`, detectar falhas)
    - Job BullMQ para verificar mensagens sem `delivered_at` após 24h e notificar vendedor
    - _Requisitos: 8.4, 8.5_
  - [ ] 16.4 Implementar restrição de recebimento de respostas WhatsApp por plano (Pro+ apenas)
    - _Requisito: 8.7_
  - [ ] 16.5 Integrar envio de PDF do Quote e imagem renderizada via WhatsApp
    - _Requisito: 4.8, 8.2_
  - [ ]* 16.6 Escrever teste de propriedade — Propriedade 23: Notificação WhatsApp em mudança de status do Order
    - Arquivo: `tests/properties/prop-23-whatsapp-order-status-notification.test.ts`
    - **Propriedade 23: Toda mudança de status de Order com Customer com telefone cria registro em `whatsapp_messages`**
    - **Valida: Requisito 8.3**
  - [ ]* 16.7 Escrever teste de propriedade — Propriedade 24: Registro de histórico de mensagens WhatsApp
    - Arquivo: `tests/properties/prop-24-whatsapp-message-log.test.ts`
    - **Propriedade 24: Todo envio cria registro com `tenant_id`, `to_phone`, `template`, `status`, `sent_at`**
    - **Valida: Requisito 8.4**
  - [ ]* 16.8 Escrever teste de propriedade — Propriedade 25: Templates WhatsApp restritos por plano
    - Arquivo: `tests/properties/prop-25-whatsapp-plan-restriction.test.ts`
    - **Propriedade 25: Recebimento de respostas bloqueado no Starter; habilitado no Pro/Enterprise**
    - **Valida: Requisito 8.7**

- [ ] 17. Implementar integração de pagamentos (Stripe Connect ou Pagar.me)
  - [ ] 17.1 Implementar criação de assinatura e checkout via Stripe Connect (LLC americana) ou Pagar.me (MEI)
    - Planos: Starter R$197/mês, Pro R$497/mês, Enterprise R$1.497/mês
    - Armazenar `gateway_subscription_id` em `subscriptions`
    - _Requisito: 12.4_
  - [ ] 17.2 Implementar webhook do gateway de pagamento para atualizar status da assinatura
    - Eventos: `payment_succeeded` → `active`, `payment_failed` → `past_due`, `subscription_canceled` → `canceled`
    - _Requisitos: 12.4, 12.5, 12.6_

- [ ] 18. Implementar integração NFS-e (padrão ABRASF)
  - Implementar emissão de nota fiscal de serviço via integração com prefeituras ABRASF
  - Associar NFS-e ao Order correspondente
  - _Requisito: 5.4_

- [ ] 19. Implementar API pública e Webhooks
  - [ ] 19.1 Implementar endpoints REST públicos para Products, Customers, Quotes e Orders com autenticação por API Key
    - Aplicar as mesmas validações de negócio da interface web
    - _Requisitos: 13.1, 13.2, 13.3_
  - [ ] 19.2 Implementar dispatcher de Webhooks com retry e backoff exponencial
    - Eventos: `order.created`, `order.updated`, `quote.expired`, `render_job.completed`
    - Retry com backoff exponencial por até 24h
    - _Requisitos: 13.4, 13.5_
  - [ ] 19.3 Gerar documentação OpenAPI 3.0 automaticamente (via `swagger-jsdoc` ou similar)
    - _Requisito: 13.7_
  - [ ]* 19.4 Escrever teste de propriedade — Propriedade 34: Paridade de validações entre API e interface web
    - Arquivo: `tests/properties/prop-34-api-web-validation-parity.test.ts`
    - **Propriedade 34: Mesmas regras de validação aplicadas independente da origem da requisição**
    - **Valida: Requisito 13.3**
  - [ ]* 19.5 Escrever teste de propriedade — Propriedade 35: Reenvio de Webhook com backoff exponencial
    - Arquivo: `tests/properties/prop-35-webhook-exponential-backoff.test.ts`
    - **Propriedade 35: Intervalo entre tentativas segue progressão exponencial; cessa após 24h**
    - **Valida: Requisito 13.5**

- [ ] 20. Checkpoint — Fase 4
  - Garantir que WhatsApp envia templates corretamente (mock da Meta API), pagamentos criam/atualizam assinaturas e webhooks são entregues com retry. Perguntar ao usuário se há ajustes.


---

## Fase 5 — Semana 7: Módulos Complementares

- [ ] 21. Implementar InstallationModule — agendamento e controle de obras
  - [ ] 21.1 Implementar agendamento de serviços de instalação vinculados a Orders
    - Campos: `installer_id`, `scheduled_at`, `address`, `area_m2`
    - Notificar Customer via WhatsApp ao agendar (template `installation_scheduled`)
    - _Requisitos: 9.1, 9.2_
  - [ ] 21.2 Implementar upload de fotos antes/depois da instalação para Cloudflare R2
    - _Requisito: 9.3_
  - [ ] 21.3 Implementar conclusão de serviço: atualizar Order para `delivered` e solicitar avaliação
    - _Requisito: 9.4_
  - [ ] 21.4 Implementar cálculo de custo de mão de obra (`area_m2 * tenant.labor_price_per_m2`)
    - _Requisito: 9.5_
  - [ ] 21.5 Implementar relatório mensal de produtividade por instalador
    - _Requisito: 9.6_
  - [ ]* 21.6 Escrever teste de propriedade — Propriedade 26: Cálculo de custo de mão de obra
    - Arquivo: `tests/properties/prop-26-labor-cost-calculation.test.ts`
    - **Propriedade 26: `labor_cost = area_m2 * tenant.labor_price_per_m2`**
    - **Valida: Requisito 9.5**

- [ ] 22. Implementar FinancialModule — contas a pagar/receber e DRE
  - [ ] 22.1 Implementar criação automática de conta a receber ao confirmar Order
    - Calcular margem de contribuição: `order.total - SUM(item.quantity * product.cost_price)`
    - _Requisitos: 10.1, 10.6_
  - [ ] 22.2 Implementar registro de contas a pagar vinculadas a Suppliers
    - _Requisito: 10.2_
  - [ ] 22.3 Implementar registro de pagamento e atualização de saldo de caixa
    - _Requisito: 10.3_
  - [ ] 22.4 Implementar relatório de fluxo de caixa (diário, semanal, mensal) com saldo projetado
    - _Requisito: 10.4_
  - [ ] 22.5 Implementar notificação de conta a receber vencida sem pagamento
    - Job BullMQ diário para verificar vencimentos
    - _Requisito: 10.5_
  - [ ] 22.6 Implementar DRE simplificado mensal (receita bruta, CMV, margem bruta, resultado operacional)
    - _Requisito: 10.7_
  - [ ]* 22.7 Escrever teste de propriedade — Propriedade 27: Round-trip financeiro
    - Arquivo: `tests/properties/prop-27-financial-roundtrip.test.ts`
    - **Propriedade 27: Order confirmado cria `receivable` com `amount = order.total`; pagamento aumenta saldo em V**
    - **Valida: Requisitos 10.1, 10.3**
  - [ ]* 22.8 Escrever teste de propriedade — Propriedade 28: Consistência do fluxo de caixa projetado
    - Arquivo: `tests/properties/prop-28-cashflow-consistency.test.ts`
    - **Propriedade 28: `saldo_projetado = SUM(entradas) - SUM(saídas)` para qualquer período**
    - **Valida: Requisito 10.4**
  - [ ]* 22.9 Escrever teste de propriedade — Propriedade 29: Margem de contribuição por Order
    - Arquivo: `tests/properties/prop-29-contribution-margin.test.ts`
    - **Propriedade 29: `margem = order.total - SUM(item.quantity * product.cost_price)`**
    - **Valida: Requisito 10.6**

- [ ] 23. Implementar ReportModule e Dashboard
  - [ ] 23.1 Implementar Dashboard com métricas em tempo real (latência máx. 5 min via cache Redis)
    - Métricas: faturamento do mês, número de Orders, ticket médio, produtos mais vendidos, clientes mais ativos
    - Background refresh a cada 5 min no Redis
    - _Requisitos: 11.1, 11.2_
  - [ ] 23.2 Implementar relatórios de vendas (por período, vendedor, categoria, cliente)
    - _Requisito: 11.3_
  - [ ] 23.3 Implementar relatório de giro de estoque (produtos sem movimentação em 60 dias)
    - _Requisito: 11.4_
  - [ ] 23.4 Implementar exportação de relatórios em CSV/XLSX restrita ao plano Pro+
    - _Requisito: 11.5_
  - [ ] 23.5 Implementar histórico de relatórios gerados (retenção de 12 meses)
    - _Requisito: 11.6_
  - [ ]* 23.6 Escrever teste de propriedade — Propriedade 30: Exportação de relatórios restrita por plano
    - Arquivo: `tests/properties/prop-30-report-export-plan-restriction.test.ts`
    - **Propriedade 30: Starter recebe 403 em endpoints de exportação; Pro/Enterprise recebem dados**
    - **Valida: Requisito 11.5**

- [ ] 24. Checkpoint — Fase 5
  - Garantir que módulos financeiro, instalação e relatórios funcionam corretamente e dashboard exibe dados com latência ≤ 5 min. Perguntar ao usuário se há ajustes.


---

## Fase 6 — Semana 8: Testes PBT, OpenAPI, Landing Page e Lançamento

- [ ] 25. Completar suite de testes PBT — propriedades restantes
  - [ ]* 25.1 Escrever testes de propriedade restantes do SubscriptionModule
    - Arquivo: `tests/properties/prop-31-readonly-after-expiry.test.ts` (se não criado na Fase 1)
    - Arquivo: `tests/properties/prop-32-trial-pro-parity.test.ts` (se não criado na Fase 1)
    - **Propriedades 31 e 32 — Valida: Requisitos 12.5, 12.7**
  - [ ]* 25.2 Verificar cobertura mínima por módulo conforme tabela do design
    - TenantModule ≥ 90%, StockModule ≥ 90%, QuoteModule ≥ 90%, OrderModule ≥ 90%
    - FinancialModule ≥ 90%, SubscriptionModule ≥ 90%
    - CatalogModule ≥ 85%, CRMModule ≥ 85%, AIRendererModule ≥ 85%, API Pública ≥ 85%
    - WhatsAppService ≥ 80%, InstallationModule ≥ 80%
  - [ ]* 25.3 Garantir que todos os 36 arquivos de propriedade existem em `tests/properties/`
    - Cada arquivo deve conter o comentário de tag: `// Feature: pisosrealview-saas-analysis, Property N: <texto>`
    - Mínimo de 100 iterações por propriedade (`numRuns: 100`)

- [ ] 26. Finalizar documentação OpenAPI 3.0
  - Garantir que todos os endpoints públicos (Products, Customers, Quotes, Orders, RenderJobs, Webhooks) estão documentados
  - Configurar geração automática a cada deploy via CI
  - _Requisito: 13.7_

- [ ] 27. Implementar frontend React — telas essenciais para lançamento
  - [ ] 27.1 Implementar telas de autenticação (login, convite, ativação de conta)
    - _Requisitos: 1.4, 1.6_
  - [ ] 27.2 Implementar telas de catálogo de produtos e upload de textura
    - _Requisito: 2.1, 2.3_
  - [ ] 27.3 Implementar tela de geração de orçamento com cálculo de área e visualização IA
    - Integrar com `POST /render-jobs` e polling de status
    - _Requisitos: 4.1, 7.1_
  - [ ] 27.4 Implementar telas de pedidos, clientes e dashboard gerencial
    - _Requisitos: 5.1, 6.1, 11.1_

- [ ] 28. Configurar landing page de lançamento
  - Criar landing page com proposta de valor, planos (Starter R$197, Pro R$497, Enterprise R$1.497) e CTA de trial gratuito de 14 dias
  - Integrar formulário de cadastro com `POST /tenants`

- [ ] 29. Checkpoint final — Lançamento
  - Garantir que todos os testes passam (`vitest --run`), documentação OpenAPI está acessível, landing page está no ar e fluxo completo (cadastro → trial → orçamento com IA → pedido → pagamento) funciona end-to-end. Perguntar ao usuário se há ajustes antes do go-live.

---

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Os 36 arquivos de propriedade PBT ficam em `tests/properties/prop-{NN}-{slug}.test.ts`
- O ProviderRouter usa weighted random selection baseado em `quality_score / (cost * latency)` — não round-robin
- Infraestrutura: Supabase (PostgreSQL + RLS), Upstash Redis, Cloudflare R2
- Pagamentos: Stripe Connect (LLC americana) ou Pagar.me (MEI) — decidir antes da Fase 4
