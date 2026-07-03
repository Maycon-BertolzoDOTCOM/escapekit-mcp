import { describe, it, expect } from 'vitest';
import { DependencyResolver } from '../../src/resolvers/DependencyResolver';
import { NPMRegistry } from '../../src/services/NPMRegistry';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase';
import { SemanticMatcher } from '../../src/resolvers/SemanticMatcher';

describe('DependencyResolver', () => {
  describe('constructor', () => {
    it('should create resolver with dependencies', () => {
      const npmRegistry = new NPMRegistry();
      const knowledgeBase = new KnowledgeBase();
      const semanticMatcher = new SemanticMatcher();
      const resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher);
      expect(resolver).toBeDefined();
    });

    it('should create resolver with custom config', () => {
      const npmRegistry = new NPMRegistry();
      const knowledgeBase = new KnowledgeBase();
      const semanticMatcher = new SemanticMatcher();
      const resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher, {
        enableCache: false,
        offlineMode: true
      });
      expect(resolver).toBeDefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const npmRegistry = new NPMRegistry();
      const knowledgeBase = new KnowledgeBase();
      const semanticMatcher = new SemanticMatcher();
      const resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher);
      const stats = resolver.getCacheStats();
      expect(stats).toBeDefined();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getNPMQueryStats', () => {
    it('should return NPM query statistics', () => {
      const npmRegistry = new NPMRegistry();
      const knowledgeBase = new KnowledgeBase();
      const semanticMatcher = new SemanticMatcher();
      const resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher);
      const stats = resolver.getNPMQueryStats();
      expect(stats).toBeDefined();
      expect(stats.totalQueries).toBe(0);
    });
  });
});
