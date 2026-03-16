import { describe, it, expect } from 'vitest';
import { ValidationScorer } from '../../src/validators/ValidationScorer';

describe('ValidationScorer', () => {
  describe('score', () => {
    it('should calculate score for perfect validation', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: {
          summary: { passed: 10, total: 10 },
          checks: [],
          valid: true
        },
        validationLevel: 'basic'
      };
      const result = scorer.score(inputs);
      expect(result.overallScore).toBe(0.4);
      expect(result.readyForProduction).toBe(false);
    });

    it('should calculate score with runtime validation', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: {
          summary: { passed: 10, total: 10 },
          checks: [],
          valid: true
        },
        runtimeResult: {
          installSuccess: true,
          bootSuccess: true,
          error: undefined,
          valid: true
        },
        validationLevel: 'standard'
      };
      const result = scorer.score(inputs);
      expect(result.overallScore).toBe(0.8);
    });

    it('should calculate score with E2E validation', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: {
          summary: { passed: 10, total: 10 },
          checks: [],
          valid: true
        },
        runtimeResult: {
          installSuccess: true,
          bootSuccess: true,
          error: undefined,
          valid: true
        },
        e2eResult: {
          valid: true,
          pageLoaded: true,
          jsErrors: [],
          consoleErrors: [],
          metrics: { loadTimeMs: 1000, hasCanvas: true, hasWebGL: false }
        },
        validationLevel: 'thorough'
      };
      const result = scorer.score(inputs);
      expect(result.overallScore).toBe(1.0);
      expect(result.readyForProduction).toBe(true);
    });

    it('should generate recommendations for failed checks', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: {
          summary: { passed: 8, total: 10 },
          checks: [
            { passed: false, message: 'Syntax error in file.ts' },
            { passed: true, message: 'OK' }
          ]
        },
        validationLevel: 'basic'
      };
      const result = scorer.score(inputs);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});
