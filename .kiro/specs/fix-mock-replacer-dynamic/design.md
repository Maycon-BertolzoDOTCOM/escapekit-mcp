# Design Document

## Overview

Refatoração do `MockReplacer` para substituir a tabela hardcoded por uma Resolution_Chain dinâmica de quatro etapas: `KnowledgeBase` → `SemanticMatcher` → `NPMRegistry` → tabela hardcoded. As dependências são injetadas via construtor com fallback para instâncias padrão, mantendo compatibilidade total com a interface `Fixer` e com o `AutoFixEngine` existente.

---

## Architecture

### Componentes Envolvidos

```
AutoFixEngine
    └── MockReplacer (refatorado)
            ├── KnowledgeBase      (injetado ou instância padrão)
            ├── SemanticMatcher    (injetado ou instância padrão)
            ├── NPMRegistry        (injetado ou instância padrão)
            └── replacements: Record<string,string>  (tabela hardcoded — fallback)
```

### Fluxo da Resolution_Chain

```
fix(projectPath, issue)
    │
    ├─ 1. KnowledgeBase.getMapping(ghostImport)
    │       ├─ found  → apply replacement, log "knowledge-base"
    │       └─ null   → next
    │
    ├─ 2. SemanticMatcher.findSimilar(ghostImport)
    │       ├─ results[0]  → apply replacement, log "semantic-matcher"
    │       └─ []          → next
    │
    ├─ 3. NPMRegistry.packageExists(ghostImport)
    │       ├─ true   → return applied:false, log "npm-registry-verified"
    │       └─ false  → next
    │
    ├─ 4. replacements[ghostImport]  (tabela hardcoded)
    │       ├─ found  → apply replacement, log "hardcoded-table"
    │       └─ undefined → return applied:false, error:"No matching replacement found"
    │
    └─ applyReplacement(filePath, ghostImport, realPackage)
            └─ updatePackageJson(projectPath, ghostImport, realPackage)
```

---

## Detailed Design

### 1. Construtor com Injeção de Dependências

```typescript
export interface MockReplacerDeps {
  knowledgeBase?: KnowledgeBase;
  semanticMatcher?: SemanticMatcher;
  npmRegistry?: NPMRegistry;
}

export class MockReplacer implements Fixer {
  private readonly knowledgeBase: KnowledgeBase;
  private readonly semanticMatcher: SemanticMatcher;
  private readonly npmRegistry: NPMRegistry;

  constructor(deps: MockReplacerDeps = {}) {
    this.npmRegistry = deps.npmRegistry ?? new NPMRegistry();
    this.knowledgeBase = deps.knowledgeBase ?? new KnowledgeBase();
    this.semanticMatcher = deps.semanticMatcher ?? new SemanticMatcher(this.npmRegistry);
  }
  // ...
}
```

O `AutoFixEngine` continua instanciando `new MockReplacer()` sem argumentos — nenhuma mudança necessária.

### 2. Método `fix` Refatorado

O método `fix` extrai o ghost import da mensagem do issue (lógica existente mantida) e delega para `resolveReplacement`. Se um substituto for encontrado, chama `applyReplacement` (lógica de substituição de texto extraída do método atual).

```typescript
async fix(projectPath: string, issue: Issue): Promise<Fix> {
  // validações de issue.file (mantidas)
  const ghostImport = this.extractGhostImport(issue.message);
  if (!ghostImport) { /* retorno de erro existente */ }

  const resolved = await this.resolveReplacement(ghostImport);
  if (!resolved) {
    return { issueType: issue.type, description: '...', applied: false, error: 'No matching replacement found' };
  }
  if (resolved.strategy === 'npm-registry-verified') {
    return { issueType: issue.type, description: 'Package exists on npm registry, no replacement needed', applied: false };
  }

  return this.applyReplacement(projectPath, issue, ghostImport, resolved.realPackage, resolved.strategy);
}
```

### 3. Método `resolveReplacement`

```typescript
private async resolveReplacement(
  ghostImport: string
): Promise<{ realPackage: string; strategy: string } | null> {

  // Etapa 1: KnowledgeBase
  const kbMapping = this.knowledgeBase.getMapping(ghostImport);
  if (kbMapping?.realPackages[0]) {
    this.log.info('Resolved via knowledge-base', { ghostImport, realPackage: kbMapping.realPackages[0] });
    return { realPackage: kbMapping.realPackages[0], strategy: 'knowledge-base' };
  }

  // Etapa 2: SemanticMatcher
  try {
    const matches = await this.semanticMatcher.findSimilar(ghostImport);
    if (matches.length > 0) {
      const best = matches[0];
      this.log.info('Resolved via semantic-matcher', { ghostImport, realPackage: best.realPackages[0], confidence: best.confidence });
      return { realPackage: best.realPackages[0], strategy: 'semantic-matcher' };
    }
  } catch (err) {
    this.log.warn('SemanticMatcher failed, continuing', { ghostImport, error: err });
  }

  // Etapa 3: NPMRegistry
  try {
    const exists = await this.npmRegistry.packageExists(ghostImport);
    if (exists) {
      this.log.info('Package verified on npm registry, no replacement needed', { ghostImport });
      return { realPackage: ghostImport, strategy: 'npm-registry-verified' };
    }
  } catch (err) {
    this.log.warn('NPMRegistry check failed, continuing', { ghostImport, error: err });
  }

  // Etapa 4: Tabela hardcoded
  const hardcoded = this.replacements[ghostImport];
  if (hardcoded) {
    this.log.info('Resolved via hardcoded-table', { ghostImport, realPackage: hardcoded });
    return { realPackage: hardcoded, strategy: 'hardcoded-table' };
  }

  this.log.warn('No replacement found after exhausting all strategies', { ghostImport });
  return null;
}
```

