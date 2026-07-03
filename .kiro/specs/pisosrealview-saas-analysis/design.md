    # Design Técnico — PisosRealView Pro SaaS

    ## Visão Geral

    O PisosRealView Pro é um SaaS B2B multi-tenant para o setor de revestimentos de piso. A plataforma combina gestão comercial completa (produtos, estoque, orçamentos, pedidos, financeiro, instalação) com um módulo de visualização de pisos via IA, usando o `ProviderRouter` existente como núcleo do serviço de renderização.

    O MVP de 90 dias adota uma arquitetura de **monolito modular** — um único processo Node.js/TypeScript organizado em módulos coesos com fronteiras bem definidas. Essa escolha reduz a complexidade operacional inicial sem sacrificar a capacidade de extrair microserviços futuramente. O único componente que roda separado é a **fila de RenderJobs**, que exige processamento assíncrono e isolamento de falhas.

    ### Decisões Arquiteturais Principais

    - **Monolito modular** em vez de microserviços: menor overhead operacional no MVP, fronteiras de módulo preservam a capacidade de extração futura.
    - **Multi-tenancy por Row-Level Security (RLS)**: todos os dados compartilham o mesmo banco PostgreSQL, com `tenant_id` em todas as tabelas e políticas RLS garantindo isolamento. Mais simples que bancos separados por tenant no MVP.
    - **Fila assíncrona com BullMQ + Redis**: RenderJobs são processados fora do ciclo request/response, com retry automático e visibilidade de estado.
    - **JWT stateless** com refresh token em Redis: permite revogação sem estado no servidor principal.

    ---

    ## Arquitetura

    ### Diagrama de Alto Nível

    ```mermaid
    graph TB
        subgraph Clientes
            WEB[React Frontend]
            MOB[WhatsApp Business]
            EXT[API Externa / ERP]
        end

        subgraph "API Gateway (Express)"
            AUTH[Auth Middleware\nJWT + API Key]
            RATE[Rate Limiter\nper Tenant]
            ROUTER[Route Dispatcher]
        end

        subgraph "Módulos de Negócio"
            TENANT[TenantModule]
            CATALOG[CatalogModule]
            STOCK[StockModule]
            QUOTE[QuoteModule]
            ORDER[OrderModule]
            CRM[CRMModule]
            FINANCIAL[FinancialModule]
            INSTALL[InstallationModule]
            SUBSCRIPTION[SubscriptionModule]
            REPORT[ReportModule]
        end

        subgraph "Módulo de IA"
            AIREN[AIRendererModule]
            QUEUE[BullMQ Queue\nrender-jobs]
            WORKER[RenderWorker]
            PROV[ProviderRouter\nexistente]
        end

        subgraph "Integrações Externas"
            WA[Meta Cloud API\nWhatsApp Business]
            PAY[Stripe / Pagar.me]
            NFS[NFS-e ABRASF]
            S3[Object Storage\nS3 / R2]
        end

        subgraph "Infraestrutura"
            PG[(PostgreSQL\n+ RLS)]
            REDIS[(Redis\nCache + Filas)]
        end

        WEB --> AUTH
        MOB --> AUTH
        EXT --> AUTH
        AUTH --> RATE --> ROUTER
        ROUTER --> TENANT & CATALOG & STOCK & QUOTE & ORDER & CRM & FINANCIAL & INSTALL & SUBSCRIPTION & REPORT
        ROUTER --> AIREN
        AIREN --> QUEUE --> WORKER --> PROV
        PROV --> S3
        ORDER --> WA
        QUOTE --> WA
        SUBSCRIPTION --> PAY
        ORDER --> NFS
        TENANT & CATALOG & STOCK & QUOTE & ORDER & CRM & FINANCIAL & INSTALL & SUBSCRIPTION & REPORT --> PG
        AIREN & QUEUE & WORKER --> REDIS
        AUTH --> REDIS
    ```

    ### Estrutura de Diretórios

    ```
    backend/
    ├── src/
    │   ├── app.ts                    # Bootstrap Express
    │   ├── modules/
    │   │   ├── tenant/               # Multi-tenancy, auth, users
    │   │   ├── catalog/              # Products, categorias, SKU
    │   │   ├── stock/                # Estoque, movimentações
    │   │   ├── quote/                # Orçamentos, cálculo de área
    │   │   ├── order/                # Pedidos, status, romaneio
    │   │   ├── crm/                  # Customers, Suppliers, interações
    │   │   ├── financial/            # Contas a pagar/receber, DRE
    │   │   ├── installation/         # Agendamentos, fotos, produtividade
    │   │   ├── subscription/         # Planos, limites, pagamentos
    │   │   ├── report/               # Relatórios gerenciais, dashboard
    │   │   └── ai-renderer/          # RenderJobs, fila, integração ProviderRouter
    │   ├── services/
    │   │   ├── gateway/              # ProviderRouter existente (mantido)
    │   │   ├── whatsapp/             # Meta Cloud API client
    │   │   ├── storage/              # Upload S3/R2
    │   │   └── webhook/              # Dispatcher de webhooks
    │   ├── middleware/
    │   │   ├── auth.ts               # JWT + API Key
    │   │   ├── tenant.ts             # Injeção de tenant_id no contexto
    │   │   └── rateLimiter.ts        # Rate limiting por tenant/plano
    │   └── db/
    │       ├── migrations/           # Knex migrations
    │       └── rls.sql               # Políticas RLS PostgreSQL
    ```

    ---

    ## Componentes e Interfaces

    ### Middleware de Tenant

    Todo request passa pelo middleware de tenant antes de chegar aos módulos de negócio. Ele extrai o `tenant_id` do JWT ou da API Key e injeta no contexto do request, além de configurar o `SET app.current_tenant_id` no PostgreSQL para ativar as políticas RLS.

    ```typescript
    // middleware/tenant.ts
    export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.auth?.tenantId ?? req.apiKey?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'tenant_required' });
    
    req.tenantId = tenantId;
    // Ativa RLS para a conexão atual
    await db.raw('SET app.current_tenant_id = ?', [tenantId]);
    next();
    }
    ```

    ### AIRendererModule

    Responsável por receber requisições de renderização, criar RenderJobs, enfileirar no BullMQ e expor endpoints de status/resultado. Integra com o `ProviderRouter` existente sem modificá-lo.

    ```typescript
    // modules/ai-renderer/AIRendererService.ts
    export class AIRendererService {
    constructor(
        private queue: Queue,           // BullMQ Queue 'render-jobs'
        private storage: StorageService,
        private db: Knex,
    ) {}

    async submitJob(tenantId: string, input: RenderJobInput): Promise<{ jobId: string }> {
        // Verifica limite do plano
        await this.checkPlanLimit(tenantId);
        
        const job = await this.db('render_jobs').insert({
        tenant_id: tenantId,
        product_id: input.productId,
        customer_id: input.customerId,
        status: 'queued',
        input_image_url: await this.storage.upload(input.imageBase64),
        }).returning('id');

        await this.queue.add('render', { jobId: job[0].id, tenantId, input });
        return { jobId: job[0].id };
    }

    async getJobStatus(tenantId: string, jobId: string): Promise<RenderJob> {
        return this.db('render_jobs')
        .where({ id: jobId, tenant_id: tenantId })
        .first();
    }
    }
    ```

    ### RenderWorker

    Processa jobs da fila BullMQ, chama o `ProviderRouter` existente e atualiza o status do job. Implementa retry automático (máx. 3 tentativas) com notificação ao administrador em caso de falha definitiva.

    ```typescript
    // modules/ai-renderer/RenderWorker.ts
    export class RenderWorker {
    constructor(
        private router: ProviderRouter,  // instância existente
        private storage: StorageService,
        private notifier: NotificationService,
    ) {}

    async process(job: Job<RenderJobPayload>): Promise<void> {
        const { jobId, tenantId, input } = job.data;
        
        try {
        const result = await this.router.route(input.imageBase64, input.material, input.context);
        
        if (result.success) {
            const outputUrl = await this.storage.upload(result.editedImageBase64);
            await this.updateJob(jobId, 'completed', {
            output_image_url: outputUrl,
            provider_used: result.provider,
            processing_ms: Date.now() - job.timestamp,
            fidelity: result.fidelity,
            });
            await this.notifier.notifyJobComplete(tenantId, jobId, outputUrl);
        }
        } catch (err) {
        if (job.attemptsMade >= 2) { // 3ª tentativa (0-indexed)
            await this.updateJob(jobId, 'failed', { error: err.message });
            await this.notifier.notifyAdminJobFailed(tenantId, jobId, err);
        }
        throw err; // BullMQ faz retry automático
        }
    }
    }
    ```

    ### WhatsApp Service

    Wrapper sobre a Meta Cloud API com suporte a templates configuráveis por tenant e registro de histórico de mensagens.

    ```typescript
    // services/whatsapp/WhatsAppService.ts
    export class WhatsAppService {
    async sendTemplate(tenantId: string, to: string, templateName: string, params: Record<string, string>): Promise<void> {
        const template = await this.getTemplate(tenantId, templateName);
        const response = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: { name: template.name, language: { code: 'pt_BR' }, components: this.buildComponents(template, params) },
        }),
        });
        await this.logMessage(tenantId, to, templateName, response.ok ? 'sent' : 'failed');
    }
    }
    ```

    ---

    ## Modelos de Dados

    Todos os modelos incluem `tenant_id UUID NOT NULL` e são protegidos por políticas RLS no PostgreSQL.

    ### Diagrama ER Simplificado

    ```mermaid
    erDiagram
        TENANT ||--o{ USER : "possui"
        TENANT ||--o{ PRODUCT : "cataloga"
        TENANT ||--o{ CUSTOMER : "atende"
        TENANT ||--o{ SUPPLIER : "compra de"
        TENANT ||--|| SUBSCRIPTION : "assina"

        PRODUCT ||--o{ STOCK_MOVEMENT : "movimenta"
        PRODUCT }o--|| SUPPLIER : "fornecido por"
        PRODUCT ||--o{ RENDER_JOB : "renderizado em"

        CUSTOMER ||--o{ QUOTE : "recebe"
        CUSTOMER ||--o{ RENDER_JOB : "solicita"
        QUOTE ||--o{ QUOTE_ITEM : "contém"
        QUOTE ||--o| ORDER : "converte em"

        ORDER ||--o{ ORDER_STATUS_LOG : "registra"
        ORDER ||--o{ FINANCIAL_ENTRY : "gera"
        ORDER ||--o| INSTALLATION_JOB : "agenda"

        RENDER_JOB }o--|| PRODUCT : "usa textura de"
        RENDER_JOB }o--|| CUSTOMER : "pertence a"
    ```

    ### Definições de Tabelas

    ```sql
    -- Tenant
    CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj        VARCHAR(18) NOT NULL UNIQUE,
    razao_social VARCHAR(200) NOT NULL,
    email       VARCHAR(200) NOT NULL,
    plan_id     VARCHAR(20) NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
    status      VARCHAR(20) NOT NULL DEFAULT 'trial',   -- trial | active | readonly | suspended
    trial_ends_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- User
    CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    email       VARCHAR(200) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    role        VARCHAR(20) NOT NULL, -- admin | seller | stockist | installer
    status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | active | blocked
    failed_logins INT NOT NULL DEFAULT 0,
    blocked_until TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
    );

    -- Product
    CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    sku         VARCHAR(50) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    category    VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    dimensions  VARCHAR(50),           -- ex: "60x60cm"
    finish      VARCHAR(100),
    color       VARCHAR(100),
    manufacturer VARCHAR(200),
    cost_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
    sale_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
    texture_url VARCHAR(500),          -- URL da imagem original
    texture_optimized_url VARCHAR(500),-- URL da versão otimizada para IA
    supplier_id UUID REFERENCES suppliers(id),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
    );

    -- Stock
    CREATE TABLE stock_movements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    product_id  UUID NOT NULL REFERENCES products(id),
    location    VARCHAR(100) NOT NULL DEFAULT 'principal',
    type        VARCHAR(20) NOT NULL, -- entry | exit | adjustment | reservation | reservation_cancel
    quantity    NUMERIC(12,3) NOT NULL,
    reason      TEXT,                 -- obrigatório para adjustments
    order_id    UUID REFERENCES orders(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- View de saldo atual (calculada via SUM das movimentações)
    CREATE VIEW stock_balance AS
    SELECT tenant_id, product_id, location,
            SUM(CASE WHEN type IN ('entry') THEN quantity
                    WHEN type IN ('exit', 'reservation') THEN -quantity
                    WHEN type = 'reservation_cancel' THEN quantity
                    ELSE quantity END) AS available
    FROM stock_movements
    GROUP BY tenant_id, product_id, location;

    -- Customer
    CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    document    VARCHAR(18) NOT NULL,  -- CPF ou CNPJ
    name        VARCHAR(200) NOT NULL,
    email       VARCHAR(200),
    phone       VARCHAR(20),
    address     JSONB,
    status      VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
    last_purchase_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, document)
    );

    -- Supplier
    CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    cnpj        VARCHAR(18) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    contacts    JSONB,
    lead_time_days INT,
    payment_terms TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, cnpj)
    );

    -- Quote
    CREATE TABLE quotes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    seller_id   UUID NOT NULL REFERENCES users(id),
    status      VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | sent | approved | expired | converted
    total       NUMERIC(12,2) NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    pdf_url     VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE quote_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id    UUID NOT NULL REFERENCES quotes(id),
    product_id  UUID NOT NULL REFERENCES products(id),
    room_name   VARCHAR(100),
    area_m2     NUMERIC(8,2) NOT NULL,
    waste_pct   NUMERIC(5,2) NOT NULL DEFAULT 10,
    quantity    NUMERIC(10,3) NOT NULL,
    unit_price  NUMERIC(12,2) NOT NULL,
    subtotal    NUMERIC(12,2) NOT NULL
    );

    -- Order
    CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    quote_id    UUID REFERENCES quotes(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status      VARCHAR(30) NOT NULL DEFAULT 'awaiting_payment',
    total       NUMERIC(12,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE order_status_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id),
    from_status VARCHAR(30),
    to_status   VARCHAR(30) NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- RenderJob
    CREATE TABLE render_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    customer_id     UUID REFERENCES customers(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued | processing | completed | failed
    input_image_url VARCHAR(500) NOT NULL,
    output_image_url VARCHAR(500),
    provider_used   VARCHAR(50),
    processing_ms   INT,
    fidelity        NUMERIC(4,3),
    error_message   TEXT,
    attempts        INT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ,  -- output disponível por 24h
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Financial
    CREATE TABLE financial_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    type        VARCHAR(10) NOT NULL, -- receivable | payable
    order_id    UUID REFERENCES orders(id),
    supplier_id UUID REFERENCES suppliers(id),
    description TEXT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    due_date    DATE NOT NULL,
    paid_at     TIMESTAMPTZ,
    paid_amount NUMERIC(12,2),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Subscription
    CREATE TABLE subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL UNIQUE REFERENCES tenants(id),
    plan        VARCHAR(20) NOT NULL, -- starter | pro | enterprise
    status      VARCHAR(20) NOT NULL, -- active | past_due | canceled
    render_jobs_used INT NOT NULL DEFAULT 0,
    render_jobs_limit INT NOT NULL,
    current_period_start DATE NOT NULL,
    current_period_end   DATE NOT NULL,
    gateway_subscription_id VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- WhatsApp Message Log
    CREATE TABLE whatsapp_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID REFERENCES customers(id),
    order_id    UUID REFERENCES orders(id),
    to_phone    VARCHAR(20) NOT NULL,
    template    VARCHAR(100) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent | delivered | failed
    meta_message_id VARCHAR(200),
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
    );

    -- Installation Job
    CREATE TABLE installation_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    order_id    UUID NOT NULL REFERENCES orders(id),
    installer_id UUID NOT NULL REFERENCES users(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    address     JSONB NOT NULL,
    area_m2     NUMERIC(8,2),
    labor_cost  NUMERIC(12,2),
    status      VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled | in_progress | completed
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```

    ---

    ## Design do AIRenderer e Integração com ProviderRouter

    ### Fluxo de Renderização Assíncrona

    ```mermaid
    sequenceDiagram
        participant C as Cliente (React/API)
        participant API as API Server
        participant DB as PostgreSQL
        participant Q as BullMQ (Redis)
        participant W as RenderWorker
        participant PR as ProviderRouter
        participant S3 as Object Storage

        C->>API: POST /render-jobs {imageBase64, productId, customerId}
        API->>API: Verifica limite do plano (subscription)
        API->>S3: Upload imagem de entrada
        API->>DB: INSERT render_jobs (status=queued)
        API->>Q: queue.add('render', {jobId, tenantId, ...})
        API-->>C: 202 Accepted {jobId}

        loop Polling ou Webhook
            C->>API: GET /render-jobs/{jobId}
            API-->>C: {status: "queued"|"processing"|"completed"}
        end

        W->>Q: job.process()
        W->>DB: UPDATE render_jobs SET status='processing'
        W->>PR: router.route(imageBase64, material, context)
        PR->>PR: estimateDifficulty() → seleciona provider
        PR-->>W: {success, editedImageBase64, provider, fidelity}
        W->>S3: Upload imagem resultante (TTL 24h)
        W->>DB: UPDATE render_jobs SET status='completed', output_image_url, provider_used, processing_ms
        W->>DB: UPDATE subscriptions SET render_jobs_used += 1
        W->>C: Webhook POST /webhooks/render-complete (se configurado)
    ```

    ### Integração com ProviderRouter Existente

    O `ProviderRouter` existente é usado **sem modificações**. O `RenderWorker` instancia o router e chama `router.route()` passando os parâmetros necessários. A única adição é o registro de métricas no banco após cada job.

    ```typescript
    // modules/ai-renderer/RenderWorker.ts
    import { ProviderRouter } from '../../services/gateway/ProviderRouter.js';
    import { buildProviders } from '../../services/gateway/providers/index.js';

    // Router é singleton por worker process
    const router = new ProviderRouter(buildProviders());

    export async function processRenderJob(job: Job<RenderJobPayload>) {
    const imageBase64 = await storage.download(job.data.inputImageUrl);
    const material = await db('products').where({ id: job.data.productId }).first();
    
    const result = await router.route(imageBase64, {
        type: material.category,
        color: material.color,
        dimensions: material.dimensions,
    }, job.data.context);

    // Persiste métricas (Requisito 7.9)
    await db('render_jobs').where({ id: job.data.jobId }).update({
        provider_used: result.provider,
        processing_ms: Date.now() - job.timestamp,
        fidelity: result.fidelity,
        status: result.success ? 'completed' : 'failed',
    });
    }
    ```

    ### Estratégia de Filas BullMQ

    ```typescript
    // Configuração da fila
    const renderQueue = new Queue('render-jobs', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s
        removeOnComplete: { age: 86400 },  // mantém por 24h
        removeOnFail: { age: 604800 },     // mantém falhas por 7 dias
    },
    });

    // Worker com concorrência configurável por plano
    const worker = new Worker('render-jobs', processRenderJob, {
    connection: redisConnection,
    concurrency: parseInt(process.env.RENDER_WORKER_CONCURRENCY || '3'),
    });
    ```

    **Limites por plano** são verificados antes de enfileirar (no `AIRendererService.submitJob`), não no worker. Isso evita jobs enfileirados que seriam rejeitados ao processar.

    ---

    ## Segurança

    ### Autenticação e Autorização

    ```mermaid
    flowchart LR
        REQ[Request] --> A{Tipo de auth}
        A -->|Bearer JWT| B[Verifica assinatura\nHS256 + secret]
        A -->|X-API-Key| C[Lookup no Redis\napi_keys:hash]
        B --> D{JWT válido?}
        C --> E{API Key válida?}
        D -->|sim| F[Extrai tenant_id + role]
        E -->|sim| F
        D -->|não| G[401 Unauthorized]
        E -->|não| G
        F --> H[SET app.current_tenant_id\nno PostgreSQL]
        H --> I[RLS ativo para a conexão]
    ```

    **JWT Claims:**
    ```json
    {
    "sub": "user-uuid",
    "tenantId": "tenant-uuid",
    "role": "admin|seller|stockist|installer",
    "exp": 1234567890,
    "iat": 1234567890
    }
    ```

    **Refresh Token:** armazenado no Redis com chave `refresh:{userId}:{tokenHash}`, TTL de 30 dias. Permite revogação imediata sem invalidar todos os tokens.

    ### Row-Level Security (PostgreSQL)

    ```sql
    -- Habilita RLS em todas as tabelas de negócio
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    -- (repetir para todas as tabelas)

    -- Política padrão: tenant só vê seus próprios dados
    CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

    -- Usuário de aplicação não tem acesso sem o setting configurado
    REVOKE ALL ON products FROM app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON products TO app_user;
    ```

    ### Rate Limiting

    Implementado com `express-rate-limit` + Redis store, com limites por tenant e por plano:

    | Plano      | API pública (req/hora) | Endpoints de render (req/min) |
    |------------|------------------------|-------------------------------|
    | Starter    | 500                    | 5                             |
    | Pro        | 1.000                  | 20                            |
    | Enterprise | 5.000                  | 100                           |

    Respostas com limite excedido retornam `429 Too Many Requests` com header `Retry-After`.

    ### Isolamento de Dados por Tenant

    - Todas as queries passam pelo middleware de tenant que configura `app.current_tenant_id`
    - RLS no PostgreSQL garante que queries sem o setting configurado retornam zero linhas
    - Uploads de arquivos usam prefixo `{tenantId}/` no object storage
    - Logs de auditoria registram `tenant_id` em todas as entradas
    - Tentativas de acesso cross-tenant são registradas com IP, user-agent e endpoint

    ---

    ## Integração WhatsApp Business (Meta Cloud API)

    ### Fluxo de Envio

    ```mermaid
    sequenceDiagram
        participant SVC as Serviço de Negócio
        participant WA as WhatsAppService
        participant META as Meta Cloud API
        participant DB as PostgreSQL

        SVC->>WA: sendTemplate(tenantId, phone, 'quote_ready', {quoteId, pdfUrl})
        WA->>DB: SELECT template WHERE tenant_id AND name='quote_ready'
        WA->>META: POST /v18.0/{phoneNumberId}/messages
        META-->>WA: {messages: [{id: "wamid.xxx"}]}
        WA->>DB: INSERT whatsapp_messages (status='sent', meta_message_id)
        
        META->>WA: Webhook POST /webhooks/whatsapp (status update)
        WA->>DB: UPDATE whatsapp_messages SET status='delivered', delivered_at
    ```

    ### Templates Padrão por Evento

    | Evento | Template | Variáveis |
    |--------|----------|-----------|
    | Quote gerado | `quote_ready` | `{{customer_name}}`, `{{quote_id}}`, `{{total}}`, `{{expires_at}}` |
    | Order confirmado | `order_confirmed` | `{{order_id}}`, `{{total}}` |
    | Status atualizado | `order_status_update` | `{{order_id}}`, `{{status}}` |
    | Entrega confirmada | `delivery_confirmed` | `{{order_id}}`, `{{installer_name}}` |
    | Instalação agendada | `installation_scheduled` | `{{date}}`, `{{time}}`, `{{installer_name}}` |

    Templates são pré-aprovados na Meta e configuráveis por tenant (nome do template pode ser customizado no Plan Pro+).

    ---

    ## Módulo Financeiro

    ### Fluxo de Contas a Receber

    Quando um Order é confirmado, o `FinancialModule` cria automaticamente uma `financial_entry` do tipo `receivable`. O cálculo de margem de contribuição é feito no momento da criação do order:

    ```typescript
    // modules/financial/FinancialService.ts
    async function onOrderConfirmed(order: Order, items: OrderItem[]) {
    const costTotal = items.reduce((sum, i) => sum + i.quantity * i.product.cost_price, 0);
    const margin = order.total - costTotal;
    
    await db('financial_entries').insert({
        tenant_id: order.tenant_id,
        type: 'receivable',
        order_id: order.id,
        description: `Pedido #${order.id}`,
        amount: order.total,
        due_date: calculateDueDate(order),
        contribution_margin: margin,
    });
    }
    ```

    ### DRE Simplificado

    O relatório DRE é calculado sob demanda agregando as `financial_entries` do período:

    ```
    Receita Bruta          = SUM(receivable.amount WHERE paid_at IN período)
    (-) Custo de Mercadoria = SUM(order_items.quantity * product.cost_price)
    (=) Margem Bruta
    (-) Despesas Operacionais = SUM(payable.amount WHERE due_date IN período)
    (=) Resultado Operacional
    ```

    ---

    ## Escalabilidade e Infraestrutura

    ### Topologia de Deploy (MVP)

    ```
                        ┌─────────────────┐
                        │   Load Balancer │
                        │   (Nginx/ALB)   │
                        └────────┬────────┘
                                │
                ┌──────────────┼──────────────┐
                │              │              │
            ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼──────┐
            │  API Node │  │  API Node │  │ API Node  │
            │  (2 vCPU) │  │  (2 vCPU) │  │ (2 vCPU)  │
            └─────┬─────┘  └─────┬─────┘  └────┬──────┘
                └──────────────┼──────────────┘
                                │
                ┌──────────────┼──────────────┐
                │              │              │
            ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼──────┐
            │  Render   │  │  Render   │  │PostgreSQL │
            │  Worker   │  │  Worker   │  │(Primary + │
            │  (4 vCPU) │  │  (4 vCPU) │  │ Replica)  │
            └─────┬─────┘  └─────┬─────┘  └───────────┘
                └──────────────┤
                            ┌────▼────┐
                            │  Redis  │
                            │(Cluster)│
                            └─────────┘
    ```

    ### Estratégia de Escalonamento

    - **API Nodes**: escalonamento horizontal stateless. Sessões em Redis, sem estado local.
    - **RenderWorkers**: escalonamento independente dos API nodes. Workers são os únicos que chamam o `ProviderRouter` e consomem créditos de IA.
    - **PostgreSQL**: réplica de leitura para relatórios e dashboard, evitando contenção com transações de escrita.
    - **Redis**: usado para cache de sessões JWT, filas BullMQ, rate limiting e cache de configurações de tenant.

    ### Estratégia de Cache

    | Dado | TTL | Estratégia |
    |------|-----|------------|
    | Configurações do tenant | 5 min | Cache-aside no Redis |
    | Saldo de estoque | 30s | Invalidação por evento |
    | Tabela de preços vigente | 5 min | Cache-aside |
    | Métricas do dashboard | 5 min | Background refresh |
    | API Key lookup | 1h | Cache-aside |

    ---

    ## Propriedades de Corretude

    *Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas do sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

    ### Propriedade 1: Isolamento de dados entre Tenants

    *Para qualquer* par de tenants distintos (A e B), nenhuma consulta autenticada com o token do tenant A deve retornar dados pertencentes ao tenant B, independentemente do recurso consultado (produtos, clientes, pedidos, render jobs, etc.).

    **Valida: Requisitos 1.1, 1.2, 1.7**

    ---

    ### Propriedade 2: Controle de acesso por perfil

    *Para qualquer* usuário com um perfil definido (Administrador, Vendedor, Estoquista, Instalador), uma requisição a um endpoint fora das permissões do seu perfil deve ser rejeitada com status 403.

    **Valida: Requisito 1.3**

    ---

    ### Propriedade 3: Validade do token JWT

    *Para qualquer* usuário que realiza login com credenciais válidas, o token JWT emitido deve ter campo `exp` igual a `iat + 28800` (8 horas em segundos).

    **Valida: Requisito 1.4**

    ---

    ### Propriedade 4: Bloqueio por tentativas inválidas

    *Para qualquer* conta de usuário, após exatamente 5 tentativas consecutivas de login com credenciais inválidas, a conta deve ser bloqueada e tentativas subsequentes devem ser rejeitadas com status 423 até que o período de 15 minutos expire.

    **Valida: Requisito 1.5**

    ---

    ### Propriedade 5: Unicidade de SKU por Tenant

    *Para qualquer* conjunto de produtos cadastrados sem SKU explícito dentro de um mesmo tenant, todos os SKUs gerados automaticamente devem ser únicos e seguir o formato `{categoria}-{sequencial}`.

    **Valida: Requisito 2.2**

    ---

    ### Propriedade 6: Validação de formato de imagem de textura

    *Para qualquer* arquivo enviado como imagem de textura, arquivos com formato diferente de JPEG, PNG ou WebP, ou com tamanho superior a 10 MB, devem ser rejeitados com erro de validação; arquivos válidos devem ser aceitos e gerar uma versão otimizada.

    **Valida: Requisitos 2.3, 2.4**

    ---

    ### Propriedade 7: Produtos inativos excluídos de novos Quotes

    *Para qualquer* produto marcado como inativo, ele não deve aparecer na listagem de produtos disponíveis para criação de novos Quotes ou Orders, mas deve continuar presente no histórico de Quotes e Orders anteriores.

    **Valida: Requisito 2.6**

    ---

    ### Propriedade 8: Round-trip de reserva e estorno de estoque

    *Para qualquer* produto com saldo S, após a confirmação de um Order que reserva quantidade Q, o saldo disponível deve ser S - Q. Após o cancelamento desse mesmo Order, o saldo deve retornar a S.

    **Valida: Requisitos 3.2, 5.5**

    ---

    ### Propriedade 9: Completude do log de movimentações de estoque

    *Para qualquer* movimentação de estoque (entrada, saída, ajuste, reserva), o registro criado deve conter: `product_id`, `type`, `quantity`, `user_id` e `created_at` preenchidos.

    **Valida: Requisito 3.4**

    ---

    ### Propriedade 10: Rejeição de ajuste de estoque sem justificativa

    *Para qualquer* tentativa de ajuste manual de inventário sem o campo `reason` preenchido, a operação deve ser rejeitada com erro de validação.

    **Valida: Requisito 3.6**

    ---

    ### Propriedade 11: Cálculo de quantidade com percentual de perda

    *Para qualquer* par (área_m2, waste_pct) onde `waste_pct` está entre 5 e 20, a quantidade calculada deve ser igual a `ceil(area_m2 / product_area_m2) * (1 + waste_pct / 100)`. Percentuais fora do intervalo [5, 20] devem ser rejeitados.

    **Valida: Requisitos 4.1, 4.2**

    ---

    ### Propriedade 12: Consistência de subtotais do Quote

    *Para qualquer* Quote com múltiplos ambientes, a soma dos subtotais de todos os `quote_items` deve ser igual ao campo `total` do Quote.

    **Valida: Requisito 4.4**

    ---

    ### Propriedade 13: Validade do Quote conforme configuração do Tenant

    *Para qualquer* Quote criado, o campo `expires_at` deve ser igual a `created_at + tenant.quote_validity_days` (em dias).

    **Valida: Requisito 4.6**

    ---

    ### Propriedade 14: Status inicial do Order ao aprovar Quote

    *Para qualquer* Quote com status `approved`, o Order criado a partir dele deve ter status inicial `awaiting_payment` e deve referenciar o `quote_id` correto.

    **Valida: Requisito 5.1**

    ---

    ### Propriedade 15: Completude do histórico de transições de status do Order

    *Para qualquer* mudança de status de um Order, um registro em `order_status_log` deve ser criado contendo `from_status`, `to_status`, `user_id` e `created_at`.

    **Valida: Requisito 5.3**

    ---

    ### Propriedade 16: Validação de CPF/CNPJ e unicidade por Tenant

    *Para qualquer* tentativa de cadastro de Customer com CPF ou CNPJ inválido (formato incorreto), a operação deve ser rejeitada. Para documentos válidos, não deve ser possível cadastrar dois Customers com o mesmo documento dentro do mesmo Tenant.

    **Valida: Requisito 6.2**

    ---

    ### Propriedade 17: Completude do histórico de Customer

    *Para qualquer* Customer, a consulta ao seu histórico deve retornar todos os Quotes e Orders associados a ele, sem omissões.

    **Valida: Requisito 6.3**

    ---

    ### Propriedade 18: Classificação automática de Customer inativo

    *Para qualquer* Customer cuja `last_purchase_at` seja anterior a 90 dias da data atual, seu `status` deve ser `inactive`. Customers com compra nos últimos 90 dias devem ter `status` `active`.

    **Valida: Requisito 6.6**

    ---

    ### Propriedade 19: Round-trip de RenderJob (submissão → conclusão → disponibilidade)

    *Para qualquer* RenderJob submetido com imagem e produto válidos: (a) a submissão deve retornar um `jobId` imediatamente com status `queued`; (b) após processamento bem-sucedido, o status deve ser `completed` e `output_image_url` deve estar preenchido; (c) a imagem deve estar acessível por no mínimo 24 horas após a conclusão.

    **Valida: Requisitos 7.3, 7.4**

    ---

    ### Propriedade 20: Enfileiramento quando todos os providers estão indisponíveis

    *Para qualquer* RenderJob submetido quando todos os providers de IA estão indisponíveis (simulado por ausência de API keys ou falha forçada), o job deve permanecer com status `queued` em vez de `failed`, e não deve ser descartado.

    **Valida: Requisito 7.5**

    ---

    ### Propriedade 21: Limite de RenderJobs por plano

    *Para qualquer* Tenant que atingiu o limite de RenderJobs do seu plano (`render_jobs_used >= render_jobs_limit`), novas submissões devem ser rejeitadas com status 429 e mensagem indicando o limite atingido.

    **Valida: Requisitos 7.6, 12.2, 12.3**

    ---

    ### Propriedade 22: Registro de metadados de RenderJob concluído

    *Para qualquer* RenderJob concluído com sucesso, os campos `provider_used`, `processing_ms` e `fidelity` devem estar preenchidos no registro do banco de dados.

    **Valida: Requisito 7.9**

    ---

    ### Propriedade 23: Notificação WhatsApp em mudança de status do Order

    *Para qualquer* mudança de status de um Order cujo Customer tem telefone cadastrado, uma entrada em `whatsapp_messages` deve ser criada com o template correspondente ao novo status.

    **Valida: Requisito 8.3**

    ---

    ### Propriedade 24: Registro de histórico de mensagens WhatsApp

    *Para qualquer* mensagem enviada via WhatsApp, um registro em `whatsapp_messages` deve ser criado com `tenant_id`, `to_phone`, `template`, `status` e `sent_at` preenchidos.

    **Valida: Requisito 8.4**

    ---

    ### Propriedade 25: Templates WhatsApp restritos por plano

    *Para qualquer* Tenant no plano Starter, a funcionalidade de recebimento de respostas WhatsApp deve ser bloqueada. Para Tenants no plano Pro ou Enterprise, deve estar habilitada.

    **Valida: Requisito 8.7**

    ---

    ### Propriedade 26: Cálculo de custo de mão de obra de instalação

    *Para qualquer* Installation Job com `area_m2` definida, o campo `labor_cost` deve ser igual a `area_m2 * tenant.labor_price_per_m2` conforme a tabela de preços configurada pelo Tenant.

    **Valida: Requisito 9.5**

    ---

    ### Propriedade 27: Round-trip financeiro (Order confirmado → conta a receber)

    *Para qualquer* Order confirmado com valor V, uma `financial_entry` do tipo `receivable` deve ser criada com `amount = V` e `order_id` referenciando o Order. Após registrar o pagamento, o saldo de caixa deve aumentar em V.

    **Valida: Requisitos 10.1, 10.3**

    ---

    ### Propriedade 28: Consistência do fluxo de caixa projetado

    *Para qualquer* período de tempo, o saldo projetado no relatório de fluxo de caixa deve ser igual à soma de todas as entradas menos a soma de todas as saídas no período.

    **Valida: Requisito 10.4**

    ---

    ### Propriedade 29: Margem de contribuição por Order

    *Para qualquer* Order, a margem de contribuição registrada deve ser igual a `order.total - SUM(item.quantity * product.cost_price)` para todos os itens do Order.

    **Valida: Requisito 10.6**

    ---

    ### Propriedade 30: Exportação de relatórios restrita por plano

    *Para qualquer* Tenant no plano Starter, endpoints de exportação de relatórios em CSV/XLSX devem retornar 403. Para Tenants no plano Pro ou Enterprise, devem retornar os dados corretamente.

    **Valida: Requisito 11.5**

    ---

    ### Propriedade 31: Acesso somente leitura após vencimento de assinatura

    *Para qualquer* Tenant com assinatura vencida há menos de 7 dias, operações de leitura (GET) devem ser permitidas e operações de escrita (POST, PUT, DELETE) devem ser rejeitadas com status 402.

    **Valida: Requisito 12.5**

    ---

    ### Propriedade 32: Permissões de trial equivalentes ao plano Pro

    *Para qualquer* Tenant em período de trial, as permissões e limites aplicados devem ser idênticos aos do plano Pro.

    **Valida: Requisito 12.7**

    ---

    ### Propriedade 33: Autenticação por API Key

    *Para qualquer* requisição à API pública sem header `X-API-Key` ou com API Key inválida, a resposta deve ser 401. Com API Key válida, a requisição deve ser processada com o `tenant_id` correspondente à chave.

    **Valida: Requisito 13.1**

    ---

    ### Propriedade 34: Paridade de validações entre API e interface web

    *Para qualquer* operação de criação ou atualização de recurso, as mesmas regras de validação de negócio devem ser aplicadas independentemente de a requisição vir da interface web ou da API pública.

    **Valida: Requisito 13.3**

    ---

    ### Propriedade 35: Reenvio de Webhook com backoff exponencial

    *Para qualquer* Webhook que falha na entrega, o intervalo entre tentativas deve seguir progressão exponencial (ex: 1min, 2min, 4min, 8min...) e as tentativas devem cessar após 24 horas da primeira falha.

    **Valida: Requisito 13.5**

    ---

    ### Propriedade 36: Rate limiting por plano na API pública

    *Para qualquer* Tenant que excede o limite de requisições por hora do seu plano (1000 para Pro, 5000 para Enterprise), requisições adicionais devem ser rejeitadas com status 429 e header `Retry-After`.

    **Valida: Requisito 13.6**

    ---

    ## Tratamento de Erros

    ### Categorias de Erro

    | Código HTTP | Categoria | Exemplos |
    |-------------|-----------|---------|
    | 400 | Validação de entrada | SKU duplicado, CPF inválido, percentual de perda fora do range |
    | 401 | Autenticação | JWT expirado, API Key inválida |
    | 402 | Assinatura | Tenant com assinatura vencida tentando escrita |
    | 403 | Autorização | Perfil sem permissão, acesso cross-tenant |
    | 404 | Recurso não encontrado | Produto, cliente ou pedido inexistente |
    | 409 | Conflito | CNPJ já cadastrado, SKU duplicado |
    | 422 | Regra de negócio | Estoque insuficiente, produto inativo em novo quote |
    | 429 | Rate limit / Limite de plano | Excesso de requisições, limite de RenderJobs atingido |
    | 500 | Erro interno | Falha de banco, provider de IA indisponível |

    ### Formato Padrão de Erro

    ```json
    {
    "error": {
        "code": "STOCK_INSUFFICIENT",
        "message": "Saldo insuficiente para o produto SKU-001. Disponível: 10, Solicitado: 15",
        "field": "quantity",
        "requestId": "req-uuid"
    }
    }
    ```

    ### Tratamento de Falhas no AIRenderer

    1. **Provider falha**: `ProviderRouter` tenta o próximo provider automaticamente (comportamento existente)
    2. **Todos os providers falham**: job permanece em `queued`, BullMQ faz retry com backoff exponencial
    3. **3 tentativas esgotadas**: job vai para `failed`, notificação ao administrador via e-mail
    4. **Timeout de provider**: `AbortController` cancela a requisição após `PROVIDER_TIMEOUT_MS` (comportamento existente)

    ### Tratamento de Falhas no WhatsApp

    1. **Falha na entrega**: status da mensagem atualizado para `failed` via webhook da Meta
    2. **Sem entrega em 24h**: job agendado no BullMQ verifica mensagens sem `delivered_at` e notifica o vendedor
    3. **API Meta indisponível**: retry com backoff, máximo 3 tentativas antes de registrar falha

    ---

    ## Estratégia de Testes

    ### Abordagem Dual: Testes Unitários + Testes Baseados em Propriedades

    A estratégia combina testes de exemplo (casos específicos, edge cases, integrações) com testes baseados em propriedades (cobertura de inputs aleatórios para verificar invariantes universais).

    **Biblioteca de PBT**: [fast-check](https://fast-check.dev/) para TypeScript/JavaScript.

    ### Testes Unitários e de Integração

    Focados em casos específicos, edge cases e pontos de integração:

    - Autenticação: login válido, inválido, bloqueio por tentativas, expiração de JWT
    - Cálculo de orçamento: área com perda, múltiplos ambientes, tabela de preços
    - Máquina de estados do Order: transições válidas e inválidas
    - Integração WhatsApp: mock da Meta Cloud API, templates corretos por evento
    - Integração ProviderRouter: mock dos providers, fallback quando todos falham
    - Financeiro: criação de contas a receber, cálculo de margem, DRE

    ### Testes Baseados em Propriedades

    Cada propriedade de corretude deve ser implementada como um único teste de propriedade com mínimo de 100 iterações. Formato de tag obrigatório:

    ```
    // Feature: pisosrealview-saas-analysis, Property N: <texto da propriedade>
    ```

    **Exemplos de implementação:**

    ```typescript
    // Feature: pisosrealview-saas-analysis, Property 1: Isolamento de dados entre Tenants
    test('tenant isolation', () => {
    fc.assert(fc.asyncProperty(
        fc.record({ tenantA: arbTenant(), tenantB: arbTenant(), resource: arbResource() }),
        async ({ tenantA, tenantB, resource }) => {
        fc.pre(tenantA.id !== tenantB.id);
        await createResource(tenantA.id, resource);
        const result = await fetchResource(tenantB.id, resource.id);
        return result === null || result.status === 403;
        }
    ), { numRuns: 100 });
    });

    // Feature: pisosrealview-saas-analysis, Property 11: Cálculo de quantidade com percentual de perda
    test('waste percentage calculation', () => {
    fc.assert(fc.property(
        fc.float({ min: 1, max: 100 }),  // area_m2
        fc.integer({ min: 5, max: 20 }), // waste_pct válido
        fc.float({ min: 0.01, max: 1 }), // product_area_m2
        (area, waste, productArea) => {
        const result = calculateQuantity(area, waste, productArea);
        const expected = Math.ceil(area / productArea) * (1 + waste / 100);
        return Math.abs(result - expected) < 0.001;
        }
    ), { numRuns: 200 });
    });

    // Feature: pisosrealview-saas-analysis, Property 8: Round-trip de reserva e estorno de estoque
    test('stock reservation round-trip', () => {
    fc.assert(fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // saldo inicial
        fc.integer({ min: 1, max: 500 }),  // quantidade a reservar
        async (initialStock, reserveQty) => {
        fc.pre(reserveQty <= initialStock);
        const product = await createProductWithStock(initialStock);
        const order = await createAndConfirmOrder(product.id, reserveQty);
        const afterReserve = await getStockBalance(product.id);
        expect(afterReserve).toBe(initialStock - reserveQty);
        await cancelOrder(order.id);
        const afterCancel = await getStockBalance(product.id);
        return afterCancel === initialStock;
        }
    ), { numRuns: 100 });
    });
    ```

    ### Cobertura Mínima por Módulo

    | Módulo | Cobertura de linhas | Propriedades PBT |
    |--------|--------------------|--------------------|
    | TenantModule | 90% | Props 1, 2, 3, 4 |
    | CatalogModule | 85% | Props 5, 6, 7 |
    | StockModule | 90% | Props 8, 9, 10 |
    | QuoteModule | 90% | Props 11, 12, 13 |
    | OrderModule | 90% | Props 14, 15 |
    | CRMModule | 85% | Props 16, 17, 18 |
    | AIRendererModule | 85% | Props 19, 20, 21, 22 |
    | WhatsAppService | 80% | Props 23, 24, 25 |
    | InstallationModule | 80% | Prop 26 |
    | FinancialModule | 90% | Props 27, 28, 29 |
    | SubscriptionModule | 90% | Props 30, 31, 32 |
    | API Pública | 85% | Props 33, 34, 35, 36 |
