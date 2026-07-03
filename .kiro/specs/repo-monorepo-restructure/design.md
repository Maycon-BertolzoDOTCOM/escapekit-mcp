# Design Técnico — repo-monorepo-restructure

## Visão Geral

O repositório EscapeKit MCP será reorganizado de uma estrutura de "produto único na raiz" para um monorepo formal com npm workspaces. O objetivo é eliminar acoplamentos implícitos, caminhos frágeis (`file:../../dist/core`), artefatos gerados misturados ao código-fonte e documentação desatualizada.

A migração ocorre em duas ondas incrementais. A Onda_1 estabelece a infraestrutura do workspace e move subprojetos periféricos. A Onda_2 move o produto principal e ajusta todos os caminhos, imports e CI.

Um `Conformance_Checker` (`scripts/conformance-checker.js`) substitui o script de limpeza existente, validando a conformidade da estrutura com a topologia-alvo de forma idempotente e com exit code semântico.

---

## Arquitetura

### Topologia-Alvo de Diretórios

```
escapekit-mcp/                          ← Workspace_Root (só governança)
├── package.json                        ← Workspace_Manifest (workspaces: ["apps/*", "packages/*"])
├── tsconfig.base.json                  ← tsconfig compartilhado (base para extends)
├── .eslintrc.json                      ← ESLint global
├── .prettierrc.json                    ← Prettier global
├── .gitignore                          ← gitignore global
├── .github/
│   └── workflows/
│       └── ci.yml                      ← Pipeline unificado pós-Onda_2
├── scripts/
│   └── conformance-checker.js          ← Substitui cleanup-project-root.sh
├── docs/
│   ├── onboarding.md
│   ├── quick-start.md
│   ├── architecture.md
│   ├── contributing.md
│   ├── status/                         ← Relatórios operacionais não-permanentes
│   └── migrations/
│       └── pisosrealview-extraction.md ← Se Pisosrealview for extraído
├── archive/
│   ├── README.md                       ← Explica critério de arquivamento
│   └── packages/
│       └── codememoria-*/              ← Pacotes @codememoria/ arquivados
├── apps/
│   ├── escapekit/                      ← EscapeKit_App (produto principal)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   ├── tests/
│   │   ├── templates/
│   │   ├── schemas/
│   │   ├── knowledge-base/
│   │   └── dist/                       ← Gerado, no .gitignore
│   ├── qwen-escapekit/                 ← Qwen_App (CLI derivada)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   ├── tests/
│   │   └── dist/                       ← Gerado, no .gitignore
│   └── experimental/
│       └── pisosrealview-pro-transformed/ ← Pisosrealview_App (se co-hospedado)
│           ├── package.json
│           ├── backend/
│           └── frontend/
└── packages/
    ├── README.md                        ← Critérios para adicionar pacotes
    ├── github-action/
    │   └── package.json                 ← name: @escapekit/github-action
    └── vscode-extension/
        └── package.json                 ← name: @escapekit/vscode-extension
```

### Mapeamento de Arquivos: Origem → Destino

| Origem (atual) | Destino (alvo) | Onda |
|---|---|---|
| `src/` | `apps/escapekit/src/` | Onda_2 |
| `tests/` | `apps/escapekit/tests/` | Onda_2 |
| `templates/` | `apps/escapekit/templates/` | Onda_2 |
| `schemas/` | `apps/escapekit/schemas/` | Onda_2 |
| `knowledge-base/` | `apps/escapekit/knowledge-base/` | Onda_2 |
| `tsconfig.json` | `apps/escapekit/tsconfig.json` + `tsconfig.base.json` (raiz) | Onda_2 |
| `vitest.config.ts` | `apps/escapekit/vitest.config.ts` | Onda_2 |
| `qwen-escapekit/` | `apps/qwen-escapekit/` | Onda_1 |
| `pisosrealview-pro-transformed/` | `apps/experimental/pisosrealview-pro-transformed/` | Onda_1 |
| `packages/github-action/` | `packages/github-action/` (renomear scope) | Onda_1 |
| `packages/vscode-extension/` | `packages/vscode-extension/` (renomear scope) | Onda_1 |
| `dist/` (raiz) | removido da raiz (gerado por workspace) | Onda_1 |
| `coverage/` (raiz) | removido da raiz | Onda_1 |
| `logs/` (raiz) | removido da raiz | Onda_1 |
| `docs/` | `docs/` (consolidado, referências corrigidas) | Onda_1 |
| `scripts/cleanup-project-root.sh` | `scripts/conformance-checker.js` | Onda_1 |
| MDs avulsos na raiz (`CHANGELOG.md`, `CONTRIBUTING.md` etc.) | `docs/` ou `archive/` | Onda_1 |