### 4. Extração de Métodos Auxiliares

Para manter o método `fix` legível, dois métodos privados são extraídos:

- `extractGhostImport(message: string): string | null` — lógica do regex existente (`/["']([^"']+)["']/`).
- `applyReplacement(projectPath, issue, ghostImport, realPackage, strategy): Promise<Fix>` — lógica de substituição de texto e chamada a `updatePackageJson`, já existente no método `fix` atual.

### 5. Inicialização da KnowledgeBase Padrão

Quando instanciada sem dependências, a `KnowledgeBase` padrão começa vazia. Para carregar o `knowledge-base.json`, o `MockReplacer` expõe um método `initialize()` assíncrono opcional:

```typescript
async initialize(knowledgeBasePath?: string): Promise<void> {
  const kbPath = knowledgeBasePath ?? join(process.cwd(), 'knowledge-base.json');
  try {
    await this.knowledgeBase.loadFromFile(kbPath);
    this.log.info('KnowledgeBase loaded', { path: kbPath, size: this.knowledgeBase.size() });
  } catch (err) {
    this.log.warn('Could not load knowledge-base.json, continuing without it', { error: err });
  }
}
```

O `AutoFixEngine` pode chamar `initialize()` após instanciar o `MockReplacer`, ou o `MockReplacer` pode tentar carregar lazily na primeira chamada a `fix`. A abordagem lazy é preferida para não bloquear a construção do `AutoFixEngine`.

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são suficientes:

- `PackageMapping` (de `src/models/transformation.ts`) — retornado por `KnowledgeBase.getMapping` e `SemanticMatcher.findSimilar`.
- `Fix`, `Issue`, `Fixer` (de `src/validate/types.ts`) — interface pública mantida sem alterações.

---

## Error Handling

| Situação | Comportamento |
|---|---|
| `KnowledgeBase.getMapping` retorna `null` | Avança para próxima etapa |
| `SemanticMatcher.findSimilar` lança exceção | Log `warn`, avança para próxima etapa |
| `NPMRegistry.packageExists` lança exceção | Log `warn`, avança para próxima etapa |
| `knowledge-base.json` não encontrado | Log `warn`, `KnowledgeBase` permanece vazia |
| Nenhuma estratégia resolve | Retorna `Fix { applied: false, error: "No matching replacement found" }` |
| Falha ao escrever arquivo | Retorna `Fix { applied: false, error: <mensagem> }` (comportamento existente mantido) |

---

## Testing Strategy

### Testes Unitários (novos)

Arquivo: `tests/validate/MockReplacer.test.ts`

1. **Resolução via KnowledgeBase**: mock de `KnowledgeBase.getMapping` retornando um `PackageMapping` → verifica `applied: true` e log com `"knowledge-base"`.
2. **Resolução via SemanticMatcher**: `KnowledgeBase` retorna `null`, mock de `SemanticMatcher.findSimilar` retornando resultado → verifica `applied: true` e log com `"semantic-matcher"`.
3. **Verificação via NPMRegistry**: `KnowledgeBase` e `SemanticMatcher` sem resultado, `NPMRegistry.packageExists` retorna `true` → verifica `applied: false` com descrição correta.
4. **Fallback hardcoded**: todas as estratégias dinâmicas sem resultado, ghost import presente na tabela → verifica `applied: true` e log com `"hardcoded-table"`.
5. **Nenhuma estratégia resolve**: todas as estratégias sem resultado → verifica `applied: false` e `error: "No matching replacement found"`.
6. **Exceção no SemanticMatcher**: `findSimilar` lança erro → verifica que a cadeia continua sem propagar exceção.
7. **Exceção no NPMRegistry**: `packageExists` lança erro → verifica que a cadeia continua sem propagar exceção.
8. **Compatibilidade retroativa (round-trip)**: para cada um dos 18 mapeamentos hardcoded, instanciar `MockReplacer` sem deps e verificar que o resultado é equivalente ao comportamento anterior.

### Correctness Properties

1. **Invariante de interface**: para qualquer `Issue` válido, `fix` sempre retorna um objeto `Fix` com `issueType`, `description` e `applied` definidos — nunca lança exceção.
2. **Prioridade da cadeia**: se `KnowledgeBase` retorna um mapeamento, o resultado nunca usa `SemanticMatcher`, `NPMRegistry` ou tabela hardcoded.
3. **Round-trip de compatibilidade**: para todos os ghost imports da tabela hardcoded, `new MockReplacer().fix(...)` produz `applied: true` com o mesmo `realPackage` da implementação anterior.
4. **Idempotência de `updatePackageJson`**: chamar `fix` duas vezes com o mesmo ghost import não duplica entradas no `package.json`.

---

## Implementation Notes

- A lógica de substituição de texto (regex de `from '...'` e `require(...)`) é mantida sem alterações — apenas extraída para `applyReplacement`.
- O `AutoFixEngine` não precisa de nenhuma modificação.
- A inicialização lazy da `KnowledgeBase` (tentativa de carregar `knowledge-base.json` na primeira chamada a `fix`) evita I/O desnecessário quando o `MockReplacer` é instanciado mas nunca usado.
- O `SemanticMatcher` faz chamadas ao npm registry; em ambientes sem rede, as exceções são capturadas e a cadeia continua normalmente.
