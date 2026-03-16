import { describe, it, expect } from 'vitest';
import { PostInstallDetector } from '../../src/security/PostInstallDetector';

describe('PostInstallDetector', () => {
  describe('constructor', () => {
    it('should create detector with dependencies', () => {
      const registry = {} as any;
      const parser = {} as any;
      const patternMatcher = {} as any;
      const riskScorer = {} as any;
      const issueGenerator = {} as any;
      const detector = new PostInstallDetector(registry, parser, patternMatcher, riskScorer, issueGenerator);
      expect(detector).toBeDefined();
    });
  });
});