---

## Componentes e Interfaces

### Workspace_Manifest (`package.json` raiz)

```json
{
  "name": "escapekit-monorepo",
  "version": "0.0.0",
  "private": true,
  "workspaces": ["apps/*", "apps/experimental/*", "packages/*"],
  "scripts": {
    "build":       "npm run build -ws --if-present",
    "test":        "npm run test -ws --if-present",
    "lint":        "npm run lint -ws --if-present",
    "conformance": "node scripts/conformance-checker.js",
    "typecheck":   "npm run typecheck -ws --if-present"
  },
  "engines": { "node": ">=18.0.0" }
}
```

> `"private": true` impede publicação acidental da raiz. `--if-present` evita falha em workspaces sem o script declarado.

### `package.json` de `apps/escapekit`

```json
{
  "name": "@escapekit/core",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/server.js",
  "exports": {
    ".": "./dist/server.js",
    "./cli": "./dist/cli/index.js"
  },
  "bin": { "escapekit": "./dist/cli/index.js" },
  "scripts": {
    "build":     "tsc -p tsconfig.json",
    "test":      "vitest --run",
    "test:ci":   "vitest --run --coverage",
    "lint":      "eslint src --ext .ts --max-warnings 0",
    "typecheck": "tsc --noEmit"
  },
  "files": ["dist/", "README.md", "package.json"]
}
```

### `package.json` de `apps/qwen-escapekit`

```json
{
  "name": "@escapekit/qwen-cli",
  "version": "2.0.0",
  "type": "module",
  "dependencies": {
    "@escapekit/core": "*"
  },
  "scripts": {
    "build":   "tsc -p tsconfig.json",
    "test":    "vitest --run",
    "lint":    "eslint src --ext .ts --max-warnings 0"
  }
}
```

A resolução de `@escapekit/core` via workspace garante que não haja caminhos `file:` manuais.

### `tsconfig.base.json` (raiz)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

Cada workspace herda com `"extends": "../../tsconfig.base.json"` e define seu próprio `outDir` e `rootDir`.

---

## Modelos de Dados

### Modelo de Violação do Conformance_Checker

```typescript
type SeverityLevel = "critical" | "warning" | "info";

interface Violation {
  rule: string;       // ex: "TOPOLOGY_001"
  severity: SeverityLevel;
  path: string;       // caminho ofensor relativo à raiz
  message: string;    // descrição legível
  category: ViolationCategory;
}

type ViolationCategory =
  | "topology"          // arquivo/dir no lugar errado
  | "fragile-dep"       // dependência file:dist ou similar
  | "scope-mismatch"    // pacote com escopo errado em packages/
  | "dead-reference"    // referência de docs aponta para arquivo inexistente
  | "migration-residue" // dir que deveria ter sido movido
  | "stale-artifact";   // dist/, coverage/, logs/ na raiz
```

### Regras do Conformance_Checker

| ID | Categoria | Descrição | Severidade |
|---|---|---|---|
| `TOPOLOGY_001` | `topology` | Item não-governança encontrado na Workspace_Root | critical |
| `TOPOLOGY_002` | `migration-residue` | `qwen-escapekit/` encontrado na raiz | critical |
| `TOPOLOGY_003` | `migration-residue` | `pisosrealview-pro-transformed/` encontrado na raiz | critical |
| `ARTIFACT_001` | `stale-artifact` | `dist/` encontrado na Workspace_Root | critical |
| `ARTIFACT_002` | `stale-artifact` | `coverage/` encontrado na Workspace_Root | warning |
| `ARTIFACT_003` | `stale-artifact` | `logs/` encontrado na Workspace_Root | warning |
| `DEP_001` | `fragile-dep` | Dependência com `file:...dist...` em qualquer `package.json` | critical |
| `DEP_002` | `fragile-dep` | Import `../../` cruzando fronteira de workspace | critical |
| `SCOPE_001` | `scope-mismatch` | Pacote em `packages/` sem escopo `@escapekit/` | warning |
| `SCOPE_002` | `scope-mismatch` | `package.json` em `packages/` sem `name`, `version` ou `scripts` | warning |
| `DOCS_001` | `dead-reference` | Referência de markdown em `docs/` aponta para caminho inexistente | warning |

