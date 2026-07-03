# Documento de Requisitos

## Introdução

Este documento define a cadeia de periodização (roadmap procedural) do produto **CodeMemória** — plataforma de governança de código gerado por IA com arquitetura "zero-ops com soberania". O produto é posicionado como "anti-Copilot": vende responsabilidade e compliance em vez de velocidade.

A cadeia é composta por **7 fases sequenciais e dependentes**. Cada fase possui critérios de entrada (gates de entrada) e critérios de saída (gates de saída) que devem ser satisfeitos antes de avançar para a fase seguinte. A ordem reflete prioridade estratégica: tração primeiro, monetização depois, moat técnico e regulatório por último.

A arquitetura central é "zero-ops com soberania": o navegador vira o datacenter do cliente usando WASM + WebGPU + IndexedDB/OPFS + Service Workers. Zero dados saem do dispositivo do cliente.

---

## Glossário

- **CodeMemória**: Nome do produto de governança de código gerado por IA.
- **GovernanceEngine**: Orquestrador principal já implementado em `src/governance/GovernanceEngine.ts`.
- **ComplianceCheckerAdapter**: Adaptador de verificação de compliance já implementado em `src/governance/adapters/ComplianceCheckerAdapter.ts`.
- **HybridMemoryAdapter**: Adaptador de memória híbrida (SQLite + Chroma) já implementado em `src/governance/adapters/HybridMemoryAdapter.ts`.
- **AuditLoggerAdapter**: Adaptador de trilha de auditoria já implementado em `src/governance/adapters/AuditLoggerAdapter.ts`.
- **FederatedMemoryAdapter**: Adaptador de memória federada já implementado em `src/governance/adapters/FederatedMemoryAdapter.ts`.
- **CLI**: Interface de linha de comando existente em `src/cli/index.ts`.
- **Federated_Server**: Servidor Python existente em `federated-server/`.
- **VS_Code_Extension**: Extensão para o editor VS Code que expõe análise local e risk score em tempo real.
- **GitHub_Action**: Ação de CI/CD para GitHub que gera compliance report automático em pull requests.
- **CISO_Dashboard**: Painel de visualização enterprise para CISOs com visão multi-repositório.
- **VectorMemory**: Camada de memória vetorial local usando IndexedDB/OPFS + WASM para análise offline soberana.
- **Risk_Score**: Pontuação de risco calculada pelo GovernanceEngine para um trecho de código (low/medium/high/critical).
- **Compliance_Report**: Artefato JSON estruturado com issues, hash de integridade, timestamp e referências normativas.
- **GovernancePassport**: Documento imutável gerado para cada execução de governança.
- **Paper_to_Contract**: Pipeline que transforma papers acadêmicos em contratos YAML executáveis (IP proprietário).
- **ComponentPool**: Repositório de componentes validados com rastreabilidade acadêmica (IP proprietário).
- **Open_Core**: Estratégia onde o engine de análise é open source e os módulos de alto valor são proprietários.
- **Gate_de_Entrada**: Conjunto de condições que devem ser verdadeiras para iniciar uma fase.
- **Gate_de_Saída**: Conjunto de condições que devem ser verdadeiras para concluir uma fase e avançar.
- **FIPS_140_2**: Federal Information Processing Standard para módulos criptográficos.
- **SOC_2_Type_II**: Certificação de auditoria de controles de segurança, disponibilidade e confidencialidade.
- **LGPD**: Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
- **OWASP**: Open Web Application Security Project — referência normativa para vulnerabilidades web.
- **Freemium**: Modelo de negócio onde funcionalidades básicas são gratuitas e avançadas são pagas.
- **Land_and_Expand**: Estratégia de vendas onde a adoção individual leva à compra enterprise.
- **WASM**: WebAssembly — formato binário para execução de código no navegador com performance próxima ao nativo.
- **OPFS**: Origin Private File System — API de sistema de arquivos privado do navegador.
- **Viralidade_Técnica**: Mecanismo onde o uso da ferramenta por um desenvolvedor expõe o produto a outros desenvolvedores.

---

## Requisitos

### Requisito 1: Fase 1 — VS Code Extension (Entry Point)

**User Story:** Como desenvolvedor que usa VS Code, quero uma extensão que analise o arquivo aberto e exiba o risk score em tempo real, para que eu possa identificar riscos de compliance no código gerado por IA sem sair do meu editor.

#### Gate de Entrada

- GovernanceEngine, ComplianceCheckerAdapter e AuditLoggerAdapter estão implementados e com testes passando.
- CLI existente (`src/cli/index.ts`) expõe análise via linha de comando.
- Pelo menos 1 contrato YAML em `./contracts/` está carregado e funcional.

