# Documento de Requisitos

## Introdução

Este documento descreve os requisitos para a refatoração estrutural do repositório EscapeKit MCP, migrando de uma raiz de "produto único" para uma topologia de monorepo com workspaces formais via npm workspaces.

O repositório atualmente mistura o produto principal (`src/`, `tests/`, `templates/`, `schemas/`), subprojetos independentes (`packages/`, `qwen-escapekit/`, `pisosrealview-pro-transformed/`), artefatos gerados (`dist/`, `coverage/`, `logs/`) e documentação operacional na raiz, criando acoplamentos implícitos, inconsistências de documentação e dificuldade de manutenção.

A topologia-alvo organiza o repositório em: `apps/` (produtos executáveis), `packages/` (bibliotecas reutilizáveis), `docs/` (documentação canônica) e `archive/` (material histórico preservado), com a raiz reservada exclusivamente para governança e orquestração do workspace.

A migração ocorre em duas ondas incrementais para minimizar regressões: Onda 1 estabelece o workspace formal e move subprojetos periféricos; Onda 2 move o produto principal e extrai bibliotecas compartilhadas.

## Glossário

- **Workspace_Root**: diretório raiz do repositório, responsável pela orquestração global do monorepo
- **Workspace_Manifest**: `package.json` na raiz com campo `workspaces` declarando todos os pacotes
- **Apps_Dir**: diretório `apps/` contendo produtos executáveis e aplicações finais
- **Packages_Dir**: diretório `packages/` contendo bibliotecas reutilizáveis, integrações e extensões
- **Docs_Dir**: diretório `docs/` contendo documentação canônica consolidada
- **Archive_Dir**: diretório `archive/` contendo material histórico preservado mas fora do fluxo diário
- **EscapeKit_App**: produto principal localizado em `apps/escapekit`, correspondente ao conteúdo atual de `src/`
- **Qwen_App**: CLI derivada localizada em `apps/qwen-escapekit`
- **Pisosrealview_App**: projeto transformado em `apps/pisosrealview-pro-transformed` ou em repositório próprio
- **Workspace_Script**: script npm definido no Workspace_Manifest que delega para todos os workspaces
- **Conformance_Checker**: script de verificação que valida a conformidade da estrutura de diretórios com a topologia-alvo
- **Onda_1**: primeira fase de migração — estabelece workspace formal e move subprojetos periféricos
- **Onda_2**: segunda fase de migração — move produto principal e ajusta imports, CI e publicação
- **Alias_Temporario**: re-exportação ou symlink que mantém compatibilidade com importações antigas durante a migração

---

## Requisitos

### Requisito 1: Estabelecer Topologia-Alvo e Workspace Formal

**User Story:** Como mantenedor do repositório, quero um `package.json` de workspace na raiz declarando formalmente todos os subprojetos, para que o npm resolva dependências internas sem caminhos frágeis como `file:../../dist/core`.

#### Critérios de Aceite

1. THE Workspace_Root SHALL conter um `package.json` com o campo `workspaces` listando `apps/*` e `packages/*`
2. THE Workspace_Manifest SHALL definir scripts padronizados `build`, `test` e `lint` que delegam a execução para todos os workspaces via `npm run -ws`
3. WHEN o comando `npm install` é executado na Workspace_Root, THE Workspace_Root SHALL resolver todas as dependências internas entre workspaces sem referências a caminhos `file:` apontando para artefatos compilados
4. THE Workspace_Root SHALL conter apenas arquivos de governança de repositório: `package.json`, arquivos de configuração de lint/formatter, CI, `.gitignore`, `README.md` e `LICENSE`
5. IF um arquivo que não seja de governança for colocado na Workspace_Root, THEN THE Conformance_Checker SHALL reportar uma violação de topologia

---

### Requisito 2: Migrar Produto Principal para `apps/escapekit`

**User Story:** Como desenvolvedor do EscapeKit, quero que o produto principal resida em `apps/escapekit` com seu próprio `package.json`, para que ele seja instalável, testável e publicável de forma independente.

#### Critérios de Aceite

1. THE EscapeKit_App SHALL conter os diretórios `src/`, `tests/`, `templates/`, `schemas/`, `knowledge-base/` e os scripts de build e teste previamente localizados na raiz
2. THE EscapeKit_App SHALL possuir um `package.json` próprio com `name`, `version`, `main`, `exports` e `scripts` de `build`, `test` e `lint`
3. WHEN `npm test` é executado dentro de `apps/escapekit`, THE EscapeKit_App SHALL executar a suíte de testes Vitest e reportar resultados sem depender de caminhos relativos fora do diretório `apps/escapekit`
4. WHEN `npm run build` é executado dentro de `apps/escapekit`, THE EscapeKit_App SHALL gerar artefatos compilados em `apps/escapekit/dist/` sem escrever em nenhum outro diretório do repositório
5. IF uma importação dentro de `apps/escapekit` referenciar um caminho fora de `apps/escapekit` por caminho relativo (`../../`), THEN THE Conformance_Checker SHALL reportar uma violação de acoplamento externo