### Formato de Output do Conformance_Checker

```
EscapeKit Conformance Checker v1.0
Raiz: /path/to/escapekit-mcp

── topology ─────────────────────────────────────────────
  [CRITICAL] TOPOLOGY_002  qwen-escapekit/
             Regra: Diretório de resíduo de migração encontrado na Workspace_Root
             Ação: Mover para apps/qwen-escapekit

── stale-artifact ───────────────────────────────────────
  [CRITICAL] ARTIFACT_001  dist/
             Regra: Artefato gerado encontrado na Workspace_Root
             Ação: Remover da raiz; dist/ deve existir somente dentro de workspaces

── fragile-dep ──────────────────────────────────────────
  [CRITICAL] DEP_001  packages/vscode-extension/package.json
             Regra: Dependência file:../../dist/core detectada
             Ação: Substituir por "@escapekit/core": "*"

────────────────────────────────────────────────────────
  3 violação(ões) encontrada(s): 3 critical, 0 warning, 0 info
  Exit code: 1
```

---

## Fluxo de Migração

### Onda_1 — Infraestrutura e Periféricos

**Objetivo**: Workspace formal funcionando; produto principal intocado na raiz.

```
Passo 1.1 — Criar Workspace_Manifest
  ├── Criar package.json raiz com workspaces: ["apps/*", "apps/experimental/*", "packages/*"]
  ├── Criar tsconfig.base.json
  └── Gate: npm install na raiz resolve sem erros

Passo 1.2 — Mover subprojetos periféricos
  ├── git mv qwen-escapekit/ apps/qwen-escapekit/
  ├── git mv pisosrealview-pro-transformed/ apps/experimental/pisosrealview-pro-transformed/
  └── Gate: CI executa testes de apps/qwen-escapekit e apps/experimental/ com sucesso

Passo 1.3 — Auditar e corrigir packages/
  ├── Renomear github-action → @escapekit/github-action
  ├── Renomear vscode-extension → @escapekit/vscode-extension
  ├── Substituir file:../../dist/core por "@escapekit/core": "*" (ainda não resolve — alias temporário)
  └── Mover @codememoria/* para archive/packages/

Passo 1.4 — Remover artefatos gerados da raiz
  ├── Adicionar dist/, coverage/, logs/ ao .gitignore global
  └── Gate: Conformance_Checker retorna exit 0 nas categorias stale-artifact

Passo 1.5 — Consolidar documentação
  ├── Mover MDs operacionais para docs/status/
  ├── Arquivar MDs obsoletos em archive/
  └── Corrigir referências a cli/index.ts → apps/escapekit/src/cli/index.ts

Passo 1.6 — Instalar Conformance_Checker
  ├── Criar scripts/conformance-checker.js
  ├── Adicionar "conformance": "node scripts/conformance-checker.js" ao Workspace_Manifest
  └── Gate: Conformance_Checker retorna exit 0

Gate final Onda_1: CI verde com pipeline duplo (raiz + workspaces periféricos)
```

### Aliases Temporários Durante Onda_1

Durante a Onda_1, o produto principal ainda reside em `src/` na raiz. Os pacotes `packages/` que declaram `@escapekit/core: "*"` ainda não têm um workspace real para resolver. A estratégia:

1. **Criar `packages/core-stub/`** com um `package.json` de alias:
   ```json
   { "name": "@escapekit/core", "version": "1.0.0", "main": "../../dist/server.js" }
   ```
   Este stub aponta para o `dist/` existente na raiz enquanto a Onda_2 não ocorre.

2. O stub é marcado com comentário `// ALIAS_TEMPORARIO — remover na Onda_2`.

3. Na Onda_2, o stub é removido e `@escapekit/core` resolve para `apps/escapekit`.

### Onda_2 — Produto Principal

**Objetivo**: `apps/escapekit` como workspace real; raiz limpa; CI unificado.