#### Critérios de Aceitação

1. THE VS_Code_Extension SHALL analisar o arquivo atualmente aberto no editor usando o GovernanceEngine local, sem enviar o conteúdo do arquivo para nenhum servidor externo.
2. WHEN o usuário abre ou salva um arquivo TypeScript ou JavaScript, THE VS_Code_Extension SHALL calcular e exibir o Risk_Score na barra de status do VS Code em até 3 segundos.
3. WHEN o Risk_Score for `high` ou `critical`, THE VS_Code_Extension SHALL sublinhar os trechos problemáticos com diagnósticos inline no editor (usando a VS Code Diagnostics API).
4. THE VS_Code_Extension SHALL expor um comando de paleta `CodeMemória: Analyze File` que executa análise completa e abre um painel lateral com o GovernancePassport completo.
5. WHEN o usuário clica em um diagnóstico inline, THE VS_Code_Extension SHALL exibir a cláusula de compliance violada e a referência normativa (LGPD/OWASP) correspondente.
6. IF o GovernanceEngine falhar durante a análise, THEN THE VS_Code_Extension SHALL exibir uma notificação de erro não-bloqueante e manter o último Risk_Score conhecido na barra de status.
7. THE VS_Code_Extension SHALL funcionar completamente offline, sem dependência de rede para análise de código.
8. FOR ALL arquivos analisados pela VS_Code_Extension, THE GovernanceEngine SHALL produzir um GovernancePassport idêntico ao produzido pela CLI para o mesmo arquivo (propriedade de equivalência CLI/extensão).

#### Gate de Saída

- Extensão publicada no VS Code Marketplace (mesmo que como preview/beta).
- Pelo menos 50 instalações ativas nos primeiros 30 dias.
- Taxa de erro de análise inferior a 5% das execuções.

---

### Requisito 2: Fase 2 — GitHub Action para Compliance Report em PRs

**User Story:** Como mantenedor de repositório, quero uma GitHub Action que gere automaticamente um compliance report em cada pull request, para que toda a equipe veja o risco de compliance do código antes do merge.

#### Gate de Entrada

- Fase 1 concluída (Gate de Saída da Fase 1 satisfeito).
- CLI expõe o subcomando `report generate` com saída JSON estruturada.
- Compliance_Report inclui hash de integridade e referências normativas.

#### Critérios de Aceitação

1. THE GitHub_Action SHALL ser distribuída como uma action pública no GitHub Marketplace com o identificador `codememoría/compliance-check@v1`.
2. WHEN um pull request é aberto ou atualizado, THE GitHub_Action SHALL executar o GovernanceEngine nos arquivos modificados e postar um comentário no PR com o Compliance_Report resumido.
3. THE GitHub_Action SHALL executar inteiramente dentro do runner do GitHub Actions, sem enviar código para servidores externos (soberania de dados no CI).
4. WHEN o Risk_Score médio dos arquivos modificados for `high` ou `critical`, THE GitHub_Action SHALL marcar o check do PR como `failure`, bloqueando o merge se branch protection estiver ativo.
5. WHEN o Risk_Score médio for `low` ou `medium`, THE GitHub_Action SHALL marcar o check do PR como `success` e postar o relatório como comentário informativo.
6. THE GitHub_Action SHALL incluir no comentário do PR um badge SVG com o Risk_Score geral do PR, para viralidade visual no feed do GitHub.
7. THE GitHub_Action SHALL ser configurável via arquivo `.codememoría.yml` na raiz do repositório, permitindo definir: lista de arquivos a ignorar, threshold de risco para falha, e contratos YAML customizados.
8. IF o arquivo `.codememoría.yml` não existir, THEN THE GitHub_Action SHALL usar configuração padrão com threshold `high` para falha.
9. FOR ALL pull requests processados, THE GitHub_Action SHALL garantir que o hash de integridade do Compliance_Report postado no PR é verificável localmente com a CLI (propriedade de verificabilidade cross-ambiente).

#### Gate de Saída

- Action publicada no GitHub Marketplace.
- Pelo menos 100 repositórios usando a action (medido via GitHub API de uso público).
- Pelo menos 10 PRs bloqueados por compliance em repositórios externos (evidência de valor real).

---

### Requisito 3: Fase 3 — Dashboard de CISO

**User Story:** Como CISO ou líder de engenharia, quero um dashboard que consolide vulnerabilidades e compliance de múltiplos repositórios, para que eu possa tomar decisões de risco com visibilidade completa do portfólio de código.

#### Gate de Entrada

