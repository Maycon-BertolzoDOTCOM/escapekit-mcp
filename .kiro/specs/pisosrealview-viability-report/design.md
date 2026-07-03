# Relatório de Viabilidade – PisosRealView

**Data:** 14 de abril de 2026
**Versão:** 1.0
**Objetivo:** Avaliar se o produto está pronto para mercado, potencial financeiro e próximos passos.

---

## 1. Avaliação de Viabilidade Técnica

### 1.1 Estado atual do backend

O sistema possui backend Node.js/Express com API REST (`/v1/analyze`, `/v1/simulate`), ProviderRouter multi-provedor (WaveSpeedAI, Pika, Zhipu, CometAPI, fallback local), invariantes semânticas reais (validator.js) e CreditTracker com persistência em JSON. Foram realizados **1.283 testes** (unitários, propriedade, estresse, concorrência, timeout) com 0 falhas.

### 1.2 Gargalos técnicos remanescentes

| Gargalo | Classificação | Justificativa | Esforço (dias) |
|---------|---------------|----------------|----------------|
| Ausência de Redis para CreditTracker | **Pós-lançamento** | O CreditTracker usa arquivo JSON; com 1 worker (Railway starter) suporta 50-100 clientes. Redis só necessário para múltiplos workers (200+ clientes). | 2-3 |
| Ausência de multi-processo (cluster/PM2) | **Pós-lançamento** | O Node.js event loop assíncrono lida bem com requisições concorrentes (dezenas de clientes). Multi-processo é desejável para zero downtime e maior escala. | 1 |
| Ausência de gateway de pagamento | **Bloqueante para lançamento** | Sem integração com Asaas/Stripe, não é possível cobrar clientes. É o único bloqueio técnico real. | 1-2 |

**Cobertura de testes:** Excelente – 1.283 testes passando, incluindo stress e propriedades. Indica alta maturidade técnica.

**Deploy (Railway + Vercel):**
- Custo: Railway starter (grátis ou ~US$5/mês), Vercel (grátis).
- Escalabilidade: suficiente para MVP (dezenas de clientes).
- Simplicidade: deploy automático via Git, variáveis de ambiente, HTTPS nativo.

**Conclusão técnica:** O sistema está **pronto para MVP**, exceto pela integração com gateway de pagamento (1-2 dias de trabalho). Demais gargalos podem ser resolvidos após o lançamento.

---

## 2. Análise de Mercado (TAM / SAM / SOM)

### 2.1 Fontes utilizadas

- Número de lojas de materiais de construção no Brasil: **~152.960** (RAIS 2022, citado pelo Instituto ANAMACO). Não há dado específico para lojas exclusivas de pisos, mas é uma base conservadora.
- Taxa de digitalização do setor: **81% das lojas já possuem presença digital** (Instituto ANAMACO, 2025). Adotamos 20% como parcela com disposição a pagar por software de simulação (conservador).

### 2.2 TAM (Total Addressable Market)

- 150.000 lojas × ticket médio anual (plano Básico R$197 × 12 = R$2.364) = **R$ 354 milhões/ano**.
- Incluindo arquitetos e construtoras, o mercado potencial é maior, mas focaremos em lojistas.

### 2.3 SAM (Serviceable Addressable Market)

- 20% do TAM = **30.000 lojas** (que têm acesso à internet e provável interesse em ferramentas digitais).

### 2.4 SOM (Serviceable Obtainable Market – primeiros 12 meses)

- Canais de venda: pai do fundador + Raildo (lojista piloto). Capacidade operacional: estima-se alcançar 50-100 lojas nos primeiros 12 meses, com conversão de 5-10% → **2-10 clientes pagantes** no primeiro ano (cenário conservador). O cenário otimista (com mais canais) poderia atingir 30 clientes.

### 2.5 Comparação com concorrentes

| Concorrente | Preço (mensal) | Custo por simulação | Funcionalidades |
|-------------|----------------|----------------------|-----------------|
| Roomvo | ~R$ 500 | ~$0,10-0,20 | Simulação básica, fallback limitado |
| TilesView.ai | ~R$ 250 | ~$0,10-0,20 | Simulação, catálogo, sem invariantes |
| **PisosRealView** | **R$ 197** | **~R$ 0,03** | Fallback multi-provedor, invariantes semânticas, cache |

**Vantagem de preço:** superior a 50% (custo por simulação 20x menor). Classificação: **forte vantagem competitiva de preço**.

### 2.6 Demanda real (evidências indiretas)

- Mercado de reformas em alta (PIB da construção cresceu 0,5% em 2025, sexto ano seguido).
- Digitalização do varejo de pisos avançando (81% com presença digital).
- Ferramentas de simulação visual são cada vez mais usadas em e-commerce.

**Conclusão de mercado:** Mercado enorme, com vantagem competitiva clara. O desafio é a aquisição de clientes, não a demanda.

---

## 3. Projeção Financeira

### 3.1 Custos fixos mensais (estimativa)

- Railway: R$ 150 (plano starter)
- Vercel: R$ 0
- APIs (base, 0 simulações): R$ 50
- Domínio/SSL: R$ 30
- Gateway de pagamento (Asaas): 2,5% das transações
- Impostos (MEI): ~6% sobre faturamento
- **Total fixo (sem transações): ~R$ 230/mês**

### 3.2 Margem bruta por plano (plano Básico R$ 197)

