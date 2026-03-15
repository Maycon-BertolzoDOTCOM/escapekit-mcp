/**
 * AST Transformer for JavaScript/TypeScript Code
 *
 * This module provides low-level AST manipulation utilities using Babel parser
 * and recast for formatting preservation. It supports ES6 imports, CommonJS require,
 * dynamic imports, and TypeScript type imports.
 *
 * @module transformers/ASTTransformer
 */
import * as t from '@babel/types';
declare const traverse: any;
/**
 * Visitor type for AST traversal
 */
export type Visitor = Parameters<typeof traverse>[1];
/**
 * AST node type (using Babel types)
 */
export type AST = t.File;
/**
 * Import node types that can be found in the AST
 */
export type ImportNode = t.ImportDeclaration | t.CallExpression | t.TSImportType;
/**
 * Options for parsing code
 */
export interface ParseOptions {
    /** Source type: 'module' or 'script' */
    sourceType?: 'module' | 'script';
    /** Enable TypeScript parsing */
    typescript?: boolean;
    /** Enable JSX parsing */
    jsx?: boolean;
}
/**
 * Options for generating code
 */
export interface GenerateOptions {
    /** Preserve original formatting */
    preserveFormatting?: boolean;
    /** Quote style: 'single' or 'double' */
    quotes?: 'single' | 'double';
    /** Tab width for indentation */
    tabWidth?: number;
}
/**
 * ASTTransformer provides low-level AST manipulation utilities.
 *
 * This class uses Babel for parsing and traversal, and recast for
 * formatting-preserving code generation.
 *
 * @example
 * ```typescript
 * const transformer = new ASTTransformer();
 * const ast = transformer.parse("import foo from 'bar';");
 * const imports = transformer.findImports(ast);
 * transformer.replaceImport(imports[0], 'baz');
 * const code = transformer.generate(ast);
 * ```
 */
export declare class ASTTransformer {
    /**
     * Parse JavaScript/TypeScript code into an AST.
     *
     * Uses Babel parser with TypeScript and JSX plugins enabled by default.
     *
     * @param code - Source code to parse
     * @param options - Parser options
     * @returns Parsed AST
     *
     * @example
     * ```typescript
     * const ast = transformer.parse("import React from 'react';", {
     *   typescript: true,
     *   jsx: true
     * });
     * ```
     */
    parse(code: string, options?: ParseOptions): AST;
    /**
     * Generate code from an AST.
     *
     * Uses recast to preserve original formatting when possible.
     *
     * @param ast - AST to generate code from
     * @param options - Generator options
     * @returns Generated source code
     *
     * @example
     * ```typescript
     * const code = transformer.generate(ast, {
     *   preserveFormatting: true,
     *   quotes: 'single'
     * });
     * ```
     */
    generate(ast: AST, options?: GenerateOptions): string;
    /**
     * Traverse the AST with a visitor pattern.
     *
     * Uses Babel traverse to walk the AST and apply visitor functions.
     *
     * @param ast - AST to traverse
     * @param visitor - Visitor object with node type handlers
     *
     * @example
     * ```typescript
     * transformer.traverse(ast, {
     *   ImportDeclaration(path) {
     *     console.log('Found import:', path.node.source.value);
     *   }
     * });
     * ```
     */
    traverse(ast: AST, visitor: Visitor): void;
    /**
     * Find all import statements in the AST.
     *
     * Locates ES6 imports, CommonJS require calls, dynamic imports,
     * and TypeScript type imports.
     *
     * @param ast - AST to search
     * @returns Array of import nodes
     *
     * @example
     * ```typescript
     * const imports = transformer.findImports(ast);
     * imports.forEach(node => {
     *   if (t.isImportDeclaration(node)) {
     *     console.log('ES6 import:', node.source.value);
     *   }
     * });
     * ```
     */
    findImports(ast: AST): ImportNode[];
    /**
     * Replace the package name in an import node.
     *
     * Modifies the import node in-place to use a new package name.
     * Supports ES6 imports, CommonJS require, dynamic imports, and TypeScript type imports.
     *
     * @param node - Import node to modify
     * @param newPackage - New package name to use
     *
     * @example
     * ```typescript
     * const imports = transformer.findImports(ast);
     * transformer.replaceImport(imports[0], 'new-package');
     * ```
     */
    replaceImport(node: ImportNode, newPackage: string): void;
    /**
     * Parse code using recast for maximum formatting preservation.
     *
     * This method uses recast's parser which preserves more formatting
     * information than Babel's parser alone.
     *
     * @param code - Source code to parse
     * @param options - Parser options
     * @returns Parsed AST with formatting information
     *
     * @example
     * ```typescript
     * const ast = transformer.parseWithRecast("import foo from 'bar';");
     * // Modify AST...
     * const code = transformer.generate(ast); // Formatting preserved
     * ```
     */
    parseWithRecast(code: string, options?: ParseOptions): AST;
}
export {};
//# sourceMappingURL=ASTTransformer.d.ts.map