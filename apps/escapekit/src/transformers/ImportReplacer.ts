/**
 * Import Replacer - Camada 3 (Transformação)
 *
 * Replaces ghost imports with real packages in source code using AST-based
 * transformation. Preserves all formatting, comments, and import structure
 * via recast + Babel parser.
 *
 * @module transformers/ImportReplacer
 */

import * as t from '@babel/types';
import { ASTTransformer } from './ASTTransformer.js';
import { TransformationError } from '../errors.js';
import { generateId } from '../models/schemas.js';
import {
  DependencyResolution,
  CodeTransformation,
  TransformationRule,
  TransformationType,
} from '../models/transformation.js';

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
export class ImportReplacer {
  private readonly astTransformer: ASTTransformer;

  constructor() {
    this.astTransformer = new ASTTransformer();
  }

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
  replaceImports(
    sourceCode: string,
    resolutions: DependencyResolution[]
  ): CodeTransformation {
    let ast: t.File;

    try {
      ast = this.astTransformer.parseWithRecast(sourceCode);
    } catch (err) {
      throw new TransformationError(
        `Failed to parse source code: ${(err as Error).message}`,
        'parseWithRecast',
        { sourceCode: sourceCode.slice(0, 200) }
      );
    }

    // Build a lookup map: originalImport → resolvedPackage
    const resolutionMap = new Map<string, DependencyResolution>();
    for (const resolution of resolutions) {
      resolutionMap.set(resolution.originalImport, resolution);
    }

    const appliedRules: TransformationRule[] = [];
    const importNodes = this.astTransformer.findImports(ast);

    for (const node of importNodes) {
      const importSource = this.getImportSource(node);
      if (importSource === null) continue;

      const resolution = resolutionMap.get(importSource);
      if (!resolution) continue;

      // Replace the import source in the AST node
      this.astTransformer.replaceImport(node, resolution.resolvedPackage);

      appliedRules.push({
        ruleId: generateId('rule'),
        ruleType: TransformationType.IMPORT_REPLACEMENT,
        sourcePattern: importSource,
        targetPattern: resolution.resolvedPackage,
        metadata: {
          description: `Replace '${importSource}' with '${resolution.resolvedPackage}'`,
          tags: ['import-replacement'],
        },
      });
    }

    let transformedCode: string;
    try {
      transformedCode = this.astTransformer.generate(ast, { preserveFormatting: true });
    } catch (err) {
      throw new TransformationError(
        `Failed to generate transformed code: ${(err as Error).message}`,
        'generate',
        { sourceCode: sourceCode.slice(0, 200) }
      );
    }

    const diff = this.generateDiff(sourceCode, transformedCode);

    return {
      transformationId: generateId('transform'),
      sourceCode,
      transformedCode,
      appliedRules,
      timestamp: new Date().toISOString(),
      metadata: {
        diff,
        stats: {
          linesChanged: this.countChangedLines(diff),
          importsReplaced: appliedRules.length,
          polyfillsAdded: 0,
        },
      },
    };
  }

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
  validateSyntax(code: string): boolean {
    try {
      this.astTransformer.parse(code);
      return true;
    } catch {
      return false;
    }
  }

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
  generateDiff(original: string, transformed: string): string {
    if (original === transformed) {
      return '';
    }

    const originalLines = original.split('\n');
    const transformedLines = transformed.split('\n');

    return this.buildUnifiedDiff(originalLines, transformedLines, 'original', 'transformed');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract the import source string from an import node.
   * Returns null for node types that don't have a simple string source.
   */
  private getImportSource(node: t.ImportDeclaration | t.CallExpression | t.TSImportType): string | null {
    // ES6 import declaration: import foo from 'source'
    if (t.isImportDeclaration(node)) {
      return node.source.value;
    }

    // CommonJS require or dynamic import: require('source') / import('source')
    if (t.isCallExpression(node)) {
      const firstArg = node.arguments[0];
      if (t.isStringLiteral(firstArg)) {
        return firstArg.value;
      }
    }

    // TypeScript type import: import('source')
    if (t.isTSImportType(node)) {
      if (t.isStringLiteral(node.argument)) {
        return node.argument.value;
      }
    }

    return null;
  }

  /**
   * Build a unified diff from two arrays of lines.
   */
  private buildUnifiedDiff(
    originalLines: string[],
    transformedLines: string[],
    originalLabel: string,
    transformedLabel: string
  ): string {
    const hunks = this.computeHunks(originalLines, transformedLines);
    if (hunks.length === 0) return '';

    const header = `--- ${originalLabel}\n+++ ${transformedLabel}\n`;
    return header + hunks.join('\n');
  }

  /**
   * Compute diff hunks using a simple LCS-based approach.
   */
  private computeHunks(originalLines: string[], transformedLines: string[]): string[] {
    const edits = this.computeEdits(originalLines, transformedLines);
    if (edits.length === 0) return [];

    const CONTEXT = 3;
    const hunks: string[] = [];
    let i = 0;

    while (i < edits.length) {
      // Find the next changed edit
      if (edits[i].type === 'equal') {
        i++;
        continue;
      }

      // Collect a hunk around this change
      const hunkStart = i;
      let hunkEnd = i;

      // Extend to include all nearby changes
      while (hunkEnd < edits.length) {
        if (edits[hunkEnd].type !== 'equal') {
          hunkEnd++;
        } else {
          // Check if there's another change within CONTEXT lines
          let nextChange = hunkEnd + 1;
          while (nextChange < edits.length && edits[nextChange].type === 'equal') {
            nextChange++;
          }
          if (nextChange < edits.length && nextChange - hunkEnd <= CONTEXT * 2) {
            hunkEnd = nextChange;
          } else {
            break;
          }
        }
      }

      // Add context before
      const contextStart = Math.max(0, hunkStart - CONTEXT);
      // Add context after
      const contextEnd = Math.min(edits.length, hunkEnd + CONTEXT);

      // Calculate line numbers
      let origLine = 1;
      let newLine = 1;
      for (let j = 0; j < contextStart; j++) {
        if (edits[j].type === 'equal' || edits[j].type === 'delete') origLine++;
        if (edits[j].type === 'equal' || edits[j].type === 'insert') newLine++;
      }

      let origCount = 0;
      let newCount = 0;
      const hunkLines: string[] = [];

      for (let j = contextStart; j < contextEnd; j++) {
        const edit = edits[j];
        if (edit.type === 'equal') {
          hunkLines.push(` ${edit.line}`);
          origCount++;
          newCount++;
        } else if (edit.type === 'delete') {
          hunkLines.push(`-${edit.line}`);
          origCount++;
        } else {
          hunkLines.push(`+${edit.line}`);
          newCount++;
        }
      }

      hunks.push(`@@ -${origLine},${origCount} +${newLine},${newCount} @@\n${hunkLines.join('\n')}`);
      i = contextEnd;
    }

    return hunks;
  }

  /**
   * Compute edit operations (insert/delete/equal) between two line arrays.
   * Uses a simple Myers-like diff algorithm.
   */
  private computeEdits(
    originalLines: string[],
    transformedLines: string[]
  ): Array<{ type: 'equal' | 'delete' | 'insert'; line: string }> {
    const m = originalLines.length;
    const n = transformedLines.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (originalLines[i - 1] === transformedLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build edits
    const edits: Array<{ type: 'equal' | 'delete' | 'insert'; line: string }> = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && originalLines[i - 1] === transformedLines[j - 1]) {
        edits.unshift({ type: 'equal', line: originalLines[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        edits.unshift({ type: 'insert', line: transformedLines[j - 1] });
        j--;
      } else {
        edits.unshift({ type: 'delete', line: originalLines[i - 1] });
        i--;
      }
    }

    return edits;
  }

  /**
   * Count the number of changed lines in a diff string.
   */
  private countChangedLines(diff: string): number {
    if (!diff) return 0;
    return diff.split('\n').filter(line => line.startsWith('+') || line.startsWith('-')).filter(
      line => !line.startsWith('+++') && !line.startsWith('---')
    ).length;
  }
}