- Fase 2 concluída (Gate de Saída da Fase 2 satisfeito).
- Pelo menos 1 empresa usando a GitHub Action em múltiplos repositórios.
- Federated_Server operacional e capaz de agregar dados de múltiplos projetos.

#### Critérios de Aceitação

1. THE CISO_Dashboard SHALL ser uma aplicação web que consolida GovernancePassports de múltiplos repositórios em uma única visão, usando o Federated_Server como backend de agregação.
2. THE CISO_Dashboard SHALL exibir, por repositório: número total de issues por severidade, Risk_Score médio histórico, tendência de risco (melhorando/piorando) e lista dos 10 issues mais críticos.
3. WHEN um novo GovernancePassport é gerado (via GitHub Action ou CLI), THE CISO_Dashboard SHALL atualizar a visão do repositório correspondente em até 60 segundos.
4. THE CISO_Dashboard SHALL permitir filtrar issues por tipo (sql_injection, hardcoded_secret, etc.), severidade, repositório e intervalo de datas.
5. THE CISO_Dashboard SHALL exportar um relatório executivo em PDF contendo: sumário de risco por repositório, top 10 vulnerabilidades críticas, tendência histórica de 90 dias e referências normativas (LGPD, OWASP).
6. THE CISO_Dashboard SHALL implementar autenticação via OAuth 2.0 com GitHub, restringindo acesso apenas a membros da organização GitHub configurada.
7. IF um repositório não tiver GovernancePassports nos últimos 30 dias, THEN THE CISO_Dashboard SHALL exibir um alerta de "repositório sem auditoria recente" na visão consolidada.
8. THE CISO_Dashboard SHALL ser acessível via navegador moderno (Chrome 120+, Firefox 120+, Safari 17+) sem instalação de software adicional.
9. FOR ALL dados exibidos no CISO_Dashboard, THE sistema SHALL garantir que os valores são derivados exclusivamente de GovernancePassports com hash de integridade verificado (propriedade de rastreabilidade).

#### Gate de Saída

- Pelo menos 3 empresas usando o CISO_Dashboard em produção.
- Pelo menos 1 contrato enterprise assinado (conversão "dev free" → "empresa pagando").
- NPS (Net Promoter Score) de CISOs usuários ≥ 30.

---

### Requisito 4: Fase 4 — Memória Vetorial Local (Moat Técnico)

**User Story:** Como desenvolvedor ou empresa com requisitos de soberania de dados, quero que toda análise e memória vetorial opere localmente no meu dispositivo, para que nenhum dado de código saia do meu ambiente.

#### Gate de Entrada

- Fase 3 concluída (Gate de Saída da Fase 3 satisfeito).
- HybridMemoryAdapter operacional com SQLite.
- Pelo menos 1 cliente enterprise com requisito explícito de soberania de dados documentado.

#### Critérios de Aceitação

1. THE VectorMemory SHALL armazenar embeddings de GovernancePassports exclusivamente em IndexedDB ou OPFS no dispositivo do usuário, sem transmitir vetores para servidores externos.
2. THE VectorMemory SHALL usar um modelo de embedding compilado em WASM, executado inteiramente no navegador ou no processo Node.js local, sem chamadas a APIs de embedding externas.
3. WHEN o usuário solicita análise de um trecho de código, THE VectorMemory SHALL buscar os 5 GovernancePassports mais similares na memória local usando similaridade de cosseno, retornando resultados em até 500ms para bases de até 10.000 passaportes.
4. THE VectorMemory SHALL funcionar completamente offline após a primeira inicialização, sem dependência de rede para busca ou armazenamento.
5. WHEN o dispositivo não suportar WebGPU, THE VectorMemory SHALL usar WASM como fallback para computação de embeddings, sem degradar a funcionalidade de busca.
6. THE VectorMemory SHALL implementar compressão de vetores usando quantização de 8 bits, reduzindo o uso de IndexedDB/OPFS em pelo menos 60% comparado a vetores float32 sem compressão.
7. IF o armazenamento local disponível for inferior a 100MB, THEN THE VectorMemory SHALL aplicar política de eviction LRU (Least Recently Used), removendo os passaportes menos acessados para liberar espaço.
8. FOR ALL embeddings armazenados e recuperados, THE VectorMemory SHALL garantir que a similaridade de cosseno calculada localmente é equivalente (diferença < 0.001) à calculada com os vetores originais antes da quantização (propriedade de fidelidade de quantização).

#### Gate de Saída

- Benchmark público demonstrando análise offline de 1.000 arquivos sem conexão de rede.
- Pelo menos 1 cliente enterprise validando a soberania de dados em auditoria interna.
- Tamanho do bundle WASM inferior a 5MB para distribuição via extensão VS Code.

