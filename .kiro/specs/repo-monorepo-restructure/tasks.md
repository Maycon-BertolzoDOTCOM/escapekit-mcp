# Plano de Implementação: repo-monorepo-restructure

## Visão Geral

Migração incremental do repositório EscapeKit MCP de "produto único na raiz" para monorepo formal com npm workspaces. A implementação segue duas ondas sequenciais: Onda_1 estabelece a infraestrutura e move subprojetos periféricos (produto principal intocado); Onda_2 move o produto principal e consolida o pipeline de CI.

## Tarefas

- [x] 1. Onda_1 — Passo 1.1: Criar Workspace_Manifest e tsconfig.base.json
  - [x] 1.1 Criar `package.json` raiz com `workspaces: ["apps/*", "apps/experimental/*", "packages/*"]`, scripts delegados via `npm run -ws --if-present` e `"engines": {"node": ">=18.0.0"}`
    - Incluir scripts `build`, `test`, `lint`, `typecheck` e `conformance`
    - Definir `"private": true` para evitar publicação acidental
    - _Requisitos: 1.1, 1.2, 9.4_
  - [x] 1.2 Criar `tsconfig.base.json` na raiz com opções compartilhadas (`target: ES2022`, `strict: true`, `declaration: true`, `sourceMap: true`)
    - _Requisitos: 1.4_
  - [ ]* 1.3 Escrever teste unitário: verificar que `package.json` da raiz contém campo `workspaces` com os três padrões esperados e scripts obrigatórios
    - _Requisitos: 1.1, 1.2_

- [x] 2. Onda_1 — Passo 1.2: Mover subprojetos periféricos para `apps/`
  - [x] 2.1 Executar `git mv qwen-escapekit/ apps/qwen-escapekit/` e atualizar referências internas ao novo caminho
    - Garantir que `package.json` de `apps/qwen-escapekit` declara `"@escapekit/core": "*"` como dependência
    - _Requisitos: 3.1, 3.3, 4.1_
  - [x] 2.2 Executar `git mv pisosrealview-pro-transformed/ apps/experimental/pisosrealview-pro-transformed/` e atualizar referências internas
    - Criar `apps/experimental/pisosrealview-pro-transformed/package.json` se não existir
    - _Requisitos: 4.1, 4.2_
  - [ ]* 2.3 Escrever teste unitário: verificar que os diretórios `qwen-escapekit/` e `pisosrealview-pro-transformed/` não existem na raiz
    - _Requisitos: 3.4, 4.1_

- [x] 3. Onda_1 — Passo 1.3: Auditar e corrigir `packages/`
  - [x] 3.1 Atualizar `packages/github-action/package.json` e `packages/vscode-extension/package.json` para usar escopo `@escapekit/` nos campos `name`
    - Verificar que cada `package.json` declara `name`, `version` e pelo menos um script `build` ou `test`
    - _Requisitos: 5.1, 5.3_
  - [x] 3.2 Criar diretório `archive/packages/` e mover pacotes com escopo `@codememoria/` para lá, adicionando `archive/README.md` explicando critério de arquivamento
    - _Requisitos: 5.3, 7.4_
  - [x] 3.3 Criar `packages/core-stub/package.json` como alias temporário apontando para `dist/server.js` da raiz, marcado com comentário `// ALIAS_TEMPORARIO — remover na Onda_2`
    - _Requisitos: 8.2_
  - [x] 3.4 Criar `packages/README.md` descrevendo critérios para adicionar novos pacotes ao diretório
    - _Requisitos: 5.4_
  - [ ]* 3.5 Escrever teste unitário: verificar que todos os `package.json` em `packages/` têm `name` com prefixo `@escapekit/` e pelo menos um script
    - _Requisitos: 5.1, 5.3_

- [x] 4. Onda_1 — Passo 1.4: Atualizar `.gitignore` global
  - [x] 4.1 Atualizar `.gitignore` na raiz para incluir `**/dist/`, `**/build/`, `**/coverage/`, `**/logs/`, `*.log`, `*.tsbuildinfo`, `.env`, `.cache/` e padrões EscapeKit específicos
    - _Requisitos: 6.3_
  - [ ]* 4.2 Escrever teste unitário: verificar que `.gitignore` contém os padrões obrigatórios `**/dist/` e `**/coverage/`
    - _Requisitos: 6.3_

- [x] 5. Onda_1 — Passo 1.5: Consolidar documentação em `docs/`
  - [x] 5.1 Criar diretório `docs/status/` e mover documentos operacionais e de status não-permanentes para lá
    - _Requisitos: 7.2_
  - [x] 5.2 Mover MDs obsoletos da raiz para `archive/` e criar `MIGRATION_STATUS.md` na raiz documentando o estado transitório da Onda_1
    - _Requisitos: 7.4, 8.2_
  - [x] 5.3 Corrigir referências a caminhos antigos em documentos `docs/` (ex: `cli/index.ts` → `apps/escapekit/src/cli/index.ts`)
    - _Requisitos: 7.3_
  - [ ]* 5.4 Escrever teste unitário: verificar que `docs/status/` existe e que `MIGRATION_STATUS.md` existe na raiz durante a transição
    - _Requisitos: 7.2_

