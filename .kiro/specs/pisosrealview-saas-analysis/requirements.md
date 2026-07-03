# Documento de Requisitos

## Introdução

O PisosRealView Pro é um SaaS B2B voltado para o setor de revestimentos de piso, atendendo lojas, distribuidores e instaladores. O diferencial central é a visualização de pisos com IA: o cliente final pode ver como um determinado material ficaria aplicado em uma foto real do seu ambiente antes de comprar. A plataforma combina gestão comercial completa (produtos, estoque, orçamentos, pedidos, clientes, financeiro) com o módulo de visualização IA, criando uma proposta de valor única no mercado brasileiro de pisos.

A stack existente inclui backend Node.js/TypeScript, frontend React, e um gateway de providers de IA (Pika Labs, ZhipuCogView, WaveSpeed AI) com roteamento inteligente via `ProviderRouter`. O MVP de 90 dias deve entregar as funcionalidades core que permitam a um lojista operar o dia a dia e demonstrar o diferencial de IA para seus clientes.

---

## Glossário

- **Platform**: O sistema SaaS PisosRealView Pro como um todo
- **Tenant**: Uma empresa cadastrada na plataforma (loja, distribuidora ou instaladora)
- **User**: Pessoa física com acesso à plataforma, vinculada a um Tenant
- **Product**: Item do catálogo de pisos (porcelanato, cerâmica, vinílico, etc.) com atributos como dimensão, acabamento, preço e imagem de textura
- **Stock**: Controle de quantidade disponível de um Product por Tenant
- **Customer**: Cliente pessoa física ou jurídica cadastrado por um Tenant
- **Supplier**: Fornecedor de produtos cadastrado por um Tenant
- **Quote**: Orçamento gerado para um Customer, contendo itens, quantidades e valores
- **Order**: Pedido confirmado a partir de um Quote ou criado diretamente
- **Invoice**: Nota fiscal ou documento fiscal associado a um Order
- **AIRenderer**: Serviço responsável por aplicar a textura de um Product em uma foto de ambiente via IA
- **ProviderRouter**: Componente existente que roteia requisições de renderização entre os providers de IA (Pika Labs, ZhipuCogView, WaveSpeed AI)
- **RenderJob**: Tarefa assíncrona de renderização de imagem com IA
- **Subscription**: Plano de assinatura mensal de um Tenant na plataforma
- **Plan**: Nível de assinatura (ex: Starter, Pro, Enterprise) com limites de uso definidos
- **WhatsApp_Integration**: Módulo de envio de mensagens e orçamentos via API do WhatsApp Business
- **Installation_Module**: Módulo de agendamento e controle de serviços de instalação de pisos
- **Financial_Module**: Módulo de controle de contas a pagar, receber e fluxo de caixa
- **Dashboard**: Painel de indicadores gerenciais do Tenant
- **Webhook**: Notificação HTTP enviada pela plataforma para sistemas externos

---

## Requisitos

### Requisito 1: Gestão de Multi-Tenancy e Autenticação

**User Story:** Como administrador de uma loja de pisos, quero criar minha conta na plataforma e gerenciar os acessos da minha equipe, para que cada colaborador tenha permissões adequadas à sua função.

#### Critérios de Aceitação

1. WHEN um novo Tenant se cadastra com CNPJ, razão social e e-mail, THE Platform SHALL criar uma conta isolada com dados segregados dos demais Tenants
2. WHEN um User tenta acessar dados de outro Tenant, THE Platform SHALL retornar erro 403 e registrar a tentativa de acesso não autorizado
3. THE Platform SHALL suportar os perfis de acesso: Administrador, Vendedor, Estoquista e Instalador, cada um com permissões distintas
4. WHEN um User realiza login com credenciais válidas, THE Platform SHALL emitir um token JWT com validade de 8 horas
5. IF um User inserir credenciais inválidas 5 vezes consecutivas, THEN THE Platform SHALL bloquear o acesso da conta por 15 minutos e notificar o Administrador por e-mail
6. WHEN um Administrador convida um novo User por e-mail, THE Platform SHALL enviar link de ativação com validade de 48 horas
7. THE Platform SHALL manter isolamento completo de dados entre Tenants em todas as consultas ao banco de dados

