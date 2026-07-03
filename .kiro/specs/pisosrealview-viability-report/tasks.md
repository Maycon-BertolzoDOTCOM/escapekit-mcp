# Plano de Implementação: PisosRealView – Lançamento e Validação Comercial

## Visão Geral

Checklist executivo de 30 dias para lançar o PisosRealView como SaaS B2B, validar com lojistas piloto e fechar os primeiros clientes pagantes. As tarefas seguem a ordem de prioridade definida     no relatório de viabilidade.

## Tarefas

- [x] 1. Integrar gateway de pagamento Asaas
  - [x] 1.1 Criar conta Asaas e obter credenciais de API (sandbox e produção)
    - Configurar variáveis de ambiente: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`
    - _Requisitos: 5.3 item 1, 5.4 checklist_
  - [x] 1.2 Implementar criação de assinaturas recorrentes no Asaas
    - Usar a API de **assinaturas** do Asaas (não "planos" nativos como Stripe)
    - Criar assinatura recorrente com `value` (ex: R$ 197) e `cycle: "MONTHLY"`
    - Para o trial, criar assinatura com `value: 0` e `maxPayments: 1`, usando `externalReference` para indicar `plan: "trial"`
    - Mapear todos os planos:
      - `trial`: R$ 0, 1 cobrança (`maxPayments: 1`)
      - `basic`: R$ 197/mês
      - `popular`: R$ 347/mês
      - `pro`: R$ 597/mês
      - `enterprise`: R$ 1.497/mês
    - _Requisitos: 5.3 item 1_
  - [x] 1.3 Implementar webhook do Asaas para ativar/suspender contas
    - Criar endpoint `POST /v1/billing/webhook` para receber eventos `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_CANCELLED`
    - Ao confirmar pagamento: ativar créditos no CreditTracker
    - Ao cancelar/vencer: suspender acesso
    - _Requisitos: 5.4 checklist_
  - [x] 1.4 Implementar checkout no frontend
    - Criar modal simples com formulário (nome, e-mail, CNPJ/CPF, telefone)
    - Redirecionar para o link de pagamento hospedado do Asaas (checkout externo)
    - NÃO lidar com dados de cartão diretamente no frontend (usar checkout hospedado do Asaas)
    - _Requisitos: 5.3 item 1_
  - [x]* 1.5 Escrever testes para o fluxo de billing
    - Testar criação de assinatura, recebimento de webhook e atualização de créditos
    - Usar mocks para a API do Asaas em ambiente de teste
    - _Requisitos: 5.3 item 1_

- [-] 2. Deploy final em produção
  - [ ] 2.1 Configurar variáveis de ambiente seguras no Railway
    - Adicionar todas as chaves de API (`ASAAS_API_KEY`, `WAVESPEED_API_KEY`, `PIKA_API_KEY`, etc.) via painel do Railway
    - Garantir que nenhuma chave esteja hardcoded ou em `.env` commitado
    - _Requisitos: 5.3 item 2_
  - [ ] 2.2 Configurar variáveis de ambiente no Vercel (frontend)
    - Definir `VITE_API_URL` apontando para a URL pública do Railway
    - _Requisitos: 5.3 item 2_
  - [ ] 2.3 Fazer deploy do backend no Railway e validar endpoints públicos
    - Confirmar que `/v1/analyze` e `/v1/simulate` respondem via HTTPS
    - _Requisitos: 5.3 item 2_
  - [ ] 2.4 Fazer deploy do frontend no Vercel e validar integração com backend
    - Confirmar que o frontend em produção consegue chamar o backend sem erros de CORS
    - _Requisitos: 5.3 item 2_

- [x] 3. Configurar plano trial (50 simulações grátis)
  - [x] 3.1 Implementar `plan: trial` no CreditTracker
    - Ao criar conta trial, inicializar com `credits: 50` e `plan: "trial"` sem data de expiração
    - Garantir que créditos trial não expiram por tempo (apenas por uso)
    - Adicionar campo `plan` no registro do cliente: `"trial"`, `"basic"`, `"popular"`, `"pro"`, `"enterprise"`
    - O CreditTracker deve consultar o `plan` para determinar o limite de créditos correspondente:
      - `trial`: 50 simulações
      - `basic`: 200 simulações/mês
      - `popular`: 500 simulações/mês
      - `pro`: 1.000 simulações/mês
      - `enterprise`: 3.000 simulações/mês
    - _Requisitos: 5.3 item 3, 5.4 checklist_
  - [x] 3.2 Criar endpoint de registro de conta trial
    - `POST /v1/auth/trial` recebe `{ email, storeName }` e cria conta com 50 créditos
    - Retornar `apiKey` para uso imediato
    - _Requisitos: 5.3 item 3_
  - [x]* 3.3 Escrever testes para o fluxo trial
    - Verificar que conta trial inicia com exatamente 50 créditos
    - Verificar que créditos decrementam corretamente a cada simulação
    - Verificar que não há expiração por tempo
    - _Requisitos: 5.3 item 3_

- [ ] 4. Checkpoint – Validar prontidão para lançamento
  - Garantir que todos os testes passam (`npm test`)
  - Confirmar que o fluxo completo funciona em produção: registro trial → simulação → checkout → pagamento
  - Perguntar ao usuário se há ajustes antes de prosseguir para a fase comercial

- [x] 5. Configurar link de afiliado
  - [x] 5.1 Implementar rastreamento de parâmetro `?ref=` no frontend
    - Ao acessar o site com `?ref=pai`, salvar o código de afiliado em `localStorage`
    - Incluir o `ref` no payload de registro/checkout para rastreamento
    - _Requisitos: 5.3 item 4, 5.4 checklist_
  - [x] 5.2 Registrar conversões por afiliado no backend
    - Ao criar assinatura, salvar o campo `referredBy` no registro do cliente
    - Criar endpoint `GET /v1/admin/affiliates/:ref` para consultar conversões por código
    - O endpoint deve retornar também:
      - `activeClients`: número de clientes ativos indicados por esse afiliado
      - `totalRevenue`: receita total gerada (soma de MRR dos clientes ativos)
      - `lastPaymentDate`: data do último pagamento de qualquer cliente indicado
      - `totalCommissionEarned`: valor total de comissão gerada (30% do MRR dos clientes ativos indicados por esse afiliado)
        - Exemplo: 3 clientes no plano basic (R$ 197 cada) → `totalCommissionEarned = 3 × 197 × 0.30 = R$ 177,30`
    - _Requisitos: 5.3 item 4_

- [x] 6. Preparar material de demonstração
  - [x] 6.1 Criar rota/página de demo pública no frontend
    - Página `/demo` com simulação ao vivo usando créditos de demonstração (sem necessidade de login)
    - O `clientId: "demo-public"` tem um limite de **10 simulações por dia**
    - Implementar contador diário com rollover: ao iniciar um novo dia (UTC), resetar o contador para 10
    - Usar o campo `demoCreditsDate` no registro do CreditTracker para rastrear a data do último reset
    - Se `demoCreditsDate` for diferente da data atual (UTC), resetar `credits` para 10 e atualizar `demoCreditsDate`
    - Isso evita abuso sem precisar de Redis (funciona com o arquivo JSON atual)
    - O middleware de autenticação deve permitir a rota `/demo` sem exigir API key, usando automaticamente o `clientId: "demo-public"`
    - Isso evita que a chave seja extraída e usada fora da demo
    - _Requisitos: 5.3 item 5, 4 (risco de adoção)_
  - [x] 6.2 Adicionar indicador visual de progresso durante simulação
    - Mostrar spinner ou barra de progresso enquanto a IA processa
    - Exibir o provedor utilizado (ex: "Simulando com WaveSpeedAI...")
    - _Requisitos: 5.3 item 5_

- [x] 7. Instrumentação para coleta de feedback
  - [x] 7.1 Adicionar logging estruturado de uso por cliente
    - Registrar em log: `clientId`, `plan`, `provider`, `latencyMs`, `success` a cada simulação
    - Usar formato JSON para facilitar análise posterior
    - Usar `pino` (ou `winston`) como biblioteca de logging
    - Configurar nível de log por variável de ambiente: `LOG_LEVEL=debug` em dev, `LOG_LEVEL=info` em produção
    - Adicionar middleware de request logging no Express para registrar todas as requisições
    - Gerar um `correlationId` único (UUID v4) em cada requisição via middleware do Express
    - Incluir o `correlationId` em todos os logs relacionados àquela requisição
    - Retornar o `correlationId` no header de resposta `X-Correlation-Id` para facilitar debugging pelo cliente
    - Isso permite rastrear todo o fluxo de uma simulação nos logs
    - _Requisitos: 5.3 item 7, 4 (risco de churn)_
  - [x] 7.2 Criar endpoint de admin para métricas básicas
    - `GET /v1/admin/metrics` retorna: total de clientes, simulações/dia, providers mais usados, erros recentes
    - Proteger com `ADMIN_API_KEY` via variável de ambiente
    - _Requisitos: 5.3 item 7_

- [ ] 8. Checkpoint final – Pronto para abordagem comercial
  - Garantir que todos os testes passam
  - Confirmar que link de afiliado `?ref=pai` funciona em produção
  - Confirmar que página `/demo` está acessível publicamente
  - Perguntar ao usuário se há ajustes antes de iniciar abordagem com lojistas

---

## Fase 3: Escala (Pós 10+ clientes)

- [ ]* 9. Migrar CreditTracker para Redis (Upstash)
  - [ ]* 9.1 Configurar Upstash Redis (free tier) e obter `REDIS_URL`
    - _Requisitos: 1.2 (gargalo técnico pós-lançamento)_
  - [ ]* 9.2 Refatorar CreditTracker para usar Redis como backend de persistência
    - Manter a mesma interface pública do CreditTracker atual
    - Garantir atomicidade no decremento de créditos com `DECR` do Redis
    - _Requisitos: 1.2_
  - [ ]* 9.3 Escrever testes de concorrência para CreditTracker com Redis
    - Simular 50 requisições simultâneas e verificar que créditos não ficam negativos
    - _Requisitos: 1.2_

- [ ]* 10. Adicionar suporte a múltiplos processos (PM2/cluster)
  - [ ]* 10.1 Configurar PM2 no Railway com modo cluster
    - Criar `ecosystem.config.js` com `instances: "max"` e `exec_mode: "cluster"`
    - _Requisitos: 1.2 (gargalo técnico pós-lançamento)_

- [ ]* 11. Criar landing page para leads orgânicos
  - [ ]* 11.1 Criar página `/` com proposta de valor, comparativo de preços e CTA de trial
    - Incluir seção de comparação com Roomvo e TilesView.ai (vantagem de preço 50%+)
    - Incluir formulário de captura de e-mail para lista de espera
    - _Requisitos: 5.3 item 8_

## Notas

- Tarefas marcadas com `*` são opcionais e devem ser executadas apenas após atingir 10+ clientes pagantes
- Checkpoints garantem validação incremental antes de avançar para a próxima fase
- O único bloqueio real para lançamento é a integração com o Asaas (tarefa 1)
- Após concluir as tarefas 1-4, o produto está pronto para abordagem comercial com Raildo e demais lojistas
- A API do Asaas usa assinaturas recorrentes (não planos nativos). Consultar documentação em https://docs.asaas.com/reference/criar-nova-assinatura
- O limite diário da demo (10 simulações/dia) é implementado via rollover de data no CreditTracker, sem necessidade de Redis
