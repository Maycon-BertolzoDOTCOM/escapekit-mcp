/**
 * Unit tests for TransformationPipeline
 */

import { describe, it, expect } from 'vitest';
import { TransformationPipeline } from '../../src/generators/TransformationPipeline.js';
import type { AnalysisResult, Issue } from '../../src/models/schemas.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    type: 'ghost_import',
    severity: 'error',
    location: { line: 1 },
    message: "Ghost import 'fake-pkg'",
    description: 'Package does not exist',
    autoFixable: true,
    ...overrides,
  };
}

function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    analysisId: 'analysis-test-456',
    timestamp: new Date().toISOString(),
    language: 'typescript',
    summary: {
      totalIssues: 1,
      ghostImports: 1,
      mockApis: 0,
      unrealisticAssumptions: 0,
      securityRisks: 0,
      infiniteLoops: 0,
    },
    issues: [makeIssue()],
    confidenceScore: 0.9,
    ...overrides,
  };
}

describe('TransformationPipeline', () => {
  const pipeline = new TransformationPipeline();

  describe('processAnalysisResult()', () => {
    it('extracts ghost import issues', async () => {
      const result = await pipeline.processAnalysisResult(makeAnalysisResult(), '');
      expect(result.ghostImports).toHaveLength(1);
      expect(result.ghostImports[0].type).toBe('ghost_import');
    });

    it('ignores non-ghost-import issues', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ issues: [makeIssue({ type: 'mock_api' })] }),
        ''
      );
      expect(result.ghostImports).toHaveLength(0);
    });

    it('skips non-autoFixable issues by default', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ issues: [makeIssue({ autoFixable: false })] }),
        ''
      );
      expect(result.ghostImports).toHaveLength(0);
      expect(result.skippedIssues).toHaveLength(1);
    });

    it('includes non-autoFixable issues when force=true', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ issues: [makeIssue({ autoFixable: false })] }),
        '',
        { force: true }
      );
      expect(result.ghostImports).toHaveLength(1);
      expect(result.skippedIssues).toHaveLength(0);
    });

    it('sets requiresManualReview=true when confidenceScore < 0.5', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ confidenceScore: 0.3 }),
        ''
      );
      expect(result.requiresManualReview).toBe(true);
      expect(result.warnings.some(w => w.includes('Low confidence'))).toBe(true);
    });

    it('sets requiresManualReview=false when confidenceScore >= 0.5', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ confidenceScore: 0.8 }),
        ''
      );
      expect(result.requiresManualReview).toBe(false);
    });

    it('preserves analysisId from input', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ analysisId: 'my-special-id' }),
        ''
      );
      expect(result.analysisId).toBe('my-special-id');
    });

    it('returns empty ghostImports for no ghost import issues', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ issues: [] }),
        ''
      );
      expect(result.ghostImports).toHaveLength(0);
    });

    it('adds warning for skipped non-autoFixable issues', async () => {
      const result = await pipeline.processAnalysisResult(
        makeAnalysisResult({ issues: [makeIssue({ autoFixable: false })] }),
        ''
      );
      expect(result.warnings.some(w => w.includes('non-autoFixable'))).toBe(true);
    });
  });
});