---

### Requisito 2: Catálogo de Produtos

**User Story:** Como lojista, quero cadastrar e gerenciar meu catálogo de pisos com todas as informações técnicas e comerciais, para que minha equipe e meus clientes tenham acesso a dados precisos.

#### Critérios de Aceitação

1. THE Platform SHALL permitir o cadastro de Products com os atributos: nome, SKU, categoria, dimensões (cm), acabamento, cor, fabricante, preço de custo, preço de venda e imagem de textura
2. WHEN um Product é cadastrado sem SKU, THE Platform SHALL gerar automaticamente um SKU único no formato `{categoria}-{sequencial}`
3. THE Platform SHALL suportar o upload de imagens de textura nos formatos JPEG, PNG e WebP com tamanho máximo de 10 MB por arquivo
4. WHEN uma imagem de textura é enviada, THE Platform SHALL armazená-la e gerar uma versão otimizada para uso no AIRenderer
5. THE Platform SHALL permitir a organização de Products em categorias e subcategorias configuráveis pelo Tenant
6. WHEN um Product é marcado como inativo, THE Platform SHALL ocultá-lo de novos Quotes e Orders sem excluir o histórico existente
7. THE Platform SHALL permitir importação em lote de Products via arquivo CSV com validação de campos obrigatórios e retorno de relatório de erros

---

### Requisito 3: Gestão de Estoque

**User Story:** Como estoquista, quero controlar as entradas e saídas de produtos em tempo real, para que a equipe de vendas sempre saiba a disponibilidade real antes de fechar um orçamento.

#### Critérios de Aceitação

1. THE Platform SHALL manter o saldo de Stock por Product e por localização (depósito/loja) para cada Tenant
2. WHEN um Order é confirmado, THE Platform SHALL reservar automaticamente a quantidade correspondente no Stock
3. WHEN uma reserva de Stock é feita e o saldo disponível é insuficiente, THE Platform SHALL notificar o Vendedor e o Estoquista com a quantidade em falta
4. THE Platform SHALL registrar todas as movimentações de Stock com data, hora, tipo (entrada/saída/ajuste), quantidade e responsável
5. WHEN o saldo de um Product atinge o estoque mínimo configurado, THE Platform SHALL enviar alerta ao Estoquista e ao Administrador
6. THE Platform SHALL permitir ajustes manuais de inventário com campo obrigatório de justificativa
7. THE Platform SHALL gerar relatório de posição de estoque com valorização pelo método de custo médio

---

### Requisito 4: Orçamento Automático

**User Story:** Como vendedor, quero gerar orçamentos precisos rapidamente a partir das medidas do ambiente do cliente, para que eu possa fechar mais vendas com menos retrabalho.

#### Critérios de Aceitação

1. WHEN um Vendedor informa as dimensões do ambiente (comprimento e largura em metros), THE Platform SHALL calcular automaticamente a quantidade de Product necessária considerando a área total mais 10% de perda padrão
2. THE Platform SHALL permitir que o Vendedor ajuste o percentual de perda entre 5% e 20% por item do Quote
3. WHEN um Quote é gerado, THE Platform SHALL aplicar automaticamente a tabela de preços vigente do Tenant, incluindo descontos por volume configurados
4. THE Platform SHALL suportar múltiplos ambientes em um único Quote, com subtotais por ambiente e total geral
5. WHEN um Quote é finalizado, THE Platform SHALL gerar um PDF formatado com logo do Tenant, dados do Customer, itens, valores e validade
6. THE Platform SHALL registrar a validade padrão do Quote conforme configuração do Tenant (padrão: 15 dias)
7. IF um Quote expirar sem conversão em Order, THEN THE Platform SHALL notificar o Vendedor responsável para follow-up
8. THE Platform SHALL permitir o envio do Quote em PDF diretamente via WhatsApp_Integration para o Customer