- [x] 6. Onda_1 — Passo 1.6: Criar `scripts/conformance-checker.js`
  - [x] 6.1 Criar `scripts/conformance-checker.js` implementando as 11 regras (`TOPOLOGY_001-003`, `ARTIFACT_001-003`, `DEP_001-002`, `SCOPE_001-002`, `DOCS_001`) com o modelo de dados `Violation` (campos: `rule`, `severity`, `path`, `message`, `category`)
    - Agrupar output por categoria conforme formato definido no design
    - Retornar exit code `0` (sem violações), `1` (violação crítica) ou `2` (erro de configuração)
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_
  - [x] 6.2 Implementar verificação de cada regra no checker:
    - `TOPOLOGY_001-003`: itens não-governança e resíduos de migração na raiz
    - `ARTIFACT_001-003`: `dist/`, `coverage/`, `logs/` na Workspace_Root
    - `DEP_001-002`: dependências `file:...dist...` e imports `../../` cruzando fronteiras
    - `SCOPE_001-002`: escopo errado ou `package.json` inválido em `packages/`
    - `DOCS_001`: referências mortas em markdown de `docs/`
    - _Requisitos: 9.1, 1.5, 2.5, 3.4, 4.4, 5.2, 6.4, 7.5_
  - [x] 6.3 Adicionar tratamento de erro para quando a Workspace_Root não puder ser determinada (stderr + exit code `2`) e para erros de leitura de arquivo (nível `info`, sem interromper análise)
    - _Requisitos: 9.2, 9.3_
  - [ ]* 6.4 Escrever teste unitário: verificar que o Conformance_Checker produz output agrupado por categoria e que o script `"conformance"` existe no Workspace_Manifest
    - _Requisitos: 9.1, 9.4_
  - [ ]* 6.5 Escrever propriedade PBT — Propriedade 7: Exit code reflete estado de violações
    - Para qualquer estrutura sem violações → exit code `0`; com ao menos uma violação `critical` → exit code `1`
    - Tag: `// Feature: repo-monorepo-restructure, Property 7: Exit code reflete estado de violações`
    - `numRuns: 100`
    - **Valida: Requisitos 9.2, 9.3**
  - [ ]* 6.6 Escrever propriedade PBT — Propriedade 8: Idempotência do Conformance_Checker
    - Executar o checker N vezes sobre a mesma estrutura deve produzir exatamente o mesmo conjunto de violações e exit code
    - Tag: `// Feature: repo-monorepo-restructure, Property 8: Idempotência do Conformance_Checker`
    - `numRuns: 100`
    - **Valida: Requisito 9.6**

- [x] 7. Checkpoint Onda_1 — Verificar gate de conclusão
  - Garantir que todos os testes passam, CI verde com pipeline duplo (legacy + workspaces periféricos), e Conformance_Checker retorna exit 0.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Onda_1 — Criar pipeline de CI transitório (job duplo)
  - [x] 8.1 Atualizar `.github/workflows/ci.yml` para incluir dois jobs: `legacy-tests` (testes do produto na raiz com `npm ci`) e `workspace-tests` (testes dos workspaces já migrados com `npm install -ws`)
    - _Requisitos: 10.1, 10.2_
  - [ ]* 8.2 Escrever teste unitário: verificar que `.github/workflows/ci.yml` contém referências a `npm run conformance` após a Onda_1
    - _Requisitos: 10.5_

- [x] 9. Onda_2 — Passo 2.1: Preparar `apps/escapekit/`
  - [x] 9.1 Criar `apps/escapekit/package.json` com `name: "@escapekit/core"`, `version`, `type: "module"`, `main`, `exports`, `bin` e scripts `build`, `test`, `test:ci`, `lint`, `typecheck`
    - _Requisitos: 2.2_
  - [x] 9.2 Criar `apps/escapekit/tsconfig.json` com `"extends": "../../tsconfig.base.json"` e definir `outDir` e `rootDir` específicos
    - _Requisitos: 2.2_
  - [x] 9.3 Criar `apps/escapekit/vitest.config.ts` configurado para executar testes em `tests/` sem depender de caminhos fora de `apps/escapekit/`
    - _Requisitos: 2.3_
  - [ ]* 9.4 Escrever teste unitário: verificar que `apps/escapekit/package.json` contém `name: "@escapekit/core"`, `main`, `exports` e todos os scripts obrigatórios
    - _Requisitos: 2.2_
  - [ ]* 9.5 Escrever teste unitário: verificar que `apps/qwen-escapekit/package.json` declara `"@escapekit/core": "*"` como dependência
    - _Requisitos: 3.1_

