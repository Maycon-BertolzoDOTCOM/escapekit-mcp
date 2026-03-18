# Guia de Dashboards do Kiwi TCMS

Este guia explica como criar e configurar dashboards no Kiwi TCMS para monitoramento contínuo dos testes do EscapeKit.

## Índice

- [Visão Geral](#visão-geral)
- [Dashboard 1: Taxa de Aprovação de Testes](#dashboard-1-taxa-de-aprovação-de-testes)
- [Dashboard 2: Distribuição de Falhas](#dashboard-2-distribuição-de-falhas)
- [Dashboard 3: Performance de Testes](#dashboard-3-performance-de-testes)
- [Dashboard 4: Resumo Executivo](#dashboard-4-resumo-executivo)
- [Embedding Dashboards](#embedding-dashboards)
- [Melhores Práticas](#melhores-práticas)

---

## Visão Geral

O Kiwi TCMS permite criar dashboards personalizáveis para visualizar métricas de testes em tempo real. Para o EscapeKit, criaremos 4 dashboards principais:

1. **Taxa de Aprovação** - Monitoramento contínuo da qualidade
2. **Distribuição de Falhas** - Identificação de áreas problemáticas
3. **Performance** - Monitoramento de tempo de execução
4. **Resumo Executivo** - Visão geral para stakeholders

---

## Dashboard 1: Taxa de Aprovação de Testes

### Objetivo

Monitorar a evolução da taxa de aprovação dos testes ao longo do tempo, com alertas visuais para quedas de qualidade.

### Métricas

- **Taxa de Aprovação**: % de testes passados
- **Baseline**: 95% (referência de qualidade)
- **Tendência**: Melhora ou degradação
- **Delta**: Diferença em relação ao build anterior

### Passos para Criar

1. Acesse o Kiwi TCMS: http://localhost:8080
2. Clique em **Dashboards** > **New Dashboard**
3. Nome: `Taxa de Aprovação de Testes`
4. Clique em **Add Widget** e configure:

#### Widget 1: Gráfico de Linha (Taxa de Aprovação ao Longo do Tempo)

```
Tipo: Line Chart
Título: Taxa de Aprovação (Últimos 30 dias)
Eixo X: Data (Test Runs)
Eixo Y: % Passados
Baseline: 95% (linha pontilhada verde)
Cor: Verde (>=95%), Amarelo (90-95%), Vermelho (<90%)
```

#### Widget 2: Número Grande (Taxa Atual)

```
Tipo: Big Number
Título: Taxa de Aprovação Atual
Valor: % Passados no último build
Cor: Verde (>=95%), Amarelo (90-95%), Vermelho (<90%)
Tendência: Δ vs build anterior
```

#### Widget 3: Gráfico de Barras (Por Módulo)

```
Tipo: Bar Chart
Título: Taxa de Aprovação por Módulo
Eixo X: Módulos (detectors, analyzers, transformers, etc.)
Eixo Y: % Passados
Ordenação: Descendente (piores primeiro)
```

#### Widget 4: Tabela de Últimos Builds

```
Tipo: Table
Título: Últimos Builds
Colunas: Data, Build ID, Passados, Falhados, % Aprovação, Delta
Ordenação: Data descendente
```

### Interpretação

- 🟢 **Verde (≥95%)**: Qualidade excelente
- 🟡 **Amarelo (90-95%)**: Atenção necessária
- 🔴 **Vermelho (<90%)**: Ação imediata necessária
- 📈 **Tendência positiva**: Melhoria contínua
- 📉 **Tendência negativa**: Investigar regressões

### Exemplo de Visualização

```
┌─────────────────────────────────────────┐
│ Taxa de Aprovação de Testes           │
├─────────────────────────────────────────┤
│                                         │
│  100% ┤╭─╮                            │
│   95% ┤│ ╰╮ ╭─╮   ← baseline          │
│   90% ┤│  ╰─╯ ╰─╮                      │
│   85% ┤│        ╰─╮                     │
│   80% ┤│          ╰──                   │
│        └──────────────────→ Tempo       │
│                                         │
├─────────────────────────────────────────┤
│ 96.2%  ▲  +1.3%  (vs build anterior)  │
├─────────────────────────────────────────┤
│ Top 5 Módulos com Menor Aprovação:    │
│ • WebGLDetector: 78.5% (-2.1%)         │
│ • SecurityValidator: 82.3% (-0.5%)     │
│ • DeepDependencyScanner: 85.7% (+0.3%)  │
│ • RateLimiter: 88.1% (+1.2%)          │
│ • SandboxDetector: 91.4% (+0.8%)       │
└─────────────────────────────────────────┘
```

---

## Dashboard 2: Distribuição de Falhas

### Objetivo

Identificar quais módulos e testes estão falhando com mais frequência para priorizar correções.

### Métricas

- **Falhas por Módulo**: Contagem de testes falhados por módulo
- **Top 10 Falhas**: Testes que mais falharam
- **Hotmap**: Distribuição de falhas por componente
- **Tendência de Falhas**: Aumento ou diminuição

### Passos para Criar

1. Crie um novo dashboard: `Distribuição de Falhas`
2. Clique em **Add Widget** e configure:

#### Widget 1: Gráfico de Barras (Falhas por Módulo)

```
Tipo: Bar Chart
Título: Top 10 Módulos com Mais Falhas
Eixo X: Módulos
Eixo Y: Contagem de Falhas
Ordenação: Descendente
Cor: Gradiente de vermelho
```

#### Widget 2: Lista (Top 10 Testes com Mais Falhas)

```
Tipo: List
Título: Testes Mais Instáveis (Últimos 30 dias)
Colunas: Teste, Falhas, Última Falha, Módulo
Ordenação: Falhas descendente
```

#### Widget 3: Hotmap (Distribuição de Falhas)

```
Tipo: Heatmap
Título: Hotmap de Falhas por Componente
Eixo X: Data (últimos 30 dias)
Eixo Y: Componentes
Cor: Branco (0 falhas) → Vermelho escuro (muitas falhas)
```

#### Widget 4: Gráfico de Pizza (Falhas por Categoria)

```
Tipo: Pie Chart
Título: Distribuição de Tipos de Falhas
Categorias:
  • Regressões (novas falhas)
  • Flaky tests (alternam sucesso/falha)
  • Falhas recorrentes (repetitivas)
  • Unknown (outros)
```

### Interpretação

- 🔥 **Hotspots**: Módulos com muitas falhas recentes
- 🔄 **Flaky Tests**: Testes que alternam entre sucesso e falha
- 📈 **Tendência Crescente**: Regressão introduzida
- 📉 **Tendência Decrescente**: Correções eficazes

### Ações Recomendadas

1. **Para Hotspots**:
   - Priorizar correções
   - Investigar causa raiz
   - Considerar refactoring

2. **Para Flaky Tests**:
   - Adicionar retries
   - Melhorar isolamento
   - Fixar dependências

3. **Para Regressões**:
   - Identificar commit responsável
   - Reverter mudanças críticas
   - Melhorar testes de regressão

---

## Dashboard 3: Performance de Testes

### Objetivo

Monitorar o tempo de execução dos testes para identificar degradações de performance e otimizar o CI/CD.

### Métricas

- **Tempo Médio de Execução**: Média por suite
- **P90/P95/P99**: Tempos em percentis
- **Testes Lentos**: Testes > 10s
- **Tendência de Performance**: Melhoria ou degradação

### Passos para Criar

1. Crie um novo dashboard: `Performance de Testes`
2. Clique em **Add Widget** e configure:

#### Widget 1: Gráfico de Linha (Tempo Médio)

```
Tipo: Line Chart
Título: Tempo Médio de Execução (Últimos 30 dias)
Eixo X: Data (Test Runs)
Eixo Y: Tempo médio (segundos)
Baseline: Média histórica
```

#### Widget 2: Gráfico de Barras (Testes Mais Lentos)

```
Tipo: Bar Chart
Título: Top 10 Testes Mais Lentos
Eixo X: Testes
Eixo Y: Tempo de execução (segundos)
Ordenação: Descendente
Cor: Gradiente de laranja
```

#### Widget 3: Box Plot (Distribuição)

```
Tipo: Box Plot
Título: Distribuição de Tempos de Execução
Eixo X: Suites de Testes
Eixo Y: Tempo de execução (segundos)
Mostrar: Mediana, P25, P75, Outliers
```

#### Widget 4: Número Grande (Tempo Total)

```
Tipo: Big Number
Título: Tempo Total de Execução
Valor: Tempo total do último build
Unidade: Minutos
Delta: vs build anterior
```

### Thresholds de Performance

- 🟢 **Excelente**: < 5 minutos
- 🟡 **Aceitável**: 5-10 minutos
- 🟠 **Lento**: 10-15 minutos
- 🔴 **Crítico**: > 15 minutos

### Interpretação

- ?? **Tendência Crescente**: Degradação de performance
- 📉 **Tendência Decrescente**: Melhoria de performance
- ⚡ **Spikes**: Investigar testes específicos
- 🐌 **Testes Lentos**: Otimizar ou paralelizar

### Ações Recomendadas

1. **Para Degradação de Performance**:
   - Identificar testes que aumentaram o tempo
   - Otimizar queries I/O
   - Reduzir mocks/stubs pesados

2. **Para Testes Lentos**:
   - Mover para suites de integração
   - Implementar caching
   - Paralelizar testes

---

## Dashboard 4: Resumo Executivo

### Objetivo

Fornecer uma visão geral rápida para stakeholders sem detalhes técnicos.

### Métricas

- **Status Geral**: Verde/Amarelo/Vermelho
- **Taxa de Aprovação**: % atual
- **Total de Testes**: Número total
- **Último Build**: Data e status

### Passos para Criar

1. Crie um novo dashboard: `Resumo Executivo`
2. Clique em **Add Widget** e configure:

#### Widget 1: Status Geral (Traffic Light)

```
Tipo: Status Indicator
Título: Status Geral dos Testes
Lógica:
  • Verde (≥95%): "Excelente"
  • Amarelo (90-95%): "Atenção"
  • Vermelho (<90%): "Crítico"
```

#### Widget 2: Resumo de Métricas

```
Tipo: Metric Group
Título: Métricas Principais
Métricas:
  • Taxa de Aprovação: 96.2%
  • Total de Testes: 1,121
  • Passados: 1,089
  • Falhados: 32
  • Ignorados: 0
```

#### Widget 3: Tendência (Últimos 7 dias)

```
Tipo: Sparkline
Título: Tendência de Qualidade (7 dias)
Dados: Taxa de aprovação diária
Mostrar: Mínimo, Máximo, Média
```

#### Widget 4: Lista de Ações

```
Tipo: Action List
Título: Ações Recomendadas
Baseado em:
  • Falhas críticas: Priorizar correções
  • Degradação de performance: Otimizar
  • Flaky tests: Estabilizar
  • Novos testes: Cobrir lacunas
```

### Interpretação para Stakeholders

- 🟢 **Verde**: Sistema saudável, continue assim
- 🟡 **Amarelo**: Atenção necessária, investigar causas
- 🔴 **Vermelho**: Ação imediata, priorizar correções

---

## Embedding Dashboards

### Em Sites Internos

Para embutir dashboards em sites internos:

```html
<iframe
  src="http://localhost:8080/dashboard/1"
  width="100%"
  height="600px"
  frameborder="0"
></iframe>
```

### Em Documentação Markdown

Para incluir dashboards na documentação:

```markdown
![Dashboard de Taxa de Aprovação](http://localhost:8080/dashboard/1/export/png)
```

### Link Direto para Dashboard

Crie links diretos para dashboards específicos:

- Taxa de Aprovação: http://localhost:8080/dashboard/1
- Distribuição de Falhas: http://localhost:8080/dashboard/2
- Performance: http://localhost:8080/dashboard/3
- Resumo Executivo: http://localhost:8080/dashboard/4

---

## Melhores Práticas

### 1. Manter Dashboards Simples

- ✅ Máximo de 4-6 widgets por dashboard
- ✅ Usar cores consistentes (verde/amarelo/vermelho)
- ✅ Incluir baselines para contexto
- ❌ Evitar widgets redundantes

### 2. Atualização em Tempo Real

- ✅ Configurar refresh automático (1-5 minutos)
- ✅ Usar webhooks para atualizações imediatas
- ✅ Cache queries para performance
- ❌ Evitar atualizações muito frequentes (< 30s)

### 3. Acessibilidade

- ✅ Usar alto contraste
- ✅ Incluir descrições de texto
- ✅ Suportar temas claro/escuro
- ✅ Responsivo para mobile

### 4. Manutenção

- ✅ Revisar dashboards mensalmente
- ✅ Remover widgets não utilizados
- ✅ Ajustar thresholds conforme necessário
- ✅ Documentar mudanças

---

## Próximos Passos

Após criar os dashboards:

1. ✅ Testar com dados reais
2. ✅ Configurar alertas automáticos (Slack)
3. ✅ Compartilhar com a equipe
4. ✅ Monitorar uso e ajustar conforme feedback
5. ✅ Criar dashboards adicionais se necessário

---

**Última atualização**: 2026-03-17  
**Versão**: 1.0.0  
**Fase**: Fase 4 - Monitoramento e Alertas