- Custo API por cliente (50 simulações/mês): R$ 1,45
- Margem bruta: (197 - 1,45) / 197 = **99,3%**

### 3.3 Projeção de MRR (12 meses)

| Cenário | Clientes | MRR (R$) | Custo fixo (R$) | Comissão 30% (R$) | Gateway+impostos (~8,5%) | **Margem líquida (R$)** |
|---------|----------|----------|-----------------|-------------------|--------------------------|------------------------|
| Pessimista | 5 | 985 | 230 | 295 | 84 | **376** |
| Base | 15 | 2.955 | 230 | 886 | 251 | **1.588** |
| Otimista | 30 | 5.910 | 230 | 1.773 | 502 | **3.405** |

### 3.4 Break-even

- Com margem líquida por cliente (plano Básico) de aproximadamente R$ 100-120 (após custos e comissão), são necessários **2-3 clientes** para cobrir os custos fixos de R$ 230.
- **Classificação:** "financeiramente viável com baixo risco" (menos de 10 clientes para break-even).

### 3.5 Investimento inicial necessário

- Gateway de pagamento (Asaas): configuração gratuita
- Redis (opcional para futuro): US$ 0 (Upstash free tier)
- Domínio: ~R$ 40/ano
- Marketing inicial (Google Ads, tráfego): R$ 500-1.000 (opcional)
- **Total mínimo: R$ 40 (domínio) + tempo de configuração (1-2 dias).**

---

## 4. Análise de Riscos e Mitigação

| # | Risco | Severidade | Mitigação já implementada | Mitigação adicional |
|---|-------|------------|---------------------------|---------------------|
| 1 | **Adoção por lojistas** (não compram) | Alta | Produto validado tecnicamente, preço baixo | Piloto gratuito com Raildo, depoimentos, vídeo de demonstração |
| 2 | **Dependência da WaveSpeedAI** (API paga) | Média | Fallback multi-provedor (Pika, Zhipu, CometAPI, local) | Fine-tuning de modelo local (Qwen) para reduzir custo a zero |
| 3 | **Concorrência reagir com preços** | Baixa | Vantagem de custo 20x é estrutural (arquitetura, não subsídio) | Manter inovação (invariantes, fallback, cache) |
| 4 | **Churn alto** (cancelamentos) | Média | Nenhuma ainda | Coletar feedback cedo, oferecer suporte personalizado, plano anual com desconto |
| 5 | **Falta de gateway de pagamento** | Alta (bloqueante) | Nenhuma | **Ação urgente:** integrar Asaas antes do lançamento (1-2 dias) |
| 6 | **Escala não suportar muitos clientes** | Baixa | Arquitetura stateless, fallback local | Migrar CreditTracker para Redis quando ultrapassar 200 clientes |

---

## 5. Recomendação Final e Checklist Executivo

### 5.1 Recomendação

**Prosseguir com ressalvas** – o produto é tecnicamente maduro, financeiramente viável e tem forte vantagem competitiva. A única ressalva é a **falta do gateway de pagamento**, que é um bloqueio comercial, não técnico. Após integrar o Asaas (1-2 dias), o sistema estará pronto para o primeiro cliente pagante.

### 5.2 Condições para prosseguir

- Integrar Asaas (ou Stripe) para cobrança recorrente (urgente antes do lançamento).
- Configurar plano de testes com Raildo (primeiro cliente) e ajustar preços/usabilidade conforme feedback.

### 5.3 Próximos passos (ordem de prioridade)

1. **Integrar gateway de pagamento Asaas** (1-2 dias).
2. **Deploy final** (Railway + Vercel) com variáveis de ambiente seguras (1h).
3. **Configurar plano de testes grátis (50 simulações)** para Raildo e coletar feedback.
4. **Criar link de afiliado** para o pai do fundador (comissão 30%).
5. **Gravar vídeo de demonstração** (1-2 min) para usar na abordagem comercial.
6. **Seu pai iniciar vendas para lojistas** (abordagem direta).
7. **Monitorar churn e coletar métricas de uso** para ajustar planos.
8. **(Opcional) Criar landing page** para atrair leads orgânicos.
9. **Após 10 clientes, avaliar migração para Redis** (se necessário).
10. **Após 20 clientes, considerar campanhas pagas (Google/Facebook Ads).**

### 5.4 Checklist executivo (30 dias)

- [ ] **Integrar Asaas** (webhook, planos, checkout).
- [ ] **Deploy final** (Railway + Vercel) – obter URL pública.
- [ ] **Configurar 50 simulações grátis** (sem expiração de tempo) – via `plan: trial` no CreditTracker.
- [ ] **Oferecer teste gratuito para Raildo** (primeiro lojista).
- [ ] **Criar link de afiliado** para o pai (`?ref=pai`).
- [ ] **Gravar vídeo de demonstração** (mostrar simulação).
- [ ] **Seu pai abordar 3-5 lojistas** (incluindo Raildo).
- [ ] **Coletar feedback e ajustar** (preço, usabilidade).
- [ ] **Fechar primeiro cliente pagante** (R$ 197/mês).
- [ ] **Se receita positiva, reinvestir em marketing leve** (Google Ads segmentado).

---

**Conclusão final:** O PisosRealView é um produto **tecnicamente pronto e financeiramente viável**. A única ação crítica antes do lançamento é integrar o gateway de pagamento. Após isso, o foco deve ser 100% comercial – validar com lojistas reais e fechar os primeiros clientes. O projeto merece prosseguir.