- [x] 10. Onda_2 — Passo 2.2: Mover conteúdo do produto principal
  - [x] 10.1 Executar `git mv src/ apps/escapekit/src/`, `git mv tests/ apps/escapekit/tests/`, `git mv templates/ apps/escapekit/templates/`, `git mv schemas/ apps/escapekit/schemas/`, `git mv knowledge-base/ apps/escapekit/knowledge-base/`
    - _Requisitos: 2.1_
  - [x] 10.2 Remover `packages/core-stub/` e quaisquer aliases temporários da Onda_1; atualizar `MIGRATION_STATUS.md` refletindo fim dos aliases
    - _Requisitos: 8.4_
  - [ ]* 10.3 Escrever propriedade PBT — Propriedade 2: Raiz contém apenas governança
    - Para qualquer entrada na Workspace_Root (exceto `.git` e `node_modules`), deve pertencer ao conjunto permitido de governança
    - Tag: `// Feature: repo-monorepo-restructure, Property 2: Raiz contém apenas governança`
    - `numRuns: 100`
    - **Valida: Requisito 1.4**
  - [ ]* 10.4 Escrever propriedade PBT — Propriedade 5: Ausência de artefatos gerados na raiz
    - Nenhum subdiretório direto da Workspace_Root deve ser `dist/`, `coverage/`, `logs/` ou variante de diretório de saída
    - Tag: `// Feature: repo-monorepo-restructure, Property 5: Ausência de artefatos gerados na raiz`
    - `numRuns: 100`
    - **Valida: Requisito 6.1**

- [-] 11. Onda_2 — Passo 2.3: Ajustar imports e referências internas
  - [x] 11.1 Corrigir todos os imports relativos dentro de `apps/escapekit/src/` que referenciem caminhos fora de `apps/escapekit/` (ex: `../../dist/`, `../../src/`)
    - _Requisitos: 2.3, 2.5_
  - [x] 11.2 Atualizar `paths` em `apps/escapekit/tsconfig.json` e aliases em `vitest.config.ts` para referenciar somente caminhos internos ao workspace
    - _Requisitos: 2.3_
  - [ ]* 11.3 Escrever propriedade PBT — Propriedade 1: Ausência de dependências frágeis
    - Para qualquer `package.json` no monorepo, nenhuma entrada em `dependencies` ou `devDependencies` deve conter padrão `file:...dist...`
    - Tag: `// Feature: repo-monorepo-restructure, Property 1: Ausência de dependências frágeis`
    - `numRuns: 100`
    - **Valida: Requisitos 1.3, 5.2**
  - [ ]* 11.4 Escrever propriedade PBT — Propriedade 3: Isolamento de artefatos por workspace
    - Para qualquer workspace W, artefatos gerados pelo script `build` de W devem ter prefixo no diretório de W
    - Tag: `// Feature: repo-monorepo-restructure, Property 3: Isolamento de artefatos por workspace`
    - `numRuns: 100`
    - **Valida: Requisitos 2.4, 6.2**

- [x] 12. Onda_2 — Passo 2.4 e 2.5: Remover aliases e atualizar CI definitivo
  - [x] 12.1 Remover `packages/core-stub/` se ainda existir e verificar que `npm ls @escapekit/core` resolve para o workspace `apps/escapekit` sem o stub
    - _Requisitos: 8.4_
  - [x] 12.2 Substituir o pipeline duplo de CI por pipeline unificado em `.github/workflows/ci.yml` com steps: `npm install`, `npm run build -ws`, `npm run lint -ws`, `npm run test -ws`, `npm run conformance`
    - O step `conformance` deve falhar o build se exit code != 0
    - _Requisitos: 10.4, 10.5, 9.5_
  - [x] 12.3 Remover `MIGRATION_STATUS.md` da raiz ao final da Onda_2
    - _Requisitos: 8.4_
  - [ ]* 12.4 Escrever propriedade PBT — Propriedade 4: Escopo correto em `packages/`
    - Para qualquer diretório em `packages/`, o campo `name` do `package.json` deve começar com `@escapekit/` e declarar pelo menos `build` ou `test`
    - Tag: `// Feature: repo-monorepo-restructure, Property 4: Escopo correto em packages/`
    - `numRuns: 100`
    - **Valida: Requisitos 5.1, 5.3**
  - [ ]* 12.5 Escrever propriedade PBT — Propriedade 6: Referências de documentação resolvem para arquivos existentes
    - Para qualquer arquivo Markdown em `docs/` com referência a caminho local, o arquivo referenciado deve existir no repositório
    - Tag: `// Feature: repo-monorepo-restructure, Property 6: Referências de documentação resolvem`
    - `numRuns: 100`
    - **Valida: Requisitos 7.3, 7.5**
  - [ ]* 12.6 Escrever teste unitário: verificar que `.github/workflows/ci.yml` contém o step `npm run conformance` e não contém mais o job `legacy-tests`
    - _Requisitos: 10.4, 10.5_

- [x] 13. Checkpoint Final Onda_2 — Verificar gate de conclusão
  - Garantir que todos os testes passam, CI executa build + test + lint + conformance em job único, Conformance_Checker retorna exit 0 para todas as 11 regras, e `MIGRATION_STATUS.md` foi removido.
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental entre as ondas
- O Conformance_Checker deve ser implementado antes de qualquer gate de validação
- Testes de propriedade validam comportamentos universais do checker; testes unitários cobrem exemplos concretos de configuração
- `packages/core-stub/` é alias temporário — deve ser removido obrigatoriamente no Passo 2.4
