import { describe, it, expect } from 'vitest';
import { ValidationScorer } from '../../src/validators/ValidationScorer';

// Mock inputs for the score method
const mockProjectResult = {
  summary: { total: 10, passed: 10 },
  checks: [],
  valid: true
};

const mockRuntimeResult = {
  installSuccess: true,
  bootSuccess: true,
  valid: true,
  error: ''
};

const mockE2EResult = {
  valid: true,
  pageLoaded: true,
  jsErrors: [],
  consoleErrors: []
};

describe('ValidationScorer (Expanded)', () => {
  describe('constructor', () => {
    it('should create scorer with default config', () => {
      const scorer = new ValidationScorer();
      expect(scorer).toBeDefined();
    });
  });

  describe('score', () => {
    it('should return a score result object', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: mockProjectResult,
        runtimeResult: mockRuntimeResult,
        e2eResult: mockE2EResult,
        validationLevel: 'thorough' as const
      };
      const result = scorer.score(inputs);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('readyForProduction');
      expect(result).toHaveProperty('recommendations');
    });

    it('should handle perfect validation results', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: mockProjectResult,
        runtimeResult: mockRuntimeResult,
        e2eResult: mockE2EResult,
        validationLevel: 'thorough' as const
      };
      const result = scorer.score(inputs);
      expect(result.overallScore).toBeGreaterThanOrEqual(0.8);
      expect(result.readyForProduction).toBe(true);
    });

    it('should handle basic validation level', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: mockProjectResult,
        validationLevel: 'basic' as const
      };
      const result = scorer.score(inputs);
      expect(result.overallScore).toBeLessThanOrEqual(0.4); // Basic validation maxes at 0.4
    });

    it('should handle validation failures', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: {
          summary: { total: 10, passed: 5 }, // 50% pass rate = 0.5 * 0.4
          checks: [{ passed: false, message: 'Syntax error' }],
          valid: false
        },
        validationLevel: 'basic' as const
      };
      const result = scorer.score(inputs);
      expect(result.overallScore).toBeLessThanOrEqual(0.2); // 0.5 * 0.4 = 0.2
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for improvements', () => {
      const scorer = new ValidationScorer();
      const inputs = {
        projectResult: mockProjectResult,
        validationLevel: 'basic' as const
      };
      const result = scorer.score(inputs);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