---

### Requisito 5: Gestão de Pedidos e Emissão de Documentos

**User Story:** Como administrador, quero converter orçamentos aprovados em pedidos e controlar o ciclo de vida de cada venda, para que eu tenha rastreabilidade completa do processo comercial.

#### Critérios de Aceitação

1. WHEN um Customer aprova um Quote, THE Platform SHALL criar um Order com status inicial "Aguardando Pagamento"
2. THE Platform SHALL suportar os status de Order: Aguardando Pagamento, Pagamento Confirmado, Separação, Pronto para Entrega, Entregue e Cancelado
3. WHEN o status de um Order muda, THE Platform SHALL registrar o histórico de transição com data, hora e usuário responsável
4. THE Platform SHALL permitir a emissão de nota fiscal de serviço (NFS-e) via integração com prefeituras que suportam o padrão ABRASF
5. WHEN um Order é cancelado, THE Platform SHALL estornar automaticamente a reserva de Stock dos itens correspondentes
6. THE Platform SHALL permitir a geração de romaneio de entrega em PDF para Orders com status "Pronto para Entrega"
7. WHEN um Order é marcado como "Entregue", THE Platform SHALL solicitar confirmação de recebimento ao Customer via WhatsApp_Integration

---

### Requisito 6: Gestão de Clientes e Fornecedores

**User Story:** Como vendedor, quero ter um cadastro completo de clientes e fornecedores com histórico de interações, para que eu possa oferecer um atendimento personalizado e acompanhar relacionamentos comerciais.

#### Critérios de Aceitação

1. THE Platform SHALL permitir o cadastro de Customers com CPF/CNPJ, nome, endereço, telefone, e-mail e observações
2. WHEN um CPF ou CNPJ é informado, THE Platform SHALL validar o formato e verificar duplicidade dentro do Tenant
3. THE Platform SHALL exibir o histórico completo de Quotes e Orders de cada Customer, com filtros por período e status
4. THE Platform SHALL permitir o cadastro de Suppliers com CNPJ, razão social, contatos, prazo de entrega padrão e condições de pagamento
5. THE Platform SHALL associar cada Product a um Supplier principal e permitir Suppliers alternativos
6. WHEN um Customer não realiza compras por 90 dias, THE Platform SHALL classificá-lo automaticamente como "Inativo" no CRM
7. THE Platform SHALL permitir o registro de interações (ligações, visitas, mensagens) no histórico do Customer com data e responsável

---

### Requisito 7: Visualização de Pisos com IA (AIRenderer)

**User Story:** Como vendedor, quero mostrar ao cliente como o piso ficará no ambiente real dele antes da compra, para que a decisão de compra seja mais segura e o ticket médio aumente.

#### Critérios de Aceitação

1. WHEN um Vendedor ou Customer envia uma foto de ambiente e seleciona um Product, THE AIRenderer SHALL processar a renderização aplicando a textura do Product na área de piso identificada na imagem
2. THE ProviderRouter SHALL selecionar automaticamente o provider de IA disponível (Pika Labs, ZhipuCogView ou WaveSpeed AI) com base em disponibilidade, custo e qualidade configurados
3. WHEN um RenderJob é submetido, THE Platform SHALL retornar um identificador de job e processar a renderização de forma assíncrona
4. WHEN um RenderJob é concluído, THE Platform SHALL notificar o solicitante via webhook ou polling e disponibilizar a imagem resultante por 24 horas
5. IF todos os providers de IA estiverem indisponíveis, THEN THE Platform SHALL enfileirar o RenderJob e notificar o solicitante com tempo estimado de processamento
6. THE Platform SHALL limitar o número de RenderJobs simultâneos por Tenant conforme o Plan de assinatura
7. WHEN um RenderJob falha após 3 tentativas, THE Platform SHALL notificar o Administrador e registrar o erro com detalhes do provider utilizado
8. THE Platform SHALL armazenar as imagens renderizadas associadas ao Product e ao Customer para reutilização em Quotes futuros
9. FOR ALL RenderJobs concluídos com sucesso, THE Platform SHALL registrar o provider utilizado, tempo de processamento e custo estimado para análise de performance

