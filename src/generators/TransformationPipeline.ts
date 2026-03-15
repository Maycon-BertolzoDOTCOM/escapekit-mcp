/**
 * TransformationPipeline - Integrates Phase 2 AnalysisResult with Phase 3 transformation
 *
 * Extracts ghost imports from analysis results and prepares them for resolution
 * and transformation.
 *
 * @module generators/TransformationPipeline
 */

import { logger } from '../logger.js';
import type { AnalysisResult, Issue } from '../models/schemas.js';
import { DiffApplyTransformer } from '../transformers/DiffApplyTransformer.js';
import type { DiffApplyResult } from '../transformers/DiffApplyTransformer.js';

/** Options for pipeline processing */
export interface PipelineOptions {
  /** Force processing of non-autoFixable issues */
  force?: boolean;
  /** Target deployment platform */
  targetPlatform?: string;
  /** Output directory */
  outputDir?: string;
  /** Include Dockerfile */
  includeDocker?: boolean;
  /** Include CI/CD workflow */
  includeCI?: boolean;
  /** User-provided unified diffs to apply (Roo Code integration) */
  diffsToApply?: string[];
  /** Fuzzy matching threshold for diff application (0.0 - 1.0) */
  fuzzyThreshold?: number;
}

/** Result of pipeline processing */
export interface PipelineResult {
  /** Ghost import issues extracted from analysis */
  ghostImports: Issue[];
  /** Whether manual review is required (confidence < 0.5) */
  requiresManualReview: boolean;
  /** Warning messages */
  warnings: string[];
  /** The analysis ID preserved from input */
  analysisId: string;
  /** Skipped issues (non-autoFixable when force=false) */
  skippedIssues: Issue[];
  /** Results of applied diffs (Roo Code integration) */
  diffResults?: DiffApplyResult[];
  /** Modified source code after applying diffs */
  modifiedCode?: string;
}

/**
 * Processes Phase 2 AnalysisResult to extract transformation inputs.
 *
 * @example
 * ```typescript
 * const pipeline = new TransformationPipeline();
 * const result = await pipeline.processAnalysisResult(analysisResult, sourceCode, {
 *   targetPlatform: 'vercel',
 * });
 * ```
 */
export class TransformationPipeline {
  private readonly log = logger.child('TransformationPipeline');
  private readonly diffTransformer: DiffApplyTransformer;

  constructor() {
    this.diffTransformer = new DiffApplyTransformer();
  }

  /**
   * Process an AnalysisResult to extract ghost imports and prepare for transformation.
   *
   * @param result - Phase 2 analysis result
   * @param _sourceCode - Original source code
   * @param options - Pipeline options
   * @returns PipelineResult with extracted ghost imports and warnings
   */
  async processAnalysisResult(
    result: AnalysisResult,
    _sourceCode: string,
    options: PipelineOptions = {}
  ): Promise<PipelineResult> {
    const { force = false } = options;
    const warnings: string[] = [];
    const skippedIssues: Issue[] = [];

    this.log.info('Processing analysis result', {
      analysisId: result.analysisId,
      totalIssues: result.summary.totalIssues,
      confidenceScore: result.confidenceScore,
    });

    // Check confidence score
    const requiresManualReview = result.confidenceScore < 0.5;
    if (requiresManualReview) {
      warnings.push(
        `Low confidence score (${result.confidenceScore.toFixed(2)}): manual review recommended before applying transformations`
      );
      this.log.warn('Low confidence score - manual review required', {
        confidenceScore: result.confidenceScore,
      });
    }

    // Extract ghost import issues
    const allGhostImports = result.issues.filter((issue) => issue.type === 'ghost_import');

    // Filter by autoFixable unless force=true
    const ghostImports: Issue[] = [];
    for (const issue of allGhostImports) {
      if (issue.autoFixable || force) {
        ghostImports.push(issue);
      } else {
        skippedIssues.push(issue);
        warnings.push(
          `Skipping non-autoFixable issue: "${issue.message}" (use force=true to include)`
        );
      }
    }
    this.log.info('Extracted ghost imports', {
      total: allGhostImports.length,
      processable: ghostImports.length,
      skipped: skippedIssues.length,
    });

    let modifiedCode: string | undefined;
    const diffResults: DiffApplyResult[] = [];

    // Apply user-provided diffs (Roo Code integration)
    if (options.diffsToApply && options.diffsToApply.length > 0) {
      this.log.info('Applying user-provided diffs', {
        diffCount: options.diffsToApply.length,
        fuzzyThreshold: options.fuzzyThreshold,
      });

      for (const diff of options.diffsToApply) {
        if (this.diffTransformer.validateDiff(diff)) {
          this.log.warn('Cannot apply diff without file path', { diff: diff.slice(0, 100) });
          warnings.push('Cannot apply diff without file path (diffs must be applied to files)');
          continue;
        }
      }

      // Note: Diffs are typically applied to specific files
      // This is a placeholder for future file-based diff application
      this.log.info('Diff application support is ready for file-based operations');
    }

    return {
      ghostImports,
      requiresManualReview,
      warnings,
      analysisId: result.analysisId,
      skippedIssues,
      diffResults: diffResults.length > 0 ? diffResults : undefined,
      modifiedCode,
    };
  }

  /**
   * Apply a unified diff to a specific file.
   *
   * This method supports Roo Code-style diff-based editing.
   *
   * @param filePath - Path to file to modify
   * @param diffContent - Unified diff content
   * @param fuzzyThreshold - Optional threshold for fuzzy matching (0.0 - 1.0)
   * @returns Result of diff application
   *
   * @example
   * ```typescript
   * const pipeline = new TransformationPipeline();
   * const result = await pipeline.applyDiffToFile(
   *   'src/index.ts',
   *   '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-old\n+new\n'
   * );
   * ```
   */
  async applyDiffToFile(
    filePath: string,
    diffContent: string,
    fuzzyThreshold?: number
  ): Promise<DiffApplyResult> {
    this.log.info('Applying diff to file', { filePath, fuzzyThreshold });

    return this.diffTransformer.applyDiff(filePath, diffContent, {
      fuzzyThreshold,
      backup: true,
    });
  }

  /**
   * Generate a unified diff between two code strings.
   *
   * @param original - Original code
   * @param modified - Modified code
   * @returns Unified diff string
   *
   * @example
   * ```typescript
   * const pipeline = new TransformationPipeline();
   * const diff = pipeline.generateDiff(
   *   "import foo from 'old';",
   *   "import foo from 'new';"
   * );
   * ```
   */
  generateDiff(original: string, modified: string): string {
    return this.diffTransformer.generateDiff(original, modified);
  }

  /**
   * Validate a unified diff format.
   *
   * @param diffContent - Diff content to validate
   * @returns true if valid, false otherwise
   */
  validateDiff(diffContent: string): boolean {
    return this.diffTransformer.validateDiff(diffContent);
  }
}
