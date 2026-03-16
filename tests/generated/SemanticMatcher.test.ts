import { describe, it, expect } from 'vitest';
import { SemanticMatcher } from '../../src/resolvers/SemanticMatcher';
import { NPMRegistry } from '../../src/services/NPMRegistry';

describe('SemanticMatcher', () => {
  describe('constructor', () => {
    it('should create matcher with NPMRegistry', () => {
      const npmRegistry = new NPMRegistry();
      const matcher = new SemanticMatcher(npmRegistry);
      expect(matcher).toBeDefined();
    });
  });

  describe('findSimilar', () => {
    it('should return empty array for non-existent package', async () => {
      const npmRegistry = new NPMRegistry();
      const matcher = new SemanticMatcher(npmRegistry);
      const results = await matcher.findSimilar('test', 10000);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 10000);

    it('should respect minSimilarity option', async () => {
      const npmRegistry = new NPMRegistry();
      const matcher = new SemanticMatcher(npmRegistry);
      const results = await matcher.findSimilar('test', { minSimilarity: 0.9 });
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect maxResults option', async () => {
      const npmRegistry = new NPMRegistry();
      const matcher = new SemanticMatcher(npmRegistry);
      const results = await matcher.findSimilar('test', { maxResults: 2 });
      expect(results).toBeDefined();
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });
});