---

### Requisito 8: Integração WhatsApp Business

**User Story:** Como vendedor, quero enviar orçamentos, confirmações de pedido e notificações diretamente pelo WhatsApp do cliente, para que a comunicação seja mais ágil e com maior taxa de resposta.

#### Critérios de Aceitação

1. THE WhatsApp_Integration SHALL enviar mensagens via API oficial do WhatsApp Business (Meta Cloud API)
2. WHEN um Quote é gerado, THE Platform SHALL permitir o envio do PDF do Quote e da imagem renderizada pelo AIRenderer diretamente para o WhatsApp do Customer
3. WHEN um Order muda de status, THE WhatsApp_Integration SHALL enviar notificação automática ao Customer com o novo status e detalhes relevantes
4. THE Platform SHALL registrar o histórico de todas as mensagens enviadas via WhatsApp_Integration por Customer e por Order
5. IF uma mensagem WhatsApp não for entregue em 24 horas, THEN THE Platform SHALL notificar o Vendedor responsável para contato alternativo
6. THE Platform SHALL suportar templates de mensagem configuráveis por Tenant para os principais eventos do ciclo de venda
7. WHERE o Tenant possuir o Plan Pro ou superior, THE WhatsApp_Integration SHALL suportar recebimento de respostas e criação automática de tarefas de follow-up

---

### Requisito 9: Módulo de Instalação

**User Story:** Como instalador, quero gerenciar minha agenda de serviços de instalação e registrar o progresso de cada obra, para que o lojista e o cliente acompanhem o andamento em tempo real.

#### Critérios de Aceitação

1. THE Installation_Module SHALL permitir o agendamento de serviços de instalação vinculados a um Order com data, endereço e equipe responsável
2. WHEN um serviço de instalação é agendado, THE Platform SHALL notificar o Customer via WhatsApp_Integration com data, horário e nome do instalador
3. THE Installation_Module SHALL permitir o registro de fotos do ambiente antes e depois da instalação, associadas ao Order
4. WHEN um instalador registra a conclusão do serviço, THE Platform SHALL atualizar o status do Order para "Entregue" e solicitar avaliação ao Customer
5. THE Installation_Module SHALL calcular o custo de mão de obra com base na área instalada (m²) e na tabela de preços configurada pelo Tenant
6. THE Platform SHALL gerar relatório mensal de produtividade por instalador com área instalada, número de serviços e avaliações recebidas

---

### Requisito 10: Controle Financeiro

**User Story:** Como administrador, quero ter visibilidade completa do fluxo de caixa e das contas a pagar e receber, para que eu possa tomar decisões financeiras com base em dados precisos.

#### Critérios de Aceitação

1. THE Financial_Module SHALL registrar automaticamente contas a receber para cada Order confirmado, com data de vencimento e valor
2. THE Financial_Module SHALL registrar contas a pagar vinculadas a compras de Suppliers com data de vencimento e valor
3. WHEN um pagamento é registrado, THE Financial_Module SHALL atualizar o saldo de caixa e marcar a conta como liquidada
4. THE Financial_Module SHALL gerar relatório de fluxo de caixa diário, semanal e mensal com entradas, saídas e saldo projetado
5. WHEN uma conta a receber vencer sem pagamento registrado, THE Platform SHALL notificar o Administrador e o Vendedor responsável
6. THE Financial_Module SHALL calcular a margem de contribuição por Order com base no custo dos Products e no valor de venda
7. THE Platform SHALL gerar relatório de DRE simplificado mensal com receita bruta, deduções, custo de mercadoria vendida e resultado operacional