---

### Requisito 5: Fase 5 — Certificações Regulatórias

**User Story:** Como CISO de empresa regulada, quero que o CodeMemória possua certificações FIPS 140-2 e SOC 2 Type II, para que eu possa aprovar o uso da ferramenta nos processos de procurement e auditoria interna.

#### Gate de Entrada

- Fase 4 concluída (Gate de Saída da Fase 4 satisfeito).
- Pelo menos 3 clientes enterprise em produção com contratos ativos.
- AuditLoggerAdapter com cadeia de hashes imutável operacional e auditada internamente.

#### Critérios de Aceitação

1. THE GovernanceEngine SHALL usar exclusivamente algoritmos criptográficos aprovados pelo FIPS 140-2 para todas as operações de hash (SHA-256, SHA-384 ou SHA-512), sem uso de MD5 ou SHA-1.
2. THE AuditLoggerAdapter SHALL manter logs de auditoria imutáveis por no mínimo 1 ano, com política de retenção configurável pelo administrador.
3. THE sistema SHALL implementar controle de acesso baseado em papéis (RBAC) com no mínimo os papéis: `viewer` (leitura de relatórios), `analyst` (execução de análises) e `admin` (configuração e exportação).
4. WHEN qualquer operação de acesso a dados sensíveis é realizada, THE AuditLoggerAdapter SHALL registrar: identidade do ator, timestamp, operação realizada, recurso acessado e resultado (sucesso/falha).
5. THE sistema SHALL passar por auditoria externa de segurança (penetration test) sem vulnerabilidades críticas ou altas não-remediadas antes da submissão para SOC 2.
6. THE sistema SHALL implementar criptografia em repouso para todos os GovernancePassports armazenados localmente, usando AES-256-GCM.
7. IF uma tentativa de acesso não autorizado for detectada, THEN THE sistema SHALL bloquear o acesso, registrar o evento no AuditLoggerAdapter e notificar o administrador configurado.
8. THE sistema SHALL produzir evidências de controle exportáveis no formato exigido pelo auditor SOC 2 (relatórios de acesso, logs de mudança, inventário de ativos).
9. FOR ALL operações criptográficas realizadas pelo GovernanceEngine, THE sistema SHALL garantir que os algoritmos usados estão na lista aprovada FIPS 140-2 (propriedade de conformidade criptográfica verificável por inspeção de código).

#### Gate de Saída

- Certificação FIPS 140-2 obtida para o módulo criptográfico.
- Relatório SOC 2 Type II emitido por auditor independente.
- Pelo menos 1 contrato enterprise onde a certificação foi requisito de procurement.

---

### Requisito 6: Fase 6 — Open Core Estratégico

**User Story:** Como líder de produto, quero definir e implementar a estratégia Open Core, para que o engine de análise ganhe adoção pela comunidade enquanto os módulos de alto valor permanecem como IP proprietário e fonte de receita.

#### Gate de Entrada

- Fase 5 concluída (Gate de Saída da Fase 5 satisfeito).
- GovernanceEngine estável com API pública documentada.
- Paper_to_Contract e ComponentPool identificados como IP proprietário diferenciado.

#### Critérios de Aceitação

1. THE GovernanceEngine SHALL ser publicado como pacote open source sob licença Apache 2.0 no npm, com documentação completa de API e exemplos de uso.
2. THE Paper_to_Contract SHALL permanecer como módulo proprietário, não incluído no pacote open source, acessível apenas via assinatura do plano enterprise.
3. THE ComponentPool SHALL permanecer como módulo proprietário, não incluído no pacote open source, acessível apenas via assinatura do plano enterprise.
4. THE pacote open source SHALL incluir interfaces públicas (`IGovernanceEngine`, `IHybridMemory`, `IComplianceChecker`, `IAuditLogger`) que permitam à comunidade implementar adaptadores customizados.
5. WHEN um adaptador customizado da comunidade implementa as interfaces públicas, THE GovernanceEngine SHALL aceitar o adaptador via injeção de dependência sem modificação do core.
6. THE repositório open source SHALL incluir um guia de contribuição (CONTRIBUTING.md) e um código de conduta (CODE_OF_CONDUCT.md) antes da publicação.
7. THE sistema SHALL implementar telemetria opt-in no pacote open source, coletando apenas: versão usada, tipo de análise executada (sem código) e resultado agregado (risk level), para informar o roadmap.
8. IF um usuário do pacote open source tentar usar funcionalidades proprietárias (Paper_to_Contract, ComponentPool), THEN THE sistema SHALL retornar um erro descritivo indicando que a funcionalidade requer assinatura enterprise, com link para a página de upgrade.
9. FOR ALL versões do pacote open source publicadas, THE sistema SHALL garantir que a API pública é retrocompatível com a versão anterior (sem breaking changes em minor versions).

