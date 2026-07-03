import { describe, it, expect } from 'vitest';
import { ASTTransformer } from '../../src/transformers/ASTTransformer.ts';

describe('ASTTransformer', () => {
  describe('parse', () => {
    it('should parse simple JavaScript code', () => {
      const transformer = new ASTTransformer();
      const code = 'const x = 1;';
      const ast = transformer.parse(code);
      expect(ast).toBeDefined();
      expect(ast.type).toBe('File');
    });

    it('should parse ES6 module code', () => {
      const transformer = new ASTTransformer();
      const code = 'import React from "react";';
      const ast = transformer.parse(code, { sourceType: 'module' });
      expect(ast).toBeDefined();
    });

    it('should parse TypeScript code', () => {
      const transformer = new ASTTransformer();
      const code = 'const x: number = 1;';
      const ast = transformer.parse(code, { typescript: true });
      expect(ast).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate code from AST', () => {
      const transformer = new ASTTransformer();
      const code = 'const x = 1;';
      const ast = transformer.parse(code);
      const generated = transformer.generate(ast);
      expect(generated).toContain('const x = 1');
    });

    it('should preserve formatting when enabled', () => {
      const transformer = new ASTTransformer();
      const code = 'const x = 1;';
      const ast = transformer.parse(code);
      const generated = transformer.generate(ast, { preserveFormatting: true });
      expect(generated).toBeDefined();
    });
  });

  describe('findImports', () => {
    it('should find ES6 imports', () => {
      const transformer = new ASTTransformer();
      const code = 'import React from "react";';
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      expect(imports.length).toBeGreaterThan(0);
    });

    it('should find CommonJS requires', () => {
      const transformer = new ASTTransformer();
      const code = 'const fs = require("fs");';
      const ast = transformer.parse(code);
      const imports = transformer.findImports(ast);
      expect(imports.length).toBeGreaterThan(0);
    });
  });
});
