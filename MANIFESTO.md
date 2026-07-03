# Manifesto EscapeKit

## Introdução

Código gerado por IA é uma realidade. Ele acelera protótipos, desbloqueia ideias e reduz barreiras técnicas. Mas, muitas vezes, ele não sai do ambiente onde foi criado. Funciona perfeitamente no Google AI Studio, no Bolt.new, no Replit. E quebra assim que tentamos rodar fora dali.

O EscapeKit nasceu para quebrar esse ciclo. Ele não concorre com geradores de código; é a camada de qualidade que garante que o código gerado esteja pronto para produção.

Este manifesto descreve por que o EscapeKit existe, qual problema resolve e o que acreditamos.

## O Problema: O Ralph Loop Inverso

Ao usar um sandbox de IA, você recebe um código que parece funcional. Ele importa pacotes, chama APIs, usa recursos modernos. Mas quando você tenta executá-lo localmente ou implantá-lo, surgem problemas:

- **Ghost dependencies** – imports de pacotes que não existem no npm. São alucinações da IA que, se usadas, podem abrir brechas de segurança (typosquatting, supply-chain attacks).
- **Mock APIs** – chamadas a serviços que só existem dentro do sandbox (`mockapi.io`, `localhost`, endpoints fictícios). Não funcionam em produção.
- **Polyfills ausentes** – uso de APIs modernas (`fetch`, `IntersectionObserver`) sem suporte cross-browser.
- **Configurações obsoletas** – `tsconfig.json`, `vite.config.js`, `next.config.js` que seguem padrões antigos ou específicos do sandbox.
- **WebGL sem fallback** – componentes 3D que quebram em navegadores sem suporte.
- **Riscos de segurança** – credenciais expostas, validações ausentes.

Esse fenômeno se chama **Ralph Loop Inverso**: o desenvolvedor fica preso ao ambiente de geração, incapaz de levar o código para onde ele realmente precisa. Não é um erro isolado — é um problema sistêmico que afeta qualquer um que use IA para escrever código.

## A Solução: Validação e Correção Automática

O EscapeKit é a ponte entre o código gerado e o código pronto para produção. Ele:

1. **Detecta** – varre o projeto e identifica ghost dependencies, mock APIs, polyfills ausentes, configurações obsoletas, problemas de WebGL e riscos de segurança.
2. **Corrige** – substitui imports fantasmas por pacotes reais, injeta polyfills, gera fallbacks CSS2D/Canvas2D para WebGL, atualiza configurações, e até adiciona anotações de origem.
3. **Valida** – testa o resultado em ambientes reais (local, Docker, navegador) para garantir que funcione onde você precisa.

Não é um linter que só aponta problemas. É um **orquestrador de erros**: cada problema detectado é encaminhado para um **Fixer** especializado, que aplica a correção e revalida. O processo itera até que o projeto esteja sólido.

TypeScript, regras de lint e `package.json` não são burocracia. São **guardrails** — restrições que delimitam o espaço de código válido. O EscapeKit usa essas restrições como aliadas: quando o código gerado as viola, ele o guia de volta para dentro do espaço seguro.

O EscapeKit é também uma camada de **governança e rastreabilidade**: cada transformação é auditável, cada decisão é justificada, cada correção é rastreável.

## Filosofia

### 1. O erro como motor de melhoria

O código gerado por IA nunca é perfeito — e isso é esperado. Em vez de ver o erro como defeito, vemos como um **sinal** que guia o refinamento. O EscapeKit usa os erros para direcionar as correções, transformando código bruto em algo confiável.

### 2. Governança e rastreabilidade

Todo código que chega à produção deve ser auditável. O EscapeKit impõe políticas de qualidade: pode bloquear código não revisado, exigir que a origem seja registrada, e gerar um histórico de correções. Isso é essencial para empresas que precisam de compliance.

### 3. Roteamento e emergência

Cada validador detecta um tipo de problema, e cada Fixer sabe como corrigi-lo. O processo é semelhante a uma rede: os erros são roteados para os Fixers certos, e a solução emerge da interação entre os componentes, não de uma correção linear pré-definida.

### 4. A linguagem como guardrail

TypeScript, regras de lint, `package.json` — são restrições que delimitam o que é um código válido. O EscapeKit respeita essas restrições e, quando o código gerado as viola, força-o de volta para dentro do espaço seguro.

### 5. Adaptação ao novo paradigma

Ferramentas como Google AI Studio e Antigravity estão elevando o ponto de partida do desenvolvimento. O EscapeKit se reposiciona: não é mais uma ferramenta de "escape" para sandboxes básicas, mas sim uma **camada de qualidade** que deve ser aplicada a qualquer código gerado, independentemente da sofisticação do gerador.

## Valor para cada perfil

