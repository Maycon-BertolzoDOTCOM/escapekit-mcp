# 🔄 AI Template: New AST Transformer

## Context
We are creating a new AST transformer for the EscapeKit MCP transformation engine. Transformers modify AI-generated code to replace sandbox-specific patterns with production-ready equivalents.

## Task
Create a transformer called `[TransformerName]` that transforms **[description of the code pattern to transform]**.

## Technical Requirements

### 1. File Location
- Source: `src/transformers/[TransformerName].ts`
- Tests: `tests/transformers/[TransformerName].test.ts`
- Register in: `src/transformers/index.ts`

### 2. Implementation Pattern
```typescript
// Follow the pattern of existing transformers (e.g., ImportReplacer.ts)
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { print } from 'recast';

export class [TransformerName] {
  transform(code: string, options?: TransformOptions): TransformResult {
    // 1. Parse with Babel (preserving formatting via recast)
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    // 2. Traverse and modify AST nodes
    traverse(ast, {
      // Target specific node types
    });

    // 3. Generate code (recast preserves original formatting)
    const output = print(ast);
    
    return {
      code: output.code,
      transformations: this.transformations,
    };
  }
}
```

### 3. Key Principles
- **Preserve formatting**: Use recast's `print()`, NOT `@babel/generator`
- **Track transformations**: Record every change for the escape contract
- **Handle edge cases**: TypeScript, JSX, CommonJS vs ES modules
- **Never lose code**: If unsure about a transformation, skip it with a warning

### 4. Testing Requirements
- **Round-trip test**: Code → transform → verify it parses correctly
- **Formatting preservation**: Comments, whitespace, indentation must survive
- **Multiple patterns**: Test with CommonJS `require()` AND ES6 `import`
- **TypeScript**: Test with `.ts` and `.tsx` inputs
- **No-op test**: Code without the target pattern should pass through unchanged

### 5. Transform Result
```typescript
interface TransformResult {
  code: string;
  transformations: Transformation[];
  warnings: string[];
}

interface Transformation {
  type: string;
  original: string;
  replacement: string;
  line: number;
  reason: string;
}
```

## Example Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { [TransformerName] } from '../../src/transformers/[TransformerName]';

describe('[TransformerName]', () => {
  const transformer = new [TransformerName]();

  it('should transform [pattern] to [replacement]', () => {
    const input = `import { thing } from 'ghost-package';`;
    const result = transformer.transform(input);
    expect(result.code).toContain(`from 'real-package'`);
    expect(result.transformations).toHaveLength(1);
  });

  it('should preserve formatting and comments', () => {
    const input = `// Important comment\nimport { thing } from 'ghost-package'; // inline`;
    const result = transformer.transform(input);
    expect(result.code).toContain('// Important comment');
    expect(result.code).toContain('// inline');
  });

  it('should not modify code without target patterns', () => {
    const input = `const x = 42;`;
    const result = transformer.transform(input);
    expect(result.code).toBe(input);
    expect(result.transformations).toHaveLength(0);
  });
});
```

## Reference
- Existing transformers: `src/transformers/ImportReplacer.ts`, `src/transformers/ASTTransformer.ts`
- Babel parser docs: https://babeljs.io/docs/babel-parser
- Recast docs: https://github.com/benjamn/recast
- Knowledge base: `knowledge-base.json` (ghost → real mappings)