---

### Requisito 3: Tratar `qwen-escapekit` como App Irmão

**User Story:** Como mantenedor, quero que a CLI derivada `qwen-escapekit` seja um workspace irmão em `apps/qwen-escapekit`, para que ela tenha pipeline próprio e dependa do EscapeKit_App via dependência de workspace.

#### Critérios de Aceite

1. THE Qwen_App SHALL residir em `apps/qwen-escapekit` com `package.json` próprio declarando `"@escapekit/core": "*"` como dependência de workspace
2. WHEN `npm run build` é executado na Workspace_Root, THE Workspace_Root SHALL construir o Qwen_App após o EscapeKit_App respeitando a ordem de dependências
3. THE Qwen_App SHALL possuir script `test` independente executável via `npm test` dentro de `apps/qwen-escapekit`
4. IF o diretório `qwen-escapekit/` ainda existir na raiz após a Onda_1, THEN THE Conformance_Checker SHALL reportar uma violação de resíduo de migração

---

### Requisito 4: Definir Destino para `pisosrealview-pro-transformed`

**User Story:** Como mantenedor, quero que o projeto `pisosrealview-pro-transformed` seja explicitamente posicionado — em `apps/` ou em repositório próprio — para que ele não polua a raiz com um projeto de domínio completamente diferente.

#### Critérios de Aceite

1. THE Workspace_Root SHALL não conter o diretório `pisosrealview-pro-transformed/` após a conclusão da Onda_1
2. WHERE o projeto `pisosrealview-pro-transformed` for mantido co-hospedado, THE Pisosrealview_App SHALL residir em `apps/pisosrealview-pro-transformed` ou `apps/experimental/pisosrealview-pro-transformed` com `package.json` próprio
3. WHERE o projeto `pisosrealview-pro-transformed` for extraído para repositório separado, THE Workspace_Root SHALL conter um arquivo `docs/migrations/pisosrealview-extraction.md` documentando o novo repositório e a data de extração
4. IF o diretório `pisosrealview-pro-transformed/` for encontrado na Workspace_Root durante a Onda_2, THEN THE Conformance_Checker SHALL reportar uma violação crítica de topologia

---

### Requisito 5: Validar e Reorganizar `packages/`

**User Story:** Como mantenedor, quero que os pacotes em `packages/` sejam auditados e organizados com fronteiras claras, para que apenas bibliotecas ativas e com semântica de monorepo permaneçam no diretório.

#### Critérios de Aceite

1. THE Packages_Dir SHALL conter apenas pacotes com `package.json` válido declarando `name`, `version` e pelo menos um script (`build` ou `test`)
2. WHEN um pacote em `packages/` referencia `file:../../dist/core` ou caminho similar para artefatos compilados, THE Conformance_Checker SHALL reportar uma violação de dependência frágil
3. IF um pacote em `packages/` tiver nome de escopo diferente de `@escapekit/` (por exemplo `@codememoria/`), THEN THE Packages_Dir SHALL mover esse pacote para `archive/` com um `README.md` explicando a razão do arquivamento
4. THE Packages_Dir SHALL ter um `README.md` descrevendo os critérios para adicionar novos pacotes ao diretório

---

### Requisito 6: Separar Artefatos Gerados de Conteúdo-Fonte

**User Story:** Como desenvolvedor, quero que `dist/`, `coverage/`, `logs/` e relatórios de análise gerados automaticamente não apareçam na navegação principal do repositório, para que eu possa distinguir conteúdo-fonte de artefatos derivados sem esforço.

#### Critérios de Aceite

1. THE Workspace_Root SHALL não conter os diretórios `dist/`, `coverage/`, `logs/` ou arquivos de relatório gerados automaticamente
2. WHEN o script `build` é executado em qualquer workspace, THE workspace SHALL gerar artefatos somente dentro do próprio diretório do workspace
3. THE Workspace_Root SHALL ter um `.gitignore` global que exclua `dist/`, `coverage/`, `logs/`, `*.log` e padrões de relatório para todos os workspaces
4. IF o Conformance_Checker detectar um diretório `dist/` ou `coverage/` na Workspace_Root, THEN THE Conformance_Checker SHALL reportar uma violação de artefato fora de lugar

---

### Requisito 7: Consolidar Documentação em `docs/`

