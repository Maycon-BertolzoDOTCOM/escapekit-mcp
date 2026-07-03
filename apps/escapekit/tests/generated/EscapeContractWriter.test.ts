import { describe, it, expect } from 'vitest';
import { EscapeContractWriter } from '../../src/generators/EscapeContractWriter';

describe('EscapeContractWriter', () => {
  describe('constructor', () => {
    it('should create writer', () => {
      const writer = new EscapeContractWriter();
      expect(writer).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate contract from params', () => {
      const writer = new EscapeContractWriter();
      const params = {
        analysisResult: {
          analysisId: 'test-id',
          confidenceScore: 0.8,
          summary: { totalIssues: 0, critical: 0, high: 0, medium: 0, low: 0 },
          sandboxType: 'replit',
          ghostImports: [],
          mockApiIssues: [],
          webglIssues: [],
          securityIssues: [],
          issues: []
        },
        resolutions: [],
        transformations: []
      };
      const contract = writer.generate(params);
      expect(contract).toBeDefined();
      expect(contract.contractId).toBeDefined();
      expect(contract.analysisId).toBe('test-id');
    });
  });
});