- **Para o desenvolvedor solo** – você gera um protótipo em minutos. O EscapeKit garante que ele não vai quebrar quando você tentar fazer o deploy. Economiza horas de depuração e reduz a dívida técnica.
- **Para times de desenvolvimento** – a ferramenta pode ser integrada ao CI/CD, bloqueando PRs que contenham ghost dependencies ou configurações obsoletas. Torna o código gerado por IA confiável para todo o time.
- **Para empresas** – governança e rastreabilidade. O EscapeKit pode exigir que código gerado por IA passe por validação antes de entrar na base principal, registrar a origem e impedir que vulnerabilidades de supply-chain entrem.
- **Para não-técnicos (gestores, PMs)** – você reduz o risco de projetos travarem por causa de "problemas de ambiente". O tempo de desenvolvimento se torna mais previsível, e a qualidade do entregável sobe.

## Visão de Futuro

Queremos um mundo onde **todo código gerado por IA seja portável, auditável e pronto para produção**. Onde o desenvolvedor não precise se preocupar com dependências fantasmas ou configurações erradas — onde a IA cria, e o EscapeKit garante.

Estamos explorando integrações nativas com os principais geradores (Google AI Studio, Bolt.new, Replit). Imagine: você gera um app no Antigravity, e ao exportar, o EscapeKit já roda automaticamente, mostrando os problemas corrigidos e entregando um projeto pronto para subir em produção.

Não fazemos promessas de datas. Mas essa direção é clara: o EscapeKit será o **companheiro de qualidade** de qualquer código gerado por IA.

## Fundamentos Acadêmicos

O EscapeKit e o PisosRealView são construídos sobre princípios validados pela pesquisa acadêmica. Esta seção mapeia os papers que influenciam diretamente o código.

### Papers com Aplicação Imediata

**BEST-Route (ICML 2025)**
Otimização de múltiplos objetivos para roteamento de modelos: maximizar qualidade dado um orçamento de custo. Influencia o `TaskMetrics.getScore()` e `getBestForBudget()` — a fórmula de score composto (fidelidade × latência × eficiência de custo) é derivada diretamente deste trabalho. Resultado prático: redução de custo de até 60% com menos de 1% de perda de performance.

**IRT-Router — Item Response Theory Router (USTC)**
Modela "dificuldade da tarefa" e "habilidade do modelo" como variáveis separadas, cruzando-as para roteamento ótimo. Influencia o `ProviderRouter._selectProviders()` — o `DifficultyEstimator` estima a dificuldade da tarefa, e o `TaskMetrics` estima a habilidade histórica de cada provedor para aquela dificuldade. A promoção IRT no `_selectProviders` é a implementação direta deste conceito.

**Talk Less, Verify More (2026)**
Defende arquitetura "gerador-verificador" com scores semânticos contínuos em vez de validação binária. Influencia o `validator.js` — as invariantes (sombras, geometria, objetos, perspectiva) agora retornam scores [0.0, 1.0] com thresholds configuráveis. O próximo passo é substituir os stubs por chamadas a CLIP via Replicate (~$0.001/validação vs. ~$0.05/geração).

### Roadmap Acadêmico (6-18 meses)

**ZeroRouter (AAAI 2026, USTC)**
Espaço latente universal que separa caracterização da consulta do perfil dos modelos. Relevante quando o sistema tiver 10+ provedores e precisar adicionar novos sem retreinar. Hoje com 4 provedores é overhead desnecessário.

**Avengers-Pro (Shanghai AI Lab)**
Sistema de roteamento multi-modelo com clustering semântico e scoring de custo-benefício. Relevante para escala industrial com múltiplos clientes e perfis de uso distintos.

**Aegaeon (Universidade de Pequim + Alibaba)**
GPU pooling inteligente: um único GPU atende até 7 modelos com redução de hardware de 82%. Relevante quando o sistema tiver GPUs próprias para inferência local.

**MoMA — Mixture of Models and Agents (China Mobile)**
Motor de agregação que entende intenção do usuário e direciona para o executor ideal. Relevante para a evolução do ProviderRouter em um orquestrador de agentes especializados.

## Convite

O EscapeKit é um projeto aberto, construído por quem acredita que a IA deve aumentar, não limitar, o desenvolvedor.

- **Use** – `npx escapekit validate . --auto-fix`. Teste em seus projetos.
- **Contribua** – código, documentação, ideias. Toda ajuda é bem-vinda.
- **Compartilhe** – se você já esbarrou no problema das sandboxes, mostre esta ferramenta para quem pode se beneficiar.

A melhor maneira de quebrar o Ralph Loop Inverso é construindo, juntos, um ecossistema onde código gerado por IA é tão confiável quanto o escrito à mão.

Vamos escapar. 🚀
