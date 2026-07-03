import { describe, it, expect } from 'vitest';
import { TransformationPipeline } from '../../src/generators/TransformationPipeline';

describe('TransformationPipeline', () => {
  describe('constructor', () => {
    it('should create pipeline', () => {
      const pipeline = new TransformationPipeline();
      expect(pipeline).toBeDefined();
    });
  });

  describe('processAnalysisResult', () => {
    it('should process analysis result', async () => {
      const pipeline = new TransformationPipeline();
      const analysisResult = {
        analysisId: 'test-id',
        confidenceScore: 0.8,
        summary: { totalIssues: 0, critical: 0, high: 0, medium: 0, low: 0 },
        ghostImports: [],
        mockApiIssues: [],
        webglIssues: [],
        securityIssues: [],
        issues: []
      };
      const sourceCode = 'const x = 1;';
      const result = await pipeline.processAnalysisResult(analysisResult, sourceCode);
      expect(result).toBeDefined();
      expect(result.analysisId).toBe('test-id');
    });
  });
});
