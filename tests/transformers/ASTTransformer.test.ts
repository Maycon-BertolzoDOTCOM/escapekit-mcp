/**
 * Unit tests for ASTTransformer
 */

import { describe, it, expect } from 'vitest';
import { ASTTransformer } from '../../src/transformers/ASTTransformer.js';
import * as t from '@babel/types';

describe('ASTTransformer', () => {
  const transformer = new ASTTransformer();

  describe('parse', () => {
    it('should parse ES6 import statements', () => {
      const code = "import foo from 'bar';";
      const ast = transformer.parse(code);
      
      expect(ast).toBeDefined();
      expect(ast.type).toBe('File');
      expect(ast.program.type).toBe('Program');
    });

    it('should parse TypeScript code', () => {
      const code = "const x: number = 42;";
      const ast = transformer.parse(code, { typescript: true });
      
      expect(ast).toBeDefined();
      expect(ast.program.body).toHaveLength(1);
    });

    it('should parse JSX code', () => {
      const code = "const element = <div>Hello</div>;";
      const ast = transformer.parse(code, { jsx: true, typescript: true });
      
      expect(ast).toBeDefined();
      expect(ast.program.body).toHaveLength(1);
    });

    it('should parse CommonJS require', () => {
      const code = "const foo = require('bar');";
      const ast = transformer.parse(code);
      
      expect(ast).toBeDefined();
      expect(ast.program.body).toHaveLength(1);
    });

    it('should parse dynamic imports', () => {
      const code = "const foo = import('bar');";
      const ast = transformer.parse(code);
      
      expect(ast).toBeDefined();
      expect(ast.program.body).toHaveLength(1);
    });
  });

  describe('generate', () => {
    it('should generate code from AST', () => {
      const code = "import foo from 'bar';";
      const ast = transformer.parse(code);
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('import');
      expect(generated).toContain('foo');
      expect(generated).toContain('bar');
    });

    it('should preserve formatting by default', () => {
      const code = "import  foo  from  'bar';  // comment";
      const ast = transformer.parseWithRecast(code);
      const generated = transformer.generate(ast, { preserveFormatting: true });
      
      // Should preserve the general structure
      expect(generated).toContain('import');
      expect(generated).toContain('foo');
      expect(generated).toContain('bar');
    });

    it('should respect quote style option', () => {
      const code = 'import foo from "bar";';
      const ast = transformer.parse(code);
      const generated = transformer.generate(ast, { quotes: 'single' });
      
      expect(generated).toContain("'bar'");
    });
  });

  describe('traverse', () => {
    it('should traverse AST with visitor pattern', () => {
      const code = "import foo from 'bar';\nimport baz from 'qux';";
      const ast = transformer.parse(code);
      
      const imports: string[] = [];
      transformer.traverse(ast, {
        ImportDeclaration(path) {
          imports.push(path.node.source.value);
        }
      });
      
      expect(imports).toEqual(['bar', 'qux']);
    });

    it('should visit multiple node types', () => {
      const code = "import foo from 'bar';\nconst baz = require('qux');";
      const ast = transformer.parse(code);
      
      let importCount = 0;
      let requireCount = 0;
      
      transformer.traverse(ast, {
        ImportDeclaration() {
          importCount++;
        },
        CallExpression(path) {
          if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'require') {
            requireCount++;
          }
        }
      });
      
      expect(importCount).toBe(1);
      expect(requireCount).toBe(1);
    });
  });

  describe('findImports', () => {
    it('should find ES6 import statements', () => {
      const code = "import foo from 'bar';\nimport { baz } from 'qux';";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(2);
      expect(imports.every(node => t.isImportDeclaration(node))).toBe(true);
    });

    it('should find CommonJS require calls', () => {
      const code = "const foo = require('bar');\nconst baz = require('qux');";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(2);
      expect(imports.every(node => t.isCallExpression(node))).toBe(true);
    });

    it('should find dynamic import calls', () => {
      const code = "const foo = import('bar');\nconst baz = import('qux');";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(2);
      expect(imports.every(node => t.isCallExpression(node))).toBe(true);
    });

    it('should find mixed import types', () => {
      const code = `
        import foo from 'bar';
        const baz = require('qux');
        const quux = import('corge');
      `;
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(3);
    });

    it('should find TypeScript type imports', () => {
      const code = "import type { Foo } from 'bar';";
      const ast = transformer.parse(code, { typescript: true });
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(1);
      expect(t.isImportDeclaration(imports[0])).toBe(true);
    });

    it('should not find non-import function calls', () => {
      const code = "console.log('test');\nfoo('bar');";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(0);
    });
  });

  describe('replaceImport', () => {
    it('should replace ES6 import source', () => {
      const code = "import foo from 'old-package';";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      transformer.replaceImport(imports[0], 'new-package');
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).not.toContain('old-package');
    });

    it('should replace CommonJS require source', () => {
      const code = "const foo = require('old-package');";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      transformer.replaceImport(imports[0], 'new-package');
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).not.toContain('old-package');
    });

    it('should replace dynamic import source', () => {
      const code = "const foo = import('old-package');";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      transformer.replaceImport(imports[0], 'new-package');
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).not.toContain('old-package');
    });

    it('should preserve import specifiers when replacing', () => {
      const code = "import { foo, bar } from 'old-package';";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      transformer.replaceImport(imports[0], 'new-package');
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).toContain('foo');
      expect(generated).toContain('bar');
    });

    it('should preserve default imports when replacing', () => {
      const code = "import React from 'old-package';";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      transformer.replaceImport(imports[0], 'new-package');
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).toContain('React');
    });

    it('should preserve namespace imports when replacing', () => {
      const code = "import * as utils from 'old-package';";
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      
      transformer.replaceImport(imports[0], 'new-package');
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).toContain('utils');
    });
  });

  describe('parseWithRecast', () => {
    it('should parse code with recast for formatting preservation', () => {
      const code = "import foo from 'bar';";
      const ast = transformer.parseWithRecast(code);
      
      expect(ast).toBeDefined();
      expect(ast.type).toBe('File');
    });

    it('should preserve formatting when using recast', () => {
      const code = "import  foo  from  'bar';";
      const ast = transformer.parseWithRecast(code);
      const generated = transformer.generate(ast);
      
      // Should preserve the structure
      expect(generated).toContain('import');
      expect(generated).toContain('foo');
      expect(generated).toContain('bar');
    });
  });

  describe('integration', () => {
    it('should handle complete transformation workflow', () => {
      const code = `
import oldPkg from 'old-package';
const another = require('another-old');
const dynamic = import('dynamic-old');

function test() {
  return oldPkg.doSomething();
}
      `.trim();
      
      const ast = transformer.parseWithRecast(code);
      const imports = transformer.findImports(ast);
      
      expect(imports).toHaveLength(3);
      
      // Replace all imports
      transformer.replaceImport(imports[0], 'new-package');
      transformer.replaceImport(imports[1], 'another-new');
      transformer.replaceImport(imports[2], 'dynamic-new');
      
      const generated = transformer.generate(ast);
      
      expect(generated).toContain('new-package');
      expect(generated).toContain('another-new');
      expect(generated).toContain('dynamic-new');
      expect(generated).not.toContain('old-package');
      expect(generated).not.toContain('another-old');
      expect(generated).not.toContain('dynamic-old');
      
      // Should preserve function code
      expect(generated).toContain('function test()');
      expect(generated).toContain('doSomething');
    });
  });
});
