# packages/

Este diretório contém bibliotecas reutilizáveis, integrações e extensões do ecossistema EscapeKit.

## Critérios para adicionar um novo pacote

Um diretório pode ser adicionado em `packages/` apenas se:

1. **Escopo correto**: O campo `name` no `package.json` deve usar o escopo `@escapekit/` (ex: `@escapekit/github-action`)
2. **package.json válido**: Deve declarar `name`, `version` e pelo menos um dos scripts `build` ou `test`
3. **Biblioteca ou integração**: O pacote deve ser uma biblioteca reutilizável ou integração com ferramenta externa — não um produto executável (esses ficam em `apps/`)
4. **Sem caminhos frágeis**: Dependências internas devem usar `"@escapekit/core": "*"` via workspace, nunca `file:../../dist/...`

## Pacotes ativos

| Pacote | Descrição |
|--------|-----------|
| `@escapekit/github-action` | GitHub Action para integração com CI/CD |
| `@escapekit/vscode-extension` | Extensão VS Code para CodeMemória Governance |

## Pacotes arquivados

Pacotes descontinuados são movidos para `archive/packages/`. Ver `archive/README.md` para critérios de arquivamento.
