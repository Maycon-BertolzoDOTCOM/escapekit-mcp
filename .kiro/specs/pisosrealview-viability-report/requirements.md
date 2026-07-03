# Documento de Requisitos

## Introdução

O PisosRealView é um SaaS B2B de simulação de pisos por IA voltado para lojistas, arquitetos e construtoras no Brasil. O sistema já possui backend Node.js/Express com ProviderRouter multi-provedor, invariantes semânticas, CreditTracker com persistência e 1.283 testes passando. Este documento de requisitos define o escopo do **Relatório de Viabilidade** – um artefato estratégico que responde se o produto está pronto para ir a mercado, qual o potencial financeiro e quais são os próximos passos concretos.

---

## Glossário

- **Sistema**: O PisosRealView SaaS, incluindo backend, frontend e infraestrutura de deploy.
- **Relatório**: O documento de viabilidade produzido como saída deste spec.
- **Lojista**: Proprietário ou gestor de loja de pisos e revestimentos.
- **TAM** (Total Addressable Market): Mercado total endereçável – todas as lojas de piso e arquitetos no Brasil.
- **SAM** (Serviceable Addressable Market): Parcela do TAM que o Sistema pode atender com o modelo atual.
- **SOM** (Serviceable Obtainable Market): Parcela realista do SAM capturável nos primeiros 12 meses.
- **Break-even**: Ponto em que receita mensal cobre todos os custos operacionais.
- **MRR** (Monthly Recurring Revenue): Receita recorrente mensal.
- **Churn**: Taxa de cancelamento mensal de assinaturas.
- **ProviderRouter**: Componente de roteamento multi-provedor de IA do backend.
- **CreditTracker**: Componente de controle de créditos por tenant com persistência.
- **Invariante Semântica**: Validação pós-geração de qualidade de imagem (sombras, geometria, perspectiva).

---

## Requisitos

### Requisito 1: Avaliação de Viabilidade Técnica

**User Story:** Como fundador do PisosRealView, quero saber se o sistema está pronto para produção, para que eu possa decidir com segurança quando lançar o produto.

#### Critérios de Aceitação

1. THE Relatório SHALL avaliar o estado atual do backend (Node.js + Express, ProviderRouter, CreditTracker) em relação aos requisitos mínimos de produção.
2. THE Relatório SHALL identificar os gargalos técnicos remanescentes, incluindo ausência de Redis para CreditTracker, ausência de multi-processo (cluster/PM2) e ausência de gateway de pagamento.
3. THE Relatório SHALL classificar cada gargalo como "bloqueante para lançamento" ou "pós-lançamento", com justificativa de no máximo 2 frases explicando o critério de classificação.
4. WHEN o gargalo for classificado como "bloqueante para lançamento", THE Relatório SHALL estimar o esforço de resolução em dias de desenvolvimento.
5. THE Relatório SHALL avaliar a cobertura de testes (1.283 testes) como indicador de maturidade técnica.
6. THE Relatório SHALL avaliar a estratégia de deploy (Railway + Vercel) quanto a custo, escalabilidade e simplicidade operacional.

---

### Requisito 2: Análise de Mercado (TAM / SAM / SOM)

**User Story:** Como fundador, quero entender o tamanho real do mercado brasileiro, para que eu possa calibrar expectativas de crescimento e atratividade para investidores.

#### Critérios de Aceitação

1. THE Relatório SHALL estimar o TAM com base no número de lojas de piso no Brasil (~150.000) e no ticket médio anual por lojista, citando explicitamente a(s) fonte(s) utilizadas para esses números (ex: IBGE, ANAMACO, ABRAMAT ou equivalente).
2. THE Relatório SHALL estimar o SAM considerando apenas lojas com acesso à internet e disposição para adotar ferramentas digitais (estimativa conservadora: 20% do TAM).
3. THE Relatório SHALL estimar a taxa de digitalização do setor (percentual de lojas que adotam ferramentas digitais), citando a fonte utilizada (ex: IBGE, ANAMACO, ABRAMAT ou pesquisa setorial equivalente).
4. THE Relatório SHALL estimar o SOM para os primeiros 12 meses com base no canal de venda disponível (pai do fundador + Raildo) e capacidade operacional da equipe.
5. THE Relatório SHALL comparar o preço dos planos propostos com os concorrentes diretos (Roomvo, TilesView.ai) em termos de custo por simulação e funcionalidades.
6. WHEN a comparação indicar vantagem de preço superior a 50%, THE Relatório SHALL classificar o diferencial como "forte vantagem competitiva de preço".
7. THE Relatório SHALL avaliar a demanda real com base em evidências indiretas (crescimento do mercado de reformas, adoção de ferramentas digitais por lojistas, tendência de IA generativa em e-commerce).

