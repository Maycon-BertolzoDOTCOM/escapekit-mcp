# Extending the Knowledge Base

The knowledge base maps ghost import names (fake/sandbox packages) to real npm packages.
It lives in `knowledge-base.json` at the project root.

## knowledge-base.json Format

```json
{
  "mappings": {
    "<ghost-package-name>": {
      "realPackage": "<npm-package>",
      "version": "latest",
      "strategy": "DIRECT_REPLACEMENT",
      "confidence": 0.95,
      "additionalPackages": ["<optional-peer-dep>"],
      "reason": "Human-readable explanation"
    }
  }
}
```

| Field               | Type     | Required | Description                                      |
|---------------------|----------|----------|--------------------------------------------------|
| `realPackage`       | string   | ✅       | Primary npm package to install                   |
| `version`           | string   | —        | Version constraint (default: `"latest"`)         |
| `strategy`          | string   | —        | `DIRECT_REPLACEMENT` or `API_REPLACEMENT`        |
| `confidence`        | number   | —        | 0.0–1.0, how certain the mapping is (default: 1) |
| `additionalPackages`| string[] | —        | Peer deps or type packages to install alongside  |
| `reason`            | string   | —        | Explanation shown in the escape contract         |

## Example: Adding a Custom Internal Package

Say your team uses `@acme/design-system` in AI prototypes but the real package is `@acme/ui`.

```json
{
  "mappings": {
    "@acme/design-system": {
      "realPackage": "@acme/ui",
      "version": "^3.0.0",
      "strategy": "DIRECT_REPLACEMENT",
      "confidence": 1.0,
      "additionalPackages": ["@acme/ui-tokens"],
      "reason": "Internal design system — prototype alias maps to the published @acme/ui package"
    }
  }
}
```

## Using addMapping() Programmatically

```typescript
import { KnowledgeBase } from './src/resolvers/KnowledgeBase.js';
import { MappingStrategy } from './src/models/transformation.js';

const kb = new KnowledgeBase();

// Load the existing base first
await kb.loadFromFile('./knowledge-base.json');

// Add your custom mapping
kb.addMapping({
  ghostPackage: '@acme/design-system',
  realPackages: ['@acme/ui', '@acme/ui-tokens'],
  confidence: 1.0,
  mappingStrategy: MappingStrategy.EXACT_MATCH,
  metadata: {
    reason: 'Internal design system alias',
    source: 'custom',
  },
});

// Optionally persist it back
await kb.exportToFile('./knowledge-base.json');

console.log(`Knowledge base now has ${kb.size()} mappings`);
```

## Lookup a Mapping

```typescript
const mapping = kb.getMapping('@acme/design-system');

if (mapping) {
  console.log(mapping.realPackages);   // ['@acme/ui', '@acme/ui-tokens']
  console.log(mapping.confidence);     // 1.0
}
```

## Tips

- Keep `confidence` at `1.0` for exact internal aliases you fully control.
- Use `0.8`–`0.95` for community packages where the mapping is a best-guess.
- `additionalPackages` are installed alongside `realPackage` — useful for `@types/*` or peer deps.
- After editing `knowledge-base.json`, no restart is needed; `KnowledgeBase.loadFromFile()` reads it fresh each run.