**User Story:** Como colaborador, quero encontrar toda a documentação canônica em `docs/` com referências de caminhos atualizadas, para que eu não seja direcionado a arquivos ou caminhos que não existem mais.

#### Critérios de Aceite

1. THE Docs_Dir SHALL consolidar toda documentação permanente: guias de onboarding, quick start, arquitetura e contribuição
2. THE Docs_Dir SHALL conter um subdiretório `docs/status/` ou `docs/operations/` para relatórios operacionais e documentos de status não-permanentes
3. WHEN `ONBOARDING.md` ou `QUICK_START.md` referenciar `cli/index.ts` ou qualquer caminho que não exista na topologia-alvo, THE Docs_Dir SHALL substituir essa referência pelo caminho canônico correto
4. THE Archive_Dir SHALL conter documentos identificados como obsoletos com um `README.md` explicando por que foram arquivados e quando
5. IF um guia em `docs/` referenciar um caminho de arquivo que não existe no repositório, THEN THE Conformance_Checker SHALL reportar uma violação de referência morta

---

### Requisito 8: Executar Migração em Duas Ondas Incrementais

**User Story:** Como mantenedor, quero que a migração ocorra em duas ondas com critérios de aceite por fase, para que regressões de CI, imports quebrados e referências perdidas sejam detectados antes de mover o produto principal.

#### Critérios de Aceite

1. WHEN a Onda_1 é concluída, THE Workspace_Root SHALL ter o Workspace_Manifest declarado, subprojetos periféricos movidos para `apps/`, `packages/` auditado, artefatos gerados removidos da raiz e documentação consolidada em `docs/`
2. WHEN a Onda_1 é concluída, THE Workspace_Root SHALL manter Alias_Temporario para caminhos de importação anteriormente públicos, de modo que código dependente continue a funcionar
3. WHEN a Onda_2 é concluída, THE EscapeKit_App SHALL estar em `apps/escapekit`, todos os imports relativos ajustados, scripts de CI atualizados com novos caminhos e suíte de testes Vitest executando com sucesso
4. WHEN a Onda_2 é concluída, THE Workspace_Root SHALL não conter nenhum Alias_Temporario remanescente da Onda_1
5. IF a suíte de testes do EscapeKit_App falhar durante a Onda_2, THEN THE Onda_2 SHALL ser interrompida até que as regressões sejam corrigidas antes de prosseguir

---

### Requisito 9: Substituir Script de Limpeza por Conformance_Checker

**User Story:** Como mantenedor, quero substituir o script `scripts/cleanup-project-root.sh` por um Conformance_Checker sistemático, para que a conformidade com a topologia-alvo seja verificável de forma automatizada e repetível.

#### Critérios de Aceite

1. THE Conformance_Checker SHALL verificar todas as regras de topologia definidas neste documento e produzir um relatório com violações agrupadas por categoria
2. WHEN o Conformance_Checker é executado sem violações, THE Conformance_Checker SHALL retornar exit code `0`
3. WHEN o Conformance_Checker detecta pelo menos uma violação crítica, THE Conformance_Checker SHALL retornar exit code diferente de `0` e listar cada violação com o caminho ofensor e a regra violada
4. THE Workspace_Manifest SHALL incluir o script `"conformance": "node scripts/conformance-checker.js"` executável via `npm run conformance`
5. THE Conformance_Checker SHALL ser executado como etapa obrigatória no pipeline de CI após cada pull request que altere a estrutura de diretórios do repositório
6. FOR ALL execuções do Conformance_Checker sobre a mesma estrutura de diretórios, THE Conformance_Checker SHALL produzir o mesmo conjunto de violações (propriedade de idempotência)

---

### Requisito 10: Manter Pipelines de CI Funcionais Durante a Migração

**User Story:** Como mantenedor, quero que os pipelines de CI continuem funcionando em cada passo da migração, para que não haja janelas de tempo com builds completamente quebrados.

#### Critérios de Aceite

1. WHEN qualquer commit de migração é feito, THE pipeline de CI SHALL executar com sucesso os steps de `build` e `test` para todos os workspaces já migrados
2. WHILE a Onda_1 está em progresso, THE pipeline de CI SHALL executar tanto os testes da estrutura antiga quanto os do novo workspace já declarado
3. IF um step de CI falhar durante a Onda_1, THEN THE Onda_1 SHALL ser pausada e o commit ofensor identificado antes de continuar
4. WHEN a Onda_2 é concluída, THE pipeline de CI SHALL executar `build`, `test`, `lint` e `conformance` para todos os workspaces em um único workflow
5. THE pipeline de CI SHALL incluir uma etapa `npm run conformance` que falha o build quando o Conformance_Checker retorna exit code diferente de `0`