---

### Requisito 3: Projeção Financeira

**User Story:** Como fundador, quero ver projeções financeiras conservadoras, para que eu possa planejar o fluxo de caixa e identificar o ponto de equilíbrio.

#### Critérios de Aceitação

1. THE Relatório SHALL calcular o break-even em número de clientes ativos, considerando os custos fixos mensais estimados (Railway ~R$ 150, Vercel ~R$ 0, APIs ~R$ 50 base, domínio/SSL ~R$ 30).
2. THE Relatório SHALL projetar o MRR para os cenários pessimista (5 clientes), base (15 clientes) e otimista (30 clientes) ao final de 12 meses.
3. THE Relatório SHALL calcular a margem bruta por plano, descontando o custo de API por simulação (R$ 0,03/simulação).
4. THE Relatório SHALL calcular a margem líquida projetada para cada cenário, descontando custos fixos, comissão do canal de vendas (30% recorrente), custos de gateway de pagamento (ex: Asaas ~2–5% por transação) e impostos aplicáveis ao regime tributário adotado (ex: MEI ~6%).
5. THE Relatório SHALL estimar o investimento inicial necessário para lançamento (configuração de gateway de pagamento, Redis, domínio, marketing inicial).
6. WHEN o break-even for atingível com menos de 10 clientes no plano Básico, THE Relatório SHALL classificar o modelo como "financeiramente viável com baixo risco".

---

### Requisito 4: Análise de Riscos e Mitigação

**User Story:** Como fundador, quero conhecer os principais riscos do projeto, para que eu possa agir preventivamente antes do lançamento.

#### Critérios de Aceitação

1. THE Relatório SHALL listar de 3 a 7 riscos principais, ordenados por impacto × probabilidade (do maior para o menor).
2. WHEN um risco envolver dependência de terceiros (ex: WaveSpeedAI), THE Relatório SHALL descrever a mitigação técnica já implementada (fallback multi-provedor) e a mitigação adicional recomendada.
3. THE Relatório SHALL classificar cada risco com nível de severidade: Alto, Médio ou Baixo.
4. THE Relatório SHALL propor uma ação de mitigação concreta e executável para cada risco identificado.
5. IF um risco for classificado como Alto e não houver mitigação implementada, THEN THE Relatório SHALL marcá-lo como "ação urgente antes do lançamento".

---

### Requisito 5: Recomendação Final e Checklist Executivo

**User Story:** Como fundador, quero uma recomendação clara e um checklist de ações para os próximos 30 dias, para que eu possa agir imediatamente sem ambiguidade.

#### Critérios de Aceitação

1. THE Relatório SHALL emitir uma recomendação explícita com uma das três opções: "Prosseguir", "Prosseguir com ressalvas" ou "Não prosseguir", com justificativa de no máximo 3 frases.
2. WHEN a recomendação for "Prosseguir com ressalvas", THE Relatório SHALL descrever as condições que precisam ser atendidas antes ou logo após o lançamento para que o produto seja viável.
3. WHEN a recomendação for "Prosseguir" ou "Prosseguir com ressalvas", THE Relatório SHALL listar os próximos passos em ordem de prioridade decrescente.
4. THE Relatório SHALL incluir um checklist executivo com no máximo 10 itens para os próximos 30 dias.
5. THE Relatório SHALL ordenar o checklist por impacto no lançamento (itens bloqueantes primeiro).
6. THE Relatório SHALL ser escrito em português brasileiro, com linguagem objetiva e sem jargões desnecessários.
7. THE Relatório SHALL ter no máximo 2 páginas de conteúdo principal (excluindo glossário e apêndices).
