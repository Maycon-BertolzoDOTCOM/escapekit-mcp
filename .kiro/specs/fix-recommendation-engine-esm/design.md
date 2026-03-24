# Design Document

## Overview

Correção cirúrgica do `RecommendationEngine` para compatibilidade ESM: substituição de `__dirname` por `new URL('.', import.meta.url).pathname` e migração dos `console.warn`/`console.log` para `logger.child('RecommendationEngine')`. Nenhuma interface pública é alterada. O teste existente em `tests/recommendations/recommendation-engine.test.ts` é expandido com casos que cobrem as propriedades de corretude da correção.

---

## Architecture

### Componentes Envolvidos

```
RecommendationEngine (corrigido)
    ├── import.meta.url          (substitui __dirname)
    ├── logger.child(...)        (substitui console.warn / console.log)
    └── templateCache: Map<string, RecommendationTemplate>
            ├── framework-mix.yaml
            ├── ghost-import.yaml
            ├── mock-api.yaml
            └── phantom-dependency.yaml
```

Nenhum outro componente é afetado. O `RecommendationEngine` não é instanciado em código de produção fora dos testes — é exportado via `src/recommendations/index.ts` mas não há `new RecommendationEngine()` em nenhum arquivo `src/`. A correção elimina o `ReferenceError` latente que seria ativado na primeira instanciação em runtime.

---

## Detailed Design

### 1. Substituição de `__dirname` por `import.meta.url`

A única mudança funcional no método `loadTemplates` é a linha de resolução do caminho:

```typescript
// ANTES (CommonJS — causa ReferenceError em ESM):
const templatesDir = resolve(__dirname, 'templates');

// DEPOIS (ESM — padrão já usado em FallbackGenerator.ts):
const templatesDir = resolve(new URL('.', import.meta.url).pathname, 'templates');
```

`new URL('.', import.meta.url)` cria uma URL apontando para o diretório do arquivo atual. `.pathname` extrai o caminho do sistema de arquivos. O resultado é equivalente a `__dirname` em CommonJS.

O `FallbackGenerator.ts` usa `new URL('../../..', import.meta.url).pathname` para navegar para a raiz do projeto. O `RecommendationEngine` usa `new URL('.', import.meta.url).pathname` para referenciar o próprio diretório — padrão mais simples e direto.

### 2. Adição do Logger Estruturado

```typescript
import { logger } from '../logger.js';

export class RecommendationEngine {
  private templateCache: Map<string, RecommendationTemplate> = new Map();
  private readonly log = logger.child('RecommendationEngine');
  // ...
}
```

Substituições no método `loadTemplates`:

```typescript
// ANTES:
console.warn(`Templates directory not found: ${templatesDir}`);
// DEPOIS:
this.log.warn('Templates directory not found', { templatesDir });

// ANTES:
console.log(`RecommendationEngine: Loaded ${this.templateCache.size} templates`);
// DEPOIS:
this.log.info('Templates loaded', { count: this.templateCache.size });

// ANTES:
console.warn('Error loading recommendation templates:', error);
// DEPOIS:
this.log.warn('Error loading recommendation templates', { error });
```

### 3. Método `loadTemplates` após a correção

```typescript
private loadTemplates(): void {
  const templatesDir = resolve(new URL('.', import.meta.url).pathname, 'templates');

  if (!existsSync(templatesDir)) {
    this.log.warn('Templates directory not found', { templatesDir });
    return;
  }

  try {
    const files = readdirSync(templatesDir).filter((f: string) => f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = resolve(templatesDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const template = YAML.parse(content) as RecommendationTemplate;
      if (template.id) {
        this.templateCache.set(template.id, template);
      }
    }
    this.log.info('Templates loaded', { count: this.templateCache.size });
  } catch (error) {
    this.log.warn('Error loading recommendation templates', { error });
  }
}
```

### 4. Decisão de Design: API Síncrona de `fs`

O uso de `existsSync`, `readdirSync` e `readFileSync` é mantido intencionalmente. O carregamento de templates ocorre no construtor, que é síncrono por design. Tornar o construtor assíncrono quebraria a interface pública e todos os pontos de instanciação. Os templates são arquivos locais pequenos (< 5KB cada), carregados uma única vez na inicialização — o custo de I/O síncrono é aceitável e previsível. Esta decisão está documentada como comentário no código.

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são mantidos sem alteração:

- `RecommendationTemplate` (de `./types.js`) — estrutura dos templates YAML.
- `Recommendation`, `RecommendationContext`, `RecommendationEngineOptions` (de `./types.js`) — interface pública inalterada.

---

## Error Handling

| Situação | Comportamento |
|---|---|
| `__dirname` em ESM (bug atual) | `ReferenceError` lançado no construtor — **eliminado pela correção** |
| Diretório `templates/` não encontrado | Log `warn` com caminho, `templateCache` vazio, construção completa sem exceção |
| Arquivo YAML inválido ou corrompido | `catch` captura o erro, log `warn`, templates anteriores ao erro permanecem no cache |
| Template sem campo `id` | Template ignorado silenciosamente (comportamento existente mantido) |
| `generate` com tipo sem template | Retorna recomendação genérica `generic-{problemType}` (comportamento existente mantido) |

---

## Testing Strategy

### Expansão do Arquivo de Testes Existente

O arquivo `tests/recommendations/recommendation-engine.test.ts` já cobre os casos funcionais. A correção adiciona um novo `describe` block focado nas propriedades de corretude da correção ESM:

**P1 — Instanciação sem ReferenceError:**
```typescript
it('should not throw ReferenceError when instantiated in ESM context', () => {
  expect(() => new RecommendationEngine()).not.toThrow();
});
```

**P2 — Templates carregados após construção:**
```typescript
it('should return non-empty array from getLoadedTemplateIds() after construction', () => {
  const engine = new RecommendationEngine();
  expect(engine.getLoadedTemplateIds().length).toBeGreaterThan(0);
});
```

**P3 — Degradação graciosa com diretório inexistente:**
Usando `vi.mock` para simular `existsSync` retornando `false`:
```typescript
it('should complete construction without throwing when templates directory does not exist', () => {
  vi.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
  expect(() => new RecommendationEngine()).not.toThrow();
  // templateCache vazio — hasTemplate retorna false para qualquer tipo
});
```

**P4 — `generate` retorna Recommendation com `id` definido:**
```typescript
it('should return Recommendation with defined id for ghost-import', async () => {
  const engine = new RecommendationEngine();
  const rec = await engine.generate({ problemType: 'ghost-import' });
  expect(rec.id).toBeDefined();
  expect(rec.id).not.toBeUndefined();
});
```

**P5 — Todos os templates YAML padrão carregados:**
```typescript
it('should load all four default templates', () => {
  const engine = new RecommendationEngine();
  const ids = engine.getLoadedTemplateIds();
  expect(ids).toContain('framework-mix');
  expect(ids).toContain('ghost-import');
  expect(ids).toContain('mock-api');
  expect(ids).toContain('phantom-dependency');
});
```

### Correctness Properties

1. **P1 — Sem ReferenceError**: `new RecommendationEngine()` não lança exceção em ambiente ESM — propriedade de segurança da correção principal.
2. **P2 — Templates carregados**: para qualquer diretório de templates válido com arquivos `.yaml`, `getLoadedTemplateIds()` retorna array não vazio após construção — invariante de carregamento.
3. **P3 — Degradação graciosa**: para qualquer diretório de templates inexistente, `new RecommendationEngine()` completa sem exceção — invariante de robustez já existente, agora verificável sem o `ReferenceError` mascarando o comportamento.
4. **P4 — `id` sempre definido**: `generate({ problemType: 'ghost-import' })` retorna `Recommendation` com `id` não `undefined` — invariante de completude da resposta.

---

## Implementation Notes

- A correção é de **duas linhas** no arquivo de produção: a linha do `resolve(__dirname, ...)` e a adição do import de `logger`. O restante são substituições de `console.*` por `this.log.*`.
- O `import { resolve } from 'path'` existente é mantido — `resolve` continua sendo usado com o novo caminho.
- O import de `url` não é necessário: `new URL(...)` é global em Node.js ESM, não requer import.
- O arquivo de testes existente (`recommendation-engine.test.ts`) já passa quando executado com Vitest em modo ESM — o `ReferenceError` ocorre apenas em runtime Node.js, não no ambiente de testes atual (que pode estar usando mocks ou um ambiente diferente). A correção garante que ambos os contextos funcionem corretamente.
- Nenhuma alteração é necessária em `src/recommendations/index.ts` ou em qualquer outro arquivo do projeto.