---

### Requisito 11: Relatórios Gerenciais e Dashboard

**User Story:** Como administrador, quero visualizar os principais indicadores do negócio em um painel centralizado, para que eu possa identificar oportunidades e problemas rapidamente.

#### Critérios de Aceitação

1. THE Dashboard SHALL exibir em tempo real: faturamento do mês, número de Orders, ticket médio, produtos mais vendidos e clientes mais ativos
2. THE Platform SHALL atualizar os dados do Dashboard com latência máxima de 5 minutos em relação às transações registradas
3. THE Platform SHALL gerar relatório de vendas por período, por Vendedor, por categoria de Product e por Customer
4. THE Platform SHALL gerar relatório de giro de estoque identificando Products sem movimentação nos últimos 60 dias
5. WHERE o Tenant possuir o Plan Pro ou superior, THE Platform SHALL disponibilizar exportação de relatórios nos formatos CSV e XLSX
6. THE Platform SHALL manter histórico de relatórios gerados por 12 meses para consulta posterior

---

### Requisito 12: Gestão de Assinaturas e Planos

**User Story:** Como gestor de produto, quero controlar os planos de assinatura dos Tenants e os limites de uso de cada funcionalidade, para que o modelo de receita seja sustentável e escalável.

#### Critérios de Aceitação

1. THE Platform SHALL suportar os planos: Starter (até 2 Users, 50 RenderJobs/mês, sem WhatsApp), Pro (até 10 Users, 300 RenderJobs/mês, com WhatsApp) e Enterprise (Users ilimitados, RenderJobs ilimitados, todas as funcionalidades)
2. WHEN um Tenant atinge 80% do limite de RenderJobs do seu Plan, THE Platform SHALL notificar o Administrador com opção de upgrade
3. WHEN um Tenant excede o limite de RenderJobs do seu Plan, THE Platform SHALL bloquear novos RenderJobs e notificar o Administrador
4. THE Platform SHALL processar pagamentos de assinatura via integração com gateway de pagamento (Stripe ou Pagar.me)
5. WHEN uma assinatura vence sem renovação, THE Platform SHALL manter acesso somente leitura por 7 dias antes de suspender o Tenant
6. THE Platform SHALL registrar o histórico de planos e pagamentos de cada Tenant para fins de auditoria
7. WHERE o Tenant estiver no período de trial (primeiros 14 dias), THE Platform SHALL liberar acesso completo ao Plan Pro sem cobrança

---

### Requisito 13: API Pública e Webhooks

**User Story:** Como desenvolvedor de um sistema ERP externo, quero integrar o PisosRealView Pro via API, para que os dados de produtos, pedidos e clientes sejam sincronizados automaticamente com meu sistema.

#### Critérios de Aceitação

1. THE Platform SHALL disponibilizar uma API REST documentada com autenticação via API Key por Tenant
2. THE Platform SHALL expor endpoints para leitura e escrita de Products, Customers, Quotes e Orders
3. WHEN um recurso é criado ou atualizado via API, THE Platform SHALL aplicar as mesmas validações de negócio da interface web
4. THE Platform SHALL suportar Webhooks configuráveis por Tenant para os eventos: Order criado, Order atualizado, Quote expirado e RenderJob concluído
5. WHEN um Webhook falha na entrega, THE Platform SHALL tentar reenvio com backoff exponencial por até 24 horas
6. THE Platform SHALL limitar as requisições à API em 1000 chamadas por hora por Tenant no Plan Pro e 5000 no Plan Enterprise
7. THE Platform SHALL disponibilizar documentação OpenAPI 3.0 atualizada automaticamente a cada deploy