```
Passo 2.1 — Preparar apps/escapekit/
  ├── Criar apps/escapekit/package.json, tsconfig.json, vitest.config.ts
  └── Gate: npm install resolve @escapekit/core sem o stub

Passo 2.2 — Mover conteúdo do produto principal
  ├── git mv src/ apps/escapekit/src/
  ├── git mv tests/ apps/escapekit/tests/
  ├── git mv templates/ apps/escapekit/templates/
  ├── git mv schemas/ apps/escapekit/schemas/
  ├── git mv knowledge-base/ apps/escapekit/knowledge-base/
  └── Gate: npm test dentro de apps/escapekit passa (sem regressões)

Passo 2.3 — Ajustar imports e referências internas
  ├── Corrigir imports relativos que saíam da raiz
  ├── Atualizar paths em vitest.config.ts e tsconfig.json
  └── Gate: npm run typecheck dentro de apps/escapekit passa

Passo 2.4 — Remover aliases temporários
  ├── Remover packages/core-stub/
  ├── Remover Alias_Temporario do .gitignore e scripts
  └── Gate: npm install na raiz resolve sem o stub

Passo 2.5 — Atualizar CI para pipeline unificado
  └── Gate: Conformance_Checker retorna exit 0 para todas as regras

Gate final Onda_2: CI executa build + test + lint + conformance em um único job
```

---

## CI — Atualizações Necessárias

### Pipeline Pós-Onda_1 (transitório)

```yaml
jobs:
  legacy-tests:                  # mantém os testes do produto na raiz
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:ci

  workspace-tests:               # testa workspaces já migrados
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install          # instala workspaces
      - run: npm run test -ws --if-present
```

### Pipeline Pós-Onda_2 (definitivo)

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Build all workspaces
        run: npm run build -ws --if-present

      - name: Lint all workspaces
        run: npm run lint -ws --if-present

      - name: Test all workspaces
        run: npm run test -ws --if-present

      - name: Conformance check
        run: npm run conformance
```

O step `conformance` faz o build falhar se o Conformance_Checker retornar exit code != 0.

---

## Estratégia de `.gitignore`

### `.gitignore` Global (raiz)

```gitignore
# Dependências
node_modules/
.pnp

# Artefatos de build — cada workspace gera em seu próprio dist/
**/dist/
**/build/
*.tsbuildinfo

# Cobertura e logs
**/coverage/
**/logs/
*.log
.nyc_output

# Temporários
*.tmp
*.temp
.cache/

# Ambiente
.env
.env.local
.env.*.local

# IDE e OS
.vscode/
.idea/
.DS_Store
Thumbs.db

