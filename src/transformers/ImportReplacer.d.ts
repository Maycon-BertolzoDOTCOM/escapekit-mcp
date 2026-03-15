/**
 * Import Replacer - Camada 3 (Transformação)
 *
 * Replaces ghost imports with real packages in source code using AST-based
 * transformation. Preserves all formatting, comments, and import structure
 * via recast + Babel parser.
 *
 * @module transformers/ImportReplacer
 */
import { DependencyResolution, CodeTransformation } from '../models/transformation.js';
/**
 * ImportReplacer replaces ghost imports with real packages in source code.
 *
 * Uses ASTTransformer (Babel + recast) for formatting-preserving transformations.
 *
 * @example
 * ```typescript
 * const replacer = new ImportReplacer();
 * const result = replacer.replaceImports(sourceCode, resolutions);
 * console.log(result.transformedCode);
 * ```
 */
export declare class ImportReplacer {
    private readonly astTransformer;
    constructor();
    /**
     * Replace ghost imports in source code with resolved real packages.
     *
     * Parses the source code into an AST using recast (for formatting preservation),
     * finds all import statements, replaces those matching a resolution, and
     * generates the transformed code.
     *
     * @param sourceCode - Original source code containing ghost imports
     * @param resolutions - Array of dependency resolutions mapping ghost → real packages
     * @returns CodeTransformation with original code, transformed code, and applied rules
     * @throws TransformationError if parsing or code generation fails
     *
     * @example
     * ```typescript
     * const result = replacer.replaceImports(
     *   "import api from 'fake-api';",
     *   [{ originalImport: 'fake-api', resolvedPackage: 'axios', ... }]
     * );
     * ```
     */
    replaceImports(sourceCode: string, resolutions: DependencyResolution[]): CodeTransformation;
    /**
     * Validate that a string of code is syntactically valid JavaScript/TypeScript.
     *
     * @param code - Source code to validate
     * @returns true if the code parses without errors, false otherwise
     *
     * @example
     * ```typescript
     * replacer.validateSyntax("import foo from 'bar';"); // true
     * replacer.validateSyntax("import {{{");              // false
     * ```
     */
    validateSyntax(code: string): boolean;
    /**
     * Generate a unified diff between original and transformed code.
     *
     * Produces a human-readable diff in unified format showing what changed.
     *
     * @param original - Original source code
     * @param transformed - Transformed source code
     * @returns Unified diff string
     *
     * @example
     * ```typescript
     * const diff = replacer.generateDiff(
     *   "import api from 'fake-api';",
     *   "import api from 'axios';"
     * );
     * // Returns unified diff showing the change
     * ```
     */
    generateDiff(original: string, transformed: string): string;
    /**
     * Extract the import source string from an import node.
     * Returns null for node types that don't have a simple string source.
     */
    private getImportSource;
    /**
     * Build a unified diff from two arrays of lines.
     */
    private buildUnifiedDiff;
    /**
     * Compute diff hunks using a simple LCS-based approach.
     */
    private computeHunks;
    /**
     * Compute edit operations (insert/delete/equal) between two line arrays.
     * Uses a simple Myers-like diff algorithm.
     */
    private computeEdits;
    /**
     * Count the number of changed lines in a diff string.
     */
    private countChangedLines;
}
//# sourceMappingURL=ImportReplacer.d.ts.map