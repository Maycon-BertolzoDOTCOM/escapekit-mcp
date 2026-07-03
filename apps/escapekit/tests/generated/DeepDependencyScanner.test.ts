import { describe, it, expect } from 'vitest';
import { DeepDependencyScanner } from '../../src/security/DeepDependencyScanner';
import { NPMRegistry } from '../../src/services/NPMRegistry';
import { LockFileParser } from '../../src/security/LockFileParser';
import { PatternMatcher } from '../../src/security/PatternMatcher';
import { RiskScorer } from '../../src/security/RiskScorer';
import { IssueGenerator } from '../../src/security/IssueGenerator';
import { PostInstallDetector } from '../../src/security/PostInstallDetector';
import { RateLimiter } from '../../src/ratelimit/RateLimiter';

describe('DeepDependencyScanner', () => {
  describe('constructor', () => {
    it('should create scanner with dependencies', () => {
      const registry = new NPMRegistry();
      const lockFileParser = new LockFileParser();
      const patternMatcher = new PatternMatcher();
      const riskScorer = new RiskScorer();
      const issueGenerator = new IssueGenerator();
      const postInstallDetector = new PostInstallDetector(
        registry,
        lockFileParser,
        patternMatcher,
        riskScorer,
        issueGenerator
      );
      const rateLimiter = new RateLimiter(10, 1000);
      const scanner = new DeepDependencyScanner(
        registry,
        lockFileParser,
        patternMatcher,
        riskScorer,
        issueGenerator,
        postInstallDetector,
        rateLimiter
      );
      expect(scanner).toBeDefined();
    });
  });
});