# EscapeKit específico
escape_output/
.escapekit/
*.analysis.json
```

> O padrão `**/dist/` garante que cada workspace mantenha seu próprio `dist/` ignorado, sem precisar de `.gitignore` individuais para isso.

### `.gitignore` por Workspace (opcional)

Cada workspace pode ter um `.gitignore` local para padrões específicos (ex: `apps/experimental/pisosrealview-pro-transformed/.gitignore` para ignorar arquivos do backend Node).

---

## Propriedades de Correção

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma afirmação formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de correção verificáveis por máquinas.*

### Propriedade 1: Ausência de dependências frágeis

*Para qualquer* `package.json` em qualquer workspace do monorepo, nenhuma entrada em `dependencies` ou `devDependencies` deve conter um valor com o padrão `file:...dist...`.

**Valida: Requisitos 1.3, 5.2**

### Propriedade 2: Raiz contém apenas governança

*Para qualquer* entrada de diretório na Workspace_Root (excluindo `.git`, `node_modules`), ela deve pertencer ao conjunto permitido de itens de governança: `package.json`, `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc.json`, `.gitignore`, `README.md`, `LICENSE`, `CHANGELOG.md`, `.github/`, `scripts/`, `docs/`, `archive/`, `apps/`, `packages/`.

**Valida: Requisitos 1.4**

### Propriedade 3: Isolamento de artefatos por workspace

*Para qualquer* workspace `W` e qualquer artefato gerado `A` pelo script `build` de `W`, o caminho absoluto de `A` deve ter como prefixo o diretório de `W` (nunca a Workspace_Root ou outro workspace).

**Valida: Requisitos 2.4, 6.2**

### Propriedade 4: Escopo correto em packages/

*Para qualquer* diretório `D` em `packages/`, o campo `name` do `package.json` de `D` deve começar com `@escapekit/`, e `D` deve declarar pelo menos um dos scripts: `build` ou `test`.

**Valida: Requisitos 5.1, 5.3**

### Propriedade 5: Ausência de artefatos gerados na raiz

*Para qualquer* subdiretório `S` diretamente dentro da Workspace_Root, `S` não deve ser `dist/`, `coverage/`, `logs/` nem qualquer variante de diretório de saída de compilação ou teste.

**Valida: Requisito 6.1**

### Propriedade 6: Referências de documentação resolvem para arquivos existentes

*Para qualquer* arquivo Markdown em `docs/` que contenha uma referência a um caminho de arquivo local (padrão `[texto](./caminho)` ou similar), o arquivo referenciado deve existir no repositório.

**Valida: Requisitos 7.3, 7.5**

### Propriedade 7: Exit code do Conformance_Checker reflete estado de violações

*Para qualquer* estado de estrutura de diretórios `S`: se `S` não contém nenhuma violação das regras definidas, o Conformance_Checker deve retornar exit code `0`; se `S` contém pelo menos uma violação com severidade `critical`, deve retornar exit code `1`.

**Valida: Requisitos 9.2, 9.3**

### Propriedade 8: Idempotência do Conformance_Checker

*Para qualquer* estrutura de diretórios `S` e qualquer inteiro `N > 0`, executar o Conformance_Checker `N` vezes consecutivas sobre `S` deve produzir o mesmo conjunto de violações em cada execução.

**Valida: Requisito 9.6**

---

## Tratamento de Erros

### Conformance_Checker

- Se a Workspace_Root não puder ser determinada (sem `package.json` na raiz), o checker imprime erro em `stderr` e retorna exit code `2` (erro de configuração, distinto de violações).
- Erros de leitura de arquivo são reportados como `info`-level com o caminho problemático, sem interromper a análise dos demais arquivos.
- O checker nunca modifica arquivos — apenas reporta.

### Onda_1 e Onda_2

- Se qualquer gate de validação falhar (CI vermelho, Conformance_Checker com violações críticas), a onda é pausada. O commit ofensor é identificado via `git bisect` se necessário.
- Aliases temporários são marcados explicitamente no código e em um arquivo `MIGRATION_STATUS.md` na raiz durante a transição, removido ao final da Onda_2.

### Resolução de Dependências

- Se `npm install` falhar na resolução de um workspace local, verificar se o `name` no `package.json` do workspace corresponde exatamente ao `name` declarado como dependência (case-sensitive).
- O comando `npm ls @escapekit/core` na raiz deve mostrar a resolução para o workspace local, não para o npm registry.

---

## Estratégia de Testes

### Testes Unitários

Focados em exemplos específicos e casos de borda:

- Verificar que `package.json` da raiz contém `workspaces: ["apps/*", "apps/experimental/*", "packages/*"]`
- Verificar que `apps/escapekit/package.json` contém `name: "@escapekit/core"`, `main`, `exports` e scripts obrigatórios
- Verificar que `apps/qwen-escapekit/package.json` declara `"@escapekit/core": "*"` como dependência
- Verificar que `packages/README.md` existe
- Verificar que `docs/status/` existe
- Verificar que o Workspace_Manifest contém o script `"conformance"`
- Verificar que `.github/workflows/ci.yml` contém o step `npm run conformance`
- Verificar que o Conformance_Checker produz output agrupado por categoria

### Testes de Propriedade (Property-Based Testing com fast-check)

Biblioteca: **fast-check** (já presente em `devDependencies`).
Configuração mínima: 100 iterações por propriedade.
Tag de referência: `// Feature: repo-monorepo-restructure, Property N: <texto>`

```typescript
// Exemplo — Propriedade 8: Idempotência
// Feature: repo-monorepo-restructure, Property 8: Idempotência do Conformance_Checker
test("idempotência do conformance checker", () => {
  fc.assert(
    fc.property(fc.record({ /* estrutura de diretórios arbitrária */ }), (structure) => {
      const result1 = runChecker(structure);
      const result2 = runChecker(structure);
      expect(result1.violations).toEqual(result2.violations);
      expect(result1.exitCode).toBe(result2.exitCode);
    }),
    { numRuns: 100 }
  );
});
```

Cada propriedade de correção acima deve ser implementada por um único teste de propriedade. O teste deve:
- Referenciar o número da propriedade no comentário de tag
- Executar com mínimo de 100 iterações (`numRuns: 100`)
- Cobrir casos de borda (estrutura vazia, estrutura totalmente conforme, estrutura com múltiplas violações)

### Balanço Unitário vs. Propriedade

Evitar duplicação: testes unitários cobrem exemplos concretos e integrações; testes de propriedade cobrem o comportamento geral do Conformance_Checker sobre inputs variados. Não escrever um teste unitário para cada regra individual do checker — a Propriedade 7 cobre o comportamento geral.