#### Gate de Saída

- Pacote open source com pelo menos 500 stars no GitHub nos primeiros 90 dias.
- Pelo menos 5 contribuições externas (PRs mergeados) da comunidade.
- Pelo menos 2 empresas usando o pacote open source que converteram para plano enterprise.

---

### Requisito 7: Fase 7 — Case Study de "Quase Desastre"

**User Story:** Como líder de marketing de produto, quero documentar e publicar um case study de um cliente que quase quebrou produção com código gerado por IA e usou o CodeMemória para encontrar a falha, para que o produto ganhe credibilidade e autoridade no mercado enterprise.

#### Gate de Entrada

- Fase 6 concluída (Gate de Saída da Fase 6 satisfeito).
- Pelo menos 1 cliente enterprise com incidente real documentado internamente.
- Autorização formal do cliente para publicação do case study.

#### Critérios de Aceitação

1. THE Case_Study SHALL documentar: contexto do cliente (setor, tamanho, stack), descrição do código gerado por IA que introduziu o risco, como o CodeMemória detectou o problema (com GovernancePassport anonimizado), impacto evitado estimado (em horas de downtime ou custo financeiro) e depoimento do responsável técnico.
2. THE Case_Study SHALL ser publicado em pelo menos 3 canais: blog técnico do produto, LinkedIn da empresa e submissão para conferência técnica relevante (ex: QCon, DevSecOps Days).
3. THE Case_Study SHALL incluir o GovernancePassport anonimizado como artefato verificável, com hash de integridade que qualquer leitor possa verificar usando a CLI open source.
4. WHEN o Case_Study for publicado, THE sistema SHALL disponibilizar um ambiente de demonstração interativo onde qualquer desenvolvedor possa reproduzir a detecção do problema com código sintético equivalente.
5. THE ambiente de demonstração SHALL funcionar inteiramente no navegador (arquitetura zero-ops), sem necessidade de criar conta ou instalar software.
6. THE Case_Study SHALL incluir métricas quantitativas: tempo de detecção pelo CodeMemória (em segundos), número de cláusulas de compliance violadas, Risk_Score atribuído e custo estimado de remediação calculado pelo GovernanceEngine.
7. IF o cliente não autorizar a divulgação de detalhes técnicos específicos, THEN THE Case_Study SHALL usar dados sintéticos equivalentes que preservem as características técnicas do problema, com nota explícita de que os dados foram anonimizados.
8. FOR ALL afirmações quantitativas no Case_Study, THE sistema SHALL garantir que os números são derivados de GovernancePassports reais com hash de integridade verificável (propriedade de rastreabilidade de claims).

#### Gate de Saída

- Case study publicado e com pelo menos 1.000 visualizações únicas em 30 dias.
- Pelo menos 3 leads enterprise qualificados gerados diretamente pelo case study.
- Pelo menos 1 menção em mídia técnica especializada (InfoQ, The New Stack, etc.).

---

### Requisito 8: Cadeia de Dependências e Sequenciamento

**User Story:** Como líder de produto, quero que a cadeia de periodização seja procedural e sequencial, para que cada fase só inicie quando a anterior estiver comprovadamente concluída e os riscos de execução sejam minimizados.

#### Critérios de Aceitação

1. THE Roadmap SHALL ser executado na sequência: Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7, sem paralelismo entre fases principais.
2. WHEN o Gate de Saída de uma fase não for satisfeito, THE equipe SHALL permanecer na fase atual e iterar, sem avançar para a fase seguinte.
3. THE Gate de Entrada de cada fase SHALL ser verificado formalmente antes do início da fase, com registro documentado da verificação.
4. WHEN uma fase é iniciada, THE equipe SHALL definir um prazo máximo (timebox) para o Gate de Saída, após o qual uma revisão estratégica é obrigatória.
5. IF uma fase exceder o timebox sem satisfazer o Gate de Saída, THEN THE equipe SHALL realizar uma revisão estratégica para decidir entre: ajustar os critérios do Gate de Saída, pivotar a abordagem da fase ou descontinuar a fase.
6. THE Roadmap SHALL permitir que melhorias incrementais em fases anteriores ocorram em paralelo com a fase atual, desde que não modifiquem os Gates de Saída já satisfeitos.
7. FOR ALL fases do Roadmap, THE equipe SHALL manter um registro de evidências (artefatos, métricas, depoimentos) que comprovem a satisfação de cada critério do Gate de Saída.
