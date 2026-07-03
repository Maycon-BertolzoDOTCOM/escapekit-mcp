/**
 * AST Transformer for JavaScript/TypeScript Code
 *
 * This module provides low-level AST manipulation utilities using Babel parser
 * and recast for formatting preservation. It supports ES6 imports, CommonJS require,
 * dynamic imports, and TypeScript type imports.
 *
 * @module transformers/ASTTransformer
 */
import { parse as babelParse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { parse as recastParse, print as recastPrint } from 'recast';
// Handle both CommonJS and ES module imports for @babel/traverse
const traverse = traverseModule.default || traverseModule;
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
export class ASTTransformer {
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
    parse(code, options = {}) {
        const { sourceType = 'module', typescript = true, jsx = true } = options;
        const plugins = [];
        if (typescript) {
            plugins.push('typescript');
        }
        if (jsx) {
            plugins.push('jsx');
        }
        return babelParse(code, {
            sourceType,
            plugins,
            // Allow various syntax features
            allowImportExportEverywhere: true,
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
            allowSuperOutsideMethod: true,
            allowUndeclaredExports: true,
        });
    }
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
    generate(ast, options = {}) {
        const { preserveFormatting = true, quotes = 'single', tabWidth = 2 } = options;
        if (preserveFormatting) {
            // Use recast for formatting preservation
            const result = recastPrint(ast, {
                quote: quotes,
                tabWidth,
                // Preserve original formatting as much as possible
                reuseWhitespace: true,
            });
            return result.code;
        }
        else {
            // Use Babel generator for standard formatting
            // Note: For now, we'll use recast even without preserveFormatting
            // as it provides better control over output
            const result = recastPrint(ast, {
                quote: quotes,
                tabWidth,
                reuseWhitespace: false,
            });
            return result.code;
        }
    }
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
    traverse(ast, visitor) {
        traverse(ast, visitor);
    }
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
    findImports(ast) {
        const imports = [];
        this.traverse(ast, {
            // ES6 import statements: import foo from 'bar'
            ImportDeclaration(path) {
                imports.push(path.node);
            },
            // CommonJS require: const foo = require('bar')
            // Dynamic import: import('bar')
            CallExpression(path) {
                const { node } = path;
                // Check for require() calls
                if (t.isIdentifier(node.callee) &&
                    node.callee.name === 'require' &&
                    node.arguments.length === 1 &&
                    t.isStringLiteral(node.arguments[0])) {
                    imports.push(node);
                }
                // Check for dynamic import() calls
                if (t.isImport(node.callee) &&
                    node.arguments.length === 1 &&
                    t.isStringLiteral(node.arguments[0])) {
                    imports.push(node);
                }
            },
            // TypeScript type imports: import type { Foo } from 'bar'
            TSImportType(path) {
                imports.push(path.node);
            },
        });
        return imports;
    }
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
    replaceImport(node, newPackage) {
        // ES6 import declaration
        if (t.isImportDeclaration(node)) {
            node.source.value = newPackage;
            return;
        }
        // CommonJS require or dynamic import
        if (t.isCallExpression(node)) {
            const firstArg = node.arguments[0];
            if (t.isStringLiteral(firstArg)) {
                firstArg.value = newPackage;
            }
            return;
        }
        // TypeScript type import
        if (t.isTSImportType(node)) {
            if (t.isStringLiteral(node.argument)) {
                node.argument.value = newPackage;
            }
            return;
        }
    }
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
    parseWithRecast(code, options = {}) {
        const { typescript = true, jsx = true } = options;
        const plugins = [];
        if (typescript) {
            plugins.push('typescript');
        }
        if (jsx) {
            plugins.push('jsx');
        }
        return recastParse(code, {
            parser: {
                parse(source) {
                    return babelParse(source, {
                        sourceType: 'module',
                        plugins,
                        allowImportExportEverywhere: true,
                        allowAwaitOutsideFunction: true,
                        allowReturnOutsideFunction: true,
                        allowSuperOutsideMethod: true,
                        allowUndeclaredExports: true,
                        tokens: true, // Required for recast
                    });
                }
            }
        });
    }
}
//# sourceMappingURL=ASTTransformer.js.map